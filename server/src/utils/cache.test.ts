import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cached, invalidateCache, cacheStats } from './cache';

describe('cached', () => {
  beforeEach(() => {
    invalidateCache('test:', true);
  });

  it('calls the fetcher on a cache miss and caches the result', async () => {
    const fetcher = vi.fn(async () => 'fresh-value');
    const result = await cached('test:key', 60_000, fetcher);
    expect(result).toBe('fresh-value');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('returns the cached value without calling the fetcher again within the TTL', async () => {
    const fetcher = vi.fn(async () => 'fresh-value');
    await cached('test:key2', 60_000, fetcher);
    const second = await cached('test:key2', 60_000, fetcher);
    expect(second).toBe('fresh-value');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('recomputes once the TTL has expired', async () => {
    vi.useFakeTimers();
    try {
      let call = 0;
      const fetcher = vi.fn(async () => `value-${++call}`);
      const first = await cached('test:key3', 1000, fetcher);
      expect(first).toBe('value-1');

      vi.advanceTimersByTime(1001);

      const second = await cached('test:key3', 1000, fetcher);
      expect(second).toBe('value-2');
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('invalidateCache', () => {
  beforeEach(() => {
    invalidateCache('test:', true);
  });

  it('deletes a single key and reports whether it existed', async () => {
    await cached('test:solo', 60_000, async () => 'v');
    expect(invalidateCache('test:solo')).toBe(1);
    expect(invalidateCache('test:solo')).toBe(0);
  });

  it('deletes every key matching a prefix and returns the count removed', async () => {
    await cached('test:prefix:a', 60_000, async () => 'a');
    await cached('test:prefix:b', 60_000, async () => 'b');
    await cached('test:other', 60_000, async () => 'c');

    const removed = invalidateCache('test:prefix:', true);
    expect(removed).toBe(2);
    expect(invalidateCache('test:other')).toBe(1);
  });
});

describe('cacheStats', () => {
  beforeEach(() => {
    invalidateCache('test:', true);
  });

  afterEach(() => {
    invalidateCache('test:', true);
  });

  it('reflects the number of entries currently stored', async () => {
    const before = cacheStats().size;
    await cached('test:stat1', 60_000, async () => 1);
    await cached('test:stat2', 60_000, async () => 2);
    expect(cacheStats().size).toBe(before + 2);
  });
});
