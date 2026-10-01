import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { consumeBatch, consumeDeadLetters } from './consumer';
import { registerHandler } from './handlers';
import { claimRun, dbNow, dispatchTick, listJobs, listRuns, setOwner, upsertJobsNow } from './ledger';
import { BudgetExceededError } from './meter';
import { TerminalJobError } from './types';
import type { IngestEnv, IngestMessage, JobContext, JobHandler, JobResult } from './types';
import worker from './worker';

const FAKE_KIND = 'test-fake';
const SOFT_DEADLINE_MS = 5_000;
const DAY = 24 * 60 * 60_000;

const ok = (nextRunAt: number | null, extra: Partial<JobResult> = {}): JobResult => ({ status: 'ok', nextRunAt, ...extra });

const unusedQueue = { send: vi.fn(), sendBatch: vi.fn() } as unknown as Queue<IngestMessage>;

function ingestEnv(overrides: Partial<IngestEnv> = {}): IngestEnv {
  return { DB: env.DB, INGEST_QUEUE: unusedQueue, INGEST_INTERACTIVE_QUEUE: unusedQueue, ENVIRONMENT: 'test', ...overrides };
}

function fakeMessage(body: unknown) {
  return { id: crypto.randomUUID(), timestamp: new Date(), body, attempts: 1, ack: vi.fn(), retry: vi.fn() };
}

type FakeMessage = ReturnType<typeof fakeMessage>;

function batchOf(queue: string, ...messages: FakeMessage[]): MessageBatch<unknown> {
  return { queue, messages, ackAll: vi.fn(), retryAll: vi.fn() };
}

/** Delivers one message on the `ingest` queue. */
async function deliver(body: unknown) {
  const msg = fakeMessage(body);
  const [outcome] = await consumeBatch(batchOf('ingest', msg), ingestEnv());
  return { msg, outcome };
}

/** Creates (or reuses) a due job, leases it as the dispatcher would, and returns the message the dispatcher would send. */
async function dispatch(key: string, { kind = FAKE_KIND, params = {} }: { kind?: string; params?: unknown } = {}): Promise<IngestMessage> {
  await upsertJobsNow(env.DB, [{ key, kind, group: 'odds', params, nextRunAt: 0 }]);
  const job = (await dispatchTick(env.DB, { maxQueued: 8 })).leased.find((leased) => leased.key === key);
  if (!job) throw new Error(`${key} was not leased`);
  return { v: 1, key, token: job.token, kind: job.kind };
}

async function jobRow(key: string) {
  return (await listJobs(env.DB)).find((job) => job.key === key);
}

/** A D1 binding whose batches fail, as in a D1 outage. */
function unavailableDb(): D1Database {
  return {
    prepare: (query: string) => env.DB.prepare(query),
    batch: () => Promise.reject(new Error('D1 unavailable')),
  } as unknown as D1Database;
}

async function paidCall(idemKey: string) {
  return env.DB.prepare('SELECT status FROM paid_calls WHERE idem_key = ?1').bind(idemKey).first<{ status: string }>();
}

let restoreHandler: (() => void) | undefined;

function useHandler(run: JobHandler['run'], softDeadlineMs = SOFT_DEADLINE_MS): void {
  restoreHandler = registerHandler({ kind: FAKE_KIND, group: 'odds', resourceClass: 'light', softDeadlineMs, run });
}

function silenceLogs(): void {
  for (const method of ['log', 'warn', 'error'] as const) vi.spyOn(console, method).mockImplementation(() => {});
}

describe('ingest consumer (workers pool)', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM ingest_jobs'),
      env.DB.prepare('DELETE FROM ingest_runs'),
      env.DB.prepare('DELETE FROM paid_calls'),
      env.DB.prepare("UPDATE ingest_owner SET owner = 'legacy'"),
    ]);
    await setOwner(env.DB, 'odds', 'ingest');
    silenceLogs();
  });

  afterEach(() => {
    restoreHandler?.();
    restoreHandler = undefined;
    vi.restoreAllMocks();
  });

  describe('consumeBatch', () => {
    it('runs the claimed job, applies its buffered writes and records the run', async () => {
      const next = Date.now() + DAY;
      await upsertJobsNow(env.DB, [{ key: 'dependent', kind: FAKE_KIND, group: 'odds', nextRunAt: next }]);
      let seen: { ctx: JobContext; params: unknown } | undefined;
      useHandler(async (ctx, params) => {
        seen = { ctx, params };
        await ctx.db.select().from(schema.ingestJobs).where(eq(schema.ingestJobs.key, 'dependent'));
        ctx.meter.countUpstream();
        ctx.reportCredits(3);
        ctx.markDue(['dependent'], 0);
        ctx.upsertJobs([{ key: 'spawned', kind: FAKE_KIND, group: 'odds', nextRunAt: next }]);
        return ok(next, { changed: true, detail: { inserted: 2 } });
      });

      const before = await dbNow(env.DB);
      const { msg, outcome } = await deliver(await dispatch('job', { params: { season: 2026 } }));

      expect(outcome).toBe('ok');
      expect(msg.ack).toHaveBeenCalledOnce();
      expect(msg.retry).not.toHaveBeenCalled();
      expect(seen?.params).toEqual({ season: 2026 });
      expect(seen!.ctx.attempts).toBe(0);
      expect(seen!.ctx.deadline - seen!.ctx.now).toBe(SOFT_DEADLINE_MS);
      expect(seen!.ctx.signal.aborted).toBe(false);

      expect(await jobRow('job')).toMatchObject({ nextRunAt: next, attempts: 0, lastStatus: 'ok', currentRunId: null, dispatchToken: null });
      expect(await listRuns(env.DB, 'job')).toMatchObject([{
        status: 'ok', d1Calls: 1, upstreamCalls: 1, creditsUsed: 3, detail: { inserted: 2, changed: true }, error: null,
      }]);
      const dependent = await jobRow('dependent');
      expect(dependent?.nextRunAt).toBeLessThan(next);
      expect(dependent?.dirtyAt).toBeGreaterThanOrEqual(before);
      expect(await jobRow('spawned')).toMatchObject({ kind: FAKE_KIND, nextRunAt: next });
    });

    it('aborts ctx.signal at the soft deadline', async () => {
      useHandler(async (ctx) => {
        await new Promise((resolve) => ctx.signal.addEventListener('abort', resolve));
        return ok(Date.now() + DAY, { status: 'partial', detail: { reason: String(ctx.signal.reason) } });
      }, 20);

      const { outcome } = await deliver(await dispatch('job'));

      expect(outcome).toBe('partial');
      expect(await listRuns(env.DB, 'job')).toMatchObject([{ status: 'partial', detail: { reason: 'Error: soft deadline of 20 ms passed' } }]);
    });

    it.each([
      ['an upstream error', new Error('upstream 500')],
      ['a spent D1 budget', new BudgetExceededError(900)],
    ])('records a failed run and acks when the handler throws %s', async (_, error) => {
      useHandler(async () => {
        throw error;
      });

      const { msg, outcome } = await deliver(await dispatch('job'));

      expect(outcome).toBe('failed');
      expect(msg.ack).toHaveBeenCalledOnce();
      expect(msg.retry).not.toHaveBeenCalled();
      expect(await jobRow('job')).toMatchObject({ attempts: 1, lastStatus: 'failed', lastError: error.message, currentRunId: null });
      expect(await listRuns(env.DB, 'job')).toMatchObject([{ status: 'failed', error: error.message }]);
    });

    it('retires the job when the handler throws a TerminalJobError', async () => {
      useHandler(async () => {
        throw new TerminalJobError('league deleted');
      });

      const { msg, outcome } = await deliver(await dispatch('job'));

      expect(outcome).toBe('retired');
      expect(msg.ack).toHaveBeenCalledOnce();
      expect(await jobRow('job')).toBeUndefined();
      expect(await listRuns(env.DB, 'job')).toMatchObject([{ status: 'skipped', error: 'league deleted' }]);
    });

    it('keeps the markDue of a run that fails after writing', async () => {
      const far = Date.now() + DAY;
      await upsertJobsNow(env.DB, [{ key: 'dependent', kind: FAKE_KIND, group: 'odds', nextRunAt: far }]);
      useHandler(async (ctx) => {
        ctx.markDue(['dependent'], 0);
        throw new Error('upstream 500 after the first page was written');
      });

      const { outcome } = await deliver(await dispatch('job'));

      expect(outcome).toBe('failed');
      expect((await jobRow('dependent'))?.nextRunAt).toBeLessThan(far);
    });

    it('tells the retry of a killed run about the failure, so it can re-signal dependents the killed run never marked due', async () => {
      const far = Date.now() + DAY;
      await upsertJobsNow(env.DB, [{ key: 'dependent', kind: FAKE_KIND, group: 'odds', nextRunAt: far }]);
      const attemptsSeen: number[] = [];
      useHandler(async (ctx) => {
        attemptsSeen.push(ctx.attempts);
        if (ctx.attempts > 0) ctx.markDue(['dependent'], 0);
        return ok(Date.now() + DAY, { changed: false });
      });
      // The first invocation claims, writes its data and dies before completing; its buffered markDue dies with it.
      const killed = await dispatch('job');
      await claimRun(env.DB, { key: 'job', token: killed.token, runId: crypto.randomUUID() });
      await consumeDeadLetters(batchOf('ingest-dlq', fakeMessage(killed)), ingestEnv());
      await env.DB.prepare("UPDATE ingest_jobs SET next_run_at = 0 WHERE key = 'job'").run();

      const { outcome } = await deliver(await dispatch('job'));

      expect(outcome).toBe('ok');
      expect(attemptsSeen).toEqual([1]);
      expect((await jobRow('dependent'))?.nextRunAt).toBeLessThan(far);
      expect(await jobRow('job')).toMatchObject({ attempts: 0, lastStatus: 'ok' });
    });

    it.each(['no-such-kind', 'constructor'])('acks a job of unknown kind %s and backs it off without deleting it', async (kind) => {
      const { msg, outcome } = await deliver(await dispatch('job', { kind }));

      expect(outcome).toBe('unknown_kind');
      expect(msg.ack).toHaveBeenCalledOnce();
      expect(await jobRow('job')).toMatchObject({
        kind, attempts: 1, lastStatus: 'failed', lastError: `unknown job kind '${kind}'`, currentRunId: null,
      });
      expect(await listRuns(env.DB, 'job')).toMatchObject([{ status: 'failed', error: `unknown job kind '${kind}'` }]);
    });

    it('skips a message whose group went back to the legacy cron after dispatch', async () => {
      const run = vi.fn(async () => ok(Date.now() + DAY));
      useHandler(run);
      const message = await dispatch('job');
      await setOwner(env.DB, 'odds', 'legacy');

      const { msg, outcome } = await deliver(message);

      expect(outcome).toBe('duplicate');
      expect(msg.ack).toHaveBeenCalledOnce();
      expect(run).not.toHaveBeenCalled();
      expect(await jobRow('job')).toMatchObject({ dispatchToken: null, currentRunId: null });
      expect(await listRuns(env.DB, 'job')).toEqual([]);
    });

    it.each([
      ['a newer message version', (message: IngestMessage) => ({ ...message, v: 2 })],
      ['a message without a token', ({ token: _token, ...message }: IngestMessage) => message],
      ['a non-object body', () => 'odds:lines'],
      ['an empty body', () => null],
    ])('acks and skips %s without claiming', async (_, mangle) => {
      const run = vi.fn(async () => ok(Date.now() + DAY));
      useHandler(run);
      const message = await dispatch('job');

      const { msg, outcome } = await deliver(mangle(message));

      expect(outcome).toBe('invalid');
      expect(msg.ack).toHaveBeenCalledOnce();
      expect(run).not.toHaveBeenCalled();
      expect(await jobRow('job')).toMatchObject({ dispatchToken: message.token, currentRunId: null });
      expect(await listRuns(env.DB, 'job')).toEqual([]);
    });

    it('skips a duplicate delivery of a message already claimed', async () => {
      const run = vi.fn(async () => ok(Date.now() + DAY));
      useHandler(run);
      const message = await dispatch('job');

      const first = await deliver(message);
      const second = await deliver(message);

      expect(first.outcome).toBe('ok');
      expect(second.outcome).toBe('duplicate');
      expect(second.msg.ack).toHaveBeenCalledOnce();
      expect(run).toHaveBeenCalledOnce();
      expect(await listRuns(env.DB, 'job')).toHaveLength(1);
    });

    it('settles every message of a batch', async () => {
      useHandler(async () => ok(Date.now() + DAY));
      const first = fakeMessage(await dispatch('job-a'));
      const second = fakeMessage(await dispatch('job-b'));

      expect(await consumeBatch(batchOf('ingest', first, fakeMessage({ v: 9 }), second), ingestEnv())).toEqual(['ok', 'invalid', 'ok']);
      expect(first.ack).toHaveBeenCalledOnce();
      expect(second.ack).toHaveBeenCalledOnce();
    });

    it('dead-letters the message when the ledger write itself fails, and the DLQ consumer kills the run', async () => {
      useHandler(async () => ({ status: null as unknown as 'ok', nextRunAt: Date.now() + DAY }));
      const message = await dispatch('job');

      const { msg, outcome } = await deliver(message);

      expect(outcome).toBe('dead_lettered');
      expect(msg.retry).toHaveBeenCalledOnce();
      expect(msg.ack).not.toHaveBeenCalled();
      expect(await listRuns(env.DB, 'job')).toMatchObject([{ status: 'running' }]);

      const dead = fakeMessage(message);
      await consumeDeadLetters(batchOf('ingest-dlq', dead), ingestEnv());

      expect(dead.ack).toHaveBeenCalledOnce();
      expect(await listRuns(env.DB, 'job')).toMatchObject([{ status: 'killed' }]);
      expect(await jobRow('job')).toMatchObject({ attempts: 1, currentRunId: null, lastStatus: 'failed' });
    });

    it("acks a message whose claim failed, so a duplicate copy's dead letter can't kill the live run", async () => {
      const run = vi.fn(async () => ok(Date.now() + DAY));
      useHandler(run);
      const message = await dispatch('job');
      const liveRunId = crypto.randomUUID();
      await claimRun(env.DB, { key: 'job', token: message.token, runId: liveRunId });
      const duplicate = fakeMessage(message);

      const [outcome] = await consumeBatch(batchOf('ingest', duplicate), ingestEnv({ DB: unavailableDb() }));

      expect(outcome).toBe('claim_failed');
      expect(duplicate.ack).toHaveBeenCalledOnce();
      expect(duplicate.retry).not.toHaveBeenCalled();
      expect(run).not.toHaveBeenCalled();
      expect(await jobRow('job')).toMatchObject({ currentRunId: liveRunId });
      expect(await listRuns(env.DB, 'job')).toMatchObject([{ id: liveRunId, status: 'running' }]);
    });

    it('leaves a claim that failed to the dispatch lease, which the dispatcher releases once it lapses', async () => {
      const message = await dispatch('job');
      const msg = fakeMessage(message);

      const [outcome] = await consumeBatch(batchOf('ingest', msg), ingestEnv({ DB: unavailableDb() }));

      expect(outcome).toBe('claim_failed');
      expect(msg.ack).toHaveBeenCalledOnce();
      const job = await jobRow('job');
      expect(job).toMatchObject({ dispatchToken: message.token, currentRunId: null });
      expect((await dispatchTick(env.DB, { maxQueued: 8, now: job!.queuedUntil! + 1 })).released).toBe(1);
    });
  });

  describe('oncePaid', () => {
    it('makes the paid call once across two invocations', async () => {
      const call = vi.fn(async () => 'receipt-1');
      const results: unknown[] = [];
      useHandler(async (ctx) => {
        results.push(await ctx.oncePaid('test:paid-call', call));
        return ok(0);
      });

      expect((await deliver(await dispatch('job'))).outcome).toBe('ok');
      expect((await deliver(await dispatch('job'))).outcome).toBe('ok');

      expect(call).toHaveBeenCalledOnce();
      expect(results).toEqual(['receipt-1', 'already_done']);
      expect(await paidCall('test:paid-call')).toEqual({ status: 'ok' });
      expect(await listRuns(env.DB, 'job')).toHaveLength(2);
    });

    it('never repeats a paid call that failed', async () => {
      const call = vi.fn(async (): Promise<string> => {
        throw new Error('provider timeout');
      });
      const results: unknown[] = [];
      useHandler(async (ctx) => {
        results.push(await ctx.oncePaid('test:failing-call', call).catch((error: Error) => error.message));
        results.push(await ctx.oncePaid('test:failing-call', call));
        return ok(Date.now() + DAY);
      });

      await deliver(await dispatch('job'));

      expect(call).toHaveBeenCalledOnce();
      expect(results).toEqual(['provider timeout', 'already_done']);
      expect(await paidCall('test:failing-call')).toEqual({ status: 'failed' });
    });

    it("counts recording the outcome against the run's D1 calls", async () => {
      const calls: number[] = [];
      useHandler(async (ctx) => {
        await ctx.oncePaid('test:counted-call', async () => 'receipt');
        calls.push(ctx.meter.d1Calls);
        return ok(Date.now() + DAY);
      });

      await deliver(await dispatch('job'));

      expect(calls).toEqual([2]);
      expect(await listRuns(env.DB, 'job')).toMatchObject([{ d1Calls: 2 }]);
    });
  });

  describe('consumeDeadLetters', () => {
    it('acks a dead letter whose job has moved on, and one that is not a v1 message', async () => {
      const ignored = fakeMessage({ v: 1, key: 'missing', token: 'tok', kind: FAKE_KIND });
      const invalid = fakeMessage({ v: 2 });

      await consumeDeadLetters(batchOf('ingest-dlq', ignored, invalid), ingestEnv());

      expect(ignored.ack).toHaveBeenCalledOnce();
      expect(invalid.ack).toHaveBeenCalledOnce();
      expect(await listRuns(env.DB, null)).toEqual([]);
    });

    it('retries a dead letter it could not settle', async () => {
      const message = await dispatch('job');
      const dead = fakeMessage(message);

      await consumeDeadLetters(batchOf('ingest-dlq', dead), ingestEnv({ DB: unavailableDb() }));

      expect(dead.retry).toHaveBeenCalledOnce();
      expect(dead.ack).not.toHaveBeenCalled();
    });
  });

  describe('worker entry', () => {
    it.each(['ingest', 'ingest-interactive'])('runs jobs delivered on %s', async (queue) => {
      useHandler(async () => ok(Date.now() + DAY));
      const msg = fakeMessage(await dispatch('job'));

      await worker.queue(batchOf(queue, msg), ingestEnv());

      expect(msg.ack).toHaveBeenCalledOnce();
      expect(await listRuns(env.DB, 'job')).toMatchObject([{ status: 'ok' }]);
    });

    it('settles messages on ingest-dlq as killed invocations', async () => {
      const message = await dispatch('job');
      const runId = crypto.randomUUID();
      await claimRun(env.DB, { key: 'job', token: message.token, runId });
      const msg = fakeMessage(message);

      await worker.queue(batchOf('ingest-dlq', msg), ingestEnv());

      expect(msg.ack).toHaveBeenCalledOnce();
      expect(await listRuns(env.DB, 'job')).toMatchObject([{ id: runId, status: 'killed' }]);
    });

    it('logs each missing binding once per isolate', async () => {
      vi.resetModules();
      const { default: freshWorker } = await import('./worker');
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      const controller = { scheduledTime: Date.now(), cron: '*/5 * * * *', noRetry: vi.fn() };
      const incomplete = { DB: env.DB, ENVIRONMENT: 'test' } as IngestEnv;

      await freshWorker.scheduled(controller, incomplete);
      await freshWorker.scheduled(controller, incomplete);

      const critical = errors.mock.calls.map(([line]) => String(line)).filter((line) => line.includes('CRITICAL'));
      expect(critical).toEqual([
        '[ingest] CRITICAL: INGEST_QUEUE not set',
        '[ingest] CRITICAL: INGEST_INTERACTIVE_QUEUE not set',
        '[ingest] CRITICAL: ODDS_API_KEY not set',
      ]);
    });
  });
});
