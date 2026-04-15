import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Trophy,
  Clock,
  ChevronRight,
  AlertCircle,
  Loader2,
  ArrowLeftRight,
  RefreshCw,
  Plus,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { Player } from '../App';
import { NewsSnippet } from './NewsSnippet';
import type { Game } from '../types/game';
import { useTrendingPlayers, useNews, useEspnScoreboard } from '../hooks';
import { useLeagueContext, type RosterPlayer } from '../context/LeagueContext';
import { useAuth } from '../context/AuthContext';

interface HomeViewProps {
  onPlayerClick: (player: Player) => void;
  onViewChange: (view: 'Board' | 'Team' | 'Matchup' | 'Waivers' | 'Home' | 'GameSlate' | 'TradeAnalyzer') => void;
  onGameSelect: (game: Game) => void;
  isDarkMode: boolean;
}

// Valid fantasy positions (module-level constant to avoid re-creation each render)
const VALID_POSITIONS = new Set<Player['position']>(['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'FLEX']);
const INJURY_STATUSES = new Set(['questionable', 'doubtful', 'out', 'injured_reserve']);

// Status badge full labels for accessibility
const STATUS_LABELS: Record<string, string> = {
  O: 'Out',
  D: 'Doubtful',
  Q: 'Questionable',
  IR: 'Injured Reserve',
  '?': 'Unknown',
};

// Helper to get ordinal suffix (handles 11th/12th/13th correctly)
function getOrdinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

// Helper to format time ago
function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

// Helper to get impact color
function getImpactColor(impact?: string): { bg: string; text: string; label: string } {
  switch (impact) {
    case 'high':
      return { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Injury' };
    case 'medium':
      return { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Analysis' };
    case 'low':
    default:
      return { bg: 'bg-green-500/20', text: 'text-green-500', label: 'Update' };
  }
}

// Helper to get dot color based on impact
function getDotColor(impact?: string): string {
  switch (impact) {
    case 'high':
      return 'bg-red-500';
    case 'medium':
      return 'bg-blue-500';
    case 'low':
    default:
      return 'bg-green-500';
  }
}

// Helper to get status badge styling
function getStatusBadge(status?: string): { label: string; bg: string; cardBg: string } {
  switch (status) {
    case 'out':
      return { label: 'O', bg: 'bg-red-600', cardBg: 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20' };
    case 'doubtful':
      return { label: 'D', bg: 'bg-orange-500', cardBg: 'bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20' };
    case 'questionable':
      return { label: 'Q', bg: 'bg-yellow-500', cardBg: 'bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20' };
    case 'injured_reserve':
      return { label: 'IR', bg: 'bg-red-700', cardBg: 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20' };
    default:
      return { label: '?', bg: 'bg-slate-500', cardBg: 'bg-slate-500/10 border-slate-500/20 hover:bg-slate-500/20' };
  }
}

// Countdown formatter — returns days/hours/minutes until the target
function formatCountdown(targetMs: number, nowMs: number): { d: number; h: number; m: number; done: boolean } {
  const diff = targetMs - nowMs;
  if (diff <= 0) return { d: 0, h: 0, m: 0, done: true };
  const totalMin = Math.floor(diff / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  return { d, h, m, done: false };
}

// Position badge tint classes
function posClasses(pos: string): string {
  switch (pos) {
    case 'QB': return 'bg-red-500/15 text-red-400';
    case 'RB': return 'bg-green-500/15 text-green-400';
    case 'WR': return 'bg-blue-500/15 text-blue-400';
    case 'TE': return 'bg-amber-500/15 text-amber-400';
    default: return 'bg-slate-500/15 text-slate-400';
  }
}

// Get initials from a name (up to 2 chars)
function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function HomeView({ onPlayerClick, onViewChange, onGameSelect, isDarkMode }: HomeViewProps) {
  // Get league context data
  const { league, userTeam, roster, matchup, standings, refreshAll } = useLeagueContext();
  const { user } = useAuth();

  // Fetch real data from API
  const { trending, isLoading: trendingLoading, error: trendingError } = useTrendingPlayers('up');
  const { trending: trendingDown } = useTrendingPlayers('down');
  const { news, isLoading: newsLoading, error: newsError } = useNews(10);
  const { games: espnGames, espnUnavailable } = useEspnScoreboard();

  // UI state
  const [isResyncing, setIsResyncing] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());

  // Tick the countdown every minute (cheap — no need to re-render more often)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Locate the first game of the week
  const firstGame = useMemo(() => {
    if (!espnGames || espnGames.length === 0) return null;
    const sorted = [...espnGames].sort((a, b) =>
      new Date(a.gameTime).getTime() - new Date(b.gameTime).getTime()
    );
    const first = sorted[0];
    if (!first?.gameTime) return null;
    const t = new Date(first.gameTime).getTime();
    if (isNaN(t)) return null;
    return { game: first, timestamp: t };
  }, [espnGames]);

  // Live countdown to first game
  const countdown = useMemo(() => {
    if (!firstGame) return null;
    return formatCountdown(firstGame.timestamp, now);
  }, [firstGame, now]);

  // Short label (e.g. "Sat 3:30 PM") for greeting subline
  const firstGameShortLabel = useMemo(() => {
    if (espnUnavailable) return null;
    if (!firstGame) return null;
    const d = new Date(firstGame.timestamp);
    const day = d.toLocaleDateString('en-US', { weekday: 'short' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${day} ${time}`;
  }, [firstGame, espnUnavailable]);

  // Filter roster for injured/questionable players on the user's team
  const injuredRosterPlayers = useMemo(
    () => roster.filter(p => p.status && INJURY_STATUSES.has(p.status)),
    [roster],
  );

  // Calculate projection from roster — no fake fallbacks
  const starterProjection = useMemo(
    () => roster.filter(p => p.isStarter).reduce((sum, p) => sum + (p.projectedPoints || 0), 0),
    [roster],
  );

  // Starters on bye this week (bye week === current week)
  const starterOnBye = useMemo(() => {
    const wk = league?.currentWeek ?? null;
    if (wk == null) return [] as RosterPlayer[];
    return roster.filter(p => p.isStarter && p.byeWeek && p.byeWeek === wk);
  }, [roster, league]);

  // Injured starters (distinct from "questionable bench" — only ones in the lineup)
  const injuredStarters = useMemo(
    () => roster.filter(p => p.isStarter && p.status && INJURY_STATUSES.has(p.status)),
    [roster],
  );

  const lineupIssues = injuredStarters.length + starterOnBye.length;

  // Get user's standing — show null when unknown instead of fake rank
  const userStanding = standings.find(s => s.isUserTeam) ?? standings.find(s => s.teamId === userTeam?.id);
  const standingRank: number | null = userStanding?.rank ?? null;

  // Get opponent info from matchup context — null when no matchup, 0 when real zero
  const hasMatchup = !!matchup?.opponent?.id;
  const opponentName = hasMatchup ? (matchup?.opponent?.name || 'Opponent') : null;
  const opponentProjection: number | null = hasMatchup ? (matchup?.opponent?.projectedScore ?? 0) : null;

  // Delta between projections (positive => you favored)
  const projDelta = hasMatchup && opponentProjection != null
    ? starterProjection - opponentProjection
    : 0;
  const youFavored = projDelta > 0;

  // Convert API player (trending, news, or roster) to app Player format
  const convertToPlayer = useCallback((apiPlayer: { id: string; name: string; team: string; position: string; trendValue?: number; projectedPoints?: number; headshotUrl?: string | null; imageUrl?: string | null }): Player => ({
    id: apiPlayer.id,
    name: apiPlayer.name,
    team: apiPlayer.team,
    position: VALID_POSITIONS.has(apiPlayer.position as Player['position']) ? apiPlayer.position as Player['position'] : 'FLEX',
    keyLine: '',
    projectedPoints: apiPlayer.projectedPoints ?? 0,
    weekChange: apiPlayer.trendValue || 0,
    rank: 0,
    headshotUrl: apiPlayer.headshotUrl ?? apiPlayer.imageUrl ?? null,
  }), []);

  // Top trending players for the waiver table (keep the raw type for trendValue/ownedPct access)
  const topPickups = useMemo(() => trending.slice(0, 5), [trending]);

  // Compact risers/fallers for the rankings-shifts panel
  const risersTop = useMemo(() => trending.slice(0, 4), [trending]);
  const fallersTop = useMemo(() => trendingDown.slice(0, 4), [trendingDown]);

  // Filter news to only players on the user's roster (memoized)
  const myTeamNews = useMemo(() => {
    const rosterPlayerIds = new Set(roster.map((p) => p.id));
    return news.filter((item) => {
      const playerId = item.playerId ?? item.player?.id;
      if (!playerId) return false;
      return rosterPlayerIds.has(playerId);
    });
  }, [news, roster]);

  // Prefer roster-relevant news but fall back to all news so the panel isn't empty
  const displayedNews = myTeamNews.length > 0 ? myTeamNews : news;

  // Re-sync handler
  const handleResync = useCallback(async () => {
    if (isResyncing || !league) return;
    setIsResyncing(true);
    try {
      await refreshAll();
    } catch {
      // LeagueContext surfaces its own error state — don't re-throw here
    } finally {
      setIsResyncing(false);
    }
  }, [isResyncing, league, refreshAll]);

  // Personalised greeting target
  const displayName = userTeam?.name ?? user?.username ?? 'Coach';

  // Reference the prop to keep it in the signature without TS/lint warnings
  void onGameSelect;

  // Style shortcuts used across panels
  const panelCls = `rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`;
  const panelHeadCls = `flex items-center gap-3 p-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`;
  const textCls = isDarkMode ? 'text-white' : 'text-slate-900';
  const mutedCls = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="space-y-4">
      {/* Greeting row */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div className="min-w-0">
          <h1 className={`text-2xl font-bold tracking-tight flex items-center gap-2 ${textCls}`}>
            <span aria-hidden="true">👋</span>
            Welcome back, {displayName}.
          </h1>
          <p className={`text-sm mt-1 flex items-center gap-2 flex-wrap ${mutedCls}`}>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {league?.name ?? 'No league connected'}
            {league && <> · Week {league.currentWeek}</>}
            {firstGameShortLabel && <> · {firstGameShortLabel} kickoff</>}
            {myTeamNews.length > 0 && (
              <>
                {' '}· {myTeamNews.length} player{myTeamNews.length === 1 ? '' : 's'} with news
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleResync}
            disabled={isResyncing || !league}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isDarkMode
                ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-600'
                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isResyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
            {isResyncing ? 'Syncing…' : 'Re-sync league'}
          </button>
          <button
            type="button"
            onClick={() => onViewChange('TradeAnalyzer')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            New trade
          </button>
        </div>
      </div>

      {/* Hero: matchup + countdown + lineup state */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-3">
        {/* Main hero (matchup) */}
        <div className={`relative overflow-hidden rounded-2xl border p-6 ${
          isDarkMode
            ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 border-slate-700'
            : 'bg-gradient-to-br from-white to-blue-50/40 border-slate-200'
        }`}>
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" aria-hidden="true" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-500">
                {league ? `Week ${league.currentWeek} · This Week` : 'This Week'}
              </span>
              {firstGame && countdown && !countdown.done && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 text-[10px] font-bold tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
                  UPCOMING
                </span>
              )}
            </div>
            <h2 className={`text-2xl font-bold mb-2 leading-tight ${textCls}`}>
              {hasMatchup
                ? Math.abs(projDelta) < 5
                  ? 'Your matchup is looking like a coin flip.'
                  : youFavored
                  ? "You're projected to win by a comfortable margin."
                  : "You're the projected underdog this week."
                : 'Get your team set for this week.'}
            </h2>
            {hasMatchup && opponentProjection != null && starterProjection > 0 && (
              <p className={`text-sm max-w-lg mb-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                Projections have{' '}
                {youFavored ? 'you winning' : `${opponentName} winning`} by{' '}
                <b className={textCls}>{Math.abs(projDelta).toFixed(1)} points</b>.
                Review your lineup below to firm up the edge.
              </p>
            )}
            {hasMatchup && opponentProjection != null && (
              <div className={`grid grid-cols-[1fr_60px_1fr] gap-4 items-center p-4 rounded-xl border mb-4 ${
                isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {getInitials(userTeam?.name || 'You')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-semibold truncate ${textCls}`}>
                      {userTeam?.name || 'You'}
                    </div>
                    <div className={`text-[11px] mt-0.5 ${mutedCls}`}>
                      {userTeam ? `${userTeam.wins}-${userTeam.losses}${userTeam.ties > 0 ? `-${userTeam.ties}` : ''}` : '—'}
                      {standingRank != null ? ` · ${standingRank}${getOrdinal(standingRank)}` : ''}
                    </div>
                    <div className={`mt-1 flex items-baseline gap-1 font-bold text-base ${youFavored ? 'text-emerald-500' : textCls}`}>
                      <span className={`text-[9px] uppercase font-normal tracking-wider ${mutedCls}`}>proj</span>
                      <span className="font-mono">{starterProjection > 0 ? starterProjection.toFixed(1) : '—'}</span>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <div className={`font-mono text-[11px] tracking-[.15em] font-bold ${mutedCls}`}>VS</div>
                </div>
                <div className="flex items-center gap-3 min-w-0 flex-row-reverse text-right">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                    isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {getInitials(opponentName || '?')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-semibold truncate ${textCls}`}>
                      {opponentName || 'Opponent'}
                    </div>
                    <div className={`text-[11px] mt-0.5 ${mutedCls}`}>Opponent</div>
                    <div className={`mt-1 flex items-baseline gap-1 font-bold text-base justify-end ${!youFavored ? 'text-emerald-500' : textCls}`}>
                      <span className={`text-[9px] uppercase font-normal tracking-wider ${mutedCls}`}>proj</span>
                      <span className="font-mono">{opponentProjection.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onViewChange('Team')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
              >
                <Check className="w-4 h-4" aria-hidden="true" />
                Set Lineup
              </button>
              <button
                type="button"
                onClick={() => onViewChange('Matchup')}
                disabled={!hasMatchup}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDarkMode
                    ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-600'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <Clock className="w-4 h-4" aria-hidden="true" />
                View full matchup
              </button>
            </div>
          </div>
        </div>

        {/* Right: countdown + lineup state */}
        <div className="grid grid-rows-[auto_1fr] gap-3">
          <div className={`rounded-2xl border p-5 ${panelCls}`}>
            <div className={`flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold mb-2 ${mutedCls}`}>
              First Kickoff
              {countdown && !countdown.done && (
                <span className="text-amber-500">● Lineup locks in</span>
              )}
            </div>
            {countdown ? (
              countdown.done ? (
                <div className={`font-mono font-bold text-lg ${textCls}`}>Games live</div>
              ) : (
                <div className={`flex items-baseline gap-1 font-bold ${textCls}`}>
                  <span className="font-mono text-3xl tracking-tight">{String(countdown.d).padStart(2, '0')}</span>
                  <span className={`text-xs font-medium mr-1 ${mutedCls}`}>d</span>
                  <span className="font-mono text-3xl tracking-tight">{String(countdown.h).padStart(2, '0')}</span>
                  <span className={`text-xs font-medium mr-1 ${mutedCls}`}>h</span>
                  <span className="font-mono text-3xl tracking-tight">{String(countdown.m).padStart(2, '0')}</span>
                  <span className={`text-xs font-medium ${mutedCls}`}>m</span>
                </div>
              )
            ) : (
              <div className={`text-sm ${mutedCls}`}>No upcoming games</div>
            )}
            {firstGame && (
              <div className={`text-xs mt-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                {new Date(firstGame.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                {' · '}
                {new Date(firstGame.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                {firstGame.game.awayTeam && firstGame.game.homeTeam && (
                  <> · <span className="text-blue-500">{firstGame.game.awayTeam} @ {firstGame.game.homeTeam}</span></>
                )}
              </div>
            )}
          </div>

          <div className={`rounded-2xl border p-5 flex flex-col gap-3 ${panelCls}`}>
            <div className="flex items-start justify-between gap-3">
              <h3 className={`text-base font-bold leading-tight ${textCls}`}>
                {lineupIssues > 0
                  ? <>Your lineup has <span className="text-amber-500">{lineupIssues} issue{lineupIssues === 1 ? '' : 's'}</span></>
                  : userTeam
                  ? 'Your lineup looks solid'
                  : 'Sync a league to check your lineup'}
              </h3>
              {userTeam && (
                lineupIssues > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-500 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                    Action needed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-500 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                    <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                    All clear
                  </span>
                )
              )}
            </div>
            <div className="space-y-2 flex-1">
              {injuredStarters.slice(0, 2).map((p) => (
                <div key={`inj-${p.id}`} className="flex items-center gap-2 text-[12.5px] text-amber-500">
                  <span className="inline-grid place-items-center w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-black">!</span>
                  {p.name} is {p.status === 'out' ? 'Out' : p.status === 'doubtful' ? 'Doubtful' : 'Questionable'}
                </div>
              ))}
              {starterOnBye.slice(0, 2).map((p) => (
                <div key={`bye-${p.id}`} className="flex items-center gap-2 text-[12.5px] text-amber-500">
                  <span className="inline-grid place-items-center w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-black">!</span>
                  {p.name} is on bye this week
                </div>
              ))}
              {lineupIssues === 0 && userTeam && (
                <div className="flex items-center gap-2 text-[12.5px] text-emerald-500">
                  <span className="inline-grid place-items-center w-4 h-4 rounded-full bg-emerald-500 text-black text-[9px] font-bold">✓</span>
                  All starters cleared to play
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onViewChange('Team')}
              className="mt-auto text-center py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold transition-colors"
            >
              {lineupIssues > 0 ? 'Review & fix →' : 'Review lineup →'}
            </button>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => onViewChange('TradeAnalyzer')}
          className={`group flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
            isDarkMode ? 'bg-slate-900 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
            <ArrowLeftRight className="w-[18px] h-[18px] text-blue-500" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-semibold ${textCls}`}>Trade Analyzer</div>
            <div className={`text-xs mt-1 ${mutedCls}`}>Build and grade trade scenarios</div>
          </div>
          <span className={`text-xl ${mutedCls}`} aria-hidden="true">›</span>
        </button>
        <button
          type="button"
          onClick={() => onViewChange('Waivers')}
          className={`group flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
            isDarkMode ? 'bg-slate-900 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <Plus className="w-[18px] h-[18px] text-emerald-500" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-semibold flex items-center gap-2 ${textCls}`}>
              Waivers
              {trending.length > 0 && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-bold">
                  {trending.length} new
                </span>
              )}
            </div>
            <div className={`text-xs mt-1 ${mutedCls}`}>Trending pickups &amp; flagged adds</div>
          </div>
          <span className={`text-xl ${mutedCls}`} aria-hidden="true">›</span>
        </button>
        <button
          type="button"
          onClick={() => onViewChange('Board')}
          className={`group flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
            isDarkMode ? 'bg-slate-900 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-[18px] h-[18px] text-amber-500" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-semibold flex items-center gap-2 ${textCls}`}>
              Rankings
              {(trending.length + trendingDown.length) > 0 && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 font-bold">
                  {trending.length + trendingDown.length} moved
                </span>
              )}
            </div>
            <div className={`text-xs mt-1 ${mutedCls}`}>Rest-of-season updated regularly</div>
          </div>
          <span className={`text-xl ${mutedCls}`} aria-hidden="true">›</span>
        </button>
      </div>

      {/* Row 1: Waivers table + Injuries */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3">
        {/* Waivers table */}
        <div className={panelCls}>
          <div className={panelHeadCls}>
            <h3 className={`text-sm font-bold flex items-center gap-2 ${textCls}`}>
              Top Waiver Pickups
              {league && (
                <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                  isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                }`}>
                  WEEK {league.currentWeek}
                </span>
              )}
            </h3>
            <button
              type="button"
              onClick={() => onViewChange('Waivers')}
              className={`ml-auto text-xs font-medium transition-colors ${
                isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              View all →
            </button>
          </div>
          {trendingLoading ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" aria-label="Loading trending players" />
            </div>
          ) : trendingError || topPickups.length === 0 ? (
            <div className={`p-8 text-center text-sm ${mutedCls}`}>
              {trendingError ? 'Failed to load trending players' : 'No trending players'}
            </div>
          ) : (
            <>
              <div
                className={`grid items-center gap-3 px-4 py-2 border-b text-[10px] uppercase tracking-wider font-bold ${mutedCls} ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}
                style={{ gridTemplateColumns: '26px 1fr 80px 80px 100px' }}
              >
                <div />
                <div>Player</div>
                <div>Trend</div>
                <div>Rostered</div>
                <div>Status</div>
              </div>
              {topPickups.map((p, i) => (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onPlayerClick(convertToPlayer(p))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPlayerClick(convertToPlayer(p));
                    }
                  }}
                  className={`grid items-center gap-3 px-4 py-2.5 border-b cursor-pointer transition-colors ${
                    isDarkMode ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50'
                  }`}
                  style={{ gridTemplateColumns: '26px 1fr 80px 80px 100px' }}
                >
                  <div className={`font-mono text-[11px] font-bold ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 border ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}>
                      {getInitials(p.name)}
                    </div>
                    <div className="min-w-0">
                      <div className={`text-[13px] font-semibold truncate ${textCls}`}>{p.name}</div>
                      <div className={`text-[11px] mt-0.5 flex items-center gap-1.5 ${mutedCls}`}>
                        <span className={`font-mono text-[9px] font-bold px-1 py-0.5 rounded ${posClasses(p.position)}`}>
                          {p.position}
                        </span>
                        {p.team}
                      </div>
                    </div>
                  </div>
                  <div className="font-mono text-emerald-500 font-bold text-[13px]">
                    +{p.trendValue ?? 0}
                  </div>
                  <div className={`font-mono text-[12px] font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                    {typeof p.ownedPct === 'number' ? `${p.ownedPct}%` : '—'}
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-500 text-[10px] font-bold uppercase tracking-wider">
                      <TrendingUp className="w-3 h-3" aria-hidden="true" /> Trending
                    </span>
                  </div>
                </div>
              ))}
              <div className={`p-3 text-center text-xs ${mutedCls}`}>
                <button
                  type="button"
                  onClick={() => onViewChange('Waivers')}
                  className="text-blue-500 font-semibold hover:underline"
                >
                  View all available players →
                </button>
              </div>
            </>
          )}
        </div>

        {/* Injuries */}
        <div className={panelCls}>
          <div className={panelHeadCls}>
            <h3 className={`text-sm font-bold flex items-center gap-2 ${textCls}`}>
              <AlertCircle className="w-4 h-4 text-red-500" aria-hidden="true" />
              Injury Alerts
            </h3>
            {roster.length > 0 && (
              <span className={`ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                injuredRosterPlayers.length > 0
                  ? 'bg-red-500/15 text-red-500'
                  : 'bg-emerald-500/15 text-emerald-500'
              }`}>
                {injuredRosterPlayers.length > 0
                  ? `${injuredRosterPlayers.length} on your roster`
                  : 'All healthy'}
              </span>
            )}
          </div>
          <div>
            {roster.length === 0 ? (
              <div className={`p-6 text-center text-sm ${mutedCls}`}>Sync a league to see alerts</div>
            ) : injuredRosterPlayers.length === 0 ? (
              <div className={`p-6 text-center text-sm ${mutedCls}`}>No injuries on your roster</div>
            ) : (
              injuredRosterPlayers.map((p) => {
                const isOut = p.status === 'out' || p.status === 'injured_reserve';
                const tagLabel = p.status === 'out' ? 'OUT' : p.status === 'injured_reserve' ? 'IR' : p.status === 'doubtful' ? 'Doubtful' : 'Questionable';
                const sevBar = isOut ? 'bg-red-500' : 'bg-amber-500';
                const tagCls = isOut ? 'bg-red-500/15 text-red-500' : 'bg-amber-500/15 text-amber-500';
                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onPlayerClick(convertToPlayer(p))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onPlayerClick(convertToPlayer(p));
                      }
                    }}
                    className={`flex items-center gap-3 p-4 border-b cursor-pointer transition-colors last:border-b-0 ${
                      isDarkMode ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-1 self-stretch rounded ${sevBar}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[13.5px] font-semibold ${textCls}`}>{p.name}</span>
                        <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${tagCls}`}>
                          {tagLabel}
                        </span>
                      </div>
                      <div className={`text-xs leading-relaxed ${mutedCls}`}>
                        {p.injuryBodyPart && (
                          <>
                            <b className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{p.injuryBodyPart}</b>
                            {p.injuryNote ? ' · ' : ''}
                          </>
                        )}
                        {p.injuryNote || `${p.position} · ${p.team}`}
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-blue-500 flex-shrink-0">Details →</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Row 2: News + Rankings Movers */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3">
        {/* News */}
        <div className={panelCls}>
          <div className={panelHeadCls}>
            <h3 className={`text-sm font-bold ${textCls}`}>Important Updates</h3>
            {myTeamNews.length > 0 && (
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500">
                {myTeamNews.length} on your roster
              </span>
            )}
          </div>
          <div>
            {newsLoading ? (
              <div className="p-8 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" aria-label="Loading news" />
              </div>
            ) : newsError ? (
              <div className={`p-6 text-center text-sm ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                Failed to load news
              </div>
            ) : displayedNews.length === 0 ? (
              <div className={`p-6 text-center text-sm ${mutedCls}`}>
                {roster.length > 0 ? 'No news for your players' : 'Join a league to see news'}
              </div>
            ) : (
              displayedNews.slice(0, 4).map((item) => {
                const impact = getImpactColor(item.impactLevel);
                return (
                  <div
                    key={item.id}
                    role={item.player ? 'button' : undefined}
                    tabIndex={item.player ? 0 : undefined}
                    onClick={() => item.player && onPlayerClick(convertToPlayer(item.player))}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && item.player) {
                        e.preventDefault();
                        onPlayerClick(convertToPlayer(item.player));
                      }
                    }}
                    className={`p-4 border-b transition-colors last:border-b-0 ${item.player ? 'cursor-pointer' : ''} ${
                      isDarkMode ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${impact.bg} ${impact.text}`}>
                        {impact.label}
                      </span>
                      <span className={`text-[11px] ${mutedCls}`}>{timeAgo(item.publishedAt)}</span>
                      {item.source && <span className={`text-[11px] ${mutedCls}`}>· {item.source}</span>}
                    </div>
                    <div className={`text-[13.5px] font-semibold leading-snug ${textCls}`}>
                      {item.headline}
                    </div>
                    <div className={`text-[12px] mt-1 leading-relaxed ${mutedCls}`}>
                      <NewsSnippet item={item} />
                    </div>
                    {item.player && (
                      <div className={`text-[11px] mt-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {item.player.name} · {item.player.position} · {item.player.team}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Rankings Movers */}
        <div className={panelCls}>
          <div className={panelHeadCls}>
            <h3 className={`text-sm font-bold flex items-center gap-2 ${textCls}`}>
              Rankings Shifts
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
              }`}>24H</span>
            </h3>
            <button
              type="button"
              onClick={() => onViewChange('Board')}
              className={`ml-auto text-xs font-medium transition-colors ${
                isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Full rankings →
            </button>
          </div>
          <div className="grid grid-cols-2">
            <div className={`p-4 border-r ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-emerald-500 mb-3">
                <ChevronUp className="w-3 h-3" aria-hidden="true" />
                Rising
              </div>
              {risersTop.length > 0 ? risersTop.map((p) => (
                <button
                  key={`up-${p.id}`}
                  type="button"
                  onClick={() => onPlayerClick(convertToPlayer(p))}
                  className={`w-full flex items-center gap-2 py-1.5 border-b border-dashed last:border-b-0 text-left transition-opacity hover:opacity-80 ${
                    isDarkMode ? 'border-slate-800' : 'border-slate-200'
                  }`}
                >
                  <span className={`font-mono text-[9px] font-bold px-1 py-0.5 rounded ${posClasses(p.position)}`}>
                    {p.position}
                  </span>
                  <span className={`flex-1 min-w-0 text-[12.5px] font-medium truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                    {p.name}
                  </span>
                  <span className="font-mono text-[11.5px] font-bold text-emerald-500">
                    +{p.trendValue ?? 0}
                  </span>
                </button>
              )) : (
                <div className={`text-xs text-center py-3 ${mutedCls}`}>No risers</div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-red-500 mb-3">
                <ChevronDown className="w-3 h-3" aria-hidden="true" />
                Falling
              </div>
              {fallersTop.length > 0 ? fallersTop.map((p) => (
                <button
                  key={`dn-${p.id}`}
                  type="button"
                  onClick={() => onPlayerClick(convertToPlayer(p))}
                  className={`w-full flex items-center gap-2 py-1.5 border-b border-dashed last:border-b-0 text-left transition-opacity hover:opacity-80 ${
                    isDarkMode ? 'border-slate-800' : 'border-slate-200'
                  }`}
                >
                  <span className={`font-mono text-[9px] font-bold px-1 py-0.5 rounded ${posClasses(p.position)}`}>
                    {p.position}
                  </span>
                  <span className={`flex-1 min-w-0 text-[12.5px] font-medium truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                    {p.name}
                  </span>
                  <span className="font-mono text-[11.5px] font-bold text-red-500">
                    -{p.trendValue ?? 0}
                  </span>
                </button>
              )) : (
                <div className={`text-xs text-center py-3 ${mutedCls}`}>No fallers</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
