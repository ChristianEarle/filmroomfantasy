import { useState } from 'react';
import { ChevronDown, TrendingUp, TrendingDown, Zap, Shield, Target, Check } from 'lucide-react';
import { Player } from '../App';

interface MatchupPlayer {
  position: string;
  name: string;
  team: string;
  projection: number;
  isStarter: boolean;
  matchupGrade?: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  weekChange?: number;
}

interface MatchupViewProps {
  onPlayerClick: (player: Player) => void;
  isDarkMode: boolean;
}

const yourTeam: MatchupPlayer[] = [
  // Starters
  { position: 'QB', name: 'Josh Allen', team: 'BUF', projection: 24.1, isStarter: true, matchupGrade: 'A', weekChange: 1.2 },
  { position: 'RB', name: 'Bijan Robinson', team: 'ATL', projection: 17.1, isStarter: true, matchupGrade: 'B+', weekChange: -0.5 },
  { position: 'RB', name: 'Breece Hall', team: 'NYJ', projection: 17.2, isStarter: true, matchupGrade: 'B', weekChange: 0.8 },
  { position: 'WR', name: 'CeeDee Lamb', team: 'DAL', projection: 18.7, isStarter: true, matchupGrade: 'A-', weekChange: 2.1 },
  { position: 'WR', name: "Ja'Marr Chase", team: 'CIN', projection: 19.4, isStarter: true, matchupGrade: 'A', weekChange: 1.5 },
  { position: 'TE', name: 'Travis Kelce', team: 'KC', projection: 14.2, isStarter: true, matchupGrade: 'B+', weekChange: -1.2 },
  { position: 'FLEX', name: 'Amon-Ra St. Brown', team: 'DET', projection: 17.6, isStarter: true, matchupGrade: 'A-', weekChange: 0.9 },
  { position: 'K', name: 'Justin Tucker', team: 'BAL', projection: 9.4, isStarter: true, matchupGrade: 'B', weekChange: 0.2 },
  { position: 'DEF', name: 'San Francisco', team: 'SF', projection: 11.2, isStarter: true, matchupGrade: 'A', weekChange: 1.8 },

  // Bench
  { position: 'RB', name: 'Tony Pollard', team: 'DAL', projection: 14.8, isStarter: false, matchupGrade: 'C+', weekChange: -0.3 },
  { position: 'WR', name: 'Stefon Diggs', team: 'BUF', projection: 15.1, isStarter: false, matchupGrade: 'B-', weekChange: -2.1 },
  { position: 'WR', name: 'Tyreek Hill', team: 'MIA', projection: 16.8, isStarter: false, matchupGrade: 'A+', weekChange: 3.4 },
  { position: 'QB', name: 'Lamar Jackson', team: 'BAL', projection: 22.9, isStarter: false, matchupGrade: 'A-', weekChange: 0.6 },
  { position: 'TE', name: 'Mark Andrews', team: 'BAL', projection: 12.3, isStarter: false, matchupGrade: 'B', weekChange: -0.8 },
  { position: 'RB', name: 'Austin Ekeler', team: 'LAC', projection: 13.7, isStarter: false, matchupGrade: 'C', weekChange: -1.5 },
];

const opponentTeam: MatchupPlayer[] = [
  // Starters
  { position: 'QB', name: 'Jalen Hurts', team: 'PHI', projection: 23.4, isStarter: true, matchupGrade: 'A-', weekChange: 0.8 },
  { position: 'RB', name: 'Christian McCaffrey', team: 'SF', projection: 19.8, isStarter: true, matchupGrade: 'A', weekChange: -1.2 },
  { position: 'RB', name: 'Derrick Henry', team: 'TEN', projection: 16.5, isStarter: true, matchupGrade: 'B+', weekChange: 0.4 },
  { position: 'WR', name: 'Justin Jefferson', team: 'MIN', projection: 18.3, isStarter: true, matchupGrade: 'A', weekChange: 1.1 },
  { position: 'WR', name: 'Tyreek Hill', team: 'MIA', projection: 16.8, isStarter: true, matchupGrade: 'A+', weekChange: 3.4 },
  { position: 'TE', name: 'TJ Hockenson', team: 'MIN', projection: 11.9, isStarter: true, matchupGrade: 'B', weekChange: -0.5 },
  { position: 'FLEX', name: 'Davante Adams', team: 'LV', projection: 15.2, isStarter: true, matchupGrade: 'B-', weekChange: -1.8 },
  { position: 'K', name: 'Harrison Butker', team: 'KC', projection: 8.8, isStarter: true, matchupGrade: 'B+', weekChange: 0.3 },
  { position: 'DEF', name: 'Dallas', team: 'DAL', projection: 9.2, isStarter: true, matchupGrade: 'C+', weekChange: -0.7 },

  // Bench
  { position: 'QB', name: 'Tua Tagovailoa', team: 'MIA', projection: 19.7, isStarter: false, matchupGrade: 'B+', weekChange: 0.5 },
  { position: 'RB', name: 'James Conner', team: 'ARI', projection: 13.2, isStarter: false, matchupGrade: 'C', weekChange: -0.9 },
  { position: 'WR', name: 'DeVonta Smith', team: 'PHI', projection: 14.6, isStarter: false, matchupGrade: 'B', weekChange: 0.2 },
  { position: 'WR', name: 'DK Metcalf', team: 'SEA', projection: 13.9, isStarter: false, matchupGrade: 'B-', weekChange: -0.4 },
  { position: 'TE', name: 'Dalton Kincaid', team: 'BUF', projection: 9.8, isStarter: false, matchupGrade: 'C+', weekChange: 0.6 },
  { position: 'RB', name: 'Rachaad White', team: 'TB', projection: 12.1, isStarter: false, matchupGrade: 'C', weekChange: -1.2 },
];

const getMatchupGradeColor = (grade: string | undefined) => {
  if (!grade) return 'text-slate-400 bg-slate-800';
  if (grade.startsWith('A')) return 'text-green-400 bg-green-500/20';
  if (grade.startsWith('B')) return 'text-blue-400 bg-blue-500/20';
  if (grade.startsWith('C')) return 'text-yellow-400 bg-yellow-500/20';
  return 'text-red-400 bg-red-500/20';
};

export function MatchupView({ onPlayerClick, isDarkMode }: MatchupViewProps) {
  const [selectedWeek, setSelectedWeek] = useState(5);
  const [showWeekDropdown, setShowWeekDropdown] = useState(false);

  const yourStarters = yourTeam.filter(p => p.isStarter);
  const yourBench = yourTeam.filter(p => !p.isStarter);
  const opponentStarters = opponentTeam.filter(p => p.isStarter);
  const opponentBench = opponentTeam.filter(p => !p.isStarter);

  const yourTotal = yourStarters.reduce((sum, p) => sum + p.projection, 0);
  const opponentTotal = opponentStarters.reduce((sum, p) => sum + p.projection, 0);

  // Calculate win probability based on projection difference
  const projDiff = yourTotal - opponentTotal;
  const winProbability = Math.min(95, Math.max(5, 50 + (projDiff * 2.5)));

  // Convert matchup player to Player interface for modal
  const convertToPlayer = (matchupPlayer: MatchupPlayer, index: number): Player => ({
    id: `matchup-${index}`,
    rank: index + 1,
    name: matchupPlayer.name,
    team: matchupPlayer.team,
    position: matchupPlayer.position === 'FLEX' ? 'WR' : matchupPlayer.position as any,
    keyLine: 'O/U 85.5 rec yds',
    projectedPoints: matchupPlayer.projection,
    weekChange: matchupPlayer.weekChange || 0,
  });

  // Find position-by-position advantages
  const positionComparison = yourStarters.map((yourPlayer, idx) => {
    const oppPlayer = opponentStarters[idx];
    const diff = yourPlayer.projection - oppPlayer.projection;
    return { position: yourPlayer.position, diff, yourPlayer, oppPlayer };
  });

  const yourAdvantages = positionComparison.filter(p => p.diff > 1).length;
  const oppAdvantages = positionComparison.filter(p => p.diff < -1).length;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header Card */}
      <div className={`rounded-xl border p-8 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className={`text-2xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Fantasy Matchup</h1>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Side-by-side projections and biggest edges</p>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowWeekDropdown(!showWeekDropdown)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'}`}
            >
              <span className="text-sm font-medium">Week {selectedWeek}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showWeekDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showWeekDropdown && (
              <div className={`absolute top-12 right-0 w-32 rounded-lg border shadow-xl z-50 overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(week => (
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

        {/* Matchup Overview */}
        <div className={`rounded-xl p-6 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between mb-6">
            {/* Your Team */}
            <div className="text-center flex-1">
              <div className={`text-sm mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Your Team</div>
              <div className={`text-4xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{yourTotal.toFixed(1)}</div>
              <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Projected Points</div>
            </div>

            {/* VS Badge */}
            <div className="px-8">
              <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${isDarkMode ? 'bg-slate-900 border-slate-600' : 'bg-white border-slate-300'}`}>
                <span className={`font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>VS</span>
              </div>
            </div>

            {/* Opponent */}
            <div className="text-center flex-1">
              <div className={`text-sm mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>The Gronk Squad</div>
              <div className={`text-4xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{opponentTotal.toFixed(1)}</div>
              <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Projected Points</div>
            </div>
          </div>

          {/* Win Probability Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-blue-500 font-semibold">{winProbability.toFixed(0)}% Win</span>
              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{(100 - winProbability).toFixed(0)}% Win</span>
            </div>
            <div className={`h-3 rounded-full overflow-hidden flex ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}>
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                style={{ width: `${winProbability}%` }}
              />
              <div
                className={`h-full ${isDarkMode ? 'bg-slate-600' : 'bg-slate-300'}`}
                style={{ width: `${100 - winProbability}%` }}
              />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className={`rounded-lg p-3 text-center border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Target className="w-4 h-4 text-blue-500" />
                <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Proj. Margin</span>
              </div>
              <div className={`text-lg font-bold ${projDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {projDiff >= 0 ? '+' : ''}{projDiff.toFixed(1)}
              </div>
            </div>
            <div className={`rounded-lg p-3 text-center border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Zap className="w-4 h-4 text-green-500" />
                <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Your Edges</span>
              </div>
              <div className="text-lg font-bold text-green-500">{yourAdvantages}</div>
            </div>
            <div className={`rounded-lg p-3 text-center border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Shield className="w-4 h-4 text-red-500" />
                <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Their Edges</span>
              </div>
              <div className="text-lg font-bold text-red-500">{oppAdvantages}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Position-by-Position Comparison */}
      <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <h2 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Position-by-Position Breakdown</h2>
          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Compare projections at each roster spot</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`border-b ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <th className={`text-left px-6 py-3 text-xs w-16 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>POS</th>
                <th className={`text-left px-4 py-3 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Your Player</th>
                <th className={`text-center px-4 py-3 text-xs w-24 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Proj</th>
                <th className={`text-center px-4 py-3 text-xs w-20 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Edge</th>
                <th className={`text-center px-4 py-3 text-xs w-24 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Proj</th>
                <th className={`text-right px-4 py-3 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Their Player</th>
              </tr>
            </thead>
            <tbody>
              {positionComparison.map((comp, index) => (
                <tr key={index} className={`border-b transition-colors ${isDarkMode ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50'}`}>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded ${isDarkMode ? 'text-slate-500 bg-slate-800' : 'text-slate-500 bg-slate-100'}`}>
                      {comp.position}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => onPlayerClick(convertToPlayer(comp.yourPlayer, index))}
                      className="text-left hover:text-blue-500 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`font-bold group-hover:text-blue-500 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{comp.yourPlayer.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${getMatchupGradeColor(comp.yourPlayer.matchupGrade)}`}>
                          {comp.yourPlayer.matchupGrade}
                        </span>
                      </div>
                      <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{comp.yourPlayer.team}</div>
                    </button>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{comp.yourPlayer.projection.toFixed(1)}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                      comp.diff > 1 ? 'bg-green-500/20 text-green-500' :
                      comp.diff < -1 ? 'bg-red-500/20 text-red-500' :
                      isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {comp.diff > 0 ? <TrendingUp className="w-3 h-3" /> : comp.diff < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                      {comp.diff > 0 ? '+' : ''}{comp.diff.toFixed(1)}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{comp.oppPlayer.projection.toFixed(1)}</span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      onClick={() => onPlayerClick(convertToPlayer(comp.oppPlayer, yourTeam.length + index))}
                      className="text-right hover:text-blue-500 transition-colors group"
                    >
                      <div className="flex items-center gap-2 justify-end">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${getMatchupGradeColor(comp.oppPlayer.matchupGrade)}`}>
                          {comp.oppPlayer.matchupGrade}
                        </span>
                        <span className={`font-bold group-hover:text-blue-500 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{comp.oppPlayer.name}</span>
                      </div>
                      <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{comp.oppPlayer.team}</div>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bench Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Your Bench */}
        <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`p-4 border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
            <h3 className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Your Bench</h3>
          </div>
          <div className="p-4 space-y-2">
            {yourBench.map((player, index) => (
              <button
                key={index}
                onClick={() => onPlayerClick(convertToPlayer(player, yourStarters.length + index))}
                className={`w-full rounded-lg px-4 py-3 border hover:border-blue-500 transition-all text-left group ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs w-8 font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{player.position}</span>
                    <div>
                      <span className={`font-bold transition-colors ${isDarkMode ? 'text-slate-300 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>{player.name}</span>
                      <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{player.team}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${getMatchupGradeColor(player.matchupGrade)}`}>
                      {player.matchupGrade}
                    </span>
                    <span className={`text-sm font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{player.projection.toFixed(1)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Opponent Bench */}
        <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`p-4 border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
            <h3 className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Opponent's Bench</h3>
          </div>
          <div className="p-4 space-y-2">
            {opponentBench.map((player, index) => (
              <button
                key={index}
                onClick={() => onPlayerClick(convertToPlayer(player, yourTeam.length + opponentStarters.length + index))}
                className={`w-full rounded-lg px-4 py-3 border hover:border-blue-500 transition-all text-left group ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs w-8 font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{player.position}</span>
                    <div>
                      <span className={`font-bold transition-colors ${isDarkMode ? 'text-slate-300 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>{player.name}</span>
                      <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{player.team}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${getMatchupGradeColor(player.matchupGrade)}`}>
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

      {/* FilmRoom Insights */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-6 border border-blue-500/30">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white mb-2">FilmRoom Edge Analysis</h3>
            <div className="space-y-2 text-sm text-blue-100">
              <p className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span>You have a clear <strong className="text-white">WR advantage</strong> this week with CeeDee and Ja'Marr both facing weak secondaries.</span>
              </p>
              <p className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span>Consider starting <strong className="text-white">Tyreek Hill</strong> over Amon-Ra St. Brown for upside — he has an A+ matchup grade.</span>
              </p>
              <p className="flex items-start gap-2">
                <Check className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <span>Monitor <strong className="text-white">Travis Kelce's</strong> injury status — he's questionable with an ankle issue.</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
