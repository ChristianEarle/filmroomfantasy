import { useState } from 'react';
import {
  GitBranch,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { TradeTreeNodeComponent, type TreeNode } from './TradeTreeNode';

interface TradeChainCardProps {
  tree: TreeNode;
  isDarkMode: boolean;
}

/** Count total trades in a tree (including root). */
function countNodes(node: TreeNode): number {
  return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
}

/** Find the deepest depth in the tree. */
function treeDepth(node: TreeNode): number {
  if (node.children.length === 0) return 0;
  return 1 + Math.max(...node.children.map(treeDepth));
}

export function TradeChainCard({ tree, isDarkMode }: TradeChainCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const totalTrades = countNodes(tree);
  const depth = treeDepth(tree);
  const diff = tree.cumulativeDifferential;

  // Headline: first player received in the root trade
  const rootPlayer = tree.received.find((r) => r.playerId);
  const rootSent = tree.sent.find((s) => s.playerId);
  const headline = rootPlayer
    ? `${rootPlayer.playerName} chain`
    : rootSent
    ? `Traded ${rootSent.playerName}`
    : 'Trade chain';

  const dateStr = tree.executedAt
    ? new Date(tree.executedAt).toLocaleDateString()
    : '';

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
      }`}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className={`w-full flex items-start gap-3 p-4 text-left transition-colors ${
          isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'
        }`}
      >
        <GitBranch
          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
            isDarkMode ? 'text-purple-400' : 'text-purple-600'
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-sm font-semibold ${
                isDarkMode ? 'text-slate-200' : 'text-slate-800'
              }`}
            >
              {headline}
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                diff > 0
                  ? isDarkMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
                  : diff < 0
                  ? isDarkMode ? 'bg-red-500/20 text-red-300' : 'bg-red-50 text-red-700'
                  : isDarkMode ? 'bg-slate-600/30 text-slate-300' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {diff > 0 ? '+' : ''}{diff} pts
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
            >
              {dateStr && `Started ${dateStr}`}
              {tree.weekExecuted ? ` · Wk ${tree.weekExecuted}` : ''}
            </span>
            <span
              className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
            >
              {totalTrades} {totalTrades === 1 ? 'trade' : 'trades'}
              {depth > 0 ? ` · ${depth + 1} levels deep` : ''}
            </span>
          </div>
          {/* Mini outcome indicator */}
          <div className="flex items-center gap-1 mt-1.5">
            {diff >= 0 ? (
              <TrendingUp className="w-3 h-3 text-emerald-500" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-500" />
            )}
            <span
              className={`text-xs font-medium ${
                diff > 0
                  ? isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                  : diff < 0
                  ? isDarkMode ? 'text-red-400' : 'text-red-600'
                  : isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {diff > 0
                ? `Gained ${diff} pts across the chain`
                : diff < 0
                ? `Lost ${Math.abs(diff)} pts across the chain`
                : 'Even across the chain'}
            </span>
          </div>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 mt-1 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 mt-1 flex-shrink-0" />
        )}
      </button>

      {isOpen && (
        <div
          className={`px-4 pb-4 pt-2 border-t ${
            isDarkMode ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <TradeTreeNodeComponent node={tree} isDarkMode={isDarkMode} isRoot />
        </div>
      )}
    </div>
  );
}
