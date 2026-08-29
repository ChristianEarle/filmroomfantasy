import { useState, useEffect, useCallback, useRef } from 'react';
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
  // Monotonic sequence so a slow response for an old week can't clobber
  // the state of a newer request.
  const fetchSeqRef = useRef(0);

  const fetchScoreboard = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    setIsLoading(true);
    setError(null);
    setEspnUnavailable(false);
    try {
      const response = await gameService.getEspnScoreboard(week, season, seasonType);
      if (seq !== fetchSeqRef.current) return;
      setGames(response.games);
      setWeekNum(response.week);
      setSeasonYear(response.season);
      setWeekLabel(response.weekLabel ?? `Week ${response.week}`);
      setEspnUnavailable(!!(response as Record<string, unknown>)._espnUnavailable);
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      setError(err instanceof Error ? err : new Error('Failed to fetch scoreboard'));
      setGames([]);
    } finally {
      if (seq === fetchSeqRef.current) setIsLoading(false);
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
  const fetchSeqRef = useRef(0);

  const fetchGames = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const response = await gameService.getWeekGames(week, season);
      if (seq !== fetchSeqRef.current) return;
      setGames(response.games);
      setGamesByDay(response.gamesByDay);
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      setError(err instanceof Error ? err : new Error('Failed to fetch games'));
    } finally {
      if (seq === fetchSeqRef.current) setIsLoading(false);
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
  const fetchSeqRef = useRef(0);

  // `background` skips the loading spinner — used by the live-game poll below
  // so a routine refresh doesn't flash the full-screen loader every 30s.
  const fetchGame = useCallback(async (background = false) => {
    if (!gameId) return;
    const seq = ++fetchSeqRef.current;
    if (!background) setIsLoading(true);
    try {
      const response = await gameService.getGame(gameId);
      if (seq !== fetchSeqRef.current) return;
      setGame(response.game);
      setHomePlayers(response.homePlayers);
      setAwayPlayers(response.awayPlayers);
      setError(null);
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      setError(err instanceof Error ? err : new Error('Failed to fetch game'));
    } finally {
      if (seq === fetchSeqRef.current && !background) setIsLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    // Reset stale data whenever the target game changes so the previous
    // game's detail never flashes under a new id.
    setGame(null);
    setHomePlayers([]);
    setAwayPlayers([]);
    setError(null);
    if (!gameId) {
      setIsLoading(false);
      return;
    }
    fetchGame();
  }, [gameId, fetchGame]);

  // Keep scores/stats live while the game is in progress. Without this, a
  // modal left open through kickoff or the final whistle stays frozen at
  // whatever data was fetched when it was first opened.
  useEffect(() => {
    if (!game || game.isComplete) return;
    if (new Date(game.gameTime).getTime() > Date.now()) return; // hasn't kicked off yet
    const tick = () => {
      if (document.visibilityState === 'visible') fetchGame(true);
    };
    const intervalId = setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [game?.id, game?.isComplete, game?.gameTime, fetchGame]);

  return { game, homePlayers, awayPlayers, isLoading, error, refetch: fetchGame };
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
    let cancelled = false;
    const fetchGames = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await gameService.getUpcomingGames(limit);
        if (cancelled) return;
        setGames(response.games);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('Failed to fetch upcoming games'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchGames();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { games, isLoading, error };
}

export function useTeamSchedule(team: string | null, season?: number) {
  const [schedule, setSchedule] = useState<TeamScheduleGame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setSchedule([]);
    setError(null);
    if (!team) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const fetchSchedule = async () => {
      setIsLoading(true);
      try {
        const response = await gameService.getTeamSchedule(team, season);
        if (cancelled) return;
        setSchedule(response.schedule);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('Failed to fetch schedule'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchSchedule();
    return () => {
      cancelled = true;
    };
  }, [team, season]);

  return { schedule, isLoading, error };
}
