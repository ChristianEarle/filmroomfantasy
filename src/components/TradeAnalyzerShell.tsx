import { useState } from 'react';
import { ArrowRightLeft, History } from 'lucide-react';
import { TradeAnalyzerView } from './TradeAnalyzerView';
import { TradeHistoryView } from './TradeHistoryView';

type Tab = 'analyzer' | 'history';

interface TradeAnalyzerShellProps {
  isDarkMode: boolean;
}

/**
 * Shell that hosts the trade-related tabs: Analyzer and History.
 * (Trade Finder is currently hidden — see note above.)
 */
export function TradeAnalyzerShell({ isDarkMode }: TradeAnalyzerShellProps) {
  const [tab, setTab] = useState<Tab>('analyzer');

  const tabs: Array<{ id: Tab; label: string; icon: typeof ArrowRightLeft }> = [
    { id: 'analyzer', label: 'Analyzer', icon: ArrowRightLeft },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div
        className={`max-w-6xl mx-auto flex items-center gap-1 p-1 rounded-xl border overflow-x-auto ${
          isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isDarkMode
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'analyzer' && <TradeAnalyzerView isDarkMode={isDarkMode} />}
      {tab === 'history' && <TradeHistoryView isDarkMode={isDarkMode} />}
    </div>
  );
}
