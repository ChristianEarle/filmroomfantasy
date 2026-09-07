import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Zap, Shield, Target, Loader2, AlertTriangle, Activity, ArrowLeftRight, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Player } from '../App';
import { useLeagueContext } from '../context/LeagueContext';
import type { RosterPlayer } from '../context/LeagueContext';
import { PlayerAvatar } from './PlayerAvatar';
import api from '../services/api';

import { sortByPosition } from '../utils/rosterPositions';
import { calculateGrade, getMatchupGradeLabel, getMatchupGradeColor } from '../utils/matchupGrades';

/** Sentinel name for an unfilled roster slot */
const EMPTY_SLOT_NAME = 'Empty';

interface MatchupPlayer {
  id?: string;
  position: string;
  slot?: string;
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

/** Strip trailing digits from a roster slot for display (e.g. "RB1" → "RB", "WR2" → "WR", "FLEX" → "FLEX") */
function displaySlot(slot: string): string {
  return (slot || '').replace(/\d+$/, '');
}

/** Highest week a fantasy season can reach (18-week regular season leagues + championship). */
const MAX_MATCHUP_WEEK = 18;

interface WeekPickerProps {
  week: number;
  availableWeeks: number[];
  isDarkMode: boolean;
  onChange: (week: number) => void;
}

/** Compact ‹ Week N › stepper, plus a native <select> shown on mobile. Weeks with no synced matchup are disabled (except the currently selected one, so its empty state can still render). */
function WeekPicker({ week, availableWeeks, isDarkMode, onChange }: WeekPickerProps) {
  const availableSet = useMemo(() => new Set(availableWeeks), [availableWeeks]);
  const isDisabled = (w: number) => w !== week && availableSet.size > 0 && !availableSet.has(w);
  const weeks = useMemo(() => Array.from({ length: MAX_MATCHUP_WEEK }, (_, i) => i + 1), []);

  const btnClass = `flex items-center justify-center w-8 h-8 rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
    isDarkMode
      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 disabled:hover:bg-slate-800'
      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 disabled:hover:bg-white'
  }`;

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className={`${btnClass} hidden sm:flex`}
        onClick={() => onChange(week - 1)}
        disabled={week <= 1}
        aria-label="Previous week"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </button>

      {/* Desktop/tablet: static label between the steppers */}
      <div
        className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}
        aria-label={`Viewing week ${week}`}
      >
        <span className="text-sm font-medium">Week {week}</span>
      </div>

      {/* Mobile: a select is easier to tap through than two small steppers */}
      <select
        className={`sm:hidden text-sm font-medium px-3 py-2 rounded-lg border ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}
        value={week}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Select week"
      >
        {weeks.map((w) => (
          <option key={w} value={w} disabled={isDisabled(w)}>
            Week {w}{isDisabled(w) ? ' (no data)' : ''}
          </option>
        ))}
      </select>

      <button
        type="button"
        className={`${btnClass} hidden sm:flex`}
        onClick={() => onChange(week + 1)}
        disabled={week >= MAX_MATCHUP_WEEK}
        aria-label="Next week"
      >
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilmRoom Edge Analysis — deterministic insights derived from matchup data
// ---------------------------------------------------------------------------

type EdgeSeverity = 'positive' | 'warning' | 'negative';

interface EdgeInsight {
  id: string;
  label: string;
  text: string;
  severity: EdgeSeverity;
  icon: LucideIcon;
}

interface PositionComparisonRow {
  position: string;
  diff: number;
  yourPlayer: MatchupPlayer;
  oppPlayer: MatchupPlayer;
}

/** Injury designations that make a player unlikely/unable to play */
const SEVERE_STATUSES = new Set(['out', 'doubtful', 'ir', 'injured reserve', 'pup', 'sus', 'suspended', 'cov', 'covid', 'nfi', 'dnr']);
/** Injury designations worth monitoring */
const WATCH_STATUSES = new Set(['questionable', 'q']);

function normalizeStatus(status?: string): string {
  return (status || '').trim().toLowerCase();
}

function isInjuryStatus(status?: string): boolean {
  const s = normalizeStatus(status);
  return SEVERE_STATUSES.has(s) || WATCH_STATUSES.has(s);
}

function formatInjuryStatus(status?: string): string {
  const raw = (status || '').trim();
  const s = raw.toLowerCase();
  if (s === 'ir' || s === 'injured reserve') return 'IR';
  if (s === 'q') return 'Questionable';
  if (s === 'sus') return 'Suspended';
  if (s === 'cov' || s === 'covid') return 'COVID';
  if (s === 'pup') return 'PUP';
  if (s === 'nfi' || s === 'dnr') return raw.toUpperCase();
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

/** Can a bench player of `benchPos` fill the roster slot the given starter occupies? */
function benchCanFillSlot(benchPos: string, starter: RosterPlayer): boolean {
  if (starter.position === benchPos) return true;
  const slot = (starter.slot || '').toUpperCase();
  if (slot.includes('FLEX')) {
    if (slot.includes('SUPER')) return ['QB', 'RB', 'WR', 'TE'].includes(benchPos);
    return ['RB', 'WR', 'TE'].includes(benchPos);
  }
  return false;
}

interface EdgeAnalysisInput {
  hasMatchup: boolean;
  isComplete: boolean;
  opponentName: string;
  positionComparison: PositionComparisonRow[];
  yourRoster: RosterPlayer[];
  oppRoster: RosterPlayer[];
  yourTotal: number;
  opponentTotal: number;
}

/** Build 0-6 deterministic insights from data already in the matchup payload. No AI involved. */
function buildEdgeInsights(input: EdgeAnalysisInput): EdgeInsight[] {
  const { hasMatchup, isComplete, opponentName, positionComparison, yourRoster, oppRoster, yourTotal, opponentTotal } = input;
  const insights: EdgeInsight[] = [];
  const projDiff = yourTotal - opponentTotal;
  const realComps = positionComparison.filter(c => c.oppPlayer.name !== EMPTY_SLOT_NAME);

  // 1) Overall lineup edge — how many slots you win and by how much overall
  if (hasMatchup && realComps.length > 0 && (yourTotal > 0 || opponentTotal > 0)) {
    const slotsWon = realComps.filter(c => c.diff > 1).length;
    const slotsLost = realComps.filter(c => c.diff < -1).length;
    const margin = Math.abs(projDiff).toFixed(1);
    if (isComplete) {
      if (projDiff > 0) {
        insights.push({ id: 'overall', label: 'Matchup Verdict', severity: 'positive', icon: Target, text: `You won ${slotsWon} of ${realComps.length} head-to-head spots on the way to a ${margin}-point victory.` });
      } else if (projDiff < 0) {
        insights.push({ id: 'overall', label: 'Matchup Verdict', severity: 'negative', icon: Target, text: `${opponentName} took ${slotsLost} of ${realComps.length} head-to-head spots in a ${margin}-point win.` });
      } else {
        insights.push({ id: 'overall', label: 'Matchup Verdict', severity: 'warning', icon: Target, text: 'Dead even — this matchup finished in a tie.' });
      }
    } else if (Math.abs(projDiff) < 1) {
      insights.push({ id: 'overall', label: 'Lineup Edge', severity: 'warning', icon: Target, text: `This one is a toss-up — projections separate you and ${opponentName} by less than a point.` });
    } else if (projDiff >= 1) {
      insights.push({ id: 'overall', label: 'Lineup Edge', severity: 'positive', icon: Target, text: `You hold the edge at ${slotsWon} of ${realComps.length} lineup spots and project ${margin} points ahead overall.` });
    } else {
      insights.push({ id: 'overall', label: 'Lineup Edge', severity: 'negative', icon: Target, text: `${opponentName} holds the edge at ${slotsLost} of ${realComps.length} lineup spots and projects ${margin} points ahead overall.` });
    }
  }

  // 2) Biggest positional advantage
  const best = realComps.reduce<PositionComparisonRow | null>((acc, c) => (c.diff > 1 && (!acc || c.diff > acc.diff) ? c : acc), null);
  if (best) {
    insights.push({
      id: 'biggest-edge',
      label: 'Biggest Edge',
      severity: 'positive',
      icon: TrendingUp,
      text: isComplete
        ? `${best.yourPlayer.name} outscored ${best.oppPlayer.name} by ${best.diff.toFixed(1)} points at ${best.position}.`
        : `${best.yourPlayer.name} projects ${best.diff.toFixed(1)} points ahead of ${best.oppPlayer.name} at ${best.position}.`,
    });
  }

  // 3) Biggest positional disadvantage
  const worst = realComps.reduce<PositionComparisonRow | null>((acc, c) => (c.diff < -1 && (!acc || c.diff < acc.diff) ? c : acc), null);
  if (worst) {
    insights.push({
      id: 'toughest-gap',
      label: 'Toughest Gap',
      severity: 'negative',
      icon: TrendingDown,
      text: isComplete
        ? `${worst.oppPlayer.name} outscored ${worst.yourPlayer.name} by ${Math.abs(worst.diff).toFixed(1)} points at ${worst.position}.`
        : `${worst.oppPlayer.name} projects ${Math.abs(worst.diff).toFixed(1)} points ahead of ${worst.yourPlayer.name} at ${worst.position}.`,
    });
  }

  const yourStarters = yourRoster.filter(p => p.isStarter);
  const yourBench = yourRoster.filter(p => !p.isStarter);

  // 4) Start/sit flag — best bench upgrade over the weakest eligible starter
  if (!isComplete) {
    let bestSwap: { bench: RosterPlayer; starter: RosterPlayer; delta: number } | null = null;
    for (const b of yourBench) {
      const benchProj = b.projectedPoints || 0;
      if (benchProj <= 0 || SEVERE_STATUSES.has(normalizeStatus(b.status))) continue;
      let weakest: RosterPlayer | null = null;
      for (const s of yourStarters) {
        if (!benchCanFillSlot(b.position, s)) continue;
        if (!weakest || (s.projectedPoints || 0) < (weakest.projectedPoints || 0)) weakest = s;
      }
      if (!weakest) continue;
      const delta = benchProj - (weakest.projectedPoints || 0);
      if (delta >= 2 && (!bestSwap || delta > bestSwap.delta)) {
        bestSwap = { bench: b, starter: weakest, delta };
      }
    }
    if (bestSwap) {
      insights.push({
        id: 'start-sit',
        label: 'Start/Sit',
        severity: 'warning',
        icon: ArrowLeftRight,
        text: `Bench ${bestSwap.bench.position} ${bestSwap.bench.name} projects ${bestSwap.delta.toFixed(1)} points more than starter ${bestSwap.starter.name} (${displaySlot(bestSwap.starter.slot)}) — worth a lineup look.`,
      });
    }
  }

  // 5) Injury alert — your starters with a designation
  const yourInjured = yourStarters.filter(p => isInjuryStatus(p.status));
  if (yourInjured.length > 0) {
    const anySevere = yourInjured.some(p => SEVERE_STATUSES.has(normalizeStatus(p.status)));
    const list = yourInjured.map(p => `${p.name} (${formatInjuryStatus(p.status)})`).join(', ');
    insights.push({
      id: 'injury-yours',
      label: 'Injury Alert',
      severity: anySevere ? 'negative' : 'warning',
      icon: AlertTriangle,
      text: yourInjured.length === 1
        ? `Your starter ${yourInjured[0].name} (${yourInjured[0].position}) is listed as ${formatInjuryStatus(yourInjured[0].status)}.`
        : `${yourInjured.length} of your starters carry injury designations: ${list}.`,
    });
  }

  // 6) Live pace — actual points banked vs projection for in-progress weeks
  if (hasMatchup && !isComplete && yourTotal > 0 && opponentTotal > 0) {
    const yourLive = yourStarters.reduce((sum, p) => sum + (p.actualPoints || 0), 0);
    const oppLive = oppRoster.filter(p => p.isStarter).reduce((sum, p) => sum + (p.actualPoints || 0), 0);
    if (yourLive > 0 || oppLive > 0) {
      const yourPct = Math.round((yourLive / yourTotal) * 100);
      const oppPct = Math.round((oppLive / opponentTotal) * 100);
      insights.push({
        id: 'live-pace',
        label: 'Live Pace',
        severity: yourPct >= oppPct ? 'positive' : 'warning',
        icon: Activity,
        text: `You've banked ${yourLive.toFixed(1)} of ${yourTotal.toFixed(1)} projected points (${yourPct}%), while ${opponentName} sits at ${oppLive.toFixed(1)} of ${opponentTotal.toFixed(1)} (${oppPct}%).`,
      });
    }
  }

  // 7) Opponent injuries — a potential edge for you
  if (hasMatchup) {
    const oppInjured = oppRoster.filter(p => p.isStarter && isInjuryStatus(p.status));
    if (oppInjured.length > 0) {
      const list = oppInjured.map(p => `${p.name} (${formatInjuryStatus(p.status)})`).join(', ');
      insights.push({
        id: 'injury-opp',
        label: 'Opponent Injuries',
        severity: 'positive',
        icon: Zap,
        text: oppInjured.length === 1
          ? `${opponentName}'s starter ${oppInjured[0].name} (${oppInjured[0].position}) is listed as ${formatInjuryStatus(oppInjured[0].status)}.`
          : `${opponentName} has ${oppInjured.length} starters with injury designations: ${list}.`,
      });
    }
  }

  return insights.slice(0, 6);
}

/** Severity tint classes for an insight row (neutral palette + existing semantic colors, no shadows) */
function edgeSeverityStyles(severity: EdgeSeverity, isDarkMode: boolean): { container: string; icon: string; label: string } {
  switch (severity) {
    case 'positive':
      return {
        container: isDarkMode ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200',
        icon: 'text-green-500',
        label: isDarkMode ? 'text-green-400' : 'text-green-700',
      };
    case 'warning':
      return {
        container: isDarkMode ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200',
        icon: 'text-yellow-500',
        label: isDarkMode ? 'text-yellow-400' : 'text-yellow-700',
      };
    case 'negative':
      return {
        container: isDarkMode ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200',
        icon: 'text-red-500',
        label: isDarkMode ? 'text-red-400' : 'text-red-700',
      };
  }
}

export function MatchupView({ onPlayerClick, isDarkMode }: MatchupViewProps) {
  const {
    userTeam,
    roster,
    matchup,
    matchupLoading,
    error,
    selectedLeagueId,
    selectedMatchupWeek,
    setSelectedMatchupWeek,
    matchupCurrentWeek,
    matchupAvailableWeeks,
    refreshMatchup,
  } = useLeagueContext();
  const isComplete = matchup?.isComplete || false;

  // The week picker defaults to the league's current week until the user
  // picks something else (selectedMatchupWeek is reset to null on league
  // switch — see LeagueContext).
  const displayWeek = selectedMatchupWeek ?? matchupCurrentWeek;

  // Check if we have a real matchup
  const hasMatchup = !!matchup?.opponent?.id;

  // The requested week has no synced matchup row for this team at all —
  // distinct from a genuine bye week (which would still show up in
  // matchupAvailableWeeks for the league, just without an opponent here).
  const weekNotSynced = !hasMatchup && !matchupLoading && !matchupAvailableWeeks.includes(displayWeek);

  const [isResyncing, setIsResyncing] = useState(false);
  const [resyncError, setResyncError] = useState<string | null>(null);
  const handleResync = async () => {
    if (!selectedLeagueId || isResyncing) return;
    setIsResyncing(true);
    setResyncError(null);
    try {
      await api.post(`/leagues/${selectedLeagueId}/sync`);
      await refreshMatchup();
    } catch (err) {
      setResyncError(err instanceof Error ? err.message : 'Sync failed — try again in a moment.');
    } finally {
      setIsResyncing(false);
    }
  };

  // Convert roster to MatchupPlayer format
  const yourTeamData = useMemo(() => {
    if (roster && roster.length > 0) {
      return roster.map(p => {
        const pts = isComplete ? (p?.actualPoints ?? p?.projectedPoints ?? 0) : (p?.projectedPoints || 0);
        return {
          id: p?.id,
          position: displaySlot(p?.slot || p?.position || 'FLEX'),
          slot: p?.slot || p?.position || 'FLEX',
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
        position: displaySlot(pos),
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
          position: displaySlot(p?.slot || p?.position || 'FLEX'),
          slot: p?.slot || p?.position || 'FLEX',
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

  // FilmRoom Edge Analysis — deterministic insights from the matchup payload (no AI)
  const edgeInsights = buildEdgeInsights({
    hasMatchup,
    isComplete,
    opponentName,
    positionComparison,
    yourRoster: roster ?? [],
    oppRoster: hasMatchup ? (matchup?.opponent?.roster ?? []) : [],
    yourTotal,
    opponentTotal,
  });

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

      {/* No matchup synced for this week yet — offer a manual re-sync */}
      {weekNotSynced && (
        <div className={`rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between ${isDarkMode ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex items-start gap-3">
            <Target className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className={`text-sm font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>
                No matchup synced for Week {displayWeek} yet
              </p>
              <p className={`text-xs ${isDarkMode ? 'text-blue-500/70' : 'text-blue-600'}`}>
                Leagues re-sync automatically every 4 hours during the season.
              </p>
              {resyncError && (
                <p className="text-xs text-red-500 mt-1">{resyncError}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleResync}
            disabled={isResyncing}
            className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-60 self-start sm:self-auto ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
          >
            <RefreshCw className={`w-4 h-4 ${isResyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
            {isResyncing ? 'Syncing…' : 'Re-sync now'}
          </button>
        </div>
      )}

      {/* No opponent alert (genuine bye week — the week is synced, just no matchup for this team) */}
      {!hasMatchup && !matchupLoading && !weekNotSynced && (
        <div className={`rounded-lg border p-4 flex items-center gap-3 ${isDarkMode ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
          <Target className="w-5 h-5 text-blue-500" aria-hidden="true" />
          <div>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>
              No opponent scheduled for Week {displayWeek}
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
          <WeekPicker
            week={displayWeek}
            availableWeeks={matchupAvailableWeeks}
            isDarkMode={isDarkMode}
            onChange={setSelectedMatchupWeek}
          />
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

      {/* FilmRoom Edge Analysis */}
      <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-3 sm:p-6 border-b flex items-center gap-3 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
            <Zap className="w-4 h-4 text-blue-500" aria-hidden="true" />
          </div>
          <div>
            <h2 className={`font-bold text-sm sm:text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>FilmRoom Edge Analysis</h2>
            <p className={`text-xs sm:text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {isComplete ? 'What decided this matchup' : 'Data-driven reads from projections, lineups, and injury reports'}
            </p>
          </div>
        </div>
        <div className="p-3 sm:p-6">
          {edgeInsights.length === 0 ? (
            <div className={`text-center py-8 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              <Target className="w-8 h-8 mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm">No standout edges detected yet.</p>
              <p className="text-xs mt-1">Insights appear once projections, lineups, and injury data are synced.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {edgeInsights.map(insight => {
                const styles = edgeSeverityStyles(insight.severity, isDarkMode);
                const Icon = insight.icon;
                return (
                  <li key={insight.id} className={`rounded-lg border p-3 flex items-start gap-3 ${styles.container}`}>
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${styles.icon}`} aria-hidden="true" />
                    <div className="min-w-0">
                      <div className={`text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${styles.label}`}>{insight.label}</div>
                      <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{insight.text}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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
                          <PlayerAvatar name={comp.yourPlayer.name} headshotUrl={comp.yourPlayer.headshotUrl} isDarkMode={isDarkMode} fallbackClassName="text-xs sm:text-sm font-bold" />
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
                            <PlayerAvatar name={comp.oppPlayer.name} headshotUrl={comp.oppPlayer.headshotUrl} isDarkMode={isDarkMode} fallbackClassName="text-sm font-bold" />
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
                        <PlayerAvatar name={player.name} headshotUrl={player.headshotUrl} isDarkMode={isDarkMode} fallbackClassName="text-xs font-bold" />
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
                        <PlayerAvatar name={player.name} headshotUrl={player.headshotUrl} isDarkMode={isDarkMode} fallbackClassName="text-xs font-bold" />
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
