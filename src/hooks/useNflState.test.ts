import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ getNflState: vi.fn() }));

vi.mock('../services/games', () => ({ gameService: { getNflState: h.getNflState } }));

const STORAGE_KEY = 'filmroom_nfl_state';

const sampleState = {
  season: 2026,
  week: 2,
  seasonType: 'regular' as const,
  source: 'schedule' as const,
  resolvedAt: '2026-09-15T18:00:00.000Z',
};

beforeEach(() => {
  vi.resetModules();
  h.getNflState.mockReset();
  localStorage.clear();
});

describe('useNflState', () => {
  it('seeds synchronously from a fresh localStorage cache', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: sampleState, cachedAtMs: Date.now() }));
    h.getNflState.mockResolvedValue(sampleState);

    const { useNflState } = await import('./useNflState');
    const { result } = renderHook(() => useNflState());

    // Seeded immediately, and a cache this fresh (< 5 min) is not refetched.
    expect(result.current.week).toBe(2);
    expect(result.current.season).toBe(2026);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(h.getNflState).toHaveBeenCalledTimes(0);
  });

  it('seeds from an older cache entry but refreshes it from the API once', async () => {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { ...sampleState, week: 1 }, cachedAtMs: tenMinutesAgo }));
    h.getNflState.mockResolvedValue(sampleState);

    const { useNflState } = await import('./useNflState');
    const first = renderHook(() => useNflState());
    expect(first.result.current.week).toBe(1); // seeded synchronously

    await waitFor(() => expect(first.result.current.week).toBe(2));
    expect(h.getNflState).toHaveBeenCalledTimes(1);

    // A second mount shortly after reuses the freshly fetched value.
    const second = renderHook(() => useNflState());
    expect(second.result.current.week).toBe(2);
    await waitFor(() => expect(second.result.current.isLoading).toBe(false));
    expect(h.getNflState).toHaveBeenCalledTimes(1);
  });

  it('ignores a stale cache entry (older than 6 hours)', async () => {
    const staleState = { ...sampleState, week: 1 };
    const sevenHoursAgo = Date.now() - 7 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: staleState, cachedAtMs: sevenHoursAgo }));
    h.getNflState.mockResolvedValue(sampleState);

    const { useNflState } = await import('./useNflState');
    const { result } = renderHook(() => useNflState());

    // Nothing usable seeded — loading until the fetch resolves.
    expect(result.current.week).toBeNull();
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.week).toBe(2));
  });

  it('dedupes concurrent fetches across multiple hook instances', async () => {
    let resolveFetch: (v: typeof sampleState) => void;
    h.getNflState.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));

    const { useNflState } = await import('./useNflState');
    const first = renderHook(() => useNflState());
    const second = renderHook(() => useNflState());

    expect(h.getNflState).toHaveBeenCalledTimes(1);

    resolveFetch!(sampleState);
    await waitFor(() => expect(first.result.current.week).toBe(2));
    await waitFor(() => expect(second.result.current.week).toBe(2));
    expect(h.getNflState).toHaveBeenCalledTimes(1);
  });

  it('falls back to the calendar week when the API fails and nothing is cached', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-15T18:00:00Z'), toFake: ['Date'] });
    try {
      h.getNflState.mockRejectedValue(new Error('network down'));

      const { useNflState } = await import('./useNflState');
      const { result } = renderHook(() => useNflState());

      await waitFor(() => expect(result.current.week).toBe(2));
      expect(result.current.season).toBe(2026);
      expect(result.current.state?.source).toBe('calendar');
      expect(result.current.error).toBeInstanceOf(Error);
      // A calendar guess is never persisted — the next load should retry the API.
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('survives a throwing localStorage (private browsing, quota, etc.)', async () => {
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => { throw new Error('blocked'); },
        setItem: () => { throw new Error('blocked'); },
        removeItem: () => { throw new Error('blocked'); },
        clear: () => {},
      },
    });

    try {
      h.getNflState.mockResolvedValue(sampleState);
      const { useNflState } = await import('./useNflState');
      const { result } = renderHook(() => useNflState());

      expect(result.current.week).toBeNull();
      await waitFor(() => expect(result.current.week).toBe(2));
    } finally {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: original });
    }
  });
});
