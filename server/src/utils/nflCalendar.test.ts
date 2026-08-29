import { describe, it, expect } from 'vitest';
import {
  resolveSeasonDirectionFromDate,
  getNflCalendarContext,
  formatNflCalendarBlock,
} from './nflCalendar';

describe('resolveSeasonDirectionFromDate', () => {
  it('treats Sep-Dec as the regular season of the current year', () => {
    expect(resolveSeasonDirectionFromDate(new Date('2025-10-15T00:00:00Z'))).toEqual({
      currentSeason: 2025,
      mostRecentCompletedSeason: 2024,
      upcomingSeason: 2026,
    });
  });

  it('treats January through Feb 15 as playoffs of the prior season', () => {
    expect(resolveSeasonDirectionFromDate(new Date('2026-01-10T00:00:00Z'))).toEqual({
      currentSeason: 2025,
      mostRecentCompletedSeason: 2024,
      upcomingSeason: 2026,
    });
    expect(resolveSeasonDirectionFromDate(new Date('2026-02-15T00:00:00Z'))).toEqual({
      currentSeason: 2025,
      mostRecentCompletedSeason: 2024,
      upcomingSeason: 2026,
    });
  });

  it('treats Feb 16 - Aug 31 as the offseason with no active season', () => {
    expect(resolveSeasonDirectionFromDate(new Date('2026-02-16T00:00:00Z'))).toEqual({
      currentSeason: null,
      mostRecentCompletedSeason: 2025,
      upcomingSeason: 2026,
    });
    expect(resolveSeasonDirectionFromDate(new Date('2026-07-29T00:00:00Z'))).toEqual({
      currentSeason: null,
      mostRecentCompletedSeason: 2025,
      upcomingSeason: 2026,
    });
  });
});

describe('getNflCalendarContext', () => {
  it('reports in-season draftPosition during the regular season', () => {
    const ctx = getNflCalendarContext(new Date('2025-11-01T00:00:00Z'));
    expect(ctx.draftPosition).toBe('in-season');
    expect(ctx.currentSeason).toBe(2025);
    expect(ctx.today).toBe('2025-11-01');
  });

  it('reports pre-draft in the early offseason', () => {
    const ctx = getNflCalendarContext(new Date('2026-03-01T00:00:00Z'));
    expect(ctx.draftPosition).toBe('pre-draft');
    expect(ctx.currentSeason).toBeNull();
  });

  it('reports draft-window in late April', () => {
    const ctx = getNflCalendarContext(new Date('2026-04-25T00:00:00Z'));
    expect(ctx.draftPosition).toBe('draft-window');
  });

  it('reports post-draft from May through August', () => {
    const ctx = getNflCalendarContext(new Date('2026-06-01T00:00:00Z'));
    expect(ctx.draftPosition).toBe('post-draft');
  });
});

describe('formatNflCalendarBlock', () => {
  it('renders the season years and phase description into a prompt block', () => {
    const ctx = getNflCalendarContext(new Date('2026-07-29T00:00:00Z'));
    const block = formatNflCalendarBlock(ctx);
    expect(block).toContain('Today: 2026-07-29');
    expect(block).toContain(`Upcoming NFL season: ${ctx.upcomingSeason}`);
    expect(block).toContain(ctx.phaseDescription);
    expect(block).not.toContain('Active NFL season:');
  });

  it('includes the active season line only when currently in-season', () => {
    const ctx = getNflCalendarContext(new Date('2025-11-01T00:00:00Z'));
    const block = formatNflCalendarBlock(ctx);
    expect(block).toContain(`Active NFL season: ${ctx.currentSeason}`);
  });
});
