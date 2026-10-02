/**
 * Sleeper's weekly stats and projections endpoints
 * (api.sleeper.com/{stats,projections}/nfl/{season}/{week}) have served two
 * payload shapes: an object keyed by Sleeper player id whose values are flat
 * stat lines, and (the 2026 season) an array of
 * `{ player_id, opponent, stats: { pts_ppr, pass_yd, ... } }` entries.
 *
 * Indexing the array shape by player id reads an unrelated entry for any id
 * below the array length, so every consumer must go through this function.
 */
export function sleeperWeeklyByPlayer(raw: unknown): Map<string, Record<string, any>> {
  const byPlayer = new Map<string, Record<string, any>>();

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const playerId = entry?.player_id;
      if (playerId == null || playerId === '') continue;
      byPlayer.set(String(playerId), { ...(entry.stats || {}), opponent: entry.opponent });
    }
  } else if (raw && typeof raw === 'object') {
    for (const [playerId, line] of Object.entries(raw as Record<string, any>)) {
      if (line && typeof line === 'object') byPlayer.set(playerId, line);
    }
  }

  return byPlayer;
}
