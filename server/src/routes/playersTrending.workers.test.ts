import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { playerRoutes } from './players';
import * as schema from '../db/schema';
import { mountWithDb } from '../../test/testApp';
import { getDefaultSeason } from '../utils/seasons';

describe('GET /api/players/trending (workers pool)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('averages PPR points over only the current season\'s last 4 weeks with stats, not the player\'s full history', async () => {
    const db = drizzle(env.DB, { schema });
    const currentSeason = getDefaultSeason();

    await db.insert(schema.nflPlayers).values({
      id: 'trend-test-player',
      externalId: 'trend-ext-1',
      name: 'Trend Test Player',
      team: 'KC',
      position: 'WR',
      status: 'active',
    });

    await db.batch([
      // An early-season week far outside the last-4-weeks window — must be excluded.
      db.insert(schema.playerWeeklyStats).values({
        id: 'trend-stat-w1', playerId: 'trend-test-player', week: 1, seasonYear: currentSeason, fantasyPointsPPR: 100,
      }),
      // The last 4 weeks with stats this season — latest week is 8, so the window is 5-8.
      db.insert(schema.playerWeeklyStats).values({
        id: 'trend-stat-w5', playerId: 'trend-test-player', week: 5, seasonYear: currentSeason, fantasyPointsPPR: 10,
      }),
      db.insert(schema.playerWeeklyStats).values({
        id: 'trend-stat-w6', playerId: 'trend-test-player', week: 6, seasonYear: currentSeason, fantasyPointsPPR: 12,
      }),
      db.insert(schema.playerWeeklyStats).values({
        id: 'trend-stat-w7', playerId: 'trend-test-player', week: 7, seasonYear: currentSeason, fantasyPointsPPR: 14,
      }),
      db.insert(schema.playerWeeklyStats).values({
        id: 'trend-stat-w8', playerId: 'trend-test-player', week: 8, seasonYear: currentSeason, fantasyPointsPPR: 16,
      }),
      // A prior season's row with an extreme value — must never leak into the average.
      db.insert(schema.playerWeeklyStats).values({
        id: 'trend-stat-prior-season', playerId: 'trend-test-player', week: 1, seasonYear: currentSeason - 1, fantasyPointsPPR: 1000,
      }),
    ] as any);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ player_id: 'trend-ext-1', count: 5000 }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const app = mountWithDb(playerRoutes);
    // A limit unused by any other test keeps this test's Sleeper-trending
    // cache entry (keyed only by direction + limit, not by player) isolated.
    const res = await app.request('/trending?direction=up&limit=9', {}, env);
    expect(res.status).toBe(200);

    const body = await res.json() as { trending: Array<{ id: string; avgPointsPPR: number }> };
    const row = body.trending.find((t) => t.id === 'trend-test-player');
    expect(row).toBeDefined();
    // (10 + 12 + 14 + 16) / 4 = 13 — week 1 and the prior season's 1000-point
    // outlier are both excluded from the average.
    expect(row!.avgPointsPPR).toBe(13);
  });
});
