import { useMemo, useState } from 'react';
import { LayoutGrid, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

interface SlotCell {
  position: string;
  avgPoints: number;
  deltaPct: number;
  status: 'surplus' | 'balanced' | 'deficit';
  rank: number | null;
  rankOf: number;
  starterCount: number;
}

interface GridTeam {
  id: string;
  name: string;
  isUserTeam: boolean;
  positions: SlotCell[];
}

interface SlotRankGridProps {
  teams: GridTeam[];
  /** Slot columns in display order (the league's slots). */
  columns: string[];
  isDarkMode: boolean;
  /** Same surplus/balanced/deficit coloring as the rest of the page. */
  cellClasses: (status: SlotCell['status'], isDarkMode: boolean) => string;
}

export type SlotSort = { column: string; direction: 'best' | 'worst' } | null;

/**
 * Order teams by their rank at one slot. "best" puts #1 first; "worst" puts
 * the lowest-ranked first. Teams with no starter at the slot always go last,
 * and ties keep the incoming order. A null sort returns the incoming order.
 */
export function sortTeamsBySlot<T extends { positions: Array<{ position: string; rank: number | null }> }>(
  teams: T[],
  sort: SlotSort,
): T[] {
  if (!sort) return teams;
  const rankOf = (t: T) => t.positions.find((p) => p.position === sort.column)?.rank ?? null;
  return teams
    .map((team, index) => ({ team, index, rank: rankOf(team) }))
    .sort((a, b) => {
      if (a.rank == null && b.rank == null) return a.index - b.index;
      if (a.rank == null) return 1;
      if (b.rank == null) return -1;
      const diff = sort.direction === 'best' ? a.rank - b.rank : b.rank - a.rank;
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map((x) => x.team);
}

/**
 * Every team against every lineup slot: each cell is the team's league rank at
 * that slot by average points per starter, colored green/red when the slot is
 * 10%+ above/below the league average (the page's surplus/deficit rule).
 * Clicking a slot header sorts teams by that slot (best first, then worst
 * first); clicking Team restores the page's order.
 */
export function SlotRankGrid({ teams, columns, isDarkMode, cellClasses }: SlotRankGridProps) {
  const [sort, setSort] = useState<SlotSort>(null);
  const sortedTeams = useMemo(
    () => sortTeamsBySlot(teams, sort && columns.includes(sort.column) ? sort : null),
    [teams, sort, columns],
  );

  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const ink = isDarkMode ? 'text-white' : 'text-slate-900';
  // The team column stays put while the slots scroll sideways on a phone.
  const stickyBg = isDarkMode ? 'bg-slate-900' : 'bg-white';
  const headerButton = `inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`;
  if (teams.length === 0 || columns.length === 0) return null;

  const onSlotClick = (column: string) =>
    setSort((s) => (s?.column === column ? { column, direction: s.direction === 'best' ? 'worst' : 'best' } : { column, direction: 'best' }));

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
        Each team's league rank at every lineup slot by average points per starter. Green is 10%+ above the league average for that slot, red 10%+ below. Click a slot to sort by it.
      </p>
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-sm border-separate" style={{ borderSpacing: '4px' }}>
          <caption className="sr-only">League rank at each lineup slot, by team</caption>
          <thead>
            <tr>
              <th
                scope="col"
                aria-sort="none"
                className={`sticky left-0 z-10 text-left text-xs font-semibold pb-1 ${stickyBg} ${muted}`}
              >
                <button
                  type="button"
                  onClick={() => setSort(null)}
                  className={`${headerButton} -ml-1.5 ${sort ? '' : ink}`}
                  title="Back to the page's order"
                >
                  Team
                </button>
              </th>
              {columns.map((c) => {
                const active = sort?.column === c;
                const Icon = !active ? ArrowUpDown : sort.direction === 'best' ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c}
                    scope="col"
                    aria-sort={active ? (sort.direction === 'best' ? 'ascending' : 'descending') : 'none'}
                    className={`text-center text-xs font-semibold pb-1 min-w-[48px] ${active ? 'text-blue-500' : muted}`}
                  >
                    <button
                      type="button"
                      onClick={() => onSlotClick(c)}
                      className={headerButton}
                      title={
                        active && sort.direction === 'best'
                          ? `Sorted by ${c}, best first. Click for worst first.`
                          : `Sort by ${c} rank, best first`
                      }
                    >
                      {c}
                      <Icon className={`w-3 h-3 ${active ? '' : 'opacity-40'}`} aria-hidden="true" />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedTeams.map((team) => {
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
                    const inSortedColumn = sort?.column === c;
                    return (
                      <td
                        key={c}
                        className={`text-center rounded border py-1.5 text-xs font-semibold tabular-nums ${ranked ? cellClasses(p!.status, isDarkMode) : `${muted} ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`} ${inSortedColumn ? 'ring-1 ring-blue-500/60' : ''}`}
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
