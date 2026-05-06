import { useEffect, useState, useMemo, type CSSProperties } from 'react';
import { ArrowLeft, Calendar, Clock, TrendingUp, Sparkles } from 'lucide-react';
import api from '../services/api';
import { playerService } from '../services';
import type { PlayerNews, MatchupGradeResponse, Player as ApiPlayer } from '../services/players';
import { PlayerAvatar } from './PlayerAvatar';
import { NewsSnippet } from './NewsSnippet';
import { SEO, getPlayerProfileSEOProps } from './SEO';
import { buildPlayerProfilePath } from '../utils/slug';

interface PlayerProfileViewProps {
  playerId: string;
  isDarkMode: boolean;
  seasonYear?: number;
  currentWeek?: number;
  scoringFormat?: string;
  onBack: () => void;
  onOpenQuickLook?: (player: { id: string; name: string; team: string; position: ApiPlayer['position']; headshotUrl?: string | null }) => void;
}

interface APIWeeklyStat {
  week: number;
  seasonYear: number;
  opponent?: string | null;
  passYards?: number;
  passTDs?: number;
  passInterceptions?: number;
  passAttempts?: number;
  passCompletions?: number;
  rushYards?: number;
  rushTDs?: number;
  rushAttempts?: number;
  receptions?: number;
  receivingYards?: number;
  receivingTDs?: number;
  targets?: number;
  fgMade?: number;
  fgAttempts?: number;
  xpMade?: number;
  xpAttempts?: number;
  sacks?: number;
  defInterceptions?: number;
  fumblesRecovered?: number;
  defenseTDs?: number;
  pointsAllowed?: number;
  fantasyPointsPPR?: number;
  fantasyPointsHalf?: number;
  fantasyPointsStd?: number;
  snapPct?: number | null;
}

interface PlayerDetail extends ApiPlayer {
  height?: string;
  weight?: number;
  college?: string;
  depthChartOrder?: number;
}

function formatTimeAgo(dateString: string | Date): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

function getMatchupGradeLabel(grade: string | null | undefined): string {
  if (!grade) return '—';
  if (grade.startsWith('A')) return 'Elite';
  if (grade.startsWith('B')) return 'Good';
  if (grade.startsWith('C')) return 'Average';
  return 'Tough';
}

function getGradeStyle(grade: string | null | undefined, isDarkMode: boolean): CSSProperties {
  if (!grade) return { color: isDarkMode ? '#64748b' : '#94a3b8', backgroundColor: isDarkMode ? 'rgba(30,41,59,0.6)' : '#f1f5f9', borderColor: isDarkMode ? '#475569' : '#e2e8f0' };
  if (grade.startsWith('A')) return { color: isDarkMode ? '#34d399' : '#059669', backgroundColor: isDarkMode ? 'rgba(16,185,129,0.25)' : '#d1fae5', borderColor: isDarkMode ? 'rgba(16,185,129,0.4)' : '#6ee7b7' };
  if (grade.startsWith('B')) return { color: isDarkMode ? '#60a5fa' : '#2563eb', backgroundColor: isDarkMode ? 'rgba(59,130,246,0.25)' : '#dbeafe', borderColor: isDarkMode ? 'rgba(59,130,246,0.4)' : '#93c5fd' };
  if (grade.startsWith('C')) return { color: isDarkMode ? '#fbbf24' : '#d97706', backgroundColor: isDarkMode ? 'rgba(245,158,11,0.25)' : '#fef3c7', borderColor: isDarkMode ? 'rgba(245,158,11,0.4)' : '#fcd34d' };
  return { color: isDarkMode ? '#fb7185' : '#e11d48', backgroundColor: isDarkMode ? 'rgba(244,63,94,0.25)' : '#ffe4e6', borderColor: isDarkMode ? 'rgba(244,63,94,0.4)' : '#fda4af' };
}

function statusPillClasses(status: string): string {
  if (status === 'injured_reserve' || status === 'out') return 'bg-red-500/20 text-red-400';
  if (status === 'questionable') return 'bg-yellow-500/20 text-yellow-400';
  if (status === 'doubtful') return 'bg-orange-500/20 text-orange-400';
  return 'bg-slate-500/20 text-slate-400';
}

function statusLabel(status: string): string {
  if (status === 'injured_reserve') return 'IR';
  return status.toUpperCase();
}

export function PlayerProfileView({
  playerId,
  isDarkMode,
  seasonYear,
  currentWeek,
  scoringFormat,
  onBack,
  onOpenQuickLook,
}: PlayerProfileViewProps) {
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [playerLoading, setPlayerLoading] = useState(true);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const [weeklyStats, setWeeklyStats] = useState<APIWeeklyStat[] | null>(null);
  const [seasonTotals, setSeasonTotals] = useState<{ games?: number; gamesPlayed?: number; fantasyPointsPPR?: number; fantasyPointsHalf?: number; fantasyPointsStd?: number } | null>(null);
  const [averagePoints, setAveragePoints] = useState<{ ppr: number | null; half: number | null; std: number | null }>({ ppr: null, half: null, std: null });
  const [statsLoading, setStatsLoading] = useState(true);

  const [news, setNews] = useState<PlayerNews[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

  const [matchupData, setMatchupData] = useState<MatchupGradeResponse | null>(null);
  const [matchupLoading, setMatchupLoading] = useState(true);

  const [propsData, setPropsData] = useState<any>(null);
  const [propsLoading, setPropsLoading] = useState(true);

  const week = currentWeek ?? 1;
  const season = seasonYear ?? new Date().getFullYear();

  const normalizedFormat = scoringFormat === 'half_ppr' ? 'half_ppr' : scoringFormat === 'standard' ? 'standard' : 'ppr';
  const scoringLabel = normalizedFormat === 'half_ppr' ? 'Half PPR' : normalizedFormat === 'standard' ? 'Standard' : 'PPR';

  const getFantasyPoints = (s: APIWeeklyStat): number => {
    if (normalizedFormat === 'half_ppr') return s.fantasyPointsHalf ?? s.fantasyPointsPPR ?? 0;
    if (normalizedFormat === 'standard') return s.fantasyPointsStd ?? s.fantasyPointsPPR ?? 0;
    return s.fantasyPointsPPR ?? 0;
  };

  const currentAverage = normalizedFormat === 'half_ppr' ? averagePoints.half : normalizedFormat === 'standard' ? averagePoints.std : averagePoints.ppr;
  const seasonTotal = normalizedFormat === 'half_ppr' ? seasonTotals?.fantasyPointsHalf : normalizedFormat === 'standard' ? seasonTotals?.fantasyPointsStd : seasonTotals?.fantasyPointsPPR;

  // Load player details
  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    setPlayerLoading(true);
    setPlayerError(null);
    api.get<{ player: PlayerDetail }>(`/players/${playerId}`)
      .then((res) => { if (!cancelled) { setPlayer(res.player); setPlayerLoading(false); } })
      .catch((err) => {
        if (!cancelled) {
          setPlayer(null);
          setPlayerLoading(false);
          setPlayerError(err instanceof Error ? err.message : 'Player not found');
        }
      });
    return () => { cancelled = true; };
  }, [playerId]);

  // Load season stats
  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    setStatsLoading(true);
    api.get<{
      weeklyStats: APIWeeklyStat[];
      seasonTotals?: { games?: number; gamesPlayed?: number; fantasyPointsPPR?: number; fantasyPointsHalf?: number; fantasyPointsStd?: number };
      averagePointsPPR?: number;
      averagePointsHalf?: number;
      averagePointsStd?: number;
    }>(`/players/${playerId}/stats?season=${season}`)
      .then((res) => {
        if (cancelled) return;
        setWeeklyStats(res?.weeklyStats?.length ? res.weeklyStats : null);
        setSeasonTotals(res?.seasonTotals ?? null);
        setAveragePoints({
          ppr: res?.averagePointsPPR ?? null,
          half: res?.averagePointsHalf ?? null,
          std: res?.averagePointsStd ?? null,
        });
        setStatsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setWeeklyStats(null);
        setSeasonTotals(null);
        setAveragePoints({ ppr: null, half: null, std: null });
        setStatsLoading(false);
      });
    return () => { cancelled = true; };
  }, [playerId, season]);

  // Load news
  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    setNewsLoading(true);
    setNews([]);
    playerService.getPlayerNews(playerId)
      .then((res) => { if (!cancelled) { setNews(res.news); setNewsLoading(false); } })
      .catch(() => { if (!cancelled) { setNews([]); setNewsLoading(false); } });
    return () => { cancelled = true; };
  }, [playerId]);

  // Load matchup grade
  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    setMatchupLoading(true);
    playerService.getMatchupGrade(playerId, { season, week })
      .then((res) => { if (!cancelled) setMatchupData(res); })
      .catch(() => { if (!cancelled) setMatchupData(null); })
      .finally(() => { if (!cancelled) setMatchupLoading(false); });
    return () => { cancelled = true; };
  }, [playerId, season, week]);

  // Load props
  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    setPropsLoading(true);
    api.get<any>(`/players/${playerId}/props?week=${week}&season=${season}`)
      .then((res) => { if (!cancelled) { setPropsData(res); setPropsLoading(false); } })
      .catch(() => { if (!cancelled) { setPropsData(null); setPropsLoading(false); } });
    return () => { cancelled = true; };
  }, [playerId, week, season]);

  const bestWeek = useMemo(() => {
    if (!weeklyStats?.length) return null;
    return weeklyStats.reduce<{ week: number; pts: number } | null>((best, s) => {
      const pts = getFantasyPoints(s);
      if (!best || pts > best.pts) return { week: s.week, pts };
      return best;
    }, null);
  }, [weeklyStats, normalizedFormat]);

  // Loading state
  if (playerLoading) {
    return (
      <div className="max-w-6xl mx-auto py-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Error state
  if (!player) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <h1 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Player not found</h1>
        <p className={`mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          {playerError ?? "We couldn't find this player profile."}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
        >
          Back to rankings
        </button>
      </div>
    );
  }

  const grade = matchupData?.grade ?? '';
  const position = player.position;

  const heroBg = isDarkMode
    ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border-slate-800'
    : 'bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-200';

  const cardBg = isDarkMode
    ? 'bg-slate-900 border-slate-800'
    : 'bg-white border-slate-200';

  const sectionTitle = `text-xs font-semibold uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`;
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const headingColor = isDarkMode ? 'text-white' : 'text-slate-900';
  const bodyColor = isDarkMode ? 'text-slate-300' : 'text-slate-700';

  // Prefer the short, shareable Sleeper externalId in the canonical URL when
  // available; fall back to the internal id. Both resolve on the backend.
  const canonicalId = player.externalId ?? player.id;
  const profilePath = buildPlayerProfilePath(player.name, canonicalId);
  const playerSeo = getPlayerProfileSEOProps(player, profilePath);

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <SEO {...playerSeo} />
      {/* Breadcrumb / back */}
      <nav className="mb-4 flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={onBack}
          className={`flex items-center gap-1.5 transition-colors group ${muted} hover:${isDarkMode ? 'text-white' : 'text-slate-900'}`}
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back</span>
        </button>
        <span className={isDarkMode ? 'text-slate-700' : 'text-slate-300'}>/</span>
        <span className={muted}>Players</span>
        <span className={isDarkMode ? 'text-slate-700' : 'text-slate-300'}>/</span>
        <span className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{player.name}</span>
      </nav>

      {/* Hero */}
      <header className={`rounded-2xl border p-6 sm:p-8 ${heroBg}`}>
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className={`w-28 h-32 sm:w-32 sm:h-36 rounded-xl overflow-hidden border flex-shrink-0 flex items-center justify-center ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
            <PlayerAvatar
              name={player.name}
              headshotUrl={player.headshotUrl}
              className="w-full h-full object-contain"
              fallbackClassName="text-3xl font-bold"
              isDarkMode={isDarkMode}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className={`text-3xl sm:text-4xl font-bold ${headingColor}`}>{player.name}</h1>
              {player.status && player.status !== 'active' && (
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${statusPillClasses(player.status)}`}>
                  {statusLabel(player.status)}
                </span>
              )}
            </div>
            <div className={`flex items-center gap-2 text-sm flex-wrap mb-4 ${bodyColor}`}>
              <span className="font-semibold">{player.team}</span>
              <span className={muted}>•</span>
              <span className="font-semibold">{position}</span>
              {player.jerseyNumber != null && (
                <>
                  <span className={muted}>•</span>
                  <span>#{player.jerseyNumber}</span>
                </>
              )}
              {player.byeWeek != null && (
                <>
                  <span className={muted}>•</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Bye Week {player.byeWeek}</span>
                </>
              )}
            </div>

            {/* Bio strip */}
            <div className={`flex items-center gap-x-4 gap-y-1 flex-wrap text-xs ${muted}`}>
              {player.age != null && <span><span className={`font-semibold ${bodyColor}`}>{player.age}</span> yrs</span>}
              {player.height && <span><span className={`font-semibold ${bodyColor}`}>{player.height}</span></span>}
              {player.weight != null && <span><span className={`font-semibold ${bodyColor}`}>{player.weight}</span> lbs</span>}
              {player.college && <span><span className={`font-semibold ${bodyColor}`}>{player.college}</span></span>}
              {player.yearsExp != null && <span><span className={`font-semibold ${bodyColor}`}>{player.yearsExp}</span> yrs exp</span>}
            </div>

            {player.injuryNote && (
              <div className={`mt-4 text-sm rounded-lg border px-3 py-2 ${isDarkMode ? 'bg-red-950/30 border-red-900/50 text-red-200' : 'bg-red-50 border-red-200 text-red-800'}`}>
                <span className="font-semibold">{player.injuryBodyPart ? `${player.injuryBodyPart}: ` : 'Injury: '}</span>
                {player.injuryNote}
              </div>
            )}
          </div>

          {grade && !matchupLoading && (
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-xs font-medium px-3 py-2 rounded-lg border" style={getGradeStyle(grade, isDarkMode)}>
                {matchupData?.opponent ? `vs ${matchupData.opponent} ` : 'Matchup '}{grade}
              </span>
              <span className={`text-[10px] uppercase tracking-wide ${muted}`}>{getMatchupGradeLabel(grade)} matchup</span>
            </div>
          )}
        </div>
      </header>

      {/* Quick stats strip */}
      <section className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={`${scoringLabel} Pts`} value={seasonTotal != null ? seasonTotal.toFixed(1) : '—'} loading={statsLoading} isDarkMode={isDarkMode} />
        <StatCard label="Games" value={(seasonTotals?.gamesPlayed ?? seasonTotals?.games)?.toString() ?? '—'} loading={statsLoading} isDarkMode={isDarkMode} />
        <StatCard label="PPG" value={currentAverage != null ? currentAverage.toFixed(1) : '—'} loading={statsLoading} isDarkMode={isDarkMode} />
        <StatCard label="Best Week" value={bestWeek ? `Wk ${bestWeek.week} · ${bestWeek.pts.toFixed(1)}` : '—'} loading={statsLoading} isDarkMode={isDarkMode} />
      </section>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Take placeholder — wired in pass 2 */}
          <section className={`rounded-2xl border p-5 ${cardBg}`} aria-labelledby="ai-take-heading">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className={`w-4 h-4 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
                <h2 id="ai-take-heading" className={`text-sm font-semibold ${headingColor}`}>FilmRoom AI Take</h2>
              </div>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${isDarkMode ? 'border-purple-900/50 text-purple-300 bg-purple-950/30' : 'border-purple-200 text-purple-700 bg-purple-50'}`}>
                Coming soon
              </span>
            </div>
            <p className={`text-sm leading-relaxed ${bodyColor}`}>
              AI-generated weekly analysis covering recent form, upcoming matchup, role/usage trends, and start/sit guidance — landing here next.
            </p>
          </section>

          {/* Weekly stats table */}
          <section className={`rounded-2xl border overflow-hidden ${cardBg}`} aria-labelledby="weekly-stats-heading">
            <div className={`px-5 py-4 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div>
                <h2 id="weekly-stats-heading" className={`text-sm font-semibold ${headingColor}`}>{season} Weekly Stats</h2>
                <p className={`text-xs ${muted}`}>{scoringLabel} scoring</p>
              </div>
            </div>
            {statsLoading ? (
              <div className="p-6 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`animate-pulse rounded h-8 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
                ))}
              </div>
            ) : !weeklyStats?.length ? (
              <p className={`p-6 text-sm ${muted}`}>No game stats for {season} yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <WeeklyStatsTable
                  stats={weeklyStats}
                  position={position}
                  getFantasyPoints={getFantasyPoints}
                  isDarkMode={isDarkMode}
                />
              </div>
            )}
          </section>

          {/* Vegas props */}
          <section className={`rounded-2xl border p-5 ${cardBg}`} aria-labelledby="props-heading">
            <h2 id="props-heading" className={`text-sm font-semibold mb-3 ${headingColor}`}>Vegas Props · Week {week}</h2>
            {propsLoading ? (
              <div className={`animate-pulse h-12 rounded ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
            ) : !propsData?.props || Object.keys(propsData.props).length === 0 ? (
              <p className={`text-sm ${muted}`}>No prop lines posted for this week.</p>
            ) : (
              <PropsList propsData={propsData} isDarkMode={isDarkMode} />
            )}
            {propsData?.isFallback && propsData?.season && (
              <p className={`text-xs mt-3 ${muted}`}>Showing {propsData.season} lines (last available season).</p>
            )}
          </section>
        </div>

        {/* Right/side column */}
        <aside className="space-y-6">
          {/* Matchup grade detail */}
          <section className={`rounded-2xl border p-5 ${cardBg}`} aria-labelledby="matchup-heading">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
              <h2 id="matchup-heading" className={`text-sm font-semibold ${headingColor}`}>Matchup Grade</h2>
            </div>
            {matchupLoading ? (
              <div className={`animate-pulse h-16 rounded ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
            ) : !grade ? (
              <p className={`text-sm ${muted}`}>No matchup data for this week.</p>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl font-bold px-3 py-1 rounded-lg border" style={getGradeStyle(grade, isDarkMode)}>{grade}</span>
                  <div>
                    <div className={`text-sm font-semibold ${headingColor}`}>{getMatchupGradeLabel(grade)}</div>
                    {matchupData?.opponent && <div className={`text-xs ${muted}`}>vs {matchupData.opponent} · Week {matchupData.week ?? week}</div>}
                  </div>
                </div>
                {matchupData?.message && <p className={`text-sm leading-relaxed ${bodyColor}`}>{matchupData.message}</p>}
              </>
            )}
          </section>

          {/* News */}
          <section className={`rounded-2xl border p-5 ${cardBg}`} aria-labelledby="news-heading">
            <h2 id="news-heading" className={sectionTitle + ' mb-3'}>Latest News</h2>
            {newsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className={`animate-pulse rounded-lg h-14 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
                ))}
              </div>
            ) : news.length === 0 ? (
              <p className={`text-sm ${muted}`}>No recent news.</p>
            ) : (
              <ul className="space-y-3">
                {news.slice(0, 5).map((item, i) => (
                  <li key={item.id ?? i} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{item.source ?? 'News'}</span>
                      <span className={`text-[11px] flex items-center gap-1 ${muted}`}>
                        <Clock className="w-3 h-3" />{formatTimeAgo(item.publishedAt)}
                      </span>
                    </div>
                    <p className={`text-sm leading-relaxed ${bodyColor}`}>
                      {(item as any).isArticle && item.sourceUrl ? (
                        <a href={item.sourceUrl} className="hover:underline font-medium">{item.headline}</a>
                      ) : (
                        <NewsSnippet item={item} />
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Open quick-look (modal) */}
          {onOpenQuickLook && player && (
            <button
              type="button"
              onClick={() => onOpenQuickLook({ id: player.id, name: player.name, team: player.team, position: player.position, headshotUrl: player.headshotUrl })}
              className={`w-full px-4 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${isDarkMode ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            >
              Open quick-look modal
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

function StatCard({ label, value, loading, isDarkMode }: { label: string; value: string; loading: boolean; isDarkMode: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      <div className={`text-[10px] uppercase tracking-wide ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{label}</div>
      {loading ? (
        <div className={`mt-1 animate-pulse h-7 w-16 rounded ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
      ) : (
        <div className={`mt-1 text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{value}</div>
      )}
    </div>
  );
}

function WeeklyStatsTable({
  stats,
  position,
  getFantasyPoints,
  isDarkMode,
}: {
  stats: APIWeeklyStat[];
  position: ApiPlayer['position'];
  getFantasyPoints: (s: APIWeeklyStat) => number;
  isDarkMode: boolean;
}) {
  const headerCls = `text-left text-[10px] uppercase tracking-wide font-semibold px-3 py-2 ${isDarkMode ? 'text-slate-400 bg-slate-950' : 'text-slate-500 bg-slate-50'}`;
  const cellCls = `px-3 py-2 text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`;
  const rowBorder = isDarkMode ? 'border-slate-800' : 'border-slate-200';

  const cols = useMemo(() => {
    const base = [
      { key: 'week', label: 'Wk' },
      { key: 'opp', label: 'OPP' },
      { key: 'fpts', label: 'FPTS' },
    ];
    if (position === 'QB') return [...base, { key: 'cmpAtt', label: 'CMP/ATT' }, { key: 'passYds', label: 'PASS YDS' }, { key: 'passTd', label: 'PASS TD' }, { key: 'int', label: 'INT' }, { key: 'rushYds', label: 'RUSH YDS' }, { key: 'rushTd', label: 'RUSH TD' }];
    if (position === 'WR' || position === 'TE') return [...base, { key: 'tgt', label: 'TGT' }, { key: 'rec', label: 'REC' }, { key: 'recYds', label: 'REC YDS' }, { key: 'recTd', label: 'REC TD' }, { key: 'rushYds', label: 'RUSH YDS' }];
    if (position === 'RB') return [...base, { key: 'rushAtt', label: 'CAR' }, { key: 'rushYds', label: 'RUSH YDS' }, { key: 'rushTd', label: 'RUSH TD' }, { key: 'tgt', label: 'TGT' }, { key: 'rec', label: 'REC' }, { key: 'recYds', label: 'REC YDS' }];
    if (position === 'K') return [...base, { key: 'fg', label: 'FG' }, { key: 'xp', label: 'XP' }];
    if (position === 'DEF') return [...base, { key: 'sack', label: 'SACK' }, { key: 'int', label: 'INT' }, { key: 'fr', label: 'FR' }, { key: 'td', label: 'TD' }, { key: 'pa', label: 'PA' }];
    return base;
  }, [position]);

  const renderCell = (s: APIWeeklyStat, key: string): string => {
    if (key === 'week') return String(s.week);
    if (key === 'opp') return s.opponent ?? '—';
    if (key === 'fpts') return getFantasyPoints(s).toFixed(1);
    if (key === 'cmpAtt') return `${s.passCompletions ?? 0}/${s.passAttempts ?? 0}`;
    if (key === 'passYds') return String(s.passYards ?? 0);
    if (key === 'passTd') return String(s.passTDs ?? 0);
    if (key === 'int') return String(s.passInterceptions ?? s.defInterceptions ?? 0);
    if (key === 'rushYds') return String(s.rushYards ?? 0);
    if (key === 'rushTd') return String(s.rushTDs ?? 0);
    if (key === 'rushAtt') return String(s.rushAttempts ?? 0);
    if (key === 'tgt') return String(s.targets ?? 0);
    if (key === 'rec') return String(s.receptions ?? 0);
    if (key === 'recYds') return String(s.receivingYards ?? 0);
    if (key === 'recTd') return String(s.receivingTDs ?? 0);
    if (key === 'fg') return `${s.fgMade ?? 0}/${s.fgAttempts ?? 0}`;
    if (key === 'xp') return `${s.xpMade ?? 0}/${s.xpAttempts ?? 0}`;
    if (key === 'sack') return String(s.sacks ?? 0);
    if (key === 'fr') return String(s.fumblesRecovered ?? 0);
    if (key === 'td') return String(s.defenseTDs ?? 0);
    if (key === 'pa') return String(s.pointsAllowed ?? 0);
    return '—';
  };

  return (
    <table className="min-w-full">
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c.key} scope="col" className={headerCls}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {stats.map((s, i) => (
          <tr key={`${s.seasonYear}-${s.week}-${i}`} className={`border-t ${rowBorder}`}>
            {cols.map((c) => (
              <td key={c.key} className={cellCls}>{renderCell(s, c.key)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PropsList({ propsData, isDarkMode }: { propsData: any; isDarkMode: boolean }) {
  const MARKET_LABELS: Record<string, string> = {
    passyds: 'Passing Yards',
    rushyds: 'Rushing Yards',
    receptionyds: 'Receiving Yards',
    passtds: 'Passing TDs',
    rushtds: 'Rushing TDs',
    receptions: 'Receptions',
    anytimetd: 'Anytime TD',
  };
  const ACTUAL_KEYS: Record<string, string> = {
    passyds: 'passYds',
    rushyds: 'rushYds',
    receptionyds: 'recYds',
    passtds: 'passTds',
    rushtds: 'rushTds',
    receptions: 'recs',
    anytimetd: 'scoredTd',
  };

  const props = propsData?.props ?? {};
  const actual = propsData?.actual ?? {};
  const markets = Object.keys(props);

  return (
    <ul className="space-y-2">
      {markets.map((market) => {
        const p = props[market];
        const actualVal = actual[ACTUAL_KEYS[market]];
        const label = MARKET_LABELS[market] ?? market;
        return (
          <li key={market} className={`flex items-center justify-between text-sm rounded-lg border px-3 py-2 ${isDarkMode ? 'border-slate-800 bg-slate-950/30' : 'border-slate-200 bg-slate-50'}`}>
            <span className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>{label}</span>
            <span className={`flex items-center gap-3 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              <span className="font-semibold">{p?.line ?? '—'}</span>
              {actualVal != null && (
                <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>actual: {String(actualVal)}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
