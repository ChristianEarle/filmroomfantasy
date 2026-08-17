import { describe, it, expect } from 'vitest';
import { toggleComparePlayer, MAX_COMPARE_PLAYERS } from './playerUtils';
import type { Player } from '../App';

function make(id: string): Player {
  return {
    id,
    rank: 1,
    name: `Player ${id}`,
    team: 'BUF',
    position: 'QB',
    keyLine: '',
    projectedPoints: 300,
    weekChange: 0,
  };
}

describe('toggleComparePlayer', () => {
  it('adds a player not already in the list', () => {
    const result = toggleComparePlayer([], make('1'));
    expect(result.map((p) => p.id)).toEqual(['1']);
  });

  it('removes a player already in the list', () => {
    const list = [make('1'), make('2')];
    const result = toggleComparePlayer(list, make('1'));
    expect(result.map((p) => p.id)).toEqual(['2']);
  });

  it('is a no-op once the list is at max size', () => {
    const list = Array.from({ length: MAX_COMPARE_PLAYERS }, (_, i) => make(String(i)));
    const result = toggleComparePlayer(list, make('new'));
    expect(result).toHaveLength(MAX_COMPARE_PLAYERS);
    expect(result.map((p) => p.id)).not.toContain('new');
  });

  it('still allows removing a player when the list is at max size', () => {
    const list = Array.from({ length: MAX_COMPARE_PLAYERS }, (_, i) => make(String(i)));
    const result = toggleComparePlayer(list, make('0'));
    expect(result).toHaveLength(MAX_COMPARE_PLAYERS - 1);
    expect(result.map((p) => p.id)).not.toContain('0');
  });

  it('respects a custom max', () => {
    const list = [make('1')];
    const result = toggleComparePlayer(list, make('2'), 1);
    expect(result).toHaveLength(1);
    expect(result.map((p) => p.id)).toEqual(['1']);
  });
});
