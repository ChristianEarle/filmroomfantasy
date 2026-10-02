/**
 * The platform allows 1,000 D1 calls per invocation; the rest of the budget
 * is left for the ledger bookkeeping that runs after the handler.
 */
export const DEFAULT_D1_CALL_LIMIT = 900;

export class BudgetExceededError extends Error {
  constructor(readonly limit: number) {
    super(`D1 call budget of ${limit} calls exceeded`);
    this.name = 'BudgetExceededError';
  }
}

/** What a finished run records in its ingest_runs row. */
export interface RunCounters {
  d1Calls: number;
  rowsRead: number;
  rowsWritten: number;
  upstreamCalls: number;
  creditsUsed: number;
}

/**
 * Counts what one job run spends. `db` is the metered binding handed to job
 * code; ledger bookkeeping must keep using the raw binding so it is neither
 * counted nor refused.
 */
export class RunMeter implements RunCounters {
  d1Calls = 0;
  rowsRead = 0;
  rowsWritten = 0;
  upstreamCalls = 0;
  creditsUsed = 0;
  readonly db: D1Database;

  constructor(raw: D1Database, readonly limit = DEFAULT_D1_CALL_LIMIT) {
    this.db = meterDatabase(raw, this);
  }

  countUpstream(n = 1): void {
    this.upstreamCalls += n;
  }

  addCredits(n: number): void {
    this.creditsUsed += n;
  }

  /** Counts a call made for the run on the raw binding: never refused, but it spends the budget. */
  countRawCall(): void {
    this.d1Calls += 1;
  }

  /** Counts one call that reaches D1, refusing it once the budget is spent. */
  async track<T>(call: () => Promise<T>, resultsOf: (value: T) => D1Result[] = () => []): Promise<T> {
    if (this.d1Calls >= this.limit) throw new BudgetExceededError(this.limit);
    this.d1Calls += 1;
    const value = await call();
    for (const { meta } of resultsOf(value)) {
      this.rowsRead += meta?.rows_read ?? 0;
      this.rowsWritten += meta?.rows_written ?? 0;
    }
    return value;
  }
}

// first() and raw() return no meta, so their rows go uncounted (Drizzle
// selects use raw()); the call itself is always counted.
class MeteredStatement {
  constructor(readonly inner: D1PreparedStatement, private readonly meter: RunMeter) {}

  bind(...values: unknown[]): MeteredStatement {
    return new MeteredStatement(this.inner.bind(...values), this.meter);
  }

  first(colName?: string): Promise<unknown> {
    return this.meter.track(() => (colName === undefined ? this.inner.first() : this.inner.first(colName)));
  }

  run(): Promise<D1Result> {
    return this.meter.track(() => this.inner.run(), (result) => [result]);
  }

  all(): Promise<D1Result> {
    return this.meter.track(() => this.inner.all(), (result) => [result]);
  }

  raw(options?: { columnNames?: boolean }): Promise<unknown[]> {
    return this.meter.track(() => (options?.columnNames ? this.inner.raw({ columnNames: true }) : this.inner.raw()));
  }
}

function unwrap(statement: D1PreparedStatement): D1PreparedStatement {
  return statement instanceof MeteredStatement ? statement.inner : statement;
}

// Deliberately has no withSession(): a session would bypass the meter.
function meterDatabase(raw: D1Database, meter: RunMeter): D1Database {
  const metered = {
    prepare: (query: string) => new MeteredStatement(raw.prepare(query), meter),
    batch: (statements: D1PreparedStatement[]) =>
      meter.track(() => raw.batch(statements.map(unwrap)), (results) => results),
    exec: (query: string) => meter.track(() => raw.exec(query)),
  };
  return metered as unknown as D1Database;
}
