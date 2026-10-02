import { describe, expect, it } from 'vitest';
import { computeAllPlay, currentStreak, lineupOrder, slotGroup, stdDev, weeklyResultsFor, type ScoredMatchup } from './leagueAnalyzer';

describe('lineupOrder', () => {
  it('orders starters QB, RB, WR, TE, FLEX, SUPERFLEX, K, DEF with numbered slots in sequence', () => {
    const slots: Array<[string, string]> = [
      ['DEF', 'DEF'], ['K', 'K'], ['SUPER_FLEX', 'QB'], ['FLEX2', 'WR'], ['FLEX1', 'RB'], ['TE', 'TE'],
      ['WR2', 'WR'], ['WR1', 'WR'], ['RB2', 'RB'], ['RB1', 'RB'], ['QB', 'QB'],
    ];
    const sorted = [...slots].sort((a, b) => {
      const [ga, na] = lineupOrder(a[0], a[1]);
      const [gb, nb] = lineupOrder(b[0], b[1]);
      return ga !== gb ? ga - gb : na - nb;
    });
    expect(sorted.map((s) => s[0])).toEqual(['QB', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX1', 'FLEX2', 'SUPER_FLEX', 'K', 'DEF']);
  });

  it('maps ESPN’s OP and RB/WR, WR/TE slots', () => {
    expect(slotGroup('OP', 'QB')).toBe('SFLEX');
    expect(slotGroup('RB/WR', 'RB')).toBe('FLEX');
    expect(slotGroup('WR/TE', 'TE')).toBe('FLEX');
  });
});

describe('slotGroup', () => {
  it('groups numbered Sleeper slots by the slot, not the player', () => {
    expect(slotGroup('RB2', 'RB')).toBe('RB');
    expect(slotGroup('WR3', 'WR')).toBe('WR');
    expect(slotGroup('QB', 'QB')).toBe('QB');
    expect(slotGroup('TE1', 'TE')).toBe('TE');
    expect(slotGroup('K', 'K')).toBe('K');
    expect(slotGroup('DEF', 'DEF')).toBe('DEF');
  });

  it('puts every regular flex slot in FLEX, whoever fills it', () => {
    expect(slotGroup('FLEX', 'RB')).toBe('FLEX');
    expect(slotGroup('FLEX2', 'WR')).toBe('FLEX');
    expect(slotGroup('REC_FLEX', 'TE')).toBe('FLEX');
    expect(slotGroup('WRRB_FLEX1', 'RB')).toBe('FLEX');
    expect(slotGroup('W/R/T', 'WR')).toBe('FLEX'); // Yahoo
  });

  it('keeps superflex apart', () => {
    expect(slotGroup('SUPER_FLEX', 'QB')).toBe('SFLEX');
    expect(slotGroup('SUPER_FLEX1', 'WR')).toBe('SFLEX');
    expect(slotGroup('Q/W/R/T', 'QB')).toBe('SFLEX'); // Yahoo
  });

  it('skips IDP slots and falls back to the natural position for unknown labels', () => {
    expect(slotGroup('IDP_FLEX1', 'LB')).toBeNull();
    expect(slotGroup('DL2', 'DL')).toBeNull();
    expect(slotGroup('LB', 'LB')).toBeNull();
    expect(slotGroup('S1', 'WR')).toBe('WR');
    expect(slotGroup(null, 'TE')).toBe('TE');
    expect(slotGroup('D/ST', 'DEF')).toBe('DEF');
    expect(slotGroup('weird', 'LB')).toBeNull();
  });
});

const m = (week: number, home: string, away: string, hs: number | null, as: number | null, opts: Partial<ScoredMatchup> = {}): ScoredMatchup => ({
  week, homeTeamId: home, awayTeamId: away, homeScore: hs, awayScore: as, isComplete: true, isPlayoff: false, ...opts,
});

describe('computeAllPlay', () => {
  it('scores each team against every other score that week', () => {
    const matchups = [
      m(1, 'a', 'b', 120, 100),
      m(1, 'c', 'd', 110, 90),
      // Week 2: a ties c for the top score.
      m(2, 'a', 'c', 130, 130),
      m(2, 'b', 'd', 80, 70),
    ];
    const ap = computeAllPlay(matchups, ['a', 'b', 'c', 'd']);
    expect(ap.get('a')).toEqual({ wins: 5, losses: 0, ties: 1, winPct: 5.5 / 6 });
    expect(ap.get('b')).toEqual({ wins: 2, losses: 4, ties: 0, winPct: 2 / 6 });
    expect(ap.get('d')).toEqual({ wins: 0, losses: 6, ties: 0, winPct: 0 });
  });

  it('ignores incomplete, unscored and playoff games', () => {
    const ap = computeAllPlay([
      m(1, 'a', 'b', 120, 100, { isComplete: false }),
      m(2, 'a', 'b', null, null),
      m(15, 'a', 'b', 120, 100, { isPlayoff: true }),
    ], ['a', 'b']);
    expect(ap.get('a')).toEqual({ wins: 0, losses: 0, ties: 0, winPct: null });
  });
});

describe('weekly results, streak and consistency', () => {
  const matchups = [
    m(3, 'a', 'b', 90, 100),
    m(1, 'b', 'a', 100, 110),
    m(2, 'a', 'c', 120, 100),
    m(4, 'c', 'b', 95, 99),
  ];

  it('lists a team’s results oldest first from its own side', () => {
    const r = weeklyResultsFor('a', matchups);
    expect(r.map((x) => `${x.week}${x.result}${x.score}-${x.opponentScore}`)).toEqual(['1W110-100', '2W120-100', '3L90-100']);
  });

  it('reports the current streak', () => {
    expect(currentStreak(weeklyResultsFor('a', matchups))).toBe('L1');
    expect(currentStreak(weeklyResultsFor('b', matchups))).toBe('W2');
    expect(currentStreak([])).toBeNull();
  });

  it('computes the population standard deviation', () => {
    expect(stdDev([100, 120])).toBe(10);
    expect(stdDev([100])).toBeNull();
  });
});
