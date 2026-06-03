import { describe, it, expect, beforeEach } from 'vitest';
import { seedTradeAsset, consumeTradeSeed, TRADE_SEED_KEY } from './tradeSeed';

beforeEach(() => {
  localStorage.clear();
});

describe('tradeSeed', () => {
  it('round-trips a seeded asset and clears it after consuming', () => {
    seedTradeAsset({ id: 'p1', type: 'player', name: 'Josh Allen', position: 'QB', team: 'BUF' });
    const seed = consumeTradeSeed();
    expect(seed).toEqual({ id: 'p1', type: 'player', name: 'Josh Allen', position: 'QB', team: 'BUF' });
    // Consumed — second read is empty.
    expect(consumeTradeSeed()).toBeNull();
    expect(localStorage.getItem(TRADE_SEED_KEY)).toBeNull();
  });

  it('returns null when no seed is present', () => {
    expect(consumeTradeSeed()).toBeNull();
  });

  it('ignores a malformed seed', () => {
    localStorage.setItem(TRADE_SEED_KEY, '{not valid json');
    expect(consumeTradeSeed()).toBeNull();
  });

  it('rejects a seed missing required fields', () => {
    localStorage.setItem(TRADE_SEED_KEY, JSON.stringify({ type: 'player' }));
    expect(consumeTradeSeed()).toBeNull();
  });
});
