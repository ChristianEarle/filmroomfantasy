/**
 * DB-touching companion to services/marketRankings.ts, which stays pure
 * (no DB access) so its math is unit-testable without D1/Miniflare. This
 * file holds the one query shared by the "read" side of market rankings:
 * GET /api/market-rankings (routes/draftRankings.ts) and the season-mode
 * player enrichment in routes/players.ts both need to know "which
 * as_of_week did sync-market-projections most recently compute?" — they
 * must agree on that value or one could show a different snapshot than
 * the other for the same season/scoring format.
 */

import { eq, and, desc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

type DB = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Resolves the most recently computed as_of_week in player_market_projections
 * for a given season + scoring format, or null if nothing has been synced
 * yet for that combination. Read-only — does not decide what asOfWeek to
 * *write*; that default (last completed week = currentWeek - 1) lives in
 * admin.ts's POST /sync-market-projections.
 */
export async function resolveMarketAsOfWeek(
  db: DB,
  season: number,
  scoringFormat: 'ppr' | 'half-ppr' | 'standard'
): Promise<number | null> {
  const latest = await db.query.playerMarketProjections.findFirst({
    where: and(
      eq(schema.playerMarketProjections.seasonYear, season),
      eq(schema.playerMarketProjections.scoringFormat, scoringFormat)
    ),
    orderBy: desc(schema.playerMarketProjections.asOfWeek),
    columns: { asOfWeek: true },
  });
  return latest?.asOfWeek ?? null;
}
