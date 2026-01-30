import { useState, useMemo } from 'react';
import { ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Search, Filter, User } from 'lucide-react';
import { nflPlayersData } from '../data/nflTeamsData';
import { Player } from '../App';

interface PlayerTableProps {
  selectedScoring: 'PPR' | 'Half PPR' | 'Standard';
  onScoringChange: (scoring: 'PPR' | 'Half PPR' | 'Standard') => void;
  selectedPosition: string;
  onPositionChange: (position: string) => void;
  currentWeek: number;
  onWeekChange: (week: number) => void;
  onPlayerClick: (player: Player) => void;
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
  isDarkMode,
}: PlayerTableProps) {
  const scoringOptions: Array<'PPR' | 'Half PPR' | 'Standard'> = ['PPR', 'Half PPR', 'Standard'];
  const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

  const [sortField, setSortField] = useState<SortField>('projectedPoints');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [showWeekDropdown, setShowWeekDropdown] = useState(false);

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

  const sortedAndFilteredPlayers = useMemo(() => {
    let filtered = nflPlayersData;

    // Apply position filter
    if (selectedPosition !== 'ALL') {
      filtered = filtered.filter(p => p.position === selectedPosition);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.team.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    return [...filtered].sort((a, b) => {
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
  }, [selectedPosition, searchQuery, sortField, sortDirection]);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Table with Header */}
      <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        {/* Header */}
        <div className={`p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <h2 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Player Rankings (Week {currentWeek})</h2>
          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Top players based on FilmRoom projections with Vegas prop lines
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
                  onClick={() => onScoringChange(option)}
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
                  onClick={() => onPositionChange(position)}
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

            <div className={`w-px h-6 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>

            {/* Week Selector */}
            <div className="relative">
              <button
                onClick={() => setShowWeekDropdown(!showWeekDropdown)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <span className="text-sm">Week {currentWeek}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showWeekDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showWeekDropdown && (
                <div className={`absolute top-10 left-0 w-28 rounded-lg border shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(week => (
                    <button
                      key={week}
                      onClick={() => { onWeekChange(week); setShowWeekDropdown(false); }}
                      className={`w-full px-4 py-2 text-sm text-left transition-colors ${
                        currentWeek === week
                          ? 'bg-blue-600 text-white'
                          : isDarkMode 
                            ? 'text-slate-300 hover:bg-slate-700'
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
          <table className="w-full border-collapse">
            <thead>
              <tr className={`border-b ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <th
                  onClick={() => handleSort('rank')}
                  className={`text-left px-6 py-4 text-xs font-semibold cursor-pointer transition-colors w-16 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  <div className="flex items-center gap-1.5">
                    RK
                    {getSortIcon('rank')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className={`text-left px-4 py-4 text-xs font-semibold cursor-pointer transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  <div className="flex items-center gap-1.5">
                    PLAYER
                    {getSortIcon('name')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('position')}
                  className={`text-left px-4 py-4 text-xs font-semibold cursor-pointer transition-colors w-20 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  <div className="flex items-center gap-1.5">
                    POS
                    {getSortIcon('position')}
                  </div>
                </th>
                <th className={`text-left px-4 py-4 text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>KEY LINE</th>
                <th
                  onClick={() => handleSort('projectedPoints')}
                  className={`text-right px-4 py-4 text-xs font-semibold cursor-pointer transition-colors w-24 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    PROJ
                    {getSortIcon('projectedPoints')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('weekChange')}
                  className={`text-right px-6 py-4 text-xs font-semibold cursor-pointer transition-colors w-28 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    TREND
                    {getSortIcon('weekChange')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedAndFilteredPlayers.map((player, index) => (
                <tr
                  key={player.id}
                  onClick={() => onPlayerClick(player)}
                  className={`border-b transition-colors cursor-pointer group ${isDarkMode ? 'border-slate-800 hover:bg-slate-800/70' : 'border-slate-100 hover:bg-slate-50'}`}
                >
                  <td className="px-6 py-4">
                    <span className={`font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{player.rank}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700 group-hover:border-slate-600' : 'bg-slate-100 text-slate-500 border-slate-200 group-hover:border-slate-300'}`}>
                        {player.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className={`font-bold group-hover:text-blue-500 transition-colors ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.name}</div>
                        <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{player.team}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {player.position}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{player.keyLine}</span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.projectedPoints.toFixed(1)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold ${
                      player.weekChange >= 0
                        ? 'bg-green-500/20 text-green-500'
                        : 'bg-red-500/20 text-red-500'
                    }`}>
                      {player.weekChange >= 0 ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                      {player.weekChange >= 0 ? '+' : ''}{player.weekChange.toFixed(1)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className={`px-6 py-4 border-t flex items-center justify-between ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <div>
            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Showing {sortedAndFilteredPlayers.length} of {nflPlayersData.length} players
            </span>
            <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Projections based on consensus odds, not expert opinion
            </p>
          </div>
          <div className={`flex items-center gap-2 text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            <span>Click column headers to sort</span>
            <span>•</span>
            <span>Click row for details</span>
          </div>
        </div>
      </div>
    </div>
  );
}
