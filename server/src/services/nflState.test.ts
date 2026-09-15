import { describe, it, expect, vi } from 'vitest';
import {
  isGameFinished,
  resolveWeekFromSchedule,
  resolveWeekFromCalendar,
  getNflState,
  clearNflStateCache,
  type ScheduleGame,
} from './nflState';

function game(overrides: Partial<ScheduleGame> & { week: number; gameTime: Date }): ScheduleGame {
  return {
    isComplete: false,
    homeScore: null,
    awayScore: null,
    ...overrides,
  };
}

describe('isGameFinished', () => {
  const now = new Date('2026-09-15T18:00:00Z');

  it('is finished when isComplete is true', () => {
    expect(isGameFinished(game({ week: 1, gameTime: new Date('2026-09-14T17:00:00Z'), isComplete: true }), now)).toBe(true);
  });

  it('is finished when both scores are present, even if isComplete is false', () => {
    expect(isGameFinished(game({ week: 1, gameTime: new Date('2026-09-14T17:00:00Z'), homeScore: 24, awayScore: 17 }), now)).toBe(true);
  });

  it('is finished when kickoff was more than 5 hours ago', () => {
    // Kicked off 6h before "now"
    expect(isGameFinished(game({ week: 1, gameTime: new Date('2026-09-15T12:00:00Z') }), now)).toBe(true);
  });

  it('is not finished when kickoff was less than 5 hours ago with no scores', () => {
    expect(isGameFinished(game({ week: 1, gameTime: new Date('2026-09-15T16:00:00Z') }), now)).toBe(false);
  });

  it('is not finished for a future, unplayed game', () => {
    expect(isGameFinished(game({ week: 2, gameTime: new Date('2026-09-21T17:00:00Z') }), now)).toBe(false);
  });
});

describe('resolveWeekFromSchedule', () => {
  it('returns null when there are no rows', () => {
    expect(resolveWeekFromSchedule([], new Date('2026-09-15T18:00:00Z'))).toBeNull();
  });

  it('mid-week 2: week 1 finished, week 2 in progress -> 2', () => {
    const now = new Date('2026-09-18T18:00:00Z'); // Friday of week 2
    const games: ScheduleGame[] = [
      game({ week: 1, gameTime: new Date('2026-09-11T00:00:00Z'), isComplete: true }),
      game({ week: 1, gameTime: new Date('2026-09-14T17:00:00Z'), isComplete: true }),
      game({ week: 2, gameTime: new Date('2026-09-17T00:00:00Z'), isComplete: true }),
      game({ week: 2, gameTime: new Date('2026-09-21T17:00:00Z') }), // not started yet
    ];
    expect(resolveWeekFromSchedule(games, now)).toBe(2);
  });

  it('week 1 games all final, week 2 not started -> 2', () => {
    const now = new Date('2026-09-16T12:00:00Z'); // Tuesday of week 2
    const games: ScheduleGame[] = [
      game({ week: 1, gameTime: new Date('2026-09-10T00:00:00Z'), isComplete: true }),
      game({ week: 1, gameTime: new Date('2026-09-14T17:00:00Z'), isComplete: true }),
      game({ week: 2, gameTime: new Date('2026-09-17T00:00:00Z') }),
    ];
    expect(resolveWeekFromSchedule(games, now)).toBe(2);
  });

  it('Monday night game of week 2 in progress -> 2', () => {
    const now = new Date('2026-09-22T02:00:00Z'); // during MNF, kicked off ~1h ago
    const games: ScheduleGame[] = [
      game({ week: 1, gameTime: new Date('2026-09-10T00:00:00Z'), isComplete: true }),
      game({ week: 1, gameTime: new Date('2026-09-14T17:00:00Z'), isComplete: true }),
      game({ week: 2, gameTime: new Date('2026-09-17T00:00:00Z'), isComplete: true }),
      game({ week: 2, gameTime: new Date('2026-09-22T01:15:00Z') }), // MNF, kicked off, not final
    ];
    expect(resolveWeekFromSchedule(games, now)).toBe(2);
  });

  it('Tuesday after week 2: week 1 and 2 finished, week 3 scheduled but not started -> 3', () => {
    const now = new Date('2026-09-23T12:00:00Z');
    const games: ScheduleGame[] = [
      game({ week: 1, gameTime: new Date('2026-09-10T00:00:00Z'), isComplete: true }),
      game({ week: 2, gameTime: new Date('2026-09-17T00:00:00Z'), isComplete: true }),
      game({ week: 2, gameTime: new Date('2026-09-22T01:15:00Z'), isComplete: true }),
      game({ week: 3, gameTime: new Date('2026-09-24T00:00:00Z') }),
    ];
    expect(resolveWeekFromSchedule(games, now)).toBe(3);
  });

  it('returns the max week when every game is complete', () => {
    const now = new Date('2027-01-15T12:00:00Z');
    const games: ScheduleGame[] = [
      game({ week: 1, gameTime: new Date('2026-09-10T00:00:00Z'), isComplete: true }),
      game({ week: 17, gameTime: new Date('2026-12-28T00:00:00Z'), isComplete: true }),
      game({ week: 18, gameTime: new Date('2027-01-04T00:00:00Z'), isComplete: true }),
    ];
    expect(resolveWeekFromSchedule(games, now)).toBe(18);
  });

  it('a game with both scores present but isComplete=false still counts as finished', () => {
    const now = new Date('2026-09-15T00:00:00Z');
    const games: ScheduleGame[] = [
      game({ week: 1, gameTime: new Date('2026-09-11T00:00:00Z'), isComplete: false, homeScore: 20, awayScore: 14 }),
      game({ week: 2, gameTime: new Date('2026-09-20T00:00:00Z') }),
    ];
    expect(resolveWeekFromSchedule(games, now)).toBe(2);
  });

  it('a game whose kickoff was 6 hours ago counts as finished even with no scores/isComplete', () => {
    const now = new Date('2026-09-15T12:00:00Z');
    const games: ScheduleGame[] = [
      game({ week: 1, gameTime: new Date('2026-09-15T06:00:00Z') }), // 6h ago
      game({ week: 2, gameTime: new Date('2026-09-22T00:00:00Z') }),
    ];
    expect(resolveWeekFromSchedule(games, now)).toBe(2);
  });
});

describe('resolveWeekFromCalendar', () => {
  it('2026-09-15 -> week 2, regular season', () => {
    expect(resolveWeekFromCalendar(new Date('2026-09-15T18:00:00Z'))).toEqual({
      season: 2026, week: 2, seasonType: 'regular',
    });
  });

  it('2026-09-10 (Thursday kickoff, Labor Day is Sep 7 2026) -> week 1', () => {
    expect(resolveWeekFromCalendar(new Date('2026-09-10T18:00:00Z'))).toEqual({
      season: 2026, week: 1, seasonType: 'regular',
    });
  });

  it('2026-09-08 (the Tuesday after Labor Day) -> week 1', () => {
    expect(resolveWeekFromCalendar(new Date('2026-09-08T12:00:00Z'))).toEqual({
      season: 2026, week: 1, seasonType: 'regular',
    });
  });

  it('does not roll the week over while Monday Night Football is still on', () => {
    // 02:00 UTC Tuesday is 10pm ET Monday — mid-game. Still week 2.
    expect(resolveWeekFromCalendar(new Date('2026-09-22T02:00:00Z')).week).toBe(2);
    // By Tuesday morning US time the week has rolled.
    expect(resolveWeekFromCalendar(new Date('2026-09-22T10:00:00Z')).week).toBe(3);
  });

  it('2026-08-20 -> preseason, week 1', () => {
    expect(resolveWeekFromCalendar(new Date('2026-08-20T12:00:00Z'))).toEqual({
      season: 2026, week: 1, seasonType: 'preseason',
    });
  });

  it('2027-01-05 -> week 18, regular (18 weeks from Tue Sep 8 2026 ends Mon Jan 11 2027)', () => {
    expect(resolveWeekFromCalendar(new Date('2027-01-05T12:00:00Z'))).toEqual({
      season: 2026, week: 18, seasonType: 'regular',
    });
  });

  it('2027-01-20 -> postseason, week 18, of season 2026', () => {
    expect(resolveWeekFromCalendar(new Date('2027-01-20T12:00:00Z'))).toEqual({
      season: 2026, week: 18, seasonType: 'postseason',
    });
  });

  it('2026-05-01 -> offseason, season 2025, week 18', () => {
    expect(resolveWeekFromCalendar(new Date('2026-05-01T12:00:00Z'))).toEqual({
      season: 2025, week: 18, seasonType: 'offseason',
    });
  });
});

describe('getNflState phase comes from `now`, not the wall clock', () => {
  const neverQueried = {
    query: { nflGames: { findMany: async () => { throw new Error('should not query in this phase'); } } },
  } as any;

  it('preseason -> week 1 of the upcoming season without touching the schedule', async () => {
    clearNflStateCache();
    const state = await getNflState(neverQueried, new Date('2026-08-20T12:00:00Z'));
    expect(state).toMatchObject({ season: 2026, week: 1, seasonType: 'preseason', source: 'calendar' });
    clearNflStateCache();
  });

  it('offseason -> final week of the finished season', async () => {
    clearNflStateCache();
    const state = await getNflState(neverQueried, new Date('2026-05-01T12:00:00Z'));
    expect(state).toMatchObject({ season: 2025, week: 18, seasonType: 'offseason', source: 'calendar' });
    clearNflStateCache();
  });

  it('postseason -> week 18 of the season that just ended', async () => {
    clearNflStateCache();
    const state = await getNflState(neverQueried, new Date('2027-01-20T12:00:00Z'));
    expect(state).toMatchObject({ season: 2026, week: 18, seasonType: 'postseason', source: 'calendar' });
    clearNflStateCache();
  });
});

describe('getNflState partial schedule guard', () => {
  it('does not trust a schedule whose stored games are all finished but stop short of week 18', async () => {
    clearNflStateCache();
    const stubDb = {
      query: {
        nflGames: {
          // Only weeks 1-2 were ever synced and both are over; without the
          // guard the app would be pinned to week 2 for the rest of the season.
          findMany: async () => [
            { week: 1, gameTime: new Date('2026-09-10T00:00:00Z'), isComplete: true, homeScore: 20, awayScore: 14 },
            { week: 2, gameTime: new Date('2026-09-17T00:00:00Z'), isComplete: true, homeScore: 10, awayScore: 7 },
          ],
        },
      },
    } as any;

    // Week 4 by the calendar (Tue Sep 8 2026 + 3 weeks). Make ESPN
    // unreachable so the resolver deterministically lands on the calendar.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    try {
      const now = new Date('2026-10-01T18:00:00Z');
      const state = await getNflState(stubDb, now);
      expect(state.source).toBe('calendar');
      expect(state.week).toBe(4);
    } finally {
      fetchSpy.mockRestore();
      clearNflStateCache();
    }
  });
});

describe('getNflState caching', () => {
  it('caches the resolved state for repeated calls within the TTL', async () => {
    clearNflStateCache();
    let queryCount = 0;
    const stubDb = {
      query: {
        nflGames: {
          // Non-empty rows so resolveWeekFromSchedule can resolve a
          // definite week without falling through to the ESPN fetch.
          findMany: async () => {
            queryCount++;
            return [
              { week: 1, gameTime: new Date('2026-09-10T00:00:00Z'), isComplete: true, homeScore: 20, awayScore: 14 },
              { week: 2, gameTime: new Date('2026-09-20T00:00:00Z'), isComplete: false, homeScore: null, awayScore: null },
            ];
          },
        },
      },
    } as any;

    const now = new Date('2026-09-15T18:00:00Z');
    const first = await getNflState(stubDb, now);
    const second = await getNflState(stubDb, new Date(now.getTime() + 60_000));

    expect(second).toEqual(first);
    expect(queryCount).toBe(1);

    clearNflStateCache();
    await getNflState(stubDb, new Date(now.getTime() + 61_000));
    expect(queryCount).toBe(2);
  });
});
