import { describe, expect, it } from 'vitest';
import { computeWeekChange, convertAPIPlayerToPlayer, type APIPlayer } from './playerUtils';

describe('computeWeekChange', () => {
  it('is the last played week minus the one before it', () => {
    expect(computeWeekChange([10, 12.5, 18.2])).toBe(5.7);
    expect(computeWeekChange([20, 8])).toBe(-12);
  });

  it('is flat until two weeks have been played', () => {
    expect(computeWeekChange(undefined)).toBe(0);
    expect(computeWeekChange([])).toBe(0);
    expect(computeWeekChange([14.3])).toBe(0);
  });
});

describe('convertAPIPlayerToPlayer', () => {
  const base: APIPlayer = {
    id: 'p1',
    name: 'Test Player',
    team: 'KC',
    position: 'WR',
    status: 'questionable',
    externalId: '4046',
    byeWeek: 6,
    avgPointsPPR: 12,
    projectedPoints: 14,
    isRostered: false,
    recentWeeklyScores: [9, 15],
  };

  it('carries status and the Sleeper id through to the card', () => {
    const player = convertAPIPlayerToPlayer(base, 0);
    expect(player.status).toBe('questionable');
    expect(player.externalId).toBe('4046');
    expect(player.weekChange).toBe(6);
  });
});
