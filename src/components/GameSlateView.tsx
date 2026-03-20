import { useState, useMemo } from 'react';
import { Calendar, TrendingUp, Cloud, CloudRain, Sun, CloudSnow, Loader2, Warehouse, TreePine, Star, Trophy, CheckCircle } from 'lucide-react';
import { Player } from '../App';
import { useEspnScoreboard } from '../hooks';
import { useOdds } from '../hooks/useOdds';
import type { TopPerformer } from '../services/games';
import { AdUnit } from './AdUnit';

export interface Game {
  id: string;
  awayTeam: string;
  awayTeamLogo: string;
  homeTeam: string;
  homeTeamLogo: string;
  gameTime: string;
  gameTimeFormatted: string;
  spread: number | null;
  favoredTeam: 'home' | 'away';
  overUnder: number | null;
  tvNetwork: string;
  weather?: {
    displayValue: string;
    temperature?: number;
    highTemperature?: number;
  } | null;
  homeScore?: number;
  awayScore?: number;
  status?: string;
  topPerformers?: {
    home: TopPerformer | null;
    away: TopPerformer | null;
  };
}

interface GameSlateViewProps {
  onSelectGame?: (game: Game | null) => void;
  isDarkMode?: boolean;
}

/** Format an ISO date string in the user's local timezone */
function formatGameTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return isoString;
  }
}

function WeatherIcon({ condition, className }: { condition?: string; className?: string }) {
  const c = (condition ?? '').toLowerCase();
  if (c === 'indoor') return <Warehouse className={className} />;
  if (c === 'outdoor') return <TreePine className={className} />;
  if (c.includes('rain') || c.includes('drizzle') || c.includes('storm')) return <CloudRain className={className} />;
  if (c.includes('snow')) return <CloudSnow className={className} />;
  if (c.includes('sunny') || c.includes('clear')) return <Sun className={className} />;
  return <Cloud className={className} />;
}

function TopPerformerDisplay({ performer, isDarkMode }: { performer: TopPerformer; isDarkMode: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
        {performer.position}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          {performer.playerName}
        </div>
        <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {performer.statLine || '—'}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-bold text-emerald-500">{performer.fantasyPoints.toFixed(1)}</div>
        <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>PTS</div>
      </div>
    </div>
  );
}

/** Determine winner for final games */
function getWinner(game: Game): 'home' | 'away' | 'tie' | null {
  if (game.status !== 'final') return null;
  if (game.homeScore == null || game.awayScore == null) return null;
  if (game.homeScore > game.awayScore) return 'home';
  if (game.awayScore > game.homeScore) return 'away';
  return 'tie';
}

export function GameSlateView({ onSelectGame, isDarkMode = true }: GameSlateViewProps = {}) {
  const [selectedWeek, setSelectedWeek] = useState<number | undefined>(undefined);
  const { games: espnGames, week, weekLabel, isLoading, error, espnUnavailable } = useEspnScoreboard(selectedWeek);

  // Fetch odds data for the current week
  const currentWeek = week ?? 1;
  const season = 2025;
  const { odds, formatSpread, formatTotal } = useOdds(currentWeek, season);

  // Helper to find odds for a game by team abbreviation
  const getGameOdds = (teamAbbr: string) => {
    return odds.find(o => o.homeTeam === teamAbbr || o.awayTeam === teamAbbr);
  };

  const displayGames: Game[] = useMemo(() => espnGames.map((g) => ({
    id: g.id,
    awayTeam: g.awayTeam,
    awayTeamLogo: g.awayTeamLogo,
    homeTeam: g.homeTeam,
    homeTeamLogo: g.homeTeamLogo,
    gameTime: g.gameTime,
    gameTimeFormatted: formatGameTime(g.gameTime),
    spread: g.spread,
    favoredTeam: g.favoredTeam,
    overUnder: g.overUnder,
    tvNetwork: g.tvNetwork || 'TBD',
    weather: g.weather ?? undefined,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    status: g.status,
    topPerformers: g.topPerformers,
  })), [espnGames]);

  // Count how many games are final vs scheduled
  const allFinal = displayGames.length > 0 && displayGames.every(g => g.status === 'final');
  const allScheduled = displayGames.length > 0 && displayGames.every(g => g.status === 'scheduled');

  const handleGameClick = (game: Game, espnGame: (typeof espnGames)[0]) => {
    const fullGame: Game = { ...game, weather: espnGame.weather ?? undefined };
    onSelectGame?.(fullGame);
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className={`border rounded-lg p-8 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {week != null ? `${weekLabel || `Week ${week}`}` : 'NFL Schedule'}
              </span>
              <select
                value={selectedWeek ?? ''}
                onChange={(e) => setSelectedWeek(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                className={`ml-2 rounded px-2 py-1 text-sm border ${isDarkMode ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-white border-slate-300 text-slate-800'}`}
              >
                <option value="">Current week</option>
                {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>Week {w}</option>
                ))}
              </select>
            </div>
            <h1 className={`text-3xl mb-2 font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>NFL Game Slate</h1>
            <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
              {allFinal
                ? 'Final scores and top fantasy performers'
                : allScheduled
                  ? 'Matchups with Vegas lines, spreads & projected weather'
                  : 'Matchups with Vegas lines, spreads & projected weather'}
            </p>
          </div>
          <div className={`rounded-lg px-6 py-4 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <div className={`text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Games</div>
            <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {isLoading ? '—' : displayGames.length}
            </div>
            <div className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>This Week</div>
          </div>
        </div>
      </div>

      {espnUnavailable && !error && (
        <div className={`rounded-lg border p-4 ${isDarkMode ? 'bg-amber-900/20 border-amber-700 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          ESPN&apos;s schedule API is temporarily unavailable. Run <code className="px-1 py-0.5 rounded bg-black/10">npm run sync:games</code> in the server folder when ESPN is back to populate the database.
        </div>
      )}

      {error && (
        <div className={`rounded-lg border p-4 ${isDarkMode ? 'bg-red-900/20 border-red-700 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <div className="font-medium">{error.message}</div>
        </div>
      )}

      {isLoading ? (
        <div className={`flex items-center justify-center py-24 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          <Loader2 className="w-8 h-8 animate-spin mr-2" />
          Loading games…
        </div>
      ) : displayGames.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-24 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          <Calendar className="w-12 h-12 mb-4 opacity-40" />
          <p className="text-lg font-semibold mb-1">No games scheduled</p>
          <p className="text-sm opacity-70">There are no games listed for this week. Check back closer to game day.</p>
        </div>
      ) : (
        <div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {displayGames.map((game, idx) => {
          const winner = getWinner(game);
          const isFinal = game.status === 'final';
          const hasTopPerformers = game.topPerformers && (game.topPerformers.home || game.topPerformers.away);

          const gameElement = (
          <div
            key={game.id}
            onClick={() => handleGameClick(game, espnGames[idx])}
            className={`rounded-lg border overflow-hidden hover:shadow-lg transition-all cursor-pointer hover:border-blue-500 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
          >
            {/* Game Header */}
            <div className={`px-6 py-3 border-b flex items-center justify-between ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <Calendar className={`w-4 h-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                <span className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{game.gameTimeFormatted}</span>
              </div>
              <div className="flex items-center gap-2">
                {isFinal && (
                  <span className={`text-xs px-2 py-1 rounded font-semibold border ${isDarkMode ? 'bg-green-600/20 text-green-400 border-green-600/30' : 'bg-green-50 text-green-700 border-green-200'}`}>
                    Final
                  </span>
                )}
                {game.status === 'in_progress' && (
                  <span className={`text-xs px-2 py-1 rounded font-semibold border animate-pulse ${isDarkMode ? 'bg-red-600/20 text-red-400 border-red-600/30' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    LIVE
                  </span>
                )}
                <span className={`text-xs px-2 py-1 rounded border ${isDarkMode ? 'text-slate-300 bg-slate-700 border-slate-600' : 'text-slate-600 bg-slate-100 border-slate-200'}`}>
                  {game.tvNetwork}
                </span>
              </div>
            </div>

            {/* Teams */}
            <div className="p-6">
              {/* Away Team */}
              <div className={`flex items-center justify-between mb-4 pb-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                    <span className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{game.awayTeamLogo}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${winner === 'away' ? (isDarkMode ? 'text-white' : 'text-slate-900') : isFinal && winner !== 'tie' ? (isDarkMode ? 'text-slate-500' : 'text-slate-400') : (isDarkMode ? 'text-white' : 'text-slate-900')}`}>
                        {game.awayTeam}
                      </span>
                      {winner === 'away' && (
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Away</div>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  {(isFinal || game.status === 'in_progress') && game.awayScore != null && (
                    <div className={`text-2xl font-bold ${winner === 'away' || winner === 'tie' || game.status === 'in_progress' ? (isDarkMode ? 'text-white' : 'text-slate-900') : (isDarkMode ? 'text-slate-500' : 'text-slate-400')}`}>
                      {game.awayScore}
                    </div>
                  )}
                  {game.favoredTeam === 'away' && game.status === 'scheduled' && game.spread != null && (
                    <div>
                      <div className="text-sm font-bold text-green-500">-{game.spread}</div>
                      <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Favored</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Home Team */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                    <span className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{game.homeTeamLogo}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${winner === 'home' ? (isDarkMode ? 'text-white' : 'text-slate-900') : isFinal && winner !== 'tie' ? (isDarkMode ? 'text-slate-500' : 'text-slate-400') : (isDarkMode ? 'text-white' : 'text-slate-900')}`}>
                        {game.homeTeam}
                      </span>
                      {winner === 'home' && (
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Home</div>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  {(isFinal || game.status === 'in_progress') && game.homeScore != null && (
                    <div className={`text-2xl font-bold ${winner === 'home' || winner === 'tie' || game.status === 'in_progress' ? (isDarkMode ? 'text-white' : 'text-slate-900') : (isDarkMode ? 'text-slate-500' : 'text-slate-400')}`}>
                      {game.homeScore}
                    </div>
                  )}
                  {game.favoredTeam === 'home' && game.status === 'scheduled' && game.spread != null && (
                    <div>
                      <div className="text-sm font-bold text-green-500">-{game.spread}</div>
                      <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Favored</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Weather — only show for scheduled/in-progress games */}
              {!isFinal && game.weather && (
                <div className={`flex items-center gap-2 mt-3 px-3 py-2 rounded-lg ${isDarkMode ? 'bg-sky-900/30 border border-sky-800/50' : 'bg-sky-50 border border-sky-200'}`}>
                  <WeatherIcon condition={game.weather.displayValue} className={`w-4 h-4 ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`} />
                  <span className={`text-sm ${isDarkMode ? 'text-sky-200' : 'text-sky-800'}`}>
                    {game.weather.displayValue}
                    {game.weather.temperature != null && ` • ${game.weather.temperature}°F`}
                  </span>
                </div>
              )}

              {/* Bottom section: Top Performers / Spread+OU / Final Score Summary */}
              {isFinal && hasTopPerformers ? (
                /* Final game WITH top performers */
                <div className={`rounded-lg p-4 mt-4 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className={`text-xs font-semibold mb-3 uppercase tracking-wide flex items-center gap-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Star className="w-3 h-3" />
                    Top Performers
                  </div>
                  <div className="space-y-3">
                    {game.topPerformers!.away && (
                      <TopPerformerDisplay performer={game.topPerformers!.away} isDarkMode={isDarkMode} />
                    )}
                    {game.topPerformers!.home && game.topPerformers!.away && (
                      <div className={`border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`} />
                    )}
                    {game.topPerformers!.home && (
                      <TopPerformerDisplay performer={game.topPerformers!.home} isDarkMode={isDarkMode} />
                    )}
                  </div>
                </div>
              ) : isFinal ? (
                /* Final game WITHOUT top performers — show score summary with spread result */
                <div className={`rounded-lg p-4 mt-4 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className={`text-xs mb-1 flex items-center gap-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        <Trophy className="w-3 h-3" />
                        Final Score
                      </div>
                      <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {game.awayScore ?? 0} - {game.homeScore ?? 0}
                      </div>
                    </div>
                    {game.spread != null && (
                      <div>
                        <div className={`text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Closing Line</div>
                        <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {game.favoredTeam === 'home' ? game.homeTeamLogo : game.awayTeamLogo} -{game.spread}
                          {game.overUnder != null && (
                            <span className={`ml-2 font-normal ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              O/U {game.overUnder}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Scheduled/In-progress — show betting lines from odds API */
                <div className={`rounded-lg p-4 mt-4 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  {(() => {
                    const gameOdds = getGameOdds(game.homeTeam);
                    return (
                      <div className="space-y-3">
                        {/* Spread */}
                        <div>
                          <div className={`text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Spread</div>
                          <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {gameOdds && gameOdds.homeSpread != null
                              ? `${gameOdds.homeSpread < 0 ? game.homeTeamLogo : game.awayTeamLogo} ${Math.abs(gameOdds.homeSpread)}`
                              : '—'}
                          </div>
                        </div>

                        {/* Over/Under */}
                        <div>
                          <div className={`text-xs mb-1 flex items-center gap-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            <TrendingUp className="w-3 h-3" />
                            Over/Under
                          </div>
                          <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {gameOdds && gameOdds.total != null ? `O/U ${gameOdds.total}` : '—'}
                          </div>
                        </div>

                        {/* Moneyline */}
                        {gameOdds && gameOdds.homeMoneyline != null && gameOdds.awayMoneyline != null && (
                          <div>
                            <div className={`text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Moneyline</div>
                            <div className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                              {game.homeTeamLogo} {gameOdds.homeMoneyline > 0 ? '+' : ''}{gameOdds.homeMoneyline} / {game.awayTeamLogo} {gameOdds.awayMoneyline > 0 ? '+' : ''}{gameOdds.awayMoneyline}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
          );

          // Show ad after every 4th game
          const showAd = (idx + 1) % 4 === 0 && idx !== displayGames.length - 1;

          return (
            <div key={`game-${idx}`} className="contents">
              {gameElement}
              {showAd && (
                <div className="lg:col-span-2 my-4 rounded-lg overflow-hidden">
                  <div className={`text-[10px] text-slate-600 text-center mb-1`}>Ad</div>
                  <AdUnit slot="gameslate-inline" isDarkMode={isDarkMode} />
                </div>
              )}
            </div>
          );
        })}
        </div>
        </div>
      )}

      {/* Info Footer — contextual based on whether games are final or scheduled */}
      <div className={`border rounded-lg p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            {allFinal ? <Trophy className="w-4 h-4 text-white" /> : <TrendingUp className="w-4 h-4 text-white" />}
          </div>
          <div>
            <h3 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {allFinal ? 'Week Results' : 'How to Use This Information'}
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              {allFinal
                ? 'Top performers show the highest-scoring fantasy player from each team. Use this to spot breakout performances and evaluate player trends.'
                : 'The spread indicates the favored team and by how many points. Over/Under represents the total combined points expected in the game. Use these lines to identify high-scoring game environments for your fantasy players.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
