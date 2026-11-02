import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '../services/api';
import type { CompareStub } from '../hooks/useCompareBasket';

interface PlayerStatsResponse {
  seasonTotals?: {
    gamesPlayed?: number;
    games?: number;
    fantasyPointsPPR?: number;
    fantasyPointsHalf?: number;
    fantasyPointsStd?: number;
  };
  averagePointsPPR?: number;
  averagePointsHalf?: number;
  averagePointsStd?: number;
}

interface CompareRow {
  stub: CompareStub;
  loading: boolean;
  gamesPlayed: number | null;
  ppg: number | null;
  seasonTotal: number | null;
}

const POSITION_COLORS: Record<string, string> = {
  QB: 'text-red-400',
  RB: 'text-green-400',
  WR: 'text-blue-400',
  TE: 'text-orange-400',
};

interface PlayerCompareModalProps {
  players: CompareStub[];
  isDarkMode: boolean;
  seasonYear?: number;
  /** Normalized scoring format, matching PlayerCard's own convention. */
  scoringFormat?: 'ppr' | 'half_ppr' | 'standard';
  onClose: () => void;
  onRemove: (id: string) => void;
}

export function PlayerCompareModal({
  players,
  isDarkMode,
  seasonYear,
  scoringFormat = 'ppr',
  onClose,
  onRemove,
}: PlayerCompareModalProps) {
  const [rows, setRows] = useState<CompareRow[]>(
    players.map((stub) => ({ stub, loading: true, gamesPlayed: null, ppg: null, seasonTotal: null })),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setRows(players.map((stub) => ({ stub, loading: true, gamesPlayed: null, ppg: null, seasonTotal: null })));

    const season = seasonYear || new Date().getFullYear();
    Promise.all(
      players.map(async (stub) => {
        try {
          const res = await api.get<PlayerStatsResponse>(`/players/${stub.id}/stats?season=${season}`);
          const ppg = scoringFormat === 'half_ppr'
            ? res.averagePointsHalf ?? null
            : scoringFormat === 'standard'
            ? res.averagePointsStd ?? null
            : res.averagePointsPPR ?? null;
          const seasonTotal = scoringFormat === 'half_ppr'
            ? res.seasonTotals?.fantasyPointsHalf ?? null
            : scoringFormat === 'standard'
            ? res.seasonTotals?.fantasyPointsStd ?? null
            : res.seasonTotals?.fantasyPointsPPR ?? null;
          const gamesPlayed = res.seasonTotals?.gamesPlayed ?? res.seasonTotals?.games ?? null;
          return { stub, loading: false, gamesPlayed, ppg: ppg ?? null, seasonTotal: seasonTotal ?? null };
        } catch {
          return { stub, loading: false, gamesPlayed: null, ppg: null, seasonTotal: null };
        }
      }),
    ).then((results) => { if (!cancelled) setRows(results); });

    return () => { cancelled = true; };
  }, [players, seasonYear, scoringFormat]);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Player comparison">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative w-full max-w-4xl max-h-[95vh] sm:max-h-[85vh] overflow-auto rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Compare players ({rows.length})
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
          {rows.map(({ stub, loading, gamesPlayed, ppg, seasonTotal }) => {
            const posColor = POSITION_COLORS[stub.position] || 'text-slate-400';
            const statRows: { label: string; value: string }[] = [
              { label: 'Games', value: gamesPlayed != null ? String(gamesPlayed) : '—' },
              { label: 'PPG', value: ppg != null ? ppg.toFixed(1) : '—' },
              { label: 'Season Pts', value: seasonTotal != null ? seasonTotal.toFixed(1) : '—' },
            ];
            return (
              <div
                key={stub.id}
                className={`min-w-[200px] flex-1 rounded-xl border p-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stub.name}</div>
                    <div className="fr-text-11">
                      <span className={`font-bold ${posColor}`}>{stub.position}</span>
                      <span className={`ml-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{stub.team}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(stub.id)}
                    aria-label={`Remove ${stub.name} from comparison`}
                    className={`flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md border ${isDarkMode ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-400 hover:bg-white'}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="mt-3 space-y-1.5">
                  {loading ? (
                    <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Loading…</div>
                  ) : (
                    statRows.map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{label}</span>
                        <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{value}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
