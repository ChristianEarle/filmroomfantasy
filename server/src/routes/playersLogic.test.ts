import { describe, it, expect } from 'vitest';
import { resolveWeekComplete, computeFetchWindow, computePosRanks } from './playersLogic';

describe('resolveWeekComplete', () => {
  it('is complete when every game is isComplete=true, or lacks isComplete but has both final scores', () => {
    expect(resolveWeekComplete({
      gamesForWeek: [{ isComplete: true }, { isComplete: true }],
      includeStats: false,
      hasAnyStat: false,
    })).toBe(true);

    expect(resolveWeekComplete({
      gamesForWeek: [{ isComplete: false, homeScore: 24, awayScore: 17 }],
      includeStats: false,
      hasAnyStat: false,
    })).toBe(true);
  });

  it('is not complete when any game is still in progress and no stats fallback applies', () => {
    const result = resolveWeekComplete({
      gamesForWeek: [{ isComplete: true }, { isComplete: false, homeScore: null, awayScore: null }],
      includeStats: false,
      hasAnyStat: false,
    });
    expect(result).toBe(false);
  });

  it('falls back to complete when includeStats and a stat row already exists for the week', () => {
    const result = resolveWeekComplete({
      gamesForWeek: [{ isComplete: false, homeScore: null, awayScore: null }],
      includeStats: true,
      hasAnyStat: true,
    });
    expect(result).toBe(true);
  });

  it('offseason fallback: no games at all AND current month is Feb-Jul -> complete', () => {
    const result = resolveWeekComplete({
      gamesForWeek: [],
      includeStats: false,
      hasAnyStat: false,
      now: new Date(2026, 3, 15), // April
    });
    expect(result).toBe(true);
  });

  it('Aug 31 with no games -> weekComplete false (August is preseason, not offseason)', () => {
    const result = resolveWeekComplete({
      gamesForWeek: [],
      includeStats: false,
      hasAnyStat: false,
      now: new Date(2026, 7, 31), // Aug 31
    });
    expect(result).toBe(false);
  });

  it('does not apply the offseason fallback when real (even incomplete) games were found', () => {
    const result = resolveWeekComplete({
      gamesForWeek: [{ isComplete: false, homeScore: null, awayScore: null }],
      includeStats: false,
      hasAnyStat: false,
      now: new Date(2026, 3, 15), // April, but games exist -> trust games over calendar
    });
    expect(result).toBe(false);
  });
});

describe('computeFetchWindow', () => {
  it('total=4703 with computed sort + includeStats -> fetchLimit is the full total, offset 0', () => {
    const { fetchLimit, fetchOffset } = computeFetchWindow({
      sortByComputed: true,
      includeStats: true,
      availableOnly: false,
      leagueId: null,
      limit: 50,
      offset: 100,
      total: 4703,
    });
    expect(fetchLimit).toBe(4703);
    expect(fetchOffset).toBe(0);
  });

  it('computed sort without includeStats behaves like the normal paginated fetch', () => {
    const { fetchLimit, fetchOffset } = computeFetchWindow({
      sortByComputed: true,
      includeStats: false,
      availableOnly: false,
      leagueId: null,
      limit: 50,
      offset: 100,
      total: 4703,
    });
    expect(fetchLimit).toBe(150);
    expect(fetchOffset).toBe(100);
  });

  it('availableOnly with a leagueId fetches 3x(limit+offset), floored at 500, offset reset to 0', () => {
    const { fetchLimit, fetchOffset } = computeFetchWindow({
      sortByComputed: false,
      includeStats: false,
      availableOnly: true,
      leagueId: 'league-1',
      limit: 50,
      offset: 50,
      total: 4703,
    });
    // (50+50)*3 = 300, floored up to 500
    expect(fetchLimit).toBe(500);
    expect(fetchOffset).toBe(0);
  });

  it('plain paginated fetch (no computed sort, not availableOnly) uses limit+offset', () => {
    const { fetchLimit, fetchOffset } = computeFetchWindow({
      sortByComputed: false,
      includeStats: false,
      availableOnly: false,
      leagueId: null,
      limit: 50,
      offset: 200,
      total: 4703,
    });
    expect(fetchLimit).toBe(250);
    expect(fetchOffset).toBe(200);
  });
});

describe('computePosRanks', () => {
  it('ranks each position independently, 1-based, in the order given', () => {
    const ranks = computePosRanks([
      { playerId: 'wr-1', position: 'WR' },
      { playerId: 'rb-1', position: 'RB' },
      { playerId: 'wr-2', position: 'WR' },
      { playerId: 'rb-2', position: 'RB' },
      { playerId: 'wr-3', position: 'WR' },
    ]);
    expect(ranks.get('wr-1')).toBe(1);
    expect(ranks.get('wr-2')).toBe(2);
    expect(ranks.get('wr-3')).toBe(3);
    expect(ranks.get('rb-1')).toBe(1);
    expect(ranks.get('rb-2')).toBe(2);
  });

  it('ranks against the FULL set, not a slice already truncated to the response limit', () => {
    // Regression case: an RB1 (best PPG among RBs, but 26th overall) must still rank
    // above an RB2 even though a top-25-overall slice would have dropped RB1 entirely
    // and left RB2 as the only RB row — mislabeling it "RB1".
    const fullWindow = [
      { playerId: 'wr-1', position: 'WR' },
      { playerId: 'rb-1', position: 'RB' }, // best RB by ppg, ranked ahead of rb-2
      { playerId: 'wr-2', position: 'WR' },
      { playerId: 'rb-2', position: 'RB' },
    ];
    const ranks = computePosRanks(fullWindow);
    expect(ranks.get('rb-1')).toBe(1);
    expect(ranks.get('rb-2')).toBe(2);
  });

  it('treats a null/missing position as its own "NA" bucket rather than throwing', () => {
    const ranks = computePosRanks([
      { playerId: 'p1', position: null },
      { playerId: 'p2', position: null },
    ]);
    expect(ranks.get('p1')).toBe(1);
    expect(ranks.get('p2')).toBe(2);
  });

  it('returns an empty map for an empty input', () => {
    expect(computePosRanks([]).size).toBe(0);
  });
});
