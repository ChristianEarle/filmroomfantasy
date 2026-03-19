import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { useLeagueContext } from '../context/LeagueContext';
import api from '../services/api';
import { type APIPlayer, getDefaultSeason } from '../utils/playerUtils';

interface BiggestMoversProps {
  currentWeek: number;
  isDarkMode: boolean;
}

export function BiggestMovers({ currentWeek, isDarkMode }: BiggestMoversProps) {
  const { league } = useLeagueContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moversData, setMoversData] = useState<Array<{
    name: string;
    team: string;
    position?: string;
    previousProjectedPoints: number;
    projectedPoints: number;
    movement: number;
  }>>([]);

  const seasonYear = league?.seasonYear ?? getDefaultSeason();

  useEffect(() => {
    const fetchMovers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<{ movements: Array<{
          name: string;
          team: string;
          position: string;
          previousProjectedPoints: number;
          projectedPoints: number;
          movement: number;
        }> }>(
          `/players/projection-movements?week=${currentWeek}&season=${seasonYear}&scoringFormat=ppr&limit=5`
        );

        if (response.movements?.length) {
          setMoversData(response.movements);
          return;
        }

        // Fallback: use regular players API for top projected
        const fallback = await api.get<{ players: APIPlayer[] }>(
          `/players?page=1&limit=10&includeStats=true&week=${currentWeek}&season=${seasonYear}&sortBy=projectedPoints&sortOrder=desc${league?.id ? `&leagueId=${league.id}` : ''}`
        );
        const topPlayers = (fallback.players || [])
          .filter((p: APIPlayer) => p.projectedPoints > 0)
          .slice(0, 3);
        setMoversData(topPlayers.map((p: APIPlayer) => ({
          name: p.name,
          team: p.team,
          position: p.position,
          previousProjectedPoints: p.avgPointsPPR || 0,
          projectedPoints: p.projectedPoints,
          movement: p.projectedPoints - (p.avgPointsPPR || 0),
        })));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load moversData');
        setMoversData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMovers();
  }, [league?.id, currentWeek, seasonYear]);

  return (
    <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
      <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Biggest Movers (Week {currentWeek})</h3>
      <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        Players whose projections have moved the most.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" aria-label="Loading moversData" />
        </div>
      ) : error ? (
        <div className={`text-center py-8 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
          <p className="text-sm">{error || 'Failed to load projection movers'}</p>
        </div>
      ) : moversData.length === 0 ? (
        <div className={`text-center py-8 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          <p className="text-sm">No projection movement this week</p>
          <p className="text-xs mt-1">Sync your league to import projections.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {moversData.map((mover, index) => (
            <div
              key={`${mover.name}-${mover.team}-${index}`}
              className={`flex items-center justify-between p-4 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
            >
              <div className="flex-1">
                <div className={`text-sm mb-1 font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{mover.name}</div>
                <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {mover.team}{mover.position ? ` · ${mover.position}` : ''}
                </div>
                <div className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {(mover.movement ?? 0) !== 0
                    ? `${(mover.previousProjectedPoints ?? 0).toFixed(1)} → ${(mover.projectedPoints ?? 0).toFixed(1)} PPR (${(mover.movement ?? 0) >= 0 ? '+' : ''}${(mover.movement ?? 0).toFixed(1)})`
                    : `Proj: ${(mover.projectedPoints ?? 0).toFixed(1)} PPR`}
                </div>
              </div>

              <div className={`flex items-center gap-1.5 ${(mover.movement ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {(mover.movement ?? 0) >= 0 ? <TrendingUp className="w-4 h-4" aria-hidden="true" /> : <TrendingDown className="w-4 h-4" aria-hidden="true" />}
                <span className="text-sm font-bold">{(mover.projectedPoints ?? 0).toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
