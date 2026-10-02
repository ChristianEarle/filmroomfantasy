import { Trophy, TrendingUp, TrendingDown, Calendar, Award, BarChart3, Shuffle, CheckCircle2, Loader2 } from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useLeagueContext, LeagueMatchup } from '../context/LeagueContext';
import { remainingRegularSeasonGames, runPlayoffSimulation, teamPointsPerGame, winProbability } from '../utils/playoffSimulation';

interface Team {
  id: string;
  name: string;
  owner: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  projectedWins: number;
  playoffChance: number;
  remainingGames: string[];
  isUserTeam?: boolean;
}

/** Format a W-L or W-L-T record, hiding ties when zero */
const formatRecord = (wins: number, losses: number, ties: number) =>
  ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;

// Monte Carlo engine: src/utils/playoffSimulation.ts (same model as the League Analyzer).

interface SimulatorMatchup {
  id: string;
  week: number;
  team1: string;
  team1Id: string;
  team2: string;
  team2Id: string;
  winner?: string; // team1Id or team2Id
  team1Points?: number;
  team2Points?: number;
  isComplete?: boolean;
  /** Playoff-bracket game: excluded from regular-season odds and the simulator. */
  isPlayoff?: boolean;
}

// Convert LeagueMatchup to SimulatorMatchup format
const convertToSimulatorMatchup = (m: LeagueMatchup): SimulatorMatchup => ({
  id: m.id,
  week: m.week,
  team1: m.homeTeam.name,
  team1Id: m.homeTeam.id,
  team2: m.awayTeam.name,
  team2Id: m.awayTeam.id,
  winner: m.isComplete
    ? (m.homeTeam.score > m.awayTeam.score ? m.homeTeam.id
      : m.awayTeam.score > m.homeTeam.score ? m.awayTeam.id
      : undefined)
    : undefined,
  team1Points: m.isComplete ? m.homeTeam.score : undefined,
  team2Points: m.isComplete ? m.awayTeam.score : undefined,
  isComplete: m.isComplete,
  isPlayoff: m.isPlayoff,
});

interface PlayoffPredictorViewProps {
  isDarkMode: boolean;
}

export function PlayoffPredictorView({ isDarkMode }: PlayoffPredictorViewProps) {
  const { league, standings, standingsLoading, userTeam, allMatchups, allMatchupsLoading, refreshAllMatchups, error } = useLeagueContext();
  const [activeTab, setActiveTab] = useState<'predictor' | 'simulator'>('predictor');
  const [matchups, setMatchups] = useState<SimulatorMatchup[]>([]);
  const [showPointsInput, setShowPointsInput] = useState(false);

  // Track which league ID we're loading data for to prevent stale updates
  const activeLeagueRef = useRef<string | null>(null);

  // Fetch all matchups when component mounts or league changes
  // Uses a ref to guard against stale responses from rapid league switching
  useEffect(() => {
    if (league?.id) {
      activeLeagueRef.current = league.id;
      refreshAllMatchups();
    }
    return () => {
      // Mark this league's request as stale on cleanup
      activeLeagueRef.current = null;
    };
  }, [league?.id, refreshAllMatchups]);

  // Convert league matchups to simulator format when data changes
  // Only update if the data is for the currently active league
  useEffect(() => {
    if (allMatchups && allMatchups.length > 0 && activeLeagueRef.current === league?.id) {
      const simulatorMatchups = allMatchups.map(convertToSimulatorMatchup);
      setMatchups(simulatorMatchups);
    }
  }, [allMatchups, league?.id]);

  // Every week in the schedule, playoff bracket included (for the playoff label).
  const allWeeks = useMemo(
    () => [...new Set(matchups.map(m => m.week))].sort((a, b) => a - b),
    [matchups],
  );

  // Regular-season weeks only: the playoff bracket weeks aren't regular-season
  // games, so they never count toward odds, "weeks left" or the simulator.
  const matchupWeeks = useMemo(
    () => [...new Set(matchups.filter(m => !m.isPlayoff).map(m => m.week))].sort((a, b) => a - b),
    [matchups],
  );

  const standingsInput = useMemo(
    () => (standings || []).map(s => ({
      teamId: s.teamId,
      wins: s.wins,
      losses: s.losses,
      ties: s.ties,
      pointsFor: s.pointsFor,
    })),
    [standings],
  );

  // Regular-season games still to play (same rule as the League Analyzer).
  const remainingGames = useMemo(
    () => remainingRegularSeasonGames(standingsInput, matchups),
    [standingsInput, matchups],
  );

  // Weeks with regular-season games still to play — taken from the same
  // capped set the odds use, so "weeks left" and the odds always agree.
  const remainingWeeks = useMemo(
    () => [...new Set(remainingGames.map(m => m.week))].sort((a, b) => a - b),
    [remainingGames],
  );

  // Run Monte Carlo simulation
  const monteCarloResults = useMemo(() => {
    if (standingsInput.length === 0) return null;
    const playoffSpots = league?.playoffTeams || 6;
    return runPlayoffSimulation(standingsInput, remainingGames, playoffSpots);
  }, [standingsInput, remainingGames, league]);

  // Convert real standings to Team format, powered by Monte Carlo
  const leagueTeamsData = useMemo(() => {
    if (standings && standings.length > 0) {
      const nameById = new Map(matchups.flatMap(m => [[m.team1Id, m.team1], [m.team2Id, m.team2]] as const));
      return standings.map((s) => {
        // Find remaining games for this team
        const teamRemainingGames = remainingGames
          .filter(m => m.team1Id === s.teamId || m.team2Id === s.teamId)
          .map(m => nameById.get(m.team1Id === s.teamId ? m.team2Id : m.team1Id) || 'TBD');

        const mc = monteCarloResults?.get(s.teamId);

        return {
          id: s.teamId,
          name: s.teamName + (s.isUserTeam ? ' (You)' : ''),
          owner: s.isUserTeam ? 'You' : s.ownerName,
          wins: s.wins,
          losses: s.losses,
          ties: s.ties,
          pointsFor: s.pointsFor,
          pointsAgainst: s.pointsAgainst,
          projectedWins: mc?.avgProjectedWins ?? s.wins,
          playoffChance: mc?.playoffPct ?? 0,
          remainingGames: teamRemainingGames,
          isUserTeam: s.isUserTeam,
        };
      });
    }
    return [];
  }, [standings, matchups, remainingGames, monteCarloResults]);
  
  // Calculate simulated standings based on matchup selections
  const simulatedStandings = useMemo(() => {
    if (leagueTeamsData.length === 0) return [];

    const teamRecords = leagueTeamsData.map(team => ({
      ...team,
      simulatedWins: team.wins,
      simulatedLosses: team.losses,
      simulatedPointsFor: team.pointsFor,
    }));

    // Only process incomplete regular-season matchups that have a selected winner
    matchups.filter(m => !m.isComplete && !m.isPlayoff).forEach(matchup => {
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
  }, [leagueTeamsData, matchups, showPointsInput]);

  const handleMatchupWinner = (matchupId: string, winnerId: string) => {
    setMatchups(prev => prev.map(m =>
      m.id === matchupId && !m.isComplete ? { ...m, winner: m.winner === winnerId ? undefined : winnerId } : m
    ));
  };

  const handlePointsChange = (matchupId: string, team: 'team1' | 'team2', points: string) => {
    const pointsValue = points === '' ? undefined : parseFloat(points);
    setMatchups(prev => prev.map(m => {
      if (m.id === matchupId && !m.isComplete) {
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
    // Reset to original data from allMatchups
    if (allMatchups && allMatchups.length > 0) {
      setMatchups(allMatchups.map(convertToSimulatorMatchup));
    }
  };

  const sortedTeams = useMemo(
    () => [...leagueTeamsData].sort((a, b) => b.playoffChance - a.playoffChance),
    [leagueTeamsData],
  );

  // Find user's team using the team ID from context
  const userTeamData = sortedTeams.find(t => t.isUserTeam || t.id === userTeam?.id);
  const weeksRemaining = remainingWeeks.length;
  const playoffTeamCount = league?.playoffTeams || 6;
  const seasonComplete = weeksRemaining === 0 && matchups.length > 0;

  // Compute playoff week range dynamically from matchup data / league settings
  const playoffWeekLabel = useMemo(() => {
    if (!league) return '';
    // Prefer the bracket weeks themselves. Mid-season the bracket often isn't
    // synced yet, so otherwise the playoffs start the week after the last
    // regular-season week and run for the league's playoff length.
    const bracketWeeks = [...new Set(matchups.filter(m => m.isPlayoff).map(m => m.week))].sort((a, b) => a - b);
    const playoffWeeks = league.playoffWeeks || 3;
    const lastRegularWeek = matchupWeeks.length > 0 ? matchupWeeks[matchupWeeks.length - 1] : allWeeks.length > 0 ? allWeeks[allWeeks.length - 1] : 14;
    const startWeek = bracketWeeks.length > 0 ? bracketWeeks[0] : lastRegularWeek + 1;
    const maxWeek = bracketWeeks.length > 0 ? bracketWeeks[bracketWeeks.length - 1] : startWeek + playoffWeeks - 1;
    return startWeek === maxWeek ? `Week ${startWeek}` : `Week ${startWeek}-${maxWeek}`;
  }, [league, matchups, matchupWeeks, allWeeks]);

  // Pre-compute user's rank (by playoff %) — returns '-' if user team not found
  const userPlayoffRank = useMemo(() => {
    const idx = sortedTeams.findIndex(t => t.isUserTeam);
    return idx >= 0 ? idx + 1 : null;
  }, [sortedTeams]);

  // Pre-compute user's points-for rank
  const userPointsForRank = useMemo(() => {
    const sorted = [...leagueTeamsData].sort((a, b) => b.pointsFor - a.pointsFor);
    const idx = sorted.findIndex(t => t.isUserTeam);
    return idx >= 0 ? idx + 1 : null;
  }, [leagueTeamsData]);

  // Pre-compute user's simulated rank — guard against findIndex -1
  const userSimulatedRank = useMemo(() => {
    const idx = simulatedStandings.findIndex(t => t.isUserTeam);
    return idx >= 0 ? idx + 1 : null;
  }, [simulatedStandings]);

  const userSimulatedTeam = useMemo(
    () => simulatedStandings.find(t => t.isUserTeam),
    [simulatedStandings],
  );

  // Get user's remaining matchups with week numbers and PPG-based win probability
  const userRemainingMatchups = useMemo(() => {
    if (!userTeamData) return [];

    // Same win-probability model the simulation uses.
    const { ppg, leagueAvg } = teamPointsPerGame(standingsInput);
    const nameById = new Map(matchups.flatMap(m => [[m.team1Id, m.team1], [m.team2Id, m.team2]] as const));

    return remainingGames
      .filter(m => m.team1Id === userTeamData.id || m.team2Id === userTeamData.id)
      .map(m => {
        const isTeam1 = m.team1Id === userTeamData.id;
        const opponentId = isTeam1 ? m.team2Id : m.team1Id;
        const prob = winProbability(ppg.get(userTeamData.id) ?? leagueAvg, ppg.get(opponentId) ?? leagueAvg);
        return {
          week: m.week,
          opponent: nameById.get(opponentId) || 'TBD',
          opponentId,
          winProb: Math.round(prob * 100),
        };
      })
      .sort((a, b) => a.week - b.week);
  }, [matchups, userTeamData, standingsInput, remainingGames]);

  // Show loading state
  if (standingsLoading || allMatchupsLoading) {
    return (
      <div className="max-w-[1600px] mx-auto">
        <div className={`rounded-lg border p-12 flex flex-col items-center justify-center ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
          <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Loading playoff data...</p>
        </div>
      </div>
    );
  }

  // Show message if no data
  if (leagueTeamsData.length === 0) {
    return (
      <div className="max-w-[1600px] mx-auto">
        <div className={`rounded-lg border p-12 text-center ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <Trophy className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
          <h2 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>No Playoff Data</h2>
          <p className={`text-sm mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Sync your league to view playoff predictions and run simulations.
          </p>
          <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Go to Settings and click "Sync" on your league.
          </p>
        </div>
      </div>
    );
  }

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
      <div className={`border rounded-lg p-8 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-blue-500" />
              <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Fantasy Playoffs{playoffWeekLabel ? ` • ${playoffWeekLabel}` : ''}</span>
            </div>
            <h1 className={`text-3xl mb-2 font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Playoff Predictor</h1>
            <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
              {seasonComplete
                ? 'Final regular season standings'
                : activeTab === 'predictor'
                  ? 'Based on 10,000 simulations using team scoring strength and remaining schedule'
                  : 'Simulate specific game outcomes to see playoff implications'
              }
            </p>
          </div>
          <div className={`rounded-lg px-6 py-4 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
            <div className={`text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Top {playoffTeamCount} Make Playoffs</div>
            <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {seasonComplete ? 'Season Over' : `${weeksRemaining} Weeks Left`}
            </div>
            <div className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{league?.name || 'Regular Season'}</div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div role="tablist" aria-label="Playoff predictor views" className={`mt-6 flex gap-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <button
            role="tab"
            aria-selected={activeTab === 'predictor'}
            aria-controls="panel-predictor"
            id="tab-predictor"
            onClick={() => setActiveTab('predictor')}
            className={`px-4 py-2 font-semibold text-sm transition-all relative ${
              activeTab === 'predictor'
                ? 'text-blue-500'
                : isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" aria-hidden="true" />
              Predictions
            </div>
            {activeTab === 'predictor' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
            )}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'simulator'}
            aria-controls="panel-simulator"
            id="tab-simulator"
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-2 font-semibold text-sm transition-all relative ${
              activeTab === 'simulator'
                ? 'text-blue-500'
                : isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Shuffle className="w-4 h-4" aria-hidden="true" />
              Simulator
            </div>
            {activeTab === 'simulator' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
            )}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className={`rounded-lg border p-4 ${isDarkMode ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-sm ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
        </div>
      )}

      {activeTab === 'predictor' ? (
        // PREDICTOR VIEW
        <div id="panel-predictor" role="tabpanel" aria-labelledby="tab-predictor" className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main Standings Table */}
          <div className="xl:col-span-2">
            <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              {/* Table Header */}
              <div className={`p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                <h2 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {seasonComplete ? 'Final Standings' : 'Playoff Chances'}
                </h2>
                <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {seasonComplete
                    ? 'Regular season complete — final playoff picture'
                    : 'Probability of making playoffs based on current standings and remaining schedule'
                  }
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
                      <th className={`text-right px-6 py-3 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {seasonComplete ? 'Final Wins' : 'Proj. Wins'}
                      </th>
                      <th className={`text-right px-6 py-3 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {seasonComplete ? 'Status' : 'Playoff %'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTeams.map((team, index) => (
                      <tr
                        key={team.id}
                        className={`border-b transition-colors ${
                          isDarkMode ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-100 hover:bg-slate-50'
                        } ${team.isUserTeam ? 'bg-blue-500/5' : ''}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{index + 1}</span>
                            {index < playoffTeamCount && (
                              <Award className="w-4 h-4 text-yellow-500" aria-label="Playoff position" />
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
                            {formatRecord(team.wins, team.losses, team.ties)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{team.pointsFor.toFixed(1)}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {seasonComplete ? team.wins : Math.round(team.projectedWins)}
                            </span>
                            {!seasonComplete && (
                              team.projectedWins > team.wins + 1 ? (
                                <TrendingUp className="w-3 h-3 text-green-500" aria-label="Trending up" />
                              ) : team.projectedWins < team.wins + 1 ? (
                                <TrendingDown className="w-3 h-3 text-red-500" aria-label="Trending down" />
                              ) : null
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {seasonComplete ? (
                            <span className={`text-sm font-bold ${team.playoffChance === 100 ? 'text-green-500' : 'text-red-500'}`}>
                              {team.playoffChance === 100 ? 'IN' : 'OUT'}
                            </span>
                          ) : (
                            <span className={`text-sm font-bold ${getPlayoffChanceColor(team.playoffChance)}`}>
                              {team.playoffChance}%
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer Note */}
              <div className={`px-6 py-4 border-t ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <Award className="w-3 h-3 inline text-yellow-500" aria-hidden="true" /> = Currently in playoff position
                </p>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Your Team Status */}
            <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Your Playoff Status</h3>
              <div className={`rounded-lg p-4 border ${getPlayoffChanceBg(userTeamData?.playoffChance || 0)}`}>
                <div className="text-center">
                  {seasonComplete ? (
                    <>
                      <div className={`text-4xl font-bold mb-2 ${(userTeamData?.playoffChance || 0) === 100 ? 'text-green-500' : 'text-red-500'}`}>
                        {(userTeamData?.playoffChance || 0) === 100 ? 'IN' : 'OUT'}
                      </div>
                      <div className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        {(userTeamData?.playoffChance || 0) === 100 ? 'Made the Playoffs!' : 'Eliminated from Playoffs'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`text-4xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {userTeamData?.playoffChance || 0}%
                      </div>
                      <div className={`text-sm mb-3 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Chance to Make Playoffs</div>
                      <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                        <div
                          className="h-full bg-blue-600 transition-all duration-500"
                          style={{ width: `${userTeamData?.playoffChance || 0}%` }}
                        ></div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                    {seasonComplete ? 'Final Rank:' : 'Current Rank:'}
                  </span>
                  <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {userPlayoffRank != null ? `#${userPlayoffRank}` : '-'}
                  </span>
                </div>
                {!seasonComplete && (
                  <div className="flex justify-between text-sm">
                    <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Projected Wins:</span>
                    <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {userTeamData?.projectedWins != null ? Math.round(userTeamData.projectedWins) : '-'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                    {seasonComplete ? 'Final Record:' : 'Games Remaining:'}
                  </span>
                  <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {seasonComplete
                      ? formatRecord(userTeamData?.wins || 0, userTeamData?.losses || 0, userTeamData?.ties || 0)
                      : weeksRemaining
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Remaining Schedule */}
            <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {seasonComplete ? 'Season Summary' : 'Your Remaining Games'}
              </h3>
              <div className="space-y-3">
                {userRemainingMatchups.length === 0 ? (
                  <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {seasonComplete
                      ? 'The regular season is complete. Check standings for final playoff picture.'
                      : 'No remaining games scheduled.'
                    }
                  </p>
                ) : (
                  userRemainingMatchups.map((game) => (
                      <div key={`${game.week}-${game.opponentId}`} className={`rounded-lg p-3 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className={`w-4 h-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} aria-hidden="true" />
                            <div>
                              <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Week {game.week}</div>
                              <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>vs {game.opponent}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Win Prob</div>
                            <div className={`text-sm font-bold ${game.winProb >= 50 ? 'text-green-500' : 'text-red-500'}`}>
                              {game.winProb}%
                            </div>
                          </div>
                        </div>
                      </div>
                  ))
                )}
              </div>
            </div>

            {/* Key Insights */}
            <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Key Insights</h3>
              <div className="space-y-3 text-sm">
                {userRemainingMatchups[0] && (
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5"></div>
                    <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                      Next game: <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Week {userRemainingMatchups[0].week}</span> vs {userRemainingMatchups[0].opponent}
                    </p>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5"></div>
                  <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                    <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{weeksRemaining} games</span> remaining in regular season
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5"></div>
                  <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                    Your points for ranks <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {userPointsForRank != null ? `#${userPointsForRank}` : '-'}
                    </span> in the league
                  </p>
                </div>
                {userTeamData && (
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5"></div>
                    <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                      Current record: <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatRecord(userTeamData.wins, userTeamData.losses, userTeamData.ties)}</span> ({userTeamData.pointsFor.toFixed(1)} PF)
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // SIMULATOR VIEW
        <div id="panel-simulator" role="tabpanel" aria-labelledby="tab-simulator" className="grid grid-cols-1 xl:grid-cols-3 gap-6">
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
                <Shuffle className="w-4 h-4" aria-hidden="true" />
                Reset All
              </button>
            </div>

            {/* Dynamic Week Matchups */}
            {matchupWeeks.length === 0 ? (
              <div className={`rounded-lg border p-8 text-center ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                <Calendar className={`w-12 h-12 mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} aria-hidden="true" />
                <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  No matchups found. Sync your league to load matchup data.
                </p>
              </div>
            ) : (
              matchupWeeks.map(week => {
                const weekMatchups = matchups.filter(m => m.week === week && !m.isPlayoff);
                const isWeekComplete = weekMatchups.every(m => m.isComplete);

                return (
                  <div
                    key={week}
                    className={`rounded-lg border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} ${isWeekComplete ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Week {week} Matchups
                      </h3>
                      {isWeekComplete && (
                        <span className={`text-xs px-2 py-1 rounded-full ${isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'}`}>
                          Completed
                        </span>
                      )}
                    </div>
                    <div className="space-y-3">
                      {weekMatchups.map((matchup) => (
                        <div
                          key={matchup.id}
                          className={`rounded-lg p-4 border ${
                            matchup.isComplete
                              ? isDarkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-100/50 border-slate-200/50'
                              : isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => !matchup.isComplete && handleMatchupWinner(matchup.id, matchup.team1Id)}
                              disabled={matchup.isComplete}
                              aria-pressed={matchup.winner === matchup.team1Id}
                              aria-label={`Select ${matchup.team1} as winner`}
                              className={`p-3 rounded-lg border transition-all ${
                                matchup.winner === matchup.team1Id
                                  ? matchup.isComplete
                                    ? 'bg-green-600/80 border-green-500 text-white cursor-default'
                                    : 'bg-blue-600 border-blue-500 text-white'
                                  : matchup.isComplete
                                    ? isDarkMode ? 'bg-slate-900/50 border-slate-700/50 text-slate-500 cursor-default' : 'bg-white/50 border-slate-200/50 text-slate-400 cursor-default'
                                    : isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold">{matchup.team1}</span>
                                {matchup.winner === matchup.team1Id && (
                                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                                )}
                              </div>
                              {matchup.isComplete && matchup.team1Points !== undefined && (
                                <div className={`text-xs mt-1 ${matchup.winner === matchup.team1Id ? 'text-white/80' : isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                  {matchup.team1Points.toFixed(1)} pts
                                </div>
                              )}
                            </button>
                            <button
                              onClick={() => !matchup.isComplete && handleMatchupWinner(matchup.id, matchup.team2Id)}
                              disabled={matchup.isComplete}
                              aria-pressed={matchup.winner === matchup.team2Id}
                              aria-label={`Select ${matchup.team2} as winner`}
                              className={`p-3 rounded-lg border transition-all ${
                                matchup.winner === matchup.team2Id
                                  ? matchup.isComplete
                                    ? 'bg-green-600/80 border-green-500 text-white cursor-default'
                                    : 'bg-blue-600 border-blue-500 text-white'
                                  : matchup.isComplete
                                    ? isDarkMode ? 'bg-slate-900/50 border-slate-700/50 text-slate-500 cursor-default' : 'bg-white/50 border-slate-200/50 text-slate-400 cursor-default'
                                    : isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold">{matchup.team2}</span>
                                {matchup.winner === matchup.team2Id && (
                                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                                )}
                              </div>
                              {matchup.isComplete && matchup.team2Points !== undefined && (
                                <div className={`text-xs mt-1 ${matchup.winner === matchup.team2Id ? 'text-white/80' : isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                  {matchup.team2Points.toFixed(1)} pts
                                </div>
                              )}
                            </button>
                          </div>
                          {showPointsInput && !matchup.isComplete && (
                            <div className="mt-2 grid grid-cols-2 gap-3">
                              <input
                                type="number"
                                aria-label={`Points for ${matchup.team1}`}
                                value={matchup.team1Points?.toString() || ''}
                                onChange={(e) => handlePointsChange(matchup.id, 'team1', e.target.value)}
                                className={`p-2 rounded-lg border text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isDarkMode ? 'border-slate-700 text-slate-300 bg-slate-900' : 'border-slate-200 text-slate-900 bg-white'}`}
                                placeholder={`${matchup.team1} Points`}
                              />
                              <input
                                type="number"
                                aria-label={`Points for ${matchup.team2}`}
                                value={matchup.team2Points?.toString() || ''}
                                onChange={(e) => handlePointsChange(matchup.id, 'team2', e.target.value)}
                                className={`p-2 rounded-lg border text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isDarkMode ? 'border-slate-700 text-slate-300 bg-slate-900' : 'border-slate-200 text-slate-900 bg-white'}`}
                                placeholder={`${matchup.team2} Points`}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Simulated Standings */}
          <div className="space-y-6">
            <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Simulated Final Standings</h3>
              <div className="space-y-3">
                {simulatedStandings.map((team, index) => (
                  <div
                    key={team.id}
                    className={`p-3 rounded-lg border transition-all ${
                      index < playoffTeamCount
                        ? 'bg-green-500/10 border-green-500/30'
                        : isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                    } ${team.isUserTeam ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>#{index + 1}</span>
                        {index < playoffTeamCount && <Award className="w-4 h-4 text-yellow-500" aria-label="Playoff position" />}
                      </div>
                      <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {formatRecord(team.simulatedWins, team.simulatedLosses, team.ties)}
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
            <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Simulation Results</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Your Simulated Rank:</span>
                  <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {userSimulatedRank != null ? `#${userSimulatedRank}` : '-'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Your Final Record:</span>
                  <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {userSimulatedTeam
                      ? formatRecord(userSimulatedTeam.simulatedWins, userSimulatedTeam.simulatedLosses, userSimulatedTeam.ties)
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Playoff Status:</span>
                  <span className={`font-semibold ${
                    userSimulatedRank != null && userSimulatedRank <= playoffTeamCount
                      ? 'text-green-500'
                      : 'text-red-500'
                  }`}>
                    {userSimulatedRank != null && userSimulatedRank <= playoffTeamCount ? 'IN' : 'OUT'}
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