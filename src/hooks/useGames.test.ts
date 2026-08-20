import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({ getGame: vi.fn() }));

vi.mock('../services', () => ({ gameService: { getGame: h.getGame } }));

import { useGame } from './useGames';

function makeGame(overrides: Record<string, unknown> = {}) {
  return {
    id: 'g1',
    week: 1,
    seasonYear: 2025,
    homeTeam: 'KC',
    awayTeam: 'BUF',
    gameTime: new Date(Date.now() - 60_000).toISOString(), // kicked off 1 min ago
    isComplete: false,
    ...overrides,
  };
}

beforeEach(() => {
  h.getGame.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useGame', () => {
  it('fetches the game on mount', async () => {
    h.getGame.mockResolvedValue({ game: makeGame(), homePlayers: [], awayPlayers: [] });
    const { result } = renderHook(() => useGame('g1'));
    await waitFor(() => expect(result.current.game).not.toBeNull());
    expect(h.getGame).toHaveBeenCalledWith('g1');
  });

  it('polls every 30s while the game is live and stops once complete', async () => {
    h.getGame
      .mockResolvedValueOnce({ game: makeGame({ isComplete: false }), homePlayers: [], awayPlayers: [] })
      .mockResolvedValueOnce({ game: makeGame({ isComplete: true }), homePlayers: [], awayPlayers: [] });

    vi.useFakeTimers();
    const { result } = renderHook(() => useGame('g1'));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // flush initial fetch
    expect(h.getGame).toHaveBeenCalledTimes(1);

    // Background poll fires 30s later and should not show the loader.
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(h.getGame).toHaveBeenCalledTimes(2);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.game?.isComplete).toBe(true);

    // Game is now final — no further polling.
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(h.getGame).toHaveBeenCalledTimes(2);
  });

  it('does not poll a game that has not kicked off yet', async () => {
    h.getGame.mockResolvedValue({
      game: makeGame({ gameTime: new Date(Date.now() + 3_600_000).toISOString() }),
      homePlayers: [],
      awayPlayers: [],
    });

    vi.useFakeTimers();
    renderHook(() => useGame('g1'));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(h.getGame).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(h.getGame).toHaveBeenCalledTimes(1);
  });

  it('refetch() re-fetches in the foreground', async () => {
    h.getGame.mockResolvedValue({ game: makeGame(), homePlayers: [], awayPlayers: [] });
    const { result } = renderHook(() => useGame('g1'));
    await waitFor(() => expect(h.getGame).toHaveBeenCalledTimes(1));

    await act(async () => { await result.current.refetch(); });
    expect(h.getGame).toHaveBeenCalledTimes(2);
  });
});
