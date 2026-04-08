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
    fairnessScore?: { score: number; diff: number; favored: string };
    improvements?: string[];
    keyFactors?: string[];
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
  const [impact, setImpact] = useState<RecordImpact | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [gradingId, setGradingId] = useState<string | null>(null);

  const gradingAllowed =
    !!user &&
    (user.subscriptionTier === 'pro' || user.subscriptionTier === 'elite');

  const fetchAll = useCallback(async () => {
    if (!selectedLeagueId) {
      setTrades([]);
      setImpact(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [historyRes, impactRes] = await Promise.all([
        api.get<{ trades: HistoricalTrade[] }>(
          `/trade-history/history?leagueId=${selectedLeagueId}`
        ),
        api
          .get<{ impact: RecordImpact }>(
            `/trade-history/record-impact/${selectedLeagueId}`
          )
          .catch(() => ({ impact: null })),
      ]);
      setTrades(historyRes.trades);
      setImpact(impactRes.impact);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load trade history.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedLeagueId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleIngest = async () => {
    if (!selectedLeagueId) return;
    setIsIngesting(true);
    try {
      await api.post(`/trade-history/ingest/${selectedLeagueId}`);
      await fetchAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Ingest failed.'
      );
    } finally {
      setIsIngesting(false);
    }
  };

  const handleGrade = async (tradeId: string) => {
    if (!gradingAllowed) return;
    setGradingId(tradeId);
    try {
      await api.post(`/trade-history/grade/${tradeId}`);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grading failed.');
    } finally {
      setGradingId(null);
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

  // Compute season summary headline
  const headline = useMemo(() => {
    if (!impact) return null;
    const a = impact.actualRecord;
    const h = impact.hypotheticalRecord;
    const winDelta = a.wins - h.wins;
    if (winDelta > 0) {
      return `Your trades flipped ${winDelta} ${
        winDelta === 1 ? 'loss' : 'losses'
      } into wins this season.`;
    } else if (winDelta < 0) {
      return `Your trades cost you ${Math.abs(winDelta)} ${
        Math.abs(winDelta) === 1 ? 'win' : 'wins'
      } this season.`;
    }
    return 'Your trades had no net impact on your record so far.';
  }, [impact]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
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
            Trade History
          </h1>
          <p
            className={`text-sm ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Every trade ever made in your league, with how it actually worked out.
          </p>
        </div>
      </div>

      {/* League selector */}
      <div
        className={`rounded-xl border p-4 space-y-3 ${
          isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        <label
          className={`block text-xs font-semibold uppercase tracking-wide ${
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          League
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <select
              value={selectedLeagueId}
              onChange={(e) => setSelectedLeagueId(e.target.value)}
              className={`w-full appearance-none pr-9 pl-3 py-2 text-sm rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-600 text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              } outline-none`}
            >
              <option value="">Select a league...</option>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.platform ? ` (${l.platform})` : ''}
                </option>
              ))}
            </select>
            <ChevronDown
              className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            />
          </div>
          {selectedLeagueId && (
            <button
              type="button"
              onClick={handleIngest}
              disabled={isIngesting}
              className={`inline-flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
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

      {/* Season summary */}
      {impact && headline && (
        <div
          className={`rounded-xl border p-6 ${
            isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles
              className={`w-4 h-4 ${
                isDarkMode ? 'text-blue-400' : 'text-blue-600'
              }`}
            />
            <p
              className={`text-sm font-semibold ${
                isDarkMode ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              Season Impact ({impact.seasonYear})
            </p>
          </div>
          <p
            className={`text-lg font-bold mb-4 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            {headline}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div
              className={`p-3 rounded-lg ${
                isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'
              }`}
            >
              <p
                className={`text-[10px] font-bold uppercase mb-1 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Actual Record
              </p>
              <p
                className={`text-2xl font-bold ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                {impact.actualRecord.wins}-{impact.actualRecord.losses}
                {impact.actualRecord.ties > 0 ? `-${impact.actualRecord.ties}` : ''}
              </p>
            </div>
            <div
              className={`p-3 rounded-lg ${
                isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'
              }`}
            >
              <p
                className={`text-[10px] font-bold uppercase mb-1 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                If you never traded
              </p>
              <p
                className={`text-2xl font-bold ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                {impact.hypotheticalRecord.wins}-
                {impact.hypotheticalRecord.losses}
                {impact.hypotheticalRecord.ties > 0
                  ? `-${impact.hypotheticalRecord.ties}`
                  : ''}
              </p>
            </div>
          </div>
          <div
            className={`mt-3 text-xs ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Net points:{' '}
            <span
              className={
                impact.totalPointDifferential >= 0
                  ? 'text-emerald-500 font-semibold'
                  : 'text-red-500 font-semibold'
              }
            >
              {impact.totalPointDifferential >= 0 ? '+' : ''}
              {impact.totalPointDifferential}
            </span>
          </div>
          {impact.flippedWeeks.length > 0 && (
            <div className="mt-4">
              <p
                className={`text-[10px] font-bold uppercase mb-2 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Flipped Weeks
              </p>
              <div className="space-y-1">
                {impact.flippedWeeks.map((fw) => (
                  <div
                    key={fw.week}
                    className={`text-xs flex items-center gap-2 ${
                      isDarkMode ? 'text-slate-300' : 'text-slate-600'
                    }`}
                  >
                    <span className="font-semibold">Week {fw.week}</span>
                    <span
                      className={
                        fw.hypotheticalResult === 'W'
                          ? 'text-emerald-500'
                          : 'text-red-500'
                      }
                    >
                      {fw.actualResult} → {fw.hypotheticalResult}
                    </span>
                    <span className="opacity-70">
                      ({fw.actualScore} vs {fw.opponentScore} → hypothetical{' '}
                      {fw.hypotheticalScore})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trades table */}
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
          {trades.map((t) => {
            const isOpen = expanded.has(t.id);
            const dateStr = t.executedAt
              ? new Date(t.executedAt).toLocaleDateString()
              : 'Unknown date';
            return (
              <div
                key={t.id}
                className={`rounded-xl border overflow-hidden ${
                  isDarkMode
                    ? 'bg-slate-900/50 border-slate-700'
                    : 'bg-white border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(t.id)}
                  className={`w-full flex items-start gap-3 p-4 text-left ${
                    isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'
                  }`}
                >
                  <ArrowRightLeft
                    className={`w-4 h-4 mt-1 flex-shrink-0 ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-600'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs font-medium ${
                          isDarkMode ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        {dateStr}
                        {t.weekExecuted ? ` • Week ${t.weekExecuted}` : ''}
                      </span>
                      {t.aiGrade && (
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            isDarkMode
                              ? 'bg-blue-500/20 text-blue-300'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          AI: {t.aiGrade}
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-sm mt-1 ${
                        isDarkMode ? 'text-slate-200' : 'text-slate-800'
                      }`}
                    >
                      {t.sides.map((s, i) => (
                        <span key={s.teamId}>
                          <span className="font-semibold">{s.teamName}</span>{' '}
                          sends{' '}
                          {s.sent
                            .map((p) => p.name || `${p.pickYear} R${p.pickRound}`)
                            .join(', ')}
                          {i < t.sides.length - 1 ? ' • ' : ''}
                        </span>
                      ))}
                    </div>
                    {/* Inline outcome totals */}
                    {t.outcome && (
                      <div className="mt-2 flex flex-wrap gap-3 text-xs">
                        {t.outcome.sides.map((s) => (
                          <span
                            key={s.teamId}
                            className={`inline-flex items-center gap-1 ${
                              isDarkMode ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            {s.differential >= 0 ? (
                              <TrendingUp className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-red-500" />
                            )}
                            {s.teamName}:{' '}
                            <span
                              className={
                                s.differential >= 0
                                  ? 'text-emerald-500 font-semibold'
                                  : 'text-red-500 font-semibold'
                              }
                            >
                              {s.differential >= 0 ? '+' : ''}
                              {s.differential}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 mt-1 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 mt-1 flex-shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div
                    className={`px-4 pb-4 border-t space-y-4 ${
                      isDarkMode ? 'border-slate-800' : 'border-slate-200'
                    }`}
                  >
                    {/* Detailed weekly outcomes */}
                    {t.outcome && (
                      <div className="pt-4 space-y-3">
                        {t.outcome.sides.map((s) => (
                          <div key={s.teamId}>
                            <p
                              className={`text-xs font-bold uppercase mb-1 ${
                                isDarkMode ? 'text-slate-400' : 'text-slate-500'
                              }`}
                            >
                              {s.teamName}
                            </p>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p
                                  className={
                                    isDarkMode ? 'text-slate-500' : 'text-slate-400'
                                  }
                                >
                                  Sent ({s.sentTotal} pts)
                                </p>
                                {s.sent.map((p) => (
                                  <p
                                    key={p.playerId}
                                    className={
                                      isDarkMode ? 'text-slate-300' : 'text-slate-700'
                                    }
                                  >
                                    {p.playerName}: {p.totalPoints}
                                  </p>
                                ))}
                              </div>
                              <div>
                                <p
                                  className={
                                    isDarkMode ? 'text-slate-500' : 'text-slate-400'
                                  }
                                >
                                  Received ({s.receivedTotal} pts)
                                </p>
                                {s.received.map((p) => (
                                  <p
                                    key={p.playerId}
                                    className={
                                      isDarkMode ? 'text-slate-300' : 'text-slate-700'
                                    }
                                  >
                                    {p.playerName}: {p.totalPoints}
                                  </p>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* AI analysis (if graded) */}
                    {t.aiAnalysis ? (
                      <div
                        className={`p-3 rounded-lg text-sm ${
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
                      <div>
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
                          Grade this trade with AI
                          {!gradingAllowed && (
                            <Crown className="w-3 h-3 text-amber-400" />
                          )}
                        </button>
                        {!gradingAllowed && (
                          <p
                            className={`text-[10px] mt-1 ${
                              isDarkMode ? 'text-slate-500' : 'text-slate-400'
                            }`}
                          >
                            Retroactive grading is a Pro/Elite feature.
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
