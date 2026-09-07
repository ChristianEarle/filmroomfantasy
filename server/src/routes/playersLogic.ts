/**
 * Pure helpers extracted from routes/players.ts GET / so they can be unit
 * tested without a D1 database. Behavior must stay byte-for-byte identical
 * to the inline logic that used to live in the route handler — see the call
 * sites in players.ts for how these are wired back in.
 */

export interface GameForWeek {
  isComplete?: boolean | null;
  homeScore?: number | null;
  awayScore?: number | null;
}

export interface ResolveWeekCompleteArgs {
  /** Games rows for the requested week/season (may be empty). */
  gamesForWeek: GameForWeek[];
  /** Whether the caller requested stats (`includeStats=true`). */
  includeStats: boolean;
  /**
   * Whether at least one playerWeeklyStats row exists for this week/season.
   * Only consulted when the games-based check didn't already resolve to
   * complete and `includeStats` is true (mirrors the original short-circuit
   * so callers can skip the DB query entirely otherwise).
   */
  hasAnyStat: boolean;
  /** Injectable clock for the offseason fallback — defaults to `new Date()`. */
  now?: Date;
}

/**
 * Reproduces the weekComplete resolution previously inlined in
 * routes/players.ts (~lines 196-230):
 *
 *  1. Complete if every known game for the week is complete (or has both
 *     final scores).
 *  2. Otherwise, complete if `includeStats` and we already know a stat row
 *     exists for the week (Sleeper only has stats for completed weeks).
 *  3. Otherwise, complete if there are NO game records at all for the
 *     week/season AND the current calendar month falls in the Feb-Jul
 *     offseason window (getMonth() 1..6). August (7) is deliberately
 *     excluded — that's the *preseason* window for the upcoming season in
 *     getNflSeasonContext() (see services/espn.ts), not offseason, so
 *     treating it as offseason here would misreport Week 1 as "complete"
 *     before games are synced.
 */
export function resolveWeekComplete({
  gamesForWeek,
  includeStats,
  hasAnyStat,
  now = new Date(),
}: ResolveWeekCompleteArgs): boolean {
  let weekComplete =
    gamesForWeek.length > 0 &&
    gamesForWeek.every((g) => g.isComplete || (g.homeScore != null && g.awayScore != null));

  if (!weekComplete && includeStats && hasAnyStat) {
    weekComplete = true;
  }

  if (!weekComplete && gamesForWeek.length === 0) {
    const currentMonth = now.getMonth(); // 0=Jan, 1=Feb, ... 6=Jul
    if (currentMonth >= 1 && currentMonth <= 6) weekComplete = true;
  }

  return weekComplete;
}

export interface ComputeFetchWindowArgs {
  /** True when sorting by a computed field (projectedPoints/avgPointsPPR). */
  sortByComputed: boolean;
  includeStats: boolean;
  availableOnly: boolean;
  leagueId?: string | null;
  limit: number;
  offset: number;
  /** Total rows matching the current filters (pre-computed count query). */
  total: number;
}

export interface FetchWindow {
  fetchLimit: number;
  fetchOffset: number;
}

/**
 * Reproduces the fetchLimit/fetchOffset sizing previously inlined in
 * routes/players.ts (~lines 434-448).
 *
 * When sorting by a computed field (projectedPoints/avgPointsPPR) with
 * includeStats, the FULL matching pool must be fetched (limit = total,
 * offset = 0) before in-memory sorting — a name-ordered, limited fetch would
 * silently drop late-alphabet players from ranking consideration regardless
 * of their actual projection.
 *
 * When availableOnly, fetch extra (up to 3x, floor 500) to compensate for
 * rostered players that get filtered out post-fetch.
 */
export interface PosRankRow {
  playerId: string;
  position: string | null;
}

/**
 * Ranks each row within its own position (1-based, in the order given), used
 * by GET /players/recent-leaders to label a player "RB3" etc.
 *
 * Callers must pass the FULL ppg-sorted window aggregate, not a slice already
 * truncated to the response's `limit` — ranking against a pre-truncated slice
 * mislabels players (e.g. the only RB inside a top-25-overall cut showing as
 * "RB1" even though several other RBs outscored them that week but didn't
 * crack the top 25 overall).
 */
export function computePosRanks(rows: PosRankRow[]): Map<string, number> {
  const posCounter = new Map<string, number>();
  const posRankByPlayer = new Map<string, number>();
  for (const row of rows) {
    const posKey = row.position || 'NA';
    const nextRank = (posCounter.get(posKey) ?? 0) + 1;
    posCounter.set(posKey, nextRank);
    posRankByPlayer.set(row.playerId, nextRank);
  }
  return posRankByPlayer;
}

export function computeFetchWindow({
  sortByComputed,
  includeStats,
  availableOnly,
  leagueId,
  limit,
  offset,
  total,
}: ComputeFetchWindowArgs): FetchWindow {
  const availableMultiplier = availableOnly && leagueId ? 3 : 1;
  const fetchLimit =
    sortByComputed && includeStats
      ? total
      : availableOnly
        ? Math.max((limit + offset) * availableMultiplier, 500)
        : limit + offset;
  const fetchOffset = (sortByComputed && includeStats) || availableOnly ? 0 : offset;
  return { fetchLimit, fetchOffset };
}
