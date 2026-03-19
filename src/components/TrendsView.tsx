import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Activity, Loader2, RefreshCw, ArrowUpRight, ArrowDownRight, Users, BarChart3 } from 'lucide-react';
import { Player } from '../App';
import { useLeagueContext } from '../context/LeagueContext';
import api from '../services/api';

interface TrendsViewProps {
  onPlayerClick: (player: Player) => void;
  isDarkMode: boolean;
}

interface TrendingPlayer {
  id: string;
  name: string;
  team: string;
  position: string;
  status: string;
  trendDirection: string;
  trendValue: number;
  ownedPct: number;
  ownedInLeague?: boolean;
  headshotUrl?: string | null;
  avgPointsPPR?: number;
  projectedPoints?: number;
}

interface ProjectionMover {
  playerId?: string;
  name: string;
  team: string;
  position: string;
  previousProjectedPoints: number;
  projectedPoints: number;
  movement: number;
}

type ActiveTab = 'trending' | 'projections';

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function TrendsView({ onPlayerClick, isDarkMode }: TrendsViewProps) {
  const { league } = useLeagueContext();
  const [activeTab, setActiveTab] = useState<ActiveTab>('trending');
  const [trendingUp, setTrendingUp] = useState<TrendingPlayer[]>([]);
  const [trendingDown, setTrendingDown] = useState<TrendingPlayer[]>([]);
  const [projectionMovers, setProjectionMovers] = useState<ProjectionMover[]>([]);
  const [projFilter, setProjFilter] = useState<'all' | 'up' | 'down'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentWeek = league?.currentWeek ?? 1;
  const getDefaultSeason = () => {
    const d = new Date();
    return d.getMonth() <= 2 ? d.getFullYear() - 1 : d.getFullYear();
  };
  const seasonYear = league?.seasonYear ?? getDefaultSeason();

  const leagueParam = league?.id ? `&leagueId=${league.id}` : '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [upRes, downRes, projRes] = await Promise.all([
        api.get<{ trending: TrendingPlayer[] }>(`/players/trending?direction=up${leagueParam}`),
        api.get<{ trending: TrendingPlayer[] }>(`/players/trending?direction=down${leagueParam}`),
        api.get<{ movements: ProjectionMover[] }>(
          `/players/projection-movements?week=${currentWeek}&season=${seasonYear}&scoringFormat=ppr&limit=20`
        ).catch(() => ({ movements: [] })),
      ]);

      setTrendingUp(upRes.trending || []);
      setTrendingDown(downRes.trending || []);
      setProjectionMovers(projRes.movements || []);
    } catch {
      setError('Failed to load trends data.');
      setTrendingUp([]);
      setTrendingDown([]);
      setProjectionMovers([]);
    } finally {
      setLoading(false);
    }
  }, [currentWeek, seasonYear, leagueParam]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const convertTrendingToPlayer = (p: TrendingPlayer): Player => ({
    id: p.id,
    rank: 1,
    name: p.name,
    team: p.team,
    position: p.position as 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF',
    keyLine: `${p.ownedPct}% owned`,
    projectedPoints: p.projectedPoints || p.avgPointsPPR || 0,
    weekChange: p.trendDirection === 'up' ? p.trendValue : -p.trendValue,
    headshotUrl: p.headshotUrl ?? null,
  });

  const convertMoverToPlayer = (m: ProjectionMover): Player => ({
    id: m.playerId || m.name,
    rank: 1,
    name: m.name || 'Unknown',
    team: m.team || '',
    position: (m.position as 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF') || 'WR',
    keyLine: `Proj: ${(m.projectedPoints ?? 0).toFixed(1)} pts`,
    projectedPoints: m.projectedPoints ?? 0,
    weekChange: m.movement ?? 0,
  });

  const filteredMovers = projectionMovers.filter(m => {
    if (projFilter === 'all') return true;
    return projFilter === 'up' ? m.movement > 0 : m.movement < 0;
  });

  const hasAnyData = trendingUp.length > 0 || trendingDown.length > 0 || projectionMovers.length > 0;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
        <div className={`p-6 border-b ${isDarkMode ? 'border-[#222]' : 'border-slate-200'}`}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-5 h-5 text-blue-500" />
                <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Trends & Movements</h1>
              </div>
              <p className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
                Most added/dropped players across Sleeper{league ? ` • ${league.name}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className={`px-4 py-2 rounded-lg ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-slate-100'}`}>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-600'}`}>{trendingUp.length} Rising</span>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-lg ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-slate-100'}`}>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-600'}`}>{trendingDown.length} Falling</span>
                </div>
              </div>
              <button
                onClick={fetchData}
                disabled={loading}
                className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-[#1a1a1a] text-[#737373]' : 'hover:bg-slate-100 text-[#555]'}`}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={`px-6 py-3 flex items-center gap-2 ${isDarkMode ? 'bg-[#1a1a1a]/30' : 'bg-slate-50'}`}>
          <span className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>View:</span>
          <button
            onClick={() => setActiveTab('trending')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'trending'
                ? 'bg-blue-600 text-white'
                : isDarkMode ? 'bg-[#1a1a1a] text-[#a3a3a3] hover:bg-[#1a1a1a]' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Roster Trends
          </button>
          <button
            onClick={() => setActiveTab('projections')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'projections'
                ? 'bg-blue-600 text-white'
                : isDarkMode ? 'bg-[#1a1a1a] text-[#a3a3a3] hover:bg-[#1a1a1a]' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Projection Movers
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className={`rounded-lg border p-12 flex items-center justify-center ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : error || !hasAnyData ? (
        <div className={`rounded-lg border p-12 text-center ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
          <Activity className={`w-10 h-10 mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-[#a3a3a3]'}`} />
          <h3 className={`font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>No trend data available</h3>
          <p className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
            {error || 'Could not load trending data. Try refreshing.'}
          </p>
        </div>
      ) : activeTab === 'trending' ? (
        /* Trending Tab — two-column: Most Added / Most Dropped */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Most Added */}
          <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
            <div className={`px-6 py-4 border-b flex items-center gap-2 ${isDarkMode ? 'border-[#222]' : 'border-slate-200'}`}>
              <ArrowUpRight className="w-4 h-4 text-green-500" />
              <h2 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Most Added</h2>
              <span className={`text-xs ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>Last 14 days</span>
            </div>
            <div className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {trendingUp.length === 0 ? (
                <div className={`p-8 text-center text-sm ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>
                  No trending adds found
                </div>
              ) : trendingUp.map((player, i) => (
                <button
                  key={player.id}
                  onClick={() => onPlayerClick(convertTrendingToPlayer(player))}
                  className={`w-full px-6 py-3 text-left transition-colors flex items-center gap-3 ${isDarkMode ? 'hover:bg-[#1a1a1a]' : 'hover:bg-slate-50'}`}
                >
                  <span className={`text-xs font-mono w-5 text-center ${isDarkMode ? 'text-slate-600' : 'text-[#737373]'}`}>{i + 1}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isDarkMode ? 'bg-[#1a1a1a] text-[#a3a3a3]' : 'bg-slate-100 text-slate-600'}`}>
                    {(player.name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.name || 'Unknown'}</span>
                      {player.ownedInLeague && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>ROSTERED</span>
                      )}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>
                      {player.team} • {player.position}
                      {player.avgPointsPPR ? ` • ${player.avgPointsPPR} PPR/g` : ''}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-green-500 text-sm font-bold flex items-center gap-0.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      +{formatCount(player.trendValue)}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>adds</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Most Dropped */}
          <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
            <div className={`px-6 py-4 border-b flex items-center gap-2 ${isDarkMode ? 'border-[#222]' : 'border-slate-200'}`}>
              <ArrowDownRight className="w-4 h-4 text-red-500" />
              <h2 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Most Dropped</h2>
              <span className={`text-xs ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>Last 14 days</span>
            </div>
            <div className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {trendingDown.length === 0 ? (
                <div className={`p-8 text-center text-sm ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>
                  No trending drops found
                </div>
              ) : trendingDown.map((player, i) => (
                <button
                  key={player.id}
                  onClick={() => onPlayerClick(convertTrendingToPlayer(player))}
                  className={`w-full px-6 py-3 text-left transition-colors flex items-center gap-3 ${isDarkMode ? 'hover:bg-[#1a1a1a]' : 'hover:bg-slate-50'}`}
                >
                  <span className={`text-xs font-mono w-5 text-center ${isDarkMode ? 'text-slate-600' : 'text-[#737373]'}`}>{i + 1}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isDarkMode ? 'bg-[#1a1a1a] text-[#a3a3a3]' : 'bg-slate-100 text-slate-600'}`}>
                    {(player.name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.name || 'Unknown'}</span>
                      {player.ownedInLeague && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${isDarkMode ? 'bg-amber-600/20 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>ROSTERED</span>
                      )}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>
                      {player.team} • {player.position}
                      {player.avgPointsPPR ? ` • ${player.avgPointsPPR} PPR/g` : ''}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-red-500 text-sm font-bold flex items-center gap-0.5">
                      <TrendingDown className="w-3.5 h-3.5" />
                      -{formatCount(player.trendValue)}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>drops</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Projections Tab — biggest movers */
        <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
          <div className={`px-6 py-4 border-b flex items-center justify-between ${isDarkMode ? 'border-[#222]' : 'border-slate-200'}`}>
            <h2 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Biggest Projection Movers — Week {currentWeek}
            </h2>
            <div className="flex items-center gap-2">
              {(['all', 'up', 'down'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setProjFilter(f)}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    projFilter === f
                      ? 'bg-blue-600 text-white'
                      : isDarkMode ? 'bg-[#1a1a1a] text-[#a3a3a3] hover:bg-[#1a1a1a]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'up' ? '↑ Up' : '↓ Down'}
                </button>
              ))}
            </div>
          </div>

          <div className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
            {filteredMovers.length === 0 ? (
              <div className={`p-12 text-center ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No projection changes found for this week.</p>
                <p className="text-xs mt-1">Sync your league to import projections.</p>
              </div>
            ) : filteredMovers.map((mover, i) => {
              const isUp = mover.movement > 0;
              return (
                <button
                  key={mover.playerId || `${mover.name}-${i}`}
                  onClick={() => onPlayerClick(convertMoverToPlayer(mover))}
                  className={`w-full px-6 py-3 text-left transition-colors flex items-center gap-4 ${isDarkMode ? 'hover:bg-[#1a1a1a]' : 'hover:bg-slate-50'}`}
                >
                  <span className={`text-xs font-mono w-5 text-center ${isDarkMode ? 'text-slate-600' : 'text-[#737373]'}`}>{i + 1}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isDarkMode ? 'bg-[#1a1a1a] text-[#a3a3a3]' : 'bg-slate-100 text-slate-600'}`}>
                    {(mover.name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{mover.name || 'Unknown'}</div>
                    <div className={`text-xs ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>
                      {mover.team} • {mover.position}
                      <span className="mx-1">•</span>
                      <span className={isDarkMode ? 'text-slate-600' : 'text-[#a3a3a3]'}>{(mover.previousProjectedPoints ?? 0).toFixed(1)}</span>
                      <span className="mx-1">→</span>
                      <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{(mover.projectedPoints ?? 0).toFixed(1)} pts</span>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg flex-shrink-0 ${
                    isUp ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                  }`}>
                    {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span className="font-semibold text-sm">{isUp ? '+' : ''}{(mover.movement ?? 0).toFixed(1)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
