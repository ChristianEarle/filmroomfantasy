import { describe, it, expect } from 'vitest';
import { resolveWeekComplete, computeFetchWindow, shouldFallBackToPriorSeason, shouldReportActuals, propGameStatus, scoredAnytimeTd } from './playersLogic';

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

describe('shouldFallBackToPriorSeason', () => {
  it('no props this week, season has none at all -> falls back (offseason case)', () => {
    expect(shouldFallBackToPriorSeason({
      propsForRequestedWeek: false,
      seasonHasAnyProps: false,
    })).toBe(true);
  });

  it('no props this week, but season has props for other weeks -> does not fall back (not synced yet)', () => {
    expect(shouldFallBackToPriorSeason({
      propsForRequestedWeek: false,
      seasonHasAnyProps: true,
    })).toBe(false);
  });

  it('props found for the requested week -> never falls back', () => {
    expect(shouldFallBackToPriorSeason({
      propsForRequestedWeek: true,
      seasonHasAnyProps: true,
    })).toBe(false);
  });
});


describe('shouldReportActuals', () => {
  const now = new Date('2026-09-16T12:00:00Z'); // Wednesday of week 2
  const base = { now, week: 2, season: 2026, currentWeek: 2, currentSeason: 2026 };

  it('reports actuals once the team game for that week is finished', () => {
    const teamGame = { week: 2, gameTime: new Date('2026-09-13T17:00:00Z'), isComplete: true, homeScore: 24, awayScore: 17 };
    expect(shouldReportActuals({ ...base, teamGame })).toBe(true);
  });

  it('does not report actuals for a game that has not kicked off, even if a stats row exists', () => {
    const teamGame = { week: 2, gameTime: new Date('2026-09-20T17:00:00Z'), isComplete: false, homeScore: null, awayScore: null };
    expect(shouldReportActuals({ ...base, teamGame })).toBe(false);
  });

  it('without a schedule row, only reports actuals for weeks behind the live week', () => {
    expect(shouldReportActuals({ ...base, teamGame: null, week: 1 })).toBe(true);
    expect(shouldReportActuals({ ...base, teamGame: null, week: 2 })).toBe(false);
    expect(shouldReportActuals({ ...base, teamGame: null, week: 3 })).toBe(false);
  });

  it('without a schedule row, a past season is always settled and a future season never is', () => {
    expect(shouldReportActuals({ ...base, teamGame: null, season: 2025, week: 17 })).toBe(true);
    expect(shouldReportActuals({ ...base, teamGame: null, season: 2027, week: 1 })).toBe(false);
  });
});

describe('propGameStatus', () => {
  const played = { offSnaps: 61, tmOffSnaps: 64, targets: 9, receptions: 7 };

  it('is pending until the game finishes, whatever the stats say', () => {
    expect(propGameStatus({ gameFinished: false, stats: played, gameStatsSynced: true })).toBe('pending');
    expect(propGameStatus({ gameFinished: false, stats: null, gameStatsSynced: false })).toBe('pending');
  });

  it('grades a player who took part, including one with snaps but no touches', () => {
    expect(propGameStatus({ gameFinished: true, stats: played, gameStatsSynced: true })).toBe('played');
    expect(propGameStatus({ gameFinished: true, stats: { offSnaps: 12, tmOffSnaps: 60 }, gameStatsSynced: true })).toBe('played');
    expect(propGameStatus({ gameFinished: true, stats: { stSnaps: 8, tmOffSnaps: 60 }, gameStatsSynced: true })).toBe('played');
    // A two-way player who only played defense that week: his receiving props still grade.
    expect(propGameStatus({ gameFinished: true, stats: { offSnaps: 0, defSnaps: 45, tmOffSnaps: 62 }, gameStatsSynced: true })).toBe('played');
  });

  it('counts touches as participation when snap counts are missing', () => {
    expect(propGameStatus({ gameFinished: true, stats: { rushAttempts: 14 }, gameStatsSynced: true })).toBe('played');
  });

  it('voids an inactive player listed with only his team\'s snaps', () => {
    expect(propGameStatus({ gameFinished: true, stats: { offSnaps: 0, tmOffSnaps: 63 }, gameStatsSynced: true })).toBe('did_not_play');
  });

  it('refuses to grade an all-zero row with no team snaps (a failed stats sync)', () => {
    const zeroed = { offSnaps: 0, stSnaps: 0, tmOffSnaps: 0, passAttempts: 0, rushAttempts: 0, targets: 0, receptions: 0 };
    expect(propGameStatus({ gameFinished: true, stats: zeroed, gameStatsSynced: true })).toBe('unknown');
  });

  it('treats a missing row as did-not-play only once the game\'s stats are in', () => {
    expect(propGameStatus({ gameFinished: true, stats: null, gameStatsSynced: true })).toBe('did_not_play');
    expect(propGameStatus({ gameFinished: true, stats: undefined, gameStatsSynced: false })).toBe('unknown');
  });
});

describe('scoredAnytimeTd', () => {
  it('does not count passing touchdowns', () => {
    expect(scoredAnytimeTd({ rushTDs: 0, receivingTDs: 0 })).toBe(false);
  });

  it('counts rushing, receiving and return or defensive touchdowns', () => {
    expect(scoredAnytimeTd({ rushTDs: 1, receivingTDs: 0 })).toBe(true);
    expect(scoredAnytimeTd({ rushTDs: 0, receivingTDs: 2 })).toBe(true);
    expect(scoredAnytimeTd({ rushTDs: 0, receivingTDs: 0, defenseTDs: 1 })).toBe(true);
    expect(scoredAnytimeTd({ rushTDs: null, receivingTDs: null, defenseTDs: null })).toBe(false);
  });
});
