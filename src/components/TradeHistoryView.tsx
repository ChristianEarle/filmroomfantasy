import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  History,
  ChevronDown,
  ChevronRight,
  ArrowRightLeft,
  Loader2,
  AlertCircle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Crown,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLeaguesContext } from '../context/LeaguesContext';

interface TradeHistoryViewProps {
  isDarkMode: boolean;
}

interface TradeSidePlayer {
  playerId: string | null;
  name: string;
  position: string;
  nflTeam: string;
  pickYear: number | null;
  pickRound: number | null;
}

interface TradeSide {
  teamId: string;
  teamName: string;
  sent: TradeSidePlayer[];
}

interface PlayerOutcome {
  playerId: string;
  playerName: string;
  position: string;
  totalPoints: number;
  startedPoints: number | null;
  starterWeeks: number | null;
  weeklyPoints: Array<{ week: number; points: number }>;
}

interface TradeOutcomeSide {
  teamId: string;
  teamName: string;
  sent: PlayerOutcome[];
  received: PlayerOutcome[];
  sentTotal: number;
  receivedTotal: number;
  differential: number;
  lineupDifferential: number | null;
}

interface TradeOutcome {
  tradeId: string;
  executedAt: string | null;
  weekExecuted: number | null;
  sides: TradeOutcomeSide[];
}

interface HistoricalTrade {
  id: string;
  source: string;
  externalId: string | null;
  executedAt: string | null;
  seasonYear: number | null;
  weekExecuted: number | null;
  aiGrade: string | null;
  aiFairnessScore: number | null;
  aiGradedAt: string | null;
  aiAnalysis: {
    winner: string;
    winnerExplanation: string;
    teamGrades: Array<{ team: string; grade: string; summary: string }>;
  } | null;
  sides: TradeSide[];
  outcome: TradeOutcome | null;
}

interface RecordImpact {
  leagueId: string;
  teamId: string;
  seasonYear: number;
  actualRecord: { wins: number; losses: number; ties: number };
  hypotheticalRecord: { wins: number; losses: number; ties: number };
  flippedWeeks: Array<{
    week: number;
    actualResult: 'W' | 'L' | 'T';
    hypotheticalResult: 'W' | 'L' | 'T';
    actualScore: number;
    hypotheticalScore: number;
    opponentScore: number;
  }>;
  totalPointDifferential: number;
}

const LEAGUE_SELECTION_KEY = 'filmroom.tradeAnalyzer.selectedLeagueId';

export function TradeHistoryView({ isDarkMode }: TradeHistoryViewProps) {
  const { user } = useAuth();
  const { leagues } = useLeaguesContext();

  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(() => {
    try {
      return localStorage.getItem(LEAGUE_SELECTION_KEY) || '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    try {
      if (selectedLeagueId) localStorage.setItem(LEAGUE_SELECTION_KEY, selectedLeagueId);
    } catch {
      // ignore
    }
  }, [selectedLeagueId]);

  const [trades, setTrades] = useState<HistoricalTrade[]>([]);
  const [impacts, setImpacts] = useState<RecordImpact[]>([]);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [callerTeamName, setCallerTeamName] = useState<string | null>(null);
  const [callerTeamId, setCallerTeamId] = useState<string | null>(null);
  const [callerWarning, setCallerWarning] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestNotice, setIngestNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [gradingId, setGradingId] = useState<string | null>(null);

  const gradingAllowed =
    !!user &&
    (user.subscriptionTier === 'pro' || user.subscriptionTier === 'elite');

  // fetchAll is parameterized so the caller can pass an explicit
  // league id — used by handleIngest/handleGrade so they refresh
  // against the league they KICKED OFF against, not whatever the
  // user has since switched to. The leading-edge cancellation token
  // (`isMounted` in the effect below) guards against stale responses
  // overwriting newer data when the user switches leagues rapidly.
  const fetchAll = useCallback(
    async (
      leagueIdArg: string = selectedLeagueId,
      seasonArg: number | null = selectedSeason,
      { isCancelled }: { isCancelled?: () => boolean } = {}
    ) => {
      if (!leagueIdArg) {
        setTrades([]);
        setImpacts([]);
        setSeasons([]);
        setCallerTeamName(null);
        setCallerTeamId(null);
        setCallerWarning(null);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const seasonQuery = seasonArg != null ? `&season=${seasonArg}` : '';
        const [historyRes, impactRes] = await Promise.all([
          api.get<{
            trades: HistoricalTrade[];
            seasons: number[];
            callerTeamId: string;
            callerTeamName: string;
            callerResolutionStrategy?: string;
            callerResolutionWarning?: string | null;
          }>(
            `/trade-history/history?leagueId=${leagueIdArg}${seasonQuery}`
          ),
          api
            .get<{ impact: RecordImpact | null; impacts: RecordImpact[] }>(
              `/trade-history/record-impact/${leagueIdArg}`
            )
            .catch(() => ({ impact: null, impacts: [] as RecordImpact[] })),
        ]);
        if (isCancelled?.()) return;
        setTrades(historyRes.trades);
        setCallerWarning(historyRes.callerResolutionWarning ?? null);
        // Defensive sort: newest season first, regardless of backend order.
        setSeasons([...historyRes.seasons].sort((a, b) => b - a));
        setCallerTeamName(historyRes.callerTeamName);
        setCallerTeamId(historyRes.callerTeamId ?? null);
        setImpacts(impactRes.impacts);
      } catch (err) {
        if (isCancelled?.()) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load trade history.'
        );
      } finally {
        if (!isCancelled?.()) setIsLoading(false);
      }
    },
    [selectedLeagueId, selectedSeason]
  );

  // Fetch whenever (league, season) changes. Guarded with a
  // cancellation token so stale responses are dropped if the user
  // switches leagues or seasons while a request is in flight.
  useEffect(() => {
    let cancelled = false;
    fetchAll(selectedLeagueId, selectedSeason, { isCancelled: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [fetchAll, selectedLeagueId, selectedSeason]);

  // When the league changes, clear any per-league transient UI state
  // (season filter, ingest notice, error) so the user doesn't see a
  // stale message from the previous league.
  useEffect(() => {
    setSelectedSeason(null);
    setIngestNotice(null);
    setError(null);
    setExpanded(new Set());
  }, [selectedLeagueId]);

  const handleIngest = async () => {
    if (!selectedLeagueId) return;
    // Capture the league id at click time so a mid-request league
    // switch doesn't cause us to refresh or show a notice for the
    // wrong league.
    const leagueIdAtStart = selectedLeagueId;
    setIsIngesting(true);
    setIngestNotice(null);
    try {
      const res = await api.post<{
        stats: {
          fetched: number;
          trades: number;
          inserted: number;
          updated: number;
          skipped: number;
          errors: number;
          skipReasons: Record<string, number>;
          unmappedRosterIds: number[];
          tradeStatusCounts: Record<string, number>;
          weeklyTradeBreakdown: Record<number, number>;
          totalRawTransactions: number;
        };
      }>(`/trade-history/ingest/${leagueIdAtStart}`);
      // Bail if the user switched leagues while the ingest was in
      // flight — the result belongs to a league we're no longer on.
      if (selectedLeagueId !== leagueIdAtStart) return;
      await fetchAll(leagueIdAtStart, selectedSeason);
      // Build a compact notice so the user can see exactly what happened
      const s = res.stats;
      const parts: string[] = [];
      parts.push(
        `Sleeper returned ${s.totalRawTransactions} total transactions, ` +
        `${s.trades} accepted as trades (${s.inserted} new, ${s.updated} updated)`
      );
      const weekBreakdown = s.weeklyTradeBreakdown
        ? Object.entries(s.weeklyTradeBreakdown)
            .map(([w, n]) => [parseInt(w, 10), n] as [number, number])
            .sort((a, b) => a[0] - b[0])
            .map(([w, n]) => `W${w}: ${n}`)
            .join(', ')
        : '';
      if (weekBreakdown) {
        parts.push(`Per-week trades → ${weekBreakdown}`);
      }
      const statusBreakdown = s.tradeStatusCounts
        ? Object.entries(s.tradeStatusCounts)
            .map(([status, n]) => `${status}: ${n}`)
            .join(', ')
        : '';
      if (statusBreakdown) {
        parts.push(`Statuses → ${statusBreakdown}`);
      }
      if (s.skipped > 0) {
        const reasonStr = Object.entries(s.skipReasons || {})
          .map(([reason, n]) => `${reason}: ${n}`)
          .join(', ');
        parts.push(
          `${s.skipped} skipped${reasonStr ? ` (${reasonStr})` : ''}`
        );
      }
      if (s.errors > 0) {
        parts.push(`${s.errors} errors (check server logs)`);
      }
      if (s.unmappedRosterIds && s.unmappedRosterIds.length > 0) {
        parts.push(
          `Roster ids without team mapping: ${s.unmappedRosterIds.join(', ')}. Re-sync the league from Settings to backfill team owners.`
        );
      }
      // Same staleness guard before surfacing the notice.
      if (selectedLeagueId !== leagueIdAtStart) return;
      setIngestNotice(parts.join(' • '));
    } catch (err) {
      if (selectedLeagueId !== leagueIdAtStart) return;
      setError(
        err instanceof Error ? err.message : 'Ingest failed.'
      );
    } finally {
      if (selectedLeagueId === leagueIdAtStart) setIsIngesting(false);
    }
  };

  const handleGrade = async (tradeId: string) => {
    if (!gradingAllowed) return;
    const leagueIdAtStart = selectedLeagueId;
    setGradingId(tradeId);
    try {
      await api.post(`/trade-history/grade/${tradeId}`);
      if (selectedLeagueId !== leagueIdAtStart) return;
      await fetchAll(leagueIdAtStart, selectedSeason);
    } catch (err) {
      if (selectedLeagueId !== leagueIdAtStart) return;
      setError(err instanceof Error ? err.message : 'Grading failed.');
    } finally {
      if (selectedLeagueId === leagueIdAtStart) setGradingId(null);
    }
  };

  const toggleExpand = (tradeId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(tradeId)) next.delete(tradeId);
      else next.add(tradeId);
      return next;
    });
  };

  // Per-season headline for each impact card
  const headlineFor = (im: RecordImpact): string => {
    const a = im.actualRecord;
    const h = im.hypotheticalRecord;
    const winDelta = a.wins - h.wins;
    if (winDelta > 0) {
      return `Your trades flipped ${winDelta} ${
        winDelta === 1 ? 'loss' : 'losses'
      } into wins.`;
    } else if (winDelta < 0) {
      return `Your trades cost you ${Math.abs(winDelta)} ${
        Math.abs(winDelta) === 1 ? 'win' : 'wins'
      }.`;
    }
    return 'Your trades had no net impact on your record.';
  };

  // When a specific season tab is selected, only show that season's
  // impact card. Otherwise show every season the user has trades in.
  const visibleImpacts = useMemo(() => {
    if (selectedSeason == null) return impacts;
    return impacts.filter((im) => im.seasonYear === selectedSeason);
  }, [impacts, selectedSeason]);

  // ── Computed stats for the summary strip ────────────────────────
  const tradeStats = useMemo(() => {
    if (trades.length === 0) return null;

    const total = trades.length;

    // Win/loss uses the caller's outcome differential
    let wins = 0;
    let losses = 0;
    const tradePartners = new Set<string>();

    // Grade distribution
    const gradeLetters: string[] = [];
    let bestTrade: { label: string; pts: number } | null = null;
    let worstTrade: { label: string; pts: number } | null = null;

    for (const t of trades) {
      // Find the caller's outcome side (same fallback as card rendering)
      const callerSide = t.outcome?.sides.find((s) => s.teamId === callerTeamId)
        ?? t.outcome?.sides.find((s) => callerTeamName != null && s.teamName === callerTeamName)
        ?? null;
      if (callerSide) {
        const diff = callerSide.lineupDifferential ?? callerSide.differential;
        if (diff > 0) wins++;
        else if (diff < 0) losses++;

        // Best & worst by points
        const label =
          callerSide.sent.length > 0
            ? `Gave ${callerSide.sent[0].playerName}`
            : callerSide.received.length > 0
            ? `Got ${callerSide.received[0].playerName}`
            : `Trade`;
        if (!bestTrade || diff > bestTrade.pts) bestTrade = { label, pts: diff };
        if (!worstTrade || diff < worstTrade.pts) worstTrade = { label, pts: diff };
      }

      // Trade partners
      for (const side of t.sides) {
        if (side.teamId !== callerTeamId) tradePartners.add(side.teamName);
      }

      // Grades
      if (t.aiGrade) gradeLetters.push(t.aiGrade);
    }

    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    // Average grade (convert to numeric, average, convert back)
    const gradeMap: Record<string, number> = {
      'A+': 12, A: 11, 'A-': 10, 'B+': 9, B: 8, 'B-': 7,
      'C+': 6, C: 5, 'C-': 4, 'D+': 3, D: 2, 'D-': 1, F: 0,
    };
    const reverseGrade = ['F', 'D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];
    let avgGrade: string | null = null;
    if (gradeLetters.length > 0) {
      const sum = gradeLetters.reduce((s, g) => s + (gradeMap[g] ?? 5), 0);
      const avg = Math.round(sum / gradeLetters.length);
      avgGrade = reverseGrade[Math.min(avg, 12)] ?? 'C';
    }
    const aTier = gradeLetters.filter((g) => g.startsWith('A')).length;
    const cTier = gradeLetters.filter((g) => g.startsWith('C') || g.startsWith('D') || g === 'F').length;

    return {
      total,
      partners: tradePartners.size,
      wins,
      losses,
      winRate,
      avgGrade,
      aTier,
      cTier,
      bestTrade,
      worstTrade,
    };
  }, [trades, callerTeamId]);

  // ── Search + filter for trades ──────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [tradeFilter, setTradeFilter] = useState<'all' | 'wins' | 'losses' | string>('all');
  const [tradeSort, setTradeSort] = useState<'recent' | 'oldest' | 'impact'>('recent');

  const filteredTrades = useMemo(() => {
    let result = [...trades];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) =>
        t.sides.some((s) =>
          s.sent.some((p) => p.name.toLowerCase().includes(q)) ||
          s.teamName.toLowerCase().includes(q)
        ) ||
        (t.weekExecuted != null && `week ${t.weekExecuted}`.includes(q)) ||
        (t.weekExecuted != null && `wk ${t.weekExecuted}`.includes(q))
      );
    }

    // Helper: find the caller's outcome side using the same
    // ID-then-name fallback as the card rendering so the filter
    // matches what's displayed.
    const findCallerSide = (t: HistoricalTrade) => {
      return t.outcome?.sides.find((s) => s.teamId === callerTeamId)
        ?? t.outcome?.sides.find((s) => callerTeamName != null && s.teamName === callerTeamName)
        ?? null;
    };
    const callerDiffFor = (t: HistoricalTrade) => {
      const side = findCallerSide(t);
      return side ? (side.lineupDifferential ?? side.differential) : 0;
    };

    // Filter
    if (tradeFilter === 'wins') {
      result = result.filter((t) => callerDiffFor(t) > 0);
    } else if (tradeFilter === 'losses') {
      result = result.filter((t) => callerDiffFor(t) < 0);
    } else if (tradeFilter.endsWith('-tier')) {
      const letter = tradeFilter.replace('-tier', '').toUpperCase();
      result = result.filter((t) => t.aiGrade?.startsWith(letter));
    }

    // Sort
    if (tradeSort === 'oldest') {
      result.sort((a, b) => new Date(a.executedAt ?? '').getTime() - new Date(b.executedAt ?? '').getTime());
    } else if (tradeSort === 'impact') {
      result.sort((a, b) => Math.abs(callerDiffFor(b)) - Math.abs(callerDiffFor(a)));
    } else {
      result.sort((a, b) => new Date(b.executedAt ?? '').getTime() - new Date(a.executedAt ?? '').getTime());
    }

    return result;
  }, [trades, searchQuery, tradeFilter, tradeSort, callerTeamId]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header + league/season selectors (compact row) */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDarkMode ? 'bg-blue-600/20' : 'bg-blue-50'
            }`}
          >
            <History
              className={`w-5 h-5 ${
                isDarkMode ? 'text-blue-400' : 'text-blue-600'
              }`}
            />
          </div>
          <div>
            <h1
              className={`text-xl font-bold ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              Your Trade History
            </h1>
            <p
              className={`text-sm ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Every trade {callerTeamName ? <><b className={isDarkMode ? 'text-white' : 'text-slate-900'}>{callerTeamName}</b> made</> : 'you made'} this
              season — with real outcomes and AI post-mortems.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* League selector pill */}
          <div className="relative">
            <select
              id="trade-history-league-select"
              value={selectedLeagueId}
              onChange={(e) => setSelectedLeagueId(e.target.value)}
              className={`appearance-none pr-8 pl-3 py-2 text-sm font-semibold rounded-lg border transition-colors cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-900 border-slate-700 text-white hover:border-slate-600'
                  : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300'
              } outline-none`}
            >
              <option value="">Select a league...</option>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.platform ? ` · ${l.platform}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown
              className={`absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            />
          </div>

          {/* Season selector pill */}
          {seasons.length > 1 && (
            <div className="relative">
              <select
                value={selectedSeason ?? ''}
                onChange={(e) => setSelectedSeason(e.target.value ? Number(e.target.value) : null)}
                className={`appearance-none pr-8 pl-3 py-2 text-sm font-semibold rounded-lg border transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'bg-slate-900 border-slate-700 text-white hover:border-slate-600'
                    : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300'
                } outline-none`}
              >
                <option value="">All Seasons</option>
                {seasons.map((s) => (
                  <option key={s} value={s}>{s} Season</option>
                ))}
              </select>
              <ChevronDown
                className={`absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              />
            </div>
          )}

          {/* Re-sync button */}
          {selectedLeagueId && (
            <button
              type="button"
              onClick={handleIngest}
              disabled={isIngesting}
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg font-semibold transition-colors ${
                isDarkMode
                  ? 'bg-slate-900 border border-slate-700 text-white hover:border-slate-600'
                  : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
              } ${isIngesting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isIngesting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Re-sync
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border ${
            isDarkMode
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : 'bg-red-50 border-red-200 text-red-600'
          }`}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {ingestNotice && !error && (
        <div
          className={`flex items-start gap-3 p-3 rounded-xl border ${
            isDarkMode
              ? 'bg-blue-500/10 border-blue-500/20 text-blue-200'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="text-xs">{ingestNotice}</p>
        </div>
      )}

      {callerWarning && !error && (
        <div
          className={`flex items-start gap-3 p-3 rounded-xl border ${
            isDarkMode
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-200'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="text-xs">{callerWarning}</p>
        </div>
      )}

      {/* Stats strip (5 cards) */}
      {tradeStats && trades.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Total Trades', value: String(tradeStats.total), sub: `${tradeStats.partners} trade partner${tradeStats.partners === 1 ? '' : 's'}` },
            { label: 'Trade Win Rate', value: `${tradeStats.winRate}%`, sub: `${tradeStats.wins}W · ${tradeStats.losses}L` },
            { label: 'Avg AI Grade', value: tradeStats.avgGrade ?? '—', sub: tradeStats.avgGrade ? `${tradeStats.aTier} A-tier · ${tradeStats.cTier} C-tier` : 'No grades yet' },
            { label: 'Best Trade', value: tradeStats.bestTrade?.label ?? '—', sub: tradeStats.bestTrade ? `${tradeStats.bestTrade.pts > 0 ? '+' : ''}${tradeStats.bestTrade.pts.toFixed(1)} pts` : '', color: 'text-emerald-500' },
            { label: 'Worst Trade', value: tradeStats.worstTrade?.label ?? '—', sub: tradeStats.worstTrade ? `${tradeStats.worstTrade.pts > 0 ? '+' : ''}${tradeStats.worstTrade.pts.toFixed(1)} pts` : '', color: 'text-red-500' },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-xl border p-4 ${
                isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
              }`}
            >
              <div className={`fr-text-10 uppercase fr-tracking-wider font-bold mb-2 ${
                isDarkMode ? 'text-slate-500' : 'text-slate-500'
              }`}>
                {stat.label}
              </div>
              <div className={`text-2xl font-extrabold leading-none ${stat.color ?? (isDarkMode ? 'text-white' : 'text-slate-900')}`}>
                {stat.value}
              </div>
              {stat.sub && (
                <div className={`fr-text-11 mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {stat.sub}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Per-season impact: 2-panel (left=headline+bars, right=flipped weeks) */}
      {visibleImpacts.length > 0 && (
        <div className="space-y-3">
          {visibleImpacts.map((im) => {
            const actualW = im.actualRecord.wins;
            const actualL = im.actualRecord.losses;
            const hypoW = im.hypotheticalRecord.wins;
            const hypoL = im.hypotheticalRecord.losses;
            const totalGames = Math.max(actualW + actualL, hypoW + hypoL, 1);
            const netPts = -im.totalPointDifferential;
            const netPtsLabel = `${netPts >= 0 ? '+' : ''}${(Math.round(netPts * 10) / 10).toFixed(1)} pts`;

            return (
              <div key={im.seasonYear} className="fr-home-row">
                {/* LEFT: Season Impact */}
                <div
                  className={`rounded-xl border p-6 ${
                    isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className={`fr-text-11 uppercase fr-tracking-wider font-bold mb-2 ${
                    isDarkMode ? 'text-blue-400' : 'text-blue-600'
                  }`}>
                    <Sparkles className="w-3 h-3 inline mr-1" style={{ verticalAlign: '-1px' }} />
                    Season Impact · {im.seasonYear}
                  </div>
                  <h2 className={`text-xl font-extrabold leading-tight mb-2 ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    {headlineFor(im)}
                  </h2>
                  <p className={`text-sm mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    You went {actualW}-{actualL}, but had you stood pat you'd have finished {hypoW}-{hypoL}. Points alone don't tell the whole story — open any trade for the AI post-mortem.
                  </p>

                  {/* Record comparison bars */}
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-3">
                      <span className={`fr-text-10 uppercase fr-tracking-wider font-bold w-20 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Actual</span>
                      <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: isDarkMode ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max((actualW / totalGames) * 100, 2)}%`,
                            background: 'rgb(239,68,68)',
                          }}
                        />
                      </div>
                      <span className={`text-sm font-bold w-10 text-right ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {actualW}-{actualL}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`fr-text-10 uppercase fr-tracking-wider font-bold w-20 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>If never traded</span>
                      <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: isDarkMode ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max((hypoW / totalGames) * 100, 2)}%`,
                            background: 'rgb(34,197,94)',
                          }}
                        />
                      </div>
                      <span className={`text-sm font-bold w-10 text-right ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {hypoW}-{hypoL}
                      </span>
                    </div>
                  </div>

                  <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Net points from trading:{' '}
                    <span className={`font-bold ${netPts >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {netPtsLabel}
                    </span>
                  </div>
                </div>

                {/* RIGHT: Flipped Weeks */}
                <div
                  className={`rounded-xl border p-6 ${
                    isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                      <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        Flipped Weeks
                      </span>
                    </div>
                    <span className={`fr-text-11 font-semibold px-2 py-0.5 rounded ${
                      isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {im.flippedWeeks.length} this season
                    </span>
                  </div>

                  {im.flippedWeeks.length === 0 ? (
                    <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      No weeks where trading flipped the outcome.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {im.flippedWeeks.map((fw) => {
                        const flippedGood =
                          fw.actualResult === 'W' ||
                          (fw.actualResult === 'T' && fw.hypotheticalResult === 'L');
                        return (
                          <div
                            key={fw.week}
                            className={`rounded-lg border p-3 ${
                              isDarkMode
                                ? flippedGood
                                  ? 'bg-emerald-500/5 border-emerald-500/20'
                                  : 'bg-red-500/10 border-red-500/20'
                                : flippedGood
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-red-50 border-red-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                Week {fw.week}{' '}
                                <span className={flippedGood ? 'text-emerald-500' : 'text-red-500'}>
                                  {fw.hypotheticalResult} → {fw.actualResult}
                                </span>
                              </span>
                            </div>
                            <div className={`fr-text-11 mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              Actual: <b className={isDarkMode ? 'text-white' : 'text-slate-900'}>{fw.actualScore.toFixed(1)}</b>
                              {' · '}Hypothetical: <b className={isDarkMode ? 'text-white' : 'text-slate-900'}>{fw.hypotheticalScore.toFixed(1)}</b>
                              {' → '}<b className={isDarkMode ? 'text-white' : 'text-slate-900'}>{fw.opponentScore.toFixed(1)}</b>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Search + filter bar */}
      {trades.length > 0 && !isLoading && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by player name, opponent, or week..."
              className={`w-full pl-8 pr-3 py-2 text-sm rounded-lg border transition-colors outline-none ${
                isDarkMode
                  ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500'
                  : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
              }`}
            />
            <svg className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1 flex-wrap">
            {[
              { key: 'all', label: `All ${trades.length}` },
              { key: 'wins', label: `Wins ${tradeStats?.wins ?? 0}` },
              { key: 'losses', label: `Losses ${tradeStats?.losses ?? 0}` },
              { key: 'a-tier', label: 'A-tier' },
              { key: 'b-tier', label: 'B-tier' },
              { key: 'c-tier', label: 'C-tier' },
              { key: 'd-tier', label: 'D-tier' },
            ].map((pill) => (
              <button
                key={pill.key}
                type="button"
                onClick={() => setTradeFilter(pill.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  tradeFilter === pill.key
                    ? 'bg-blue-600 text-white'
                    : isDarkMode
                    ? 'bg-slate-900 border border-slate-700 text-slate-300 hover:border-slate-600'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="relative flex-shrink-0">
            <select
              value={tradeSort}
              onChange={(e) => setTradeSort(e.target.value as 'recent' | 'oldest' | 'impact')}
              className={`appearance-none pr-7 pl-2 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-900 border-slate-700 text-white'
                  : 'bg-white border-slate-200 text-slate-900'
              } outline-none`}
            >
              <option value="recent">Most Recent</option>
              <option value="oldest">Oldest First</option>
              <option value="impact">Biggest Impact</option>
            </select>
            <ChevronDown className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
          </div>
        </div>
      )}

      {/* Trades list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2
            className={`w-6 h-6 animate-spin ${
              isDarkMode ? 'text-blue-400' : 'text-blue-600'
            }`}
          />
        </div>
      ) : trades.length === 0 && selectedLeagueId ? (
        <div
          className={`rounded-xl border p-8 text-center ${
            isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <p
            className={`text-sm ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            No trades yet. Sleeper trades will show up here after the next
            league sync.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTrades.map((t) => {
            const isOpen = expanded.has(t.id);
            const dateStr = t.executedAt
              ? new Date(t.executedAt).toLocaleDateString()
              : 'Unknown date';

            // Match the caller's side by ID first, then by team name as
            // a fallback (handles duplicate team rows where trade items
            // are attributed to a different ID than the primary).
            const callerOutcome = t.outcome?.sides.find(s => s.teamId === callerTeamId)
              ?? t.outcome?.sides.find(s => callerTeamName != null && s.teamName === callerTeamName)
              ?? null;
            // Prefer lineup-adjusted differential when available
            const callerDiff = callerOutcome
              ? (callerOutcome.lineupDifferential ?? callerOutcome.differential)
              : 0;
            const hasLineupData = callerOutcome?.lineupDifferential != null;

            // Derive what the caller sent and received from the trade sides.
            // Same ID-then-name fallback for the display sides.
            const matchedCallerId = callerOutcome?.teamId;
            const callerSide = matchedCallerId
              ? t.sides.find(s => s.teamId === matchedCallerId)
              : t.sides.find(s => s.teamId === callerTeamId)
                ?? t.sides.find(s => callerTeamName != null && s.teamName === callerTeamName);
            const callerSideId = callerSide?.teamId;
            const otherSides = t.sides.filter(s => s.teamId !== callerSideId);
            const youSent = callerSide?.sent || [];

            // "You got": what the caller actually received.
            // For 2-team trades, otherSides[0].sent is correct.
            // For 3+ team trades, that would include items going to
            // third parties. Use callerOutcome.received (authoritative)
            // for the player list, plus any picks from other sides
            // (picks aren't tracked in outcome since they don't score).
            let youGot: TradeSidePlayer[];
            if (callerOutcome && t.sides.length > 2) {
              const gotPlayers: TradeSidePlayer[] = callerOutcome.received.map((r) => ({
                playerId: r.playerId,
                name: r.playerName,
                position: r.position,
                nflTeam: '',
                pickYear: null,
                pickRound: null,
              }));
              // Picks: best-effort from other sides (destination not
              // tracked per asset in the sides model)
              const gotPicks = otherSides.flatMap((s) =>
                s.sent.filter((p) => p.pickYear != null)
              );
              youGot = [...gotPlayers, ...gotPicks];
            } else {
              youGot = otherSides.flatMap((s) => s.sent);
            }

            // Win / Loss / Even label
            const verdict = callerDiff > 0 ? 'W' : callerDiff < 0 ? 'L' : 'E';
            const borderColor = callerOutcome
              ? callerDiff > 0
                ? isDarkMode ? 'border-l-emerald-500' : 'border-l-emerald-500'
                : callerDiff < 0
                ? isDarkMode ? 'border-l-red-500' : 'border-l-red-500'
                : isDarkMode ? 'border-l-slate-600' : 'border-l-slate-300'
              : isDarkMode ? 'border-l-slate-700' : 'border-l-slate-200';

            return (
              <div
                key={t.id}
                className={`rounded-xl border border-l-4 overflow-hidden ${borderColor} ${
                  isDarkMode
                    ? 'bg-slate-900/50 border-slate-700'
                    : 'bg-white border-slate-200'
                }`}
              >
                {/* ── Collapsed header ── */}
                <button
                  type="button"
                  onClick={() => toggleExpand(t.id)}
                  aria-expanded={isOpen}
                  aria-label={`Trade from ${dateStr}. ${isOpen ? 'Collapse' : 'Expand'} details.`}
                  className={`w-full flex items-center gap-3 p-4 text-left transition-colors ${
                    isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Win/Loss badge */}
                  {callerOutcome ? (
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center ${
                      callerDiff > 0
                        ? isDarkMode ? 'bg-emerald-500/15' : 'bg-emerald-50'
                        : callerDiff < 0
                        ? isDarkMode ? 'bg-red-500/15' : 'bg-red-50'
                        : isDarkMode ? 'bg-slate-800' : 'bg-slate-100'
                    }`}>
                      <span className={`text-sm font-black leading-none ${
                        callerDiff > 0 ? 'text-emerald-500' : callerDiff < 0 ? 'text-red-500' : isDarkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        {verdict}
                      </span>
                      <span className={`fr-text-9 font-bold leading-tight mt-0.5 ${
                        callerDiff > 0 ? 'text-emerald-500' : callerDiff < 0 ? 'text-red-500' : isDarkMode ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        {callerDiff > 0 ? '+' : ''}{Math.round(callerDiff * 10) / 10}
                      </span>
                    </div>
                  ) : (
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                      isDarkMode ? 'bg-slate-800' : 'bg-slate-100'
                    }`}>
                      <ArrowRightLeft className={`w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                    </div>
                  )}

                  {/* Trade summary — chip style */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`fr-text-10 uppercase fr-tracking-wider font-bold flex-shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                        You gave
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {youSent.map((p, pi) => (
                          <span key={pi} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                            isDarkMode ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {p.position && !p.pickYear && (
                              <span className={`fr-text-9 font-bold px-1 py-0.5 rounded ${
                                p.position === 'QB' ? 'bg-red-500/15 text-red-400' :
                                p.position === 'RB' ? 'bg-green-500/15 text-green-400' :
                                p.position === 'WR' ? 'bg-blue-500/15 text-blue-400' :
                                p.position === 'TE' ? 'bg-amber-500/15 text-amber-400' :
                                'bg-amber-500/15 text-amber-400'
                              }`}>{p.pickYear ? 'PICK' : p.position}</span>
                            )}
                            {p.pickYear && (
                              <span className={`fr-text-9 font-bold px-1 py-0.5 rounded ${isDarkMode ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>PICK</span>
                            )}
                            {p.name || `${p.pickYear} ${p.pickRound === 1 ? '1st' : p.pickRound === 2 ? '2nd' : p.pickRound === 3 ? '3rd' : `${p.pickRound}th`}`}
                          </span>
                        ))}
                      </div>

                      <span className={`fr-text-10 uppercase fr-tracking-wider font-bold flex-shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                        You got
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {youGot.map((p, pi) => (
                          <span key={pi} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                            isDarkMode ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {p.position && !p.pickYear && (
                              <span className={`fr-text-9 font-bold px-1 py-0.5 rounded ${
                                p.position === 'QB' ? 'bg-red-500/15 text-red-400' :
                                p.position === 'RB' ? 'bg-green-500/15 text-green-400' :
                                p.position === 'WR' ? 'bg-blue-500/15 text-blue-400' :
                                p.position === 'TE' ? 'bg-amber-500/15 text-amber-400' :
                                'bg-amber-500/15 text-amber-400'
                              }`}>{p.position}</span>
                            )}
                            {p.pickYear && (
                              <span className={`fr-text-9 font-bold px-1 py-0.5 rounded ${isDarkMode ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>PICK</span>
                            )}
                            {p.name || `${p.pickYear} ${p.pickRound === 1 ? '1st' : p.pickRound === 2 ? '2nd' : p.pickRound === 3 ? '3rd' : `${p.pickRound}th`}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Grade badge */}
                  {t.aiGrade && (
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-black ${
                      t.aiGrade.startsWith('A') ? isDarkMode ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700' :
                      t.aiGrade.startsWith('B') ? isDarkMode ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-700' :
                      t.aiGrade.startsWith('C') ? isDarkMode ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700' :
                      isDarkMode ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-700'
                    }`}>
                      {t.aiGrade}
                    </div>
                  )}

                  {/* Date + opponent */}
                  <div className={`flex-shrink-0 text-right fr-text-11 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    <div className="font-semibold">{dateStr}{t.weekExecuted ? ` · Wk ${t.weekExecuted}` : ''}</div>
                    {otherSides.length > 0 && (
                      <div>vs {otherSides.map(s => s.teamName).join(', ')}</div>
                    )}
                  </div>

                  {isOpen ? (
                    <ChevronDown className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  ) : (
                    <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  )}
                </button>

                {/* ── Expanded details ── */}
                {isOpen && (
                  <div className={`px-4 pb-4 border-t ${
                    isDarkMode ? 'border-slate-800' : 'border-slate-100'
                  }`}>
                    {/* Verdict banner */}
                    {callerOutcome && (
                      <div className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${
                        callerDiff > 0
                          ? isDarkMode ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'
                          : callerDiff < 0
                          ? isDarkMode ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'
                          : isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'
                      }`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          callerDiff > 0
                            ? isDarkMode ? 'bg-emerald-500/20' : 'bg-emerald-100'
                            : callerDiff < 0
                            ? isDarkMode ? 'bg-red-500/20' : 'bg-red-100'
                            : isDarkMode ? 'bg-slate-700' : 'bg-slate-200'
                        }`}>
                          {callerDiff > 0 ? (
                            <TrendingUp className="w-5 h-5 text-emerald-500" />
                          ) : callerDiff < 0 ? (
                            <TrendingDown className="w-5 h-5 text-red-500" />
                          ) : (
                            <ArrowRightLeft className={`w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                          )}
                        </div>
                        <div>
                          <p className={`text-lg font-bold ${
                            callerDiff > 0
                              ? isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                              : callerDiff < 0
                              ? isDarkMode ? 'text-red-400' : 'text-red-700'
                              : isDarkMode ? 'text-slate-300' : 'text-slate-700'
                          }`}>
                            {callerDiff > 0
                              ? `You won this trade (+${callerDiff} pts)`
                              : callerDiff < 0
                              ? `You lost this trade (${callerDiff} pts)`
                              : 'Even trade'}
                          </p>
                          <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {hasLineupData
                              ? 'Based on starter production'
                              : `Received ${callerOutcome.receivedTotal} — Sent ${callerOutcome.sentTotal}`}
                            {t.weekExecuted ? ` · Since Week ${t.weekExecuted + 1}` : ''}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Two-column Sent vs Received from caller's perspective */}
                    {t.outcome && callerOutcome && (
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        {/* You Sent */}
                        <div className={`p-3 rounded-lg ${
                          isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'
                        }`}>
                          <p className={`text-[10px] font-bold uppercase mb-2 ${
                            isDarkMode ? 'text-red-400/70' : 'text-red-500/60'
                          }`}>
                            You Sent
                          </p>
                          <div className="space-y-1.5">
                            {callerOutcome.sent.map((p) => (
                              <div key={p.playerId} className="text-xs">
                                <div className="flex items-baseline justify-between gap-1">
                                  <span className={`font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {p.playerName}
                                  </span>
                                  <span className={`tabular-nums font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {p.totalPoints}
                                  </span>
                                </div>
                                <div className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                  {p.position}
                                  {p.startedPoints != null && p.startedPoints !== p.totalPoints
                                    ? ` · ${p.startedPoints} as starter`
                                    : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className={`mt-2 pt-2 border-t text-xs font-semibold ${
                            isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'
                          }`}>
                            Total: {callerOutcome.sentTotal} pts
                          </div>
                        </div>

                        {/* You Received */}
                        <div className={`p-3 rounded-lg ${
                          isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'
                        }`}>
                          <p className={`text-[10px] font-bold uppercase mb-2 ${
                            isDarkMode ? 'text-emerald-400/70' : 'text-emerald-500/60'
                          }`}>
                            You Received
                          </p>
                          <div className="space-y-1.5">
                            {callerOutcome.received.map((p) => (
                              <div key={p.playerId} className="text-xs">
                                <div className="flex items-baseline justify-between gap-1">
                                  <span className={`font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {p.playerName}
                                  </span>
                                  <span className={`tabular-nums font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {p.totalPoints}
                                  </span>
                                </div>
                                <div className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                  {p.position}
                                  {p.startedPoints != null && p.startedPoints !== p.totalPoints
                                    ? ` · ${p.startedPoints} as starter`
                                    : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className={`mt-2 pt-2 border-t text-xs font-semibold ${
                            isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'
                          }`}>
                            Total: {callerOutcome.receivedTotal} pts
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Fallback: show all sides if no caller outcome match */}
                    {t.outcome && !callerOutcome && (
                      <div className="pt-4 space-y-3">
                        {t.outcome.sides.map((s) => (
                          <div key={s.teamId}>
                            <p className={`text-xs font-bold uppercase mb-1 ${
                              isDarkMode ? 'text-slate-400' : 'text-slate-500'
                            }`}>
                              {s.teamName}
                            </p>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>
                                  Sent ({s.sentTotal} pts)
                                </p>
                                {s.sent.map((p) => (
                                  <p key={p.playerId} className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
                                    {p.playerName}: {p.totalPoints}
                                  </p>
                                ))}
                              </div>
                              <div>
                                <p className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>
                                  Received ({s.receivedTotal} pts)
                                </p>
                                {s.received.map((p) => (
                                  <p key={p.playerId} className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
                                    {p.playerName}: {p.totalPoints}
                                  </p>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* AI analysis */}
                    {t.aiAnalysis ? (
                      <div
                        className={`mt-4 p-3 rounded-lg text-sm ${
                          isDarkMode
                            ? 'bg-blue-500/10 border border-blue-500/20'
                            : 'bg-blue-50 border border-blue-200'
                        }`}
                      >
                        <p
                          className={`font-semibold mb-1 ${
                            isDarkMode ? 'text-blue-200' : 'text-blue-900'
                          }`}
                        >
                          AI Winner: {t.aiAnalysis.winner}
                        </p>
                        <p
                          className={`text-xs ${
                            isDarkMode ? 'text-slate-300' : 'text-slate-700'
                          }`}
                        >
                          {t.aiAnalysis.winnerExplanation}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => handleGrade(t.id)}
                          disabled={!gradingAllowed || gradingId === t.id}
                          className={`inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                            !gradingAllowed
                              ? isDarkMode
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          } ${gradingId === t.id ? 'opacity-50' : ''}`}
                        >
                          {gradingId === t.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          Grade with AI
                          {!gradingAllowed && (
                            <Crown className="w-3 h-3 text-amber-400" />
                          )}
                        </button>
                        {!gradingAllowed && (
                          <p className={`text-[10px] mt-1 ${
                            isDarkMode ? 'text-slate-500' : 'text-slate-400'
                          }`}>
                            Pro/Elite feature
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
