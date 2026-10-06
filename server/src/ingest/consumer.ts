import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { getHandler } from './handlers';
import { SQL_NOW, claimRun, completeRun, failRun, handleDeadLetter } from './ledger';
import { RunMeter } from './meter';
import { TerminalJobError } from './types';
import type { BufferedWrites, IngestEnv, IngestMessage, JobContext, JobHandler, JobResult } from './types';

/** How a message was settled. A completed run reports its own status. */
export type MessageOutcome =
  | JobResult['status']
  | 'failed'
  | 'retired'
  | 'superseded'
  | 'duplicate'
  | 'claim_failed'
  | 'invalid'
  | 'unknown_kind'
  | 'dead_lettered';

function isIngestMessage(body: unknown): body is IngestMessage {
  if (typeof body !== 'object' || body === null) return false;
  const { v, key, token, kind } = body as Record<string, unknown>;
  return v === 1 && typeof key === 'string' && typeof token === 'string' && typeof kind === 'string';
}

// ── Job context ──────────────────────────────────────────────────────────────

async function recordPaidCall(raw: D1Database, meter: RunMeter, idemKey: string, status: 'ok' | 'failed'): Promise<void> {
  meter.countRawCall();
  try {
    await raw.prepare('UPDATE paid_calls SET status = ?2 WHERE idem_key = ?1').bind(idemKey, status).run();
  } catch (error) {
    console.error(`[ingest] could not record paid call ${idemKey} as ${status}:`, error);
  }
}

/**
 * Reserves the idempotency key before paying, so the call happens at most
 * once even if this run fails or is killed afterwards. The reservation goes
 * through the meter (a spent budget refuses it before any money is spent);
 * the outcome is recorded on the raw binding so a spent budget can't lose a
 * result already paid for, but still counted, so the calls left for
 * bookkeeping stay reserved. The 'pending' row keeps blocking repeats if
 * that record fails.
 */
async function payOnce<T>(raw: D1Database, meter: RunMeter, idemKey: string, call: () => Promise<T>): Promise<T | 'already_done'> {
  const reserved = await meter.db.prepare(`INSERT OR IGNORE INTO paid_calls (idem_key, status, created_at)
    VALUES (?1, 'pending', ${SQL_NOW})`).bind(idemKey).run();
  if (reserved.meta.changes === 0) return 'already_done';

  let status: 'ok' | 'failed' = 'failed';
  try {
    const value = await call();
    status = 'ok';
    return value;
  } finally {
    await recordPaidCall(raw, meter, idemKey, status);
  }
}

export interface RunContext {
  ctx: JobContext;
  /** What the run asked for through ctx.markDue/upsertJobs/deleteJobs, for completeRun. */
  buffered: BufferedWrites;
  /** Stops the soft-deadline timer. */
  dispose(): void;
}

interface ContextOptions {
  softDeadlineMs: number;
  /** The claimed job's consecutive failures. */
  attempts?: number;
  now?: number;
}

export function createJobContext(env: IngestEnv, { softDeadlineMs, attempts = 0, now = Date.now() }: ContextOptions): RunContext {
  const meter = new RunMeter(env.DB);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`soft deadline of ${softDeadlineMs} ms passed`)), softDeadlineMs);
  const buffered: BufferedWrites = [];

  const ctx: JobContext = {
    db: drizzle(meter.db, { schema }),
    env,
    now,
    attempts,
    signal: controller.signal,
    deadline: now + softDeadlineMs,
    meter,
    oncePaid: <T>(idemKey: string, call: () => Promise<T>) => payOnce(env.DB, meter, idemKey, call),
    markDue: (keys, debounceMs) => {
      buffered.push({ op: 'markDue', keys: [...keys], debounceMs });
    },
    upsertJobs: (specs) => {
      buffered.push({ op: 'upsertJobs', specs: [...specs] });
    },
    deleteJobs: (keys) => {
      buffered.push({ op: 'deleteJobs', keys: [...keys] });
    },
    reportCredits: (n) => meter.addCredits(n),
  };
  return { ctx, buffered, dispose: () => clearTimeout(timer) };
}

// ── Consumers ────────────────────────────────────────────────────────────────

interface ClaimedJob {
  key: string;
  runId: string;
  params: unknown;
  attempts: number;
}

async function runJob(env: IngestEnv, handler: JobHandler, { key, runId, params, attempts }: ClaimedJob): Promise<MessageOutcome> {
  const { ctx, buffered, dispose } = createJobContext(env, { softDeadlineMs: handler.softDeadlineMs, attempts });
  let result: JobResult;
  try {
    result = await handler.run(ctx, params);
  } catch (error) {
    const terminal = error instanceof TerminalJobError;
    console.error(`[ingest] ${key} ${terminal ? 'retired' : 'failed'}:`, error);
    const { superseded } = await failRun(env.DB, { key, runId, error, meter: ctx.meter, terminal, buffered });
    if (superseded) return 'superseded';
    return terminal ? 'retired' : 'failed';
  } finally {
    dispose();
  }

  const { superseded } = await completeRun(env.DB, { key, runId, result, meter: ctx.meter, buffered });
  console.log(`[ingest] ${key} ${superseded ? 'superseded' : result.status} (${ctx.meter.d1Calls} D1 calls, ${ctx.meter.upstreamCalls} upstream)`);
  return superseded ? 'superseded' : result.status;
}

/** Claims and runs one message's job. Throws only when a claimed run's outcome can't be recorded. */
async function consumeMessage(body: unknown, env: IngestEnv): Promise<MessageOutcome> {
  if (!isIngestMessage(body)) {
    console.warn('[ingest] skipping a message that is not an ingest v1 message:', body);
    return 'invalid';
  }

  const { key, token } = body;
  const runId = crypto.randomUUID();
  // A failed claim is acked, not dead-lettered: the DLQ consumer finds runs
  // by token, so if this is a duplicate delivery its dead letter would kill
  // the copy that did claim, mid-run. The leases recover the job either way:
  // an unwritten claim's dispatch lease lapses, a written one's run is reaped.
  const claimed = await claimRun(env.DB, { key, token, runId }).catch((error: unknown) => {
    console.error(`[ingest] ${key}: claim failed; leaving the job to its leases:`, error);
    return 'claim_failed' as const;
  });
  if (claimed === 'claim_failed') return claimed;
  if (!claimed) return 'duplicate';

  // The claimed row's kind is authoritative; the message's is a copy taken at
  // dispatch. A kind this Worker doesn't know usually means it is older than
  // the database (migrations apply even when the ingest deploy fails), so the
  // job backs off like a failure and is never deleted.
  const handler = getHandler(claimed.kind);
  if (!handler) {
    const error = `unknown job kind '${claimed.kind}'`;
    console.error(`[ingest] CRITICAL: ${key}: ${error}; backing off until a Worker that knows the kind runs it`);
    const { superseded } = await failRun(env.DB, { key, runId, error });
    return superseded ? 'superseded' : 'unknown_kind';
  }
  return runJob(env, handler, { key, runId, params: claimed.params, attempts: claimed.attempts });
}

/**
 * Consumes `ingest` and `ingest-interactive`. Job failures are recorded in
 * the ledger and the message is acked. Only a failure to record a claimed
 * run's outcome leaves a message un-acked: with max_retries = 0 the retry
 * dead-letters it, and the DLQ consumer settles its run as killed.
 */
export async function consumeBatch(batch: MessageBatch<unknown>, env: IngestEnv): Promise<MessageOutcome[]> {
  const outcomes: MessageOutcome[] = [];
  for (const msg of batch.messages) {
    try {
      outcomes.push(await consumeMessage(msg.body, env));
      msg.ack();
    } catch (error) {
      console.error('[ingest] ledger write failed; dead-lettering the message:', error);
      msg.retry();
      outcomes.push('dead_lettered');
    }
  }
  return outcomes;
}

/** Consumes `ingest-dlq`: each message there is an invocation that was killed. */
export async function consumeDeadLetters(batch: MessageBatch<unknown>, env: IngestEnv): Promise<void> {
  for (const msg of batch.messages) {
    if (!isIngestMessage(msg.body)) {
      console.warn('[ingest] skipping a dead letter that is not an ingest v1 message:', msg.body);
      msg.ack();
      continue;
    }
    try {
      const outcome = await handleDeadLetter(env.DB, msg.body);
      console.warn(`[ingest] dead letter for ${msg.body.key}: ${outcome}`);
      msg.ack();
    } catch (error) {
      console.error(`[ingest] dead letter for ${msg.body.key} not settled; retrying:`, error);
      msg.retry();
    }
  }
}
