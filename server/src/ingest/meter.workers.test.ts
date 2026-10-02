import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { BudgetExceededError, DEFAULT_D1_CALL_LIMIT, RunMeter } from './meter';

const INSERT = 'INSERT INTO ingest_heartbeat (name, at) VALUES (?1, ?2)';

async function heartbeatCount(): Promise<number> {
  return Number(await env.DB.prepare('SELECT COUNT(*) AS n FROM ingest_heartbeat').first('n'));
}

describe('RunMeter (workers pool)', () => {
  beforeEach(async () => {
    await env.DB.prepare('DELETE FROM ingest_heartbeat').run();
  });

  it('counts every call that reaches D1 and the rows D1 reports', async () => {
    const meter = new RunMeter(env.DB);

    const first = await meter.db.prepare(INSERT).bind('a', 1).run();
    const second = await meter.db.prepare(INSERT).bind('b', 2).run();
    const select = await meter.db.prepare('SELECT name FROM ingest_heartbeat ORDER BY name').all();
    expect(select.results).toEqual([{ name: 'a' }, { name: 'b' }]);
    expect(await meter.db.prepare('SELECT at FROM ingest_heartbeat WHERE name = ?1').bind('b').first('at')).toBe(2);
    expect(await meter.db.prepare('SELECT name, at FROM ingest_heartbeat ORDER BY name').raw()).toEqual([['a', 1], ['b', 2]]);
    expect(await meter.db.prepare('SELECT name FROM ingest_heartbeat ORDER BY name').raw({ columnNames: true }))
      .toEqual([['name'], ['a'], ['b']]);
    await meter.db.exec("DELETE FROM ingest_heartbeat WHERE name = 'a'");

    expect(meter.d1Calls).toBe(7);
    expect(meter.rowsWritten).toBe(first.meta.rows_written + second.meta.rows_written);
    expect(meter.rowsWritten).toBeGreaterThanOrEqual(2);
    expect(meter.rowsRead).toBe(first.meta.rows_read + second.meta.rows_read + select.meta.rows_read);
    expect(meter.rowsRead).toBeGreaterThanOrEqual(2);

    await env.DB.prepare(INSERT).bind('raw', 3).run();
    expect(meter.d1Calls).toBe(7);
  });

  it('counts a batch as one call and sums its rows', async () => {
    const meter = new RunMeter(env.DB);
    const insert = meter.db.prepare(INSERT);

    const results = await meter.db.batch([insert.bind('a', 1), insert.bind('b', 2), insert.bind('c', 3)]);

    expect(meter.d1Calls).toBe(1);
    expect(meter.rowsWritten).toBe(results.reduce((sum, { meta }) => sum + meta.rows_written, 0));
    expect(meter.rowsWritten).toBeGreaterThanOrEqual(3);
    expect(await heartbeatCount()).toBe(3);
  });

  it('meters Drizzle queries and batches over the wrapped binding', async () => {
    const meter = new RunMeter(env.DB);
    const db = drizzle(meter.db, { schema });
    const byName = eq(schema.ingestHeartbeat.name, 'x');

    await db.insert(schema.ingestHeartbeat).values({ name: 'x', at: 1 });
    expect(await db.select().from(schema.ingestHeartbeat).where(byName).get()).toEqual({ name: 'x', at: 1, detail: null });
    const [, rows] = await db.batch([
      db.update(schema.ingestHeartbeat).set({ at: 2 }).where(byName),
      db.select().from(schema.ingestHeartbeat).where(byName),
    ]);

    expect(rows).toEqual([{ name: 'x', at: 2, detail: null }]);
    expect(meter.d1Calls).toBe(3);
  });

  it('refuses calls past the limit before they reach D1', async () => {
    const meter = new RunMeter(env.DB, 2);
    const insert = meter.db.prepare(INSERT);

    await insert.bind('a', 1).run();
    await insert.bind('b', 2).run();
    await expect(insert.bind('c', 3).run()).rejects.toBeInstanceOf(BudgetExceededError);
    await expect(meter.db.batch([insert.bind('d', 4)])).rejects.toBeInstanceOf(BudgetExceededError);
    await expect(meter.db.prepare('SELECT 1 AS one').first('one')).rejects.toThrow('D1 call budget of 2 calls exceeded');

    expect(meter.d1Calls).toBe(2);
    expect(await heartbeatCount()).toBe(2);
  });

  it('counts raw calls made for the run without refusing them, so they spend the budget', async () => {
    const meter = new RunMeter(env.DB, 2);

    meter.countRawCall();
    meter.countRawCall();
    meter.countRawCall();

    expect(meter.d1Calls).toBe(3);
    await expect(meter.db.prepare('SELECT 1 AS one').first('one')).rejects.toBeInstanceOf(BudgetExceededError);
  });

  it('allows 900 calls by default', async () => {
    const meter = new RunMeter(env.DB);
    expect(DEFAULT_D1_CALL_LIMIT).toBe(900);

    const probe = meter.db.prepare('SELECT 1 AS one');
    for (let i = 0; i < 900; i++) await probe.first('one');
    await expect(probe.first('one')).rejects.toBeInstanceOf(BudgetExceededError);
    expect(meter.d1Calls).toBe(900);
  });

  it('tallies upstream calls and credits reported by the job', () => {
    const meter = new RunMeter(env.DB);

    meter.countUpstream();
    meter.countUpstream(2);
    meter.addCredits(1);
    meter.addCredits(3);

    expect(meter).toMatchObject({ upstreamCalls: 3, creditsUsed: 4, d1Calls: 0 });
  });
});
