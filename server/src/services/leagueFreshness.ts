/**
 * When is a league's platform data stale enough to re-sync on open?
 *
 * The 4-hour cron is the backstop, but a user opening the app should not
 * have to wait for it (or press Sync) to see waiver moves, trades and the
 * current week. So every league-scoped page load asks the server to sync
 * the league if its last sync is older than this — in season a few hours,
 * off season once a day since nothing moves.
 *
 * Pure so the thresholds can be unit tested with fixed clocks.
 */

export const LEAGUE_SYNC_STALE_HOURS_IN_SEASON = 6;
export const LEAGUE_SYNC_STALE_HOURS_OFF_SEASON = 24;

const HOUR_MS = 60 * 60 * 1000;

/** NFL regular/postseason months (Sep–Jan), UTC. */
export function isInSeasonMonth(date: Date = new Date()): boolean {
  const month = date.getUTCMonth() + 1; // 1-12
  return month >= 9 || month === 1;
}

export function leagueSyncStaleHours(now: Date = new Date()): number {
  return isInSeasonMonth(now) ? LEAGUE_SYNC_STALE_HOURS_IN_SEASON : LEAGUE_SYNC_STALE_HOURS_OFF_SEASON;
}

/** The instant before which a last-sync timestamp counts as stale. */
export function leagueSyncStaleCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - leagueSyncStaleHours(now) * HOUR_MS);
}

export function isLeagueSyncStale(lastSyncedAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!lastSyncedAt) return true;
  return lastSyncedAt.getTime() < leagueSyncStaleCutoff(now).getTime();
}
