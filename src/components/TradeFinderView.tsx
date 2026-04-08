import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Loader2,
  AlertCircle,
  Crown,
  ChevronDown,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLeaguesContext } from '../context/LeaguesContext';

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

export interface TradeRecommendation {
  targetTeamId: string;
  targetTeamName: string;
  userSends: Array<{ playerId: string; name: string; position: string }>;
  userReceives: Array<{ playerId: string; name: string; position: string }>;
  analysis: {
    winner: string;
    winnerExplanation: string;
    teamGrades: Array<{ team: string; grade: string; summary: string }>;
    fairnessScore: { score: number; diff: number; favored: string };
    improvements: string[];
    keyFactors: string[];
  };
}

const LEAGUE_SELECTION_KEY = 'filmroom.tradeAnalyzer.selectedLeagueId';

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
  const [isLoadingNeeds, setIsLoadingNeeds] = useState(false);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterPosition, setFilterPosition] = useState<string>('');
  const [filterTeam, setFilterTeam] = useState<string>('');

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

  const fetchRecommendations = async () => {
    if (!selectedLeagueId || !tierAllowed) return;
    setIsLoadingRecs(true);
    setError(null);
    try {
      const data = await api.post<{ recommendations: TradeRecommendation[] }>(
        '/trade-finder/recommendations',
        {
          leagueId: selectedLeagueId,
          targetPosition: filterPosition || undefined,
          targetTeamId: filterTeam || undefined,
        }
      );
      setRecommendations(data.recommendations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recommendations.');
    } finally {
      setIsLoadingRecs(false);
    }
  };

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
            AI-ranked trades that match your team's needs and the league's
            surplus.
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
                Claude is scouting your roster...
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

      {/* Filters + Find button */}
      {selectedLeagueId && (
        <div
          className={`rounded-xl border p-4 space-y-3 ${
            isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label
                className={`block text-xs font-semibold mb-1 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Target Position (optional)
              </label>
              <select
                value={filterPosition}
                onChange={(e) => setFilterPosition(e.target.value)}
                className={`w-full px-3 py-2 text-sm rounded-lg border ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-600 text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                } outline-none`}
              >
                <option value="">Any position</option>
                <option value="QB">QB</option>
                <option value="RB">RB</option>
                <option value="WR">WR</option>
                <option value="TE">TE</option>
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchRecommendations}
            disabled={isLoadingRecs}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
              isLoadingRecs
                ? isDarkMode
                  ? 'bg-slate-800 text-slate-500'
                  : 'bg-slate-200 text-slate-400'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoadingRecs ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Finding trades (this takes ~30s)...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Find Trades
              </>
            )}
          </button>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          {recommendations.map((rec, idx) => {
            const fairness = rec.analysis.fairnessScore;
            const isGood =
              fairness.favored !== rec.targetTeamName && fairness.diff < 25;
            return (
              <div
                key={idx}
                className={`rounded-xl border p-4 ${
                  isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 flex-wrap mb-3">
                  <span
                    className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                      isGood
                        ? isDarkMode
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-emerald-50 text-emerald-700'
                        : isDarkMode
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {isGood ? (
                      <TrendingUp className="inline w-3 h-3 mr-0.5" />
                    ) : (
                      <TrendingDown className="inline w-3 h-3 mr-0.5" />
                    )}
                    Fairness {fairness.score}/100
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      isDarkMode ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    vs. {rec.targetTeamName}
                  </span>
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
