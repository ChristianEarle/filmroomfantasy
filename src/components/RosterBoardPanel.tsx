import { useMemo } from 'react';
import { useLeagueContext } from '../context/LeagueContext';

interface RosterBoardPanelProps {
  currentWeek: number;
  onViewTeam?: () => void;
  isDarkMode: boolean;
}

const POS_COLORS: Record<string, string> = {
  QB: 'bg-red-500/15 text-red-500',
  RB: 'bg-green-500/15 text-green-500',
  WR: 'bg-blue-500/15 text-blue-500',
  TE: 'bg-amber-500/15 text-amber-500',
  K: 'bg-purple-500/15 text-purple-500',
  DEF: 'bg-slate-500/15 text-slate-500',
};

/**
 * Compact roster widget shown in the right sidebar of the Player
 * Rankings / Board view. Lists the user's starters with projected
 * (or actual when available) points for the current week.
 */
export function RosterBoardPanel({ currentWeek, onViewTeam, isDarkMode }: RosterBoardPanelProps) {
  const { roster, league } = useLeagueContext();

  const starters = useMemo(
    () => roster.filter((p) => p.isStarter).slice(0, 12),
    [roster],
  );

  const panelCls = `rounded-xl border ${
    isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
  }`;

  // Boom/Bust split for "Over/Under" widget — only rostered players.
  const overUnder = useMemo(() => {
    const played = roster.filter(
      (p) =>
        p.actualPoints != null &&
        p.projectedPoints != null &&
        p.projectedPoints > 0,
    );
    const withDelta = played.map((p) => ({
      player: p,
      delta: (p.actualPoints ?? 0) - p.projectedPoints,
    }));
    const booms = withDelta
      .filter((x) => x.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 4);
    const busts = withDelta
      .filter((x) => x.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 4);
    return { booms, busts };
  }, [roster]);

  if (!league) {
    return (
      <div className={`${panelCls} p-4`}>
        <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Sync a league to see your roster here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Your Roster */}
      <div className={panelCls}>
        <div className={`flex items-center gap-2 p-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Your Roster
          </h3>
          <span className={`fr-text-10 font-bold uppercase fr-tracking-wider px-1.5 py-0.5 rounded ${
            isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
          }`}>
            WK {currentWeek}
          </span>
          {onViewTeam && (
            <button
              type="button"
              onClick={onViewTeam}
              className={`ml-auto fr-text-11 font-semibold transition-colors ${
                isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Full lineup →
            </button>
          )}
        </div>
        <div>
          {starters.length === 0 ? (
            <p className={`text-sm p-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              No starters set yet this week.
            </p>
          ) : (
            starters.map((p) => {
              const pts =
                p.actualPoints != null
                  ? p.actualPoints
                  : p.projectedPoints ?? 0;
              const isActual = p.actualPoints != null;
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 px-4 py-2 border-b last:border-b-0 ${
                    isDarkMode ? 'border-slate-800' : 'border-slate-100'
                  }`}
                >
                  <span className={`fr-text-10 font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                    POS_COLORS[p.slot] || POS_COLORS[p.position] || 'bg-slate-500/15 text-slate-500'
                  }`}>
                    {p.slot || p.position}
                  </span>
                  <span className={`flex-1 min-w-0 text-sm font-semibold truncate ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    {p.name}
                  </span>
                  <span className={`text-sm font-bold tabular-nums ${
                    isActual
                      ? isDarkMode ? 'text-white' : 'text-slate-900'
                      : isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    {pts.toFixed(1)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Over/Under — booms + busts from the roster */}
      {(overUnder.booms.length > 0 || overUnder.busts.length > 0) && (
        <div className={panelCls}>
          <div className={`flex items-center gap-2 p-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Over / Under
            </h3>
            <span className={`fr-text-10 font-bold uppercase fr-tracking-wider px-1.5 py-0.5 rounded ${
              isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
            }`}>
              Booms · Busts
            </span>
          </div>
          <div>
            {overUnder.booms.map((x) => (
              <div
                key={`boom-${x.player.id}`}
                className={`flex items-center gap-2 px-4 py-2 border-b last:border-b-0 ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-100'
                }`}
              >
                <span className={`fr-text-10 font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                  POS_COLORS[x.player.position] || 'bg-slate-500/15 text-slate-500'
                }`}>
                  {x.player.position}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {x.player.name}
                  </div>
                  <div className={`fr-text-11 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {x.player.team} · Proj {x.player.projectedPoints?.toFixed(1) ?? '—'}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {x.player.actualPoints?.toFixed(1)}
                  </div>
                  <div className="fr-text-11 font-bold text-emerald-500">
                    +{x.delta.toFixed(1)}
                  </div>
                </div>
              </div>
            ))}
            {overUnder.busts.map((x) => (
              <div
                key={`bust-${x.player.id}`}
                className={`flex items-center gap-2 px-4 py-2 border-b last:border-b-0 ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-100'
                }`}
              >
                <span className={`fr-text-10 font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                  POS_COLORS[x.player.position] || 'bg-slate-500/15 text-slate-500'
                }`}>
                  {x.player.position}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {x.player.name}
                  </div>
                  <div className={`fr-text-11 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {x.player.team} · Proj {x.player.projectedPoints?.toFixed(1) ?? '—'}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {x.player.actualPoints?.toFixed(1)}
                  </div>
                  <div className="fr-text-11 font-bold text-red-500">
                    {x.delta.toFixed(1)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
