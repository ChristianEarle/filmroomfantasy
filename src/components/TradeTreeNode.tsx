import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

interface PlayerReceived {
  playerId: string | null;
  playerName: string;
  position: string;
  nflTeam: string;
  pointsWhileHeld: number;
  weeksHeld: number;
  tradedAwayInChildIndex: number | null;
  pickYear: number | null;
  pickRound: number | null;
}

interface PlayerSent {
  playerId: string | null;
  playerName: string;
  position: string;
  nflTeam: string;
  pointsAfterTrade: number;
  pickYear: number | null;
  pickRound: number | null;
}

export interface TreeNode {
  tradeId: string;
  executedAt: string | null;
  weekExecuted: number | null;
  seasonYear: number | null;
  received: PlayerReceived[];
  sent: PlayerSent[];
  nodeDifferential: number;
  cumulativeDifferential: number;
  depth: number;
  aiGrade: string | null;
  children: TreeNode[];
}

interface TradeTreeNodeProps {
  node: TreeNode;
  isDarkMode: boolean;
  isRoot?: boolean;
}

const positionColor: Record<string, string> = {
  QB: 'text-red-400',
  RB: 'text-blue-400',
  WR: 'text-green-400',
  TE: 'text-orange-400',
  K: 'text-purple-400',
  DEF: 'text-yellow-400',
};

export function TradeTreeNodeComponent({
  node,
  isDarkMode,
  isRoot = false,
}: TradeTreeNodeProps) {
  const dateStr = node.executedAt
    ? new Date(node.executedAt).toLocaleDateString()
    : 'Unknown date';

  const diffColor =
    node.nodeDifferential > 0
      ? isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
      : node.nodeDifferential < 0
      ? isDarkMode ? 'text-red-400' : 'text-red-600'
      : isDarkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={isRoot ? '' : 'ml-6 relative'}>
      {/* Connector line from parent */}
      {!isRoot && (
        <div
          className={`absolute left-[-16px] top-0 bottom-0 w-px ${
            isDarkMode ? 'bg-slate-700' : 'bg-slate-200'
          }`}
        />
      )}
      {!isRoot && (
        <div
          className={`absolute left-[-16px] top-5 w-4 h-px ${
            isDarkMode ? 'bg-slate-700' : 'bg-slate-200'
          }`}
        />
      )}

      {/* Trade node card */}
      <div
        className={`rounded-lg border p-3 mb-2 ${
          isDarkMode
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white border-slate-200'
        }`}
      >
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span
            className={`text-xs font-medium ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {dateStr}
            {node.weekExecuted ? ` · Wk ${node.weekExecuted}` : ''}
          </span>
          {node.aiGrade && (
            <span
              className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700'
              }`}
            >
              AI: {node.aiGrade}
            </span>
          )}
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              node.nodeDifferential > 0
                ? isDarkMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
                : node.nodeDifferential < 0
                ? isDarkMode ? 'bg-red-500/20 text-red-300' : 'bg-red-50 text-red-700'
                : isDarkMode ? 'bg-slate-600/30 text-slate-300' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {node.nodeDifferential > 0 ? '+' : ''}
            {node.nodeDifferential} pts
          </span>
        </div>

        {/* Sent / Received */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          {/* Sent */}
          <div>
            <p
              className={`font-semibold uppercase text-[10px] mb-1 ${
                isDarkMode ? 'text-red-400/70' : 'text-red-500/70'
              }`}
            >
              Sent
            </p>
            {node.sent.map((p, i) => (
              <div key={p.playerId ?? `pick-${i}`} className="flex items-baseline gap-1 mb-0.5">
                <span className={positionColor[p.position] || (isDarkMode ? 'text-slate-400' : 'text-slate-500')}>
                  {p.position !== 'UNK' && p.position !== 'PICK' ? `${p.position} ` : ''}
                </span>
                <span className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>
                  {p.playerName}
                </span>
                {p.playerId && (
                  <span className={`${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    · {p.pointsAfterTrade} pts after
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Received */}
          <div>
            <p
              className={`font-semibold uppercase text-[10px] mb-1 ${
                isDarkMode ? 'text-emerald-400/70' : 'text-emerald-500/70'
              }`}
            >
              Received
            </p>
            {node.received.map((p, i) => (
              <div key={p.playerId ?? `pick-${i}`} className="flex items-baseline gap-1 mb-0.5 flex-wrap">
                <span className={positionColor[p.position] || (isDarkMode ? 'text-slate-400' : 'text-slate-500')}>
                  {p.position !== 'UNK' && p.position !== 'PICK' ? `${p.position} ` : ''}
                </span>
                <span className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>
                  {p.playerName}
                </span>
                {p.playerId && (
                  <span className={`${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    · {p.pointsWhileHeld} pts
                    {p.weeksHeld > 0 ? ` (${p.weeksHeld}w)` : ''}
                  </span>
                )}
                {p.tradedAwayInChildIndex != null && (
                  <ArrowRight className={`w-3 h-3 inline ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Node differential summary */}
        <div className={`flex items-center gap-1.5 mt-2 pt-2 border-t text-xs ${
          isDarkMode ? 'border-slate-700' : 'border-slate-100'
        }`}>
          {node.nodeDifferential >= 0 ? (
            <TrendingUp className="w-3 h-3 text-emerald-500" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-500" />
          )}
          <span className={`font-semibold ${diffColor}`}>
            {node.nodeDifferential > 0 ? '+' : ''}
            {node.nodeDifferential} pts at this trade
          </span>
          {node.children.length > 0 && (
            <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>
              · Chain: {node.cumulativeDifferential > 0 ? '+' : ''}
              {node.cumulativeDifferential} pts
            </span>
          )}
        </div>
      </div>

      {/* Render children recursively */}
      {node.children.map((child) => (
        <TradeTreeNodeComponent
          key={child.tradeId}
          node={child}
          isDarkMode={isDarkMode}
        />
      ))}
    </div>
  );
}
