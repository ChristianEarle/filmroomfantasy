import { describe, expect, it } from 'vitest';
import {
  LEAGUE_SYNC_STALE_HOURS_IN_SEASON,
  LEAGUE_SYNC_STALE_HOURS_OFF_SEASON,
  isInSeasonMonth,
  isLeagueSyncStale,
  leagueSyncStaleHours,
} from './leagueFreshness';

const hours = (n: number) => n * 60 * 60 * 1000;

describe('isInSeasonMonth', () => {
  it('treats September through January as in season', () => {
    expect(isInSeasonMonth(new Date('2026-09-17T12:00:00Z'))).toBe(true);
    expect(isInSeasonMonth(new Date('2026-12-25T12:00:00Z'))).toBe(true);
    expect(isInSeasonMonth(new Date('2027-01-10T12:00:00Z'))).toBe(true);
    expect(isInSeasonMonth(new Date('2026-06-01T12:00:00Z'))).toBe(false);
    expect(isInSeasonMonth(new Date('2026-08-31T23:59:59Z'))).toBe(false);
  });
});

describe('leagueSyncStaleHours', () => {
  it('uses the short window in season and the long one off season', () => {
    expect(leagueSyncStaleHours(new Date('2026-10-01T00:00:00Z'))).toBe(LEAGUE_SYNC_STALE_HOURS_IN_SEASON);
    expect(leagueSyncStaleHours(new Date('2026-04-01T00:00:00Z'))).toBe(LEAGUE_SYNC_STALE_HOURS_OFF_SEASON);
  });
});

describe('isLeagueSyncStale', () => {
  const inSeason = new Date('2026-09-17T12:00:00Z');
  const offSeason = new Date('2026-04-17T12:00:00Z');

  it('is stale when the league has never synced', () => {
    expect(isLeagueSyncStale(null, inSeason)).toBe(true);
    expect(isLeagueSyncStale(undefined, inSeason)).toBe(true);
  });

  it('is fresh inside the window and stale past it, in season', () => {
    expect(isLeagueSyncStale(new Date(inSeason.getTime() - hours(1)), inSeason)).toBe(false);
    expect(isLeagueSyncStale(new Date(inSeason.getTime() - hours(LEAGUE_SYNC_STALE_HOURS_IN_SEASON - 0.01)), inSeason)).toBe(false);
    expect(isLeagueSyncStale(new Date(inSeason.getTime() - hours(LEAGUE_SYNC_STALE_HOURS_IN_SEASON + 0.01)), inSeason)).toBe(true);
  });

  it('waits a full day off season', () => {
    expect(isLeagueSyncStale(new Date(offSeason.getTime() - hours(10)), offSeason)).toBe(false);
    expect(isLeagueSyncStale(new Date(offSeason.getTime() - hours(25)), offSeason)).toBe(true);
  });
});
