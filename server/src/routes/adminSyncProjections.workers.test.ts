import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { adminRoutes } from './admin';
import * as schema from '../db/schema';
import type { Env, Variables } from '../index';

describe('POST /api/admin/sync-projections Sleeper fallback (workers pool)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the array-shaped Sleeper payload by player_id and replaces placeholders without a snapshot', async () => {
    const db = drizzle(env.DB, { schema });
    const season = 2098;
    const week = 4;
    const now = new Date();

    await db.batch([
      db.insert(schema.nflPlayers).values({
        id: 'sleeper-array-rb', externalId: 'sleeper-array-rb-ext', name: 'Array Test RB',
        team: 'TST', position: 'RB', status: 'active', createdAt: now, updatedAt: now,
      }),
      // A small numeric Sleeper id: indexing the array by it would land on
      // an unrelated entry.
      db.insert(schema.nflPlayers).values({
        id: 'sleeper-array-qb', externalId: '1', name: 'Array Test QB',
        team: 'TST', position: 'QB', status: 'active', createdAt: now, updatedAt: now,
      }),
      // The 0-point row the misread payload used to leave behind.
      db.insert(schema.playerProjections).values({
        id: 'sleeper-array-rb-placeholder', playerId: 'sleeper-array-rb', week, seasonYear: season,
        scoringFormat: 'ppr', source: 'sleeper', projectedPoints: 0, updatedAt: now,
      }),
    ] as any);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify([
      { player_id: 'sleeper-array-rb-ext', opponent: 'DAL', stats: { pts_ppr: 24.88, rush_yd: 92, rec: 3 } },
      { player_id: '777777', opponent: 'NYG', stats: { pts_ppr: 10.5, rec_yd: 60 } },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', async (c, next) => {
      c.set('db', db as any);
      await next();
    });
    app.route('/', adminRoutes);

    const res = await app.request('/sync-projections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'test-sync-secret-for-vitest-only' },
      body: JSON.stringify({ seasonYear: season, week, source: 'sleeper', scoringFormats: ['ppr'] }),
    }, env);

    expect(res.status).toBe(200);

    const rows = await db.query.playerProjections.findMany({
      where: and(eq(schema.playerProjections.seasonYear, season), eq(schema.playerProjections.week, week)),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      playerId: 'sleeper-array-rb',
      scoringFormat: 'ppr',
      source: 'sleeper',
      projectedPoints: 24.88,
      projRushYards: 92,
      projReceptions: 3,
    });

    // Replacing the placeholder is not line movement, so no snapshot of the 0.
    const snapshots = await db.query.projectionLineSnapshots.findMany({
      where: and(eq(schema.projectionLineSnapshots.seasonYear, season), eq(schema.projectionLineSnapshots.week, week)),
    });
    expect(snapshots).toHaveLength(0);
  }, 30_000);
});
