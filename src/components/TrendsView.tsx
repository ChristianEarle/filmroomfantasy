import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TrendingUp, TrendingDown, Activity, Loader2, RefreshCw, ArrowUpRight, ArrowDownRight, Users, BarChart3, Trophy } from 'lucide-react';
import { Player } from '../App';
import { useLeagueContext } from '../context/LeagueContext';
import api from '../services/api';
import { getEffectiveSeason } from '../utils/playerUtils';

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
  source: 'props' | 'sleeper';
  previousProjectedPoints: number;
  projectedPoints: number;
  movement: number;
}

interface RecentLeader {
  id: string;
  name: string;
  team: string;
  position: string;
  headshotUrl: string | null;
  games: number;
  ppg: number;
  seasonPpg: number;
  delta: number;
  posRank: number;
  ownedPct: number | null;
  ownedInLeague: boolean | null;
  tradeTarget: boolean;
}

interface RecentLeadersResponse {
  window: '1' | '3' | 'stf';
  weeks: number[];
  latestWeek: number;
  leaders: RecentLeader[];
  season: number;
  position: string | null;
  leagueId: string | null;
  limit: number;
}

type ActiveTab = 'trending' | 'projections' | 'leaders';

const VALID_POSITIONS = new Set<Player['position']>(['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'FLEX']);
const TREND_WINDOW = 'Last 14 days';
const FILTER_OPTIONS = ['All', 'Up', 'Down'] as const;

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

  const [leaders, setLeaders] = useState<RecentLeader[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(false);
  const [leadersError, setLeadersError] = useState<string | null>(null);
  const [leadersWindow, setLeadersWindow] = useState<'1' | '3' | 'stf'>('3');
  const [leadersPosFilter, setLeadersPosFilter] = useState<'ALL' | 'QB' | 'RB' | 'WR' | 'TE'>('ALL');
  const leadersFetchVersion = useRef(0);
  const fetchDataVersion = useRef(0);

  const currentWeek = league?.currentWeek;
  const seasonYear = getEffectiveSeason(league?.seasonYear);

  const leagueParam = useMemo(() => league?.id ? `&leagueId=${league.id}` : '', [league?.id]);

  const fetchData = useCallback(async () => {
    // Request-version guard prevents a slow earlier response from clobbering a newer one
    // when the user switches leagues / season rapidly.
    const version = ++fetchDataVersion.current;
    setLoading(true);
    setError(null);
    try {
      // Skip the projections call when there's no league/week — otherwise it fires with week=1 against the wrong season
      // and silently returns an empty list, which the UI then misreports as "no projection changes."
      const projPromise = (currentWeek != null && league?.id != null)
        ? api.get<{ movements: ProjectionMover[] }>(
            `/players/projection-movements?week=${currentWeek}&season=${seasonYear}&scoringFormat=ppr&limit=20`
          ).catch((err) => {
            console.warn('Failed to fetch projection movements:', err);
            return { movements: [] };
          })
        : Promise.resolve({ movements: [] });

      const [upRes, downRes, projRes] = await Promise.all([
        api.get<{ trending: TrendingPlayer[] }>(`/players/trending?direction=up${leagueParam}`),
        api.get<{ trending: TrendingPlayer[] }>(`/players/trending?direction=down${leagueParam}`),
        projPromise,
      ]);

      if (version !== fetchDataVersion.current) return;
      setTrendingUp(upRes.trending || []);
      setTrendingDown(downRes.trending || []);
      setProjectionMovers(projRes.movements || []);
    } catch (err) {
      if (version !== fetchDataVersion.current) return;
      console.error('Failed to load trends data:', err);
      setError('Failed to load trends data.');
      setTrendingUp([]);
      setTrendingDown([]);
      setProjectionMovers([]);
    } finally {
      if (version === fetchDataVersion.current) setLoading(false);
    }
  }, [currentWeek, seasonYear, leagueParam, league?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Lazy fetch for the Recent Best Performers tab.
  // Request-version counter prevents stale responses from clobbering newer ones on rapid tab switches or chip clicks.
  const fetchLeaders = useCallback(() => {
    const version = ++leadersFetchVersion.current;
    const positionParam = leadersPosFilter === 'ALL' ? '' : `&position=${leadersPosFilter}`;
    setLeadersLoading(true);
    setLeadersError(null);
    api
      .get<RecentLeadersResponse>(
        `/players/recent-leaders?window=${leadersWindow}&season=${seasonYear}${leagueParam}${positionParam}&limit=25`
      )
      .then((res) => {
        if (version !== leadersFetchVersion.current) return;
        setLeaders(res.leaders || []);
      })
      .catch((err) => {
        if (version !== leadersFetchVersion.current) return;
        console.error('Failed to load recent leaders:', err);
        setLeadersError('Failed to load recent leaders.');
        setLeaders([]);
      })
      .finally(() => {
        if (version === leadersFetchVersion.current) setLeadersLoading(false);
      });
  }, [leadersWindow, leadersPosFilter, seasonYear, leagueParam]);

  useEffect(() => {
    if (activeTab !== 'leaders') return;
    fetchLeaders();
  }, [activeTab, fetchLeaders]);

  const handleRefresh = useCallback(() => {
    fetchData();
    if (activeTab === 'leaders') fetchLeaders();
  }, [activeTab, fetchData, fetchLeaders]);

  const convertTrendingToPlayer = (p: TrendingPlayer, index: number): Player => {
    const position = VALID_POSITIONS.has(p.position as Player['position'])
      ? (p.position as Player['position'])
      : 'FLEX';
    return {
      id: p.id,
      rank: index + 1,
      name: p.name,
      team: p.team,
      position,
      // ownedPct is only meaningful when a league is connected — without one, every value is 0 (no data).
      // Fall back to "Trending" so the modal doesn't claim every player is 0% owned.
      keyLine: league?.id ? `${p.ownedPct}% owned` : 'Trending',
      projectedPoints: p.projectedPoints || p.avgPointsPPR || 0,
      weekChange: p.trendDirection === 'up' ? p.trendValue : p.trendDirection === 'down' ? -p.trendValue : 0,
      headshotUrl: p.headshotUrl ?? null,
    };
  };

  const convertMoverToPlayer = (m: ProjectionMover, index: number): Player => {
    const position = VALID_POSITIONS.has(m.position as Player['position'])
      ? (m.position as Player['position'])
      : 'FLEX';
    return {
      id: m.playerId || `${m.name}-${m.team}-${m.position}`,
      rank: index + 1,
      name: m.name || 'Unknown',
      team: m.team || '',
      position,
      keyLine: `Proj: ${(m.projectedPoints ?? 0).toFixed(1)} pts`,
      projectedPoints: m.projectedPoints ?? 0,
      weekChange: m.movement ?? 0,
    };
  };

  const filteredMovers = useMemo(() =>
    projectionMovers.filter(m => {
      if (projFilter === 'all') return true;
      return projFilter === 'up' ? m.movement > 0 : m.movement < 0;
    }),
    [projectionMovers, projFilter]
  );

  const convertLeaderToPlayer = (l: RecentLeader, index: number): Player => {
    const position = VALID_POSITIONS.has(l.position as Player['position'])
      ? (l.position as Player['position'])
      : 'FLEX';
    return {
      id: l.id,
      rank: index + 1,
      name: l.name,
      team: l.team,
      position,
      keyLine: `${l.ppg.toFixed(1)} PPR/g`,
      projectedPoints: l.ppg,
      weekChange: l.delta,
      headshotUrl: l.headshotUrl,
    };
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-4 sm:p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-5 h-5 text-blue-500" />
                <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Trends & Movements</h1>
              </div>
              <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Most added/dropped players across Sleeper{league ? ` • ${league.name}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className={`px-4 py-2 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{trendingUp.length} Rising</span>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{trendingDown.length} Falling</span>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                disabled={loading || leadersLoading}
                aria-label="Refresh trends data"
                className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <RefreshCw className={`w-4 h-4 ${(loading || leadersLoading) ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={`px-6 py-3 flex items-center gap-2 ${isDarkMode ? 'bg-slate-800/30' : 'bg-slate-50'}`} role="tablist">
          <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>View:</span>
          <button
            role="tab"
            aria-selected={activeTab === 'trending'}
            aria-controls="panel-trending"
            onClick={() => setActiveTab('trending')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'trending'
                ? 'bg-blue-600 text-white'
                : isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Roster Trends
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'projections'}
            aria-controls="panel-projections"
            onClick={() => setActiveTab('projections')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'projections'
                ? 'bg-blue-600 text-white'
                : isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Projection Movers
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'leaders'}
            aria-controls="panel-leaders"
            onClick={() => setActiveTab('leaders')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'leaders'
                ? 'bg-blue-600 text-white'
                : isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Recent Best Performers
          </button>
        </div>
      </div>

      {/* Non-blocking error banner — shows when fetchData failed but doesn't hide the tab panels. */}
      {error && (
        <div
          role="alert"
          className={`rounded-lg border px-4 py-3 text-sm ${
            isDarkMode ? 'bg-red-950/30 border-red-900 text-red-300' : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {error.replace(/\.$/, '')} — try refreshing.
        </div>
      )}

      {/* Leaders tab is checked first so the global loader (driven by the trending fetch) doesn't mask the leaders panel during initial mount. */}
      {activeTab === 'leaders' ? (
        /* Leaders Tab — Recent Best Performers with window + position toggles */
        <div id="panel-leaders" role="tabpanel" className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h2 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Recent Best Performers</h2>
                <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {leadersWindow === '1' ? 'Last week' : leadersWindow === '3' ? 'Last 3 weeks' : 'Season to date'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1" data-testid="leaders-window-toggle">
                  {(['1', '3', 'stf'] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => setLeadersWindow(w)}
                      aria-pressed={leadersWindow === w}
                      data-testid={`window-${w}`}
                      className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                        leadersWindow === w
                          ? 'bg-blue-600 text-white'
                          : isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {w === '1' ? '1W' : w === '3' ? '3W' : 'STF'}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1" data-testid="leaders-position-filter">
                  {(['ALL', 'QB', 'RB', 'WR', 'TE'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setLeadersPosFilter(p)}
                      aria-pressed={leadersPosFilter === p}
                      data-testid={`position-${p}`}
                      className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                        leadersPosFilter === p
                          ? 'bg-blue-600 text-white'
                          : isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {leadersLoading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" role="status" aria-label="Loading recent leaders" />
            </div>
          ) : leadersError ? (
            <div className={`p-12 text-center ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{leadersError}</p>
              <p className="text-xs mt-1">Try refreshing or come back later.</p>
            </div>
          ) : leaders.length === 0 ? (
            <div className={`p-12 text-center ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent leaders yet.</p>
              <p className="text-xs mt-1">Weekly stats appear after games finalize.</p>
            </div>
          ) : (
            <div className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {leaders.map((leader, i) => (
                <button
                  key={leader.id}
                  onClick={() => onPlayerClick(convertLeaderToPlayer(leader, i))}
                  aria-label={`View ${leader.name} details`}
                  data-testid={`leader-${i}`}
                  className={`w-full px-6 py-3 text-left transition-colors flex items-center gap-3 ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}
                >
                  <span className={`text-xs font-mono w-5 text-center ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>{i + 1}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                    {(leader.name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{leader.name || 'Unknown'}</span>
                      {leader.tradeTarget && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${isDarkMode ? 'bg-green-600/20 text-green-400' : 'bg-green-50 text-green-700'}`}>TRADE TARGET</span>
                      )}
                      {leader.ownedInLeague === true && !leader.tradeTarget && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>ROSTERED</span>
                      )}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {leader.team} • {leader.position ? `${leader.position}${leader.posRank}` : '—'}
                      <span className="mx-1">•</span>
                      {leader.games} {leader.games === 1 ? 'game' : 'games'}
                      {leader.ownedPct !== null && (
                        <>
                          <span className="mx-1">•</span>
                          {leader.ownedPct}% owned
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 flex items-center gap-3">
                    {leader.delta !== 0 && (
                      <div className={`flex items-center gap-0.5 text-xs font-semibold ${leader.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {leader.delta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {leader.delta > 0 ? '+' : ''}{leader.delta.toFixed(1)}
                      </div>
                    )}
                    <div>
                      <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{leader.ppg.toFixed(1)}</div>
                      <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>PPR/g</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <div className={`rounded-lg border p-12 flex items-center justify-center ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" role="status" aria-label="Loading trends data" />
        </div>
      ) : activeTab === 'trending' ? (
        /* Trending Tab — two-column: Most Added / Most Dropped */
        <div id="panel-trending" role="tabpanel" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Most Added */}
          <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className={`px-6 py-4 border-b flex items-center gap-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <ArrowUpRight className="w-4 h-4 text-green-500" />
              <h2 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Most Added</h2>
              <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{TREND_WINDOW}</span>
            </div>
            <div className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {trendingUp.length === 0 ? (
                <div className={`p-8 text-center text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  No trending adds found
                </div>
              ) : trendingUp.map((player, i) => (
                <button
                  key={player.id}
                  onClick={() => onPlayerClick(convertTrendingToPlayer(player, i))}
                  aria-label={`View ${player.name} details`}
                  data-testid={`trending-up-${i}`}
                  className={`w-full px-6 py-3 text-left transition-colors flex items-center gap-3 ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}
                >
                  <span className={`text-xs font-mono w-5 text-center ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>{i + 1}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                    {(player.name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.name || 'Unknown'}</span>
                      {player.ownedInLeague && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>ROSTERED</span>
                      )}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {player.team} • {player.position}
                      {player.avgPointsPPR ? ` • ${player.avgPointsPPR} PPR/g` : ''}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-green-500 text-sm font-bold flex items-center gap-0.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      +{formatCount(player.trendValue)}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>adds</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Most Dropped */}
          <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className={`px-6 py-4 border-b flex items-center gap-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <ArrowDownRight className="w-4 h-4 text-red-500" />
              <h2 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Most Dropped</h2>
              <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{TREND_WINDOW}</span>
            </div>
            <div className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {trendingDown.length === 0 ? (
                <div className={`p-8 text-center text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  No trending drops found
                </div>
              ) : trendingDown.map((player, i) => (
                <button
                  key={player.id}
                  onClick={() => onPlayerClick(convertTrendingToPlayer(player, i))}
                  aria-label={`View ${player.name} details`}
                  data-testid={`trending-down-${i}`}
                  className={`w-full px-6 py-3 text-left transition-colors flex items-center gap-3 ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}
                >
                  <span className={`text-xs font-mono w-5 text-center ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>{i + 1}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                    {(player.name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.name || 'Unknown'}</span>
                      {player.ownedInLeague && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${isDarkMode ? 'bg-amber-600/20 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>ROSTERED</span>
                      )}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {player.team} • {player.position}
                      {player.avgPointsPPR ? ` • ${player.avgPointsPPR} PPR/g` : ''}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-red-500 text-sm font-bold flex items-center gap-0.5">
                      <TrendingDown className="w-3.5 h-3.5" />
                      -{formatCount(player.trendValue)}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>drops</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Projections Tab — biggest movers */
        <div id="panel-projections" role="tabpanel" className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`px-6 py-4 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <h2 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Biggest Projection Movers{currentWeek ? ` — Week ${currentWeek}` : ''}
            </h2>
            <div className="flex items-center gap-2" data-testid="projection-filters">
              {FILTER_OPTIONS.map((f) => {
                const filterKey = f.toLowerCase() as 'all' | 'up' | 'down';
                return (
                  <button
                    key={f}
                    onClick={() => setProjFilter(filterKey)}
                    aria-pressed={projFilter === filterKey}
                    data-testid={`filter-${filterKey}`}
                    className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                      projFilter === filterKey
                        ? 'bg-blue-600 text-white'
                        : isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f === 'All' ? 'All' : f === 'Up' ? '↑ Up' : '↓ Down'}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
            {filteredMovers.length === 0 ? (
              <div className={`p-12 text-center ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No projection changes found for this week.</p>
                <p className="text-xs mt-1">Sync your league to import projections.</p>
              </div>
            ) : filteredMovers.map((mover, i) => {
              const isUp = mover.movement > 0;
              return (
                <button
                  key={mover.playerId || `${mover.name}-${i}`}
                  onClick={() => onPlayerClick(convertMoverToPlayer(mover, i))}
                  aria-label={`View ${mover.name} details`}
                  data-testid={`mover-${i}`}
                  className={`w-full px-6 py-3 text-left transition-colors flex items-center gap-4 ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}
                >
                  <span className={`text-xs font-mono w-5 text-center ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>{i + 1}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                    {(mover.name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{mover.name || 'Unknown'}</span>
                      {mover.source === 'props' ? (
                        <span
                          title="Projection derived from our prop-line model"
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                            isDarkMode ? 'bg-indigo-600/20 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
                          }`}
                        >
                          OURS
                        </span>
                      ) : mover.source === 'sleeper' ? (
                        <span
                          title="Projection sourced from Sleeper"
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                            isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          SLEEPER
                        </span>
                      ) : null}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {mover.team} • {mover.position}
                      <span className="mx-1">•</span>
                      <span className={isDarkMode ? 'text-slate-600' : 'text-slate-300'}>{(mover.previousProjectedPoints ?? 0).toFixed(1)}</span>
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
