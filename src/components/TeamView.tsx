import { useState, useEffect, useRef } from 'react';
import { User, TrendingUp, ArrowUpDown, Star, Sparkles, Trophy, Target, ChevronDown, AlertCircle, Loader2 } from 'lucide-react';
import { Player } from '../App';
import { useLeagueContext } from '../context/LeagueContext';
import { sortByPosition } from '../utils/rosterPositions';
import { calculateGrade, getMatchupGradeLabel, getMatchupGradeColor } from '../utils/matchupGrades';

interface TeamViewProps {
  onPlayerClick: (player: Player) => void;
  isDarkMode: boolean;
}

const getStatusIndicator = (status: string | undefined) => {
  switch (status) {
    case 'questionable':
    case 'Q':
      return <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" title="Questionable"></span>;
    case 'out':
    case 'O':
    case 'IR':
    case 'injured_reserve':
      return <span className="w-2 h-2 rounded-full bg-red-500" title={status === 'injured_reserve' || status === 'IR' ? 'IR' : 'Out'}></span>;
    case 'doubtful':
    case 'D':
      return <span className="w-2 h-2 rounded-full bg-orange-500" title="Doubtful"></span>;
    default:
      return null;
  }
};

// Use shared calculateGrade as getMatchupGrade alias
const getMatchupGrade = calculateGrade;

export function TeamView({ onPlayerClick, isDarkMode }: TeamViewProps) {
  const { league, userTeam, viewedTeamId, setViewedTeamId, roster, rosterLoading, standings, allMatchups } = useLeagueContext();
  const [selectedWeek, setSelectedWeek] = useState(league?.currentWeek || 1);
  const [showWeekDropdown, setShowWeekDropdown] = useState(false);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const teamDropdownRef = useRef<HTMLDivElement>(null);
  const weekDropdownRef = useRef<HTMLDivElement>(null);

  // Get the currently viewed team from the league teams
  const viewedTeam = league?.teams?.find(t => t.id === viewedTeamId) || league?.teams?.[0];

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(event.target as Node)) {
        setShowTeamDropdown(false);
      }
      if (weekDropdownRef.current && !weekDropdownRef.current.contains(event.target as Node)) {
        setShowWeekDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Loading state
  if (rosterLoading) {
    return (
      <div className="max-w-[1600px] mx-auto">
        <div className={`rounded-lg border p-12 flex flex-col items-center justify-center ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
          <p className={isDarkMode ? 'text-[#737373]' : 'text-[#555]'}>Loading your team...</p>
        </div>
      </div>
    );
  }

  // Empty roster state
  if (!roster || roster.length === 0) {
    return (
      <div className="max-w-[1600px] mx-auto">
        <div className={`rounded-lg border p-12 text-center ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
          <User className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-slate-600' : 'text-[#a3a3a3]'}`} />
          <h2 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>No Roster Yet</h2>
          <p className={`text-sm mb-4 ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
            {viewedTeam?.name ? `${viewedTeam.name}'s roster` : 'Your roster'} will appear here once your league is synced.
          </p>
          <p className={`text-xs ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>
            Go to Settings and click "Sync" on your league to import rosters from Sleeper.
          </p>
        </div>
      </div>
    );
  }

  const starters = sortByPosition(roster.filter(p => p.isStarter));
  const bench = sortByPosition(roster.filter(p => !p.isStarter));

  const starterProjection = starters.reduce((sum, p) => sum + (p.projectedPoints || 0), 0);
  const totalPoints = roster.reduce((sum, p) => sum + (p.actualPoints || p.projectedPoints || 0), 0);

  // Calculate weekly points from real matchup data instead of fake averages
  const weeklyPoints = (() => {
    if (!viewedTeamId || !allMatchups?.length) return [];
    const teamScores: { week: number; score: number }[] = [];
    for (const m of allMatchups) {
      if (!m.isComplete) continue;
      if (m.homeTeam.id === viewedTeamId) {
        teamScores.push({ week: m.week, score: m.homeTeam.score });
      } else if (m.awayTeam.id === viewedTeamId) {
        teamScores.push({ week: m.week, score: m.awayTeam.score });
      }
    }
    teamScores.sort((a, b) => a.week - b.week);
    return teamScores.map(s => s.score);
  })();
  const gamesPlayed = viewedTeam ? Math.max(viewedTeam.wins + viewedTeam.losses + viewedTeam.ties, 1) : 0;
  const avgPts = viewedTeam ? viewedTeam.pointsFor / gamesPlayed : 0;

  // Get viewed team's standing
  const viewedTeamStanding = standings.find(s => s.teamId === viewedTeamId);
  const standingRank = viewedTeamStanding?.rank || standings.findIndex(s => s.teamId === viewedTeamId) + 1 || '-';

  // Convert roster player to Player interface for modal
  const convertToPlayer = (rosterPlayer: typeof roster[0], index: number): Player => ({
    id: rosterPlayer.id,
    rank: index + 1,
    name: rosterPlayer.name,
    team: rosterPlayer.team,
    position: rosterPlayer.position as 'WR' | 'RB' | 'QB' | 'TE' | 'K' | 'DEF',
    keyLine: `Proj: ${rosterPlayer.projectedPoints?.toFixed(1) || '0'} pts`,
    projectedPoints: rosterPlayer.projectedPoints || 0,
    weekChange: 0,
  });

  // Calculate max point for chart scaling
  const maxPoint = Math.max(...weeklyPoints, 1);

  // Find bench player with best matchup
  const bestBenchPlayer = bench.length > 0
    ? bench.reduce((prev, current) => {
        const prevGrade = getMatchupGrade(prev.projectedPoints || 0, prev.position);
        const currentGrade = getMatchupGrade(current.projectedPoints || 0, current.position);
        return currentGrade < prevGrade ? current : prev;
      })
    : null;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header Section */}
      <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            {/* Team Selector Dropdown */}
            <div className="relative inline-block mb-1" ref={teamDropdownRef}>
              <button
                onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                className={`text-2xl font-bold flex items-center gap-2 hover:text-blue-500 transition-colors ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
              >
                {viewedTeam?.name || userTeam?.name || 'My Team'}
                {league?.teams && league.teams.length > 1 && (
                  <ChevronDown className={`w-5 h-5 transition-transform ${showTeamDropdown ? 'rotate-180' : ''}`} />
                )}
              </button>
              {showTeamDropdown && league?.teams && league.teams.length > 1 && (
                <div className={`absolute top-full left-0 mt-2 w-64 rounded-lg border shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto ${isDarkMode ? 'bg-[#1a1a1a] border-[#222]' : 'bg-white border-slate-200'}`}>
                  {league.teams.map(team => (
                    <button
                      key={team.id}
                      onClick={() => {
                        setViewedTeamId(team.id);
                        setShowTeamDropdown(false);
                      }}
                      className={`w-full px-4 py-3 text-left transition-colors border-b last:border-b-0 ${
                        viewedTeamId === team.id
                          ? 'bg-blue-600 text-white'
                          : isDarkMode ? 'text-[#a3a3a3] hover:bg-slate-700 border-[#222]' : 'text-slate-600 hover:bg-slate-100 border-slate-100'
                      }`}
                    >
                      <div className="font-semibold">{team.name}</div>
                      <div className={`text-xs ${viewedTeamId === team.id ? 'text-blue-200' : isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>
                        {team.wins}-{team.losses}{team.ties > 0 ? `-${team.ties}` : ''} • {team.pointsFor.toFixed(1)} PF
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
              {league?.name ? `${league.name} • ` : ''}Week {selectedWeek} roster and projections
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick Stats */}
            <div className="flex items-center gap-6 mr-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{starterProjection.toFixed(1)}</div>
                <div className={`text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Projected</div>
              </div>
              <div className={`w-px h-10 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">
                  {viewedTeam ? `${viewedTeam.wins}-${viewedTeam.losses}${viewedTeam.ties > 0 ? `-${viewedTeam.ties}` : ''}` : '-'}
                </div>
                <div className={`text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Record</div>
              </div>
              <div className={`w-px h-10 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">#{standingRank}</div>
                <div className={`text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Standing</div>
              </div>
            </div>

            {/* Week Selector */}
            <div className="relative" ref={weekDropdownRef}>
              <button
                onClick={() => setShowWeekDropdown(!showWeekDropdown)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border ${isDarkMode ? 'bg-[#1a1a1a] text-[#a3a3a3] hover:bg-slate-700 border-[#222]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'}`}
              >
                <span className="text-sm font-medium">Week {selectedWeek}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showWeekDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showWeekDropdown && (
                <div className={`absolute top-12 right-0 w-32 rounded-lg border shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto ${isDarkMode ? 'bg-[#1a1a1a] border-[#222]' : 'bg-white border-slate-200'}`}>
                  {Array.from({ length: 18 }, (_, i) => i + 1).map(week => (
                    <button
                      key={week}
                      onClick={() => { setSelectedWeek(week); setShowWeekDropdown(false); }}
                      className={`w-full px-4 py-2 text-sm text-left transition-colors ${
                        selectedWeek === week
                          ? 'bg-blue-600 text-white'
                          : isDarkMode ? 'text-[#a3a3a3] hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'
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
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Starters Section */}
        <div className="xl:col-span-2 space-y-6">
          {/* Starters Table */}
          <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
            <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'border-[#222] bg-[#1a1a1a]/50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />
                <h2 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Starting Lineup</h2>
              </div>
              <span className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>{starterProjection.toFixed(1)} projected pts</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${isDarkMode ? 'bg-[#1a1a1a] border-[#222]' : 'bg-slate-50 border-slate-200'}`}>
                    <th className={`text-left px-4 py-3 text-xs font-semibold w-16 ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>SLOT</th>
                    <th className={`text-left px-4 py-3 text-xs font-semibold ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>PLAYER</th>
                    <th className={`text-right px-4 py-3 text-xs font-semibold w-16 ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>AVG</th>
                    <th className={`text-right px-4 py-3 text-xs font-semibold w-16 ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>LAST</th>
                    <th className={`text-center px-4 py-3 text-xs font-semibold w-20 ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>MATCHUP</th>
                    <th className={`text-right px-4 py-3 text-xs font-semibold w-20 ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>PROJ</th>
                  </tr>
                </thead>
                <tbody>
                  {starters.map((player, index) => {
                    const matchupGrade = getMatchupGrade(player.projectedPoints || 0, player.position);
                    const avgPoints = player.seasonStats?.avgPoints;
                    return (
                      <tr
                        key={player.id || index}
                        onClick={() => onPlayerClick(convertToPlayer(player, index))}
                        className={`border-b transition-colors cursor-pointer group ${isDarkMode ? 'border-slate-800 hover:bg-[#1a1a1a]/70' : 'border-slate-100 hover:bg-slate-50'}`}
                      >
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-1 rounded ${isDarkMode ? 'text-[#555] bg-[#1a1a1a]' : 'text-[#555] bg-slate-100'}`}>
                            {player.slot}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`font-bold group-hover:text-blue-500 transition-colors ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.name}</span>
                                  {getStatusIndicator(player.status)}
                                </div>
                                <div className={`text-xs ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>
                                  {player.team} • {player.position}
                                  {player.seasonStats?.gamesPlayed ?? player.seasonStats?.games ? ` • ${(player.seasonStats?.gamesPlayed ?? player.seasonStats?.games)} GP` : ''}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm ${avgPoints ? (isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-700') : (isDarkMode ? 'text-slate-600' : 'text-[#737373]')}`}>
                            {avgPoints ? avgPoints.toFixed(1) : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm ${player.lastWeekPoints !== null && player.lastWeekPoints !== undefined ? (isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-700') : (isDarkMode ? 'text-slate-600' : 'text-[#737373]')}`}>
                            {player.lastWeekPoints !== null && player.lastWeekPoints !== undefined ? player.lastWeekPoints.toFixed(1) : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`text-xs font-medium px-2 py-1 rounded border ${getMatchupGradeColor(matchupGrade, isDarkMode)}`}
                            title={`${getMatchupGradeLabel(matchupGrade)} projection for position`}
                          >
                            Matchup {matchupGrade}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{(player.projectedPoints || 0).toFixed(1)}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {starters.length === 0 && (
                    <tr>
                      <td colSpan={6} className={`px-4 py-8 text-center ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>
                        No starters set yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bench Section */}
          <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
            <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'border-[#222] bg-[#1a1a1a]/50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <ArrowUpDown className={`w-4 h-4 ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`} />
                <h2 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Bench</h2>
              </div>
              <span className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>{bench.length} players</span>
            </div>

            <div className="p-4 space-y-2">
              {bench.map((player, index) => {
                const matchupGrade = getMatchupGrade(player.projectedPoints || 0, player.position);
                const avgPoints = player.seasonStats?.avgPoints;
                return (
                  <button
                    key={player.id || index}
                    onClick={() => onPlayerClick(convertToPlayer(player, starters.length + index))}
                    className={`w-full rounded-lg px-4 py-3 border hover:border-blue-500 transition-all text-left group ${isDarkMode ? 'bg-[#1a1a1a] border-[#222]' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold transition-colors ${isDarkMode ? 'text-[#a3a3a3] group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>{player.name}</span>
                            {matchupGrade.startsWith('A') && (
                              <Sparkles className="w-3 h-3 text-green-500" />
                            )}
                            {getStatusIndicator(player.status)}
                          </div>
                          <div className={`text-xs ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>
                            {player.team} • {player.position}
                            {avgPoints ? ` • Avg: ${avgPoints.toFixed(1)}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {player.lastWeekPoints !== null && player.lastWeekPoints !== undefined && (
                          <span className={`text-xs ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>
                            Last: {player.lastWeekPoints.toFixed(1)}
                          </span>
                        )}
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded border ${getMatchupGradeColor(matchupGrade, isDarkMode)}`}
                          title={`${getMatchupGradeLabel(matchupGrade)} projection for position`}
                        >
                          Matchup {matchupGrade}
                        </span>
                        <span className={`text-sm font-semibold ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>{(player.projectedPoints || 0).toFixed(1)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {bench.length === 0 && (
                <div className={`text-center py-4 ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>
                  No bench players
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Weekly Performance Chart */}
          <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Weekly Points</h3>
                <p className={`text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Season performance trend</p>
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>

            {/* Simple Line Chart */}
            <div className="relative h-32">
              <svg className="w-full h-full" viewBox="0 0 280 120" preserveAspectRatio="none">
                {/* Grid lines */}
                <line x1="0" y1="30" x2="280" y2="30" stroke={isDarkMode ? '#334155' : '#e2e8f0'} strokeWidth="1" opacity="0.3" />
                <line x1="0" y1="60" x2="280" y2="60" stroke={isDarkMode ? '#334155' : '#e2e8f0'} strokeWidth="1" opacity="0.3" />
                <line x1="0" y1="90" x2="280" y2="90" stroke={isDarkMode ? '#334155' : '#e2e8f0'} strokeWidth="1" opacity="0.3" />

                {/* Gradient fill */}
                <defs>
                  <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon
                  points={`0,110 ${weeklyPoints.map((point, i) => {
                    const x = (i / (weeklyPoints.length - 1)) * 280;
                    const y = 110 - ((point / maxPoint) * 90);
                    return `${x},${y}`;
                  }).join(' ')} 280,110`}
                  fill="url(#chartGradient)"
                />

                {/* Line chart */}
                <polyline
                  points={weeklyPoints.map((point, i) => {
                    const x = (i / (weeklyPoints.length - 1)) * 280;
                    const y = 110 - ((point / maxPoint) * 90);
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                />

                {/* Points */}
                {weeklyPoints.map((point, i) => {
                  const x = (i / (weeklyPoints.length - 1)) * 280;
                  const y = 110 - ((point / maxPoint) * 90);
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r="4"
                      fill="#3b82f6"
                      stroke={isDarkMode ? '#1e293b' : '#ffffff'}
                      strokeWidth="2"
                    />
                  );
                })}
              </svg>
            </div>

            {/* Week labels */}
            <div className="flex items-center justify-between mt-2 text-xs text-[#555]">
              <span>Week 1</span>
              <span>Week {weeklyPoints.length}</span>
            </div>
          </div>

          {/* Season Stats */}
          <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Season Stats</h3>
            </div>
            <div className="space-y-4">
              <div className={`flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <span className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Total Points</span>
                <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{(viewedTeam?.pointsFor || 0).toFixed(1)}</span>
              </div>
              <div className={`flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <span className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Points Per Game</span>
                <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {viewedTeam && (viewedTeam.wins + viewedTeam.losses + viewedTeam.ties) > 0
                    ? (viewedTeam.pointsFor / (viewedTeam.wins + viewedTeam.losses + viewedTeam.ties)).toFixed(1)
                    : '0.0'}
                </span>
              </div>
              <div className={`flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <span className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Points Against</span>
                <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{(viewedTeam?.pointsAgainst || 0).toFixed(1)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Scoring Format</span>
                <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{league?.scoringFormat?.toUpperCase() || 'PPR'}</span>
              </div>
            </div>
          </div>

          {/* Roster Alert */}
          {bestBenchPlayer && getMatchupGrade(bestBenchPlayer.projectedPoints || 0, bestBenchPlayer.position).startsWith('A') && (
            <div className="bg-gradient-to-r from-green-500/10 to-green-500/5 rounded-lg border border-green-500/30 p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Target className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <h4 className="text-green-500 font-bold text-sm mb-1">Roster Alert</h4>
                  <p className={`text-xs ${isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-600'}`}>
                    <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>{bestBenchPlayer.name}</strong> has a great projection this week. Consider starting them!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Injury Alert */}
          {(() => {
            const outPlayers = starters.filter(p => p.status === 'out' || p.status === 'O' || p.status === 'IR' || p.status === 'injured_reserve');
            const questionablePlayers = starters.filter(p => p.status === 'questionable' || p.status === 'Q' || p.status === 'doubtful' || p.status === 'D');
            if (outPlayers.length === 0 && questionablePlayers.length === 0) return null;
            return (
              <div className="space-y-3">
                {outPlayers.length > 0 && (
                  <div className="bg-gradient-to-r from-red-500/10 to-red-500/5 rounded-lg border border-red-500/30 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      </div>
                      <div>
                        <h4 className="text-red-500 font-bold text-sm mb-1">Inactive Players</h4>
                        <p className={`text-xs ${isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-600'}`}>
                          {outPlayers.map(p => (
                            <span key={p.id}>
                              <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>{p.name}</strong>
                              {' is '}
                              {p.status === 'injured_reserve' || p.status === 'IR' ? 'on IR' : 'out'}.{' '}
                            </span>
                          ))}
                          You need a replacement in your lineup.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {questionablePlayers.length > 0 && (
                  <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-500/5 rounded-lg border border-yellow-500/30 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                      </div>
                      <div>
                        <h4 className="text-yellow-500 font-bold text-sm mb-1">Injury Watch</h4>
                        <p className={`text-xs ${isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-600'}`}>
                          {questionablePlayers.map(p => (
                            <span key={p.id}>
                              <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>{p.name}</strong>
                              {' is '}
                              {p.status === 'doubtful' || p.status === 'D' ? 'doubtful' : 'questionable'}.{' '}
                            </span>
                          ))}
                          Have a backup plan ready.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
