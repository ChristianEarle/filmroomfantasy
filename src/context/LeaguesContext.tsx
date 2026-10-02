import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { leagueService } from '../services';
import type { League } from '../services';
import { useAuth } from './AuthContext';

interface LeaguesContextType {
  leagues: League[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const LeaguesContext = createContext<LeaguesContextType | undefined>(undefined);

export function LeaguesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // The sign-in state the current `leagues` list was loaded for. Right after
  // login or logout the list still belongs to the previous state until the
  // refetch effect runs; reporting it as loaded would let consumers read a
  // signed-out empty list as "this user has no leagues".
  const [loadedFor, setLoadedFor] = useState<boolean | null>(null);

  const refetch = useCallback(async () => {
    // On a page refresh the saved session is restored asynchronously; until
    // it is, stay "loading" rather than reporting an empty list — consumers
    // treat a loaded empty list as "this user has no leagues".
    if (authLoading) {
      setIsLoading(true);
      return;
    }
    if (!isAuthenticated) {
      setLeagues([]);
      setLoadedFor(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await leagueService.getLeagues();
      setLeagues(response.leagues);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch leagues'));
    } finally {
      setLoadedFor(true);
      setIsLoading(false);
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const stale = !authLoading && loadedFor !== isAuthenticated;

  return (
    <LeaguesContext.Provider value={{ leagues, isLoading: isLoading || stale, error, refetch }}>
      {children}
    </LeaguesContext.Provider>
  );
}

export function useLeaguesContext() {
  const context = useContext(LeaguesContext);
  if (context === undefined) {
    throw new Error('useLeaguesContext must be used within a LeaguesProvider');
  }
  return context;
}
