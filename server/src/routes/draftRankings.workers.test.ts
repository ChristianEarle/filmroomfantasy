import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { draftRankingsRoutes } from './draftRankings';
import * as schema from '../db/schema';
import { generateId } from '../utils/id';
import { mountWithDb } from '../../test/testApp';

describe('GET /api/draft-rankings — season stat breakdown (workers pool)', () => {
  it('sums weekly player_projections stats into a season statBreakdown per player', async () => {
    const db = drizzle(env.DB, { schema });
    // Isolated season so this test can't collide with any other test/seed data.
    const season = 3099;

    const playerId = generateId();
    await db.insert(schema.nflPlayers).values({
      id: playerId,
      externalId: `ext-${playerId}`,
      name: 'Stat Breakdown RB',
      team: 'KC',
      position: 'RB',
      status: 'active',
    });

    await db.insert(schema.draftRankings).values({
      id: generateId(),
      playerId,
      rankingType: 'redraft',
      scoringFormat: 'ppr',
      superflex: false,
      overallRank: 1,
      positionRank: 1,
      tier: 1,
      projectedPoints: 250,
      rationale: 'Workhorse back.',
      seasonYear: season,
    });

    // Two weeks of projections — the route should sum these into one season total.
    await db.insert(schema.playerProjections).values([
      {
        id: generateId(),
        playerId,
        week: 1,
        seasonYear: season,
        projectedPoints: 18,
        scoringFormat: 'ppr',
        projRushYards: 80,
        projRushTDs: 1,
        projReceptions: 3,
      },
      {
        id: generateId(),
        playerId,
        week: 2,
        seasonYear: season,
        projectedPoints: 20,
        scoringFormat: 'ppr',
        projRushYards: 90,
        projRushTDs: 0.5,
        projReceptions: 4,
      },
    ]);

    const app = mountWithDb(draftRankingsRoutes);
    const res = await app.request(`/?type=redraft&scoring=ppr&season=${season}`, {}, env);

    expect(res.status).toBe(200);
    const body = await res.json() as {
      rankings: Array<{
        player: { id: string };
        statBreakdown: { rushYards: number | null; rushTDs: number | null; receptions: number | null } | null;
      }>;
    };
    const row = body.rankings.find((r) => r.player.id === playerId);
    expect(row).toBeDefined();
    expect(row!.statBreakdown).toEqual({
      passYards: null,
      passTDs: null,
      rushYards: 170,
      rushTDs: 1.5,
      receptions: 7,
      recYards: null,
      recTDs: null,
    });
  });

  it('returns a null statBreakdown when no player_projections rows exist for the season', async () => {
    const db = drizzle(env.DB, { schema });
    const season = 3098;

    const playerId = generateId();
    await db.insert(schema.nflPlayers).values({
      id: playerId,
      externalId: `ext-${playerId}`,
      name: 'No Projections WR',
      team: 'SF',
      position: 'WR',
      status: 'active',
    });

    await db.insert(schema.draftRankings).values({
      id: generateId(),
      playerId,
      rankingType: 'redraft',
      scoringFormat: 'ppr',
      superflex: false,
      overallRank: 1,
      positionRank: 1,
      tier: 1,
      projectedPoints: 200,
      rationale: 'No weekly data yet.',
      seasonYear: season,
    });

    const app = mountWithDb(draftRankingsRoutes);
    const res = await app.request(`/?type=redraft&scoring=ppr&season=${season}`, {}, env);

    expect(res.status).toBe(200);
    const body = await res.json() as {
      rankings: Array<{ player: { id: string }; statBreakdown: unknown }>;
    };
    const row = body.rankings.find((r) => r.player.id === playerId);
    expect(row).toBeDefined();
    expect(row!.statBreakdown).toBeNull();
  });
});
