/**
 * Monte Carlo playoff odds for the Playoff Predictor.
 *
 * Mirrors the League Analyzer's server-side simulation
 * (server/src/routes/leagueAnalyzer.ts: filterRemainingMatchups +
 * runMonteCarlo) so the two pages agree: win probability per game is
 * ppg1 / (ppg1 + ppg2) clamped to [0.15, 0.85], the top N by wins (points-for
 * tiebreak) make the playoffs, and only regular-season games count.
 *
 * The previous in-component version guessed the season length from the
 * data: with 3 games played and 11 left it concluded the "remaining" games
 * were bad data, and because every team had played the same number of games
 * it declared the season over — every team showed 100% or 0% straight from
 * the current standings. It also counted the playoff bracket weeks as
 * regular-season games.
 */

export const WIN_PROB_FLOOR = 0.15;
export const WIN_PROB_CEILING = 0.85;
export const DEFAULT_NUM_SIMULATIONS = 10_000;

export interface StandingInput {
  teamId: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
}

export interface ScheduleMatchup {
  id: string;
  week: number;
  team1Id: string;
  team2Id: string;
  isComplete?: boolean;
  isPlayoff?: boolean;
}

export interface MonteCarloResult {
  /** 0-100 */
  playoffPct: number;
  /** Average final regular-season wins across simulations. */
  avgProjectedWins: number;
}

/** Regular-season length: the number of distinct non-playoff weeks in the schedule. */
export function regularSeasonLength(schedule: ScheduleMatchup[]): number {
  return new Set(schedule.filter((m) => !m.isPlayoff).map((m) => m.week)).size;
}

/**
 * The regular-season games still to play, capped per team at
 * (season length − games already played). The cap guards against a sync that
 * never flagged finished games complete; it never drops legitimate games
 * because a team's real remaining games always fit inside it.
 */
export function remainingRegularSeasonGames(
  standings: StandingInput[],
  schedule: ScheduleMatchup[],
): ScheduleMatchup[] {
  const seasonLength = regularSeasonLength(schedule);
  const unplayed = schedule
    .filter((m) => !m.isComplete && !m.isPlayoff)
    .sort((a, b) => a.week - b.week);
  if (seasonLength <= 0) return unplayed;

  const cap = new Map<string, number>();
  for (const s of standings) cap.set(s.teamId, Math.max(0, seasonLength - (s.wins + s.losses + s.ties)));
  const used = new Map<string, number>();
  return unplayed.filter((m) => {
    const ok1 = (used.get(m.team1Id) || 0) < (cap.get(m.team1Id) ?? Infinity);
    const ok2 = (used.get(m.team2Id) || 0) < (cap.get(m.team2Id) ?? Infinity);
    if (!ok1 || !ok2) return false;
    used.set(m.team1Id, (used.get(m.team1Id) || 0) + 1);
    used.set(m.team2Id, (used.get(m.team2Id) || 0) + 1);
    return true;
  });
}

/** Points per game per team; teams with no games get the league average. */
export function teamPointsPerGame(standings: StandingInput[]): { ppg: Map<string, number>; leagueAvg: number } {
  const ppg = new Map<string, number>();
  let total = 0;
  let n = 0;
  for (const s of standings) {
    const gp = s.wins + s.losses + s.ties;
    if (gp > 0) {
      const v = s.pointsFor / gp;
      ppg.set(s.teamId, v);
      total += v;
      n++;
    }
  }
  const leagueAvg = n > 0 ? total / n : 100;
  for (const s of standings) if (!ppg.has(s.teamId)) ppg.set(s.teamId, leagueAvg);
  return { ppg, leagueAvg };
}

/** Probability team 1 beats team 2 under the shared model. */
export function winProbability(ppg1: number, ppg2: number): number {
  const raw = ppg1 + ppg2 > 0 ? ppg1 / (ppg1 + ppg2) : 0.5;
  return Math.min(WIN_PROB_CEILING, Math.max(WIN_PROB_FLOOR, raw));
}

/**
 * Simulate the rest of the regular season `numSims` times. `remaining` should
 * come from remainingRegularSeasonGames(). `random` is injectable for tests.
 */
export function runPlayoffSimulation(
  standings: StandingInput[],
  remaining: ScheduleMatchup[],
  playoffSpots: number,
  numSims = DEFAULT_NUM_SIMULATIONS,
  random: () => number = Math.random,
): Map<string, MonteCarloResult> {
  const results = new Map<string, MonteCarloResult>();
  if (standings.length === 0) return results;

  // No games left: the standings are final.
  if (remaining.length === 0) {
    const sorted = [...standings].sort((a, b) => (b.wins !== a.wins ? b.wins - a.wins : b.pointsFor - a.pointsFor));
    sorted.forEach((s, i) => results.set(s.teamId, { playoffPct: i < playoffSpots ? 100 : 0, avgProjectedWins: s.wins }));
    return results;
  }

  const { ppg, leagueAvg } = teamPointsPerGame(standings);
  const games = remaining.map((m) => ({
    team1Id: m.team1Id,
    team2Id: m.team2Id,
    p1: winProbability(ppg.get(m.team1Id) ?? leagueAvg, ppg.get(m.team2Id) ?? leagueAvg),
  }));

  const playoffCount: Record<string, number> = {};
  const totalWins: Record<string, number> = {};
  for (const s of standings) {
    playoffCount[s.teamId] = 0;
    totalWins[s.teamId] = 0;
  }

  for (let sim = 0; sim < numSims; sim++) {
    const wins: Record<string, number> = {};
    for (const s of standings) wins[s.teamId] = s.wins;
    for (const g of games) {
      if (random() < g.p1) wins[g.team1Id] = (wins[g.team1Id] ?? 0) + 1;
      else wins[g.team2Id] = (wins[g.team2Id] ?? 0) + 1;
    }
    const order = standings
      .map((s) => ({ id: s.teamId, w: wins[s.teamId], pf: s.pointsFor }))
      .sort((a, b) => (b.w !== a.w ? b.w - a.w : b.pf - a.pf));
    for (let i = 0; i < order.length; i++) {
      if (i < playoffSpots) playoffCount[order[i].id]++;
      totalWins[order[i].id] += order[i].w;
    }
  }

  for (const s of standings) {
    results.set(s.teamId, {
      playoffPct: Math.round((playoffCount[s.teamId] / numSims) * 100),
      avgProjectedWins: totalWins[s.teamId] / numSims,
    });
  }
  return results;
}
