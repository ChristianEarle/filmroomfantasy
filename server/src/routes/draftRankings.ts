import { Hono } from 'hono';
import { eq, and, asc } from 'drizzle-orm';
import * as schema from '../db/schema';
import { cached } from '../utils/cache';
import type { Env, Variables } from '../index';

export const draftRankingsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /api/draft-rankings
 *
 * Query params:
 *  - type: 'redraft' | 'dynasty_rookie' (default: 'redraft')
 *  - scoring: 'ppr' | 'half-ppr' | 'standard' (default: 'ppr')
 *  - superflex: '0' | '1' (default: '0')
 *  - season: number (default: current year)
 */
draftRankingsRoutes.get('/', async (c) => {
  const db = c.get('db');
  const rankingType = (c.req.query('type') || 'redraft') as 'redraft' | 'dynasty_rookie';
  const scoringFormat = (c.req.query('scoring') || 'ppr') as 'ppr' | 'half-ppr' | 'standard';
  const superflex = c.req.query('superflex') === '1';
  const season = parseInt(c.req.query('season') || String(new Date().getFullYear()), 10);

  // Validate
  if (!['redraft', 'dynasty_rookie'].includes(rankingType)) {
    return c.json({ error: 'Invalid ranking type' }, 400);
  }
  if (!['ppr', 'half-ppr', 'standard'].includes(scoringFormat)) {
    return c.json({ error: 'Invalid scoring format' }, 400);
  }

  const cacheKey = `draft-rankings:${rankingType}:${scoringFormat}:${superflex}:${season}`;
  const result = await cached(cacheKey, 5 * 60 * 1000, async () => {
    const rankings = await db.query.draftRankings.findMany({
      where: and(
        eq(schema.draftRankings.rankingType, rankingType),
        eq(schema.draftRankings.scoringFormat, scoringFormat),
        eq(schema.draftRankings.superflex, superflex),
        eq(schema.draftRankings.seasonYear, season),
      ),
      orderBy: asc(schema.draftRankings.overallRank),
      with: {
        player: {
          columns: {
            id: true,
            name: true,
            position: true,
            team: true,
            age: true,
            yearsExp: true,
            status: true,
            injuryNote: true,
            headshotUrl: true,
            externalId: true,
          },
        },
      },
    });

    return rankings.map(r => ({
      id: r.id,
      overallRank: r.overallRank,
      positionRank: r.positionRank,
      tier: r.tier,
      projectedPoints: r.projectedPoints,
      adp: r.adp,
      adpDelta: r.adpDelta,
      rationale: r.rationale,
      analysis: r.analysis,
      generatedAt: r.generatedAt,
      player: r.player,
    }));
  });

  return c.json({
    rankings: result,
    meta: {
      rankingType,
      scoringFormat,
      superflex,
      season,
      count: result.length,
      generatedAt: result.length > 0 ? result[0].generatedAt : null,
    },
  });
});
