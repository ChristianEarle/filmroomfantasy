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
    // Jan 20 (rather than Jan 1) — safely past the calendar resolver's
    // postseason start (roughly early January), so the boundary is
    // unambiguous regardless of exactly which day season 2025's Labor Day
    // fell on.
    vi.setSystemTime(new Date(2026, 0, 20)); // Jan 20, 2026
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

  it('mid-September - Dec 31 -> current year regular season', () => {
    // Sep 20 (rather than Sep 5) — the calendar resolver starts week 1 on
    // the Tuesday after Labor Day, which in 2026 is Sep 8, so Sep 5 would
    // still be preseason. Sep 20 is unambiguously inside the season.
    vi.setSystemTime(new Date(2026, 8, 20)); // Sep 20, 2026
    expect(getNflSeasonContext()).toEqual({ season: 2026, seasontype: '2' });

    vi.setSystemTime(new Date(2026, 11, 31)); // Dec 31, 2026
    expect(getNflSeasonContext()).toEqual({ season: 2026, seasontype: '2' });
  });
});
