import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export interface WatchlistPlayer {
  playerId: string;
  name: string;
  position: string;
  team: string;
  headshotUrl: string | null;
  addedAt: string;
}

/**
 * Tracks the authenticated user's player watchlist. Reads the set once on
 * mount (and when auth state changes), and exposes an optimistic `toggle` that
 * adds/removes a player and reverts on error. For logged-out users the set is
 * empty and `toggle` is a no-op returning `false` so callers can prompt login.
 */
export function useWatchlist() {
  const { isAuthenticated } = useAuth();
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setWatchedIds(new Set());
      return;
    }
    setLoading(true);
    try {
      const data = await api.get<{ players: WatchlistPlayer[] }>('/watchlist');
      setWatchedIds(new Set(data.players.map((p) => p.playerId)));
    } catch {
      // Non-fatal — keep whatever we have.
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (playerId: string): Promise<boolean> => {
      if (!isAuthenticated) return false;
      const wasWatched = watchedIds.has(playerId);

      // Optimistic update.
      setWatchedIds((prev) => {
        const next = new Set(prev);
        if (wasWatched) next.delete(playerId);
        else next.add(playerId);
        return next;
      });

      try {
        if (wasWatched) {
          await api.delete(`/watchlist/${encodeURIComponent(playerId)}`);
        } else {
          await api.post('/watchlist', { playerId });
        }
        return true;
      } catch {
        // Revert on failure.
        setWatchedIds((prev) => {
          const next = new Set(prev);
          if (wasWatched) next.add(playerId);
          else next.delete(playerId);
          return next;
        });
        return false;
      }
    },
    [isAuthenticated, watchedIds],
  );

  const isWatched = useCallback((playerId: string) => watchedIds.has(playerId), [watchedIds]);

  return { watchedIds, isWatched, toggle, loading, isAuthenticated, refresh };
}
