import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { MAX_QUEUED, SEND_BATCH_LIMIT, runDispatcher, sendLeased } from './dispatcher';
import { dbNow, dispatchTick, listJobs, readHeartbeat, setOwner, upsertJobsNow } from './ledger';
import type { IngestEnv, IngestMessage } from './types';

type SentBatch = Array<MessageSendRequest<IngestMessage>>;

/** A queue that records every sendBatch call and rejects the calls whose 1-based index is in `failCalls`. */
function fakeQueue(failCalls: number[] = []) {
  const calls: SentBatch[] = [];
  const queue = {
    send: vi.fn(),
    sendBatch: vi.fn(async (messages: Iterable<MessageSendRequest<IngestMessage>>) => {
      calls.push([...messages]);
      if (failCalls.includes(calls.length)) throw new Error('queue unavailable');
    }),
  };
  return { queue: queue as unknown as Queue<IngestMessage>, calls };
}

function ingestEnv(queue: Queue<IngestMessage>, db: D1Database = env.DB): IngestEnv {
  return { DB: db, INGEST_QUEUE: queue, INGEST_INTERACTIVE_QUEUE: fakeQueue().queue, ENVIRONMENT: 'test' };
}

async function addDueJobs(count: number, prefix = 'job'): Promise<void> {
  await upsertJobsNow(env.DB, Array.from({ length: count }, (_, i) => ({
    key: `${prefix}-${String(i).padStart(3, '0')}`, kind: 'test-kind', group: 'odds', nextRunAt: 0,
  })));
}

async function tokensByKey(): Promise<Map<string, string | null>> {
  return new Map((await listJobs(env.DB)).map((job) => [job.key, job.dispatchToken]));
}

describe('ingest dispatcher (workers pool)', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM ingest_jobs'),
      env.DB.prepare('DELETE FROM ingest_runs'),
      env.DB.prepare('DELETE FROM ingest_heartbeat'),
      env.DB.prepare("UPDATE ingest_owner SET owner = 'legacy'"),
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('leases and sends nothing while every group is owned by legacy', async () => {
    await addDueJobs(3);
    const { queue, calls } = fakeQueue();

    const summary = await runDispatcher(ingestEnv(queue));

    expect(summary).toEqual({ leased: 0, reaped: 0, released: 0, sendFailures: 0 });
    expect(calls).toEqual([]);
    expect([...(await tokensByKey()).values()]).toEqual([null, null, null]);
  });

  it('sends one v1 message per leased job, carrying its lease token', async () => {
    await setOwner(env.DB, 'odds', 'ingest');
    await addDueJobs(2);
    const { queue, calls } = fakeQueue();

    const summary = await runDispatcher(ingestEnv(queue));

    expect(summary).toEqual({ leased: 2, reaped: 0, released: 0, sendFailures: 0 });
    expect(calls).toHaveLength(1);
    const tokens = await tokensByKey();
    expect([...calls[0]].sort((a, b) => a.body.key.localeCompare(b.body.key))).toEqual([
      { body: { v: 1, key: 'job-000', token: tokens.get('job-000'), kind: 'test-kind' } },
      { body: { v: 1, key: 'job-001', token: tokens.get('job-001'), kind: 'test-kind' } },
    ]);
    expect(tokens.get('job-000')).toMatch(/^[0-9a-f]{32}$/);
  });

  it(`leases at most ${MAX_QUEUED} light jobs per tick`, async () => {
    await setOwner(env.DB, 'odds', 'ingest');
    await addDueJobs(MAX_QUEUED + 3);
    const { queue, calls } = fakeQueue();

    expect((await runDispatcher(ingestEnv(queue))).leased).toBe(MAX_QUEUED);
    expect(calls.flat()).toHaveLength(MAX_QUEUED);
    // The queued messages count against the next tick's capacity until they are claimed.
    expect((await runDispatcher(ingestEnv(queue))).leased).toBe(0);
  });

  it('passes a clock override through to the lease query', async () => {
    await setOwner(env.DB, 'odds', 'ingest');
    const now = await dbNow(env.DB);
    await upsertJobsNow(env.DB, [{ key: 'later', kind: 'test-kind', group: 'odds', nextRunAt: now + 60 * 60_000 }]);
    const { queue } = fakeQueue();

    expect((await runDispatcher(ingestEnv(queue))).leased).toBe(0);
    expect((await runDispatcher(ingestEnv(queue), now + 2 * 60 * 60_000)).leased).toBe(1);
  });

  it(`sends in batches of at most ${SEND_BATCH_LIMIT}`, async () => {
    await setOwner(env.DB, 'odds', 'ingest');
    await addDueJobs(250);
    const { leased } = await dispatchTick(env.DB, { maxQueued: 300 });
    const { queue, calls } = fakeQueue();

    expect(await sendLeased(ingestEnv(queue), leased)).toBe(0);

    expect(calls.map((batch) => batch.length)).toEqual([100, 100, 50]);
    expect(calls.flat().map(({ body }) => body.key).sort()).toEqual(leased.map(({ key }) => key).sort());
  });

  it('releases the leases of a batch that failed to send and keeps the rest', async () => {
    await setOwner(env.DB, 'odds', 'ingest');
    await addDueJobs(250);
    const { leased } = await dispatchTick(env.DB, { maxQueued: 300 });
    const { queue, calls } = fakeQueue([2]);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await sendLeased(ingestEnv(queue), leased)).toBe(100);

    const tokens = await tokensByKey();
    const failedKeys = new Set(calls[1].map(({ body }) => body.key));
    for (const { key, token } of leased) {
      expect(tokens.get(key)).toBe(failedKeys.has(key) ? null : token);
    }
    // Released jobs are still due, so the next tick leases them again.
    expect((await dispatchTick(env.DB, { maxQueued: 300 })).leased.map(({ key }) => key).sort()).toEqual([...failedKeys].sort());
  });

  it('records send failures in the summary and the heartbeat', async () => {
    await setOwner(env.DB, 'odds', 'ingest');
    await addDueJobs(2);
    const { queue } = fakeQueue([1]);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const summary = await runDispatcher(ingestEnv(queue));

    expect(summary).toEqual({ leased: 2, reaped: 0, released: 0, sendFailures: 2 });
    expect([...(await tokensByKey()).values()]).toEqual([null, null]);
    expect((await readHeartbeat(env.DB, 'dispatcher'))?.detail).toEqual(summary);
  });

  it('writes the dispatcher heartbeat on every tick', async () => {
    const { queue } = fakeQueue();
    const before = await dbNow(env.DB);

    await runDispatcher(ingestEnv(queue));

    const beat = await readHeartbeat(env.DB, 'dispatcher');
    expect(beat?.detail).toEqual({ leased: 0, reaped: 0, released: 0, sendFailures: 0 });
    expect(beat?.at).toBeGreaterThanOrEqual(before);
  });

  it('never throws, and writes no heartbeat, when D1 fails', async () => {
    const brokenDb = {
      prepare: (query: string) => env.DB.prepare(query),
      batch: () => Promise.reject(new Error('D1 unavailable')),
    } as unknown as D1Database;
    const { queue, calls } = fakeQueue();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(runDispatcher(ingestEnv(queue, brokenDb))).resolves.toEqual({ leased: 0, reaped: 0, released: 0, sendFailures: 0 });

    expect(calls).toEqual([]);
    expect(await readHeartbeat(env.DB, 'dispatcher')).toBeNull();
  });
});
