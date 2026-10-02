import type { drizzle } from 'drizzle-orm/d1';
import type * as schema from '../db/schema';
import type { RunMeter } from './meter';

/** The subset of the API's Env that the filmroom-ingest Worker is bound to. */
export interface IngestEnv {
  DB: D1Database;
  INGEST_QUEUE: Queue<IngestMessage>;
  INGEST_INTERACTIVE_QUEUE: Queue<IngestMessage>;
  ENVIRONMENT: string;
  ODDS_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  SYNC_SECRET?: string;
  RESEND_API_KEY?: string;
  ALERT_EMAIL?: string;
  TWITTER_RSS_URLS?: string;
}

/** Queue message body. Consumers ack and skip any other `v`. */
export interface IngestMessage {
  v: 1;
  key: string;
  token: string;
  kind: string;
}

export type ResourceClass = 'light' | 'heavy';
export type IngestOwner = 'legacy' | 'ingest';
export type IngestDb = ReturnType<typeof drizzle<typeof schema>>;

export type JobDetail = Record<string, number | string | boolean | null>;

export interface JobResult {
  status: 'ok' | 'partial' | 'skipped';
  /** `null` retires (deletes) the job. */
  nextRunAt: number | null;
  changed?: boolean;
  detail?: JobDetail;
}

export interface JobSpec {
  key: string;
  kind: string;
  group: string;
  params?: unknown;
  resourceClass?: ResourceClass;
  priority?: number;
  /** Only used when the job is created; an existing job keeps its schedule. */
  nextRunAt?: number;
}

export interface JobContext {
  /** Drizzle over the metered D1 binding. */
  db: IngestDb;
  env: IngestEnv;
  now: number;
  /**
   * Consecutive failed runs before this one. Above 0, the previous run failed
   * or was killed, and a killed run's buffered markDue was lost while its data
   * writes stayed committed: a handler with dependents marks them due
   * whenever this is above 0, even when its own diff finds nothing new.
   */
  attempts: number;
  signal: AbortSignal;
  deadline: number;
  meter: RunMeter;
  /** Runs a paid upstream call at most once per idempotency key. */
  oncePaid<T>(idemKey: string, call: () => Promise<T>): Promise<T | 'already_done'>;
  /** Buffered: written in the fenced completion batch (lost if the invocation dies; see `attempts`). */
  markDue(keys: string[], debounceMs: number): void;
  /** Buffered: written in the fenced completion batch. */
  upsertJobs(specs: JobSpec[]): void;
  /** Buffered: written in the fenced completion batch. */
  deleteJobs(keys: string[]): void;
  reportCredits(n: number): void;
}

export interface JobHandler<P = unknown> {
  kind: string;
  group: string;
  resourceClass: ResourceClass;
  /** Cooperative: handlers check ctx.signal / ctx.deadline between steps. */
  softDeadlineMs: number;
  run(ctx: JobContext, params: P): Promise<JobResult>;
}

/** One write a run buffered through its JobContext. */
export type BufferedWrite =
  | { op: 'markDue'; keys: string[]; debounceMs: number }
  | { op: 'upsertJobs'; specs: JobSpec[] }
  | { op: 'deleteJobs'; keys: string[] };

/** The writes a run buffered, in call order; completeRun applies them in that order. */
export type BufferedWrites = BufferedWrite[];

/** Upstream says the target no longer exists: the job retires with status `skipped` and no backoff. */
export class TerminalJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TerminalJobError';
  }
}
