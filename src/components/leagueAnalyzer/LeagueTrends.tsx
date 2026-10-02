import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp, Table2, LineChart as LineChartIcon } from 'lucide-react';
import api, { ApiError } from '../../services/api';

// ── Types (mirror GET /api/league-analyzer/:leagueId/history) ─────────────────

interface HistoryTeamWeek {
  teamId: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  standingsRank: number;
  scoringRank: number;
  playoffOdds: number;
}

interface LeagueHistory {
  seasonYear: number;
  playoffTeams: number;
  teams: Array<{ id: string; name: string }>;
  weeks: Array<{ week: number; teams: HistoryTeamWeek[] }>;
  /** Null when the viewer isn't Pro/Elite; empty when no pulse has been generated. */
  aiPowerRankings: Array<{ week: number; ranking: string[] }> | null;
}

type Metric = 'odds' | 'standings' | 'scoring' | 'power';

const METRICS: Array<{ key: Metric; label: string; isRank: boolean; describe: string }> = [
  { key: 'odds', label: 'Playoff odds', isRank: false, describe: 'Playoff odds after each week, from the same 5,000-run simulation as above, replayed from that week\'s records.' },
  { key: 'standings', label: 'Standings', isRank: true, describe: 'Win-loss standings rank after each week (points for breaks ties).' },
  { key: 'scoring', label: 'Scoring rank', isRank: true, describe: 'Rank by points per game after each week.' },
  { key: 'power', label: 'AI power rank', isRank: true, describe: 'The FilmRoom AI power ranking for each week it was generated.' },
];

/** Emphasis palette: one highlighted team, everything else is gray context. Validated against both card surfaces. */
const HIGHLIGHT = { light: '#2a78d6', dark: '#3987e5' };
const CONTEXT = { light: '#94a3b8', dark: '#64748b' };

interface LeagueTrendsProps {
  leagueId: string;
  isDarkMode: boolean;
  /** Team highlighted by default (the viewer's own team, when known). */
  defaultTeamId: string | null;
}

export function LeagueTrends({ leagueId, isDarkMode, defaultTeamId }: LeagueTrendsProps) {
  const [history, setHistory] = useState<LeagueHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<Metric>('odds');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(defaultTeamId);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.get<LeagueHistory>(`/league-analyzer/${leagueId}/history`)
      .then((res) => { if (!cancelled) setHistory(res); })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : 'Trends are temporarily unavailable.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [leagueId]);

  // Follow the viewer's team once it's known, unless they've picked another.
  useEffect(() => {
    setSelectedTeamId((current) => current ?? defaultTeamId);
  }, [defaultTeamId]);

  const nameById = useMemo(() => new Map((history?.teams ?? []).map((t) => [t.id, t.name])), [history]);
  const selected = selectedTeamId && nameById.has(selectedTeamId) ? selectedTeamId : history?.teams[0]?.id ?? null;
  const hasPower = !!history?.aiPowerRankings && history.aiPowerRankings.length > 0;
  const metricInfo = METRICS.find((m) => m.key === metric)!;
  const teamCount = history?.teams.length ?? 0;

  // One row per week: { week, [teamId]: value }.
  const rows = useMemo(() => {
    if (!history) return [] as Array<Record<string, number>>;
    if (metric === 'power') {
      return (history.aiPowerRankings ?? []).map((p) => {
        const row: Record<string, number> = { week: p.week };
        p.ranking.forEach((id, i) => { row[id] = i + 1; });
        return row;
      });
    }
    return history.weeks.map((w) => {
      const row: Record<string, number> = { week: w.week };
      for (const t of w.teams) {
        row[t.teamId] = metric === 'odds' ? t.playoffOdds : metric === 'standings' ? t.standingsRank : t.scoringRank;
      }
      return row;
    });
  }, [history, metric]);

  const card = `rounded-lg border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`;
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const ink = isDarkMode ? 'text-white' : 'text-slate-900';
  const highlight = isDarkMode ? HIGHLIGHT.dark : HIGHLIGHT.light;
  const context = isDarkMode ? CONTEXT.dark : CONTEXT.light;
  const grid = isDarkMode ? '#1e293b' : '#e2e8f0';
  const axis = isDarkMode ? '#94a3b8' : '#64748b';

  const formatValue = (v: number) => (metricInfo.isRank ? `#${v}` : `${v}%`);

  return (
    <section className={card} aria-labelledby="league-trends-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-500" aria-hidden="true" />
          <h2 id="league-trends-heading" className={`font-bold ${ink}`}>Season Trends</h2>
        </div>
        {history && history.weeks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <label className={`text-xs ${muted}`} htmlFor="trend-team">Highlight</label>
            <select
              id="trend-team"
              value={selected ?? ''}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className={`text-sm rounded-md border px-2 py-1 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
            >
              {history.teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.id === defaultTeamId ? ' (you)' : ''}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              aria-pressed={showTable}
              className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-md border ${isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}
            >
              {showTable ? <LineChartIcon className="w-3.5 h-3.5" aria-hidden="true" /> : <Table2 className="w-3.5 h-3.5" aria-hidden="true" />}
              {showTable ? 'Chart' : 'Table'}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className={`animate-pulse h-48 rounded ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
      ) : error ? (
        <p className={`text-sm ${muted}`}>{error}</p>
      ) : !history || history.weeks.length === 0 ? (
        <p className={`text-sm ${muted}`}>Trends appear once the first week of the season is complete.</p>
      ) : (
        <>
          <div role="tablist" aria-label="Trend metric" className="flex flex-wrap gap-1 mb-2">
            {METRICS.filter((m) => m.key !== 'power' || hasPower).map((m) => (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={metric === m.key}
                onClick={() => setMetric(m.key)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                  metric === m.key
                    ? 'bg-blue-600 text-white'
                    : isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className={`text-xs mb-3 ${muted}`}>{metricInfo.describe}</p>

          {rows.length === 0 ? (
            <p className={`text-sm ${muted}`}>No AI power rankings have been generated for this league yet.</p>
          ) : showTable ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{metricInfo.label} by week</caption>
                <thead>
                  <tr className={`border-b text-left ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                    <th scope="col" className={`py-1.5 pr-3 text-xs font-semibold ${muted}`}>Team</th>
                    {rows.map((r) => (
                      <th key={r.week} scope="col" className={`py-1.5 px-2 text-xs font-semibold text-right ${muted}`}>Wk {r.week}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.teams.map((t) => (
                    <tr key={t.id} className={`border-b last:border-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                      <th scope="row" className={`py-1.5 pr-3 text-left font-medium whitespace-nowrap ${t.id === selected ? ink : muted}`}>{t.name}</th>
                      {rows.map((r) => (
                        <td key={r.week} className={`py-1.5 px-2 text-right tabular-nums ${t.id === selected ? `font-semibold ${ink}` : muted}`}>
                          {r[t.id] != null ? formatValue(r[t.id]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              <div className="h-64" role="img" aria-label={`${metricInfo.label} by week, highlighting ${nameById.get(selected ?? '') ?? 'one team'}. Use the Table button for the values.`}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid stroke={grid} strokeWidth={1} vertical={false} />
                    <XAxis
                      dataKey="week"
                      tickFormatter={(w) => `Wk ${w}`}
                      stroke={axis}
                      tick={{ fill: axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: grid }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      reversed={metricInfo.isRank}
                      domain={metricInfo.isRank ? [1, Math.max(teamCount, 1)] : [0, 100]}
                      allowDecimals={false}
                      tickFormatter={(v) => (metricInfo.isRank ? `#${v}` : `${v}%`)}
                      ticks={metricInfo.isRank ? rankTicks(teamCount) : [0, 25, 50, 75, 100]}
                      // Show every tick (the library otherwise drops the edge one, e.g. "#1"),
                      // and pad so lines at the first and last rank aren't clipped.
                      interval={0}
                      padding={{ top: 6, bottom: 6 }}
                      stroke={axis}
                      tick={{ fill: axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                    />
                    <Tooltip
                      cursor={{ stroke: axis, strokeWidth: 1 }}
                      content={({ active, label, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const row = payload[0].payload as Record<string, number>;
                        const sorted = history.teams
                          .filter((t) => row[t.id] != null)
                          .sort((a, b) => (metricInfo.isRank ? row[a.id] - row[b.id] : row[b.id] - row[a.id]));
                        return (
                          <div className={`rounded-md border px-3 py-2 text-xs shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                            <div className={`font-semibold mb-1 ${ink}`}>Week {label}</div>
                            {sorted.map((t) => (
                              <div key={t.id} className={`flex justify-between gap-4 ${t.id === selected ? `font-semibold ${ink}` : muted}`}>
                                <span className="flex items-center gap-1.5">
                                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: t.id === selected ? highlight : context }} />
                                  {t.name}
                                </span>
                                <span className="tabular-nums">{formatValue(row[t.id])}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    {/* Context lines first so the highlighted team draws on top. */}
                    {history.teams.filter((t) => t.id !== selected).map((t) => (
                      <Line
                        key={t.id}
                        type="monotone"
                        dataKey={t.id}
                        stroke={context}
                        strokeOpacity={0.45}
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
                        connectNulls
                      />
                    ))}
                    {selected && (
                      <Line
                        key={selected}
                        type="monotone"
                        dataKey={selected}
                        stroke={highlight}
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: highlight, stroke: isDarkMode ? '#0f172a' : '#ffffff', strokeWidth: 2 }}
                        activeDot={{ r: 5, fill: highlight, stroke: isDarkMode ? '#0f172a' : '#ffffff', strokeWidth: 2 }}
                        isAnimationActive={false}
                        connectNulls
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs ${muted}`} aria-hidden="true">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-4 h-0.5 rounded" style={{ background: highlight }} />
                  <span className={ink}>{nameById.get(selected ?? '')}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-4 h-0.5 rounded" style={{ background: context, opacity: 0.7 }} />
                  Other teams
                </span>
                {metric === 'odds' && <span>Top {history.playoffTeams} make the playoffs</span>}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

/** Rank axis ticks: every rank in small leagues, every other one in big leagues. */
function rankTicks(n: number): number[] {
  if (n <= 0) return [1];
  const step = n > 12 ? 2 : 1;
  const ticks: number[] = [];
  for (let r = 1; r <= n; r += step) ticks.push(r);
  if (ticks[ticks.length - 1] !== n) ticks.push(n);
  return ticks;
}
