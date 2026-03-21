import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Zap, Shield, Target, Loader2 } from 'lucide-react';
import { Player } from '../App';
import { useLeagueContext } from '../context/LeagueContext';
import type { RosterPlayer } from '../context/LeagueContext';

import { sortByPosition } from '../utils/rosterPositions';
import { calculateGrade, getMatchupGradeLabel, getMatchupGradeColor } from '../utils/matchupGrades';

/** Sentinel name for an unfilled roster slot */
const EMPTY_SLOT_NAME = 'Empty';

interface MatchupPlayer {
  id?: string;
  position: string;
  name: string;
  team: string;
  projection: number;
  isStarter: boolean;
  matchupGrade?: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  headshotUrl?: string | null;
}

interface MatchupViewProps {
  onPlayerClick: (player: Player) => void;
  isDarkMode: boolean;
}

export function MatchupView({ onPlayerClick, isDarkMode }: MatchupViewProps) {
  const { league, userTeam, roster, matchup, matchupLoading, error } = useLeagueContext();
  const currentWeek = league?.currentWeek || 1;
  const isComplete = matchup?.isComplete || false;

  // Check if we have a real matchup
  const hasMatchup = !!matchup?.opponent?.id;

  // Convert roster to MatchupPlayer format
  const yourTeamData = useMemo(() => {
    if (roster && roster.length > 0) {
      return roster.map(p => {
        const pts = isComplete ? (p?.actualPoints ?? p?.projectedPoints ?? 0) : (p?.projectedPoints || 0);
        return {
          id: p?.id,
          position: p?.slot || p?.position || 'FLEX',
          name: p?.name || 'Unknown',
          team: p?.team || '-',
          projection: pts,
          isStarter: p?.isStarter ?? false,
          matchupGrade: calculateGrade(pts, p?.position || 'FLEX') as MatchupPlayer['matchupGrade'],
          headshotUrl: p?.imageUrl || null,
        };
      });
    }
    // Return empty array if no roster
    return [];
  }, [roster, isComplete]);

  // Create empty opponent slots - derive from user's starters when available, else default 9-slot lineup
  const emptyOpponentSlots: MatchupPlayer[] = useMemo(() => {
    const userStarters = roster?.filter(p => p?.isStarter).map(p => p?.slot || p?.position || 'FLEX') ?? [];
    const starterSlots =
      userStarters.length > 0 ? userStarters : ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF'];
    return sortByPosition(
      starterSlots.map(pos => ({
        position: pos,
        slot: pos,
        name: EMPTY_SLOT_NAME,
        team: '-',
        projection: 0,
        isStarter: true,
        matchupGrade: undefined as MatchupPlayer['matchupGrade'],
      }))
    );
  }, [roster]);

  // Get opponent data from matchup context or show empty slots
  const opponentTeamData = useMemo(() => {
    if (hasMatchup && matchup?.opponent?.roster && matchup.opponent.roster.length > 0) {
      return matchup.opponent.roster.map((p: RosterPlayer) => {
        const pts = isComplete ? (p?.actualPoints ?? p?.projectedPoints ?? 0) : (p?.projectedPoints || 0);
        return {
          id: p?.id,
          position: p?.slot || p?.position || 'FLEX',
          name: p?.name || 'Unknown',
          team: p?.team || '-',
          projection: pts,
          isStarter: p?.isStarter ?? false,
          matchupGrade: calculateGrade(pts, p?.position || 'FLEX') as MatchupPlayer['matchupGrade'],
          headshotUrl: p?.imageUrl || null,
        };
      });
    }
    // Return empty slots when no matchup
    return emptyOpponentSlots;
  }, [matchup, hasMatchup, emptyOpponentSlots, isComplete]);

  const opponentName = hasMatchup ? (matchup?.opponent?.name || 'Opponent') : 'No Opponent';

  // Memoize sorted arrays and totals to avoid recomputing on every render
  const yourStarters = useMemo(() => sortByPosition(yourTeamData.filter(p => p.isStarter)), [yourTeamData]);
  const yourBench = useMemo(() => sortByPosition(yourTeamData.filter(p => !p.isStarter)), [yourTeamData]);
  const opponentStarters = useMemo(() => sortByPosition(opponentTeamData.filter(p => p.isStarter)), [opponentTeamData]);
  const opponentBench = useMemo(() => sortByPosition(opponentTeamData.filter(p => !p.isStarter)), [opponentTeamData]);

  const yourTotal = useMemo(() => yourStarters.reduce((sum, p) => sum + p.projection, 0), [yourStarters]);
  const opponentTotal = useMemo(() => opponentStarters.reduce((sum, p) => sum + p.projection, 0), [opponentStarters]);

  // Show loading state
  if (matchupLoading) {
    return (
      <div className="max-w-[1600px] mx-auto">
        <div className={`rounded-lg border p-12 flex flex-col items-center justify-center ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" aria-hidden="true" aria-label="Loading matchup" />
          <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Loading matchup...</p>
        </div>
      </div>
    );
  }

  // Check if we have valid data for comparison
  const hasValidData = yourStarters.length > 0;

  // Calculate win probability based on projection difference (only if there's a real matchup)
  const projDiff = yourTotal - opponentTotal;
  const winProbability = hasMatchup ? Math.min(95, Math.max(5, 50 + (projDiff * 2.5))) : 50;

  // Convert matchup player to Player interface for modal (use real player id for stats API)
  const convertToPlayer = (matchupPlayer: MatchupPlayer, index: number): Player => {
    const pos = (matchupPlayer.position === 'FLEX' ? 'WR' : matchupPlayer.position) as Player['position'];
    const projPts = matchupPlayer.projection;
    const keyLine = projPts > 0 ? `Proj: ${projPts.toFixed(1)} pts` : '';

    return {
      id: matchupPlayer.id || `matchup-${index}`,
      rank: index + 1,
      name: matchupPlayer.name,
      team: matchupPlayer.team,
      position: pos,
      keyLine,
      projectedPoints: projPts,
      weekChange: 0,
      headshotUrl: matchupPlayer.headshotUrl ?? undefined,
    };
  };

  // Find position-by-position advantages (handle different sized arrays)
  const positionComparison = yourStarters.map((yourPlayer, idx) => {
    const oppPlayer = opponentStarters[idx] || {
      position: yourPlayer.position,
      name: EMPTY_SLOT_NAME,
      team: '-',
      projection: 0,
      isStarter: true,
      matchupGrade: 'C' as const,
    };
    const diff = yourPlayer.projection - oppPlayer.projection;
    return { position: yourPlayer.position, diff, yourPlayer, oppPlayer };
  });

  const yourAdvantages = positionComparison.filter(p => p.diff > 1).length;
  const oppAdvantages = positionComparison.filter(p => p.diff < -1).length;

  // No roster state - show message to sync
  if (!hasValidData && !matchupLoading) {
    return (
      <div className="max-w-[1600px] mx-auto">
        <div className={`rounded-lg border p-12 text-center ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <Target className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} aria-hidden="true" />
          <h2 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>No Matchup Data</h2>
          <p className={`text-sm mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Sync your league to import matchup data from Sleeper.
          </p>
          <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Go to Settings and click "Sync" on your league.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Error alert */}
      {error && (
        <div className={`rounded-lg border p-4 flex items-center gap-3 ${isDarkMode ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'}`}>
          <Target className="w-5 h-5 text-red-500" aria-hidden="true" />
          <p className={`text-sm font-medium ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>{error}</p>
        </div>
      )}

      {/* No opponent alert */}
      {!hasMatchup && !matchupLoading && (
        <div className={`rounded-lg border p-4 flex items-center gap-3 ${isDarkMode ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
          <Target className="w-5 h-5 text-blue-500" aria-hidden="true" />
          <div>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>
              No opponent scheduled for Week {currentWeek}
            </p>
            <p className={`text-xs ${isDarkMode ? 'text-blue-500/70' : 'text-blue-600'}`}>
              This could be a bye week or the matchup hasn't been set yet.
            </p>
          </div>
        </div>
      )}

      {/* Header Card */}
      <div className={`rounded-lg border p-4 sm:p-6 md:p-8 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-start justify-between mb-4 sm:mb-6 gap-3">
          <div>
            <h1 className={`text-xl sm:text-2xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Fantasy Matchup</h1>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{isComplete ? 'Final results' : 'Side-by-side projections and biggest edges'}</p>
          </div>
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}
            aria-label={`Current week: ${currentWeek}`}
          >
            <span className="text-sm font-medium">Week {currentWeek}</span>
          </div>
        </div>

        {/* Matchup Overview */}
        <div className={`rounded-lg p-4 sm:p-6 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            {/* Your Team */}
            <div className="text-center flex-1">
              <div className={`text-xs sm:text-sm mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>You</div>
              <div className={`text-2xl sm:text-4xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{isComplete && matchup?.userTeam?.score ? matchup.userTeam.score.toFixed(1) : yourTotal.toFixed(1)}</div>
              <div className={`text-[10px] sm:text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{isComplete ? 'Final Score' : 'Projected Points'}</div>
            </div>

            {/* VS Badge */}
            <div className="px-3 sm:px-8">
              <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 flex items-center justify-center ${isDarkMode ? 'bg-slate-900 border-slate-600' : 'bg-white border-slate-300'}`}>
                <span className={`text-sm sm:text-base font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>VS</span>
              </div>
            </div>

            {/* Opponent */}
            <div className="text-center flex-1">
              <div className={`text-xs sm:text-sm mb-1 truncate ${!hasMatchup ? (isDarkMode ? 'text-slate-600' : 'text-slate-400') : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`}>
                {opponentName}
              </div>
              <div className={`text-2xl sm:text-4xl font-bold mb-1 ${!hasMatchup ? (isDarkMode ? 'text-slate-700' : 'text-slate-300') : (isDarkMode ? 'text-white' : 'text-slate-900')}`}>
                {hasMatchup ? (isComplete && matchup?.opponent?.score ? matchup.opponent.score.toFixed(1) : opponentTotal.toFixed(1)) : '-'}
              </div>
              <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {!hasMatchup ? 'No opponent' : isComplete ? 'Final Score' : 'Projected Points'}
              </div>
            </div>
          </div>

          {/* Win Probability Bar / Result */}
          {hasMatchup ? (
            isComplete ? (
            <div className="mb-4">
              {(() => {
                const myScore = matchup?.userTeam?.score || yourTotal;
                const oppScore = matchup?.opponent?.score || opponentTotal;
                const won = myScore > oppScore;
                const tied = myScore === oppScore;
                return (
                  <div className={`p-3 rounded-lg text-center font-bold text-lg ${won ? 'bg-green-500/20 text-green-500' : tied ? (isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600') : 'bg-red-500/20 text-red-500'}`}>
                    {won ? 'Victory' : tied ? 'Tie' : 'Defeat'}
                  </div>
                );
              })()}
            </div>
            ) : (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-blue-500 font-semibold">{winProbability.toFixed(0)}% Win</span>
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{(100 - winProbability).toFixed(0)}% Win</span>
              </div>
              <div className={`h-3 rounded-full overflow-hidden flex ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} role="progressbar" aria-valuenow={winProbability} aria-valuemin={0} aria-valuemax={100} aria-label="Win probability">
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
            )
          ) : (
            <div className={`mb-4 p-3 rounded-lg text-center ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
              <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Bye week or no opponent scheduled
              </p>
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4 sm:mt-6">
            <div className={`rounded-lg p-3 text-center border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Target className="w-4 h-4 text-blue-500" aria-hidden="true" />
                <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{isComplete ? 'Margin' : 'Proj. Margin'}</span>
              </div>
              <div className={`text-lg font-bold ${projDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {projDiff >= 0 ? '+' : ''}{projDiff.toFixed(1)}
              </div>
            </div>
            <div className={`rounded-lg p-3 text-center border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Zap className="w-4 h-4 text-green-500" aria-hidden="true" />
                <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Your Edges</span>
              </div>
              <div className="text-lg font-bold text-green-500">{yourAdvantages}</div>
            </div>
            <div className={`rounded-lg p-3 text-center border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Shield className="w-4 h-4 text-red-500" aria-hidden="true" />
                <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Their Edges</span>
              </div>
              <div className="text-lg font-bold text-red-500">{oppAdvantages}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Position-by-Position Comparison */}
      <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-3 sm:p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <h2 className={`font-bold text-sm sm:text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Position-by-Position Breakdown</h2>
          <p className={`text-xs sm:text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{isComplete ? 'Final points at each roster spot' : 'Compare projections at each roster spot'}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className={`border-b ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <th scope="col" className={`text-left px-2 sm:px-6 py-3 text-xs w-12 sm:w-16 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>POS</th>
                <th scope="col" className={`text-left px-2 sm:px-4 py-3 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Your Player</th>
                <th scope="col" className={`text-center px-2 sm:px-4 py-3 text-xs w-16 sm:w-24 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{isComplete ? 'Pts' : 'Proj'}</th>
                <th scope="col" className={`text-center px-2 sm:px-4 py-3 text-xs w-14 sm:w-20 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Edge</th>
                <th scope="col" className={`text-center px-2 sm:px-4 py-3 text-xs w-16 sm:w-24 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{isComplete ? 'Pts' : 'Proj'}</th>
                <th scope="col" className={`text-right px-2 sm:px-4 py-3 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Their Player</th>
              </tr>
            </thead>
            <tbody>
              {positionComparison.map((comp, index) => (
                <tr key={`${comp.yourPlayer.id || comp.position}-${index}`} className={`border-b transition-colors ${isDarkMode ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50'}`}>
                  <td className="px-2 sm:px-6 py-3 sm:py-4">
                    <span className={`text-xs font-medium px-1.5 sm:px-2 py-1 rounded ${isDarkMode ? 'text-slate-500 bg-slate-800' : 'text-slate-500 bg-slate-100'}`}>
                      {comp.position}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4">
                    <button
                      onClick={() => onPlayerClick(convertToPlayer(comp.yourPlayer, index))}
                      className="text-left hover:text-blue-500 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-8 sm:w-9 aspect-[3/4] rounded flex items-center justify-center text-xs sm:text-sm font-bold border overflow-hidden flex-shrink-0 group-hover:border-blue-500 transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          <span className={`text-xs sm:text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{comp.yourPlayer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                            <span className={`font-bold text-sm sm:text-base group-hover:text-blue-500 truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{comp.yourPlayer.name}</span>
                            <span
                              className={`text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 sm:py-1 rounded border shrink-0 hidden sm:inline ${getMatchupGradeColor(comp.yourPlayer.matchupGrade, isDarkMode)}`}
                              title={`${getMatchupGradeLabel(comp.yourPlayer.matchupGrade)} projection for position`}
                            >
                              Matchup {comp.yourPlayer.matchupGrade || '—'}
                            </span>
                          </div>
                          <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{comp.yourPlayer.team}</div>
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                    <span className={`font-bold text-sm sm:text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{comp.yourPlayer.projection.toFixed(1)}</span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                      comp.diff > 1 ? 'bg-green-500/20 text-green-500' :
                      comp.diff < -1 ? 'bg-red-500/20 text-red-500' :
                      isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {comp.diff > 0 ? <TrendingUp className="w-3 h-3" aria-hidden="true" /> : comp.diff < 0 ? <TrendingDown className="w-3 h-3" aria-hidden="true" /> : null}
                      {comp.diff > 0 ? '+' : ''}{comp.diff.toFixed(1)}
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                    <span className={`font-bold text-sm sm:text-base ${comp.oppPlayer.name === EMPTY_SLOT_NAME ? (isDarkMode ? 'text-slate-600' : 'text-slate-300') : (isDarkMode ? 'text-white' : 'text-slate-900')}`}>
                      {comp.oppPlayer.name === EMPTY_SLOT_NAME ? '-' : comp.oppPlayer.projection.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 text-right">
                    {comp.oppPlayer.name === EMPTY_SLOT_NAME ? (
                      <div className="text-right">
                        <div className={`flex items-center gap-2 justify-end ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>
                          <span className="font-bold italic">{EMPTY_SLOT_NAME}</span>
                        </div>
                        <div className={`text-xs ${isDarkMode ? 'text-slate-700' : 'text-slate-300'}`}>No opponent</div>
                      </div>
                    ) : (
                      <button
                        onClick={() => onPlayerClick(convertToPlayer(comp.oppPlayer, yourStarters.length + index))}
                        className="text-right hover:text-blue-500 transition-colors group"
                      >
                        <div className="flex items-center gap-2 justify-end">
                          <div>
                            <div className="flex items-center gap-4 justify-end">
                              <span
                                className={`text-xs font-medium px-2 py-1 rounded border shrink-0 ${getMatchupGradeColor(comp.oppPlayer.matchupGrade, isDarkMode)}`}
                                title={`${getMatchupGradeLabel(comp.oppPlayer.matchupGrade)} projection for position`}
                              >
                                Matchup {comp.oppPlayer.matchupGrade || '—'}
                              </span>
                              <span className={`font-bold group-hover:text-blue-500 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{comp.oppPlayer.name}</span>
                            </div>
                            <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{comp.oppPlayer.team}</div>
                          </div>
                          <div className={`w-9 aspect-[3/4] rounded flex items-center justify-center text-sm font-bold border overflow-hidden flex-shrink-0 group-hover:border-blue-500 transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                            <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{comp.oppPlayer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</span>
                          </div>
                        </div>
                      </button>
                    )}
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
        <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`p-4 border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
            <h3 className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Your Bench</h3>
          </div>
          <div className="p-4 space-y-2">
            {yourBench.length === 0 ? (
              <div className={`text-center py-8 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                <p className="text-sm">No bench players</p>
              </div>
            ) : (
              yourBench.map((player) => (
                <button
                  key={player.id || `bench-${player.name}-${player.team}`}
                  onClick={() => onPlayerClick(convertToPlayer(player, yourStarters.length))}
                  className={`w-full rounded-lg px-4 py-3 border hover:border-blue-500 transition-all text-left group ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs w-8 font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{player.position}</span>
                      <div className={`w-9 aspect-[3/4] rounded flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0 transition-colors ${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</span>
                      </div>
                      <div>
                        <span className={`font-bold transition-colors ${isDarkMode ? 'text-slate-300 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>{player.name}</span>
                        <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{player.team}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded border shrink-0 ${getMatchupGradeColor(player.matchupGrade, isDarkMode)}`}
                        title={`${getMatchupGradeLabel(player.matchupGrade)} projection for position`}
                      >
                        Matchup {player.matchupGrade || '—'}
                      </span>
                      <span className={`text-sm font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{player.projection.toFixed(1)}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Opponent Bench */}
        <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`p-4 border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
            <h3 className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Opponent's Bench</h3>
          </div>
          <div className="p-4 space-y-2">
            {!hasMatchup ? (
              <div className={`text-center py-8 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                <p className="text-sm">No opponent this week</p>
              </div>
            ) : opponentBench.length === 0 ? (
              <div className={`text-center py-8 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                <p className="text-sm">No bench players</p>
              </div>
            ) : (
              opponentBench.map((player) => (
                <button
                  key={player.id || `opp-bench-${player.name}-${player.team}`}
                  onClick={() => onPlayerClick(convertToPlayer(player, yourStarters.length + opponentStarters.length))}
                  className={`w-full rounded-lg px-4 py-3 border hover:border-blue-500 transition-all text-left group ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs w-8 font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{player.position}</span>
                      <div className={`w-9 aspect-[3/4] rounded flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0 transition-colors ${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</span>
                      </div>
                      <div>
                        <span className={`font-bold transition-colors ${isDarkMode ? 'text-slate-300 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>{player.name}</span>
                        <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{player.team}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded border shrink-0 ${getMatchupGradeColor(player.matchupGrade, isDarkMode)}`}
                        title={`${getMatchupGradeLabel(player.matchupGrade)} projection for position`}
                      >
                        Matchup {player.matchupGrade || '—'}
                      </span>
                      <span className={`text-sm font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{player.projection.toFixed(1)}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
