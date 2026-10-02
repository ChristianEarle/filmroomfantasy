import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import {
  DEAD_LETTER_BEFORE_CLAIM_ERROR,
  DEAD_LETTER_ERROR,
  REAPED_ERROR,
  claimRun,
  completeRun,
  dbNow,
  dispatchTick,
  failRun,
  getOwner,
  handleDeadLetter,
  listJobs,
  listOwners,
  listRuns,
  markDueNow,
  pruneRuns,
  readHeartbeat,
  releaseDispatch,
  setOwner,
  unquarantineJob,
  upsertJobsNow,
  writeHeartbeat,
} from './ledger';
import type { BufferedWrites, JobResult } from './types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const JITTER = 30_000;
const COUNTERS = { d1Calls: 3, rowsRead: 40, rowsWritten: 2, upstreamCalls: 1, creditsUsed: 1 };

const orm = drizzle(env.DB, { schema });
type NewJob = typeof schema.ingestJobs.$inferInsert;

async function addJob(key: string, fields: Partial<NewJob> = {}): Promise<void> {
  await orm.insert(schema.ingestJobs).values({
    key, kind: 'test-kind', groupName: 'odds', nextRunAt: 0, createdAt: 0, updatedAt: 0, ...fields,
  });
}

async function patchJob(key: string, fields: Partial<NewJob>): Promise<void> {
  await orm.update(schema.ingestJobs).set(fields).where(eq(schema.ingestJobs.key, key));
}

async function jobRow(key: string) {
  return orm.select().from(schema.ingestJobs).where(eq(schema.ingestJobs.key, key)).get();
}

async function runRow(id: string) {
  return orm.select().from(schema.ingestRuns).where(eq(schema.ingestRuns.id, id)).get();
}

/** Puts the job under a dispatch lease (as dispatchTick would) and claims it. Returns the run id. */
async function claim(key: string): Promise<string> {
  const token = `token-${key}-${crypto.randomUUID()}`;
  await patchJob(key, { dispatchToken: token, queuedUntil: Date.now() + 30 * MINUTE });
  const runId = crypto.randomUUID();
  expect(await claimRun(env.DB, { key, token, runId })).not.toBeNull();
  return runId;
}

function leasedKeys(result: { leased: Array<{ key: string }> }): string[] {
  return result.leased.map(({ key }) => key).sort();
}

function expectBetween(value: number | null | undefined, low: number, high: number): void {
  expect(value).not.toBeNull();
  expect(value).toBeGreaterThanOrEqual(low);
  expect(value).toBeLessThanOrEqual(high);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ok = (nextRunAt: number | null, extra: Partial<JobResult> = {}): JobResult => ({ status: 'ok', nextRunAt, ...extra });

describe('migration 0049', () => {
  it('seeds every group as legacy and the odds:lines job', async () => {
    const owners = await listOwners(env.DB);
    expect(owners.map(({ group }) => group).sort()).toEqual([
      'games', 'leagues', 'maintenance', 'market', 'news', 'odds', 'players', 'projections', 'props', 'rankings', 'stats',
    ]);
    expect(owners.every(({ owner }) => owner === 'legacy')).toBe(true);

    expect(await jobRow('odds:lines')).toMatchObject({
      kind: 'odds-lines', groupName: 'odds', params: '{}', resourceClass: 'light', priority: 5, nextRunAt: 0, attempts: 0,
    });
  });
});

describe('ingest ledger (workers pool)', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM ingest_jobs'),
      env.DB.prepare('DELETE FROM ingest_runs'),
      env.DB.prepare('DELETE FROM ingest_heartbeat'),
      env.DB.prepare("UPDATE ingest_owner SET owner = 'legacy'"),
    ]);
  });

  describe('SQL clock', () => {
    it('returns integer milliseconds close to the Worker clock', async () => {
      const now = await dbNow(env.DB);
      expect(Number.isInteger(now)).toBe(true);
      expect(Math.abs(now - Date.now())).toBeLessThan(MINUTE);
    });
  });

  describe('dispatchTick', () => {
    it('leases only due jobs in groups owned by ingest', async () => {
      await addJob('odds-job');
      await addJob('props-job', { groupName: 'props' });
      await addJob('orphan-job', { groupName: 'no-such-group' });

      expect((await dispatchTick(env.DB, { maxQueued: 8 })).leased).toEqual([]);

      await setOwner(env.DB, 'odds', 'ingest');
      const before = await dbNow(env.DB);
      const tick = await dispatchTick(env.DB, { maxQueued: 8 });
      const after = await dbNow(env.DB);

      expect(tick.leased).toEqual([{ key: 'odds-job', kind: 'test-kind', token: expect.stringMatching(/^[0-9a-f]{32}$/), priority: 5 }]);
      const job = await jobRow('odds-job');
      expect(job?.dispatchToken).toBe(tick.leased[0].token);
      expectBetween(job?.queuedUntil, before + 30 * MINUTE, after + 30 * MINUTE);
      expect((await jobRow('props-job'))?.dispatchToken).toBeNull();
    });

    it('skips jobs not yet due and jobs in quarantine', async () => {
      await setOwner(env.DB, 'odds', 'ingest');
      const now = await dbNow(env.DB);
      await addJob('due');
      await addJob('future', { nextRunAt: now + HOUR });
      await addJob('quarantined', { disabledUntil: now + HOUR });
      await addJob('quarantine-over', { disabledUntil: now - MINUTE });

      expect(leasedKeys(await dispatchTick(env.DB, { maxQueued: 8 }))).toEqual(['due', 'quarantine-over']);
    });

    it('leases by priority then due time, and stops at maxQueued', async () => {
      await setOwner(env.DB, 'odds', 'ingest');
      await addJob('p1-late', { priority: 1, nextRunAt: 2000 });
      await addJob('p1-early', { priority: 1, nextRunAt: 1000 });
      await addJob('p2', { priority: 2 });
      await addJob('p3', { priority: 3 });
      await addJob('p5', { priority: 5 });

      expect(leasedKeys(await dispatchTick(env.DB, { maxQueued: 1 }))).toEqual(['p1-early']);
      // One message is already queued, so only two more fit under 3.
      const second = await dispatchTick(env.DB, { maxQueued: 3 });
      expect(leasedKeys(second)).toEqual(['p1-late', 'p2']);
      expect(new Set(second.leased.map(({ token }) => token)).size).toBe(2);
      expect((await dispatchTick(env.DB, { maxQueued: 3 })).leased).toEqual([]);

      // Claiming frees a queue slot.
      const p2 = second.leased.find(({ key }) => key === 'p2')!;
      expect(await claimRun(env.DB, { key: 'p2', token: p2.token, runId: crypto.randomUUID() })).not.toBeNull();
      expect(leasedKeys(await dispatchTick(env.DB, { maxQueued: 3 }))).toEqual(['p3']);
    });

    it('keeps one heavy job queued or running at a time', async () => {
      await setOwner(env.DB, 'odds', 'ingest');
      await addJob('heavy-1', { resourceClass: 'heavy', priority: 1 });
      await addJob('heavy-2', { resourceClass: 'heavy', priority: 2 });
      await addJob('light-1', { priority: 9 });

      const first = await dispatchTick(env.DB, { maxQueued: 8 });
      expect(leasedKeys(first)).toEqual(['heavy-1', 'light-1']);
      expect((await dispatchTick(env.DB, { maxQueued: 8 })).leased).toEqual([]);

      const heavy1 = first.leased.find(({ key }) => key === 'heavy-1')!;
      const runId = crypto.randomUUID();
      await claimRun(env.DB, { key: 'heavy-1', token: heavy1.token, runId });
      expect((await dispatchTick(env.DB, { maxQueued: 8 })).leased).toEqual([]);

      await completeRun(env.DB, { key: 'heavy-1', runId, result: ok(Date.now() + DAY), meter: COUNTERS });
      expect(leasedKeys(await dispatchTick(env.DB, { maxQueued: 8 }))).toEqual(['heavy-2']);
    });

    it('releases stale dispatch leases and leaves the job due', async () => {
      await setOwner(env.DB, 'odds', 'ingest');
      const now = await dbNow(env.DB);
      await addJob('lost-message', { dispatchToken: 'stale', queuedUntil: now - MINUTE });
      await addJob('in-flight', { dispatchToken: 'fresh', queuedUntil: now + 10 * MINUTE });

      const tick = await dispatchTick(env.DB, { maxQueued: 8 });

      expect(tick.released).toBe(1);
      expect(tick.leased.map(({ key }) => key)).toEqual(['lost-message']);
      expect(tick.leased[0].token).not.toBe('stale');
      expect((await jobRow('in-flight'))?.dispatchToken).toBe('fresh');
    });

    it('reaps expired runs: the run is killed and the job backs off', async () => {
      await setOwner(env.DB, 'odds', 'ingest');
      await addJob('stuck');
      await addJob('healthy');
      const stuckRun = await claim('stuck');
      const healthyRun = await claim('healthy');
      await patchJob('stuck', { runExpiresAt: 1 });

      const before = await dbNow(env.DB);
      const tick = await dispatchTick(env.DB, { maxQueued: 8 });
      const after = await dbNow(env.DB);

      expect(tick.reaped).toBe(1);
      expect(tick.leased).toEqual([]);
      expect(await runRow(stuckRun)).toMatchObject({ status: 'killed', error: REAPED_ERROR });
      const stuck = await jobRow('stuck');
      expect(stuck).toMatchObject({ attempts: 1, currentRunId: null, runExpiresAt: null, lastStatus: 'failed', lastError: REAPED_ERROR });
      expectBetween(stuck?.nextRunAt, before + 2 * MINUTE, after + 2 * MINUTE + JITTER);
      expect((await runRow(healthyRun))?.status).toBe('running');
      expect((await jobRow('healthy'))?.currentRunId).toBe(healthyRun);
    });

    it('uses the given clock instead of D1\'s when now is passed', async () => {
      await setOwner(env.DB, 'odds', 'ingest');
      const now = await dbNow(env.DB);
      await addJob('later', { nextRunAt: now + HOUR });

      expect((await dispatchTick(env.DB, { maxQueued: 8 })).leased).toEqual([]);
      expect(leasedKeys(await dispatchTick(env.DB, { maxQueued: 8, now: now + 2 * HOUR }))).toEqual(['later']);
      expect((await jobRow('later'))?.queuedUntil).toBe(now + 2 * HOUR + 30 * MINUTE);
    });
  });

  describe('releaseDispatch', () => {
    it('clears only leases whose key and token both match', async () => {
      await setOwner(env.DB, 'odds', 'ingest');
      await addJob('a');
      await addJob('b');
      await addJob('c');
      const { leased } = await dispatchTick(env.DB, { maxQueued: 8 });
      const token = (key: string) => leased.find((job) => job.key === key)!.token;

      const released = await releaseDispatch(env.DB, [
        { key: 'a', token: token('a') },
        { key: 'b', token: token('b') },
        { key: 'c', token: 'not-the-token' },
      ]);

      expect(released).toBe(2);
      expect((await jobRow('a'))).toMatchObject({ dispatchToken: null, queuedUntil: null });
      expect((await jobRow('c'))?.dispatchToken).toBe(token('c'));
      expect(await releaseDispatch(env.DB, [])).toBe(0);
    });

    it('releases more pairs than fit in one statement', async () => {
      await setOwner(env.DB, 'odds', 'ingest');
      await upsertJobsNow(env.DB, Array.from({ length: 120 }, (_, i) => ({ key: `bulk-${i}`, kind: 'test-kind', group: 'odds', nextRunAt: 0 })));
      const { leased } = await dispatchTick(env.DB, { maxQueued: 200 });
      expect(leased).toHaveLength(120);

      expect(await releaseDispatch(env.DB, leased)).toBe(120);
      const { results } = await env.DB.prepare('SELECT COUNT(*) AS n FROM ingest_jobs WHERE dispatch_token IS NOT NULL').all<{ n: number }>();
      expect(results[0].n).toBe(0);
    });
  });

  describe('claimRun', () => {
    beforeEach(async () => {
      await setOwner(env.DB, 'odds', 'ingest');
    });

    it('claims with the leased token, clears the dirty mark and opens a running run', async () => {
      await addJob('job', {
        params: '{"season":2026}', attempts: 2, dispatchToken: 'tok', queuedUntil: Date.now() + MINUTE, dirtyAt: 1, dirtyDueAt: 2,
      });
      const runId = crypto.randomUUID();

      const claimed = await claimRun(env.DB, { key: 'job', token: 'tok', runId });

      expect(claimed).toEqual({ kind: 'test-kind', params: { season: 2026 }, attempts: 2, startedAt: expect.any(Number) });
      expect(await jobRow('job')).toMatchObject({
        currentRunId: runId, runExpiresAt: claimed!.startedAt + 16 * MINUTE, lastStartedAt: claimed!.startedAt,
        dispatchToken: null, queuedUntil: null, dirtyAt: null, dirtyDueAt: null,
      });
      expect(await runRow(runId)).toMatchObject({
        jobKey: 'job', kind: 'test-kind', dispatchToken: 'tok', status: 'running', startedAt: claimed!.startedAt, finishedAt: null,
      });
    });

    it('refuses a message whose group went back to the legacy cron, and releases its lease', async () => {
      await addJob('job', { dispatchToken: 'tok', queuedUntil: Date.now() + MINUTE });
      await setOwner(env.DB, 'odds', 'legacy');
      const runId = crypto.randomUUID();

      expect(await claimRun(env.DB, { key: 'job', token: 'tok', runId })).toBeNull();

      expect(await jobRow('job')).toMatchObject({ dispatchToken: null, queuedUntil: null, currentRunId: null, attempts: 0 });
      expect(await runRow(runId)).toBeUndefined();
    });

    it('returns null for a duplicate or stale message', async () => {
      await addJob('job', { dispatchToken: 'tok', queuedUntil: Date.now() + MINUTE });
      const runId = crypto.randomUUID();

      expect(await claimRun(env.DB, { key: 'job', token: 'wrong', runId: crypto.randomUUID() })).toBeNull();
      expect((await jobRow('job'))?.dispatchToken).toBe('tok');

      expect(await claimRun(env.DB, { key: 'job', token: 'tok', runId })).not.toBeNull();
      const duplicateRun = crypto.randomUUID();
      expect(await claimRun(env.DB, { key: 'job', token: 'tok', runId: duplicateRun })).toBeNull();
      expect((await jobRow('job'))?.currentRunId).toBe(runId);
      expect(await runRow(duplicateRun)).toBeUndefined();
    });
  });

  describe('completeRun', () => {
    beforeEach(async () => {
      await setOwner(env.DB, 'odds', 'ingest');
    });

    it('records success, resets attempts and schedules the next run', async () => {
      await addJob('job', { attempts: 3, lastError: 'old failure' });
      const runId = await claim('job');
      const next = Date.now() + 4 * HOUR;

      const before = await dbNow(env.DB);
      const { superseded } = await completeRun(env.DB, {
        key: 'job', runId, result: ok(next, { changed: true, detail: { inserted: 4 } }), meter: COUNTERS,
      });

      expect(superseded).toBe(false);
      const job = await jobRow('job');
      expect(job).toMatchObject({
        nextRunAt: next, attempts: 0, lastStatus: 'ok', lastError: null, currentRunId: null, runExpiresAt: null,
        dirtyAt: null, dirtyDueAt: null,
      });
      expect(job?.lastSuccessAt).toBeGreaterThanOrEqual(before);
      expect(job?.lastFinishedAt).toBe(job?.lastSuccessAt);
      const run = await runRow(runId);
      expect(run).toMatchObject({ status: 'ok', d1Calls: 3, rowsRead: 40, rowsWritten: 2, upstreamCalls: 1, creditsUsed: 1, error: null });
      expect(JSON.parse(run!.detail!)).toEqual({ inserted: 4, changed: true });
      expect(run?.finishedAt).toBeGreaterThanOrEqual(before);
    });

    it('applies buffered writes while the run holds its job', async () => {
      const far = Date.now() + DAY;
      await addJob('job');
      await addJob('dependent', { nextRunAt: far });
      await addJob('doomed');
      await addJob('busy', { currentRunId: 'someone-else', runExpiresAt: far });
      await addJob('existing', { params: '{"v":1}', priority: 5, nextRunAt: far, attempts: 2, dispatchToken: 'queued', queuedUntil: far });
      const runId = await claim('job');

      const buffered: BufferedWrites = [
        { op: 'markDue', keys: ['dependent', 'missing'], debounceMs: 2 * MINUTE },
        {
          op: 'upsertJobs',
          specs: [
            { key: 'created', kind: 'other-kind', group: 'stats', params: { week: 4 }, resourceClass: 'heavy', priority: 2 },
            { key: 'existing', kind: 'test-kind', group: 'odds', params: { v: 2 }, priority: 1, nextRunAt: 0 },
          ],
        },
        { op: 'deleteJobs', keys: ['doomed', 'busy'] },
      ];
      const before = await dbNow(env.DB);
      await completeRun(env.DB, { key: 'job', runId, result: ok(far), meter: COUNTERS, buffered });
      const after = await dbNow(env.DB);

      const dependent = await jobRow('dependent');
      expectBetween(dependent?.nextRunAt, before + 2 * MINUTE, after + 2 * MINUTE);
      expectBetween(dependent?.dirtyAt, before, after);
      expect(dependent?.dirtyDueAt).toBe(dependent?.nextRunAt);

      const created = await jobRow('created');
      expect(created).toMatchObject({ kind: 'other-kind', groupName: 'stats', params: '{"week":4}', resourceClass: 'heavy', priority: 2 });
      expectBetween(created?.nextRunAt, before, after);

      // An upsert redefines an existing job but never touches its schedule, leases or attempts.
      expect(await jobRow('existing')).toMatchObject({
        params: '{"v":2}', priority: 1, nextRunAt: far, attempts: 2, dispatchToken: 'queued', queuedUntil: far,
      });

      expect(await jobRow('doomed')).toBeUndefined();
      expect(await jobRow('busy')).toBeDefined();
    });

    it('records superseded and writes nothing once the run lost its lease', async () => {
      const far = Date.now() + DAY;
      await addJob('job');
      await addJob('dependent', { nextRunAt: far });
      await addJob('doomed');
      const runId = await claim('job');
      // Reaped, re-dispatched and claimed by a newer run meanwhile.
      await patchJob('job', { currentRunId: 'newer-run', nextRunAt: 12345 });

      const { superseded } = await completeRun(env.DB, {
        key: 'job', runId, result: ok(far), meter: COUNTERS,
        buffered: [
          { op: 'markDue', keys: ['dependent'], debounceMs: 0 },
          { op: 'upsertJobs', specs: [{ key: 'created', kind: 'test-kind', group: 'odds' }] },
          { op: 'deleteJobs', keys: ['doomed'] },
        ],
      });

      expect(superseded).toBe(true);
      expect((await runRow(runId))?.status).toBe('superseded');
      expect(await jobRow('job')).toMatchObject({ currentRunId: 'newer-run', nextRunAt: 12345 });
      expect(await jobRow('dependent')).toMatchObject({ nextRunAt: far, dirtyAt: null });
      expect(await jobRow('created')).toBeUndefined();
      expect(await jobRow('doomed')).toBeDefined();
    });

    it('retires the job when nextRunAt is null', async () => {
      await addJob('job');
      const runId = await claim('job');

      const { superseded } = await completeRun(env.DB, { key: 'job', runId, result: { status: 'skipped', nextRunAt: null }, meter: COUNTERS });

      expect(superseded).toBe(false);
      expect(await jobRow('job')).toBeUndefined();
      expect((await runRow(runId))?.status).toBe('skipped');
    });

    it('keeps a job marked due during its run due afterwards', async () => {
      const far = Date.now() + DAY;
      await addJob('job');
      await addJob('upstream');
      const runId = await claim('job');
      await sleep(5);

      // Another run marks `job` due while it is still running.
      const upstreamRun = await claim('upstream');
      await completeRun(env.DB, {
        key: 'upstream', runId: upstreamRun, result: ok(far), meter: COUNTERS,
        buffered: [{ op: 'markDue', keys: ['job'], debounceMs: MINUTE }],
      });
      const dirty = await jobRow('job');

      await completeRun(env.DB, { key: 'job', runId, result: ok(far), meter: COUNTERS });
      expect(await jobRow('job')).toMatchObject({ nextRunAt: dirty?.dirtyDueAt, dirtyAt: dirty?.dirtyAt });

      // The next run started after the mark, so it consumes it.
      await sleep(5);
      const nextRun = await claim('job');
      await completeRun(env.DB, { key: 'job', runId: nextRun, result: ok(far), meter: COUNTERS });
      expect(await jobRow('job')).toMatchObject({ nextRunAt: far, dirtyAt: null, dirtyDueAt: null });
    });

    it("never lets an earlier run's mark pull a later dirty run's next due time forward", async () => {
      const far = Date.now() + DAY;
      await addJob('job');
      await addJob('upstream');
      const markJob = async (debounceMs: number) => {
        const upstreamRun = await claim('upstream');
        await completeRun(env.DB, {
          key: 'upstream', runId: upstreamRun, result: ok(far), meter: COUNTERS,
          buffered: [{ op: 'markDue', keys: ['job'], debounceMs }],
        });
      };

      const firstRun = await claim('job');
      await sleep(5);
      await markJob(MINUTE);
      await completeRun(env.DB, { key: 'job', runId: firstRun, result: ok(far), meter: COUNTERS });

      await sleep(5);
      const secondRun = await claim('job');
      await sleep(5);
      const before = await dbNow(env.DB);
      await markJob(30 * MINUTE);
      const after = await dbNow(env.DB);
      await completeRun(env.DB, { key: 'job', runId: secondRun, result: ok(far), meter: COUNTERS });

      expectBetween((await jobRow('job'))?.nextRunAt, before + 30 * MINUTE, after + 30 * MINUTE);
    });

    it('applies buffered writes in the order the run made them', async () => {
      const far = Date.now() + DAY;
      await addJob('job');
      await addJob('recreated', { params: '{"v":1}', attempts: 3, nextRunAt: 777 });
      const runId = await claim('job');

      const before = await dbNow(env.DB);
      await completeRun(env.DB, {
        key: 'job', runId, result: ok(far), meter: COUNTERS,
        buffered: [
          { op: 'deleteJobs', keys: ['recreated'] },
          {
            op: 'upsertJobs',
            specs: [
              { key: 'recreated', kind: 'test-kind', group: 'odds', params: { v: 2 }, nextRunAt: far },
              { key: 'spawned', kind: 'test-kind', group: 'odds', nextRunAt: far },
            ],
          },
          { op: 'markDue', keys: ['spawned'], debounceMs: 0 },
        ],
      });
      const after = await dbNow(env.DB);

      expect(await jobRow('recreated')).toMatchObject({ params: '{"v":2}', attempts: 0, nextRunAt: far });
      expectBetween((await jobRow('spawned'))?.nextRunAt, before, after);
    });

    it('keeps a job that asked to retire but was marked due during its run', async () => {
      await addJob('job');
      const runId = await claim('job');
      await sleep(5);
      await markDueNow(env.DB, ['job']);

      const { superseded } = await completeRun(env.DB, { key: 'job', runId, result: ok(null), meter: COUNTERS });

      expect(superseded).toBe(false);
      const job = await jobRow('job');
      expect(job).toMatchObject({ currentRunId: null, lastStatus: 'ok' });
      expect(job?.nextRunAt).toBe(job?.dirtyDueAt);
    });

    it('rolls the whole completion back when one statement fails', async () => {
      await addJob('job');
      await addJob('doomed');
      const runId = await claim('job');

      await expect(completeRun(env.DB, {
        key: 'job', runId, result: ok(Date.now() + DAY), meter: COUNTERS,
        buffered: [
          { op: 'deleteJobs', keys: ['doomed'] },
          { op: 'upsertJobs', specs: [{ key: 'broken', kind: null as unknown as string, group: 'odds' }] },
        ],
      })).rejects.toThrow(/NOT NULL/);

      expect((await jobRow('job'))?.currentRunId).toBe(runId);
      expect((await runRow(runId))?.status).toBe('running');
      expect(await jobRow('doomed')).toBeDefined();
    });
  });

  describe('failRun', () => {
    beforeEach(async () => {
      await setOwner(env.DB, 'odds', 'ingest');
    });

    it('backs off exponentially and quarantines at the 5th consecutive failure', async () => {
      await addJob('job');

      for (const [i, backoff] of [2, 4, 8, 16].map((m) => m * MINUTE).entries()) {
        const runId = await claim('job');
        const before = await dbNow(env.DB);
        const { superseded } = await failRun(env.DB, { key: 'job', runId, error: new Error('upstream 500'), meter: COUNTERS });
        const after = await dbNow(env.DB);

        expect(superseded).toBe(false);
        const job = await jobRow('job');
        expect(job).toMatchObject({
          attempts: i + 1, disabledUntil: null, lastStatus: 'failed', lastError: 'upstream 500', currentRunId: null, runExpiresAt: null,
        });
        expectBetween(job?.nextRunAt, before + backoff, after + backoff + JITTER);
        expect(await runRow(runId)).toMatchObject({ status: 'failed', error: 'upstream 500', d1Calls: 3 });
      }

      const runId = await claim('job');
      const before = await dbNow(env.DB);
      await failRun(env.DB, { key: 'job', runId, error: 'still down' });
      const after = await dbNow(env.DB);
      const job = await jobRow('job');
      expect(job?.attempts).toBe(5);
      expectBetween(job?.disabledUntil, before + 6 * HOUR, after + 6 * HOUR);

      await patchJob('job', { nextRunAt: 0 });
      expect((await dispatchTick(env.DB, { maxQueued: 8 })).leased).toEqual([]);
      await unquarantineJob(env.DB, 'job');
      expect(leasedKeys(await dispatchTick(env.DB, { maxQueued: 8 }))).toEqual(['job']);
    });

    it('caps the backoff at 6 hours however many attempts have failed', async () => {
      for (const attempts of [9, 70]) {
        await addJob(`job-${attempts}`, { attempts });
        const runId = await claim(`job-${attempts}`);
        const before = await dbNow(env.DB);
        await failRun(env.DB, { key: `job-${attempts}`, runId, error: 'boom' });
        const after = await dbNow(env.DB);
        expectBetween((await jobRow(`job-${attempts}`))?.nextRunAt, before + 6 * HOUR, after + 6 * HOUR + JITTER);
      }
    });

    it('retires the job on a terminal error', async () => {
      await addJob('job');
      const runId = await claim('job');

      await failRun(env.DB, { key: 'job', runId, error: new Error('league deleted'), terminal: true });

      expect(await jobRow('job')).toBeUndefined();
      expect(await runRow(runId)).toMatchObject({ status: 'skipped', error: 'league deleted' });
    });

    it('still applies the markDue writes of a failed run, but not its other buffered writes', async () => {
      const far = Date.now() + DAY;
      await addJob('job');
      await addJob('dependent', { nextRunAt: far });
      await addJob('doomed');
      const runId = await claim('job');

      const before = await dbNow(env.DB);
      const { superseded } = await failRun(env.DB, {
        key: 'job', runId, error: 'failed after writing',
        buffered: [
          { op: 'markDue', keys: ['dependent'], debounceMs: 2 * MINUTE },
          { op: 'upsertJobs', specs: [{ key: 'created', kind: 'test-kind', group: 'odds' }] },
          { op: 'deleteJobs', keys: ['doomed'] },
        ],
      });
      const after = await dbNow(env.DB);

      expect(superseded).toBe(false);
      expect(await jobRow('job')).toMatchObject({ attempts: 1, lastStatus: 'failed', currentRunId: null });
      expectBetween((await jobRow('dependent'))?.nextRunAt, before + 2 * MINUTE, after + 2 * MINUTE);
      expect(await jobRow('created')).toBeUndefined();
      expect(await jobRow('doomed')).toBeDefined();
    });

    it('records superseded and leaves the job and its dependents alone once the run lost its lease', async () => {
      const far = Date.now() + DAY;
      await addJob('job');
      await addJob('dependent', { nextRunAt: far });
      const runId = await claim('job');
      await patchJob('job', { currentRunId: 'newer-run' });

      const { superseded } = await failRun(env.DB, {
        key: 'job', runId, error: 'late failure', buffered: [{ op: 'markDue', keys: ['dependent'], debounceMs: 0 }],
      });

      expect(superseded).toBe(true);
      expect((await runRow(runId))?.status).toBe('superseded');
      expect(await jobRow('job')).toMatchObject({ currentRunId: 'newer-run', attempts: 0, lastError: null });
      expect(await jobRow('dependent')).toMatchObject({ nextRunAt: far, dirtyAt: null });
    });
  });

  describe('handleDeadLetter', () => {
    beforeEach(async () => {
      await setOwner(env.DB, 'odds', 'ingest');
    });

    it('kills the running run of a claimed job', async () => {
      await addJob('job');
      const token = 'tok';
      await patchJob('job', { dispatchToken: token, queuedUntil: Date.now() + MINUTE });
      const runId = crypto.randomUUID();
      await claimRun(env.DB, { key: 'job', token, runId });

      const outcome = await handleDeadLetter(env.DB, { v: 1, key: 'job', token, kind: 'test-kind' });

      expect(outcome).toBe('killed');
      expect(await runRow(runId)).toMatchObject({ status: 'killed', error: DEAD_LETTER_ERROR });
      expect(await jobRow('job')).toMatchObject({ attempts: 1, currentRunId: null, lastStatus: 'failed', lastError: DEAD_LETTER_ERROR });
    });

    it('records a killed run for a message that died before claiming', async () => {
      await addJob('job', { dispatchToken: 'tok', queuedUntil: Date.now() + MINUTE });
      const before = await dbNow(env.DB);

      const outcome = await handleDeadLetter(env.DB, { v: 1, key: 'job', token: 'tok', kind: 'test-kind' });

      expect(outcome).toBe('killed_before_claim');
      const job = await jobRow('job');
      expect(job).toMatchObject({ attempts: 1, dispatchToken: null, queuedUntil: null, lastError: DEAD_LETTER_BEFORE_CLAIM_ERROR });
      expect(job?.nextRunAt).toBeGreaterThanOrEqual(before + 2 * MINUTE);
      const runs = await listRuns(env.DB, 'job');
      expect(runs).toMatchObject([{ status: 'killed', error: DEAD_LETTER_BEFORE_CLAIM_ERROR, kind: 'test-kind' }]);
      expect((await runRow(runs[0].id))?.dispatchToken).toBe('tok');
    });

    it('leaves alone a run claimed from a different message', async () => {
      await addJob('job');
      const liveRun = await claim('job');

      // A late or retried dead letter for an earlier dispatch of the same job.
      const outcome = await handleDeadLetter(env.DB, { v: 1, key: 'job', token: 'earlier-token', kind: 'test-kind' });

      expect(outcome).toBe('ignored');
      expect((await runRow(liveRun))?.status).toBe('running');
      expect(await jobRow('job')).toMatchObject({ currentRunId: liveRun, attempts: 0, lastError: null });
    });

    it('ignores a message whose job has already moved on', async () => {
      await addJob('job', { dispatchToken: 'newer-token', queuedUntil: Date.now() + MINUTE });

      expect(await handleDeadLetter(env.DB, { v: 1, key: 'job', token: 'old-token', kind: 'test-kind' })).toBe('ignored');
      expect(await handleDeadLetter(env.DB, { v: 1, key: 'missing', token: 'tok', kind: 'test-kind' })).toBe('ignored');
      expect(await jobRow('job')).toMatchObject({ attempts: 0, dispatchToken: 'newer-token' });
      expect(await listRuns(env.DB, null)).toEqual([]);
    });
  });

  describe('admin helpers', () => {
    it('markDueNow makes existing jobs due', async () => {
      await addJob('job', { nextRunAt: Date.now() + DAY });

      const before = await dbNow(env.DB);
      expect(await markDueNow(env.DB, ['job', 'missing'])).toBe(1);
      const after = await dbNow(env.DB);

      expectBetween((await jobRow('job'))?.nextRunAt, before, after);
    });

    it('setOwner flips known groups only', async () => {
      expect(await setOwner(env.DB, 'odds', 'ingest')).toBe(true);
      expect(await getOwner(env.DB, 'odds')).toBe('ingest');
      expect(await setOwner(env.DB, 'odds', 'legacy')).toBe(true);
      expect(await getOwner(env.DB, 'odds')).toBe('legacy');

      expect(await setOwner(env.DB, 'no-such-group', 'ingest')).toBe(false);
      expect(await getOwner(env.DB, 'no-such-group')).toBeNull();
    });

    it('unquarantineJob clears quarantine and attempts', async () => {
      await addJob('job', { attempts: 5, disabledUntil: Date.now() + HOUR });

      expect(await unquarantineJob(env.DB, 'job')).toBe(true);
      expect(await jobRow('job')).toMatchObject({ attempts: 0, disabledUntil: null });
      expect(await unquarantineJob(env.DB, 'missing')).toBe(false);
    });

    it('upsertJobsNow creates jobs and never resets an existing schedule', async () => {
      await addJob('existing', { nextRunAt: 777, attempts: 1, currentRunId: 'run', runExpiresAt: 888 });

      expect(await upsertJobsNow(env.DB, [
        { key: 'existing', kind: 'renamed', group: 'odds', nextRunAt: 0 },
        { key: 'fresh', kind: 'test-kind', group: 'props', nextRunAt: 555 },
      ])).toBe(2);

      expect(await jobRow('existing')).toMatchObject({ kind: 'renamed', nextRunAt: 777, attempts: 1, currentRunId: 'run', runExpiresAt: 888 });
      expect(await jobRow('fresh')).toMatchObject({ groupName: 'props', nextRunAt: 555, params: '{}', resourceClass: 'light', priority: 5 });
    });

    it('listJobs includes each group\'s owner', async () => {
      await setOwner(env.DB, 'odds', 'ingest');
      await addJob('odds-job');
      await addJob('props-job', { groupName: 'props' });

      const jobs = await listJobs(env.DB);

      expect(jobs.map(({ key, group, owner }) => ({ key, group, owner }))).toEqual([
        { key: 'odds-job', group: 'odds', owner: 'ingest' },
        { key: 'props-job', group: 'props', owner: 'legacy' },
      ]);
      expect(jobs[0]).toMatchObject({ kind: 'test-kind', resourceClass: 'light', nextRunAt: 0, disabledUntil: null, currentRunId: null });
    });

    it('listRuns returns the newest runs first, optionally for one job', async () => {
      const insertRun = (id: string, jobKey: string, startedAt: number) =>
        env.DB.prepare("INSERT INTO ingest_runs (id, job_key, kind, started_at, status, detail) VALUES (?1, ?2, 'k', ?3, 'ok', ?4)")
          .bind(id, jobKey, startedAt, JSON.stringify({ n: startedAt }));
      await env.DB.batch([insertRun('r1', 'a', 1), insertRun('r2', 'b', 2), insertRun('r3', 'a', 3)]);

      expect((await listRuns(env.DB, null)).map(({ id }) => id)).toEqual(['r3', 'r2', 'r1']);
      expect((await listRuns(env.DB, null, 2)).map(({ id }) => id)).toEqual(['r3', 'r2']);
      const forA = await listRuns(env.DB, 'a');
      expect(forA.map(({ id }) => id)).toEqual(['r3', 'r1']);
      expect(forA[0]).toMatchObject({ jobKey: 'a', startedAt: 3, status: 'ok', detail: { n: 3 } });
    });

    it('writeHeartbeat overwrites the previous beat', async () => {
      await writeHeartbeat(env.DB, 'dispatcher', { leased: 1 });
      await writeHeartbeat(env.DB, 'dispatcher', { leased: 2 });

      const beat = await readHeartbeat(env.DB, 'dispatcher');
      expect(beat?.detail).toEqual({ leased: 2 });
      expect(Math.abs(beat!.at - Date.now())).toBeLessThan(MINUTE);
      expect(await readHeartbeat(env.DB, 'missing')).toBeNull();
    });

    it('pruneRuns deletes finished runs older than the cutoff', async () => {
      const now = await dbNow(env.DB);
      const insertRun = (id: string, startedAt: number, status: string) =>
        env.DB.prepare("INSERT INTO ingest_runs (id, job_key, kind, started_at, status) VALUES (?1, 'a', 'k', ?2, ?3)").bind(id, startedAt, status);
      await env.DB.batch([
        insertRun('old', now - 15 * DAY, 'ok'),
        insertRun('old-running', now - 15 * DAY, 'running'),
        insertRun('recent', now - DAY, 'failed'),
      ]);

      expect(await pruneRuns(env.DB, 14 * DAY)).toBe(1);
      expect((await listRuns(env.DB, null)).map(({ id }) => id).sort()).toEqual(['old-running', 'recent']);
    });
  });
});
