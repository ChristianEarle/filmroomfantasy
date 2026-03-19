import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { playerService } from '../services';
import type { Player, PlayersResponse, TrendingPlayer, PlayerNews, PlayerWeeklyStats } from '../services';

interface UsePlayersParams {
  page?: number;
  limit?: number;
  position?: string;
  team?: string;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function usePlayers(params: UsePlayersParams = {}) {
  const [data, setData] = useState<PlayersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Stable serialization: only recompute when individual param values change
  const stableKey = useMemo(
    () => `${params.page}-${params.limit}-${params.position}-${params.team}-${params.search}-${params.status}-${params.sortBy}-${params.sortOrder}`,
    [params.page, params.limit, params.position, params.team, params.search, params.status, params.sortBy, params.sortOrder]
  );

  // Keep a ref to the latest params so the callback always uses current values
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const fetchPlayers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await playerService.getPlayers(paramsRef.current);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch players'));
    } finally {
      setIsLoading(false);
    }
  }, [stableKey]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  return { data, isLoading, error, refetch: fetchPlayers };
}

export function usePlayer(playerId: string | null) {
  const [player, setPlayer] = useState<(Player & { news: PlayerNews[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!playerId) {
      setPlayer(null);
      return;
    }

    const fetchPlayer = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await playerService.getPlayer(playerId);
        setPlayer(response.player);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch player'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayer();
  }, [playerId]);

  return { player, isLoading, error };
}

export function usePlayerSearch() {
  const [results, setResults] = useState<Player[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const search = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await playerService.searchPlayers(query);
      setResults(response.players);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  return { results, isSearching, search, clearResults };
}

export function useTrendingPlayers(direction: 'up' | 'down' = 'up') {
  const [trending, setTrending] = useState<TrendingPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchTrending = async () => {
      setIsLoading(true);
      try {
        const response = await playerService.getTrending(direction);
        setTrending(response.trending);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch trending'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrending();
  }, [direction]);

  return { trending, isLoading, error };
}

export function usePlayerStats(playerId: string | null, season?: number) {
  const [stats, setStats] = useState<{
    weeklyStats: PlayerWeeklyStats[];
    seasonTotals: Record<string, number>;
    averagePointsPPR: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!playerId) {
      setStats(null);
      return;
    }

    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const response = await playerService.getPlayerStats(playerId, season);
        setStats(response);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch stats'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [playerId, season]);

  return { stats, isLoading, error };
}

export function useNews(limit: number = 20) {
  const [news, setNews] = useState<PlayerNews[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
      setIsLoading(true);
      try {
        const response = await playerService.getAllNews(limit);
        setNews(response.news);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch news'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchNews();
  }, [limit]);

  return { news, isLoading, error };
}

export function useInjuredPlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchInjured = async () => {
      setIsLoading(true);
      try {
        // Get players with injury statuses
        const response = await playerService.getPlayers({
          status: 'questionable',
          limit: 10,
        });
        setPlayers(response.players);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch injured players'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchInjured();
  }, []);

  return { players, isLoading, error };
}
