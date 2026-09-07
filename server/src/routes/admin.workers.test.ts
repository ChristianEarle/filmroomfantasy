import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { adminRoutes } from './admin';
import * as schema from '../db/schema';
import { generateId } from '../utils/id';
import type { Env, Variables } from '../index';

/**
 * Regression coverage for PR #309's review fix #1: the market-projections
 * upsert used to write one `.insert(...).values(chunk50)` statement per
 * chunk — 50 rows x 16 columns is ~800 bound params, well past D1's
 * ~100-per-statement limit. It's now `db.batch()` of ~50 single-row
 * insert...onConflictDoUpdate statements instead (same pattern as
 * sync-players above it in admin.ts). This test seeds enough players to
 * force multiple db.batch() calls and inspects every statement's actual
 * bound-param count via drizzle's `.toSQL()`, so it fails again if the
 * upsert ever reverts to multi-row `.values([...])` chunks.
 */
describe('POST /api/admin/sync-market-projections (workers pool)', () => {
  it('upserts via chunked db.batch() calls whose statements each stay under the D1 bound-param limit', async () => {
    const db = drizzle(env.DB, { schema });

    const season = 2099; // isolated season — can't collide with other tests/data
    const PLAYER_COUNT = 120; // > UPSERT_CHUNK(50) so this forces multiple db.batch() calls
    const now = new Date();

    // Tier A ('season_props') needs nothing but a matched season-prop row per
    // player — no weekly stats, games, or league needed — so every player
    // produces an upsert row deterministically.
    const playerRows = Array.from({ length: PLAYER_COUNT }, (_, i) => ({
      id: `mp-batch-test-${i}`,
      externalId: `ext-mp-batch-test-${i}`,
      name: `Batch Test Player ${i}`,
      team: 'TST',
      position: 'WR',
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
    }));
    for (let i = 0; i < playerRows.length; i += 50) {
      const chunk = playerRows.slice(i, i + 50);
      await db.batch(chunk.map((p) => db.insert(schema.nflPlayers).values(p)) as any);
    }

    const propRows = playerRows.map((p) => ({
      id: generateId(),
      playerId: p.id,
      playerName: p.name,
      team: p.team,
      position: p.position,
      season,
      stat: 'rec_yds',
      line: 900,
      overPrice: -110,
      underPrice: -110,
      book: 'testbook',
      sourceUrl: null,
      capturedAt: '2026-08-01',
    }));
    for (let i = 0; i < propRows.length; i += 50) {
      const chunk = propRows.slice(i, i + 50);
      await db.batch(chunk.map((r) => db.insert(schema.playerSeasonProps).values(r as any)) as any);
    }

    // Wrap the real db so every db.batch() call is recorded — batch() still
    // runs for real underneath, this only observes what gets passed to it.
    // Functions are rebound to `target` (not the proxy) so drizzle's
    // internal `this` references stay correct.
    const batchCalls: any[][] = [];
    const dbProxy = new Proxy(db as any, {
      get(target, prop) {
        const value = (target as any)[prop];
        if (prop === 'batch') {
          return (statements: any[]) => {
            batchCalls.push(statements);
            return value.apply(target, [statements]);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });

    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', async (c, next) => {
      c.set('db', dbProxy);
      await next();
    });
    app.route('/', adminRoutes);

    const res = await app.request('/sync-market-projections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'test-sync-secret-for-vitest-only' },
      body: JSON.stringify({ season, asOfWeek: 0, scoringFormat: 'ppr' }),
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json() as { counts: Record<string, number> };
    expect(body.counts.season_props).toBe(PLAYER_COUNT);

    // 120 rows / ~50-per-batch => at least 3 db.batch() calls.
    expect(batchCalls.length).toBeGreaterThan(1);
    for (const statements of batchCalls) {
      // Each call batches ~50 *single-row* statements rather than one
      // multi-row statement — that's what keeps per-statement param counts
      // low despite 50 rows going out together.
      expect(statements.length).toBeLessThanOrEqual(50);
      for (const stmt of statements) {
        const { params } = stmt.toSQL();
        expect(params.length).toBeLessThanOrEqual(100);
      }
    }
  }, 30_000);
});
