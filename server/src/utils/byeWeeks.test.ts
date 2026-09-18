import { describe, expect, it } from 'vitest';
import { computeByeWeeks, toSleeperTeamCode, type ScheduledGame } from './byeWeeks';

/** A full 18-week slate for `team` that skips `bye`, against a rotating opponent. */
function fullSchedule(team: string, bye: number): ScheduledGame[] {
  const games: ScheduledGame[] = [];
  for (let week = 1; week <= 18; week++) {
    if (week === bye) continue;
    games.push({ week, homeTeam: week % 2 ? team : `OPP${week}`, awayTeam: week % 2 ? `OPP${week}` : team });
  }
  return games;
}

describe('computeByeWeeks', () => {
  it('reports the one week a team with a complete schedule does not play', () => {
    const byes = computeByeWeeks([...fullSchedule('KC', 6), ...fullSchedule('BUF', 12)]);
    expect(byes.get('KC')).toBe(6);
    expect(byes.get('BUF')).toBe(12);
  });

  it('does not invent byes from a partial schedule', () => {
    // Only weeks 1-4 synced so far: every team is missing 14 weeks.
    const partial = fullSchedule('KC', 6).filter((g) => g.week <= 4);
    expect(computeByeWeeks(partial).has('KC')).toBe(false);
    // Rotating opponents each appear in a single game.
    expect(computeByeWeeks(fullSchedule('KC', 6)).has('OPP1')).toBe(false);
  });

  it('ignores games outside the regular-season week range', () => {
    const games = [...fullSchedule('KC', 6), { week: 19, homeTeam: 'KC', awayTeam: 'BUF' }];
    expect(computeByeWeeks(games).get('KC')).toBe(6);
  });

  it('maps ESPN abbreviations to the Sleeper codes on nfl_players', () => {
    expect(toSleeperTeamCode('WSH')).toBe('WAS');
    expect(toSleeperTeamCode('kc')).toBe('KC');
    expect(computeByeWeeks(fullSchedule('WSH', 9)).get('WAS')).toBe(9);
  });
});
