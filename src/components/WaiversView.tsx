import { User, Loader2, RefreshCw, Search } from 'lucide-react';
import { Player } from '../App';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLeagueContext } from '../context/LeagueContext';
import api from '../services/api';

interface WaiversViewProps {
  onPlayerClick: (player: Player) => void;
  onViewAll: () => void;
  isDarkMode: boolean;
}

interface AvailablePlayer {
  id: string;
  name: string;
  team: string;
  position: string;
  status: string;
  byeWeek: number | null;
  headshotUrl?: string | null;
  avgPointsPPR: number;
  projectedPoints: number;
  isRostered: boolean;
  seasonStats?: {
    gamesPlayed?: number;
    games: number;
    fantasyPointsPPR: number;
    fantasyPointsHalf: number;
    fantasyPointsStd: number;
    passYards: number;
    passTDs: number;
    rushYards: number;
    rushTDs: number;
    receptions: number;
    receivingYards: number;
    receivingTDs: number;
  };
}

export function WaiversView({ onPlayerClick, onViewAll, isDarkMode }: WaiversViewProps) {
  const { league, userTeam } = useLeagueContext();
  const [selectedScoring, setSelectedScoring] = useState<'PPR' | 'Half PPR' | 'Standard'>('PPR');
  const [selectedPosition, setSelectedPosition] = useState<string>('ALL');
  const [players, setPlayers] = useState<AvailablePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pointsType, setPointsType] = useState<'actual' | 'projected'>('projected');

  const scoringOptions: Array<'PPR' | 'Half PPR' | 'Standard'> = ['PPR', 'Half PPR', 'Standard'];
  const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

  const getDefaultSeason = () => {
    const d = new Date();
    return d.getMonth() <= 2 ? d.getFullYear() - 1 : d.getFullYear();
  };
  const seasonYear = league?.seasonYear ?? getDefaultSeason();

  // In the offseason (Feb-Aug), default to week 18 (last regular season week)
  const currentWeek = (() => {
    const leagueWeek = league?.currentWeek;
    if (leagueWeek && leagueWeek > 1) return leagueWeek;
    const month = new Date().getMonth(); // 0-indexed
    if (month >= 1 && month <= 7) return 18; // offseason
    return leagueWeek ?? 1;
  })();

  // API /players endpoint accepts hyphenated scoring format: 'ppr', 'half-ppr', 'standard'
  // (per openapi.yaml — user preferences endpoint uses 'half_ppr' with underscore, but that's a separate route)
  const scoringFormat = selectedScoring === 'PPR' ? 'ppr' : selectedScoring === 'Half PPR' ? 'half-ppr' : 'standard';

  // Debounce search input to avoid API call on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Get average points using the correct scoring format from season stats
  const getAvgPoints = useCallback((player: AvailablePlayer): number => {
    const stats = player.seasonStats;
    if (!stats) return player.avgPointsPPR || 0;
    const gp = stats.gamesPlayed ?? stats.games;
    if (gp === 0) return 0;
    if (selectedScoring === 'Half PPR') {
      return Math.round((stats.fantasyPointsHalf / gp) * 10) / 10;
    }
    if (selectedScoring === 'Standard') {
      return Math.round((stats.fantasyPointsStd / gp) * 10) / 10;
    }
    return Math.round((stats.fantasyPointsPPR / gp) * 10) / 10;
  }, [selectedScoring]);

  // Fetch players from API
  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '100',
        includeStats: 'true',
        status: 'active',
        sortBy: 'projectedPoints',
        sortOrder: 'desc',
        availableOnly: 'true',
        week: String(currentWeek),
        season: String(seasonYear),
        scoringFormat,
      });

      if (selectedPosition !== 'ALL') {
        params.set('position', selectedPosition);
      }

      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim());
      }

      if (league?.id) {
        params.set('leagueId', league.id);
      }

      const response = await api.get<{
        players?: AvailablePlayer[];
        pagination?: { page: number; limit: number; total: number; totalPages: number };
        pointsType?: 'actual' | 'projected';
      }>(`/players?${params.toString()}`);

      const playersList = Array.isArray(response?.players) ? response.players : [];
      setPlayers(playersList);
      setPointsType(response?.pointsType ?? 'projected');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch players';
      setError(errorMessage);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [selectedPosition, league?.id, currentWeek, seasonYear, scoringFormat, debouncedSearch]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Sort by projectedPoints (actual scored or projected depending on week status)
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0));
  }, [players]);

  // Convert to Player type for modal
  const convertToPlayer = (player: AvailablePlayer, index: number): Player => {
    const avgPts = getAvgPoints(player);
    const projPts = player.projectedPoints || 0;

    let keyLine = '';
    if (player.seasonStats) {
      const stats = player.seasonStats;
      if (player.position === 'QB') {
        keyLine = `${stats.passYards} yds, ${stats.passTDs} TD`;
      } else if (player.position === 'RB') {
        keyLine = `${stats.rushYards} rush, ${stats.receivingYards} rec`;
      } else if (player.position === 'WR' || player.position === 'TE') {
        keyLine = `${stats.receptions} rec, ${stats.receivingYards} yds`;
      } else {
        keyLine = `Avg: ${avgPts.toFixed(1)} pts`;
      }
    } else {
      keyLine = projPts > 0 ? `Proj: ${projPts.toFixed(1)} pts` : `Avg: ${avgPts.toFixed(1)} pts`;
    }

    return {
      id: player.id,
      rank: index + 1,
      name: player.name,
      team: player.team,
      position: player.position as 'WR' | 'RB' | 'QB' | 'TE' | 'K' | 'DEF',
      keyLine,
      projectedPoints: projPts > 0 ? projPts : avgPts,
      weekChange: 0,
      headshotUrl: player.headshotUrl ?? null,
    };
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Content - 2/3 width */}
        <div className="xl:col-span-2">
          <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            {/* Header */}
            <div className={`p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between mb-1">
                <h2 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Waiver Wire (Week {currentWeek})
                </h2>
                <button
                  onClick={fetchPlayers}
                  disabled={loading}
                  className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {pointsType === 'actual'
                  ? `Sorted by Week ${currentWeek} scores (${selectedScoring})`
                  : `Sorted by Week ${currentWeek} projections (${selectedScoring})`
                }
              </p>

              {/* Filters */}
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                {/* Search */}
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Search:</span>
                  <div className={`flex items-center rounded-lg px-3 gap-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <Search className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input
                      type="text"
                      placeholder="Player or team..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`py-1.5 bg-transparent text-sm focus:outline-none w-28 ${isDarkMode ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'}`}
                    />
                  </div>
                </div>

                <div className={`w-px h-6 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>

                {/* Scoring Type */}
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Score:</span>
                  {scoringOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => setSelectedScoring(option)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        selectedScoring === option
                          ? 'bg-blue-600 text-white'
                          : isDarkMode
                            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                <div className={`w-px h-6 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>

                {/* Position Filter */}
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Position:</span>
                  {positions.map((position) => (
                    <button
                      key={position}
                      onClick={() => setSelectedPosition(position)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        selectedPosition === position
                          ? 'bg-blue-600 text-white'
                          : isDarkMode
                            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {position}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {error ? (
                <div className={`m-4 p-4 rounded-lg ${isDarkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
                  <p className="font-medium">Error loading players</p>
                  <p className="text-sm opacity-80 mt-1">{error}</p>
                  <button
                    onClick={fetchPlayers}
                    className="mt-3 px-4 py-2 text-sm font-medium rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : sortedPlayers.length === 0 ? (
                <div className={`text-center py-12 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No available players found.</p>
                  <p className="text-sm mt-1">Try changing the position filter or sync your league.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <th className={`px-6 py-4 text-xs font-medium w-12 text-center ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>#</th>
                      <th className={`px-4 py-4 text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Player</th>
                      <th className={`px-4 py-4 text-xs font-medium w-16 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Pos</th>
                      <th className={`px-4 py-4 text-xs font-medium text-right w-16 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>GP</th>
                      <th className={`px-4 py-4 text-xs font-medium text-right w-20 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Avg</th>
                      <th className={`px-6 py-4 text-xs font-medium text-right w-20 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {pointsType === 'actual' ? 'Pts' : 'Proj'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                    {sortedPlayers.slice(0, 12).map((player, index) => {
                      const gamesPlayed = player.seasonStats?.gamesPlayed ?? player.seasonStats?.games ?? 0;
                      const avgPoints = getAvgPoints(player);
                      const mainScore = player.projectedPoints || 0;

                      return (
                        <tr
                          key={player.id}
                          onClick={() => onPlayerClick(convertToPlayer(player, index))}
                          className={`group cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}
                        >
                          <td className={`px-6 py-4 text-sm text-center font-mono ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {index + 1}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div>
                                <div className={`font-bold text-sm group-hover:text-blue-500 transition-colors ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                  {player.name}
                                </div>
                                <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                  {player.team}
                                  {player.byeWeek && ` • Bye: ${player.byeWeek}`}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                              {player.position}
                            </span>
                          </td>
                          <td className={`px-4 py-4 text-right text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {gamesPlayed || '-'}
                          </td>
                          <td className={`px-4 py-4 text-right text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                            {avgPoints > 0 ? avgPoints.toFixed(1) : '-'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className={`font-bold text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {mainScore > 0 ? mainScore.toFixed(1) : '-'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Showing {Math.min(12, sortedPlayers.length)} available players
                </p>
                <button
                  onClick={onViewAll}
                  className="text-sm text-blue-500 hover:text-blue-400 font-semibold transition-colors"
                >
                  View more players →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Waiver Priority */}
          <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Waiver Priority</h3>
            <div className="space-y-3">
              <div className={`rounded-lg p-4 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Your Priority</div>
                <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {userTeam?.waiverPriority ? `#${userTeam.waiverPriority}` : '-'}
                </div>
                <div className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {league?.waiverType === 'faab' ? 'FAAB Budget' : 'Resets weekly'}
                </div>
              </div>
              {league?.waiverType === 'faab' && userTeam && (
                <div className={`rounded-lg p-4 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className={`text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FAAB Remaining</div>
                  <div className={`text-2xl font-bold text-green-500`}>
                    ${userTeam?.faabBudget ?? league?.waiverBudget ?? 100}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top Available */}
          <div className={`rounded-lg p-6 border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <h3 className="font-bold mb-4">Top Available</h3>
            <div className="space-y-3">
              {sortedPlayers.slice(0, 5).map((player, index) => (
                <button
                  key={player.id}
                  onClick={() => onPlayerClick(convertToPlayer(player, index))}
                  className={`w-full rounded-lg p-3 border text-left transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">{player.name}</div>
                      <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {player.team} • {player.position}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {(player.projectedPoints || 0) > 0 ? player.projectedPoints.toFixed(1) : '-'}
                      </div>
                      <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {pointsType === 'actual' ? 'pts' : 'proj'}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {sortedPlayers.length === 0 && !loading && (
                <p className={`text-sm text-center py-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Sync your league to see available players
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
