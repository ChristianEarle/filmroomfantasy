/**
 * Pure scheduling + budget rules for The Odds API player-prop syncs.
 *
 * Every props fetch costs one credit per market per region (7 credits per
 * game with the markets the projection model needs), so the cron must spend
 * them on purpose rather than on a timer:
 *
 *   - Never fetch a game that has already kicked off — the lines are gone
 *     and actual results come from the stats sync.
 *   - A game with no props stored yet is fetched as soon as it appears.
 *   - Before the pre-kickoff window, a game is refreshed once a day at most.
 *   - Inside the pre-kickoff window, it is refreshed once more so the last
 *     line movement (injury news, weather) is captured, but not on every
 *     4-hour tick.
 *   - Below a credit reserve the sync stops spending entirely so a runaway
 *     loop or a backfill can never zero the account.
 *
 * Kept free of I/O so the policy can be unit tested with fixed clocks.
 */

/** Normal refresh cadence, before a game enters its pre-kickoff window. */
export const PROPS_REFRESH_HOURS = 24;
/** How long before kickoff a game counts as "about to start". */
export const PROPS_PRE_KICKOFF_WINDOW_HOURS = 8;
/** Inside that window, refresh only if the last snapshot is at least this old. */
export const PROPS_PRE_KICKOFF_REFRESH_HOURS = 6;
/** Credits to leave untouched unless ODDS_API_CREDIT_RESERVE overrides it. */
export const DEFAULT_ODDS_API_CREDIT_RESERVE = 1000;

const HOUR_MS = 60 * 60 * 1000;

export type PropsFetchDecision = 'fetch' | 'skip_kicked_off' | 'skip_fresh';

export interface PropsFetchInput {
  now: Date;
  /** Scheduled kickoff. Null when the schedule row has no time; treated as "not yet kicked off". */
  kickoff: Date | null;
  /** Most recent stored snapshot for this game, or null when nothing is stored. */
  lastSnapshotAt: Date | null;
}

export function decidePropsFetch({ now, kickoff, lastSnapshotAt }: PropsFetchInput): PropsFetchDecision {
  if (kickoff && kickoff.getTime() <= now.getTime()) return 'skip_kicked_off';
  if (!lastSnapshotAt) return 'fetch';

  const ageMs = now.getTime() - lastSnapshotAt.getTime();
  const hoursToKickoff = kickoff ? (kickoff.getTime() - now.getTime()) / HOUR_MS : Infinity;
  const inPreKickoffWindow = hoursToKickoff <= PROPS_PRE_KICKOFF_WINDOW_HOURS;
  const minAgeMs = (inPreKickoffWindow ? PROPS_PRE_KICKOFF_REFRESH_HOURS : PROPS_REFRESH_HOURS) * HOUR_MS;

  return ageMs >= minAgeMs ? 'fetch' : 'skip_fresh';
}

/** Parse the ODDS_API_CREDIT_RESERVE env var; anything unusable falls back to the default. */
export function parseCreditReserve(raw: string | undefined | null): number {
  if (raw == null || raw.trim() === '') return DEFAULT_ODDS_API_CREDIT_RESERVE;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_ODDS_API_CREDIT_RESERVE;
  return Math.floor(n);
}

/**
 * True when spending should stop. An unknown balance (no response seen yet
 * this isolate) never blocks — the first fetch reveals it and later checks
 * use the real number.
 */
export function isBelowReserve(remaining: number | null, reserve: number): boolean {
  return remaining != null && remaining <= reserve;
}
