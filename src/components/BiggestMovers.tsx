import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { useLeagueContext } from '../context/LeagueContext';
import api from '../services/api';
import { type APIPlayer, getDefaultSeason } from '../utils/playerUtils';

interface BiggestMoversProps {
  currentWeek: number;
  isDarkMode: boolean;
}

interface MoverData {
  name: string;
  team: string;
  position?: string;
  previousProjectedPoints: number;
  projectedPoints: number;
  movement: number;
}

interface PerformerData {
  name: string;
  team: string;
  position?: string;
  projectedPoints: number;
  actualPoints: number;
  difference: number;
  isOverperformer: boolean;
}

export function BiggestMovers({ currentWeek, isDarkMode }: BiggestMoversProps) {
  const { league } = useLeagueContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWeekComplete, setIsWeekComplete] = useState(false);
  const [moversData, setMoversData] = useState<MoverData[]>([]);
  const [performersData, setPerformersData] = useState<PerformerData[]>([]);

  const seasonYear = league?.seasonYear ?? getDefaultSeason();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // First, check if the week is complete by fetching players for this week
        const weekCheckResponse = await api.get<{
          players?: APIPlayer[];
          weekComplete?: boolean;
          pointsType?: 'actual' | 'projected';
        }>(
          `/players?page=1&limit=5&includeStats=true&week=${currentWeek}&season=${seasonYear}&sortBy=projectedPoints&sortOrder=desc${league?.id ? `&leagueId=${league.id}` : ''}`
        );

        const weekComplete = weekCheckResponse?.pointsType === 'actual' || weekCheckResponse?.weekComplete === true;
        setIsWeekComplete(weekComplete);

        if (weekComplete) {
          // Fetch all players to find over/underperformers
          const allPlayersResponse = await api.get<{ players: APIPlayer[] }>(
            `/players?page=1&limit=350&includeStats=true&week=${currentWeek}&season=${seasonYear}&scoringFormat=ppr${league?.id ? `&leagueId=${league.id}` : ''}`
          );

          const players = allPlayersResponse.players || [];

          // Calculate actual vs projected for this week
          const performers: PerformerData[] = players
            .filter((p: APIPlayer) => {
              // Only include players with both projected and actual points
              const actual = p.seasonStats?.fantasyPointsPPR || 0;
              const projected = p.projectedPoints || 0;
              return actual > 0 && projected > 0;
            })
            .map((p: APIPlayer) => {
              const projected = p.projectedPoints || 0;
              const actual = p.seasonStats?.fantasyPointsPPR || 0;
              const difference = actual - projected;
              return {
                name: p.name,
                team: p.team,
                position: p.position,
                projectedPoints: projected,
                actualPoints: actual,
                difference,
                isOverperformer: difference > 0,
              };
            })
            .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

          // Separate and get top 3 of each
          const overperformers = performers.filter(p => p.isOverperformer).slice(0, 3);
          const underperformers = performers.filter(p => !p.isOverperformer).slice(0, 3);
          setPerformersData([...overperformers, ...underperformers]);
        } else {
          // Fetch projection movers as before
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
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setMoversData([]);
        setPerformersData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [league?.id, currentWeek, seasonYear]);

  return (
    <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
      <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
        {isWeekComplete ? 'Over/Under Performers' : 'Biggest Movers'} (Week {currentWeek})
      </h3>
      <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        {isWeekComplete
          ? 'Players who exceeded or fell short of their projections.'
          : 'Players whose projections have moved the most.'}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" aria-label="Loading data" />
        </div>
      ) : error ? (
        <div className={`text-center py-8 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
          <p className="text-sm">{error}</p>
        </div>
      ) : isWeekComplete ? (
        performersData.length === 0 ? (
          <div className={`text-center py-8 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            <p className="text-sm">No performance data available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {performersData.map((performer, index) => (
              <div
                key={`${performer.name}-${performer.team}-${index}`}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  performer.isOverperformer
                    ? isDarkMode ? 'bg-slate-800 border-green-900/30' : 'bg-green-50 border-green-200'
                    : isDarkMode ? 'bg-slate-800 border-red-900/30' : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex-1">
                  <div className={`text-sm mb-1 font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {performer.name}
                  </div>
                  <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {performer.team}{performer.position ? ` · ${performer.position}` : ''}
                  </div>
                  <div className={`text-xs mt-1 ${
                    performer.isOverperformer
                      ? isDarkMode ? 'text-green-400' : 'text-green-700'
                      : isDarkMode ? 'text-red-400' : 'text-red-700'
                  }`}>
                    Projected {performer.projectedPoints.toFixed(1)}, Scored {performer.actualPoints.toFixed(1)} ({performer.difference >= 0 ? '+' : ''}{performer.difference.toFixed(1)})
                  </div>
                </div>

                <div className={`flex items-center gap-1.5 ${performer.isOverperformer ? 'text-green-500' : 'text-red-500'}`}>
                  {performer.isOverperformer ? (
                    <TrendingUp className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span className="text-sm font-bold">{performer.actualPoints.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        )
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
