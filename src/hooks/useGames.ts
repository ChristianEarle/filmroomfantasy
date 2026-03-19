import { useState, useEffect, useCallback } from 'react';
import { gameService } from '../services';
import type { NFLGame, GamesByDay, LiveScore, EspnScoreboardGame, TeamScheduleGame } from '../services';

export function useEspnScoreboard(week?: number, season?: number, seasonType?: number) {
  const [games, setGames] = useState<EspnScoreboardGame[]>([]);
  const [weekNum, setWeekNum] = useState<number | null>(null);
  const [seasonYear, setSeasonYear] = useState<number | null>(null);
  const [weekLabel, setWeekLabel] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [espnUnavailable, setEspnUnavailable] = useState(false);

  const fetchScoreboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setEspnUnavailable(false);
    try {
      const response = await gameService.getEspnScoreboard(week, season, seasonType);
      setGames(response.games);
      setWeekNum(response.week);
      setSeasonYear(response.season);
      setWeekLabel(response.weekLabel ?? `Week ${response.week}`);
      setEspnUnavailable(!!(response as Record<string, unknown>)._espnUnavailable);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch scoreboard'));
      setGames([]);
    } finally {
      setIsLoading(false);
    }
  }, [week, season, seasonType]);

  useEffect(() => {
    fetchScoreboard();
  }, [fetchScoreboard]);

  return { games, week: weekNum, season: seasonYear, weekLabel, isLoading, error, espnUnavailable, refetch: fetchScoreboard };
}

export function useWeekGames(week: number, season?: number) {
  const [games, setGames] = useState<NFLGame[]>([]);
  const [gamesByDay, setGamesByDay] = useState<GamesByDay>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchGames = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await gameService.getWeekGames(week, season);
      setGames(response.games);
      setGamesByDay(response.gamesByDay);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch games'));
    } finally {
      setIsLoading(false);
    }
  }, [week, season]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  return { games, gamesByDay, isLoading, error, refetch: fetchGames };
}

export function useGame(gameId: string | null) {
  const [game, setGame] = useState<NFLGame | null>(null);
  const [homePlayers, setHomePlayers] = useState<import('../services').Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<import('../services').Player[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!gameId) {
      setGame(null);
      return;
    }

    const fetchGame = async () => {
      setIsLoading(true);
      try {
        const response = await gameService.getGame(gameId);
        setGame(response.game);
        setHomePlayers(response.homePlayers);
        setAwayPlayers(response.awayPlayers);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch game'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchGame();
  }, [gameId]);

  return { game, homePlayers, awayPlayers, isLoading, error };
}

export function useLiveScores(pollInterval: number = 30000) {
  const [liveScores, setLiveScores] = useState<LiveScore[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLiveScores = useCallback(async () => {
    try {
      const response = await gameService.getLiveScores();
      setLiveScores(response.games);
      setLastUpdated(response.lastUpdated);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch live scores'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveScores();

    // Set up polling
    const interval = setInterval(fetchLiveScores, pollInterval);

    return () => clearInterval(interval);
  }, [fetchLiveScores, pollInterval]);

  return { liveScores, lastUpdated, isLoading, error, refetch: fetchLiveScores };
}

export function useUpcomingGames(limit?: number) {
  const [games, setGames] = useState<NFLGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchGames = async () => {
      setIsLoading(true);
      try {
        const response = await gameService.getUpcomingGames(limit);
        setGames(response.games);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch upcoming games'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchGames();
  }, [limit]);

  return { games, isLoading, error };
}

export function useTeamSchedule(team: string | null, season?: number) {
  const [schedule, setSchedule] = useState<TeamScheduleGame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!team) {
      setSchedule([]);
      return;
    }

    const fetchSchedule = async () => {
      setIsLoading(true);
      try {
        const response = await gameService.getTeamSchedule(team, season);
        setSchedule(response.schedule);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch schedule'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchedule();
  }, [team, season]);

  return { schedule, isLoading, error };
}
