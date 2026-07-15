import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export interface GameOdds {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeSpread: number | null;
  total: number | null;
  homeMoneyline: number | null;
  awayMoneyline: number | null;
}

export function useOdds(week: number, season: number) {
  const [odds, setOdds] = useState<GameOdds[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchOdds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Server envelope: { games: [{ gameId, homeTeam, awayTeam,
      //   spreads: { homePoint, ... } | null,
      //   totals: { overPoint, ... } | null,
      //   moneylines: { homePrice, awayPrice } | null }] }
      const response = await api.get<{
        games?: Array<{
          gameId: string;
          homeTeam: string;
          awayTeam: string;
          spreads: { homePoint: number | null } | null;
          totals: { overPoint: number | null } | null;
          moneylines: { homePrice: number | null; awayPrice: number | null } | null;
        }>;
      }>(`/games/odds?week=${week}&season=${season}`);

      const games = Array.isArray(response?.games) ? response.games : [];
      const oddsList: GameOdds[] = games.map((g) => ({
        gameId: g.gameId,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        homeSpread: g.spreads?.homePoint ?? null,
        total: g.totals?.overPoint ?? null,
        homeMoneyline: g.moneylines?.homePrice ?? null,
        awayMoneyline: g.moneylines?.awayPrice ?? null,
      }));
      setOdds(oddsList);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch odds');
      setError(error);
      setOdds([]);
    } finally {
      setLoading(false);
    }
  }, [week, season]);

  useEffect(() => {
    fetchOdds();
  }, [fetchOdds]);

  // Helper to find odds for a specific team (matches by home or away)
  const getOddsForTeam = (teamAbbr: string): GameOdds | null => {
    return odds.find(o => o.homeTeam === teamAbbr || o.awayTeam === teamAbbr) || null;
  };

  // Format spread string like "PHI -6.5" or "DAL +6.5"
  const formatSpread = (teamAbbr: string): string => {
    const gameOdds = getOddsForTeam(teamAbbr);
    if (!gameOdds || gameOdds.homeSpread === null) {
      return '—';
    }

    const isHome = gameOdds.homeTeam === teamAbbr;
    const spread = gameOdds.homeSpread;

    // If home team is favored (negative spread), show it
    // If away team is favored (positive spread), show negative for away team
    const displaySpread = isHome ? spread : -spread;
    const sign = displaySpread < 0 ? '' : '+';

    return `${teamAbbr} ${sign}${displaySpread}`;
  };

  // Format total string like "O/U 48.5"
  const formatTotal = (teamAbbr: string): string => {
    const gameOdds = getOddsForTeam(teamAbbr);
    if (!gameOdds || gameOdds.total === null) {
      return '—';
    }
    return `O/U ${gameOdds.total}`;
  };

  // Format moneyline string like "PHI -280 / DAL +230"
  const formatMoneyline = (): string => {
    if (odds.length === 0 || !odds[0]) return '—';
    const gameOdds = odds[0];
    if (
      gameOdds.homeMoneyline === null ||
      gameOdds.awayMoneyline === null
    ) {
      return '—';
    }
    const homeMl = gameOdds.homeMoneyline;
    const awayMl = gameOdds.awayMoneyline;
    const homeSign = homeMl < 0 ? '' : '+';
    const awaySign = awayMl < 0 ? '' : '+';
    return `${gameOdds.homeTeam} ${homeSign}${homeMl} / ${gameOdds.awayTeam} ${awaySign}${awayMl}`;
  };

  return {
    odds,
    loading,
    error,
    getOddsForTeam,
    formatSpread,
    formatTotal,
    formatMoneyline,
  };
}
