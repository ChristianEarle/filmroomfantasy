import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { getNflSeasonContext, fetchEspnCurrentWeek } from './espn';

type DB = ReturnType<typeof drizzle<typeof schema>>;

export interface NflState {
  season: number;            // e.g. 2026
  week: number;              // 1..18 regular season week to show by default
  seasonType: 'preseason' | 'regular' | 'postseason' | 'offseason';
  source: 'schedule' | 'espn' | 'calendar';   // how it was resolved
  resolvedAt: string;        // ISO timestamp
}

/** Subset of an `nfl_games` row that the schedule resolver needs. */
export interface ScheduleGame {
  week: number;
  gameTime: Date;
  isComplete: boolean;
  homeScore: number | null;
  awayScore: number | null;
}

/**
 * A game counts as "finished" once we'd trust its result to roll the week
 * forward: it's marked complete, both scores are in, or enough time has
 * passed since kickoff that it must be over (covers rows where a sync job
 * never flipped isComplete).
 */
export function isGameFinished(game: ScheduleGame, now: Date): boolean {
  if (game.isComplete) return true;
  if (game.homeScore != null && game.awayScore != null) return true;
  const fiveHoursAfterKickoff = game.gameTime.getTime() + 5 * 3600000;
  return fiveHoursAfterKickoff < now.getTime();
}

/**
 * Resolve the current week from actual schedule rows: the smallest week
 * that still has an unfinished game. Once every game in a week is finished,
 * the week rolls forward and never goes back (it falls out of the rule
 * naturally since a "smallest week with an unfinished game" only increases
 * as games complete).
 *
 * Returns null when there are no rows to reason about (caller should fall
 * back to ESPN or the calendar).
 */
export function resolveWeekFromSchedule(games: ScheduleGame[], now: Date): number | null {
  if (games.length === 0) return null;

  let maxWeek = 0;
  const weeksWithUnfinishedGames = new Set<number>();
  for (const game of games) {
    maxWeek = Math.max(maxWeek, game.week);
    if (!isGameFinished(game, now)) {
      weeksWithUnfinishedGames.add(game.week);
    }
  }

  if (weeksWithUnfinishedGames.size === 0) return maxWeek;
  return Math.min(...weeksWithUnfinishedGames);
}

/** Labor Day (first Monday of September) for a given season year, UTC-safe. */
function laborDay(seasonYear: number): Date {
  const sept1 = new Date(Date.UTC(seasonYear, 8, 1));
  const dayOfWeek = sept1.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const daysUntilMonday = (8 - dayOfWeek) % 7; // days from Sept 1 to the first Monday
  return new Date(Date.UTC(seasonYear, 8, 1 + daysUntilMonday));
}

/**
 * Deterministic, I/O-free last resort: derive the week purely from the
 * calendar. NFL week 1 kicks off the Thursday after Labor Day; each
 * fantasy week runs Tuesday -> Monday, so week 1 starts on the Tuesday
 * after Labor Day and week N starts 7*(N-1) days after that.
 */
export function resolveWeekFromCalendar(now: Date): { season: number; week: number; seasonType: NflState['seasonType'] } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed

  // A "season" runs from Aug 1 through the following Jul 31, so any date in
  // Aug-Dec belongs to this calendar year's season and any date in Jan-Jul
  // belongs to the season that started the previous calendar year.
  const season = month >= 7 ? year : year - 1;

  const week1Start = new Date(laborDay(season).getTime() + 24 * 3600000); // Tue after Labor Day
  if (now.getTime() < week1Start.getTime()) {
    return { season, week: 1, seasonType: 'preseason' };
  }

  const msPerWeek = 7 * 24 * 3600000;
  // The Tuesday after week 18's Monday finale is when the postseason window
  // begins for this season.
  const postseasonStart = new Date(week1Start.getTime() + 18 * msPerWeek);

  if (now.getTime() < postseasonStart.getTime()) {
    const weeksElapsed = Math.floor((now.getTime() - week1Start.getTime()) / msPerWeek);
    const week = Math.min(18, Math.max(1, weeksElapsed + 1));
    return { season, week, seasonType: 'regular' };
  }

  // Postseason runs into mid-February; after that it's offseason until the
  // next preseason kicks off. Both cases still show this season's week 18.
  const isPostseasonWindow = month === 0 || (month === 1 && now.getUTCDate() <= 15);
  return { season, week: 18, seasonType: isPostseasonWindow ? 'postseason' : 'offseason' };
}

interface CachedState {
  state: NflState;
  cachedAtMs: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: CachedState | null = null;

/** Test-only: clear the module-level cache so tests don't bleed into each other. */
export function clearNflStateCache(): void {
  cache = null;
}

/**
 * Resolve the current NFL state (season/week/phase) that the app should
 * default views to. Tries, in order: real schedule rows in the DB, ESPN's
 * own notion of the current week, then a deterministic calendar fallback.
 * Never throws — a resolver failure just falls through to the next one.
 */
export async function getNflState(db: DB, now: Date = new Date()): Promise<NflState> {
  if (cache && now.getTime() - cache.cachedAtMs < CACHE_TTL_MS) {
    return cache.state;
  }

  const ctx = getNflSeasonContext();
  const calendarFallback = resolveWeekFromCalendar(now);

  let state: NflState;

  if (ctx.seasontype === '1') {
    // Calendar says preseason — regular season hasn't started, nothing to
    // reason about from schedule/ESPN yet.
    state = { season: ctx.season, week: 1, seasonType: 'preseason', source: 'calendar', resolvedAt: now.toISOString() };
  } else if (ctx.seasontype !== '2') {
    // Offseason or postseason (context reports '3' for postseason, or we
    // fall through to the previous season's regular-season data otherwise):
    // show the previous season's final week, matching existing behaviour.
    state = {
      season: calendarFallback.season,
      week: 18,
      seasonType: calendarFallback.seasonType === 'postseason' ? 'postseason' : 'offseason',
      source: 'calendar',
      resolvedAt: now.toISOString(),
    };
  } else {
    // Regular season: try real schedule rows first.
    let resolvedWeek: number | null = null;
    let source: NflState['source'] = 'calendar';

    try {
      const rows = await db.query.nflGames.findMany({
        where: and(eq(schema.nflGames.seasonYear, ctx.season), eq(schema.nflGames.seasonType, 'regular')),
        columns: { week: true, gameTime: true, isComplete: true, homeScore: true, awayScore: true },
      });
      const fromSchedule = resolveWeekFromSchedule(rows, now);
      // If every stored game is already finished but the table stops short
      // of week 18, the schedule is only partially synced (e.g. a fresh
      // season where sync-games hasn't run for later weeks yet). Trusting
      // it would pin the app to the last synced week, so fall through to
      // ESPN / the calendar instead.
      const scheduleIsPartial =
        fromSchedule != null && fromSchedule < 18 && rows.every((g) => isGameFinished(g, now));
      if (fromSchedule != null && !scheduleIsPartial) {
        resolvedWeek = fromSchedule;
        source = 'schedule';
      }
    } catch (err) {
      console.warn('[nflState] schedule lookup failed:', err instanceof Error ? err.message : err);
    }

    if (resolvedWeek == null) {
      try {
        const espnWeek = await fetchEspnCurrentWeek(ctx.season, ctx.seasontype);
        if (espnWeek != null) {
          resolvedWeek = espnWeek;
          source = 'espn';
        }
      } catch (err) {
        console.warn('[nflState] ESPN current-week lookup failed:', err instanceof Error ? err.message : err);
      }
    }

    if (resolvedWeek == null) {
      resolvedWeek = calendarFallback.week;
      source = 'calendar';
    }

    const clampedWeek = Math.min(18, Math.max(1, resolvedWeek));
    state = { season: ctx.season, week: clampedWeek, seasonType: 'regular', source, resolvedAt: now.toISOString() };
  }

  cache = { state, cachedAtMs: now.getTime() };
  return state;
}
