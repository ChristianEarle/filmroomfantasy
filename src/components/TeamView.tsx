import { useState } from 'react';
import { User, TrendingUp, ArrowUpDown, Star, Sparkles, Trophy, Target, ChevronDown, AlertCircle } from 'lucide-react';
import { Player } from '../App';
import { nflPlayersData, getPlayersByPosition } from '../data/nflTeamsData';

interface RosterPlayer {
  positionType: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
  slot: string;
  name: string;
  team: string;
  projection: number;
  points: number;
  isStarter: boolean;
  matchupGrade?: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  status?: 'healthy' | 'questionable' | 'out';
}

interface TeamViewProps {
  onPlayerClick: (player: Player) => void;
  isDarkMode: boolean;
}

// Helper function to get player by name from the data
const getPlayer = (name: string) => nflPlayersData.find(p => p.name === name);

// Build roster from real data
const buildRosterFromData = (): RosterPlayer[] => {
  const matchupGrades: Array<'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F'> = 
    ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'];
  
  const getGrade = (weekChange: number): typeof matchupGrades[number] => {
    if (weekChange > 2) return 'A+';
    if (weekChange > 1.5) return 'A';
    if (weekChange > 1) return 'A-';
    if (weekChange > 0.5) return 'B+';
    if (weekChange > 0) return 'B';
    if (weekChange > -0.5) return 'B-';
    if (weekChange > -1) return 'C+';
    if (weekChange > -1.5) return 'C';
    return 'C-';
  };

  // Get top players from each position
  const topQB = getPlayer('Josh Allen')!;
  const topRBs = [getPlayer('Bijan Robinson')!, getPlayer('Breece Hall')!];
  const topWRs = [getPlayer('CeeDee Lamb')!, getPlayer("Ja'Marr Chase")!, getPlayer('Amon-Ra St. Brown')!];
  const topTE = getPlayer('Travis Kelce')!;
  const topK = getPlayer('Justin Tucker')!;
  const topDEF = getPlayer('San Francisco')!;

  // Bench players
  const benchQB = getPlayer('Lamar Jackson')!;
  const benchRBs = [getPlayer('Tony Pollard')!, getPlayer('Austin Ekeler')!];
  const benchWRs = [getPlayer('Stefon Diggs')!, getPlayer('Tyreek Hill')!];
  const benchTE = getPlayer('Mark Andrews')!;

  return [
    // Starters
    { slot: 'QB', positionType: 'QB', name: topQB.name, team: topQB.team, projection: topQB.projectedPoints, points: topQB.projectedPoints * 6, isStarter: true, matchupGrade: getGrade(topQB.weekChange), status: 'healthy' },
    { slot: 'RB1', positionType: 'RB', name: topRBs[0].name, team: topRBs[0].team, projection: topRBs[0].projectedPoints, points: topRBs[0].projectedPoints * 5.2, isStarter: true, matchupGrade: getGrade(topRBs[0].weekChange), status: 'healthy' },
    { slot: 'RB2', positionType: 'RB', name: topRBs[1].name, team: topRBs[1].team, projection: topRBs[1].projectedPoints, points: topRBs[1].projectedPoints * 5.3, isStarter: true, matchupGrade: getGrade(topRBs[1].weekChange), status: 'healthy' },
    { slot: 'WR1', positionType: 'WR', name: topWRs[0].name, team: topWRs[0].team, projection: topWRs[0].projectedPoints, points: topWRs[0].projectedPoints * 5.3, isStarter: true, matchupGrade: getGrade(topWRs[0].weekChange), status: 'healthy' },
    { slot: 'WR2', positionType: 'WR', name: topWRs[1].name, team: topWRs[1].team, projection: topWRs[1].projectedPoints, points: topWRs[1].projectedPoints * 5.3, isStarter: true, matchupGrade: getGrade(topWRs[1].weekChange), status: 'healthy' },
    { slot: 'TE', positionType: 'TE', name: topTE.name, team: topTE.team, projection: topTE.projectedPoints, points: topTE.projectedPoints * 5.1, isStarter: true, matchupGrade: getGrade(topTE.weekChange), status: 'questionable' },
    { slot: 'FLEX', positionType: 'WR', name: topWRs[2].name, team: topWRs[2].team, projection: topWRs[2].projectedPoints, points: topWRs[2].projectedPoints * 5.3, isStarter: true, matchupGrade: getGrade(topWRs[2].weekChange), status: 'healthy' },
    { slot: 'K', positionType: 'K', name: topK.name, team: topK.team, projection: topK.projectedPoints, points: topK.projectedPoints * 4.9, isStarter: true, matchupGrade: getGrade(topK.weekChange), status: 'healthy' },
    { slot: 'DEF', positionType: 'DEF', name: topDEF.name, team: topDEF.team, projection: topDEF.projectedPoints, points: topDEF.projectedPoints * 5.2, isStarter: true, matchupGrade: getGrade(topDEF.weekChange), status: 'healthy' },
    // Bench
    { slot: 'BN', positionType: 'QB', name: benchQB.name, team: benchQB.team, projection: benchQB.projectedPoints, points: benchQB.projectedPoints * 6, isStarter: false, matchupGrade: getGrade(benchQB.weekChange), status: 'healthy' },
    { slot: 'BN', positionType: 'RB', name: benchRBs[0].name, team: benchRBs[0].team, projection: benchRBs[0].projectedPoints, points: benchRBs[0].projectedPoints * 5.2, isStarter: false, matchupGrade: getGrade(benchRBs[0].weekChange), status: 'healthy' },
    { slot: 'BN', positionType: 'RB', name: benchRBs[1].name, team: benchRBs[1].team, projection: benchRBs[1].projectedPoints, points: benchRBs[1].projectedPoints * 5.1, isStarter: false, matchupGrade: getGrade(benchRBs[1].weekChange), status: 'healthy' },
    { slot: 'BN', positionType: 'WR', name: benchWRs[0].name, team: benchWRs[0].team, projection: benchWRs[0].projectedPoints, points: benchWRs[0].projectedPoints * 5.4, isStarter: false, matchupGrade: getGrade(benchWRs[0].weekChange), status: 'healthy' },
    { slot: 'BN', positionType: 'WR', name: benchWRs[1].name, team: benchWRs[1].team, projection: benchWRs[1].projectedPoints, points: benchWRs[1].projectedPoints * 5.3, isStarter: false, matchupGrade: getGrade(benchWRs[1].weekChange), status: 'healthy' },
    { slot: 'BN', positionType: 'TE', name: benchTE.name, team: benchTE.team, projection: benchTE.projectedPoints, points: benchTE.projectedPoints * 5.2, isStarter: false, matchupGrade: getGrade(benchTE.weekChange), status: 'healthy' },
  ];
};

const rosterPlayers: RosterPlayer[] = buildRosterFromData();

const weeklyPoints = [118.5, 142.3, 105.8, 158.4, 129.7, 144.1, 131.5, 146.8];

const getMatchupGradeColor = (grade: string | undefined) => {
  if (!grade) return 'text-slate-400 bg-slate-800';
  if (grade.startsWith('A')) return 'text-green-400 bg-green-500/20 border-green-500/30';
  if (grade.startsWith('B')) return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
  if (grade.startsWith('C')) return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
  return 'text-red-400 bg-red-500/20 border-red-500/30';
};

const getStatusIndicator = (status: string | undefined) => {
  switch (status) {
    case 'questionable':
      return <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" title="Questionable"></span>;
    case 'out':
      return <span className="w-2 h-2 rounded-full bg-red-500" title="Out"></span>;
    default:
      return null;
  }
};

export function TeamView({ onPlayerClick, isDarkMode }: TeamViewProps) {
  const [selectedWeek, setSelectedWeek] = useState(8);
  const [showWeekDropdown, setShowWeekDropdown] = useState(false);

  const starters = rosterPlayers.filter(p => p.isStarter);
  const bench = rosterPlayers.filter(p => !p.isStarter);

  const starterProjection = starters.reduce((sum, p) => sum + p.projection, 0);
  const totalPoints = rosterPlayers.reduce((sum, p) => sum + p.points, 0);

  // Convert roster player to Player interface for modal
  const convertToPlayer = (rosterPlayer: RosterPlayer, index: number): Player => ({
    id: `roster-${index}`,
    rank: index + 1,
    name: rosterPlayer.name,
    team: rosterPlayer.team,
    position: rosterPlayer.positionType,
    keyLine: 'O/U 85.5 rec yds',
    projectedPoints: rosterPlayer.projection,
    weekChange: 0.5,
  });

  // Calculate max point for chart scaling
  const maxPoint = Math.max(...weeklyPoints);

  // Find the star performer
  const starPlayer = starters.reduce((prev, current) =>
    (prev.projection > current.projection) ? prev : current
  );

  // Find bench player with best matchup
  const bestBenchPlayer = bench.reduce((prev, current) => {
    const prevGrade = prev.matchupGrade || 'F';
    const currentGrade = current.matchupGrade || 'F';
    return currentGrade < prevGrade ? current : prev;
  });

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header Section */}
      <div className={`rounded-xl border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className={`text-2xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>My Team</h1>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Week {selectedWeek} roster and projections</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick Stats */}
            <div className="flex items-center gap-6 mr-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{starterProjection.toFixed(1)}</div>
                <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Projected</div>
              </div>
              <div className={`w-px h-10 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">5-3</div>
                <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Record</div>
              </div>
              <div className={`w-px h-10 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">#2</div>
                <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Standing</div>
              </div>
            </div>

            {/* Week Selector */}
            <div className="relative">
              <button
                onClick={() => setShowWeekDropdown(!showWeekDropdown)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'}`}
              >
                <span className="text-sm font-medium">Week {selectedWeek}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showWeekDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showWeekDropdown && (
                <div className={`absolute top-12 right-0 w-32 rounded-lg border shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(week => (
                    <button
                      key={week}
                      onClick={() => { setSelectedWeek(week); setShowWeekDropdown(false); }}
                      className={`w-full px-4 py-2 text-sm text-left transition-colors ${
                        selectedWeek === week
                          ? 'bg-blue-600 text-white'
                          : isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'
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
          <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />
                <h2 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Starting Lineup</h2>
              </div>
              <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{starterProjection.toFixed(1)} projected pts</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <th className={`text-left px-4 py-3 text-xs font-semibold w-16 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>SLOT</th>
                    <th className={`text-left px-4 py-3 text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>PLAYER</th>
                    <th className={`text-center px-4 py-3 text-xs font-semibold w-20 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>MATCHUP</th>
                    <th className={`text-right px-4 py-3 text-xs font-semibold w-20 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>PROJ</th>
                    <th className={`text-right px-4 py-3 text-xs font-semibold w-24 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>SEASON</th>
                  </tr>
                </thead>
                <tbody>
                  {starters.map((player, index) => (
                    <tr
                      key={index}
                      onClick={() => onPlayerClick(convertToPlayer(player, index))}
                      className={`border-b transition-colors cursor-pointer group ${isDarkMode ? 'border-slate-800 hover:bg-slate-800/70' : 'border-slate-100 hover:bg-slate-50'}`}
                    >
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${isDarkMode ? 'text-slate-500 bg-slate-800' : 'text-slate-500 bg-slate-100'}`}>
                          {player.slot}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border group-hover:border-blue-500 transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                            {player.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-bold group-hover:text-blue-500 transition-colors ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.name}</span>
                                {getStatusIndicator(player.status)}
                              </div>
                              <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{player.team} • {player.positionType}</div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-1 rounded border ${getMatchupGradeColor(player.matchupGrade)}`}>
                          {player.matchupGrade}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.projection.toFixed(1)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{player.points.toFixed(1)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bench Section */}
          <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <ArrowUpDown className={`w-4 h-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                <h2 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Bench</h2>
              </div>
              <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{bench.length} players</span>
            </div>

            <div className="p-4 space-y-2">
              {bench.map((player, index) => (
                <button
                  key={index}
                  onClick={() => onPlayerClick(convertToPlayer(player, starters.length + index))}
                  className={`w-full rounded-lg px-4 py-3 border hover:border-blue-500 transition-all text-left group ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                        {player.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold transition-colors ${isDarkMode ? 'text-slate-300 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>{player.name}</span>
                          {player.matchupGrade && player.matchupGrade.startsWith('A') && (
                            <Sparkles className="w-3 h-3 text-green-500" />
                          )}
                        </div>
                        <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{player.team} • {player.positionType}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-semibold px-2 py-1 rounded border ${getMatchupGradeColor(player.matchupGrade)}`}>
                        {player.matchupGrade}
                      </span>
                      <span className={`text-sm font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{player.projection.toFixed(1)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Weekly Performance Chart */}
          <div className={`rounded-xl border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Weekly Points</h3>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Season performance trend</p>
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>

            {/* Simple Line Chart */}
            <div className="relative h-32">
              <svg className="w-full h-full" viewBox="0 0 280 120" preserveAspectRatio="none">
                {/* Grid lines */}
                <line x1="0" y1="30" x2="280" y2="30" stroke="#334155" strokeWidth="1" opacity="0.3" />
                <line x1="0" y1="60" x2="280" y2="60" stroke="#334155" strokeWidth="1" opacity="0.3" />
                <line x1="0" y1="90" x2="280" y2="90" stroke="#334155" strokeWidth="1" opacity="0.3" />

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
                      stroke="#1e293b"
                      strokeWidth="2"
                    />
                  );
                })}
              </svg>
            </div>

            {/* Week labels */}
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
              <span>Week 1</span>
              <span>Week {weeklyPoints.length}</span>
            </div>
          </div>

          {/* Season Stats */}
          <div className={`rounded-xl border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Season Stats</h3>
            </div>
            <div className="space-y-4">
              <div className={`flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Points</span>
                <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{totalPoints.toFixed(1)}</span>
              </div>
              <div className={`flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Points Per Game</span>
                <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{(totalPoints / 8).toFixed(1)}</span>
              </div>
              <div className={`flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Highest Week</span>
                <span className="text-green-500 font-bold">{Math.max(...weeklyPoints).toFixed(1)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Lowest Week</span>
                <span className="text-red-500 font-bold">{Math.min(...weeklyPoints).toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* Roster Alert */}
          {bestBenchPlayer.matchupGrade && bestBenchPlayer.matchupGrade.startsWith('A') && (
            <div className="bg-gradient-to-r from-green-500/10 to-green-500/5 rounded-xl border border-green-500/30 p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Target className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <h4 className="text-green-500 font-bold text-sm mb-1">Roster Alert</h4>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>{bestBenchPlayer.name}</strong> has an {bestBenchPlayer.matchupGrade} matchup this week. Consider starting them!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Injury Alert */}
          {starters.some(p => p.status === 'questionable') && (
            <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-500/5 rounded-xl border border-yellow-500/30 p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                </div>
                <div>
                  <h4 className="text-yellow-500 font-bold text-sm mb-1">Injury Watch</h4>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {starters.filter(p => p.status === 'questionable').map(p => (
                      <span key={p.name}><strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>{p.name}</strong> is questionable. </span>
                    ))}
                    Have a backup plan ready.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
