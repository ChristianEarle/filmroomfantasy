import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getNflSeasonContext } from './espn';

describe('getNflSeasonContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Jan 1 - Feb 15 -> previous year postseason', () => {
    vi.setSystemTime(new Date(2026, 0, 15)); // Jan 15, 2026
    expect(getNflSeasonContext()).toEqual({ season: 2025, seasontype: '3' });
  });

  it('Feb 16 falls outside the postseason window -> previous year regular season (offseason)', () => {
    vi.setSystemTime(new Date(2026, 1, 16)); // Feb 16, 2026
    expect(getNflSeasonContext()).toEqual({ season: 2025, seasontype: '2' });
  });

  it('Feb 16 - Jul 31 -> previous year regular season (offseason)', () => {
    vi.setSystemTime(new Date(2026, 6, 31)); // Jul 31, 2026
    expect(getNflSeasonContext()).toEqual({ season: 2025, seasontype: '2' });
  });

  it('Aug 1 - Sep 4 -> current year preseason', () => {
    vi.setSystemTime(new Date(2026, 7, 1)); // Aug 1, 2026
    expect(getNflSeasonContext()).toEqual({ season: 2026, seasontype: '1' });
  });

  it('Sep 5 - Dec 31 -> current year regular season', () => {
    vi.setSystemTime(new Date(2026, 8, 5)); // Sep 5, 2026
    expect(getNflSeasonContext()).toEqual({ season: 2026, seasontype: '2' });

    vi.setSystemTime(new Date(2026, 11, 31)); // Dec 31, 2026
    expect(getNflSeasonContext()).toEqual({ season: 2026, seasontype: '2' });
  });
});
