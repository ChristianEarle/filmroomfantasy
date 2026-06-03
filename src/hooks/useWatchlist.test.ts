import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
  authed: { current: true },
}));

vi.mock('../services/api', () => ({ api: { get: h.get, post: h.post, delete: h.del } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: h.authed.current }) }));

import { useWatchlist } from './useWatchlist';

beforeEach(() => {
  h.get.mockReset();
  h.post.mockReset();
  h.del.mockReset();
  h.authed.current = true;
});

describe('useWatchlist', () => {
  it('loads watched ids on mount when authenticated', async () => {
    h.get.mockResolvedValue({ players: [{ playerId: 'p1' }, { playerId: 'p2' }] });
    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => expect(result.current.watchedIds.size).toBe(2));
    expect(result.current.isWatched('p1')).toBe(true);
    expect(result.current.isWatched('nope')).toBe(false);
  });

  it('does not fetch when logged out', async () => {
    h.authed.current = false;
    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(h.get).not.toHaveBeenCalled();
    expect(result.current.watchedIds.size).toBe(0);
  });

  it('optimistically adds a player and POSTs', async () => {
    h.get.mockResolvedValue({ players: [] });
    h.post.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => expect(h.get).toHaveBeenCalled());
    await act(async () => { await result.current.toggle('p9'); });
    expect(h.post).toHaveBeenCalledWith('/watchlist', { playerId: 'p9' });
    expect(result.current.isWatched('p9')).toBe(true);
  });

  it('reverts the optimistic add when the request fails', async () => {
    h.get.mockResolvedValue({ players: [] });
    h.post.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => expect(h.get).toHaveBeenCalled());
    await act(async () => { await result.current.toggle('p9'); });
    expect(result.current.isWatched('p9')).toBe(false);
  });

  it('removes a watched player via DELETE', async () => {
    h.get.mockResolvedValue({ players: [{ playerId: 'p1' }] });
    h.del.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => expect(result.current.isWatched('p1')).toBe(true));
    await act(async () => { await result.current.toggle('p1'); });
    expect(h.del).toHaveBeenCalledWith('/watchlist/p1');
    expect(result.current.isWatched('p1')).toBe(false);
  });
});
