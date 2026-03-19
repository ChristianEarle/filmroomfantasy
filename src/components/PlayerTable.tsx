import { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import { ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Search, Loader2, SearchX } from 'lucide-react';
import { Player } from '../App';
import { useLeagueContext } from '../context/LeagueContext';
import api from '../services/api';
import { type APIPlayer, convertAPIPlayerToPlayer, getDefaultSeason, scoringToFormat, NFL_WEEKS } from '../utils/playerUtils';

// Memoized table row component to prevent unnecessary re-renders
interface PlayerRowProps {
  player: Player;
  onClick: (player: Player) => void;
  isDarkMode: boolean;
}

const PlayerRow = memo(function PlayerRow({ player, onClick, isDarkMode }: PlayerRowProps) {
  return (
    <tr
      tabIndex={0}
      role="button"
      onClick={() => onClick(player)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(player);
        }
      }}
      className={`border-b transition-colors cursor-pointer group ${isDarkMode ? 'border-[#161616] hover:bg-[#1a1a1a]' : 'border-slate-100 hover:bg-slate-50'}`}
    >
      <td className="px-6 py-4">
        <span className={`font-medium ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>{player.rank}</span>
      </td>
      <td className="px-4 py-4">
        <div>
          <div className={`font-bold group-hover:text-blue-500 transition-colors ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.name}</div>
          <div className={`text-xs ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>{player.team} <span className="sm:hidden">• {player.position}</span></div>
        </div>
      </td>
      <td className="px-4 py-4 hidden sm:table-cell">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${isDarkMode ? 'bg-[#1a1a1a] text-[#a3a3a3] border-[#222]' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
          {player.position}
        </span>
      </td>
      <td className="px-4 py-4 hidden md:table-cell">
        <span className={`text-sm ${isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-600'}`}>{player.keyLine}</span>
      </td>
      <td className="px-4 py-4 text-right">
        <span className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.projectedPoints.toFixed(1)}</span>
      </td>
      <td className="px-6 py-4 text-right hidden sm:table-cell">
        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold ${
          player.weekChange >= 0
            ? 'bg-green-500/20 text-green-500'
            : 'bg-red-500/20 text-red-500'
        }`}>
          {player.weekChange >= 0 ? (
            <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span aria-label={`${player.weekChange >= 0 ? 'up' : 'down'} ${Math.abs(player.weekChange).toFixed(1)} points`}>
            {player.weekChange >= 0 ? '+' : ''}{player.weekChange.toFixed(1)}
          </span>
        </div>
      </td>
    </tr>
  );
});

interface PlayerTableProps {
  selectedScoring: 'PPR' | 'Half PPR' | 'Standard';
  onScoringChange: (scoring: 'PPR' | 'Half PPR' | 'Standard') => void;
  selectedPosition: string;
  onPositionChange: (position: string) => void;
  currentWeek: number;
  onWeekChange: (week: number) => void;
  onPlayerClick: (player: Player) => void;
  onViewAll: () => void;
  isDarkMode: boolean;
}

type SortField = 'rank' | 'name' | 'position' | 'projectedPoints' | 'weekChange';
type SortDirection = 'asc' | 'desc';

export function PlayerTable({
  selectedScoring,
  onScoringChange,
  selectedPosition,
  onPositionChange,
  currentWeek,
  onWeekChange,
  onPlayerClick,
  onViewAll,
  isDarkMode,
}: PlayerTableProps) {
  const { league } = useLeagueContext();
  const scoringOptions: Array<'PPR' | 'Half PPR' | 'Standard'> = ['PPR', 'Half PPR', 'Standard'];
  const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF'];

  const [sortField, setSortField] = useState<SortField>('projectedPoints');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [showWeekDropdown, setShowWeekDropdown] = useState(false);
  const [players, setPlayers] = useState<APIPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [pointsType, setPointsType] = useState<'actual' | 'projected'>('projected');
  const weekDropdownRef = useRef<HTMLDivElement>(null);

  // BUG-006 fix: Close week dropdown when clicking outside
  useEffect(() => {
    if (!showWeekDropdown) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (weekDropdownRef.current && !weekDropdownRef.current.contains(event.target as Node)) {
        setShowWeekDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showWeekDropdown]);

  const seasonYear = league?.seasonYear ?? getDefaultSeason();
  const scoringFormat = scoringToFormat(selectedScoring);

  // Fetch players from API
  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '350',
        includeStats: 'true',
        sortBy: 'projectedPoints',
        sortOrder: 'desc',
        week: String(currentWeek),
        season: String(seasonYear),
        scoringFormat,
      });

      if (selectedPosition !== 'ALL' && selectedPosition !== 'FLEX') {
        params.set('position', selectedPosition);
      }

      if (league?.id) {
        params.set('leagueId', league.id);
      }

      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const response = await api.get<{
        players?: APIPlayer[];
        pagination?: { page: number; limit: number; total: number; totalPages: number };
        weekComplete?: boolean;
        pointsType?: 'actual' | 'projected';
      }>(`/players?${params.toString()}`);

      const playersList = Array.isArray(response?.players) ? response.players : [];
      const pagination = response?.pagination;
      setPlayers(playersList);
      setTotalPlayers(pagination?.total ?? playersList.length);
      setPointsType(response?.pointsType ?? 'projected');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch players';
      setError(errorMessage);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [selectedPosition, league?.id, searchQuery, currentWeek, seasonYear, scoringFormat]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-[#555]" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 text-blue-400" />
      : <ArrowDown className="w-3 h-3 text-blue-400" />;
  };

  // Convert API player to display format (uses shared utility)

  const sortedAndFilteredPlayers = useMemo(() => {
    let filtered = players;

    // Apply FLEX filter (includes RB, WR, TE)
    if (selectedPosition === 'FLEX') {
      filtered = filtered.filter(p => p.position === 'RB' || p.position === 'WR' || p.position === 'TE');
    }

    // BUG-003 fix: Tighten fuzzy API results with strict client-side filtering.
    // Only keep players whose name or team actually contains the search query.
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)
      );
    }

    // Convert to display format
    const displayPlayers = filtered.map((p, i) => convertAPIPlayerToPlayer(p, i));

    // Apply sorting
    const sorted = [...displayPlayers].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'rank':
          comparison = a.rank - b.rank;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'position':
          comparison = a.position.localeCompare(b.position);
          break;
        case 'projectedPoints':
          comparison = a.projectedPoints - b.projectedPoints;
          break;
        case 'weekChange':
          comparison = a.weekChange - b.weekChange;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    // Limit to top 12 for display
    return sorted.slice(0, 12);
  }, [players, selectedPosition, searchQuery, sortField, sortDirection]);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Table with Header */}
      <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
        {/* Header */}
        <div className={`p-6 border-b ${isDarkMode ? 'border-[#222]' : 'border-slate-200'}`}>
          <h2 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Player Rankings — Week {currentWeek} {pointsType === 'actual' ? '(Final)' : '(Projections)'}
          </h2>
          <p className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
            {pointsType === 'actual' ? 'Actual points scored' : 'Top players based on season stats and projections'}
          </p>

          {/* Filters */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            {/* Search */}
            <div className="flex items-center gap-2">
              <label htmlFor="player-search" className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Search:</label>
              <div className={`flex items-center rounded-lg px-3 gap-2 ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-slate-100'}`}>
                <Search className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`} aria-hidden="true" />
                <input
                  id="player-search"
                  type="text"
                  placeholder="Player or team..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`py-1.5 bg-transparent text-sm focus:outline-none w-28 sm:w-36 ${isDarkMode ? 'text-white placeholder-[#555]' : 'text-slate-900 placeholder-slate-400'}`}
                />
              </div>
            </div>

            <div className={`w-px h-6 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>

            {/* Scoring Type */}
            <div className="flex items-center gap-2">
              <span className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Score:</span>
              {scoringOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => onScoringChange(option)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    selectedScoring === option
                      ? 'bg-blue-600 text-white'
                      : isDarkMode
                        ? 'bg-[#1a1a1a] text-[#a3a3a3] hover:bg-[#1a1a1a]'
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
              <span className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Position:</span>
              {positions.map((position) => (
                <button
                  key={position}
                  onClick={() => onPositionChange(position)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    selectedPosition === position
                      ? 'bg-blue-600 text-white'
                      : isDarkMode
                        ? 'bg-[#1a1a1a] text-[#a3a3a3] hover:bg-[#1a1a1a]'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {position}
                </button>
              ))}
            </div>

            <div className={`w-px h-6 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>

            {/* Week Selector — BUG-006 fix: ref + click-outside + always show all 18 weeks */}
            <div className="relative" ref={weekDropdownRef}>
              <button
                onClick={() => setShowWeekDropdown(!showWeekDropdown)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${isDarkMode ? 'bg-[#1a1a1a] text-[#a3a3a3] hover:bg-[#1a1a1a]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <span className="text-sm">Week {currentWeek}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showWeekDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showWeekDropdown && (
                <div className={`absolute top-10 left-0 w-28 rounded-lg border shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto ${isDarkMode ? 'bg-[#1a1a1a] border-[#222]' : 'bg-white border-slate-200'}`}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(week => (
                    <button
                      key={week}
                      onClick={() => { onWeekChange(week); setShowWeekDropdown(false); }}
                      className={`w-full px-4 py-2 text-sm text-left transition-colors ${
                        currentWeek === week
                          ? 'bg-blue-600 text-white'
                          : isDarkMode
                            ? 'text-[#a3a3a3] hover:bg-[#1a1a1a]'
                            : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Week {week}
                    </button>
                  ))}
                </div>
              )}
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
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" aria-label="Loading players" />
            </div>
          ) : (
            <table className="w-full border-collapse" role="grid" aria-label="Player rankings">
              <thead>
                <tr className={`border-b ${isDarkMode ? 'bg-[#1a1a1a] border-[#222]' : 'bg-slate-50 border-slate-200'}`}>
                  <th
                    scope="col"
                    onClick={() => handleSort('rank')}
                    aria-sort={sortField === 'rank' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`text-left px-6 py-4 text-xs font-semibold cursor-pointer transition-colors w-16 ${isDarkMode ? 'text-[#737373] hover:text-white' : 'text-[#555] hover:text-slate-900'}`}
                  >
                    <div className="flex items-center gap-1.5">
                      RK
                      {getSortIcon('rank')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('name')}
                    aria-sort={sortField === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`text-left px-4 py-4 text-xs font-semibold cursor-pointer transition-colors ${isDarkMode ? 'text-[#737373] hover:text-white' : 'text-[#555] hover:text-slate-900'}`}
                  >
                    <div className="flex items-center gap-1.5">
                      PLAYER
                      {getSortIcon('name')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('position')}
                    aria-sort={sortField === 'position' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`text-left px-4 py-4 text-xs font-semibold cursor-pointer transition-colors w-20 hidden sm:table-cell ${isDarkMode ? 'text-[#737373] hover:text-white' : 'text-[#555] hover:text-slate-900'}`}
                  >
                    <div className="flex items-center gap-1.5">
                      POS
                      {getSortIcon('position')}
                    </div>
                  </th>
                  <th scope="col" className={`text-left px-4 py-4 text-xs font-semibold hidden md:table-cell ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>STATS</th>
                  <th
                    scope="col"
                    onClick={() => handleSort('projectedPoints')}
                    aria-sort={sortField === 'projectedPoints' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`text-right px-4 py-4 text-xs font-semibold cursor-pointer transition-colors w-24 ${isDarkMode ? 'text-[#737373] hover:text-white' : 'text-[#555] hover:text-slate-900'}`}
                  >
                    <div className="flex items-center gap-1.5 justify-end">
                      {pointsType === 'actual' ? 'PTS' : 'PROJ'}
                      {getSortIcon('projectedPoints')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('weekChange')}
                    aria-sort={sortField === 'weekChange' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`text-right px-6 py-4 text-xs font-semibold cursor-pointer transition-colors w-28 hidden sm:table-cell ${isDarkMode ? 'text-[#737373] hover:text-white' : 'text-[#555] hover:text-slate-900'}`}
                  >
                    <div className="flex items-center gap-1.5 justify-end">
                      TREND
                      {getSortIcon('weekChange')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedAndFilteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <SearchX className={`w-10 h-10 ${isDarkMode ? 'text-slate-600' : 'text-[#a3a3a3]'}`} />
                        <p className={`text-sm font-semibold ${isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-600'}`}>
                          {searchQuery.trim()
                            ? `No players found for "${searchQuery}"`
                            : `No player data available for Week ${currentWeek}`}
                        </p>
                        <p className={`text-xs max-w-xs ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>
                          {searchQuery.trim()
                            ? 'Check the spelling or try a different player name or team abbreviation.'
                            : 'Projections for this week may not be available yet. Try selecting a different week.'}
                        </p>
                        {searchQuery.trim() && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="mt-1 px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                          >
                            Clear search
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedAndFilteredPlayers.map((player) => (
                    <PlayerRow
                      key={player.id}
                      player={player}
                      onClick={onPlayerClick}
                      isDarkMode={isDarkMode}
                    />
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Table Footer */}
        {!error && totalPlayers > 0 && (
          <div className={`px-6 py-4 border-t ${isDarkMode ? 'bg-[#1a1a1a]/50 border-[#222]' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <span className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
                  Showing top {Math.min(12, totalPlayers)} of {totalPlayers} players
                </span>
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>
                  Stats from current season
                </p>
              </div>
              <button
                onClick={onViewAll}
                className="text-sm text-blue-500 hover:text-blue-400 font-semibold transition-colors"
              >
                View more players →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
