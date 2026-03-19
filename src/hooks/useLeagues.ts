import { useState, useEffect, useCallback } from 'react';
import { leagueService } from '../services';
import type { League, LeagueDetails, Standing } from '../services';

export function useLeagues() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLeagues = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await leagueService.getLeagues();
      setLeagues(response.leagues);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch leagues'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeagues();
  }, [fetchLeagues]);

  return { leagues, isLoading, error, refetch: fetchLeagues };
}

export function useLeague(leagueId: string | null) {
  const [league, setLeague] = useState<LeagueDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchLeague = useCallback(async () => {
    if (!leagueId) {
      setLeague(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await leagueService.getLeague(leagueId);
      setLeague(response.league);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch league'));
    } finally {
      setIsLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchLeague();
  }, [fetchLeague]);

  return { league, isLoading, error, refetch: fetchLeague };
}

export function useStandings(leagueId: string | null) {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!leagueId) {
      setStandings([]);
      return;
    }

    const fetchStandings = async () => {
      setIsLoading(true);
      try {
        const response = await leagueService.getStandings(leagueId);
        setStandings(response.standings);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch standings'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchStandings();
  }, [leagueId]);

  return { standings, isLoading, error };
}

export function useCreateLeague() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createLeague = useCallback(async (data: {
    name: string;
    scoringFormat?: string;
    teamCount?: number;
    seasonYear?: number;
  }) => {
    setIsCreating(true);
    setError(null);
    try {
      const response = await leagueService.createLeague(data);
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create league');
      setError(error);
      throw error;
    } finally {
      setIsCreating(false);
    }
  }, []);

  return { createLeague, isCreating, error };
}

export function useJoinLeague() {
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const joinLeague = useCallback(async (leagueId: string, teamName?: string) => {
    setIsJoining(true);
    setError(null);
    try {
      const response = await leagueService.joinLeague(leagueId, teamName);
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to join league');
      setError(error);
      throw error;
    } finally {
      setIsJoining(false);
    }
  }, []);

  return { joinLeague, isJoining, error };
}
