import { Trophy, TrendingUp, TrendingDown, Calendar, Award, BarChart3, Shuffle, CheckCircle2, Loader2 } from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useLeagueContext, LeagueMatchup } from '../context/LeagueContext';

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

// ── Monte Carlo Simulation Engine ──────────────────────────────────────
// Uses team strength (points-per-game) to compute win probabilities for
// each remaining matchup, then runs simulated seasons to calculate
// realistic playoff odds for every team.

/** Number of Monte Carlo simulations to run for playoff probability estimates */
const DEFAULT_NUM_SIMULATIONS = 10_000;

/** Minimum win probability floor — any team can win on any given week */
const WIN_PROB_FLOOR = 0.15;

/** Maximum win probability ceiling — no matchup is a guaranteed win */
const WIN_PROB_CEILING = 0.85;

interface MonteCarloResult {
  playoffPct: number;       // 0-100
  avgProjectedWins: number; // average wins across all sims
  winProbByMatchup: Map<string, number>; // matchupId → P(team1 wins)
}

function runMonteCarloSimulation(
  standings: { teamId: string; wins: number; losses: number; ties: number; pointsFor: number }[],
  remainingMatchups: { id: string; team1Id: string; team2Id: string }[],
  playoffSpots: number,
  numSims = DEFAULT_NUM_SIMULATIONS,
): Map<string, MonteCarloResult> {
  const results = new Map<string, MonteCarloResult>();

  // Sanity check: determine max games per team and filter out invalid "remaining" matchups
  // A team's total games (played + remaining) should not exceed the regular season length
  const gamesPlayed = new Map<string, number>();
  for (const s of standings) {
    gamesPlayed.set(s.teamId, s.wins + s.losses + s.ties);
  }

  // Count how many remaining matchups each team has
  const remainingPerTeam = new Map<string, number>();
  for (const m of remainingMatchups) {
    remainingPerTeam.set(m.team1Id, (remainingPerTeam.get(m.team1Id) || 0) + 1);
    remainingPerTeam.set(m.team2Id, (remainingPerTeam.get(m.team2Id) || 0) + 1);
  }

  // Detect the regular season length from the data
  const maxGamesPlayed = Math.max(...Array.from(gamesPlayed.values()), 0);
  const maxRemaining = Math.max(...Array.from(remainingPerTeam.values()), 0);
  const impliedSeasonLength = maxGamesPlayed + maxRemaining;

  // If any team's total (played + remaining) exceeds a reasonable season length,
  // the "remaining" matchups include already-played games — filter them out
  let filteredRemaining = remainingMatchups;
  if (maxGamesPlayed > 0 && impliedSeasonLength > maxGamesPlayed + 4) {
    // Too many remaining matchups — likely a data issue where completed matchups
    // aren't marked as complete. Only keep matchups where BOTH teams have room.
    const maxRemainingPerTeam = new Map<string, number>();
    // Estimate: each team should have at most (maxGamesPlayed - their games played) remaining
    // But we don't know the exact season length, so use the max games played as proxy
    for (const s of standings) {
      const played = gamesPlayed.get(s.teamId) || 0;
      maxRemainingPerTeam.set(s.teamId, Math.max(0, maxGamesPlayed - played));
    }

    // If ALL teams have played the same number of games (season is over or bye-week aligned),
    // and there are still "remaining" matchups, the season is actually complete
    const allSameGamesPlayed = new Set(gamesPlayed.values()).size === 1;
    if (allSameGamesPlayed && maxRemaining > 0) {
      // All teams played the same number of games but we still have "remaining" — season is done
      filteredRemaining = [];
    } else {
      // Filter: track how many we've allowed per team
      const allowed = new Map<string, number>();
      filteredRemaining = remainingMatchups.filter(m => {
        const t1Allowed = (allowed.get(m.team1Id) || 0) < (maxRemainingPerTeam.get(m.team1Id) || 0);
        const t2Allowed = (allowed.get(m.team2Id) || 0) < (maxRemainingPerTeam.get(m.team2Id) || 0);
        if (t1Allowed && t2Allowed) {
          allowed.set(m.team1Id, (allowed.get(m.team1Id) || 0) + 1);
          allowed.set(m.team2Id, (allowed.get(m.team2Id) || 0) + 1);
          return true;
        }
        return false;
      });
    }
  }

  // Calculate each team's PPG (points per game) as strength metric
  const teamPpg = new Map<string, number>();
  let leagueAvgPpg = 0;
  let teamsWithGames = 0;
  for (const s of standings) {
    const gp = s.wins + s.losses + s.ties;
    if (gp > 0) {
      const ppg = s.pointsFor / gp;
      teamPpg.set(s.teamId, ppg);
      leagueAvgPpg += ppg;
      teamsWithGames++;
    }
  }
  leagueAvgPpg = teamsWithGames > 0 ? leagueAvgPpg / teamsWithGames : 100;

  // Fill in teams with no games played using league average
  for (const s of standings) {
    if (!teamPpg.has(s.teamId)) {
      teamPpg.set(s.teamId, leagueAvgPpg);
    }
  }

  // Pre-compute win probabilities for each remaining matchup
  // Uses PPG ratio with a floor/ceiling to prevent extreme probabilities
  const matchupWinProbs: { id: string; team1Id: string; team2Id: string; p1: number }[] = [];
  const winProbMap = new Map<string, number>();

  for (const m of filteredRemaining) {
    const ppg1 = teamPpg.get(m.team1Id) || leagueAvgPpg;
    const ppg2 = teamPpg.get(m.team2Id) || leagueAvgPpg;
    // Clamp between floor and ceiling — any team can win on any given week
    const raw = ppg1 / (ppg1 + ppg2);
    const clamped = Math.min(WIN_PROB_CEILING, Math.max(WIN_PROB_FLOOR, raw));
    matchupWinProbs.push({ id: m.id, team1Id: m.team1Id, team2Id: m.team2Id, p1: clamped });
    winProbMap.set(m.id, clamped);
  }

  // Edge case: if no remaining games, standings are final
  if (filteredRemaining.length === 0) {
    const sorted = [...standings].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.pointsFor - a.pointsFor;
    });
    for (let i = 0; i < sorted.length; i++) {
      results.set(sorted[i].teamId, {
        playoffPct: i < playoffSpots ? 100 : 0,
        avgProjectedWins: sorted[i].wins,
        winProbByMatchup: winProbMap,
      });
    }
    return results;
  }

  // Accumulators
  const playoffCount: Record<string, number> = {};
  const totalWins: Record<string, number> = {};
  for (const s of standings) {
    playoffCount[s.teamId] = 0;
    totalWins[s.teamId] = 0;
  }

  // Run simulations
  for (let sim = 0; sim < numSims; sim++) {
    // Copy current records
    const simWins: Record<string, number> = {};
    const simPf: Record<string, number> = {};
    for (const s of standings) {
      simWins[s.teamId] = s.wins;
      simPf[s.teamId] = s.pointsFor;
    }

    // Simulate each remaining matchup
    for (const mp of matchupWinProbs) {
      if (Math.random() < mp.p1) {
        simWins[mp.team1Id]++;
      } else {
        simWins[mp.team2Id]++;
      }
    }

    // Sort by wins desc, then PF desc (standard tiebreaker)
    const simStandings = standings.map(s => ({
      id: s.teamId,
      w: simWins[s.teamId],
      pf: simPf[s.teamId],
    })).sort((a, b) => b.w !== a.w ? b.w - a.w : b.pf - a.pf);

    // Top N make playoffs
    for (let i = 0; i < simStandings.length; i++) {
      if (i < playoffSpots) playoffCount[simStandings[i].id]++;
      totalWins[simStandings[i].id] += simStandings[i].w;
    }
  }

  // Build results
  for (const s of standings) {
    results.set(s.teamId, {
      playoffPct: Math.round((playoffCount[s.teamId] / numSims) * 100),
      avgProjectedWins: totalWins[s.teamId] / numSims,
      winProbByMatchup: winProbMap,
    });
  }

  return results;
}

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

  // Get weeks that have matchups
  const matchupWeeks = useMemo(() => {
    const weeks = [...new Set(matchups.map(m => m.week))].sort((a, b) => a - b);
    return weeks;
  }, [matchups]);

  // Get remaining (incomplete) matchup weeks
  const remainingWeeks = useMemo(() => {
    return matchupWeeks.filter(week =>
      matchups.some(m => m.week === week && !m.isComplete)
    );
  }, [matchupWeeks, matchups]);

  // Run Monte Carlo simulation
  const monteCarloResults = useMemo(() => {
    if (!standings || standings.length === 0) return null;

    const remaining = matchups
      .filter(m => !m.isComplete)
      .map(m => ({ id: m.id, team1Id: m.team1Id, team2Id: m.team2Id }));

    const standingsInput = standings.map(s => ({
      teamId: s.teamId,
      wins: s.wins,
      losses: s.losses,
      ties: s.ties,
      pointsFor: s.pointsFor,
    }));

    const playoffSpots = league?.playoffTeams || 6;
    return runMonteCarloSimulation(standingsInput, remaining, playoffSpots);
  }, [standings, matchups, league]);

  // Convert real standings to Team format, powered by Monte Carlo
  const leagueTeamsData = useMemo(() => {
    if (standings && standings.length > 0) {
      return standings.map((s) => {
        // Find remaining games for this team
        const teamRemainingGames = matchups
          .filter(m => !m.isComplete && (m.team1Id === s.teamId || m.team2Id === s.teamId))
          .map(m => m.team1Id === s.teamId ? m.team2 : m.team1);

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
  }, [standings, matchups, monteCarloResults]);
  
  // Calculate simulated standings based on matchup selections
  const simulatedStandings = useMemo(() => {
    if (leagueTeamsData.length === 0) return [];

    const teamRecords = leagueTeamsData.map(team => ({
      ...team,
      simulatedWins: team.wins,
      simulatedLosses: team.losses,
      simulatedPointsFor: team.pointsFor,
    }));

    // Only process incomplete matchups that have a selected winner
    matchups.filter(m => !m.isComplete).forEach(matchup => {
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
    const maxWeek = matchupWeeks.length > 0 ? Math.max(...matchupWeeks) : 17;
    const playoffWeeks = league.playoffWeeks || 3;
    const startWeek = maxWeek - playoffWeeks + 1;
    return startWeek === maxWeek ? `Week ${startWeek}` : `Week ${startWeek}-${maxWeek}`;
  }, [league, matchupWeeks]);

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

    // Build PPG map for win probability calculation
    const teamPpg = new Map<string, number>();
    let avgPpg = 0;
    let count = 0;
    for (const s of (standings || [])) {
      const gp = s.wins + s.losses + s.ties;
      if (gp > 0) {
        const ppg = s.pointsFor / gp;
        teamPpg.set(s.teamId, ppg);
        avgPpg += ppg;
        count++;
      }
    }
    avgPpg = count > 0 ? avgPpg / count : 100;

    return matchups
      .filter(m => !m.isComplete && (m.team1Id === userTeamData.id || m.team2Id === userTeamData.id))
      .map(m => {
        const isTeam1 = m.team1Id === userTeamData.id;
        const opponentId = isTeam1 ? m.team2Id : m.team1Id;
        const userPpg = teamPpg.get(userTeamData.id) || avgPpg;
        const oppPpg = teamPpg.get(opponentId) || avgPpg;
        const rawProb = userPpg / (userPpg + oppPpg);
        const clampedProb = Math.min(0.85, Math.max(0.15, rawProb));

        return {
          week: m.week,
          opponent: isTeam1 ? m.team2 : m.team1,
          opponentId,
          winProb: Math.round(clampedProb * 100),
        };
      })
      .sort((a, b) => a.week - b.week);
  }, [matchups, userTeamData, standings]);

  // Show loading state
  if (standingsLoading || allMatchupsLoading) {
    return (
      <div className="max-w-[1600px] mx-auto">
        <div className={`rounded-lg border p-12 flex flex-col items-center justify-center ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
          <p className={isDarkMode ? 'text-[#737373]' : 'text-[#555]'}>Loading playoff data...</p>
        </div>
      </div>
    );
  }

  // Show message if no data
  if (leagueTeamsData.length === 0) {
    return (
      <div className="max-w-[1600px] mx-auto">
        <div className={`rounded-lg border p-12 text-center ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
          <Trophy className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-slate-600' : 'text-[#a3a3a3]'}`} />
          <h2 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>No Playoff Data</h2>
          <p className={`text-sm mb-4 ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
            Sync your league to view playoff predictions and run simulations.
          </p>
          <p className={`text-xs ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>
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
      <div className={`border rounded-lg p-8 ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-blue-500" />
              <span className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Fantasy Playoffs{playoffWeekLabel ? ` • ${playoffWeekLabel}` : ''}</span>
            </div>
            <h1 className={`text-3xl mb-2 font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Playoff Predictor</h1>
            <p className={isDarkMode ? 'text-[#737373]' : 'text-[#555]'}>
              {seasonComplete
                ? 'Final regular season standings'
                : activeTab === 'predictor'
                  ? 'Based on 10,000 simulations using team scoring strength and remaining schedule'
                  : 'Simulate specific game outcomes to see playoff implications'
              }
            </p>
          </div>
          <div className={`rounded-lg px-6 py-4 border ${isDarkMode ? 'bg-[#1a1a1a] border-[#222]' : 'bg-slate-100 border-slate-200'}`}>
            <div className={`text-xs mb-1 ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Top {playoffTeamCount} Make Playoffs</div>
            <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {seasonComplete ? 'Season Over' : `${weeksRemaining} Weeks Left`}
            </div>
            <div className={`text-xs mt-1 ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>{league?.name || 'Regular Season'}</div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div role="tablist" aria-label="Playoff predictor views" className={`mt-6 flex gap-2 border-b ${isDarkMode ? 'border-[#222]' : 'border-slate-200'}`}>
          <button
            role="tab"
            aria-selected={activeTab === 'predictor'}
            aria-controls="panel-predictor"
            id="tab-predictor"
            onClick={() => setActiveTab('predictor')}
            className={`px-4 py-2 font-semibold text-sm transition-all relative ${
              activeTab === 'predictor'
                ? 'text-blue-500'
                : isDarkMode ? 'text-[#737373] hover:text-[#a3a3a3]' : 'text-[#555] hover:text-slate-700'
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
                : isDarkMode ? 'text-[#737373] hover:text-[#a3a3a3]' : 'text-[#555] hover:text-slate-700'
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
            <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
              {/* Table Header */}
              <div className={`p-6 border-b ${isDarkMode ? 'border-[#222]' : 'border-slate-200'}`}>
                <h2 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {seasonComplete ? 'Final Standings' : 'Playoff Chances'}
                </h2>
                <p className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
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
                    <tr className={`border-b ${isDarkMode ? 'bg-[#1a1a1a] border-[#222]' : 'bg-slate-50 border-slate-200'}`}>
                      <th className={`text-left px-6 py-3 text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Rank</th>
                      <th className={`text-left px-6 py-3 text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Team</th>
                      <th className={`text-center px-6 py-3 text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Record</th>
                      <th className={`text-right px-6 py-3 text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Points For</th>
                      <th className={`text-right px-6 py-3 text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
                        {seasonComplete ? 'Final Wins' : 'Proj. Wins'}
                      </th>
                      <th className={`text-right px-6 py-3 text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
                        {seasonComplete ? 'Status' : 'Playoff %'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTeams.map((team, index) => (
                      <tr
                        key={team.id}
                        className={`border-b transition-colors ${
                          isDarkMode ? 'border-slate-800 hover:bg-[#1a1a1a]' : 'border-slate-100 hover:bg-slate-50'
                        } ${team.isUserTeam ? 'bg-blue-500/5' : ''}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>{index + 1}</span>
                            {index < playoffTeamCount && (
                              <Award className="w-4 h-4 text-yellow-500" aria-label="Playoff position" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{team.name}</div>
                            <div className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>{team.owner}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {formatRecord(team.wins, team.losses, team.ties)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-sm ${isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-600'}`}>{team.pointsFor.toFixed(1)}</span>
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
              <div className={`px-6 py-4 border-t ${isDarkMode ? 'bg-[#1a1a1a] border-[#222]' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
                  <Award className="w-3 h-3 inline text-yellow-500" aria-hidden="true" /> = Currently in playoff position
                </p>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Your Team Status */}
            <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Your Playoff Status</h3>
              <div className={`rounded-lg p-4 border ${getPlayoffChanceBg(userTeamData?.playoffChance || 0)}`}>
                <div className="text-center">
                  {seasonComplete ? (
                    <>
                      <div className={`text-4xl font-bold mb-2 ${(userTeamData?.playoffChance || 0) === 100 ? 'text-green-500' : 'text-red-500'}`}>
                        {(userTeamData?.playoffChance || 0) === 100 ? 'IN' : 'OUT'}
                      </div>
                      <div className={`text-sm ${isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-600'}`}>
                        {(userTeamData?.playoffChance || 0) === 100 ? 'Made the Playoffs!' : 'Eliminated from Playoffs'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`text-4xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {userTeamData?.playoffChance || 0}%
                      </div>
                      <div className={`text-sm mb-3 ${isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-600'}`}>Chance to Make Playoffs</div>
                      <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-slate-200'}`}>
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
                  <span className={isDarkMode ? 'text-[#737373]' : 'text-[#555]'}>
                    {seasonComplete ? 'Final Rank:' : 'Current Rank:'}
                  </span>
                  <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {userPlayoffRank != null ? `#${userPlayoffRank}` : '-'}
                  </span>
                </div>
                {!seasonComplete && (
                  <div className="flex justify-between text-sm">
                    <span className={isDarkMode ? 'text-[#737373]' : 'text-[#555]'}>Projected Wins:</span>
                    <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {userTeamData?.projectedWins != null ? Math.round(userTeamData.projectedWins) : '-'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className={isDarkMode ? 'text-[#737373]' : 'text-[#555]'}>
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
            <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {seasonComplete ? 'Season Summary' : 'Your Remaining Games'}
              </h3>
              <div className="space-y-3">
                {userRemainingMatchups.length === 0 ? (
                  <p className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
                    {seasonComplete
                      ? 'The regular season is complete. Check standings for final playoff picture.'
                      : 'No remaining games scheduled.'
                    }
                  </p>
                ) : (
                  userRemainingMatchups.map((game) => (
                      <div key={`${game.week}-${game.opponentId}`} className={`rounded-lg p-3 border ${isDarkMode ? 'bg-[#1a1a1a] border-[#222]' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className={`w-4 h-4 ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`} aria-hidden="true" />
                            <div>
                              <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Week {game.week}</div>
                              <div className={`text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>vs {game.opponent}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Win Prob</div>
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
            <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Key Insights</h3>
              <div className="space-y-3 text-sm">
                {userRemainingMatchups[0] && (
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5"></div>
                    <p className={isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-600'}>
                      Next game: <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Week {userRemainingMatchups[0].week}</span> vs {userRemainingMatchups[0].opponent}
                    </p>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5"></div>
                  <p className={isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-600'}>
                    <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{weeksRemaining} games</span> remaining in regular season
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5"></div>
                  <p className={isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-600'}>
                    Your points for ranks <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {userPointsForRank != null ? `#${userPointsForRank}` : '-'}
                    </span> in the league
                  </p>
                </div>
                {userTeamData && (
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5"></div>
                    <p className={isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-600'}>
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
              <label className={`flex items-center gap-2 text-sm cursor-pointer ${isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-600'}`}>
                <input
                  type="checkbox"
                  checked={showPointsInput}
                  onChange={(e) => setShowPointsInput(e.target.checked)}
                  className={`w-4 h-4 rounded text-blue-600 focus:ring-blue-600 focus:ring-offset-0 ${isDarkMode ? 'border-[#222] bg-[#1a1a1a]' : 'border-slate-300 bg-white'}`}
                />
                <span>Include Points Scored</span>
              </label>
              <button
                onClick={resetSimulator}
                className={`px-4 py-2 border rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${isDarkMode ? 'bg-[#1a1a1a] hover:bg-slate-700 border-[#222] text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-900'}`}
              >
                <Shuffle className="w-4 h-4" aria-hidden="true" />
                Reset All
              </button>
            </div>

            {/* Dynamic Week Matchups */}
            {matchupWeeks.length === 0 ? (
              <div className={`rounded-lg border p-8 text-center ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
                <Calendar className={`w-12 h-12 mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-[#a3a3a3]'}`} aria-hidden="true" />
                <p className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
                  No matchups found. Sync your league to load matchup data.
                </p>
              </div>
            ) : (
              matchupWeeks.map(week => {
                const weekMatchups = matchups.filter(m => m.week === week);
                const isWeekComplete = weekMatchups.every(m => m.isComplete);

                return (
                  <div
                    key={week}
                    className={`rounded-lg border p-6 ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'} ${isWeekComplete ? 'opacity-60' : ''}`}
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
                              ? isDarkMode ? 'bg-[#1a1a1a]/50 border-[#222]/50' : 'bg-slate-100/50 border-slate-200/50'
                              : isDarkMode ? 'bg-[#1a1a1a] border-[#222]' : 'bg-slate-50 border-slate-200'
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
                                    ? isDarkMode ? 'bg-[#111]/50 border-[#222]/50 text-[#555] cursor-default' : 'bg-white/50 border-slate-200/50 text-[#737373] cursor-default'
                                    : isDarkMode ? 'bg-[#111] border-[#222] text-[#a3a3a3] hover:border-slate-600' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold">{matchup.team1}</span>
                                {matchup.winner === matchup.team1Id && (
                                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                                )}
                              </div>
                              {matchup.isComplete && matchup.team1Points !== undefined && (
                                <div className={`text-xs mt-1 ${matchup.winner === matchup.team1Id ? 'text-white/80' : isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>
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
                                    ? isDarkMode ? 'bg-[#111]/50 border-[#222]/50 text-[#555] cursor-default' : 'bg-white/50 border-slate-200/50 text-[#737373] cursor-default'
                                    : isDarkMode ? 'bg-[#111] border-[#222] text-[#a3a3a3] hover:border-slate-600' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold">{matchup.team2}</span>
                                {matchup.winner === matchup.team2Id && (
                                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                                )}
                              </div>
                              {matchup.isComplete && matchup.team2Points !== undefined && (
                                <div className={`text-xs mt-1 ${matchup.winner === matchup.team2Id ? 'text-white/80' : isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>
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
                                className={`p-2 rounded-lg border text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isDarkMode ? 'border-[#222] text-[#a3a3a3] bg-[#111]' : 'border-slate-200 text-slate-900 bg-white'}`}
                                placeholder={`${matchup.team1} Points`}
                              />
                              <input
                                type="number"
                                aria-label={`Points for ${matchup.team2}`}
                                value={matchup.team2Points?.toString() || ''}
                                onChange={(e) => handlePointsChange(matchup.id, 'team2', e.target.value)}
                                className={`p-2 rounded-lg border text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isDarkMode ? 'border-[#222] text-[#a3a3a3] bg-[#111]' : 'border-slate-200 text-slate-900 bg-white'}`}
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
            <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Simulated Final Standings</h3>
              <div className="space-y-3">
                {simulatedStandings.map((team, index) => (
                  <div
                    key={team.id}
                    className={`p-3 rounded-lg border transition-all ${
                      index < playoffTeamCount
                        ? 'bg-green-500/10 border-green-500/30'
                        : isDarkMode ? 'bg-[#1a1a1a] border-[#222]' : 'bg-slate-50 border-slate-200'
                    } ${team.isUserTeam ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>#{index + 1}</span>
                        {index < playoffTeamCount && <Award className="w-4 h-4 text-yellow-500" aria-label="Playoff position" />}
                      </div>
                      <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {formatRecord(team.simulatedWins, team.simulatedLosses, team.ties)}
                      </span>
                    </div>
                    <div className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{team.name}</div>
                    <div className={`text-xs mt-1 ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
                      {team.simulatedPointsFor.toFixed(1)} PF
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Simulation Insights */}
            <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
              <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Simulation Results</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className={isDarkMode ? 'text-[#737373]' : 'text-[#555]'}>Your Simulated Rank:</span>
                  <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {userSimulatedRank != null ? `#${userSimulatedRank}` : '-'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={isDarkMode ? 'text-[#737373]' : 'text-[#555]'}>Your Final Record:</span>
                  <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {userSimulatedTeam
                      ? formatRecord(userSimulatedTeam.simulatedWins, userSimulatedTeam.simulatedLosses, userSimulatedTeam.ties)
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={isDarkMode ? 'text-[#737373]' : 'text-[#555]'}>Playoff Status:</span>
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