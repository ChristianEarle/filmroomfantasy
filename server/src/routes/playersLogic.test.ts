import { describe, it, expect } from 'vitest';
import { resolveWeekComplete, computeFetchWindow } from './playersLogic';

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
