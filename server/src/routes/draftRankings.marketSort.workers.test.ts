import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { marketRankingsRoutes } from './draftRankings';
import * as schema from '../db/schema';
import type { Env, Variables } from '../index';

/**
 * GET /api/market-rankings?sort=ros re-orders the same season's rows by
 * rosPoints (remaining-of-season value) instead of the stored season-VORP
 * marketRank — a dedicated "ROS ranking" view that needed no new AI
 * generation since rosPoints is already computed at sync time. Covers: the
 * re-order itself, the recomputed `rank` field per row, nulls-last handling
 * for players with no rosPoints, and that `sort=season` (or omitted) keeps
 * the original marketRank order untouched.
 */
describe('GET /api/market-rankings?sort= (workers pool)', () => {
  it('orders by rosPoints (nulls last) when sort=ros, and recomputes rank; season sort is unaffected', async () => {
    const db = drizzle(env.DB, { schema });
    const season = 2098; // isolated season — can't collide with other tests/data
    const now = new Date();

    // Seasonal order (by marketRank): A(1), B(2), C(3), D(4).
    // ROS order (by rosPoints desc, nulls last): C(300), A(200), B(100), D(null).
    const players = [
      { id: 'ros-test-a', name: 'Player A', marketRank: 1, rosPoints: 200 },
      { id: 'ros-test-b', name: 'Player B', marketRank: 2, rosPoints: 100 },
      { id: 'ros-test-c', name: 'Player C', marketRank: 3, rosPoints: 300 },
      { id: 'ros-test-d', name: 'Player D', marketRank: 4, rosPoints: null },
    ];

    await db.batch(
      players.map((p) =>
        db.insert(schema.nflPlayers).values({
          id: p.id,
          externalId: `ext-${p.id}`,
          name: p.name,
          team: 'TST',
          position: 'WR',
          status: 'active',
          createdAt: now,
          updatedAt: now,
        })
      ) as any
    );

    await db.batch(
      players.map((p) =>
        db.insert(schema.playerMarketProjections).values({
          id: `mkt-${p.id}`,
          playerId: p.id,
          seasonYear: season,
          asOfWeek: 3,
          scoringFormat: 'ppr',
          seasonPoints: 250,
          rosPoints: p.rosPoints,
          perGameRate: 15,
          remainingGames: 14,
          marketRank: p.marketRank,
          positionRank: p.marketRank,
          tier: 1,
          vorp: 10,
          confidence: 'season_props',
          source: 'market',
          computedAt: now,
        })
      ) as any
    );

    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', async (c, next) => {
      c.set('db', db as any);
      await next();
    });
    app.route('/', marketRankingsRoutes);

    const seasonRes = await app.request(`/?scoring=ppr&season=${season}`, {}, env);
    expect(seasonRes.status).toBe(200);
    const seasonBody = (await seasonRes.json()) as { rankings: any[]; meta: { sort: string } };
    expect(seasonBody.meta.sort).toBe('season');
    expect(seasonBody.rankings.map((r) => r.player.id)).toEqual([
      'ros-test-a',
      'ros-test-b',
      'ros-test-c',
      'ros-test-d',
    ]);
    // Season sort's rank field mirrors the stored marketRank.
    expect(seasonBody.rankings.map((r) => r.rank)).toEqual([1, 2, 3, 4]);

    const rosRes = await app.request(`/?scoring=ppr&season=${season}&sort=ros`, {}, env);
    expect(rosRes.status).toBe(200);
    const rosBody = (await rosRes.json()) as { rankings: any[]; meta: { sort: string } };
    expect(rosBody.meta.sort).toBe('ros');
    expect(rosBody.rankings.map((r) => r.player.id)).toEqual([
      'ros-test-c',
      'ros-test-a',
      'ros-test-b',
      'ros-test-d',
    ]);
    // ROS sort's rank field reflects the new order, not the stored marketRank.
    expect(rosBody.rankings.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    // marketRank always stays the season-based DB value for reference.
    expect(rosBody.rankings.map((r) => r.marketRank)).toEqual([3, 1, 2, 4]);

    const badRes = await app.request(`/?scoring=ppr&season=${season}&sort=bogus`, {}, env);
    expect(badRes.status).toBe(400);
  });
});
