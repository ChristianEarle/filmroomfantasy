import { useEffect, useState, useMemo, type CSSProperties } from 'react';
import { X, ArrowLeft, TrendingUp, TrendingDown, Zap, Target, Calendar, Star, Clock } from 'lucide-react';
import { Player } from '../App';
import api from '../services/api';
import { playerService } from '../services';
import type { PlayerNews, MatchupGradeResponse } from '../services';
import { NewsSnippet } from './NewsSnippet';
import { AdUnit } from './AdUnit';


interface PlayerCardProps {
  player: Player;
  onClose: () => void;
  isDarkMode: boolean;
  /** League season year for stats (e.g. 2025). Falls back to current year if not set. */
  seasonYear?: number;
  /** Current NFL week number (e.g. 1–18). Falls back to latest available week if not set. */
  currentWeek?: number;
  /** League scoring format. Defaults to 'ppr'. */
  scoringFormat?: string;
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
  offSnaps?: number;
  defSnaps?: number;
  stSnaps?: number;
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

// Neutral text and border for stat tables (no green/red coloring)
const statText = (isDarkMode: boolean) => isDarkMode ? 'text-slate-300' : 'text-slate-600';
const statMuted = (isDarkMode: boolean) => isDarkMode ? 'text-slate-400' : 'text-slate-500';
const colBorder = (isDarkMode: boolean) => isDarkMode ? 'border-r border-slate-600' : 'border-r border-slate-200';

export function PlayerCard({ player, onClose, isDarkMode, seasonYear: propsSeasonYear, currentWeek: propsCurrentWeek, scoringFormat: propsScoringFormat }: PlayerCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'props' | 'breakdown' | 'history'>('props');

  const [weeklyStats, setWeeklyStats] = useState<APIWeeklyStat[] | null>(null);
  const [seasonTotals, setSeasonTotals] = useState<{ games?: number; gamesPlayed?: number; fantasyPointsPPR?: number; fantasyPointsHalf?: number; fantasyPointsStd?: number; averageSnapPct?: number | null } | null>(null);
  const [averagePoints, setAveragePoints] = useState<{ ppr: number | null; half: number | null; std: number | null }>({ ppr: null, half: null, std: null });

  // Resolve scoring format — normalize to 'ppr' | 'half_ppr' | 'standard'
  const scoringFormat = propsScoringFormat === 'half_ppr' ? 'half_ppr' : propsScoringFormat === 'standard' ? 'standard' : 'ppr';
  const scoringLabel = scoringFormat === 'half_ppr' ? 'Half PPR' : scoringFormat === 'standard' ? 'Standard' : 'PPR';

  /** Pick the correct fantasy points field from a weekly stat based on scoring format */
  const getFantasyPoints = (s: APIWeeklyStat): number => {
    if (scoringFormat === 'half_ppr') return s.fantasyPointsHalf ?? s.fantasyPointsPPR ?? 0;
    if (scoringFormat === 'standard') return s.fantasyPointsStd ?? s.fantasyPointsPPR ?? 0;
    return s.fantasyPointsPPR ?? 0;
  };

  /** Get the current average based on scoring format */
  const currentAverage = scoringFormat === 'half_ppr' ? averagePoints.half : scoringFormat === 'standard' ? averagePoints.std : averagePoints.ppr;
  const [statsLoading, setStatsLoading] = useState(true);
  const [seasonOptions, setSeasonOptions] = useState<number[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | 'latest'>('latest');
  const [news, setNews] = useState<PlayerNews[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [matchupData, setMatchupData] = useState<MatchupGradeResponse | null>(null);
  const [propsData, setPropsData] = useState<any>(null);
  const [propsLoading, setPropsLoading] = useState(true);

  // Fetch player props when card opens
  useEffect(() => {
    if (!player?.id) return;
    let cancelled = false;
    setPropsLoading(true);
    api.get<any>(`/players/${player.id}/props?week=${propsCurrentWeek || 1}&season=${propsSeasonYear || 2025}`)
      .then((res) => { if (!cancelled) { setPropsData(res); setPropsLoading(false); } })
      .catch(() => { if (!cancelled) { setPropsData(null); setPropsLoading(false); } });
    return () => { cancelled = true; };
  }, [player.id, propsCurrentWeek, propsSeasonYear]);

  // Fetch years for which this player has data (dropdown only shows years with stats)
  useEffect(() => {
    if (!player?.id) return;
    let cancelled = false;
    const loadAvailableYears = async () => {
      try {
        const res = await api.get<{ years: number[]; latest: number | null }>(`/players/${player.id}/stats/available-years`);
        if (!cancelled) {
          setSeasonOptions(res?.years?.length ? res.years : []);
        }
      } catch {
        if (!cancelled) setSeasonOptions([]);
      }
    };
    loadAvailableYears();
    return () => { cancelled = true; };
  }, [player.id]);

  // Reset to latest when opening a different player
  useEffect(() => {
    setSelectedSeason('latest');
  }, [player.id]);

  // Fetch player news when card opens
  useEffect(() => {
    if (!player?.id) return;
    let cancelled = false;
    setNewsLoading(true);
    setNews([]);
    playerService.getPlayerNews(player.id).then((res) => {
      if (!cancelled) {
        setNews(res.news);
        setNewsLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setNews([]);
        setNewsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [player.id]);

  // Fetch matchup grade when card opens
  useEffect(() => {
    if (!player?.id) return;
    let cancelled = false;
    playerService.getMatchupGrade(player.id, {
      season: propsSeasonYear,
      week: propsCurrentWeek,
    }).then((res) => {
      if (!cancelled) setMatchupData(res);
    }).catch(() => {
      if (!cancelled) setMatchupData(null);
    });
    return () => { cancelled = true; };
  }, [player.id, propsSeasonYear, propsCurrentWeek]);

  // Fetch player details (for headshot) and stats when card opens or season changes
  useEffect(() => {
    if (!player?.id) return;
    let cancelled = false;
    setStatsLoading(true);
    const loadPlayerData = async () => {
      try {
        const seasonParam = selectedSeason === 'latest'
          ? (seasonOptions[0] ?? new Date().getFullYear())
          : selectedSeason;
        type StatsResponse = {
          weeklyStats: APIWeeklyStat[];
          seasonTotals?: { games?: number; gamesPlayed?: number; fantasyPointsPPR?: number; fantasyPointsHalf?: number; fantasyPointsStd?: number; averageSnapPct?: number | null };
          averagePointsPPR?: number;
          averagePointsHalf?: number;
          averagePointsStd?: number;
        };
        let statsRes = await api.get<StatsResponse>(`/players/${player.id}/stats?season=${seasonParam}`);
        if (!cancelled && !statsRes?.weeklyStats?.length && selectedSeason !== 'latest' && seasonOptions.length > 1) {
          const idx = seasonOptions.indexOf(selectedSeason);
          const fallbackYear = idx >= 0 ? seasonOptions[idx + 1] : seasonOptions[1];
          if (fallbackYear) {
            statsRes = await api.get<StatsResponse>(`/players/${player.id}/stats?season=${fallbackYear}`);
          }
        }
        if (!cancelled && statsRes?.weeklyStats?.length) {
          setWeeklyStats(statsRes.weeklyStats);
          setSeasonTotals(statsRes.seasonTotals ?? null);
          setAveragePoints({
            ppr: statsRes.averagePointsPPR ?? null,
            half: statsRes.averagePointsHalf ?? null,
            std: statsRes.averagePointsStd ?? null,
          });
        } else {
          if (!cancelled) {
            setWeeklyStats(null);
            setSeasonTotals(null);
            setAveragePoints({ ppr: null, half: null, std: null });
          }
        }
      } catch {
        if (!cancelled) {
          setWeeklyStats(null);
          setSeasonTotals(null);
          setAveragePoints({ ppr: null, half: null, std: null });
        }
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };
    loadPlayerData();
    return () => { cancelled = true; };
  }, [player.id, selectedSeason, seasonOptions]);

  // Transform API weekly stats into game log format for each position
  const apiGameLogs = useMemo(() => {
    if (!weeklyStats?.length) return null;
    const pos = player.position === 'FLEX' ? 'WR' : (player.position || 'RB');
    const parseOpp = (opp: string | null | undefined) => {
      if (!opp) return { opp: '-', isAway: false };
      const isAway = opp.startsWith('@');
      return { opp: isAway ? opp.slice(1).trim() || '-' : opp, isAway };
    };
    if (pos === 'QB') {
      return weeklyStats.map(s => {
        const { opp, isAway } = parseOpp(s.opponent);
        return { week: s.week, opp, isAway, fpts: getFantasyPoints(s).toFixed(1), fin: '-', cmp: s.passCompletions ?? 0, att: s.passAttempts ?? 0, passYds: s.passYards ?? 0, passTd: s.passTDs ?? 0, int: s.passInterceptions ?? 0, rushYds: s.rushYards ?? 0, rushTd: s.rushTDs ?? 0 };
      });
    }
    if (pos === 'K') {
      return weeklyStats.map(s => {
        const { opp, isAway } = parseOpp(s.opponent);
        const fgm = s.fgMade ?? 0, fga = s.fgAttempts ?? 0;
        return { week: s.week, opp, isAway, fpts: getFantasyPoints(s).toFixed(0), fin: '-', fgm, fga, lng: 0, xpm: s.xpMade ?? 0, xpa: s.xpAttempts ?? 0 };
      });
    }
    if (pos === 'DEF') {
      return weeklyStats.map(s => {
        const { opp, isAway } = parseOpp(s.opponent);
        return { week: s.week, opp, isAway, fpts: getFantasyPoints(s).toFixed(0), fin: '-', sack: s.sacks ?? 0, int: s.defInterceptions ?? 0, fr: s.fumblesRecovered ?? 0, td: s.defenseTDs ?? 0, pa: s.pointsAllowed ?? 0 };
      });
    }
    if (pos === 'WR' || pos === 'TE') {
      return weeklyStats.map(s => {
        const { opp, isAway } = parseOpp(s.opponent);
        const rec = s.receptions ?? 0, recYds = s.receivingYards ?? 0;
        return { week: s.week, opp, isAway, fpts: getFantasyPoints(s).toFixed(1), snpPct: s.snapPct ?? null, fin: '-', tgt: s.targets ?? 0, rec, recYds, recTd: s.receivingTDs ?? 0, rushAtt: s.rushAttempts ?? 0, rushYds: s.rushYards ?? 0, rushTd: s.rushTDs ?? 0 };
      });
    }
    if (pos === 'RB') {
      return weeklyStats.map(s => {
        const { opp, isAway } = parseOpp(s.opponent);
        const rushAtt = s.rushAttempts ?? 0, rushYds = s.rushYards ?? 0, rec = s.receptions ?? 0, recYds = s.receivingYards ?? 0;
        return { week: s.week, opp, isAway, fpts: getFantasyPoints(s).toFixed(1), snpPct: s.snapPct ?? null, fin: '-', rushAtt, rushYds, rushYpa: rushAtt ? (rushYds / rushAtt).toFixed(1) : '—', rushTd: s.rushTDs ?? 0, tgt: s.targets ?? 0, rec, recYds, recYpr: rec ? (recYds / rec).toFixed(1) : '—', recTd: s.receivingTDs ?? 0 };
      });
    }
    return weeklyStats.map(s => {
      const { opp, isAway } = parseOpp(s.opponent);
      const rec = s.receptions ?? 0, recYds = s.receivingYards ?? 0;
      return { week: s.week, opp, isAway, fpts: getFantasyPoints(s).toFixed(1), snpPct: s.snapPct ?? null, fin: '-', rushAtt: s.rushAttempts ?? 0, rushYds: s.rushYards ?? 0, rushYpa: '—', rushTd: s.rushTDs ?? 0, tgt: s.targets ?? 0, rec, recYds, recYpr: '—', recTd: s.receivingTDs ?? 0 };
    });
  }, [weeklyStats, player.position, scoringFormat]);

  useEffect(() => {
    // Trigger animation on mount
    const rafId = requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  const matchupGrade = matchupData?.grade ?? '';
  const getMatchupGradeLabel = (grade: string) => {
    if (!grade) return '—';
    if (grade.startsWith('A')) return 'Elite';
    if (grade.startsWith('B')) return 'Good';
    if (grade.startsWith('C')) return 'Average';
    return 'Tough';
  };
  const getGradeStyle = (grade: string): CSSProperties => {
    if (!grade) return { color: isDarkMode ? '#64748b' : '#94a3b8', backgroundColor: isDarkMode ? 'rgba(30,41,59,0.6)' : '#f1f5f9', borderColor: isDarkMode ? '#475569' : '#e2e8f0' };
    if (grade.startsWith('A')) return { color: isDarkMode ? '#34d399' : '#059669', backgroundColor: isDarkMode ? 'rgba(16,185,129,0.25)' : '#d1fae5', borderColor: isDarkMode ? 'rgba(16,185,129,0.4)' : '#6ee7b7' };
    if (grade.startsWith('B')) return { color: isDarkMode ? '#60a5fa' : '#2563eb', backgroundColor: isDarkMode ? 'rgba(59,130,246,0.25)' : '#dbeafe', borderColor: isDarkMode ? 'rgba(59,130,246,0.4)' : '#93c5fd' };
    if (grade.startsWith('C')) return { color: isDarkMode ? '#fbbf24' : '#d97706', backgroundColor: isDarkMode ? 'rgba(245,158,11,0.25)' : '#fef3c7', borderColor: isDarkMode ? 'rgba(245,158,11,0.4)' : '#fcd34d' };
    return { color: isDarkMode ? '#fb7185' : '#e11d48', backgroundColor: isDarkMode ? 'rgba(244,63,94,0.25)' : '#ffe4e6', borderColor: isDarkMode ? 'rgba(244,63,94,0.4)' : '#fda4af' };
  };

  return (
    <div
      className={`fixed inset-0 backdrop-blur-sm z-[100] flex items-start justify-center overflow-y-auto p-4 transition-opacity duration-200 ${isDarkMode ? 'bg-slate-950/80' : 'bg-slate-900/50'} ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className={`w-full max-w-5xl mt-8 mb-8 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}>
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={handleClose}
            className={`flex items-center gap-2 transition-colors group ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Back</span>
            <span className={isDarkMode ? 'text-slate-600' : 'text-slate-400'}>/</span>
            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Player Card</span>
          </button>
          <button
            onClick={handleClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-white hover:bg-slate-100 border border-slate-200'}`}
          >
            <X className={`w-4 h-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Card */}
          <div className={`lg:col-span-2 rounded-lg border overflow-hidden shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            {/* Player Header */}
            <div className={`p-6 border-b ${isDarkMode ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700' : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-16 flex-shrink-0 rounded-lg overflow-hidden border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                    {player.headshotUrl ? (
                      <img src={player.headshotUrl} alt={player.name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.name}</h1>
                      {player.status && player.status !== 'active' && (
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                          player.status === 'injured_reserve' || player.status === 'out' ? 'bg-red-500/20 text-red-400' :
                          player.status === 'questionable' ? 'bg-yellow-500/20 text-yellow-400' :
                          player.status === 'doubtful' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {player.status === 'injured_reserve' ? 'IR' : player.status.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{player.team} • {player.position}{propsCurrentWeek ? ` • Week ${propsCurrentWeek}` : ''}</p>
                  </div>
                </div>
                {matchupGrade && (
                  <span className="text-xs font-medium px-3 py-1.5 rounded-md border shrink-0" style={getGradeStyle(matchupGrade)} title={matchupData?.message || `${getMatchupGradeLabel(matchupGrade)} matchup`}>
                    {matchupData?.opponent ? `vs ${matchupData.opponent} ` : 'Matchup '}{matchupGrade}
                  </span>
                )}
              </div>
            </div>

            {/* News Section */}
            <div className={`p-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <svg className={`w-4 h-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Latest News</span>
              </div>
              {newsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className={`animate-pulse ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'} rounded-lg h-16`} />
                  ))}
                </div>
              ) : news.length === 0 ? (
                <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>No recent news</p>
              ) : (
                <div className="space-y-3">
                  {news.slice(0, 3).map((item, index) => (
                    <div key={item.id || index} className="flex gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className={`text-xs font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                            {item.source || 'News'}
                          </span>
                          <span className={`text-xs flex items-center gap-1 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                            <Clock className="w-3 h-3" />
                            {formatTimeAgo(item.publishedAt)}
                          </span>
                        </div>
                        <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          <NewsSnippet item={item} />
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className={`flex border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              {(['props', 'breakdown', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                    activeTab === tab
                      ? isDarkMode ? 'text-white' : 'text-slate-900'
                      : isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab === 'props' && 'Props'}
                  {tab === 'breakdown' && 'Averages'}
                  {tab === 'history' && 'History'}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'props' && (() => {
                const MARKET_LABELS: Record<string, string> = {
                  passyds: 'Passing Yards', rushyds: 'Rushing Yards', receptionyds: 'Receiving Yards',
                  passtds: 'Passing TDs', rushtds: 'Rushing TDs', receptions: 'Receptions', anytimetd: 'Anytime TD'
                };
                const ACTUAL_KEYS: Record<string, string> = {
                  passyds: 'passYds', rushyds: 'rushYds', receptionyds: 'recYds',
                  passtds: 'passTds', rushtds: 'rushTds', receptions: 'recs', anytimetd: 'scoredTd'
                };

                const props = propsData?.props || {};
                const actual = propsData?.actual || {};
                const markets = Object.keys(props);

                return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Vegas Prop Lines</h3>
                    <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>FanDuel • Week {propsCurrentWeek || 1}</span>
                  </div>
                  {propsLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : markets.length === 0 ? (
                    <div className={`rounded-lg border p-6 text-center ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>No prop lines available for this week.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {markets.map((mkt) => {
                        const prop = props[mkt];
                        const label = MARKET_LABELS[mkt] || mkt;
                        const actualKey = ACTUAL_KEYS[mkt];
                        const actualVal = actualKey ? actual[actualKey] : null;
                        const isAnytimeTd = mkt === 'anytimetd';
                        const line = prop?.line;

                        let result = '';
                        let resultColor = isDarkMode ? 'text-slate-500' : 'text-slate-400';
                        if (isAnytimeTd && actualVal !== null && actualVal !== undefined) {
                          result = actualVal ? 'YES' : 'NO';
                          resultColor = actualVal ? 'text-green-500' : 'text-red-500';
                        } else if (line != null && actualVal != null) {
                          const diff = actualVal - line;
                          if (diff > 0) { result = 'OVER'; resultColor = 'text-green-500'; }
                          else if (diff < 0) { result = 'UNDER'; resultColor = 'text-red-500'; }
                          else { result = 'PUSH'; resultColor = isDarkMode ? 'text-slate-300' : 'text-slate-600'; }
                        }

                        return (
                          <div key={mkt} className={`flex items-center justify-between py-3 px-4 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                            <div className="flex-1">
                              <div className={`text-xs font-semibold uppercase tracking-wide ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{label}</div>
                              <div className="flex items-center gap-3 mt-1">
                                {isAnytimeTd ? (
                                  <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                    Yes {prop?.yesPrice > 0 ? '+' : ''}{prop?.yesPrice}
                                  </span>
                                ) : (
                                  <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                    O/U {line}
                                    <span className={`ml-2 text-xs font-normal ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                      ({prop?.overPrice > 0 ? '+' : ''}{prop?.overPrice}/{prop?.underPrice > 0 ? '+' : ''}{prop?.underPrice})
                                    </span>
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              {actualVal != null ? (
                                <>
                                  <div className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                    {isAnytimeTd ? (actualVal ? 'Yes' : 'No') : actualVal}
                                  </div>
                                  {result && <div className={`text-xs font-bold ${resultColor}`}>{result}</div>}
                                </>
                              ) : (
                                <div className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>—</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                );
              })()}

              {activeTab === 'breakdown' && (() => {
                // Compute per-game averages from real weekly stats
                const gp = weeklyStats?.length || 0;
                const avg = (field: keyof APIWeeklyStat) => {
                  if (!weeklyStats || gp === 0) return '—';
                  const sum = weeklyStats.reduce((a, s) => a + (Number(s[field]) || 0), 0);
                  return (sum / gp).toFixed(1);
                };

                const BreakdownRow = ({ label, value }: { label: string; value: string }) => (
                  <div className={`flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                    <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
                    <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{value}</span>
                  </div>
                );

                return (
                <div className="space-y-4">
                  <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Season Averages</h3>
                  {!weeklyStats || gp === 0 ? (
                    <div className={`rounded-lg border p-8 text-center ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{statsLoading ? 'Loading stats...' : 'No stats available to compute averages.'}</p>
                    </div>
                  ) : (
                  <div className={`rounded-lg p-4 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <p className={`text-xs mb-3 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Per-game averages based on {gp} games played</p>
                    <div className="space-y-0">
                      {player.position === 'QB' ? (
                        <>
                          <BreakdownRow label="Passing Yards" value={avg('passYards')} />
                          <BreakdownRow label="Passing TDs" value={avg('passTDs')} />
                          <BreakdownRow label="Interceptions" value={avg('passInterceptions')} />
                          <BreakdownRow label="Rushing Yards" value={avg('rushYards')} />
                          <BreakdownRow label="Rushing TDs" value={avg('rushTDs')} />
                        </>
                      ) : player.position === 'RB' ? (
                        <>
                          <BreakdownRow label="Rushing Yards" value={avg('rushYards')} />
                          <BreakdownRow label="Rushing TDs" value={avg('rushTDs')} />
                          <BreakdownRow label="Receptions" value={avg('receptions')} />
                          <BreakdownRow label="Receiving Yards" value={avg('receivingYards')} />
                          <BreakdownRow label="Receiving TDs" value={avg('receivingTDs')} />
                        </>
                      ) : player.position === 'K' ? (
                        <>
                          <BreakdownRow label="Field Goals Made" value={avg('fgMade')} />
                          <BreakdownRow label="Field Goal Attempts" value={avg('fgAttempts')} />
                          <BreakdownRow label="Extra Points Made" value={avg('xpMade')} />
                          <BreakdownRow label="Extra Point Attempts" value={avg('xpAttempts')} />
                        </>
                      ) : player.position === 'DEF' ? (
                        <>
                          <BreakdownRow label="Sacks" value={avg('sacks')} />
                          <BreakdownRow label="Interceptions" value={avg('defInterceptions')} />
                          <BreakdownRow label="Fumble Recoveries" value={avg('fumblesRecovered')} />
                          <BreakdownRow label="Defensive TDs" value={avg('defenseTDs')} />
                          <BreakdownRow label="Points Allowed" value={avg('pointsAllowed')} />
                        </>
                      ) : (
                        <>
                          <BreakdownRow label="Targets" value={avg('targets')} />
                          <BreakdownRow label="Receptions" value={avg('receptions')} />
                          <BreakdownRow label="Receiving Yards" value={avg('receivingYards')} />
                          <BreakdownRow label="Receiving TDs" value={avg('receivingTDs')} />
                          <BreakdownRow label="Rushing Yards" value={avg('rushYards')} />
                        </>
                      )}
                      <div className="flex items-center justify-between py-3 bg-blue-500/10 -mx-4 px-4 rounded-lg mt-2">
                        <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Avg {scoringLabel} Points</span>
                        <span className="font-bold text-blue-400 text-lg">{(() => {
                          if (!weeklyStats || gp === 0) return '—';
                          const sum = weeklyStats.reduce((a, s) => a + getFantasyPoints(s), 0);
                          return (sum / gp).toFixed(1);
                        })()}</span>
                      </div>
                    </div>
                  </div>
                  )}
                </div>
                );
              })()}

              {activeTab === 'history' && (
                <div className="space-y-8">
                  {/* Season Stats - only shown when we have real data with computed totals */}
                  {weeklyStats && weeklyStats.length > 0 && (() => {
                    const tot = weeklyStats.reduce((a, s) => {
                      const isDef = player.position === 'DEF';
                      const off = s.offSnaps ?? 0, def = s.defSnaps ?? 0, st = s.stSnaps ?? 0;
                      const played = isDef || off > 0 || def > 0 || st > 0 ||
                        (s.passAttempts ?? 0) > 0 || (s.rushAttempts ?? 0) > 0 || (s.targets ?? 0) > 0 || (s.receptions ?? 0) > 0 ||
                        (s.fgAttempts ?? 0) > 0 || (s.xpAttempts ?? 0) > 0 || (s.sacks ?? 0) > 0 || (s.defInterceptions ?? 0) > 0;
                      const snapPct = s.snapPct ?? null;
                      return {
                      games: a.games + 1,
                      gamesPlayed: a.gamesPlayed + (played ? 1 : 0),
                      snapPctSum: a.snapPctSum + (snapPct != null ? snapPct : 0),
                      fpts: a.fpts + getFantasyPoints(s),
                      passYds: a.passYds + (s.passYards ?? 0), passTDs: a.passTDs + (s.passTDs ?? 0), passInt: a.passInt + (s.passInterceptions ?? 0),
                      passCmp: a.passCmp + (s.passCompletions ?? 0), passAtt: a.passAtt + (s.passAttempts ?? 0),
                      rushYds: a.rushYds + (s.rushYards ?? 0), rushTDs: a.rushTDs + (s.rushTDs ?? 0), rushAtt: a.rushAtt + (s.rushAttempts ?? 0),
                      rec: a.rec + (s.receptions ?? 0), recYds: a.recYds + (s.receivingYards ?? 0), recTDs: a.recTDs + (s.receivingTDs ?? 0), tgt: a.tgt + (s.targets ?? 0),
                      fgm: a.fgm + (s.fgMade ?? 0), fga: a.fga + (s.fgAttempts ?? 0), xpm: a.xpm + (s.xpMade ?? 0), xpa: a.xpa + (s.xpAttempts ?? 0),
                      sack: a.sack + (s.sacks ?? 0), defInt: a.defInt + (s.defInterceptions ?? 0), fr: a.fr + (s.fumblesRecovered ?? 0), defTd: a.defTd + (s.defenseTDs ?? 0), pa: a.pa + (s.pointsAllowed ?? 0),
                    };
                    }, { games: 0, gamesPlayed: 0, snapPctSum: 0, fpts: 0, passYds: 0, passTDs: 0, passInt: 0, passCmp: 0, passAtt: 0, rushYds: 0, rushTDs: 0, rushAtt: 0, rec: 0, recYds: 0, recTDs: 0, tgt: 0, fgm: 0, fga: 0, xpm: 0, xpa: 0, sack: 0, defInt: 0, fr: 0, defTd: 0, pa: 0 });
                    const gp = seasonTotals?.gamesPlayed ?? tot.gamesPlayed ?? tot.games;
                    const avg = currentAverage ?? (gp > 0 ? tot.fpts / gp : null);
                    const snapPct = seasonTotals?.averageSnapPct ?? (tot.snapPctSum > 0 && gp > 0 ? Math.round((tot.snapPctSum / gp) * 10) / 10 : null);
                    return (
                  <div>
                    <h3 className={`font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Season Stats</h3>
                    <p className={`text-xs mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Year-over-year totals</p>
                    <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[500px]">
                          {player.position === 'QB' ? (
                            <>
                              <thead>
                                <tr className={`border-b ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={2}>Season</th>
                                  <th className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={2}>Fantasy</th>
                                  <th className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={5}>Passing</th>
                                  <th className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={2}>Rushing</th>
                                </tr>
                                <tr className={`border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-slate-100/80'}`}>
                                  <th className={`px-4 py-2.5 text-left text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>YR</th>
                                  <th className={`px-4 py-2.5 text-left text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TM</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FPTS</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>GP</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>AVG</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>SNAP%</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>CMP</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>ATT</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>YDS</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TD</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>INT</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>YDS</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TD</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className={`border-b transition-colors ${isDarkMode ? 'border-slate-700/50 hover:bg-slate-700/30' : 'border-slate-200/80 hover:bg-slate-100/50'}`}>
                                  <td className={`px-4 py-3 font-semibold ${colBorder(isDarkMode)} ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>'{(weeklyStats[0]?.seasonYear ?? new Date().getFullYear()).toString().slice(2)}</td>
                                  <td className={`px-4 py-3 font-medium ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{player.team}</td>
                                  <td className={`px-4 py-3 text-center font-bold ${colBorder(isDarkMode)} ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{tot.fpts.toFixed(1)}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{gp}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{avg != null ? avg.toFixed(1) : '-'}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{snapPct != null ? `${snapPct}%` : '-'}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.passCmp}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.passAtt}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.passYds.toLocaleString()}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.passTDs}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.passInt}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.rushYds}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.rushTDs}</td>
                                </tr>
                              </tbody>
                            </>
                          ) : player.position === 'K' ? (
                            <>
                              <thead>
                                <tr className={`border-b ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={2}></th>
                                  <th className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={2}>Fantasy</th>
                                  <th className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={4}>Field Goals</th>
                                  <th className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={2}>Extra Pts</th>
                                </tr>
                                <tr className={`border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-slate-100/80'}`}>
                                  <th className={`px-4 py-2.5 text-left text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>YR</th>
                                  <th className={`px-4 py-2.5 text-left text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TM</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FPTS</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>G</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FGM</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FGA</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FG%</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>LNG</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>XPM</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>XPA</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className={`border-b transition-colors ${isDarkMode ? 'border-slate-700/50 hover:bg-slate-700/30' : 'border-slate-200/80 hover:bg-slate-100/50'}`}>
                                  <td className={`px-4 py-3 font-semibold ${colBorder(isDarkMode)} ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>'{(weeklyStats[0]?.seasonYear ?? new Date().getFullYear()).toString().slice(2)}</td>
                                  <td className={`px-4 py-3 font-medium ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{player.team}</td>
                                  <td className={`px-4 py-3 text-center font-bold ${colBorder(isDarkMode)} ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{tot.fpts.toFixed(1)}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{gp}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.fgm}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.fga}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.fga > 0 ? ((tot.fgm/tot.fga)*100).toFixed(1) : '0'}%</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>-</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.xpm}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.xpa}</td>
                                </tr>
                              </tbody>
                            </>
                          ) : player.position === 'DEF' ? (
                            <>
                              <thead>
                                <tr className={`border-b ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={2}></th>
                                  <th className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={2}>Fantasy</th>
                                  <th className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={5}>Defense</th>
                                </tr>
                                <tr className={`border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-slate-100/80'}`}>
                                  <th className={`px-4 py-2.5 text-left text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>YR</th>
                                  <th className={`px-4 py-2.5 text-left text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TM</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FPTS</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>G</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>SACK</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>INT</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FR</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TD</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>PA</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className={`border-b transition-colors ${isDarkMode ? 'border-slate-700/50 hover:bg-slate-700/30' : 'border-slate-200/80 hover:bg-slate-100/50'}`}>
                                  <td className={`px-4 py-3 font-semibold ${colBorder(isDarkMode)} ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>'{(weeklyStats[0]?.seasonYear ?? new Date().getFullYear()).toString().slice(2)}</td>
                                  <td className={`px-4 py-3 font-medium ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{player.team}</td>
                                  <td className={`px-4 py-3 text-center font-bold ${colBorder(isDarkMode)} ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{tot.fpts.toFixed(1)}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{gp}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.sack}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.defInt}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.fr}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.defTd}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.pa}</td>
                                </tr>
                              </tbody>
                            </>
                          ) : player.position === 'WR' || player.position === 'TE' || player.position === 'FLEX' ? (
                            <>
                              <thead>
                                <tr className={`border-b ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={2}></th>
                                  <th className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={3}>Fantasy</th>
                                  <th className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={5}>Receiving</th>
                                  <th className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={3}>Rushing</th>
                                </tr>
                                <tr className={`border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-slate-100/80'}`}>
                                  <th className={`px-4 py-2.5 text-left text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>YR</th>
                                  <th className={`px-4 py-2.5 text-left text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TM</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FPTS</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>G</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>SNAP%</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TGT</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>REC</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>YDS</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Y/R</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TD</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>ATT</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>YDS</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TD</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className={`border-b transition-colors ${isDarkMode ? 'border-slate-700/50 hover:bg-slate-700/30' : 'border-slate-200/80 hover:bg-slate-100/50'}`}>
                                  <td className={`px-4 py-3 font-semibold ${colBorder(isDarkMode)} ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>'{(weeklyStats[0]?.seasonYear ?? new Date().getFullYear()).toString().slice(2)}</td>
                                  <td className={`px-4 py-3 font-medium ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{player.team}</td>
                                  <td className={`px-4 py-3 text-center font-bold ${colBorder(isDarkMode)} ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{tot.fpts.toFixed(1)}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{gp}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{snapPct != null ? `${snapPct}%` : '-'}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.tgt}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.rec}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.recYds.toLocaleString()}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.rec ? (tot.recYds/tot.rec).toFixed(1) : '—'}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.recTDs}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.rushAtt}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.rushYds}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.rushTDs}</td>
                                </tr>
                              </tbody>
                            </>
                          ) : (
                            <>
                              <thead>
                                <tr className={`border-b ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={2}></th>
                                  <th className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={3}>Fantasy</th>
                                  <th className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={4}>Rushing</th>
                                  <th className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={4}>Receiving</th>
                                </tr>
                                <tr className={`border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-slate-100/80'}`}>
                                  <th className={`px-4 py-2.5 text-left text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>YR</th>
                                  <th className={`px-4 py-2.5 text-left text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TM</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FPTS</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>G</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>SNAP%</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>ATT</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>YDS</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Y/A</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TD</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>REC</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>YDS</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Y/R</th>
                                  <th className={`px-4 py-2.5 text-center text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TD</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className={`border-b transition-colors ${isDarkMode ? 'border-slate-700/50 hover:bg-slate-700/30' : 'border-slate-200/80 hover:bg-slate-100/50'}`}>
                                  <td className={`px-4 py-3 font-semibold ${colBorder(isDarkMode)} ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>'{(weeklyStats[0]?.seasonYear ?? new Date().getFullYear()).toString().slice(2)}</td>
                                  <td className={`px-4 py-3 font-medium ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{player.team}</td>
                                  <td className={`px-4 py-3 text-center font-bold ${colBorder(isDarkMode)} ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{tot.fpts.toFixed(1)}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{gp}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{snapPct != null ? `${snapPct}%` : '-'}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.rushAtt}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.rushYds.toLocaleString()}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.rushAtt ? (tot.rushYds/tot.rushAtt).toFixed(1) : '—'}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.rushTDs}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.rec}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.recYds.toLocaleString()}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.rec ? (tot.recYds/tot.rec).toFixed(1) : '—'}</td>
                                  <td className={`px-4 py-3 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{tot.recTDs}</td>
                                </tr>
                              </tbody>
                            </>
                          )}
                        </table>
                      </div>
                      {/* Timeline slider */}
                      <div className={`px-4 py-3 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-slate-600' : 'bg-slate-300'}`}></div>
                          <div className={`flex-1 h-1 rounded-full ${isDarkMode ? 'bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600' : 'bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300'}`}></div>
                          <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-slate-600' : 'bg-slate-300'}`}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                    );
                  })()}

                  {/* Game Logs */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Game Logs</h3>
                        <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Week-by-week performance</p>
                      </div>
                      <select
                        value={selectedSeason}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSelectedSeason(v === 'latest' ? 'latest' : Number(v));
                        }}
                        className={`border rounded-lg px-3 py-2 text-sm font-medium ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                      >
                        <option value="latest">
                          Most recent{seasonOptions[0] ? ` (${seasonOptions[0]})` : ''}
                        </option>
                        {seasonOptions.filter((y) => y !== seasonOptions[0]).map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                    <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      {apiGameLogs && apiGameLogs.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[400px]">
                          {player.position === 'QB' ? (
                            <>
                              <thead>
                                <tr className={`border-b ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                                  <th className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={2}></th>
                                  <th className={`px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={2}>Fantasy</th>
                                  <th className={`px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={5}>Passing</th>
                                  <th className={`px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={2}>Rushing</th>
                                </tr>
                                <tr className={`border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-slate-100/80'}`}>
                                  <th className={`px-3 py-2 text-left text-xs font-medium w-10 ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>WK</th>
                                  <th className={`px-3 py-2 text-left text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>OPP</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FPTS</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FIN</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>CMP</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>ATT</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>YDS</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TD</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>INT</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>YDS</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TD</th>
                                </tr>
                              </thead>
                              <tbody>
                                {apiGameLogs.map((game: { week: number; opp: string; isAway: boolean; fpts: string | number; fin: string; cmp: number; att: number; passYds: number; passTd: number; int: number; rushYds: number; rushTd: number }, index: number) => (
                                  <tr key={index} className={`border-b transition-colors ${isDarkMode ? 'border-slate-700/50 hover:bg-slate-700/30' : 'border-slate-200/80 hover:bg-slate-100/50'}`}>
                                    <td className={`px-3 py-2.5 font-medium ${colBorder(isDarkMode)} ${statMuted(isDarkMode)}`}>{game.week}</td>
                                    <td className={`px-3 py-2.5 font-medium ${colBorder(isDarkMode)} ${game.isAway ? 'text-blue-500' : statText(isDarkMode)}`}>
                                      {game.isAway ? '@' : ''}{game.opp}
                                    </td>
                                    <td className={`px-3 py-2.5 text-center font-semibold ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.fpts}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statMuted(isDarkMode)}`}>{game.fin}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.cmp}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statMuted(isDarkMode)}`}>{game.att}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.passYds}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.passTd}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.int}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.rushYds}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.rushTd}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </>
                          ) : player.position === 'K' ? (
                            <>
                              <thead>
                                <tr className={`border-b ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                                  <th className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={2}></th>
                                  <th className={`px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={2}>Fantasy</th>
                                  <th className={`px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={3}>Field Goals</th>
                                  <th className={`px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={2}>Extra Pts</th>
                                </tr>
                                <tr className={`border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-slate-100/80'}`}>
                                  <th className={`px-3 py-2 text-left text-xs font-medium w-10 ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>WK</th>
                                  <th className={`px-3 py-2 text-left text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>OPP</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FPTS</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FIN</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FGM</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FGA</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>LNG</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>XPM</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>XPA</th>
                                </tr>
                              </thead>
                              <tbody>
                                {apiGameLogs.map((game: { week: number; opp: string; isAway: boolean; fpts: string | number; fin: string; fgm: number; fga: number; lng: number; xpm: number; xpa: number }, index: number) => (
                                  <tr key={index} className={`border-b transition-colors ${isDarkMode ? 'border-slate-700/50 hover:bg-slate-700/30' : 'border-slate-200/80 hover:bg-slate-100/50'}`}>
                                    <td className={`px-3 py-2.5 font-medium ${colBorder(isDarkMode)} ${statMuted(isDarkMode)}`}>{game.week}</td>
                                    <td className={`px-3 py-2.5 font-medium ${colBorder(isDarkMode)} ${game.isAway ? 'text-blue-500' : statText(isDarkMode)}`}>
                                      {game.isAway ? '@' : ''}{game.opp}
                                    </td>
                                    <td className={`px-3 py-2.5 text-center font-semibold ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.fpts}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statMuted(isDarkMode)}`}>{game.fin}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.fgm}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statMuted(isDarkMode)}`}>{game.fga}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.lng}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.xpm}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statMuted(isDarkMode)}`}>{game.xpa}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </>
                          ) : player.position === 'DEF' ? (
                            <>
                              <thead>
                                <tr className={`border-b ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                                  <th className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={2}></th>
                                  <th className={`px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={2}>Fantasy</th>
                                  <th className={`px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={5}>Defense</th>
                                </tr>
                                <tr className={`border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-slate-100/80'}`}>
                                  <th className={`px-3 py-2 text-left text-xs font-medium w-10 ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>WK</th>
                                  <th className={`px-3 py-2 text-left text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>OPP</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FPTS</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FIN</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>SACK</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>INT</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FR</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TD</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>PA</th>
                                </tr>
                              </thead>
                              <tbody>
                                {apiGameLogs.map((game: { week: number; opp: string; isAway: boolean; fpts: string | number; fin: string; sack: number; int: number; fr: number; td: number; pa: number }, index: number) => (
                                  <tr key={index} className={`border-b transition-colors ${isDarkMode ? 'border-slate-700/50 hover:bg-slate-700/30' : 'border-slate-200/80 hover:bg-slate-100/50'}`}>
                                    <td className={`px-3 py-2.5 font-medium ${colBorder(isDarkMode)} ${statMuted(isDarkMode)}`}>{game.week}</td>
                                    <td className={`px-3 py-2.5 font-medium ${colBorder(isDarkMode)} ${game.isAway ? 'text-blue-500' : statText(isDarkMode)}`}>
                                      {game.isAway ? '@' : ''}{game.opp}
                                    </td>
                                    <td className={`px-3 py-2.5 text-center font-semibold ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.fpts}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statMuted(isDarkMode)}`}>{game.fin}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.sack}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.int}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.fr}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.td}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.pa}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </>
                          ) : player.position === 'WR' || player.position === 'TE' || player.position === 'FLEX' ? (
                            <>
                              <thead>
                                <tr className={`border-b ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                                  <th className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={2}></th>
                                  <th className={`px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={3}>Fantasy</th>
                                  <th className={`px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={4}>Receiving</th>
                                  <th className={`px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={3}>Rushing</th>
                                </tr>
                                <tr className={`border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-slate-100/80'}`}>
                                  <th className={`px-3 py-2 text-left text-xs font-medium w-10 ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>WK</th>
                                  <th className={`px-3 py-2 text-left text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>OPP</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FPTS</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>SNP%</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FIN</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TGT</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>REC</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>YDS</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TD</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>ATT</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>YDS</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TD</th>
                                </tr>
                              </thead>
                              <tbody>
                                {apiGameLogs.map((game: { week: number; opp: string; isAway: boolean; fpts: string | number; snpPct: number | null; fin: string; tgt: number; rec: number; recYds: number; recTd: number; rushAtt: number; rushYds: number; rushTd: number }, index: number) => (
                                  <tr key={index} className={`border-b transition-colors ${isDarkMode ? 'border-slate-700/50 hover:bg-slate-700/30' : 'border-slate-200/80 hover:bg-slate-100/50'}`}>
                                    <td className={`px-3 py-2.5 font-medium ${colBorder(isDarkMode)} ${statMuted(isDarkMode)}`}>{game.week}</td>
                                    <td className={`px-3 py-2.5 font-medium ${colBorder(isDarkMode)} ${game.isAway ? 'text-blue-500' : statText(isDarkMode)}`}>
                                      {game.isAway ? '@' : ''}{game.opp}
                                    </td>
                                    <td className={`px-3 py-2.5 text-center font-semibold ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.fpts}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.snpPct != null ? `${game.snpPct}%` : '-'}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statMuted(isDarkMode)}`}>{game.fin}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.tgt}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.rec}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.recYds}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.recTd}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${game.rushAtt > 0 ? statText(isDarkMode) : statMuted(isDarkMode)}`}>{game.rushAtt}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.rushYds}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.rushTd}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </>
                          ) : (
                            <>
                              <thead>
                                <tr className={`border-b ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                                  <th className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={2}></th>
                                  <th className={`px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={3}>Fantasy</th>
                                  <th className={`px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={4}>Rushing</th>
                                  <th className={`px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={5}>Receiving</th>
                                </tr>
                                <tr className={`border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-slate-100/80'}`}>
                                  <th className={`px-3 py-2 text-left text-xs font-medium w-10 ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>WK</th>
                                  <th className={`px-3 py-2 text-left text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>OPP</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FPTS</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>SNP%</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FIN</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>ATT</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>YDS</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Y/A</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TD</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TGT</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>REC</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>YDS</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${colBorder(isDarkMode)} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Y/R</th>
                                  <th className={`px-3 py-2 text-center text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>TD</th>
                                </tr>
                              </thead>
                              <tbody>
                                {apiGameLogs.map((game: { week: number; opp: string; isAway: boolean; fpts: string | number; snpPct: number | null; fin: string; rushAtt: number; rushYds: number; rushYpa: string | number; rushTd: number; tgt: number; rec: number; recYds: number; recYpr: string | number; recTd: number }, index: number) => (
                                  <tr key={index} className={`border-b transition-colors ${isDarkMode ? 'border-slate-700/50 hover:bg-slate-700/30' : 'border-slate-200/80 hover:bg-slate-100/50'}`}>
                                    <td className={`px-3 py-2.5 font-medium ${colBorder(isDarkMode)} ${statMuted(isDarkMode)}`}>{game.week}</td>
                                    <td className={`px-3 py-2.5 font-medium ${colBorder(isDarkMode)} ${game.isAway ? 'text-blue-500' : statText(isDarkMode)}`}>
                                      {game.isAway ? '@' : ''}{game.opp}
                                    </td>
                                    <td className={`px-3 py-2.5 text-center font-semibold ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.fpts}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.snpPct != null ? `${game.snpPct}%` : '-'}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statMuted(isDarkMode)}`}>{game.fin}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.rushAtt}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.rushYds}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.rushYpa}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.rushTd}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.tgt}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.rec}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.recYds}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.recYpr}</td>
                                    <td className={`px-3 py-2.5 text-center ${colBorder(isDarkMode)} ${statText(isDarkMode)}`}>{game.recTd}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </>
                          )}
                        </table>
                      </div>
                      ) : (
                        <div className={`px-6 py-12 text-center ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {statsLoading ? 'Loading...' : `No game log data available for ${typeof selectedSeason === 'number' ? selectedSeason : (seasonOptions[0] ?? 'this season')}.`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* FilmRoom Insights */}
            <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-yellow-500" />
                <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>FilmRoom Insights</h3>
              </div>
              <div className="space-y-3 mb-6">
                {matchupData?.grade ? (
                  <>
                    <div className="flex items-start gap-2">
                      <Target className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: getGradeStyle(matchupGrade).color }} />
                      <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        {matchupData.opponent ? (
                          <>
                            <strong style={{ color: getGradeStyle(matchupGrade).color }}>{getMatchupGradeLabel(matchupGrade)} matchup vs {matchupData.opponent}</strong>
                            {' — '}allows {matchupData.avgPointsAllowed} {(matchupData.format || 'ppr').toUpperCase()} pts/game to {matchupData.position}s
                            {matchupData.leagueAvg ? ` (league avg: ${matchupData.leagueAvg})` : ''}.
                          </>
                        ) : (
                          <>
                            {player.name} has a <strong style={{ color: getGradeStyle(matchupGrade).color }}>{getMatchupGradeLabel(matchupGrade).toLowerCase()} matchup</strong>.
                          </>
                        )}
                      </p>
                    </div>
                    {matchupData.gameBreakdown && matchupData.gameBreakdown.length > 0 && (
                      <div className="flex items-start gap-2">
                        <Calendar className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                        <div className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          <span className="font-medium">Last {matchupData.gamesAnalyzed} games vs {matchupData.position}s:</span>
                          <div className="flex gap-2 mt-1.5 flex-wrap">
                            {matchupData.gameBreakdown.map((g) => (
                              <span
                                key={g.week}
                                className={`text-xs px-2 py-1 rounded font-medium ${
                                  matchupData.leagueAvg && g.pointsAllowed > matchupData.leagueAvg
                                    ? isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                                    : isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
                                }`}
                                title={`Week ${g.week}: ${g.pointsAllowed} pts allowed to ${matchupData.position}s`}
                              >
                                Wk{g.week}: {g.pointsAllowed}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {matchupData.ratio !== undefined && (
                      <div className="flex items-start gap-2">
                        <Star className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          {matchupData.ratio >= 1.10
                            ? <>This defense gives up <strong className="text-green-500">{Math.round((matchupData.ratio - 1) * 100)}% more</strong> than league average to {matchupData.position}s.</>
                            : matchupData.ratio <= 0.90
                              ? <>This defense holds {matchupData.position}s to <strong className="text-red-500">{Math.round((1 - matchupData.ratio) * 100)}% less</strong> than league average.</>
                              : <>This defense is <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>near league average</strong> against {matchupData.position}s.</>
                          }
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-start gap-2">
                    <Target className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                    <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {matchupData === null ? 'No matchup data available.' : 'Loading matchup analysis...'}
                    </p>
                  </div>
                )}
              </div>

            </div>

            {/* Key Line Spotlight — only show when real data exists */}
            {player.keyLine ? (
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg p-6 border border-blue-500/30">
                <h4 className="text-white font-bold mb-2">Key Line</h4>
                <p className="text-2xl font-bold text-white mb-1">{player.keyLine}</p>
                <p className="text-blue-200 text-sm">Market consensus across major sportsbooks</p>
              </div>
            ) : null}

            {/* AdSense Ad Unit */}
            <div className="my-4 rounded-lg overflow-hidden">
              <div className={`text-[10px] text-slate-600 text-center mb-1`}>Ad</div>
              <AdUnit slot="playercard-bottom" isDarkMode={isDarkMode} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
