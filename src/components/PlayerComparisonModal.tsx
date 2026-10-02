import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { Player } from '../App';

const POSITION_COLORS: Record<string, string> = {
  QB: 'text-red-500',
  RB: 'text-emerald-500',
  WR: 'text-blue-500',
  TE: 'text-orange-500',
  K: 'text-purple-500',
  DEF: 'text-slate-500',
  FLEX: 'text-slate-400',
};

interface PlayerComparisonModalProps {
  players: Player[];
  isDarkMode: boolean;
  onClose: () => void;
  onRemove: (playerId: string) => void;
}

export function PlayerComparisonModal({ players, isDarkMode, onClose, onRemove }: PlayerComparisonModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Player comparison">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative w-full max-w-4xl max-h-[95vh] sm:max-h-[85vh] overflow-auto rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Compare players ({players.length})
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comparison"
            className={`inline-flex items-center justify-center w-11 h-11 sm:w-8 sm:h-8 rounded-lg border ${isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex gap-3 overflow-x-auto">
          {players.map((p) => {
            const posColor = POSITION_COLORS[p.position] || 'text-slate-400';
            const rows: { label: string; value: string; color?: string }[] = [
              { label: 'Rank', value: `#${p.rank}` },
              { label: 'Proj Pts', value: p.projectedPoints != null ? p.projectedPoints.toFixed(1) : '—' },
              {
                label: 'Week Δ',
                value: p.weekChange != null ? (p.weekChange > 0 ? `+${p.weekChange.toFixed(1)}` : p.weekChange.toFixed(1)) : '—',
                color: p.weekChange > 0 ? 'text-emerald-500' : p.weekChange < 0 ? 'text-red-500' : undefined,
              },
              { label: 'This Week Proj', value: p.weeklyProjectedPoints != null ? p.weeklyProjectedPoints.toFixed(1) : '—' },
            ];
            return (
              <div
                key={p.id}
                className={`min-w-[200px] flex-1 rounded-xl border p-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{p.name}</div>
                    <div className="fr-text-11">
                      <span className={`font-bold ${posColor}`}>{p.position}</span>
                      <span className={`ml-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{p.team}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(p.id)}
                    aria-label={`Remove ${p.name} from comparison`}
                    className={`flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md border ${isDarkMode ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-400 hover:bg-white'}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="mt-3 space-y-1.5">
                  {rows.map(({ label, value, color }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{label}</span>
                      <span className={`font-bold ${color ?? (isDarkMode ? 'text-white' : 'text-slate-900')}`}>{value}</span>
                    </div>
                  ))}
                </div>

                {p.keyLine && (
                  <div className={`mt-3 pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                    <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{p.keyLine}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
