import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Loader2,
  AlertCircle,
  Crown,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Plus,
  X,
  Target,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLeaguesContext } from '../context/LeaguesContext';
import { FairnessMeter } from './shared/FairnessMeter';

interface TradeFinderViewProps {
  isDarkMode: boolean;
  onSendToAnalyzer?: (rec: TradeRecommendation) => void;
}

interface TeamNeeds {
  teamId: string;
  teamName: string;
  window: 'win-now' | 'contending' | 'mid' | 'fringe' | 'rebuilding';
  positionGrades: Record<string, string>;
  topNeeds: string[];
  topStrengths: string[];
  summary: string;
}

export interface DraftPickAsset {
  year: number;
  round: number;
}

export interface TradeRecommendation {
  targetTeamId: string;
  targetTeamName: string;
  userSends: Array<{ playerId: string; name: string; position: string }>;
  userReceives: Array<{ playerId: string; name: string; position: string }>;
  userSendsPicks?: DraftPickAsset[];
  /** Pre-AI fit rationale from the needs-aware matcher. Empty arrays
   *  mean the trade came from the fallback brute-force generator and
   *  has no matcher-level reasoning attached. */
  fit?: {
    forYou: string[];
    forThem: string[];
    userNeedsMet: string[];
    partnerNeedsMet: string[];
  };
  analysis: {
    winner: string;
    winnerExplanation: string;
    teamGrades: Array<{ team: string; grade: string; summary: string }>;
    fairnessScore: { score: number; diff: number; favored: string };
    improvements: string[];
    keyFactors: string[];
  };
}

interface RosterPlayerBrief {
  playerId: string;
  name: string;
  position: string;
  slot: string;
}

interface MyRosterBrief {
  teamId: string;
  teamName: string;
  roster: {
    starters: RosterPlayerBrief[];
    bench: RosterPlayerBrief[];
    ir: RosterPlayerBrief[];
  };
}

type NeedLevelUI = 'premium' | 'starter' | 'depth' | 'none' | 'upgrade';

interface SuggestedTarget {
  playerId: string;
  playerName: string;
  position: string;
  nflTeam: string;
  tier: string;
  finalValue: number;
  partnerTeamId: string;
  partnerTeamName: string;
  partnerRecord: string;
  rationale: string;
  addresses: {
    position: string;
    level: NeedLevelUI;
    label: string;
  };
  score: number;
}

interface SuggestedTargetsResult {
  targets: SuggestedTarget[];
  needs: Array<{
    position: string;
    level: NeedLevelUI;
    label: string;
  }>;
}

const LEAGUE_SELECTION_KEY = 'filmroom.tradeAnalyzer.selectedLeagueId';

function formatPickLabel(pick: DraftPickAsset): string {
  const ord =
    pick.round === 1
      ? '1st'
      : pick.round === 2
      ? '2nd'
      : pick.round === 3
      ? '3rd'
      : `${pick.round}th`;
  return `${pick.year} ${ord} Round`;
}

export function TradeFinderView({
  isDarkMode,
  onSendToAnalyzer,
}: TradeFinderViewProps) {
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

  const [needs, setNeeds] = useState<TeamNeeds | null>(null);
  const [recommendations, setRecommendations] = useState<TradeRecommendation[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoadingNeeds, setIsLoadingNeeds] = useState(false);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Target: the player the user wants to acquire. The finder is
  // target-focused — it returns 2-3 offer packages for a specific
  // player instead of trying to "find any trade". This is the
  // primary (required) input.
  const [targetPlayerId, setTargetPlayerId] = useState<string>('');

  // "Trade Assets" filter — optional list of players + picks the user
  // is willing to give up. Empty means "let the AI pick from my full
  // roster". This narrows the offer search.
  const [assetPlayerIds, setAssetPlayerIds] = useState<string[]>([]);
  const [assetPicks, setAssetPicks] = useState<DraftPickAsset[]>([]);
  const [showAssets, setShowAssets] = useState(false);
  const [pickYear, setPickYear] = useState(String(new Date().getFullYear()));
  const [pickRound, setPickRound] = useState('1');

  // The user's own roster — needed to populate the asset picker
  const [myRoster, setMyRoster] = useState<MyRosterBrief | null>(null);

  // Every other team's roster in the league — powers the target
  // player picker. Excludes the user's own roster.
  const [otherRosters, setOtherRosters] = useState<MyRosterBrief[]>([]);

  // Suggested targets: the deterministic "players you should pursue"
  // list grouped by user-need buckets. Loaded when the league is
  // selected so users see options immediately on open.
  const [suggestedTargets, setSuggestedTargets] = useState<SuggestedTargetsResult | null>(null);
  const [isLoadingTargets, setIsLoadingTargets] = useState(false);

  const tierAllowed =
    !!user && (user.subscriptionTier === 'pro' || user.subscriptionTier === 'elite');

  const fetchNeeds = useCallback(async () => {
    if (!selectedLeagueId || !tierAllowed) return;
    setIsLoadingNeeds(true);
    setError(null);
    try {
      const data = await api.post<{ needs: TeamNeeds }>('/trade-finder/needs', {
        leagueId: selectedLeagueId,
      });
      setNeeds(data.needs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team needs.');
    } finally {
      setIsLoadingNeeds(false);
    }
  }, [selectedLeagueId, tierAllowed]);

  useEffect(() => {
    fetchNeeds();
  }, [fetchNeeds]);

  // Load the user's own roster so the Trade Assets picker has options.
  useEffect(() => {
    if (!selectedLeagueId) {
      setMyRoster(null);
      setAssetPlayerIds([]);
      return;
    }
    let cancelled = false;
    api
      .get<{ team: MyRosterBrief }>(`/rosters/${selectedLeagueId}/mine`)
      .then((data) => {
        if (!cancelled) setMyRoster(data.team);
      })
      .catch(() => {
        if (!cancelled) setMyRoster(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLeagueId]);

  // If the league changes, reset all selection state so stale player
  // IDs from a different league don't leak through.
  useEffect(() => {
    setAssetPlayerIds([]);
    setAssetPicks([]);
    setTargetPlayerId('');
  }, [selectedLeagueId]);

  // Load every team's roster in the league so the target picker has
  // options. Excludes the user's own team.
  useEffect(() => {
    if (!selectedLeagueId || !myRoster) {
      setOtherRosters([]);
      return;
    }
    let cancelled = false;
    api
      .get<{ teams: MyRosterBrief[] }>(`/rosters/${selectedLeagueId}/all`)
      .then((data) => {
        if (cancelled) return;
        setOtherRosters(
          (data.teams ?? []).filter((t) => t.teamId !== myRoster.teamId)
        );
      })
      .catch(() => {
        if (!cancelled) setOtherRosters([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLeagueId, myRoster]);

  // Load suggested targets — the deterministic "players you should
  // pursue" list that the Trade Finder's browse step displays.
  // Loads when the league is picked so users see options immediately.
  useEffect(() => {
    if (!selectedLeagueId || !tierAllowed) {
      setSuggestedTargets(null);
      return;
    }
    let cancelled = false;
    setIsLoadingTargets(true);
    api
      .post<SuggestedTargetsResult>('/trade-finder/targets', {
        leagueId: selectedLeagueId,
      })
      .then((data) => {
        if (!cancelled) setSuggestedTargets(data);
      })
      .catch(() => {
        if (!cancelled) setSuggestedTargets(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTargets(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLeagueId, tierAllowed]);

  const addAssetPlayer = (playerId: string) => {
    setAssetPlayerIds((prev) =>
      prev.includes(playerId) ? prev : [...prev, playerId]
    );
  };
  const removeAssetPlayer = (playerId: string) => {
    setAssetPlayerIds((prev) => prev.filter((id) => id !== playerId));
  };
  const addAssetPick = () => {
    const year = parseInt(pickYear, 10);
    const round = parseInt(pickRound, 10);
    if (!Number.isFinite(year) || !Number.isFinite(round)) return;
    setAssetPicks((prev) => {
      if (prev.some((p) => p.year === year && p.round === round)) return prev;
      return [...prev, { year, round }];
    });
  };
  const removeAssetPick = (idx: number) => {
    setAssetPicks((prev) => prev.filter((_, i) => i !== idx));
  };

  const fetchRecommendations = async (explicitTargetId?: string) => {
    const effectiveTarget = explicitTargetId ?? targetPlayerId;
    if (!selectedLeagueId || !tierAllowed) return;
    if (!effectiveTarget) {
      setError('Pick a target player first.');
      return;
    }
    setIsLoadingRecs(true);
    setError(null);
    setHasSearched(true);
    try {
      const data = await api.post<{ recommendations: TradeRecommendation[] }>(
        '/trade-finder/recommendations',
        {
          leagueId: selectedLeagueId,
          targetPlayerId: effectiveTarget,
          userPlayerIds: assetPlayerIds.length > 0 ? assetPlayerIds : undefined,
          userPicks: assetPicks.length > 0 ? assetPicks : undefined,
        }
      );
      setRecommendations(data.recommendations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recommendations.');
    } finally {
      setIsLoadingRecs(false);
    }
  };

  // Helper for the suggested-target cards: set the target and
  // immediately kick off an offer fetch. Scrolls the results into
  // view so the user can see what comes back.
  const pickSuggestedTarget = useCallback(
    (target: SuggestedTarget) => {
      setTargetPlayerId(target.playerId);
      setError(null);
      // Fire the recommendations fetch immediately with the explicit
      // target id — avoids waiting on the next render cycle of the
      // targetPlayerId state update.
      void fetchRecommendations(target.playerId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedLeagueId, tierAllowed, assetPlayerIds, assetPicks]
  );

  // Reset "has searched" state whenever inputs change so the empty
  // state goes away until the user re-runs the search.
  useEffect(() => {
    setHasSearched(false);
    setRecommendations([]);
  }, [selectedLeagueId, targetPlayerId, assetPlayerIds, assetPicks]);

  if (!tierAllowed) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div
          className={`rounded-xl border p-8 text-center ${
            isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <Crown
            className={`w-10 h-10 mx-auto mb-4 ${
              isDarkMode ? 'text-amber-400' : 'text-amber-500'
            }`}
          />
          <h2
            className={`text-xl font-bold mb-2 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            Trade Finder is Pro/Elite
          </h2>
          <p
            className={`text-sm ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Get AI-generated team needs + ranked trade recommendations for
            every roster in your league.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isDarkMode ? 'bg-blue-600/20' : 'bg-blue-50'
          }`}
        >
          <Search
            className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
          />
        </div>
        <div>
          <h1
            className={`text-xl font-bold ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            Trade Finder
          </h1>
          <p
            className={`text-sm ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Pairs your roster's surplus with your opponents' needs — and
            vice versa — then AI-grades the survivors.
          </p>
        </div>
      </div>

      {/* League selector */}
      <div
        className={`rounded-xl border p-4 ${
          isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        <label
          className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          League
        </label>
        <div className="relative">
          <select
            value={selectedLeagueId}
            onChange={(e) => setSelectedLeagueId(e.target.value)}
            className={`w-full appearance-none pr-9 pl-3 py-2 text-sm rounded-lg border ${
              isDarkMode
                ? 'bg-slate-800 border-slate-600 text-white'
                : 'bg-white border-slate-300 text-slate-900'
            } outline-none`}
          >
            <option value="">Select a league...</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          />
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

      {/* Needs Dashboard */}
      {selectedLeagueId && (
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
              Your Team Needs (AI-assessed)
            </p>
          </div>

          {isLoadingNeeds ? (
            <div className="flex items-center gap-2">
              <Loader2
                className={`w-4 h-4 animate-spin ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              />
              <span
                className={`text-sm ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Scouting your roster...
              </span>
            </div>
          ) : needs ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                    isDarkMode
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-blue-50 text-blue-700'
                  }`}
                >
                  {needs.window}
                </span>
                <span
                  className={`text-sm ${
                    isDarkMode ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  {needs.summary}
                </span>
              </div>

              <div>
                <p
                  className={`text-[10px] font-bold uppercase mb-1 ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Position Grades
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(needs.positionGrades).map(([pos, grade]) => (
                    <span
                      key={pos}
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded ${
                        isDarkMode ? 'bg-slate-800' : 'bg-slate-100'
                      }`}
                    >
                      <span
                        className={`${
                          isDarkMode ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        {pos}
                      </span>
                      <span
                        className={`${
                          isDarkMode ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {grade}
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p
                    className={`text-[10px] font-bold uppercase mb-1 ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    Top Needs
                  </p>
                  <ul
                    className={`text-sm space-y-1 list-disc list-inside ${
                      isDarkMode ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    {needs.topNeeds.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p
                    className={`text-[10px] font-bold uppercase mb-1 ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    Top Strengths
                  </p>
                  <ul
                    className={`text-sm space-y-1 list-disc list-inside ${
                      isDarkMode ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    {needs.topStrengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p
              className={`text-sm ${
                isDarkMode ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              No needs assessment yet.
            </p>
          )}
        </div>
      )}

      {/* Suggested Targets — deterministic "players you should
          pursue" list grouped by need bucket. This is the browse
          step: users see 10 ranked targets on opponents without
          making an AI call, and click any to drop into the
          per-target offer flow below. */}
      {selectedLeagueId && (
        <div
          className={`rounded-xl border p-4 ${
            isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <Target
              className={`w-4 h-4 ${
                isDarkMode ? 'text-purple-400' : 'text-purple-600'
              }`}
            />
            <p
              className={`text-sm font-semibold ${
                isDarkMode ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              Players to target
            </p>
            <span
              className={`text-[10px] uppercase tracking-wide ml-auto ${
                isDarkMode ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              Ranked by fit
            </span>
          </div>

          {isLoadingTargets ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2
                className={`w-4 h-4 animate-spin ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              />
              <span
                className={`text-sm ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Scanning opponents...
              </span>
            </div>
          ) : !suggestedTargets || suggestedTargets.targets.length === 0 ? (
            <p
              className={`text-sm py-4 ${
                isDarkMode ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              No clear targets found. Your roster may already be stacked, or
              rosters haven&apos;t synced yet.
            </p>
          ) : (
            <div className="space-y-4">
              {suggestedTargets.needs.map((bucket) => {
                const bucketTargets = suggestedTargets.targets.filter(
                  (t) =>
                    t.addresses.position === bucket.position &&
                    t.addresses.level === bucket.level
                );
                if (bucketTargets.length === 0) return null;
                return (
                  <div key={`${bucket.position}-${bucket.level}`}>
                    <p
                      className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${
                        isDarkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      {bucket.label}
                    </p>
                    <div className="grid gap-2">
                      {bucketTargets.map((t) => {
                        const isSelected = targetPlayerId === t.playerId;
                        return (
                          <button
                            key={t.playerId}
                            type="button"
                            onClick={() => pickSuggestedTarget(t)}
                            disabled={isLoadingRecs}
                            className={`flex items-center gap-3 text-left p-3 rounded-lg border transition-colors ${
                              isSelected
                                ? isDarkMode
                                  ? 'bg-blue-500/10 border-blue-500/40'
                                  : 'bg-blue-50 border-blue-300'
                                : isDarkMode
                                ? 'bg-slate-800/40 border-slate-700 hover:border-blue-500/40 hover:bg-slate-800/70'
                                : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                            } ${isLoadingRecs ? 'opacity-60 cursor-wait' : ''}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    isDarkMode
                                      ? 'bg-slate-700 text-slate-300'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {t.position}
                                </span>
                                <span
                                  className={`text-sm font-semibold truncate ${
                                    isDarkMode ? 'text-white' : 'text-slate-900'
                                  }`}
                                >
                                  {t.playerName}
                                </span>
                                <span
                                  className={`text-[10px] ${
                                    isDarkMode ? 'text-slate-500' : 'text-slate-400'
                                  }`}
                                >
                                  {t.nflTeam}
                                </span>
                              </div>
                              <div
                                className={`text-xs truncate ${
                                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                                }`}
                              >
                                From {t.partnerTeamName} ({t.partnerRecord}) &middot; {t.rationale}
                              </div>
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-2">
                              <span
                                className={`text-[10px] font-semibold px-2 py-1 rounded-md ${
                                  isDarkMode
                                    ? 'bg-purple-500/20 text-purple-200'
                                    : 'bg-purple-50 text-purple-700'
                                }`}
                              >
                                Build Offer
                              </span>
                              <ArrowRight
                                className={`w-4 h-4 ${
                                  isDarkMode ? 'text-slate-500' : 'text-slate-400'
                                }`}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p
            className={`text-[10px] mt-3 ${
              isDarkMode ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            Click any target to build 2-3 realistic offer packages for that player.
          </p>
        </div>
      )}

      {/* Manual target picker + refinement + Suggest Offers button.
          This is the power-user path — the suggested targets list
          above handles the common case. Use this when you already
          know exactly who you want (even if they aren't in the
          suggested list) or to re-run with narrower Trade Assets. */}
      {selectedLeagueId && (
        <div
          className={`rounded-xl border p-4 space-y-4 ${
            isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <div>
            <label
              className={`block text-xs font-semibold mb-1 flex items-center gap-1.5 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              Or pick any player manually
            </label>

            {/* Current selection pill */}
            {targetPlayerId && (() => {
              const found = otherRosters
                .flatMap((t) =>
                  [
                    ...(t.roster.starters || []),
                    ...(t.roster.bench || []),
                    ...(t.roster.ir || []),
                  ].map((p) => ({ team: t.teamName, ...p }))
                )
                .find((p) => p.playerId === targetPlayerId);
              if (!found) return null;
              return (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                      isDarkMode
                        ? 'bg-purple-500/20 text-purple-200'
                        : 'bg-purple-50 text-purple-800'
                    }`}
                  >
                    <Target className="w-3 h-3" />
                    <span className="text-[9px] opacity-70">{found.position}</span>
                    {found.name}
                    <span className="text-[9px] opacity-70">({found.team})</span>
                    <button
                      type="button"
                      onClick={() => setTargetPlayerId('')}
                      className="hover:opacity-70"
                      aria-label="Clear target player"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              );
            })()}

            <select
              value={targetPlayerId}
              onChange={(e) => setTargetPlayerId(e.target.value)}
              disabled={otherRosters.length === 0}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-600 text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              } outline-none disabled:opacity-50`}
            >
              <option value="">
                {otherRosters.length === 0
                  ? 'Loading league rosters...'
                  : 'Pick a player you want to acquire...'}
              </option>
              {otherRosters.map((team) => {
                const players = [
                  ...(team.roster.starters || []),
                  ...(team.roster.bench || []),
                ].filter((p) => p.position !== 'K' && p.position !== 'DEF');
                if (players.length === 0) return null;
                return (
                  <optgroup key={team.teamId} label={team.teamName}>
                    {players.map((p) => (
                      <option key={p.playerId} value={p.playerId}>
                        {p.position} • {p.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <p
              className={`mt-1 text-[10px] ${
                isDarkMode ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              The finder suggests 2-3 realistic offer packages to send for your target.
            </p>
          </div>

          {/* Trade Assets picker (optional) */}
          <div
            className={`border-t pt-3 ${
              isDarkMode ? 'border-slate-800' : 'border-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={() => setShowAssets((v) => !v)}
              className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${
                isDarkMode
                  ? 'text-slate-400 hover:text-slate-300'
                  : 'text-slate-500 hover:text-slate-600'
              }`}
            >
              {showAssets ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              Trade Assets (optional)
              {assetPlayerIds.length + assetPicks.length > 0 && (
                <span
                  className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isDarkMode
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-blue-50 text-blue-700'
                  }`}
                >
                  {assetPlayerIds.length + assetPicks.length}
                </span>
              )}
            </button>
            {showAssets && (
              <div className="mt-3 space-y-3">
                <p
                  className={`text-xs ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Specify players and picks you'd give up. The finder will
                  only return trades that use one of these on your side. Leave
                  empty to let the finder pick from your full roster.
                </p>

                {/* Selected chips */}
                {(assetPlayerIds.length > 0 || assetPicks.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {assetPlayerIds.map((pid) => {
                      const player = [
                        ...(myRoster?.roster.starters || []),
                        ...(myRoster?.roster.bench || []),
                        ...(myRoster?.roster.ir || []),
                      ].find((p) => p.playerId === pid);
                      if (!player) return null;
                      return (
                        <span
                          key={pid}
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                            isDarkMode
                              ? 'bg-blue-500/20 text-blue-200'
                              : 'bg-blue-50 text-blue-800'
                          }`}
                        >
                          <span className="text-[9px] opacity-70">
                            {player.position}
                          </span>
                          {player.name}
                          <button
                            type="button"
                            onClick={() => removeAssetPlayer(pid)}
                            className="hover:opacity-70"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                    {assetPicks.map((pick, i) => (
                      <span
                        key={`pick-${i}`}
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                          isDarkMode
                            ? 'bg-amber-500/20 text-amber-200'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        <span className="text-[9px] opacity-70">PICK</span>
                        {formatPickLabel(pick)}
                        <button
                          type="button"
                          onClick={() => removeAssetPick(i)}
                          className="hover:opacity-70"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Add a player from roster */}
                <div>
                  <label
                    className={`block text-[10px] font-bold uppercase mb-1 ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    Add player from your roster
                  </label>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        addAssetPlayer(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    disabled={!myRoster}
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-600 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    } outline-none disabled:opacity-50`}
                  >
                    <option value="">
                      {myRoster
                        ? 'Select a player...'
                        : 'Loading your roster...'}
                    </option>
                    {myRoster &&
                      [
                        ...myRoster.roster.starters,
                        ...myRoster.roster.bench,
                      ]
                        .filter((p) => !assetPlayerIds.includes(p.playerId))
                        .map((p) => (
                          <option key={p.playerId} value={p.playerId}>
                            {p.position} • {p.name}
                            {p.slot && p.slot !== 'BN' ? ` (${p.slot})` : ''}
                          </option>
                        ))}
                  </select>
                </div>

                {/* Add a draft pick */}
                <div>
                  <label
                    className={`block text-[10px] font-bold uppercase mb-1 ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    Add a draft pick
                  </label>
                  <div className="flex gap-2 items-center flex-wrap">
                    <select
                      value={pickYear}
                      onChange={(e) => setPickYear(e.target.value)}
                      className={`px-2 py-1.5 text-sm rounded-lg border ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-600 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      } outline-none`}
                    >
                      {[0, 1, 2, 3].map((offset) => {
                        const y = new Date().getFullYear() + offset;
                        return (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        );
                      })}
                    </select>
                    <select
                      value={pickRound}
                      onChange={(e) => setPickRound(e.target.value)}
                      className={`px-2 py-1.5 text-sm rounded-lg border ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-600 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      } outline-none`}
                    >
                      {[1, 2, 3, 4, 5].map((r) => (
                        <option key={r} value={r}>
                          Round {r}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addAssetPick}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <Plus className="w-3 h-3" />
                      Add Pick
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => fetchRecommendations()}
            disabled={isLoadingRecs || !targetPlayerId}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
              isLoadingRecs || !targetPlayerId
                ? isDarkMode
                  ? 'bg-slate-800 text-slate-500'
                  : 'bg-slate-200 text-slate-400'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoadingRecs ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Building offers...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                {targetPlayerId ? 'Suggest Offers' : 'Pick a target player first'}
              </>
            )}
          </button>
        </div>
      )}

      {/* Empty state when the finder returned zero offers for a target */}
      {hasSearched && !isLoadingRecs && recommendations.length === 0 && (
        <div
          className={`rounded-xl border p-6 text-center ${
            isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <p
            className={`text-sm font-semibold mb-1 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            No realistic offers found for this target
          </p>
          <p
            className={`text-xs ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Your roster probably doesn't have enough value to balance this
            trade even with picks. Try a less valuable target, clear the
            Trade Assets filter, or add a first-round pick to sweeten the
            deal.
          </p>
        </div>
      )}

      {/* Recommendations — already sorted by fairness on the server */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <p
            className={`text-xs ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Showing {recommendations.length} trade
            {recommendations.length === 1 ? '' : 's'}, ranked most fair
            to least fair. Heavily lopsided trades are filtered out.
          </p>
          {recommendations.map((rec, idx) => {
            const fairness = rec.analysis.fairnessScore;
            return (
              <div
                key={idx}
                className={`rounded-xl border p-4 ${
                  isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 flex-wrap mb-3">
                  <span
                    className={`text-sm font-semibold ${
                      isDarkMode ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    vs. {rec.targetTeamName}
                  </span>
                </div>

                {/* Fairness meter — same visual language as the
                    manual Trade Analyzer so users see the same
                    bands ("Slightly Favored", "Favored", etc.)
                    and the same color coding. */}
                <div className="mb-3">
                  <FairnessMeter
                    score={fairness.score}
                    favored={fairness.favored}
                    isDarkMode={isDarkMode}
                    compact
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-3 mb-3 text-sm">
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
                      You send
                    </p>
                    {rec.userSends.map((p) => (
                      <p
                        key={p.playerId}
                        className={
                          isDarkMode ? 'text-slate-200' : 'text-slate-800'
                        }
                      >
                        <span className="text-xs opacity-70 mr-1">{p.position}</span>
                        {p.name}
                      </p>
                    ))}
                    {rec.userSendsPicks?.map((pick, i) => (
                      <p
                        key={`pick-${i}`}
                        className={
                          isDarkMode ? 'text-amber-300' : 'text-amber-700'
                        }
                      >
                        <span className="text-xs opacity-70 mr-1">PICK</span>
                        {formatPickLabel(pick)}
                      </p>
                    ))}
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
                      You receive
                    </p>
                    {rec.userReceives.map((p) => (
                      <p
                        key={p.playerId}
                        className={
                          isDarkMode ? 'text-slate-200' : 'text-slate-800'
                        }
                      >
                        <span className="text-xs opacity-70 mr-1">{p.position}</span>
                        {p.name}
                      </p>
                    ))}
                  </div>
                </div>

                <p
                  className={`text-sm mb-3 ${
                    isDarkMode ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  {rec.analysis.winnerExplanation}
                </p>

                {/* Matcher fit reasons — why this trade was surfaced.
                    Only shown when the needs-aware matcher produced this
                    candidate (fallback trades have empty fit arrays). */}
                {rec.fit &&
                  (rec.fit.forYou.length > 0 || rec.fit.forThem.length > 0) && (
                  <div
                    className={`grid md:grid-cols-2 gap-3 mb-3 text-xs ${
                      isDarkMode ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    {rec.fit.forYou.length > 0 && (
                      <div
                        className={`p-3 rounded-lg ${
                          isDarkMode
                            ? 'bg-emerald-500/10 border border-emerald-500/20'
                            : 'bg-emerald-50 border border-emerald-200'
                        }`}
                      >
                        <p
                          className={`text-[10px] font-bold uppercase mb-1 ${
                            isDarkMode ? 'text-emerald-300' : 'text-emerald-700'
                          }`}
                        >
                          Why it helps you
                        </p>
                        <ul className="space-y-1 list-disc list-inside">
                          {rec.fit.forYou.map((reason, i) => (
                            <li key={i}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {rec.fit.forThem.length > 0 && (
                      <div
                        className={`p-3 rounded-lg ${
                          isDarkMode
                            ? 'bg-slate-800/40 border border-slate-700'
                            : 'bg-slate-50 border border-slate-200'
                        }`}
                      >
                        <p
                          className={`text-[10px] font-bold uppercase mb-1 ${
                            isDarkMode ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          Why they'd accept
                        </p>
                        <ul className="space-y-1 list-disc list-inside">
                          {rec.fit.forThem.map((reason, i) => (
                            <li key={i}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {onSendToAnalyzer && (
                  <button
                    type="button"
                    onClick={() => onSendToAnalyzer(rec)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Open in Analyzer <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
