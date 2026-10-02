import { sql, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { resolveSeasonInFocus } from '../services/nflState';
import { resolveWeekFromCalendar } from '../services/nflState';

type DB = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Get the default NFL season year from the current date. Delegates to the
 * calendar resolver (services/nflState.ts) so this stays in sync with the
 * single source of truth for "what NFL season is it".
 * Mirrors src/utils/playerUtils.ts's getDefaultSeason() on the frontend.
 */
export function getDefaultSeason(): number {
  return resolveWeekFromCalendar(new Date()).season;
}

/**
 * The season the NFL world is focused on: the one in progress, or the
 * upcoming one during the offseason. Use this for connecting/looking up
 * leagues and for tenure reasoning; use getDefaultSeason() for "which
 * season has data to display".
 */
export function getSeasonInFocus(): number {
  return resolveSeasonInFocus(new Date());
}

/**
 * Resolve the effective "display season" for a request.
 *
 * In the NFL offseason (roughly January through early September), the current
 * calendar year's season has zero games and zero stats in our DB because it
 * hasn't kicked off yet. Every view that naively uses `new Date().getFullYear()`
 * or the league's upcoming seasonYear ends up empty.
 *
 * This helper checks whether the requested season has any games; if not, it
 * transparently falls back to the most recent season that does. Callers
 * should surface `isFallback` to the UI so the user sees they're looking at
 * historical data.
 *
 * Result includes:
 *   - season:      the season to actually query against
 *   - requested:   what the caller asked for
 *   - isFallback:  true if we substituted a different season
 */
export interface ResolvedSeason {
  season: number;
  requested: number;
  isFallback: boolean;
}

export async function resolveDisplaySeason(
  db: DB,
  requested: number,
): Promise<ResolvedSeason> {
  const hasGames = await db.query.nflGames.findFirst({
    where: eq(schema.nflGames.seasonYear, requested),
    columns: { id: true },
  });

  if (hasGames) {
    return { season: requested, requested, isFallback: false };
  }

  const latest = await db
    .select({ yr: sql<number>`max(${schema.nflGames.seasonYear})` })
    .from(schema.nflGames);
  const latestYear = latest[0]?.yr;

  if (!latestYear || latestYear === requested) {
    return { season: requested, requested, isFallback: false };
  }

  return { season: latestYear, requested, isFallback: true };
}
