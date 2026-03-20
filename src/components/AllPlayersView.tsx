import { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import { ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Search, ArrowLeft, Loader2, SearchX } from 'lucide-react';
import { Player } from '../App';
import { useLeagueContext } from '../context/LeagueContext';
import api from '../services/api';
import { useOdds } from '../hooks/useOdds';
import { type APIPlayer, convertAPIPlayerToPlayer, getDefaultSeason, scoringToFormat, NFL_WEEKS } from '../utils/playerUtils';

interface AllPlayersViewProps {
  selectedScoring: 'PPR' | 'Half PPR' | 'Standard';
  onScoringChange: (scoring: 'PPR' | 'Half PPR' | 'Standard') => void;
  selectedPosition: string;
  onPositionChange: (position: string) => void;
  currentWeek: number;
  onWeekChange: (week: number) => void;
  onPlayerClick: (player: Player) => void;
  onBack: () => void;
  isDarkMode: boolean;
  source: 'board' | 'waivers';
}

type SortField = 'rank' | 'name' | 'position' | 'projectedPoints' | 'weekChange';
type SortDirection = 'asc' | 'desc';

export function AllPlayersView({
  selectedScoring,
  onScoringChange,
  selectedPosition,
  onPositionChange,
  currentWeek,
  onWeekChange,
  onPlayerClick,
  onBack,
  isDarkMode,
  source,
}: AllPlayersViewProps) {
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

  const seasonYear = league?.seasonYear ?? getDefaultSeason();
  const scoringFormat = scoringToFormat(selectedScoring);

  // Fetch odds for the current week
  const season = 2025;
  const { odds } = useOdds(currentWeek, season);

  // Helper to find odds for a player's team
  const getOddsForTeam = (teamAbbr: string) => {
    return odds.find(o => o.homeTeam === teamAbbr || o.awayTeam === teamAbbr) || null;
  };

  // Fetch players from API (week-specific: past weeks = actual pts, current = projections)
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
      }>(`/players?${params.toString()}`);

      const playersList = Array.isArray(response?.players) ? response.players : [];
      setPlayers(playersList);
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
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-500" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 text-blue-400" />
      : <ArrowDown className="w-3 h-3 text-blue-400" />;
  };

  // Memoized row component
  const AllPlayerRow = memo(function AllPlayerRow({
    player,
    isDarkMode,
    oddsData,
  }: {
    player: Player;
    isDarkMode: boolean;
    oddsData?: { homeTeam: string; awayTeam: string; homeSpread: number | null; total: number | null } | null;
  }) {
    const formatOdds = () => {
      if (!oddsData || oddsData.homeSpread === null || oddsData.total === null) {
        return null;
      }
      const isHome = oddsData.homeTeam === player.team;
      const spread = Math.abs(oddsData.homeSpread);
      const spreadSign = (isHome && oddsData.homeSpread < 0) || (!isHome && oddsData.homeSpread > 0) ? '-' : '+';
      return `${player.team} ${spreadSign}${spread} • O/U ${oddsData.total}`;
    };

    const oddsDisplay = formatOdds();

    return (
      <tr
        tabIndex={0}
        role="button"
        onClick={() => onPlayerClick(player)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPlayerClick(player);
          }
        }}
        className={`border-b transition-colors cursor-pointer group ${isDarkMode ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-100 hover:bg-slate-50'}`}
      >
        <td className="px-4 py-2">
          <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{player.rank}</span>
        </td>
        <td className="px-3 py-2">
          <div>
            <div className={`text-sm font-semibold group-hover:text-blue-500 transition-colors ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.name}</div>
            <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {player.team} <span className="sm:hidden">• {player.position}</span>
              {oddsDisplay && (
                <div className={`text-xs ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                  {oddsDisplay}
                </div>
              )}
            </div>
          </div>
        </td>
        <td className="px-3 py-2 hidden sm:table-cell">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            {player.position}
          </span>
        </td>
        <td className="px-3 py-2 hidden md:table-cell">
          <span className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{player.keyLine}</span>
        </td>
        <td className="px-3 py-2 text-right">
          <span className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.projectedPoints.toFixed(1)}</span>
        </td>
      </tr>
    );
  });

  const sortedAndFilteredPlayers = useMemo(() => {
    let filtered = players;

    // For waivers, filter to only show unrostered players
    if (source === 'waivers') {
      filtered = filtered.filter(p => !p.isRostered);
    }

    // Apply FLEX filter
    if (selectedPosition === 'FLEX') {
      filtered = filtered.filter(p => p.position === 'RB' || p.position === 'WR' || p.position === 'TE');
    }

    // Convert to display format
    const displayPlayers = filtered.map((p, i) => convertAPIPlayerToPlayer(p, i));

    // Apply sorting
    return [...displayPlayers].sort((a, b) => {
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
  }, [players, selectedPosition, sortField, sortDirection, source]);

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Table with Header */}
      <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        {/* Header */}
        <div className={`p-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={onBack}
              aria-label="Go back"
              className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'}`}
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <div>
              <h2 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {source === 'waivers' ? 'All Available Players' : 'All Players'} (Week {currentWeek})
              </h2>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {source === 'waivers' ? 'All waiver wire players' : 'Complete player rankings'}
              </p>
            </div>
          </div>

          {/* Filters - Compact */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className={`flex items-center rounded-lg px-2 gap-1.5 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <Search className={`w-3.5 h-3.5 flex-shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} aria-hidden="true" />
              <input
                type="text"
                placeholder="Search..."
                aria-label="Search players"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`py-1 bg-transparent text-xs focus:outline-none w-20 ${isDarkMode ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'}`}
              />
            </div>

            <div className={`w-px h-5 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>

            {/* Scoring Type */}
            <div className="flex items-center gap-1">
              {scoringOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => onScoringChange(option)}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    selectedScoring === option
                      ? 'bg-blue-600 text-white'
                      : isDarkMode
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-800'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className={`w-px h-5 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>

            {/* Position Filter */}
            <div className="flex items-center gap-1">
              {positions.map((position) => (
                <button
                  key={position}
                  onClick={() => onPositionChange(position)}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    selectedPosition === position
                      ? 'bg-blue-600 text-white'
                      : isDarkMode
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-800'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {position}
                </button>
              ))}
            </div>

            <div className={`w-px h-5 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>

            {/* Week Selector */}
            <div className="relative">
              <button
                onClick={() => setShowWeekDropdown(!showWeekDropdown)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <span className="text-xs">Wk {currentWeek}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showWeekDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showWeekDropdown && (
                <div className={`absolute top-8 left-0 w-20 rounded-lg border shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  {NFL_WEEKS.map(week => (
                    <button
                      key={week}
                      onClick={() => { onWeekChange(week); setShowWeekDropdown(false); }}
                      className={`w-full px-3 py-1.5 text-xs text-left transition-colors ${
                        currentWeek === week
                          ? 'bg-blue-600 text-white'
                          : isDarkMode
                            ? 'text-slate-300 hover:bg-slate-800'
                            : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Week {week}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1"></div>

            <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {sortedAndFilteredPlayers.length} players
            </span>
          </div>
        </div>

        {/* Table - Compact rows */}
        <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
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
            <table className="w-full border-collapse">
              <thead className={`sticky top-0 z-10 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                <tr className={`border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                  <th
                    onClick={() => handleSort('rank')}
                    className={`text-left px-4 py-2 text-xs font-semibold cursor-pointer transition-colors w-12 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    <div className="flex items-center gap-1">
                      #
                      {getSortIcon('rank')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('name')}
                    className={`text-left px-3 py-2 text-xs font-semibold cursor-pointer transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    <div className="flex items-center gap-1">
                      PLAYER
                      {getSortIcon('name')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('position')}
                    className={`text-left px-3 py-2 text-xs font-semibold cursor-pointer transition-colors w-14 hidden sm:table-cell ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    <div className="flex items-center gap-1">
                      POS
                      {getSortIcon('position')}
                    </div>
                  </th>
                  <th className={`text-left px-3 py-2 text-xs font-semibold w-40 hidden md:table-cell ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>STATS</th>
                  <th
                    onClick={() => handleSort('projectedPoints')}
                    className={`text-right px-3 py-2 text-xs font-semibold cursor-pointer transition-colors w-16 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    <div className="flex items-center gap-1 justify-end">
                      PROJ
                      {getSortIcon('projectedPoints')}
                    </div>
                  </th>
                  {/* TREND column removed — weekChange data not yet available from API */}
                </tr>
              </thead>
              <tbody>
                {sortedAndFilteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <SearchX className={`w-10 h-10 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                        <p className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          {searchQuery.trim()
                            ? `No players found for "${searchQuery}"`
                            : `No player data available for Week ${currentWeek}`}
                        </p>
                        <p className={`text-xs max-w-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
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
                ) : sortedAndFilteredPlayers.map((player) => (
                  <AllPlayerRow
                    key={player.id}
                    player={player}
                    isDarkMode={isDarkMode}
                    oddsData={getOddsForTeam(player.team)}
                  />
                ))}
              </tbody>

            </table>
          )}
        </div>

        {/* Table Footer */}
        <div className={`px-4 py-3 border-t flex items-center justify-between ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Stats from current season
          </span>
          <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Click row for details
          </span>
        </div>
      </div>
    </div>
  );
}
