/**
 * Derive each team's bye week from the regular-season schedule.
 *
 * Sleeper's player feed has no bye week, so `nfl_players.bye_week` was
 * never written and every roster/trade view that reads it showed nothing.
 * The schedule already in `nfl_games` is enough: a team plays 17 of the 18
 * regular-season weeks, and the one it sits out is its bye.
 *
 * A bye is only reported for a team whose stored schedule is complete
 * (17 games, exactly one missing week). A partial schedule (only some
 * weeks synced yet) would otherwise turn every unsynced week into a bye.
 */
export interface ScheduledGame {
  week: number;
  homeTeam: string;
  awayTeam: string;
}

export const REGULAR_SEASON_WEEKS = 18;
export const GAMES_PER_TEAM = 17;

/** ESPN abbreviations that differ from the Sleeper codes used on nfl_players. */
const ESPN_TO_SLEEPER: Record<string, string> = { WSH: 'WAS' };

export function toSleeperTeamCode(abbrev: string): string {
  const upper = abbrev.toUpperCase();
  return ESPN_TO_SLEEPER[upper] ?? upper;
}

export function computeByeWeeks(games: readonly ScheduledGame[]): Map<string, number> {
  const weeksByTeam = new Map<string, Set<number>>();
  for (const game of games) {
    if (game.week < 1 || game.week > REGULAR_SEASON_WEEKS) continue;
    for (const raw of [game.homeTeam, game.awayTeam]) {
      if (!raw) continue;
      const team = toSleeperTeamCode(raw);
      let weeks = weeksByTeam.get(team);
      if (!weeks) {
        weeks = new Set();
        weeksByTeam.set(team, weeks);
      }
      weeks.add(game.week);
    }
  }

  const byes = new Map<string, number>();
  for (const [team, weeks] of weeksByTeam) {
    if (weeks.size !== GAMES_PER_TEAM) continue;
    const missing: number[] = [];
    for (let week = 1; week <= REGULAR_SEASON_WEEKS; week++) {
      if (!weeks.has(week)) missing.push(week);
    }
    if (missing.length === 1) byes.set(team, missing[0]);
  }
  return byes;
}
