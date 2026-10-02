import { LayoutGrid } from 'lucide-react';

interface SlotCell {
  position: string;
  avgPoints: number;
  deltaPct: number;
  status: 'surplus' | 'balanced' | 'deficit';
  rank: number | null;
  rankOf: number;
  starterCount: number;
}

interface SlotRankGridProps {
  teams: Array<{ id: string; name: string; isUserTeam: boolean; positions: SlotCell[] }>;
  /** Slot columns in display order (the league's slots). */
  columns: string[];
  isDarkMode: boolean;
  /** Same surplus/balanced/deficit coloring as the rest of the page. */
  cellClasses: (status: SlotCell['status'], isDarkMode: boolean) => string;
}

/**
 * Every team against every lineup slot: each cell is the team's league rank at
 * that slot by average points per starter, colored green/red when the slot is
 * 10%+ above/below the league average (the page's surplus/deficit rule).
 */
export function SlotRankGrid({ teams, columns, isDarkMode, cellClasses }: SlotRankGridProps) {
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const ink = isDarkMode ? 'text-white' : 'text-slate-900';
  // The team column stays put while the slots scroll sideways on a phone.
  const stickyBg = isDarkMode ? 'bg-slate-900' : 'bg-white';
  if (teams.length === 0 || columns.length === 0) return null;

  return (
    <section
      className={`rounded-lg border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
      aria-labelledby="slot-grid-heading"
    >
      <div className="flex items-center gap-2 mb-1">
        <LayoutGrid className="w-4 h-4 text-blue-500" aria-hidden="true" />
        <h2 id="slot-grid-heading" className={`font-bold ${ink}`}>Slot Rankings</h2>
      </div>
      <p className={`text-xs mb-4 ${muted}`}>
        Each team's league rank at every lineup slot by average points per starter. Green is 10%+ above the league average for that slot, red 10%+ below.
      </p>
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-sm border-separate" style={{ borderSpacing: '4px' }}>
          <caption className="sr-only">League rank at each lineup slot, by team</caption>
          <thead>
            <tr>
              <th scope="col" className={`sticky left-0 z-10 text-left text-xs font-semibold pb-1 ${stickyBg} ${muted}`}>Team</th>
              {columns.map((c) => (
                <th key={c} scope="col" className={`text-center text-xs font-semibold pb-1 min-w-[48px] ${muted}`}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => {
              const byPos = new Map(team.positions.map((p) => [p.position, p]));
              return (
                <tr key={team.id}>
                  <th
                    scope="row"
                    className={`sticky left-0 z-10 text-left font-medium pr-2 whitespace-nowrap max-w-[140px] sm:max-w-[180px] truncate ${stickyBg} ${team.isUserTeam ? 'text-blue-500' : ink}`}
                    title={team.name}
                  >
                    {team.name}{team.isUserTeam ? ' (you)' : ''}
                  </th>
                  {columns.map((c) => {
                    const p = byPos.get(c);
                    const ranked = p && p.rank != null;
                    return (
                      <td
                        key={c}
                        className={`text-center rounded border py-1.5 text-xs font-semibold tabular-nums ${ranked ? cellClasses(p!.status, isDarkMode) : `${muted} ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}`}
                        title={ranked ? `${c}: #${p!.rank} of ${p!.rankOf} — ${p!.avgPoints.toFixed(1)} PPG per starter (${p!.deltaPct > 0 ? '+' : ''}${p!.deltaPct.toFixed(1)}% vs league)` : `No ${c} starter`}
                      >
                        {ranked ? `#${p!.rank}` : '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
