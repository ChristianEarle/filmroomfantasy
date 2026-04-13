import { useState, useEffect, useCallback } from 'react';
import {
  GitBranch,
  ChevronDown,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLeaguesContext } from '../context/LeaguesContext';
import { TradeChainCard } from './TradeChainCard';
import type { TreeNode } from './TradeTreeNode';

interface TradeTreeViewProps {
  isDarkMode: boolean;
}

interface TreeSummary {
  totalChains: number;
  longestChainDepth: number;
  bestChainDifferential: number;
  worstChainDifferential: number;
  totalPointsGained: number;
}

const LEAGUE_SELECTION_KEY = 'filmroom.tradeAnalyzer.selectedLeagueId';

export function TradeTreeView({ isDarkMode }: TradeTreeViewProps) {
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

  const [trees, setTrees] = useState<TreeNode[]>([]);
  const [summary, setSummary] = useState<TreeSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrees = useCallback(
    async (
      leagueIdArg: string = selectedLeagueId,
      { isCancelled }: { isCancelled?: () => boolean } = {}
    ) => {
      if (!leagueIdArg) {
        setTrees([]);
        setSummary(null);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.get<{
          trees: TreeNode[];
          summary: TreeSummary;
          callerTeamId: string;
          callerTeamName: string;
        }>(`/trade-history/trade-trees/${leagueIdArg}`);
        if (isCancelled?.()) return;
        setTrees(res.trees);
        setSummary(res.summary);
      } catch (err) {
        if (isCancelled?.()) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load trade trees.'
        );
      } finally {
        if (!isCancelled?.()) setIsLoading(false);
      }
    },
    [selectedLeagueId]
  );

  useEffect(() => {
    let cancelled = false;
    fetchTrees(selectedLeagueId, { isCancelled: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [fetchTrees, selectedLeagueId]);

  useEffect(() => {
    setError(null);
  }, [selectedLeagueId]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isDarkMode ? 'bg-purple-600/20' : 'bg-purple-50'
          }`}
        >
          <GitBranch
            className={`w-5 h-5 ${
              isDarkMode ? 'text-purple-400' : 'text-purple-600'
            }`}
          />
        </div>
        <div>
          <h1
            className={`text-xl font-bold ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            Trade Trees
          </h1>
          <p
            className={`text-sm ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Trace the lineage of your trades. See how one deal led to another
            and whether the chain paid off.
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
          htmlFor="trade-tree-league-select"
          className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          League
        </label>
        <div className="relative">
          <select
            id="trade-tree-league-select"
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

      {/* Summary card */}
      {summary && summary.totalChains > 0 && !isLoading && (
        <div
          className={`rounded-xl border p-5 ${
            isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <GitBranch
              className={`w-4 h-4 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}
            />
            <p
              className={`text-sm font-semibold ${
                isDarkMode ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              Chain Summary
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
              <p className={`text-[10px] font-bold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Chains
              </p>
              <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {summary.totalChains}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
              <p className={`text-[10px] font-bold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Deepest
              </p>
              <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {summary.longestChainDepth + 1} trades
              </p>
            </div>
            <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
              <p className={`text-[10px] font-bold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Best Chain
              </p>
              <p className={`text-xl font-bold ${
                summary.bestChainDifferential >= 0
                  ? 'text-emerald-500'
                  : 'text-red-500'
              }`}>
                {summary.bestChainDifferential > 0 ? '+' : ''}{summary.bestChainDifferential}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
              <p className={`text-[10px] font-bold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Net Points
              </p>
              <p className={`text-xl font-bold ${
                summary.totalPointsGained >= 0
                  ? 'text-emerald-500'
                  : 'text-red-500'
              }`}>
                {summary.totalPointsGained > 0 ? '+' : ''}{summary.totalPointsGained}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Trade tree list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2
            className={`w-6 h-6 animate-spin ${
              isDarkMode ? 'text-purple-400' : 'text-purple-600'
            }`}
          />
        </div>
      ) : trees.length === 0 && selectedLeagueId ? (
        <div
          className={`rounded-xl border p-8 text-center ${
            isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <GitBranch
            className={`w-8 h-8 mx-auto mb-3 ${
              isDarkMode ? 'text-slate-600' : 'text-slate-300'
            }`}
          />
          <p
            className={`text-sm ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            No trade chains found. Chains appear when a player you received
            in one trade is later traded away in another.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {trees.map((tree) => (
            <TradeChainCard key={tree.tradeId} tree={tree} isDarkMode={isDarkMode} />
          ))}
        </div>
      )}
    </div>
  );
}
