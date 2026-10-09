import { describe, it, expect } from 'vitest';
import { isWithinLineupLockWindow, buildLineupLockBody } from './notifications';

describe('isWithinLineupLockWindow', () => {
  const now = new Date('2026-09-11T12:00:00Z'); // Thursday noon UTC

  it('is false when the lock is more than 24h out', () => {
    const lockTime = new Date(now.getTime() + 25 * 3600000);
    expect(isWithinLineupLockWindow(now, lockTime)).toBe(false);
  });

  it('is true right at the edge of the 24h window', () => {
    const lockTime = new Date(now.getTime() + 24 * 3600000);
    expect(isWithinLineupLockWindow(now, lockTime)).toBe(true);
  });

  it('is true a few hours before lock', () => {
    const lockTime = new Date(now.getTime() + 3 * 3600000);
    expect(isWithinLineupLockWindow(now, lockTime)).toBe(true);
  });

  it('is false once the lock has already passed', () => {
    const lockTime = new Date(now.getTime() - 60000);
    expect(isWithinLineupLockWindow(now, lockTime)).toBe(false);
  });

  it('is false exactly at lock time (nothing left to remind about)', () => {
    expect(isWithinLineupLockWindow(now, now)).toBe(false);
  });

  it('respects a custom window', () => {
    const lockTime = new Date(now.getTime() + 2 * 3600000);
    expect(isWithinLineupLockWindow(now, lockTime, 3600000)).toBe(false);
    expect(isWithinLineupLockWindow(now, lockTime, 3 * 3600000)).toBe(true);
  });
});

describe('buildLineupLockBody', () => {
  const now = new Date('2026-09-11T12:00:00Z');

  it('rounds to the nearest hour for a multi-hour lock', () => {
    const lockTime = new Date(now.getTime() + 3.4 * 3600000);
    expect(buildLineupLockBody(2, now, lockTime)).toBe(
      'Week 2 lineups lock in about 3h — double check your starters before kickoff.',
    );
  });

  it('uses "under an hour" for an imminent lock', () => {
    const lockTime = new Date(now.getTime() + 30 * 60000);
    expect(buildLineupLockBody(2, now, lockTime)).toBe(
      'Week 2 lineups lock in under an hour — double check your starters before kickoff.',
    );
  });

  it('never reports a negative time once the lock has passed', () => {
    const lockTime = new Date(now.getTime() - 5 * 60000);
    expect(buildLineupLockBody(2, now, lockTime)).toBe(
      'Week 2 lineups lock in under an hour — double check your starters before kickoff.',
    );
  });
});
