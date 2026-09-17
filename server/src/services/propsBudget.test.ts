import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ODDS_API_CREDIT_RESERVE,
  PROPS_PRE_KICKOFF_REFRESH_HOURS,
  PROPS_PRE_KICKOFF_WINDOW_HOURS,
  PROPS_REFRESH_HOURS,
  decidePropsFetch,
  isBelowReserve,
  parseCreditReserve,
} from './propsBudget';

const hours = (n: number) => n * 60 * 60 * 1000;
const at = (base: Date, offsetHours: number) => new Date(base.getTime() + hours(offsetHours));

describe('decidePropsFetch', () => {
  // Sunday 1:00 PM ET kickoff, expressed in UTC.
  const kickoff = new Date('2026-09-20T17:00:00Z');

  it('never fetches once the game has kicked off', () => {
    expect(decidePropsFetch({ now: kickoff, kickoff, lastSnapshotAt: null })).toBe('skip_kicked_off');
    expect(decidePropsFetch({ now: at(kickoff, 3), kickoff, lastSnapshotAt: at(kickoff, -30) })).toBe('skip_kicked_off');
  });

  it('fetches a game that has no props stored yet', () => {
    expect(decidePropsFetch({ now: at(kickoff, -100), kickoff, lastSnapshotAt: null })).toBe('fetch');
    expect(decidePropsFetch({ now: at(kickoff, -1), kickoff, lastSnapshotAt: null })).toBe('fetch');
  });

  it('refreshes at most once a day before the pre-kickoff window', () => {
    const now = at(kickoff, -72); // Thursday afternoon
    expect(decidePropsFetch({ now, kickoff, lastSnapshotAt: at(now, -4) })).toBe('skip_fresh');
    expect(decidePropsFetch({ now, kickoff, lastSnapshotAt: at(now, -(PROPS_REFRESH_HOURS - 1)) })).toBe('skip_fresh');
    expect(decidePropsFetch({ now, kickoff, lastSnapshotAt: at(now, -PROPS_REFRESH_HOURS) })).toBe('fetch');
  });

  it('refreshes once more inside the pre-kickoff window, but not on every tick', () => {
    // 5h before kickoff, last snapshot from Tuesday: fetch.
    const fiveBefore = at(kickoff, -5);
    expect(decidePropsFetch({ now: fiveBefore, kickoff, lastSnapshotAt: at(kickoff, -110) })).toBe('fetch');
    // Next 4-hour tick, 1h before kickoff, snapshot is 4h old: too fresh.
    const oneBefore = at(kickoff, -1);
    expect(decidePropsFetch({ now: oneBefore, kickoff, lastSnapshotAt: fiveBefore })).toBe('skip_fresh');
    // Same tick, but the last snapshot is older than the in-window threshold: fetch.
    expect(
      decidePropsFetch({ now: oneBefore, kickoff, lastSnapshotAt: at(oneBefore, -PROPS_PRE_KICKOFF_REFRESH_HOURS) })
    ).toBe('fetch');
  });

  it('treats the window boundary as inside the window', () => {
    const now = at(kickoff, -PROPS_PRE_KICKOFF_WINDOW_HOURS);
    expect(decidePropsFetch({ now, kickoff, lastSnapshotAt: at(now, -7) })).toBe('fetch');
    expect(decidePropsFetch({ now, kickoff, lastSnapshotAt: at(now, -5) })).toBe('skip_fresh');
  });

  it('uses the daily cadence when the schedule has no kickoff time', () => {
    const now = new Date('2026-09-17T12:00:00Z');
    expect(decidePropsFetch({ now, kickoff: null, lastSnapshotAt: null })).toBe('fetch');
    expect(decidePropsFetch({ now, kickoff: null, lastSnapshotAt: at(now, -12) })).toBe('skip_fresh');
    expect(decidePropsFetch({ now, kickoff: null, lastSnapshotAt: at(now, -25) })).toBe('fetch');
  });
});

describe('parseCreditReserve', () => {
  it('falls back to the default when unset or unusable', () => {
    expect(parseCreditReserve(undefined)).toBe(DEFAULT_ODDS_API_CREDIT_RESERVE);
    expect(parseCreditReserve('')).toBe(DEFAULT_ODDS_API_CREDIT_RESERVE);
    expect(parseCreditReserve('lots')).toBe(DEFAULT_ODDS_API_CREDIT_RESERVE);
    expect(parseCreditReserve('-5')).toBe(DEFAULT_ODDS_API_CREDIT_RESERVE);
  });

  it('accepts a whole number of credits, including zero to disable the floor', () => {
    expect(parseCreditReserve('2500')).toBe(2500);
    expect(parseCreditReserve('0')).toBe(0);
    expect(parseCreditReserve('99.9')).toBe(99);
  });
});

describe('isBelowReserve', () => {
  it('never blocks on an unknown balance', () => {
    expect(isBelowReserve(null, 1000)).toBe(false);
  });

  it('blocks at or below the reserve', () => {
    expect(isBelowReserve(1000, 1000)).toBe(true);
    expect(isBelowReserve(999, 1000)).toBe(true);
    expect(isBelowReserve(1001, 1000)).toBe(false);
    expect(isBelowReserve(0, 0)).toBe(true);
  });
});
