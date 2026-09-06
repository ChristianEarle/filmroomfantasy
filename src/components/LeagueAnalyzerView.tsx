import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BarChart3, ChevronDown, RefreshCw, AlertTriangle, Calendar, Trophy, Sparkles, Lock } from 'lucide-react';
import { useLeagueContext } from '../context/LeagueContext';
import { useAuth } from '../context/AuthContext';
import api, { ApiError } from '../services/api';

// ── Types (mirror GET /api/league-analyzer/:leagueId) ─────────────────────────

interface PositionBreakdown {
  position: string;
  starterCount: number;
  avgPoints: number;
  leagueAvg: number;
  deltaPct: number;
  status: 'surplus' | 'balanced' | 'deficit';
  pointShare: number;
}

interface SwingGame {
  week: number;
  opponentId: string;
  opponentName: string;
  opponentPpg: number;
}

interface AnalyzedTeam {
  id: string;
  name: string;
  ownerName: string;
  isUserTeam: boolean;
  rank: number;
  record: { wins: number; losses: number; ties: number };
  gamesPlayed: number;
  pointsFor: number;
  pointsAgainst: number;
  ppg: number;
  grade: string;
  strengthScore: number;
  positions: PositionBreakdown[];
  tradeTargetPosition: string | null;
  scheduleDifficulty: {
    avgOpponentPpg: number | null;
    deltaPct: number | null;
    label: 'tough' | 'average' | 'easy' | null;
    remainingGames: number;
  };
  playoffOdds: number;
  projectedWins: number;
  narrative: string;
  recentFormPpg: number | null;
  trend: 'up' | 'down' | 'steady';
  projectedPpg: number;
  projectedPpgDelta: number;
  recordRank: number;
  recordVsStrength: 'overachieving' | 'underachieving' | 'aligned';
  biggestSwingGame: SwingGame | null;
}

interface LeagueAnalysis {
  league: {
    id: string;
    name: string;
    currentWeek: number;
    seasonYear: number;
    playoffTeams: number;
    scoringFormat: string;
    teamCount: number;
  };
  leagueAvgPpg: number;
  positionAverages: Record<string, number>;
  teams: AnalyzedTeam[];
  generatedAt: string;
}

interface LeagueAnalyzerViewProps {
  isDarkMode: boolean;
}

interface AiNarrativeResponse {
  narrative: string;
  cached: boolean;
  generatedAt: string;
  season: number;
  week: number;
}

interface AiPulseResponse extends AiNarrativeResponse {
  /** Team ids ordered most to least powerful, or null if the model's ranking didn't validate. */
  ranking: string[] | null;
}

interface AiNarrativeState {
  text: string | null;
  loading: boolean;
  error: string | null;
}

const AI_NARRATIVE_IDLE: AiNarrativeState = { text: null, loading: false, error: null };

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatRecord = (wins: number, losses: number, ties: number) =>
  ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;

/** Grade badge colors — semantic hue on a low-alpha background (no shadows). */
const gradeClasses = (grade: string): string => {
  if (grade.startsWith('A')) return 'bg-green-500/15 text-green-500 border-green-500/30';
  if (grade.startsWith('B')) return 'bg-blue-500/15 text-blue-500 border-blue-500/30';
  if (grade.startsWith('C')) return 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30';
  return 'bg-red-500/15 text-red-500 border-red-500/30';
};

const oddsColor = (odds: number): string => {
  if (odds >= 75) return 'text-green-500';
  if (odds >= 50) return 'text-yellow-500';
  if (odds >= 25) return 'text-orange-500';
  return 'text-red-500';
};

const oddsBarColor = (odds: number): string => {
  if (odds >= 75) return 'bg-green-500';
  if (odds >= 50) return 'bg-yellow-500';
  if (odds >= 25) return 'bg-orange-500';
  return 'bg-red-500';
};

/** Position accent colors — matches the app-wide convention (see RosterBoardPanel). */
const POS_COLORS: Record<string, string> = {
  QB: 'bg-red-500/15 text-red-500',
  RB: 'bg-green-500/15 text-green-500',
  WR: 'bg-blue-500/15 text-blue-500',
  TE: 'bg-amber-500/15 text-amber-500',
  K: 'bg-purple-500/15 text-purple-500',
  DEF: 'bg-slate-500/15 text-slate-500',
};

const recordVsStrengthLabel: Record<AnalyzedTeam['recordVsStrength'], string> = {
  overachieving: 'Overachieving',
  underachieving: 'Underachieving',
  aligned: 'Record matches strength',
};

const recordVsStrengthHint: Record<AnalyzedTeam['recordVsStrength'], string> = {
  overachieving: 'Record is better than underlying team strength — a regression risk.',
  underachieving: 'Underlying team strength is better than the record shows — a buy-low candidate.',
  aligned: 'Record and underlying team strength are in line.',
};

const recordVsStrengthClasses = (status: AnalyzedTeam['recordVsStrength'], isDarkMode: boolean): string => {
  if (status === 'overachieving') return 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30';
  if (status === 'underachieving') return 'bg-green-500/15 text-green-500 border-green-500/30';
  return isDarkMode
    ? 'bg-slate-800 text-slate-400 border-slate-700'
    : 'bg-slate-100 text-slate-500 border-slate-200';
};

const heatCellClasses = (status: PositionBreakdown['status'], isDarkMode: boolean): string => {
  if (status === 'surplus') return 'bg-green-500/15 text-green-500 border-green-500/30';
  if (status === 'deficit') return 'bg-red-500/15 text-red-500 border-red-500/30';
  return isDarkMode
    ? 'bg-slate-800 text-slate-400 border-slate-700'
    : 'bg-slate-100 text-slate-500 border-slate-200';
};

const scheduleChipClasses = (label: 'tough' | 'average' | 'easy' | null, isDarkMode: boolean): string => {
  if (label === 'tough') return 'bg-red-500/15 text-red-500 border-red-500/30';
  if (label === 'easy') return 'bg-green-500/15 text-green-500 border-green-500/30';
  return isDarkMode
    ? 'bg-slate-800 text-slate-400 border-slate-700'
    : 'bg-slate-100 text-slate-500 border-slate-200';
};

// ── Component ─────────────────────────────────────────────────────────────────

export function LeagueAnalyzerView({ isDarkMode }: LeagueAnalyzerViewProps) {
  const { league, leagueLoading, userTeam } = useLeagueContext();
  const { user, isAuthenticated } = useAuth();
  const [analysis, setAnalysis] = useState<LeagueAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const leagueId = league?.id ?? null;
  const aiTier = (user?.subscriptionTier || 'free') as 'free' | 'pro' | 'elite';
  const canViewAi = isAuthenticated && (aiTier === 'pro' || aiTier === 'elite');

  // ── AI League Pulse + power ranking — fetched once per league, Pro/Elite gated ──
  const [pulse, setPulse] = useState<AiNarrativeState>(AI_NARRATIVE_IDLE);
  const [aiRanking, setAiRanking] = useState<string[] | null>(null);

  useEffect(() => {
    if (!leagueId || !canViewAi) {
      setPulse(AI_NARRATIVE_IDLE);
      setAiRanking(null);
      return;
    }
    let cancelled = false;
    setPulse({ text: null, loading: true, error: null });
    setAiRanking(null);
    api.get<AiPulseResponse>(`/league-analyzer/${leagueId}/pulse`)
      .then((res) => {
        if (cancelled) return;
        setPulse({ text: res.narrative, loading: false, error: null });
        setAiRanking(res.ranking);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : 'AI league pulse is temporarily unavailable.';
        setPulse({ text: null, loading: false, error: message });
      });
    return () => { cancelled = true; };
  }, [leagueId, canViewAi]);

  // ── AI per-team scouting reports — fetched on-demand when a card expands ──
  const [teamNarratives, setTeamNarratives] = useState<Record<string, AiNarrativeState>>({});
  const requestedTeamIds = useRef<Set<string>>(new Set());

  const fetchTeamNarrative = useCallback((teamId: string) => {
    if (!leagueId || !canViewAi) return;
    if (requestedTeamIds.current.has(teamId)) return; // already fetched or in flight
    requestedTeamIds.current.add(teamId);
    setTeamNarratives((prev) => ({ ...prev, [teamId]: { text: null, loading: true, error: null } }));
    api.get<AiNarrativeResponse>(`/league-analyzer/${leagueId}/teams/${teamId}/narrative`)
      .then((res) => {
        setTeamNarratives((prev) => ({ ...prev, [teamId]: { text: res.narrative, loading: false, error: null } }));
      })
      .catch((err) => {
        requestedTeamIds.current.delete(teamId); // allow retry on failure
        const message = err instanceof ApiError ? err.message : 'AI scouting report is temporarily unavailable.';
        setTeamNarratives((prev) => ({ ...prev, [teamId]: { text: null, loading: false, error: message } }));
      });
  }, [leagueId, canViewAi]);

  // Clear per-team AI cache when the league changes so stale reports don't leak across leagues
  useEffect(() => {
    requestedTeamIds.current = new Set();
    setTeamNarratives({});
  }, [leagueId]);

  const fetchAnalysis = useCallback(async () => {
    if (!leagueId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<LeagueAnalysis>(`/league-analyzer/${leagueId}`);
      setAnalysis(response);
    } catch (err) {
      setAnalysis(null);
      setError(err instanceof Error ? err.message : 'Failed to analyze league');
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  // Refetch when the selected league changes; guard against stale responses
  useEffect(() => {
    if (!leagueId) {
      setAnalysis(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<LeagueAnalysis>(`/league-analyzer/${leagueId}`);
        if (!cancelled) setAnalysis(response);
      } catch (err) {
        if (!cancelled) {
          setAnalysis(null);
          setError(err instanceof Error ? err.message : 'Failed to analyze league');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  const toggleTeam = (teamId: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
    if (!expandedTeams.has(teamId)) fetchTeamNarrative(teamId);
  };

  // Refine the server's best-effort user-team flag with the client's own team id
  const teams = useMemo(() => {
    if (!analysis) return [];
    return analysis.teams.map((t) => ({
      ...t,
      isUserTeam: t.isUserTeam || (userTeam ? t.id === userTeam.id : false),
    }));
  }, [analysis, userTeam]);

  const userTeamData = teams.find((t) => t.isUserTeam);

  // When a valid AI power ranking is available, display teams in that order
  // instead of the deterministic season-PPG standings order. Falls back to
  // standings order for free tier, on AI failure, or an invalid permutation.
  const orderedByAi = canViewAi && aiRanking != null && aiRanking.length === teams.length;
  const displayTeams = useMemo(() => {
    if (!orderedByAi || !aiRanking) return teams;
    const byId = new Map(teams.map((t) => [t.id, t]));
    const reordered = aiRanking.map((id) => byId.get(id)).filter((t): t is (typeof teams)[number] => !!t);
    return reordered.length === teams.length ? reordered : teams;
  }, [teams, aiRanking, orderedByAi]);

  // ── Empty state: no league connected ──────────────────────────────────────
  if (!leagueId && !leagueLoading) {
    return (
      <div className="max-w-[1600px] mx-auto">
        <div className={`rounded-lg border p-12 text-center ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <BarChart3 className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} aria-hidden="true" />
          <h2 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>No League Connected</h2>
          <p className={`text-sm mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Connect and sync your league to see team strength grades, positional breakdowns, and playoff odds.
          </p>
          <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Go to Settings and click "Sync" on your league.
          </p>
        </div>
      </div>
    );
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading || leagueLoading || (!analysis && !error)) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-6" aria-busy="true" aria-label="Loading league analysis">
        <div className={`rounded-lg border p-8 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="animate-pulse space-y-3">
            <div className={`h-4 w-40 rounded ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
            <div className={`h-8 w-64 rounded ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
            <div className={`h-4 w-96 max-w-full rounded ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`rounded-lg border p-5 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="animate-pulse flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
                <div className="flex-1 space-y-2">
                  <div className={`h-4 w-48 rounded ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
                  <div className={`h-3 w-32 rounded ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
                </div>
                <div className={`h-8 w-24 rounded ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error state with retry ─────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-[1600px] mx-auto">
        <div className={`rounded-lg border p-12 text-center ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-500" aria-hidden="true" />
          </div>
          <h2 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Couldn't Analyze League</h2>
          <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{error}</p>
          <button
            type="button"
            onClick={fetchAnalysis}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const positionColumns = Object.keys(analysis.positionAverages);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className={`border rounded-lg p-8 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-blue-500" aria-hidden="true" />
              <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {analysis.league.name} • Week {analysis.league.currentWeek}
              </span>
            </div>
            <h1 className={`text-3xl mb-2 font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>League Analyzer</h1>
            <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
              Team strength grades, positional surplus and deficit, schedule difficulty, and playoff odds — computed from your league's synced data.
            </p>
          </div>
          <div className={`rounded-lg px-6 py-4 border flex-shrink-0 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
            <div className={`text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>League Average</div>
            <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {analysis.leagueAvgPpg > 0 ? `${analysis.leagueAvgPpg.toFixed(1)} PPG` : '—'}
            </div>
            <div className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Top {analysis.league.playoffTeams} make playoffs
            </div>
          </div>
        </div>

        {/* User team summary strip */}
        {userTeamData && (
          <div className={`mt-6 rounded-lg border p-4 flex flex-wrap items-center gap-x-6 gap-y-2 ${isDarkMode ? 'bg-blue-500/5 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-blue-500" aria-hidden="true" />
              <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Your Team: {userTeamData.name}</span>
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              Rank <span className="font-semibold">#{userTeamData.rank}</span>
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              Grade <span className="font-semibold">{userTeamData.grade}</span>
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              Playoff odds <span className={`font-semibold ${oddsColor(userTeamData.playoffOdds)}`}>{userTeamData.playoffOdds}%</span>
            </div>
            {userTeamData.tradeTargetPosition && (
              <div className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                Trade target: <span className="font-semibold">{userTeamData.tradeTargetPosition}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI League Pulse */}
      <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className={`w-4 h-4 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} aria-hidden="true" />
          <h2 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>FilmRoom AI League Pulse</h2>
        </div>
        {!canViewAi ? (
          <div className={`flex items-start gap-3 rounded-md border px-3 py-3 ${isDarkMode ? 'border-purple-900/50 bg-purple-950/20' : 'border-purple-200 bg-purple-50'}`}>
            <Lock className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                An AI-generated briefing on the tightest playoff races, strongest and weakest teams, and league-wide trade-market trends.
              </p>
              <button
                type="button"
                onClick={() => window.location.assign(isAuthenticated ? '/pricing' : '/login')}
                className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-500 transition-colors"
              >
                {isAuthenticated ? 'Upgrade to Pro' : 'Sign in to unlock'}
              </button>
            </div>
          </div>
        ) : pulse.loading ? (
          <div className="space-y-2">
            <div className={`animate-pulse h-3 rounded ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
            <div className={`animate-pulse h-3 rounded w-5/6 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
            <div className={`animate-pulse h-3 rounded w-3/4 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
          </div>
        ) : pulse.error ? (
          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{pulse.error}</p>
        ) : pulse.text ? (
          <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{pulse.text}</p>
        ) : (
          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>No AI briefing available yet.</p>
        )}
      </div>

      {/* Ranked team cards */}
      <div className="flex items-center gap-2 px-1">
        <span className={`text-xs font-semibold uppercase tracking-wide ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {orderedByAi ? 'Ordered by AI power ranking' : 'Ordered by season strength'}
        </span>
        {orderedByAi && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400">
            <Sparkles className="w-2.5 h-2.5" aria-hidden="true" />
            AI
          </span>
        )}
      </div>
      <div className="space-y-3">
        {displayTeams.map((team, index) => {
          const isExpanded = expandedTeams.has(team.id);
          const aiNarrative = teamNarratives[team.id];
          const displayRank = orderedByAi ? index + 1 : team.rank;
          return (
            <div
              key={team.id}
              className={`rounded-lg border transition-colors ${
                isDarkMode
                  ? `bg-slate-900 ${team.isUserTeam ? 'border-blue-500/40' : 'border-slate-700'}`
                  : `bg-white ${team.isUserTeam ? 'border-blue-300' : 'border-slate-200'}`
              }`}
            >
              {/* Card header row (expand toggle) */}
              <button
                type="button"
                onClick={() => toggleTeam(team.id)}
                aria-expanded={isExpanded}
                aria-controls={`team-detail-${team.id}`}
                className="w-full text-left p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  {/* Rank + grade */}
                  <div className="flex items-center gap-3 min-w-[100px]">
                    <span className={`text-sm font-bold w-6 text-center ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {displayRank}
                    </span>
                    <span className={`inline-flex items-center justify-center w-11 h-9 rounded-md border text-sm font-bold ${gradeClasses(team.grade)}`}>
                      {team.grade}
                    </span>
                  </div>

                  {/* Team identity */}
                  <div className="flex-1 min-w-[160px]">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{team.name}</span>
                      {team.isUserTeam && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-500 leading-none">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className={`text-xs mt-0.5 flex items-center gap-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      <span>{team.ownerName} • {formatRecord(team.record.wins, team.record.losses, team.record.ties)} • {team.ppg.toFixed(1)} PPG • {team.pointsAgainst.toFixed(1)} PA</span>
                      {team.recentFormPpg != null && team.trend !== 'steady' && (
                        <span
                          title={`Last 3 games: ${team.recentFormPpg.toFixed(1)} PPG`}
                          className={`font-semibold ${team.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}
                        >
                          {team.trend === 'up' ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Positional heat strip */}
                  <div className="flex items-center gap-1" aria-label={`${team.name} positional strength`}>
                    {team.positions.map((pos) => (
                      <span
                        key={pos.position}
                        title={`${pos.position}: ${pos.avgPoints.toFixed(1)} avg (${pos.deltaPct > 0 ? '+' : ''}${pos.deltaPct.toFixed(1)}% vs league)`}
                        className={`inline-flex items-center justify-center min-w-[34px] px-1 py-1 rounded border text-[10px] font-semibold ${heatCellClasses(pos.status, isDarkMode)}`}
                      >
                        {pos.position}
                      </span>
                    ))}
                  </div>

                  {/* Schedule chip */}
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold ${scheduleChipClasses(team.scheduleDifficulty.label, isDarkMode)}`}
                    title={
                      team.scheduleDifficulty.avgOpponentPpg != null
                        ? `Remaining opponents average ${team.scheduleDifficulty.avgOpponentPpg.toFixed(1)} PPG over ${team.scheduleDifficulty.remainingGames} games`
                        : 'No remaining regular-season games'
                    }
                  >
                    <Calendar className="w-3 h-3" aria-hidden="true" />
                    {team.scheduleDifficulty.label
                      ? `${team.scheduleDifficulty.label.charAt(0).toUpperCase()}${team.scheduleDifficulty.label.slice(1)} ROS`
                      : 'Season done'}
                  </span>

                  {/* Playoff odds bar */}
                  <div className="w-full sm:w-40">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-semibold uppercase tracking-wide ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        Playoff Odds
                      </span>
                      <span className={`text-xs font-bold ${oddsColor(team.playoffOdds)}`}>{team.playoffOdds}%</span>
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                      <div
                        className={`h-full ${oddsBarColor(team.playoffOdds)} transition-all duration-300`}
                        style={{ width: `${team.playoffOdds}%` }}
                      ></div>
                    </div>
                  </div>

                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''} ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
                    aria-hidden="true"
                  />
                </div>
              </button>

              {/* Expandable detail */}
              {isExpanded && (
                <div
                  id={`team-detail-${team.id}`}
                  className={`px-4 sm:px-5 pb-5 border-t pt-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}
                >
                  {/* Insight chips: projected PPG, record-vs-strength, biggest swing game */}
                  <div className="flex flex-wrap items-center gap-2 mb-5">
                    <span
                      title="Sum of current starters' this-week projections — a look-ahead PPG estimate for this roster, refreshed instantly on any roster change."
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-semibold ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                    >
                      <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Projected PPG</span>
                      <span className={isDarkMode ? 'text-white' : 'text-slate-900'}>{team.projectedPpg.toFixed(1)}</span>
                      {team.projectedPpgDelta !== 0 && (
                        <span className={team.projectedPpgDelta > 0 ? 'text-green-500' : 'text-red-500'}>
                          ({team.projectedPpgDelta > 0 ? '+' : ''}{team.projectedPpgDelta.toFixed(1)})
                        </span>
                      )}
                    </span>

                    <span
                      title={recordVsStrengthHint[team.recordVsStrength]}
                      className={`inline-flex items-center px-2.5 py-1.5 rounded-md border text-xs font-semibold ${recordVsStrengthClasses(team.recordVsStrength, isDarkMode)}`}
                    >
                      {recordVsStrengthLabel[team.recordVsStrength]}
                    </span>

                    {team.biggestSwingGame && (
                      <span
                        title={`The remaining matchup closest to a toss-up — highest-leverage result left on the schedule.`}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-semibold ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                      >
                        <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Biggest swing game</span>
                        <span className={isDarkMode ? 'text-white' : 'text-slate-900'}>
                          Wk {team.biggestSwingGame.week} vs {team.biggestSwingGame.opponentName} ({team.biggestSwingGame.opponentPpg.toFixed(1)} PPG)
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Narrative */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className={`text-[10px] font-semibold uppercase tracking-wide ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          Scouting Report
                        </h3>
                        {canViewAi && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isDarkMode ? 'bg-purple-500/15 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
                            <Sparkles className="w-2.5 h-2.5" aria-hidden="true" />
                            AI
                          </span>
                        )}
                      </div>
                      {!canViewAi ? (
                        <>
                          <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                            {team.narrative}
                          </p>
                          <button
                            type="button"
                            onClick={() => window.location.assign(isAuthenticated ? '/pricing' : '/login')}
                            className={`mt-2 text-xs font-medium underline ${isDarkMode ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'}`}
                          >
                            Unlock the AI scouting report →
                          </button>
                        </>
                      ) : !aiNarrative || aiNarrative.loading ? (
                        <div className="space-y-2">
                          <div className={`animate-pulse h-3 rounded ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
                          <div className={`animate-pulse h-3 rounded w-5/6 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
                          <div className={`animate-pulse h-3 rounded w-3/4 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
                        </div>
                      ) : aiNarrative.error ? (
                        <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{aiNarrative.error}</p>
                      ) : (
                        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          {aiNarrative.text}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                        <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                          Projected wins: <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{team.projectedWins.toFixed(1)}</span>
                        </span>
                        <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                          Points for: <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{team.pointsFor.toFixed(1)}</span>
                        </span>
                        <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                          Points against: <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{team.pointsAgainst.toFixed(1)}</span>
                        </span>
                      </div>
                    </div>

                    {/* Positional breakdown table */}
                    <div>
                      <h3 className={`text-[10px] font-semibold uppercase tracking-wide mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        Positional Breakdown
                      </h3>

                      {/* Point-share bar: % of this team's starter production by position */}
                      {team.positions.some((p) => p.pointShare > 0) && (
                        <div className="mb-3">
                          <div className="flex h-2.5 rounded-full overflow-hidden" aria-hidden="true">
                            {team.positions.filter((p) => p.pointShare > 0).map((pos) => (
                              <div
                                key={pos.position}
                                title={`${pos.position}: ${pos.pointShare.toFixed(0)}% of points`}
                                className={POS_COLORS[pos.position]?.split(' ')[0] || 'bg-slate-500/15'}
                                style={{ width: `${pos.pointShare}%` }}
                              />
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                            {team.positions.filter((p) => p.pointShare > 0).map((pos) => (
                              <span key={pos.position} className={`text-[10px] font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                <span className={`inline-block w-2 h-2 rounded-full mr-1 ${POS_COLORS[pos.position]?.split(' ')[0] || 'bg-slate-500/15'}`} />
                                {pos.position} {pos.pointShare.toFixed(0)}%
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className={`border-b text-left ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                              <th className={`py-1.5 pr-3 text-xs font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Pos</th>
                              <th className={`py-1.5 pr-3 text-xs font-semibold text-right ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Starters</th>
                              <th className={`py-1.5 pr-3 text-xs font-semibold text-right ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Team Avg</th>
                              <th className={`py-1.5 pr-3 text-xs font-semibold text-right ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>League Avg</th>
                              <th className={`py-1.5 pr-3 text-xs font-semibold text-right ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>vs League</th>
                              <th className={`py-1.5 text-xs font-semibold text-right ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>% Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {team.positions.map((pos) => (
                              <tr key={pos.position} className={`border-b last:border-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                <td className={`py-1.5 pr-3 font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{pos.position}</td>
                                <td className={`py-1.5 pr-3 text-right ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{pos.starterCount}</td>
                                <td className={`py-1.5 pr-3 text-right ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{pos.avgPoints.toFixed(1)}</td>
                                <td className={`py-1.5 pr-3 text-right ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{pos.leagueAvg.toFixed(1)}</td>
                                <td className={`py-1.5 pr-3 text-right font-semibold ${
                                  pos.status === 'surplus' ? 'text-green-500' : pos.status === 'deficit' ? 'text-red-500' : isDarkMode ? 'text-slate-400' : 'text-slate-500'
                                }`}>
                                  {pos.deltaPct > 0 ? '+' : ''}{pos.deltaPct.toFixed(1)}%
                                </td>
                                <td className={`py-1.5 text-right ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{pos.pointShare.toFixed(0)}%</td>
                              </tr>
                            ))}
                            {team.positions.length === 0 && (
                              <tr>
                                <td colSpan={6} className={`py-3 text-center text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                  No starter data yet — sync your league to populate rosters.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {teams.length === 0 && (
          <div className={`rounded-lg border p-12 text-center ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <BarChart3 className={`w-12 h-12 mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} aria-hidden="true" />
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              No teams found for this league. Sync your league from Settings to load teams and rosters.
            </p>
          </div>
        )}
      </div>

      {/* Footer legend */}
      {teams.length > 0 && (
        <div className={`rounded-lg border px-5 py-4 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Grades compare each team's points per game to the league average. Positional cells are green when starters outproduce the league average at that position by 10%+ and red when they trail it by 10%+.
            Playoff odds come from {(5000).toLocaleString()} Monte Carlo simulations of the remaining schedule ({positionColumns.length > 0 ? `${analysis.league.scoringFormat.toUpperCase()} scoring` : 'league scoring'}).
          </p>
        </div>
      )}
    </div>
  );
}
