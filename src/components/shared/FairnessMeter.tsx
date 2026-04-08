/**
 * FairnessMeter — shared display for trade fairness scores.
 *
 * Used by both the Trade Analyzer (manual entry) and the Trade Finder
 * (AI-constructed recommendations) so the two features show the same
 * visual language and the same score labels for the same trades.
 *
 * Score semantics:
 *  - score 0..100 with 50 = perfectly fair
 *  - diff = |score - 50|
 *  - label bands match the manual analyzer:
 *      diff < 5  → Perfectly Fair     (emerald)
 *      diff < 15 → Slightly Favored   (lime)
 *      diff < 30 → Favored            (amber)
 *      else      → Heavily Favored    (orange)
 */

interface FairnessMeterProps {
  score: number;
  favored: string;
  isDarkMode: boolean;
  /** Optional compact mode for the Trade Finder card — hides the
   *  0/50/100 axis labels and shrinks spacing. */
  compact?: boolean;
}

export function FairnessMeter({
  score,
  favored,
  isDarkMode,
  compact = false,
}: FairnessMeterProps) {
  const leftPct = Math.max(0, Math.min(100, score));
  const diff = Math.abs(score - 50);

  const label =
    diff < 5
      ? 'Perfectly Fair'
      : diff < 15
      ? 'Slightly Favored'
      : diff < 30
      ? 'Favored'
      : 'Heavily Favored';

  const barColor =
    diff < 5
      ? isDarkMode
        ? 'bg-emerald-500'
        : 'bg-emerald-600'
      : diff < 15
      ? isDarkMode
        ? 'bg-lime-500'
        : 'bg-lime-600'
      : diff < 30
      ? isDarkMode
        ? 'bg-amber-500'
        : 'bg-amber-600'
      : isDarkMode
      ? 'bg-orange-500'
      : 'bg-orange-600';

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <div className="flex items-center justify-between">
        <p
          className={`${compact ? 'text-xs' : 'text-sm'} font-semibold ${
            isDarkMode ? 'text-slate-300' : 'text-slate-700'
          }`}
        >
          Fairness
        </p>
        <p
          className={`text-xs font-medium ${
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          {label} — {diff < 5 ? 'even' : favored}
        </p>
      </div>
      <div
        className={`relative h-3 rounded-full overflow-hidden ${
          isDarkMode ? 'bg-slate-800' : 'bg-slate-200'
        }`}
      >
        {/* Fair midpoint marker */}
        <div
          className={`absolute top-0 bottom-0 w-px ${
            isDarkMode ? 'bg-slate-600' : 'bg-slate-400'
          }`}
          style={{ left: '50%' }}
        />
        {/* Score marker */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 ${
            isDarkMode ? 'border-white' : 'border-slate-900'
          } ${barColor} transition-all duration-500`}
          style={{ left: `calc(${leftPct}% - 8px)` }}
        />
      </div>
      {!compact && (
        <div
          className={`flex justify-between text-[10px] font-medium ${
            isDarkMode ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          <span>0 • Team A robs</span>
          <span>50 • Fair</span>
          <span>Team B robs • 100</span>
        </div>
      )}
    </div>
  );
}
