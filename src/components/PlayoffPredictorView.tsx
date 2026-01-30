import { Trophy, TrendingUp, TrendingDown, Calendar, Award, BarChart3, Shuffle, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

interface Team {
  id: string;
  name: string;
  owner: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  projectedWins: number;
  playoffChance: number;
  remainingGames: string[];
}

interface Matchup {
  id: string;
  week: number;
  team1: string;
  team1Id: string;
  team2: string;
  team2Id: string;
  winner?: string; // team1Id or team2Id
  team1Points?: number;
  team2Points?: number;
}

const leagueTeams: Team[] = [
  {
    id: '1',
    name: 'Sunday Funday (You)',
    owner: 'You',
    wins: 8,
    losses: 3,
    pointsFor: 1456.2,
    pointsAgainst: 1289.5,
    projectedWins: 10.5,
    playoffChance: 92,
    remainingGames: ['Team 8', 'Team 4', 'Team 6']
  },
  {
    id: '2',
    name: 'The Gronk Squad',
    owner: 'Mike T.',
    wins: 9,
    losses: 2,
    pointsFor: 1521.8,
    pointsAgainst: 1312.4,
    projectedWins: 11.2,
    playoffChance: 98,
    remainingGames: ['Team 5', 'Team 3', 'Team 7']
  },
  {
    id: '3',
    name: 'Mahomes Alone',
    owner: 'Sarah K.',
    wins: 8,
    losses: 3,
    pointsFor: 1489.3,
    pointsAgainst: 1298.7,
    projectedWins: 10.3,
    playoffChance: 89,
    remainingGames: ['Team 9', 'Team 2', 'Team 10']
  },
  {
    id: '4',
    name: 'CMC Hammer',
    owner: 'David L.',
    wins: 7,
    losses: 4,
    pointsFor: 1398.5,
    pointsAgainst: 1356.2,
    projectedWins: 9.1,
    playoffChance: 68,
    remainingGames: ['Team 6', 'Team 1', 'Team 5']
  },
  {
    id: '5',
    name: 'Allen Army',
    owner: 'Jessica R.',
    wins: 6,
    losses: 5,
    pointsFor: 1367.9,
    pointsAgainst: 1389.4,
    projectedWins: 8.2,
    playoffChance: 45,
    remainingGames: ['Team 2', 'Team 7', 'Team 4']
  },
  {
    id: '6',
    name: 'Kelce Krush',
    owner: 'Tom B.',
    wins: 6,
    losses: 5,
    pointsFor: 1345.2,
    pointsAgainst: 1401.8,
    projectedWins: 7.8,
    playoffChance: 38,
    remainingGames: ['Team 4', 'Team 10', 'Team 1']
  },
  {
    id: '7',
    name: 'Hurts So Good',
    owner: 'Emily W.',
    wins: 5,
    losses: 6,
    pointsFor: 1298.7,
    pointsAgainst: 1423.5,
    projectedWins: 6.9,
    playoffChance: 22,
    remainingGames: ['Team 10', 'Team 5', 'Team 2']
  },
  {
    id: '8',
    name: 'Jefferson Airplane',
    owner: 'Chris M.',
    wins: 5,
    losses: 6,
    pointsFor: 1287.4,
    pointsAgainst: 1445.1,
    projectedWins: 6.5,
    playoffChance: 18,
    remainingGames: ['Team 1', 'Team 9', 'Team 3']
  },
  {
    id: '9',
    name: 'Lamar Hunt',
    owner: 'Brandon P.',
    wins: 4,
    losses: 7,
    pointsFor: 1234.6,
    pointsAgainst: 1478.2,
    projectedWins: 5.7,
    playoffChance: 8,
    remainingGames: ['Team 3', 'Team 8', 'Team 11']
  },
  {
    id: '10',
    name: 'Chase Your Dreams',
    owner: 'Rachel S.',
    wins: 3,
    losses: 8,
    pointsFor: 1198.3,
    pointsAgainst: 1512.9,
    projectedWins: 4.8,
    playoffChance: 3,
    remainingGames: ['Team 7', 'Team 6', 'Team 3']
  },
];

// Generate all remaining matchups
const generateMatchups = (): Matchup[] => {
  return [
    // Week 12
    { id: 'm1', week: 12, team1: 'Sunday Funday (You)', team1Id: '1', team2: 'Jefferson Airplane', team2Id: '8' },
    { id: 'm2', week: 12, team1: 'The Gronk Squad', team1Id: '2', team2: 'Allen Army', team2Id: '5' },
    { id: 'm3', week: 12, team1: 'Mahomes Alone', team1Id: '3', team2: 'Lamar Hunt', team2Id: '9' },
    { id: 'm4', week: 12, team1: 'CMC Hammer', team1Id: '4', team2: 'Kelce Krush', team2Id: '6' },
    { id: 'm5', week: 12, team1: 'Hurts So Good', team1Id: '7', team2: 'Chase Your Dreams', team2Id: '10' },
    
    // Week 13
    { id: 'm6', week: 13, team1: 'Sunday Funday (You)', team1Id: '1', team2: 'CMC Hammer', team2Id: '4' },
    { id: 'm7', week: 13, team1: 'The Gronk Squad', team1Id: '2', team2: 'Mahomes Alone', team2Id: '3' },
    { id: 'm8', week: 13, team1: 'Allen Army', team1Id: '5', team2: 'Hurts So Good', team2Id: '7' },
    { id: 'm9', week: 13, team1: 'Kelce Krush', team1Id: '6', team2: 'Chase Your Dreams', team2Id: '10' },
    { id: 'm10', week: 13, team1: 'Jefferson Airplane', team1Id: '8', team2: 'Lamar Hunt', team2Id: '9' },
    
    // Week 14
    { id: 'm11', week: 14, team1: 'Sunday Funday (You)', team1Id: '1', team2: 'Kelce Krush', team2Id: '6' },
    { id: 'm12', week: 14, team1: 'The Gronk Squad', team1Id: '2', team2: 'Hurts So Good', team2Id: '7' },
    { id: 'm13', week: 14, team1: 'Mahomes Alone', team1Id: '3', team2: 'Chase Your Dreams', team2Id: '10' },
    { id: 'm14', week: 14, team1: 'CMC Hammer', team1Id: '4', team2: 'Allen Army', team2Id: '5' },
    { id: 'm15', week: 14, team1: 'Jefferson Airplane', team1Id: '8', team2: 'Lamar Hunt', team2Id: '9' },
  ];
};

interface PlayoffPredictorViewProps {
  isDarkMode: boolean;
}

export function PlayoffPredictorView({ isDarkMode }: PlayoffPredictorViewProps) {
  const [activeTab, setActiveTab] = useState<'predictor' | 'simulator'>('predictor');
  const [matchups, setMatchups] = useState<Matchup[]>(generateMatchups());
  const [showPointsInput, setShowPointsInput] = useState(false);
  
  // Calculate simulated standings based on matchup selections
  const calculateSimulatedStandings = () => {
    const teamRecords = leagueTeams.map(team => ({
      ...team,
      simulatedWins: team.wins,
      simulatedLosses: team.losses,
      simulatedPointsFor: team.pointsFor,
    }));

    matchups.forEach(matchup => {
      if (matchup.winner) {
        const winnerTeam = teamRecords.find(t => t.id === matchup.winner);
        const loserTeam = teamRecords.find(t => 
          t.id === (matchup.winner === matchup.team1Id ? matchup.team2Id : matchup.team1Id)
        );
        
        if (winnerTeam) {
          winnerTeam.simulatedWins += 1;
          // Add points if provided
          if (showPointsInput) {
            if (matchup.winner === matchup.team1Id && matchup.team1Points) {
              winnerTeam.simulatedPointsFor += matchup.team1Points;
            } else if (matchup.winner === matchup.team2Id && matchup.team2Points) {
              winnerTeam.simulatedPointsFor += matchup.team2Points;
            }
          }
        }
        if (loserTeam) {
          loserTeam.simulatedLosses += 1;
          // Add points if provided
          if (showPointsInput) {
            if (matchup.winner === matchup.team1Id && matchup.team2Points) {
              loserTeam.simulatedPointsFor += matchup.team2Points;
            } else if (matchup.winner === matchup.team2Id && matchup.team1Points) {
              loserTeam.simulatedPointsFor += matchup.team1Points;
            }
          }
        }
      }
    });

    // Sort by wins, then by points for
    return teamRecords.sort((a, b) => {
      if (b.simulatedWins !== a.simulatedWins) {
        return b.simulatedWins - a.simulatedWins;
      }
      return b.simulatedPointsFor - a.simulatedPointsFor;
    });
  };

  const handleMatchupWinner = (matchupId: string, winnerId: string) => {
    setMatchups(prev => prev.map(m => 
      m.id === matchupId ? { ...m, winner: m.winner === winnerId ? undefined : winnerId } : m
    ));
  };

  const handlePointsChange = (matchupId: string, team: 'team1' | 'team2', points: string) => {
    const pointsValue = points === '' ? undefined : parseFloat(points);
    setMatchups(prev => prev.map(m => {
      if (m.id === matchupId) {
        const updated = { ...m, [team === 'team1' ? 'team1Points' : 'team2Points']: pointsValue };
        
        // Auto-select winner based on points if both points are entered
        if (updated.team1Points !== undefined && updated.team2Points !== undefined) {
          updated.winner = updated.team1Points > updated.team2Points ? m.team1Id : m.team2Id;
        }
        
        return updated;
      }
      return m;
    }));
  };

  const resetSimulator = () => {
    setMatchups(generateMatchups());
  };

  const simulatedStandings = calculateSimulatedStandings();
  const sortedTeams = [...leagueTeams].sort((a, b) => b.playoffChance - a.playoffChance);

  const getPlayoffChanceColor = (chance: number) => {
    if (chance >= 75) return 'text-green-500';
    if (chance >= 50) return 'text-yellow-500';
    if (chance >= 25) return 'text-orange-500';
    return 'text-red-500';
  };

  const getPlayoffChanceBg = (chance: number) => {
    if (chance >= 75) return 'bg-green-500/10 border-green-500/30';
    if (chance >= 50) return 'bg-yellow-500/10 border-yellow-500/30';
    if (chance >= 25) return 'bg-orange-500/10 border-orange-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className={`border rounded-xl p-8 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-blue-500" />
              <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Fantasy Playoffs • Week 15-17</span>
            </div>
            <h1 className={`text-3xl mb-2 font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Playoff Predictor</h1>
            <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
              {activeTab === 'predictor' 
                ? 'Based on 10,000 Monte Carlo simulations of remaining matchups'
                : 'Simulate specific game outcomes to see playoff implications'
              }
            </p>
          </div>
          <div className={`rounded-lg px-6 py-4 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
            <div className={`text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Top 6 Make Playoffs</div>
            <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>3 Weeks Left</div>
            <div className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Regular Season</div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className={`mt-6 flex gap-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <button
            onClick={() => setActiveTab('predictor')}
            className={`px-4 py-2 font-semibold text-sm transition-all relative ${
              activeTab === 'predictor'
                ? 'text-blue-500'
                : isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Predictions
            </div>
            {activeTab === 'predictor' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-2 font-semibold text-sm transition-all relative ${
              activeTab === 'simulator'
                ? 'text-blue-500'
                : isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Shuffle className="w-4 h-4" />
              Simulator
            </div>
            {activeTab === 'simulator' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'predictor' ? (
        // PREDICTOR VIEW
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main Standings Table */}
          <div className="xl:col-span-2">
            <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              {/* Table Header */}
              <div className={`p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                <h2 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Playoff Chances</h2>
                <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Probability of making playoffs based on current standings and remaining schedule
                </p>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <th className={`text-left px-6 py-3 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Rank</th>
                      <th className={`text-left px-6 py-3 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Team</th>
                      <th className={`text-center px-6 py-3 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Record</th>
                      <th className={`text-right px-6 py-3 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Points For</th>
                      <th className={`text-right px-6 py-3 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Proj. Wins</th>
                      <th className={`text-right px-6 py-3 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Playoff %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTeams.map((team, index) => (
                      <tr
                        key={team.id}
                        className={`border-b transition-colors ${
                          isDarkMode ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-100 hover:bg-slate-50'
                        } ${team.owner === 'You' ? 'bg-blue-500/5' : ''}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{index + 1}</span>
                            {index < 6 && (
                              <Award className="w-4 h-4 text-yellow-500" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{team.name}</div>
                            <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{team.owner}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {team.wins}-{team.losses}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{team.pointsFor.toFixed(1)}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {team.projectedWins.toFixed(1)}
                            </span>
                            {team.projectedWins > team.wins + 1 ? (
                              <TrendingUp className="w-3 h-3 text-green-500" />
                            ) : team.projectedWins < team.wins + 1 ? (
                              <TrendingDown className="w-3 h-3 text-red-500" />
                            ) : null}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-sm font-bold ${getPlayoffChanceColor(team.playoffChance)}`}>
                            {team.playoffChance}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer Note */}
              <div className={`px-6 py-4 border-t ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <Award className="w-3 h-3 inline text-yellow-500" /> = Currently in playoff position
                </p>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Your Team Status */}
            <div className={`rounded-xl border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Your Playoff Status</h3>
              <div className={`rounded-lg p-4 border ${getPlayoffChanceBg(sortedTeams.find(t => t.owner === 'You')?.playoffChance || 0)}`}>
                <div className="text-center">
                  <div className={`text-4xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {sortedTeams.find(t => t.owner === 'You')?.playoffChance}%
                  </div>
                  <div className={`text-sm mb-3 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Chance to Make Playoffs</div>
                  <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    <div 
                      className="h-full bg-blue-600 transition-all duration-500"
                      style={{ width: `${sortedTeams.find(t => t.owner === 'You')?.playoffChance}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Current Rank:</span>
                  <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    #{sortedTeams.findIndex(t => t.owner === 'You') + 1}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Projected Wins:</span>
                  <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {sortedTeams.find(t => t.owner === 'You')?.projectedWins.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Games Remaining:</span>
                  <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>3</span>
                </div>
              </div>
            </div>

            {/* Remaining Schedule */}
            <div className={`rounded-xl border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Your Remaining Games</h3>
              <div className="space-y-3">
                {sortedTeams.find(t => t.owner === 'You')?.remainingGames.map((opponent, index) => (
                  <div key={index} className={`rounded-lg p-3 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className={`w-4 h-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                        <div>
                          <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Week {12 + index}</div>
                          <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>vs {opponent}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Win Prob</div>
                        <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {65 - index * 5}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Insights */}
            <div className={`rounded-xl border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Key Insights</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5"></div>
                  <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                    Win next game vs Team 8 to increase playoff odds to <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>97%</span>
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5"></div>
                  <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                    Need <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>2 wins</span> in final 3 games to clinch playoff berth
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5"></div>
                  <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                    Your points for ranks <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>3rd</span> in the league
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // SIMULATOR VIEW
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Matchups Selection */}
          <div className="xl:col-span-2 space-y-6">
            {/* Controls Row */}
            <div className="flex justify-between items-center">
              <label className={`flex items-center gap-2 text-sm cursor-pointer ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                <input
                  type="checkbox"
                  checked={showPointsInput}
                  onChange={(e) => setShowPointsInput(e.target.checked)}
                  className={`w-4 h-4 rounded text-blue-600 focus:ring-blue-600 focus:ring-offset-0 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-white'}`}
                />
                <span>Include Points Scored</span>
              </label>
              <button
                onClick={resetSimulator}
                className={`px-4 py-2 border rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-900'}`}
              >
                <Shuffle className="w-4 h-4" />
                Reset All
              </button>
            </div>

            {/* Week 12 */}
            <div className={`rounded-xl border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Week 12 Matchups</h3>
              <div className="space-y-3">
                {matchups.filter(m => m.week === 12).map((matchup) => (
                  <div key={matchup.id} className={`rounded-lg p-4 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleMatchupWinner(matchup.id, matchup.team1Id)}
                        className={`p-3 rounded-lg border transition-all ${
                          matchup.winner === matchup.team1Id
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{matchup.team1}</span>
                          {matchup.winner === matchup.team1Id && (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => handleMatchupWinner(matchup.id, matchup.team2Id)}
                        className={`p-3 rounded-lg border transition-all ${
                          matchup.winner === matchup.team2Id
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{matchup.team2}</span>
                          {matchup.winner === matchup.team2Id && (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                        </div>
                      </button>
                    </div>
                    {showPointsInput && (
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          value={matchup.team1Points?.toString() || ''}
                          onChange={(e) => handlePointsChange(matchup.id, 'team1', e.target.value)}
                          className={`p-2 rounded-lg border text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isDarkMode ? 'border-slate-700 text-slate-300 bg-slate-900' : 'border-slate-200 text-slate-900 bg-white'}`}
                          placeholder="Team 1 Points"
                        />
                        <input
                          type="number"
                          value={matchup.team2Points?.toString() || ''}
                          onChange={(e) => handlePointsChange(matchup.id, 'team2', e.target.value)}
                          className={`p-2 rounded-lg border text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isDarkMode ? 'border-slate-700 text-slate-300 bg-slate-900' : 'border-slate-200 text-slate-900 bg-white'}`}
                          placeholder="Team 2 Points"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Week 13 */}
            <div className={`rounded-xl border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Week 13 Matchups</h3>
              <div className="space-y-3">
                {matchups.filter(m => m.week === 13).map((matchup) => (
                  <div key={matchup.id} className={`rounded-lg p-4 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleMatchupWinner(matchup.id, matchup.team1Id)}
                        className={`p-3 rounded-lg border transition-all ${
                          matchup.winner === matchup.team1Id
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{matchup.team1}</span>
                          {matchup.winner === matchup.team1Id && (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => handleMatchupWinner(matchup.id, matchup.team2Id)}
                        className={`p-3 rounded-lg border transition-all ${
                          matchup.winner === matchup.team2Id
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{matchup.team2}</span>
                          {matchup.winner === matchup.team2Id && (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                        </div>
                      </button>
                    </div>
                    {showPointsInput && (
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          value={matchup.team1Points?.toString() || ''}
                          onChange={(e) => handlePointsChange(matchup.id, 'team1', e.target.value)}
                          className={`p-2 rounded-lg border text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isDarkMode ? 'border-slate-700 text-slate-300 bg-slate-900' : 'border-slate-200 text-slate-900 bg-white'}`}
                          placeholder="Team 1 Points"
                        />
                        <input
                          type="number"
                          value={matchup.team2Points?.toString() || ''}
                          onChange={(e) => handlePointsChange(matchup.id, 'team2', e.target.value)}
                          className={`p-2 rounded-lg border text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isDarkMode ? 'border-slate-700 text-slate-300 bg-slate-900' : 'border-slate-200 text-slate-900 bg-white'}`}
                          placeholder="Team 2 Points"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Week 14 */}
            <div className={`rounded-xl border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Week 14 Matchups</h3>
              <div className="space-y-3">
                {matchups.filter(m => m.week === 14).map((matchup) => (
                  <div key={matchup.id} className={`rounded-lg p-4 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleMatchupWinner(matchup.id, matchup.team1Id)}
                        className={`p-3 rounded-lg border transition-all ${
                          matchup.winner === matchup.team1Id
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{matchup.team1}</span>
                          {matchup.winner === matchup.team1Id && (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => handleMatchupWinner(matchup.id, matchup.team2Id)}
                        className={`p-3 rounded-lg border transition-all ${
                          matchup.winner === matchup.team2Id
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{matchup.team2}</span>
                          {matchup.winner === matchup.team2Id && (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                        </div>
                      </button>
                    </div>
                    {showPointsInput && (
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          value={matchup.team1Points?.toString() || ''}
                          onChange={(e) => handlePointsChange(matchup.id, 'team1', e.target.value)}
                          className={`p-2 rounded-lg border text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isDarkMode ? 'border-slate-700 text-slate-300 bg-slate-900' : 'border-slate-200 text-slate-900 bg-white'}`}
                          placeholder="Team 1 Points"
                        />
                        <input
                          type="number"
                          value={matchup.team2Points?.toString() || ''}
                          onChange={(e) => handlePointsChange(matchup.id, 'team2', e.target.value)}
                          className={`p-2 rounded-lg border text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isDarkMode ? 'border-slate-700 text-slate-300 bg-slate-900' : 'border-slate-200 text-slate-900 bg-white'}`}
                          placeholder="Team 2 Points"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Simulated Standings */}
          <div className="space-y-6">
            <div className={`rounded-xl border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Simulated Final Standings</h3>
              <div className="space-y-3">
                {simulatedStandings.map((team, index) => (
                  <div
                    key={team.id}
                    className={`p-3 rounded-lg border transition-all ${
                      index < 6
                        ? 'bg-green-500/10 border-green-500/30'
                        : isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                    } ${team.owner === 'You' ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>#{index + 1}</span>
                        {index < 6 && <Award className="w-4 h-4 text-yellow-500" />}
                      </div>
                      <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {team.simulatedWins}-{team.simulatedLosses}
                      </span>
                    </div>
                    <div className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{team.name}</div>
                    <div className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {team.simulatedPointsFor.toFixed(1)} PF
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Simulation Insights */}
            <div className={`rounded-xl border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Simulation Results</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Your Simulated Rank:</span>
                  <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    #{simulatedStandings.findIndex(t => t.owner === 'You') + 1}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Your Final Record:</span>
                  <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {simulatedStandings.find(t => t.owner === 'You')?.simulatedWins}-
                    {simulatedStandings.find(t => t.owner === 'You')?.simulatedLosses}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Playoff Status:</span>
                  <span className={`font-semibold ${
                    simulatedStandings.findIndex(t => t.owner === 'You') < 6
                      ? 'text-green-500'
                      : 'text-red-500'
                  }`}>
                    {simulatedStandings.findIndex(t => t.owner === 'You') < 6 ? 'IN' : 'OUT'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}