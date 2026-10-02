import type { RunCounters } from './meter';
import type { BufferedWrite, BufferedWrites, IngestMessage, IngestOwner, JobResult, JobSpec, ResourceClass } from './types';

// Every function here takes the RAW D1 binding: bookkeeping must never be
// counted or refused by a run's meter.

/** D1's clock in ms. Leases, due times and backoff compare against it, never the Worker's Date.now(). */
export const SQL_NOW = "CAST(unixepoch('subsec') * 1000 AS INTEGER)";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DISPATCH_LEASE_MS = 30 * MINUTE;
/** Longer than the 15 min platform wall, so a live run is never reaped. */
const RUN_LEASE_MS = 16 * MINUTE;
const BASE_BACKOFF_MS = 2 * MINUTE;
const MAX_BACKOFF_MS = 6 * HOUR;
const BACKOFF_JITTER_MS = 30_000;
const QUARANTINE_AFTER_FAILURES = 5;
const QUARANTINE_MS = 6 * HOUR;
const MAX_BOUND_PARAMS = 99;
const ERROR_MAX_CHARS = 1000;

export const REAPED_ERROR = 'run lease expired (killed or timed out)';
export const DEAD_LETTER_ERROR = 'invocation killed (dead-lettered)';
export const DEAD_LETTER_BEFORE_CLAIM_ERROR = 'dead-lettered before claim';

/** A run's hold on its job row: valid while the row's current_run_id is still runId. */
interface Fence {
  key: string;
  runId: string;
}

const NO_WRITES: BufferedWrites = [];

// claimRun clears the dirty mark, so a mark present when the run finishes was
// set during the run: a dependency changed after the run read it, and the
// run's own completion must not erase it.
const DIRTY = '(dirty_at IS NOT NULL AND dirty_due_at IS NOT NULL)';

/** For a statement on ingest_jobs: the row's group is owned by the ingest Worker. */
const GROUP_OWNED = "EXISTS (SELECT 1 FROM ingest_owner o WHERE o.group_name = ingest_jobs.group_name AND o.owner = 'ingest')";

/**
 * SET clause for a failed or killed run. SQLite evaluates every expression
 * against the pre-update row, so `attempts` here is the count before this
 * failure. The shift is capped so it can't overflow; 2 min << 8 is already
 * past the 6 h ceiling.
 */
function failureSet(now: string, errorParam: string): string {
  return `attempts = attempts + 1,
    next_run_at = ${now} + MIN(${MAX_BACKOFF_MS}, ${BASE_BACKOFF_MS} * (1 << MIN(attempts, 8))) + abs(random() % ${BACKOFF_JITTER_MS}),
    disabled_until = CASE WHEN attempts + 1 >= ${QUARANTINE_AFTER_FAILURES} THEN ${now} + ${QUARANTINE_MS} ELSE NULL END,
    last_status = 'failed', last_error = ${errorParam}, last_finished_at = ${now},
    dispatch_token = NULL, queued_until = NULL, current_run_id = NULL, run_expires_at = NULL,
    updated_at = ${now}`;
}

function placeholders(first: number, count: number): string {
  return Array.from({ length: count }, (_, i) => `?${first + i}`).join(', ');
}

/** True while the run still holds its job; the fence's key and runId are params ?first and ?first+1. */
function fenceHeld(first: number): string {
  return `EXISTS (SELECT 1 FROM ingest_jobs f WHERE f.key = ?${first} AND f.current_run_id = ?${first + 1})`;
}

function fenced(fence: Fence | null, first: number): string {
  return fence ? ` AND ${fenceHeld(first)}` : '';
}

function fenceParams(fence: Fence | null): string[] {
  return fence ? [fence.key, fence.runId] : [];
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function sumChanges(results: D1Result[]): number {
  return results.reduce((sum, result) => sum + result.meta.changes, 0);
}

function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, ERROR_MAX_CHARS);
}

/** The D1 clock, in ms since epoch. */
export async function dbNow(db: D1Database): Promise<number> {
  return Number(await db.prepare(`SELECT ${SQL_NOW} AS now`).first('now'));
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

/** Dispatch statements bind ?1 to an optional clock override. */
const TICK_NOW = `COALESCE(?1, ${SQL_NOW})`;

export interface DispatchOptions {
  /** No light job is leased while this many jobs (of either class) sit leased but unclaimed. */
  maxQueued: number;
  /** Heavy jobs queued or running at once. */
  heavySlots?: number;
  /** Overrides D1's clock for the whole tick. */
  now?: number;
}

export interface LeasedJob {
  key: string;
  kind: string;
  token: string;
  priority: number;
}

export interface DispatchResult {
  leased: LeasedJob[];
  reaped: number;
  released: number;
}

/**
 * Leases due jobs of one resource class in groups owned by 'ingest', up to
 * `max - (inFlightSql)`. The capacity is computed inside the same UPDATE, so
 * checking it and leasing are atomic.
 */
function leaseStatement(
  db: D1Database,
  at: number | null,
  resourceClass: ResourceClass,
  max: number,
  inFlightSql: string,
): D1PreparedStatement {
  return db.prepare(`UPDATE ingest_jobs
    SET dispatch_token = lower(hex(randomblob(16))), queued_until = ${TICK_NOW} + ${DISPATCH_LEASE_MS}, updated_at = ${TICK_NOW}
    WHERE key IN (
      SELECT j.key FROM ingest_jobs j
      JOIN ingest_owner o ON o.group_name = j.group_name AND o.owner = 'ingest'
      WHERE j.resource_class = ?3 AND j.next_run_at <= ${TICK_NOW}
        AND j.dispatch_token IS NULL AND j.current_run_id IS NULL
        AND (j.disabled_until IS NULL OR j.disabled_until <= ${TICK_NOW})
      ORDER BY j.priority, j.next_run_at
      LIMIT MAX(0, ?2 - (${inFlightSql})))
    RETURNING key, kind, dispatch_token AS token, priority`).bind(at, max, resourceClass);
}

/**
 * One dispatcher pass, as a single D1 batch: reap expired runs, release
 * stale dispatch leases, then lease due light jobs up to the backpressure
 * limit and heavy jobs up to `heavySlots` in flight.
 */
export async function dispatchTick(db: D1Database, { maxQueued, heavySlots = 1, now }: DispatchOptions): Promise<DispatchResult> {
  const at = now ?? null;
  const expired = `current_run_id IS NOT NULL AND run_expires_at < ${TICK_NOW}`;
  const queued = 'SELECT COUNT(*) FROM ingest_jobs WHERE dispatch_token IS NOT NULL AND current_run_id IS NULL';
  const heavyInFlight = "SELECT COUNT(*) FROM ingest_jobs WHERE resource_class = 'heavy' AND (dispatch_token IS NOT NULL OR current_run_id IS NOT NULL)";

  const [, reaped, released, light, heavy] = await db.batch<LeasedJob>([
    db.prepare(`UPDATE ingest_runs SET status = 'killed', finished_at = ${TICK_NOW}, error = ?2
      WHERE status = 'running' AND id IN (SELECT current_run_id FROM ingest_jobs WHERE ${expired})`).bind(at, REAPED_ERROR),
    db.prepare(`UPDATE ingest_jobs SET ${failureSet(TICK_NOW, '?2')} WHERE ${expired}`).bind(at, REAPED_ERROR),
    db.prepare(`UPDATE ingest_jobs SET dispatch_token = NULL, queued_until = NULL, updated_at = ${TICK_NOW}
      WHERE dispatch_token IS NOT NULL AND current_run_id IS NULL AND queued_until < ${TICK_NOW}`).bind(at),
    leaseStatement(db, at, 'light', maxQueued, queued),
    leaseStatement(db, at, 'heavy', heavySlots, heavyInFlight),
  ]);

  return {
    leased: [...light.results, ...heavy.results].sort((a, b) => a.priority - b.priority),
    reaped: reaped.meta.changes,
    released: released.meta.changes,
  };
}

/** Clears the dispatch leases of messages that failed to send, so the next tick can lease them again. */
export async function releaseDispatch(db: D1Database, leased: Array<{ key: string; token: string }>): Promise<number> {
  if (leased.length === 0) return 0;
  const statements = chunk(leased, Math.floor(MAX_BOUND_PARAMS / 2)).map((part) => {
    const pairs = part.map((_, i) => `(?${2 * i + 1}, ?${2 * i + 2})`).join(', ');
    return db.prepare(`UPDATE ingest_jobs SET dispatch_token = NULL, queued_until = NULL, updated_at = ${SQL_NOW}
      WHERE (key, dispatch_token) IN (VALUES ${pairs})`).bind(...part.flatMap(({ key, token }) => [key, token]));
  });
  return sumChanges(await db.batch(statements));
}

// ── Runs ─────────────────────────────────────────────────────────────────────

export interface ClaimedRun {
  kind: string;
  params: unknown;
  attempts: number;
  startedAt: number;
}

/**
 * Compare-and-set claim of a dispatched job. Returns null when the message
 * is a duplicate or stale: its token no longer holds the dispatch lease, or
 * its group went back to the legacy cron after dispatch (that lease is
 * released at once, so the job doesn't hold a queue slot).
 *
 * The claim clears any dirty mark, since the run starting now reads whatever
 * changed before it.
 */
export async function claimRun(db: D1Database, { key, token, runId }: { key: string; token: string; runId: string }): Promise<ClaimedRun | null> {
  const leased = 'key = ?1 AND dispatch_token = ?2 AND current_run_id IS NULL';
  const [claim] = await db.batch<{ kind: string; params: string; attempts: number; started_at: number }>([
    db.prepare(`UPDATE ingest_jobs
      SET current_run_id = ?3, run_expires_at = ${SQL_NOW} + ${RUN_LEASE_MS}, dispatch_token = NULL, queued_until = NULL,
          dirty_at = NULL, dirty_due_at = NULL, last_started_at = ${SQL_NOW}, updated_at = ${SQL_NOW}
      WHERE ${leased} AND ${GROUP_OWNED}
      RETURNING kind, params, attempts, last_started_at AS started_at`).bind(key, token, runId),
    db.prepare(`INSERT INTO ingest_runs (id, job_key, kind, dispatch_token, started_at, status)
      SELECT current_run_id, key, kind, ?3, last_started_at, 'running' FROM ingest_jobs WHERE key = ?1 AND current_run_id = ?2`)
      .bind(key, runId, token),
    db.prepare(`UPDATE ingest_jobs SET dispatch_token = NULL, queued_until = NULL, updated_at = ${SQL_NOW}
      WHERE ${leased} AND NOT ${GROUP_OWNED}`).bind(key, token),
  ]);
  const row = claim.results[0];
  if (!row) return null;
  return { kind: row.kind, params: JSON.parse(row.params), attempts: row.attempts, startedAt: row.started_at };
}

/** Records how a run ended; `superseded` instead of `status` when the run no longer holds its job. */
function finishRunStatement(
  db: D1Database,
  fence: Fence,
  status: string,
  counters: RunCounters | undefined,
  detail: string | null,
  error: string | null,
): D1PreparedStatement {
  return db.prepare(`UPDATE ingest_runs SET finished_at = ${SQL_NOW},
      status = CASE WHEN ${fenceHeld(1)} THEN ?3 ELSE 'superseded' END,
      d1_calls = ?4, rows_read = ?5, rows_written = ?6, upstream_calls = ?7, credits_used = ?8, detail = ?9, error = ?10
    WHERE id = ?2`).bind(
    fence.key, fence.runId, status,
    counters?.d1Calls ?? null, counters?.rowsRead ?? null, counters?.rowsWritten ?? null,
    counters?.upstreamCalls ?? null, counters?.creditsUsed ?? null,
    detail, error,
  );
}

function markDueStatements(db: D1Database, keys: string[], debounceMs: number, fence: Fence | null): D1PreparedStatement[] {
  const due = `${SQL_NOW} + ?1`;
  return chunk(keys, MAX_BOUND_PARAMS - 3).map((part) => db.prepare(`UPDATE ingest_jobs
    SET next_run_at = MIN(next_run_at, ${due}), dirty_at = ${SQL_NOW},
        dirty_due_at = MIN(COALESCE(dirty_due_at, ${due}), ${due}), updated_at = ${SQL_NOW}
    WHERE key IN (${placeholders(2, part.length)})${fenced(fence, part.length + 2)}`)
    .bind(debounceMs, ...part, ...fenceParams(fence)));
}

/** Creates the job, or updates its definition; never its schedule, leases or attempts. */
function upsertJobStatement(db: D1Database, spec: JobSpec, fence: Fence | null): D1PreparedStatement {
  return db.prepare(`INSERT INTO ingest_jobs (key, kind, group_name, params, resource_class, priority, next_run_at, created_at, updated_at)
    SELECT ?1, ?2, ?3, ?4, ?5, ?6, COALESCE(?7, ${SQL_NOW}), ${SQL_NOW}, ${SQL_NOW}
    WHERE true${fenced(fence, 8)}
    ON CONFLICT(key) DO UPDATE SET kind = excluded.kind, group_name = excluded.group_name, params = excluded.params,
      resource_class = excluded.resource_class, priority = excluded.priority, updated_at = excluded.updated_at`)
    .bind(
      spec.key, spec.kind, spec.group, JSON.stringify(spec.params ?? {}),
      spec.resourceClass ?? 'light', spec.priority ?? 5, spec.nextRunAt ?? null,
      ...fenceParams(fence),
    );
}

function deleteJobStatements(db: D1Database, keys: string[], fence: Fence): D1PreparedStatement[] {
  return chunk(keys, MAX_BOUND_PARAMS - 2).map((part) => db.prepare(`DELETE FROM ingest_jobs
    WHERE key IN (${placeholders(1, part.length)}) AND current_run_id IS NULL${fenced(fence, part.length + 1)}`)
    .bind(...part, ...fenceParams(fence)));
}

function bufferedStatements(db: D1Database, write: BufferedWrite, fence: Fence): D1PreparedStatement[] {
  switch (write.op) {
    case 'markDue':
      return markDueStatements(db, write.keys, write.debounceMs, fence);
    case 'upsertJobs':
      return write.specs.map((spec) => upsertJobStatement(db, spec, fence));
    case 'deleteJobs':
      return deleteJobStatements(db, write.keys, fence);
  }
}

/**
 * Releases the run lease after a successful run and schedules the next one.
 * `next` null is only reached when the job was marked dirty during the run
 * (see completeRun), so it falls back to the dirty due time.
 */
function finishJobStatement(db: D1Database, fence: Fence, status: string, next: number | null): D1PreparedStatement {
  return db.prepare(`UPDATE ingest_jobs SET
      next_run_at = CASE WHEN ${DIRTY} THEN MIN(COALESCE(?3, dirty_due_at), dirty_due_at) ELSE ?3 END,
      dirty_at = CASE WHEN ${DIRTY} THEN dirty_at END,
      dirty_due_at = CASE WHEN ${DIRTY} THEN dirty_due_at END,
      attempts = 0, last_status = ?4, last_error = NULL,
      last_success_at = ${SQL_NOW}, last_finished_at = ${SQL_NOW},
      current_run_id = NULL, run_expires_at = NULL, updated_at = ${SQL_NOW}
    WHERE key = ?1 AND current_run_id = ?2`).bind(fence.key, fence.runId, next, status);
}

function runDetail(result: JobResult): string | null {
  const detail = result.changed === undefined ? result.detail : { ...result.detail, changed: result.changed };
  return detail ? JSON.stringify(detail) : null;
}

export interface CompleteRunInput {
  key: string;
  runId: string;
  result: JobResult;
  meter: RunCounters;
  buffered?: BufferedWrites;
}

/**
 * Records a finished run and applies its buffered writes, in the order the
 * run made them, in ONE batch. Every write is fenced on the run still
 * holding its job; the job row goes last because releasing it drops the
 * fence. A run that lost its lease (reaped, then re-dispatched) is recorded
 * as `superseded` and changes nothing else.
 */
export async function completeRun(
  db: D1Database,
  { key, runId, result, meter, buffered = NO_WRITES }: CompleteRunInput,
): Promise<{ superseded: boolean }> {
  const fence = { key, runId };
  const jobStatements = result.nextRunAt === null
    ? [
      db.prepare(`DELETE FROM ingest_jobs WHERE key = ?1 AND current_run_id = ?2 AND NOT ${DIRTY}`).bind(key, runId),
      finishJobStatement(db, fence, result.status, null),
    ]
    : [finishJobStatement(db, fence, result.status, result.nextRunAt)];

  const results = await db.batch([
    finishRunStatement(db, fence, result.status, meter, runDetail(result), null),
    ...buffered.flatMap((write) => bufferedStatements(db, write, fence)),
    ...jobStatements,
  ]);
  return { superseded: sumChanges(results.slice(-jobStatements.length)) === 0 };
}

export interface FailRunInput {
  key: string;
  runId: string;
  error: unknown;
  meter?: RunCounters;
  /** Upstream says the target is gone: retire the job (run `skipped`) instead of backing off. */
  terminal?: boolean;
  /**
   * Only the markDue writes apply. Data the run wrote before failing is
   * already committed, so its dependents still need to run; job definitions
   * change only on success.
   */
  buffered?: BufferedWrites;
}

/** Records a failed run: backoff and, at the 5th consecutive failure, quarantine. Fenced like completeRun. */
export async function failRun(
  db: D1Database,
  { key, runId, error, meter, terminal = false, buffered = NO_WRITES }: FailRunInput,
): Promise<{ superseded: boolean }> {
  const fence = { key, runId };
  const message = errorText(error);
  const job = terminal
    ? db.prepare('DELETE FROM ingest_jobs WHERE key = ?1 AND current_run_id = ?2').bind(key, runId)
    : db.prepare(`UPDATE ingest_jobs SET ${failureSet(SQL_NOW, '?3')} WHERE key = ?1 AND current_run_id = ?2`).bind(key, runId, message);

  const results = await db.batch([
    finishRunStatement(db, fence, terminal ? 'skipped' : 'failed', meter, null, message),
    ...buffered.filter(({ op }) => op === 'markDue').flatMap((write) => bufferedStatements(db, write, fence)),
    job,
  ]);
  return { superseded: results[results.length - 1].meta.changes === 0 };
}

async function killRun(db: D1Database, fence: Fence, error: string): Promise<void> {
  await db.batch([
    db.prepare(`UPDATE ingest_runs SET status = 'killed', finished_at = ${SQL_NOW}, error = ?3
      WHERE id = ?2 AND status = 'running'${fenced(fence, 1)}`).bind(fence.key, fence.runId, error),
    db.prepare(`UPDATE ingest_jobs SET ${failureSet(SQL_NOW, '?3')} WHERE key = ?1 AND current_run_id = ?2`).bind(fence.key, fence.runId, error),
  ]);
}

async function killUnclaimed(db: D1Database, msg: IngestMessage): Promise<void> {
  const unclaimed = 'key = ?1 AND dispatch_token = ?2 AND current_run_id IS NULL';
  await db.batch([
    db.prepare(`INSERT INTO ingest_runs (id, job_key, kind, dispatch_token, started_at, finished_at, status, error)
      SELECT ?3, key, kind, dispatch_token, ${SQL_NOW}, ${SQL_NOW}, 'killed', ?4 FROM ingest_jobs WHERE ${unclaimed}`)
      .bind(msg.key, msg.token, crypto.randomUUID(), DEAD_LETTER_BEFORE_CLAIM_ERROR),
    db.prepare(`UPDATE ingest_jobs SET ${failureSet(SQL_NOW, '?3')} WHERE ${unclaimed}`)
      .bind(msg.key, msg.token, DEAD_LETTER_BEFORE_CLAIM_ERROR),
  ]);
}

export type DeadLetterOutcome = 'killed' | 'killed_before_claim' | 'ignored';

/**
 * A dead-lettered message means its invocation was killed (consumers ack
 * everything else). Kills the running run claimed from this message, or
 * fails a dispatch that was never claimed; anything else, such as a run
 * claimed from a later message, is left alone.
 *
 * Known gap: if Queues delivers the same message twice and the copy that
 * lost the claim dies un-acked, its dead letter carries the claimed run's
 * token, so that live run is recorded killed and its completion superseded.
 */
export async function handleDeadLetter(db: D1Database, msg: IngestMessage): Promise<DeadLetterOutcome> {
  const job = await db.prepare(`SELECT j.current_run_id AS runId, j.dispatch_token AS token, r.status AS runStatus
    FROM ingest_jobs j LEFT JOIN ingest_runs r ON r.id = j.current_run_id AND r.dispatch_token = ?2
    WHERE j.key = ?1`).bind(msg.key, msg.token).first<{ runId: string | null; token: string | null; runStatus: string | null }>();
  if (!job) return 'ignored';
  if (job.runId !== null && job.runStatus === 'running') {
    await killRun(db, { key: msg.key, runId: job.runId }, DEAD_LETTER_ERROR);
    return 'killed';
  }
  if (job.runId === null && job.token === msg.token) {
    await killUnclaimed(db, msg);
    return 'killed_before_claim';
  }
  return 'ignored';
}

// ── Admin and dispatcher helpers ─────────────────────────────────────────────

/** Makes jobs due now, honoured even by a run already in progress. Returns how many exist. */
export async function markDueNow(db: D1Database, keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  return sumChanges(await db.batch(markDueStatements(db, keys, 0, null)));
}

/** Clears quarantine and the failure count. Returns false when the job doesn't exist. */
export async function unquarantineJob(db: D1Database, key: string): Promise<boolean> {
  const result = await db.prepare(`UPDATE ingest_jobs SET disabled_until = NULL, attempts = 0, updated_at = ${SQL_NOW}
    WHERE key = ?1`).bind(key).run();
  return result.meta.changes > 0;
}

/** Creates or redefines jobs outside a run (no fence). Returns rows written. */
export async function upsertJobsNow(db: D1Database, specs: JobSpec[]): Promise<number> {
  if (specs.length === 0) return 0;
  return sumChanges(await db.batch(specs.map((spec) => upsertJobStatement(db, spec, null))));
}

/** Returns false for an unknown group; groups are only created by migrations. */
export async function setOwner(db: D1Database, group: string, owner: IngestOwner): Promise<boolean> {
  const result = await db.prepare(`UPDATE ingest_owner SET owner = ?2, updated_at = ${SQL_NOW} WHERE group_name = ?1`)
    .bind(group, owner).run();
  return result.meta.changes > 0;
}

export async function getOwner(db: D1Database, group: string): Promise<IngestOwner | null> {
  return db.prepare('SELECT owner FROM ingest_owner WHERE group_name = ?1').bind(group).first<IngestOwner>('owner');
}

export interface OwnerRow {
  group: string;
  owner: IngestOwner;
  updatedAt: number;
}

export async function listOwners(db: D1Database): Promise<OwnerRow[]> {
  const { results } = await db.prepare('SELECT group_name AS "group", owner, updated_at AS updatedAt FROM ingest_owner ORDER BY group_name')
    .all<OwnerRow>();
  return results;
}

export interface JobRow {
  key: string;
  kind: string;
  group: string;
  owner: IngestOwner | null;
  params: string;
  resourceClass: ResourceClass;
  priority: number;
  nextRunAt: number;
  dirtyAt: number | null;
  dirtyDueAt: number | null;
  dispatchToken: string | null;
  queuedUntil: number | null;
  currentRunId: string | null;
  runExpiresAt: number | null;
  attempts: number;
  disabledUntil: number | null;
  lastStartedAt: number | null;
  lastFinishedAt: number | null;
  lastSuccessAt: number | null;
  lastStatus: string | null;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

/** Every job with its lease and quarantine state and its group's owner. */
export async function listJobs(db: D1Database): Promise<JobRow[]> {
  const { results } = await db.prepare(`SELECT j.key, j.kind, j.group_name AS "group", o.owner, j.params,
      j.resource_class AS resourceClass, j.priority, j.next_run_at AS nextRunAt,
      j.dirty_at AS dirtyAt, j.dirty_due_at AS dirtyDueAt,
      j.dispatch_token AS dispatchToken, j.queued_until AS queuedUntil,
      j.current_run_id AS currentRunId, j.run_expires_at AS runExpiresAt,
      j.attempts, j.disabled_until AS disabledUntil,
      j.last_started_at AS lastStartedAt, j.last_finished_at AS lastFinishedAt, j.last_success_at AS lastSuccessAt,
      j.last_status AS lastStatus, j.last_error AS lastError, j.created_at AS createdAt, j.updated_at AS updatedAt
    FROM ingest_jobs j LEFT JOIN ingest_owner o ON o.group_name = j.group_name
    ORDER BY j.group_name, j.key`).all<JobRow>();
  return results;
}

export interface RunRow {
  id: string;
  jobKey: string;
  kind: string;
  startedAt: number;
  finishedAt: number | null;
  status: string;
  d1Calls: number | null;
  rowsRead: number | null;
  rowsWritten: number | null;
  upstreamCalls: number | null;
  creditsUsed: number | null;
  detail: unknown;
  error: string | null;
}

/** Newest runs first, optionally for one job. */
export async function listRuns(db: D1Database, job?: string | null, limit = 50): Promise<RunRow[]> {
  const columns = `id, job_key AS jobKey, kind, started_at AS startedAt, finished_at AS finishedAt, status,
    d1_calls AS d1Calls, rows_read AS rowsRead, rows_written AS rowsWritten,
    upstream_calls AS upstreamCalls, credits_used AS creditsUsed, detail, error`;
  const statement = job
    ? db.prepare(`SELECT ${columns} FROM ingest_runs WHERE job_key = ?1 ORDER BY started_at DESC LIMIT ?2`).bind(job, limit)
    : db.prepare(`SELECT ${columns} FROM ingest_runs ORDER BY started_at DESC LIMIT ?1`).bind(limit);
  const { results } = await statement.all<RunRow & { detail: string | null }>();
  return results.map((row) => ({ ...row, detail: row.detail === null ? null : JSON.parse(row.detail) }));
}

export async function writeHeartbeat(db: D1Database, name: string, detail: Record<string, unknown> | null): Promise<void> {
  await db.prepare(`INSERT INTO ingest_heartbeat (name, at, detail) VALUES (?1, ${SQL_NOW}, ?2)
    ON CONFLICT(name) DO UPDATE SET at = excluded.at, detail = excluded.detail`)
    .bind(name, detail === null ? null : JSON.stringify(detail)).run();
}

export async function readHeartbeat(db: D1Database, name: string): Promise<{ at: number; detail: unknown } | null> {
  const row = await db.prepare('SELECT at, detail FROM ingest_heartbeat WHERE name = ?1').bind(name)
    .first<{ at: number; detail: string | null }>();
  if (!row) return null;
  return { at: row.at, detail: row.detail === null ? null : JSON.parse(row.detail) };
}

/** Deletes finished runs that started more than `olderThanMs` ago. Returns rows deleted. */
export async function pruneRuns(db: D1Database, olderThanMs: number): Promise<number> {
  const result = await db.prepare(`DELETE FROM ingest_runs WHERE started_at < ${SQL_NOW} - ?1 AND status <> 'running'`)
    .bind(olderThanMs).run();
  return result.meta.changes;
}
