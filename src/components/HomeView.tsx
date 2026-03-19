import { useMemo } from 'react';
import { TrendingUp, Trophy, Flame, Clock, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { Player } from '../App';
import { NewsSnippet } from './NewsSnippet';
import { Game } from './GameSlateView';
import { useTrendingPlayers, useNews, useEspnScoreboard } from '../hooks';
import { useLeagueContext, type RosterPlayer } from '../context/LeagueContext';

interface HomeViewProps {
  onPlayerClick: (player: Player) => void;
  onViewChange: (view: 'Board' | 'Team' | 'Matchup' | 'Waivers' | 'Home' | 'GameSlate') => void;
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

export function HomeView({ onPlayerClick, onViewChange, onGameSelect, isDarkMode }: HomeViewProps) {
  // Get league context data
  const { league, userTeam, roster, matchup, standings } = useLeagueContext();

  // Fetch real data from API
  const { trending, isLoading: trendingLoading, error: trendingError } = useTrendingPlayers('up');
  const { news, isLoading: newsLoading, error: newsError } = useNews(10);
  const { games: espnGames, espnUnavailable } = useEspnScoreboard();

  // Find the first game of the week for "Set Lineup" card (memoized)
  const firstGameLabel = useMemo(() => {
    if (espnUnavailable) return 'Schedule unavailable';
    if (!espnGames || espnGames.length === 0) return 'View your roster';
    const sorted = [...espnGames].sort((a, b) =>
      new Date(a.gameTime).getTime() - new Date(b.gameTime).getTime()
    );
    const first = sorted[0];
    if (!first?.gameTime) return 'View your roster';
    const d = new Date(first.gameTime);
    if (isNaN(d.getTime())) return 'View your roster';
    const day = d.toLocaleDateString('en-US', { weekday: 'short' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `First game ${day} ${time}`;
  }, [espnGames, espnUnavailable]);

  // Filter roster for injured/questionable players on the user's team
  const injuredRosterPlayers = roster.filter(p => p.status && INJURY_STATUSES.has(p.status));

  // Calculate projection from roster — no fake fallbacks
  const starterProjection = roster
    .filter(p => p.isStarter)
    .reduce((sum, p) => sum + (p.projectedPoints || 0), 0);

  // Get user's standing — show null when unknown instead of fake rank
  const userStanding = standings.find(s => s.isUserTeam) ?? standings.find(s => s.teamId === userTeam?.id);
  const standingRank: number | null = userStanding?.rank ?? null;

  // Get opponent info from matchup context — null when no matchup, 0 when real zero
  const hasMatchup = !!matchup?.opponent?.id;
  const opponentName = hasMatchup ? (matchup?.opponent?.name || 'Opponent') : 'No Opponent';
  const opponentProjection: number | null = hasMatchup ? (matchup?.opponent?.projectedScore ?? 0) : null;

  // Convert API player (trending, news, or roster) to app Player format
  const convertToPlayer = (apiPlayer: { id: string; name: string; team: string; position: string; trendValue?: number; projectedPoints?: number; headshotUrl?: string | null; imageUrl?: string | null }): Player => ({
    id: apiPlayer.id,
    name: apiPlayer.name,
    team: apiPlayer.team,
    position: VALID_POSITIONS.has(apiPlayer.position as Player['position']) ? apiPlayer.position as Player['position'] : 'FLEX',
    keyLine: '',
    projectedPoints: apiPlayer.projectedPoints ?? 0,
    weekChange: apiPlayer.trendValue || 0,
    rank: 0,
    headshotUrl: apiPlayer.headshotUrl ?? apiPlayer.imageUrl ?? null,
  });

  // Get top 3 trending players for waiver pickups (memoized)
  const topPickups = useMemo(
    () => trending.slice(0, 3).map(convertToPlayer),
    [trending] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Filter news to only players on the user's roster (memoized)
  const myTeamNews = useMemo(() => {
    const rosterPlayerIds = new Set(roster.map((p) => p.id));
    return news.filter((item) => {
      const playerId = item.playerId ?? item.player?.id;
      if (!playerId) return false;
      return rosterPlayerIds.has(playerId);
    });
  }, [news, roster]);

  return (
    <div className="space-y-6">
      {/* Hero Section - Simplified */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 relative">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              {userTeam ? `Welcome back, ${userTeam.name}` : 'Welcome back to FilmRoom'}
            </h1>
            <p className="text-blue-100">
              {starterProjection > 0
                ? <>Your team is projected to score <span className="font-bold text-white">{starterProjection.toFixed(1)} points</span> this week</>
                : <>Check your lineup for this week's projections</>}
              {league && <span className="text-blue-200"> in {league.name}</span>}
            </p>
          </div>

          {/* Record Badge */}
          <div className="bg-[#111]/80 rounded-lg px-4 py-2 text-center">
            <div className="text-2xl font-bold text-white">
              {userTeam ? `${userTeam.wins}-${userTeam.losses}${userTeam.ties > 0 ? `-${userTeam.ties}` : ''}` : '-'}
            </div>
            <div className="text-xs text-[#737373]">
              {standingRank != null ? `${standingRank}${getOrdinal(standingRank)} place` : 'No standings'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions - 3 Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => onViewChange('Matchup')}
              className={`rounded-lg p-4 border transition-all text-left group ${isDarkMode ? 'bg-[#111] border-[#222] hover:bg-[#1a1a1a]/50' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 border ${isDarkMode ? 'bg-[#1a1a1a] border-[#222]' : 'bg-slate-100 border-slate-200'}`}>
                <Trophy className="w-4 h-4 text-blue-400" aria-hidden="true" />
              </div>
              <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>View Matchup</div>
              <div className={`text-xs mt-1 ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>vs. {opponentName}</div>
            </button>

            <button
              onClick={() => onViewChange('Waivers')}
              className={`rounded-lg p-4 border transition-all text-left group ${isDarkMode ? 'bg-[#111] border-[#222] hover:bg-[#1a1a1a]/50' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 border ${isDarkMode ? 'bg-[#1a1a1a] border-[#222]' : 'bg-slate-100 border-slate-200'}`}>
                <Flame className="w-4 h-4 text-orange-400" aria-hidden="true" />
              </div>
              <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Hot Pickups</div>
              <div className={`text-xs mt-1 ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>{trending.length} trending players</div>
            </button>

            <button
              onClick={() => onViewChange('Team')}
              className={`rounded-lg p-4 border transition-all text-left group ${isDarkMode ? 'bg-[#111] border-[#222] hover:bg-[#1a1a1a]/50' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 border ${isDarkMode ? 'bg-[#1a1a1a] border-[#222]' : 'bg-slate-100 border-slate-200'}`}>
                <Clock className={`w-4 h-4 ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`} aria-hidden="true" />
              </div>
              <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Set Lineup</div>
              <div className={`text-xs mt-1 ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>{firstGameLabel}</div>
            </button>
          </div>

          {/* Important Updates - News from API */}
          <div className={`rounded-lg border ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
            <div className={`p-4 border-b ${isDarkMode ? 'border-[#222]' : 'border-slate-200'}`}>
              <h2 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Important Updates</h2>
            </div>
            <div className={`divide-y ${isDarkMode ? 'divide-slate-700/50' : 'divide-slate-100'}`}>
              {newsLoading ? (
                <div className="p-8 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" aria-label="Loading news" />
                </div>
              ) : newsError ? (
                <div className="p-8 text-center">
                  <p className={`text-sm ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                    Failed to load news
                  </p>
                </div>
              ) : myTeamNews.length === 0 ? (
                <div className="p-8 text-center">
                  <p className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
                    {roster.length > 0 ? 'No news for your players' : 'Join a league to see news for your team'}
                  </p>
                </div>
              ) : (
                <>
                  {myTeamNews.slice(0, 3).map((item) => {
                    const impact = getImpactColor(item.impactLevel);
                    const dotColor = getDotColor(item.impactLevel);

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
                        className={`p-4 transition-colors ${item.player ? 'cursor-pointer' : ''} ${isDarkMode ? 'hover:bg-[#1a1a1a]/50' : 'hover:bg-slate-50'}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full ${dotColor} mt-2 flex-shrink-0`}></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`text-xs font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                                {item.source || 'News'}
                              </span>
                              <span className={`px-2 py-0.5 ${impact.bg} ${impact.text} text-xs rounded font-medium`}>
                                {impact.label}
                              </span>
                              <span className={`text-xs ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>
                                {timeAgo(item.publishedAt)}
                              </span>
                            </div>
                            <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                              <NewsSnippet item={item} />
                            </p>
                            {item.player && (
                              <span className={`text-xs mt-2 block ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>
                                {item.player.name} · {item.player.position} · {item.player.team}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                </>
              )}
            </div>
          </div>

          {/* This Week's Matchup Preview */}
          <div className={`rounded-lg border ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
            <div className={`p-4 border-b ${isDarkMode ? 'border-[#222]' : 'border-slate-200'}`}>
              <h2 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Week {league?.currentWeek || 1} Matchup
              </h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <div className={`text-3xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {starterProjection > 0 ? starterProjection.toFixed(1) : '—'}
                  </div>
                  <div className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
                    You
                  </div>
                  <div className="text-xs text-green-500 mt-1">Projected</div>
                </div>
                <div className="px-6">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-slate-100'}`}>
                    <span className={`text-sm font-bold ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>VS</span>
                  </div>
                </div>
                <div className="text-center flex-1">
                  <div className={`text-3xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {opponentProjection != null ? opponentProjection.toFixed(1) : '—'}
                  </div>
                  <div className={`text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>{opponentName}</div>
                  <div className={`text-xs mt-1 ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>Projected</div>
                </div>
              </div>
              <button
                onClick={() => onViewChange('Matchup')}
                className={`w-full mt-6 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${isDarkMode ? 'bg-[#1a1a1a] hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'}`}
              >
                View Full Matchup
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Injury Alerts — your roster only */}
          <div className={`rounded-lg border p-4 ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-red-500" aria-hidden="true" />
              <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Injury Alerts</h3>
            </div>
            <div className="space-y-3">
              {roster.length === 0 ? (
                <p className={`text-sm text-center py-2 ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
                  Sync a league to see alerts
                </p>
              ) : injuredRosterPlayers.length === 0 ? (
                <p className={`text-sm text-center py-2 ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
                  No injuries on your roster
                </p>
              ) : (
                injuredRosterPlayers.map((player) => {
                  const badge = getStatusBadge(player.status);
                  return (
                    <div
                      key={player.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onPlayerClick(convertToPlayer(player))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onPlayerClick(convertToPlayer(player));
                        }
                      }}
                      className={`rounded-lg p-3 cursor-pointer transition-colors border ${badge.cardBg}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {player.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-white text-xs rounded font-bold ${badge.bg}`}
                          aria-label={STATUS_LABELS[badge.label] || badge.label}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div className={`text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
                        {player.position} · {player.team}
                        {player.injuryBodyPart ? ` · ${player.injuryBodyPart}` : ''}
                        {player.injuryNote ? ` — ${player.injuryNote}` : ''}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Top Waiver Pickups */}
          <div className={`rounded-lg border p-4 ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-green-500" aria-hidden="true" />
              <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Top Waiver Pickups</h3>
            </div>
            <div className="space-y-3">
              {trendingLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" aria-label="Loading trending players" />
                </div>
              ) : trendingError ? (
                <p className={`text-sm text-center py-2 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                  Failed to load trending players
                </p>
              ) : topPickups.length === 0 ? (
                <p className={`text-sm text-center py-2 ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
                  No trending players
                </p>
              ) : (
                topPickups.map((player) => (
                  <div
                    key={player.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onPlayerClick(player)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onPlayerClick(player);
                      }
                    }}
                    className={`rounded-lg p-3 cursor-pointer transition-colors border ${isDarkMode ? 'bg-[#1a1a1a]/50 border-[#222]/50 hover:bg-[#1a1a1a]' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.name}</span>
                      <span className="text-xs text-green-500 font-semibold">+{player.weekChange}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`}>{player.team} • {player.position}</span>
                      <span className={`text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
                        {player.projectedPoints > 0 ? `${player.projectedPoints} pts proj.` : 'Trending'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => onViewChange('Waivers')}
              className="w-full mt-4 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition-colors"
            >
              View more players
            </button>
          </div>

          {/* Start/Sit Advice - will be driven by real projections in the future */}
        </div>
      </div>
    </div>
  );
}
