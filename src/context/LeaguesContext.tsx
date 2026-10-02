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
      setIsLoading(false);
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <LeaguesContext.Provider value={{ leagues, isLoading, error, refetch }}>
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
