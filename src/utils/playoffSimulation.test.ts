import { describe, expect, it } from 'vitest';
import {
  regularSeasonLength,
  remainingRegularSeasonGames,
  runPlayoffSimulation,
  winProbability,
  type ScheduleMatchup,
  type StandingInput,
} from './playoffSimulation';

/**
 * A 10-team league, 14-week regular season plus 3 playoff weeks, after 3
 * played weeks — the shape of Skeetsters on 2026-10-02, where the old
 * predictor showed every team at 100% or 0%.
 */
function earlySeasonLeague() {
  const ids = Array.from({ length: 10 }, (_, i) => `t${i}`);
  const standings: StandingInput[] = ids.map((teamId, i) => ({
    teamId,
    wins: i < 5 ? 2 : 1,
    losses: i < 5 ? 1 : 2,
    ties: 0,
    pointsFor: 360 + i * 10,
  }));
  const schedule: ScheduleMatchup[] = [];
  for (let week = 1; week <= 17; week++) {
    const shift = week % 9;
    for (let k = 0; k < 5; k++) {
      const a = ids[k];
      const b = ids[5 + ((k + shift) % 5)];
      schedule.push({ id: `${week}-${k}`, week, team1Id: a, team2Id: b, isComplete: week <= 3, isPlayoff: week >= 15 });
    }
  }
  return { standings, schedule };
}

describe('remainingRegularSeasonGames', () => {
  it('keeps the whole remaining regular season and drops the playoff bracket', () => {
    const { standings, schedule } = earlySeasonLeague();
    expect(regularSeasonLength(schedule)).toBe(14);
    const remaining = remainingRegularSeasonGames(standings, schedule);
    expect(remaining).toHaveLength(11 * 5);
    expect(remaining.every((m) => m.week >= 4 && m.week <= 14)).toBe(true);
  });

  it('caps a team at the games it has left when finished games were never flagged complete', () => {
    const standings: StandingInput[] = [
      { teamId: 'a', wins: 2, losses: 0, ties: 0, pointsFor: 200 },
      { teamId: 'b', wins: 0, losses: 2, ties: 0, pointsFor: 180 },
    ];
    // 3-week season, both teams have played 2, but all 3 weeks are still flagged incomplete.
    const schedule: ScheduleMatchup[] = [1, 2, 3].map((week) => ({ id: `${week}`, week, team1Id: 'a', team2Id: 'b', isComplete: false }));
    expect(remainingRegularSeasonGames(standings, schedule).map((m) => m.week)).toEqual([1]);
  });
});

describe('runPlayoffSimulation', () => {
  it('produces real probabilities early in the season, not 100% / 0%', () => {
    const { standings, schedule } = earlySeasonLeague();
    const remaining = remainingRegularSeasonGames(standings, schedule);
    const odds = runPlayoffSimulation(standings, remaining, 6, 4000);
    const pcts = [...odds.values()].map((o) => o.playoffPct);
    expect(pcts.some((p) => p > 0 && p < 100)).toBe(true);
    expect(pcts.filter((p) => p === 0 || p === 100).length).toBeLessThan(pcts.length);
    // Six playoff spots: the odds sum to about 600.
    expect(pcts.reduce((s, p) => s + p, 0)).toBeGreaterThan(590);
    expect(pcts.reduce((s, p) => s + p, 0)).toBeLessThan(610);
    // Projected wins add the 11 remaining games: total wins = played wins + 55.
    const totalWins = [...odds.values()].reduce((s, o) => s + o.avgProjectedWins, 0);
    expect(totalWins).toBeCloseTo(15 + 55, 5);
  });

  it('treats a finished regular season as final standings', () => {
    const standings: StandingInput[] = [
      { teamId: 'a', wins: 10, losses: 4, ties: 0, pointsFor: 1700 },
      { teamId: 'b', wins: 10, losses: 4, ties: 0, pointsFor: 1800 },
      { teamId: 'c', wins: 4, losses: 10, ties: 0, pointsFor: 1500 },
    ];
    const odds = runPlayoffSimulation(standings, [], 2);
    expect(odds.get('b')?.playoffPct).toBe(100);
    expect(odds.get('a')?.playoffPct).toBe(100);
    expect(odds.get('c')?.playoffPct).toBe(0);
  });

  it('is deterministic with an injected random source', () => {
    const { standings, schedule } = earlySeasonLeague();
    const remaining = remainingRegularSeasonGames(standings, schedule);
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const a = runPlayoffSimulation(standings, remaining, 6, 500, rng);
    seed = 1;
    const b = runPlayoffSimulation(standings, remaining, 6, 500, rng);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });
});

describe('winProbability', () => {
  it('uses the points-per-game ratio clamped to 15–85%', () => {
    expect(winProbability(120, 120)).toBe(0.5);
    expect(winProbability(150, 120)).toBeCloseTo(150 / 270, 10);
    expect(winProbability(500, 10)).toBe(0.85);
    expect(winProbability(10, 500)).toBe(0.15);
  });
});
