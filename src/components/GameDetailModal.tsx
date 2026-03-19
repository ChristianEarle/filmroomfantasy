import { useEffect } from 'react';
import { X, ArrowLeft, Cloud, Loader2 } from 'lucide-react';
import { Player } from '../App';
import { useGame } from '../hooks';

interface Game {
  id: string;
  awayTeam: string;
  awayTeamLogo: string;
  homeTeam: string;
  homeTeamLogo: string;
  gameTime: string;
  spread: string;
  favoredTeam: 'home' | 'away';
  overUnder: number;
  tvNetwork: string;
  weather?: { displayValue: string; temperature?: number } | null;
}

interface GameDetailModalProps {
  game: Game;
  onClose: () => void;
  onPlayerClick: (player: Player) => void;
  isDarkMode: boolean;
}

// Map API player to App Player format
function toAppPlayer(p: { id: string; name: string; team: string; position: string; projectedPoints?: number; weekRank?: number; headshotUrl?: string | null }): Player {
  return {
    id: p.id,
    rank: p.weekRank ?? 0,
    name: p.name,
    team: p.team,
    position: (p.position || 'WR') as Player['position'],
    keyLine: '',
    projectedPoints: p.projectedPoints ?? 0,
    weekChange: 0,
    headshotUrl: p.headshotUrl ?? null,
  };
}


export function GameDetailModal({ game, onClose, onPlayerClick, isDarkMode }: GameDetailModalProps) {
  const { game: apiGame, homePlayers: apiHome, awayPlayers: apiAway, isLoading, error } = useGame(game.id);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Use API players (real data from DB)
  const awayPlayers: Player[] = apiAway.map(toAppPlayer);
  const homePlayers: Player[] = apiHome.map(toAppPlayer);

  // Group players by position
  const groupByPosition = (players: Player[]) => {
    const grouped: Record<string, Player[]> = {
      QB: [],
      RB: [],
      WR: [],
      TE: [],
      K: [],
      DEF: [],
    };
    
    players.forEach(player => {
      if (grouped[player.position]) {
        grouped[player.position].push(player);
      }
    });
    
    return grouped;
  };

  const awayPlayersByPosition = groupByPosition(awayPlayers);
  const homePlayersByPosition = groupByPosition(homePlayers);

  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

  return (
    <div
      className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${isDarkMode ? 'bg-[#0a0a0a]/80' : 'bg-black/20'}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`${game.awayTeam} at ${game.homeTeam} game details`}
    >
      <div className={`rounded-2xl border shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
        {/* Header */}
        <div className={`border-b p-6 flex-shrink-0 ${isDarkMode ? 'bg-gradient-to-r from-slate-800 to-slate-900 border-[#222]' : 'bg-gradient-to-r from-slate-50 to-white border-slate-200'}`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={onClose}
                  aria-label="Back to game slate"
                  className={`flex items-center gap-2 transition-colors ${isDarkMode ? 'text-[#737373] hover:text-white' : 'text-[#555] hover:text-slate-900'}`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm">Back to Slate</span>
                </button>
              </div>
              <div className={`text-sm mb-1 ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>{game.gameTime} • {game.tvNetwork}</div>
              <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{game.awayTeam} @ {game.homeTeam}</h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close game details"
              className={`transition-colors ${isDarkMode ? 'text-[#737373] hover:text-white' : 'text-[#555] hover:text-slate-900'}`}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* Game Info */}
          <div className="flex items-center gap-6 text-sm flex-wrap">
            <div className={`rounded-lg px-4 py-2 border ${isDarkMode ? 'bg-[#1a1a1a] border-[#222]' : 'bg-slate-100 border-slate-300'}`}>
              <span className={isDarkMode ? 'text-[#737373]' : 'text-[#555]'}>Spread:</span>{' '}
              <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {game.favoredTeam === 'home' ? game.homeTeamLogo : game.awayTeamLogo} -{game.spread}
              </span>
            </div>
            <div className={`rounded-lg px-4 py-2 border ${isDarkMode ? 'bg-[#1a1a1a] border-[#222]' : 'bg-slate-100 border-slate-300'}`}>
              <span className={isDarkMode ? 'text-[#737373]' : 'text-[#555]'}>Over/Under:</span>{' '}
              <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{game.overUnder || '—'}</span>
            </div>
            {game.weather && (
              <div className={`rounded-lg px-4 py-2 border flex items-center gap-2 ${isDarkMode ? 'bg-sky-900/30 border-sky-800/50' : 'bg-sky-50 border-sky-200'}`}>
                <Cloud className={`w-4 h-4 ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`} />
                <span className={isDarkMode ? 'text-sky-200' : 'text-sky-800'}>
                  {game.weather.displayValue}
                  {game.weather.temperature != null && ` • ${game.weather.temperature}°F`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-y-auto p-6 relative ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-slate-100'}`}>
          {isLoading && (
            <div className={`absolute inset-0 flex items-center justify-center z-10 ${isDarkMode ? 'bg-[#0a0a0a]/80' : 'bg-slate-100/80'}`}>
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          )}
          {!isLoading && awayPlayers.length === 0 && homePlayers.length === 0 && (
            <div className={`text-center py-12 ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
              <p className="text-lg font-medium mb-2">No player data available</p>
              <p className="text-sm">Player projections and stats will appear here during the NFL season.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-6">
            {/* Away Team */}
            <div>
              <div className={`rounded-lg p-4 mb-4 border shadow-sm ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-300'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${isDarkMode ? 'bg-[#1a1a1a] border-[#222]' : 'bg-slate-100 border-slate-300'}`}>
                      <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{game.awayTeamLogo}</span>
                    </div>
                    <div>
                      <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{game.awayTeam}</div>
                      <div className={`text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Away Team</div>
                    </div>
                  </div>
                  {game.favoredTeam === 'away' && (
                    <div className="text-right">
                      <div className="text-sm font-bold text-green-500">-{game.spread}</div>
                      <div className={`text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Favored</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {positions.map(position => (
                  <div key={position}>
                    <div className={`text-sm font-bold mb-2 mt-4 first:mt-0 px-1 ${isDarkMode ? 'text-[#555]' : 'text-slate-600'}`}>{position}</div>
                    <div className="space-y-2">
                      {awayPlayersByPosition[position].map((player) => (
                        <div
                          key={player.id}
                          onClick={() => onPlayerClick(player)}
                          className={`rounded-lg p-4 border transition-all cursor-pointer group ${isDarkMode ? 'bg-[#111] border-[#222] hover:border-blue-600 hover:shadow-lg hover:shadow-blue-900/10' : 'bg-white border-slate-300 hover:border-blue-500 hover:shadow-md hover:bg-slate-50'}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className={`font-bold transition-colors ${isDarkMode ? 'text-slate-200 group-hover:text-white' : 'text-slate-900 group-hover:text-slate-800'}`}>{player.name}</div>
                              <div className={`text-xs mt-0.5 ${isDarkMode ? 'text-[#555]' : 'text-slate-600'}`}>
                                {player.position}{player.rank > 0 ? ` • #${player.rank}` : ''}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-blue-600">{player.projectedPoints}</div>
                              <div className={`text-xs ${isDarkMode ? 'text-[#555]' : 'text-slate-600'}`}>pts</div>
                            </div>
                          </div>
                          {player.projectedPoints > 0 && (
                            <div className={`text-xs mt-1 ${isDarkMode ? 'text-[#555]' : 'text-slate-600'}`}>
                              {player.position} pts
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Home Team */}
            <div>
              <div className={`rounded-lg p-4 mb-4 border shadow-sm ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-300'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${isDarkMode ? 'bg-[#1a1a1a] border-[#222]' : 'bg-slate-100 border-slate-300'}`}>
                      <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{game.homeTeamLogo}</span>
                    </div>
                    <div>
                      <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{game.homeTeam}</div>
                      <div className={`text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Home Team</div>
                    </div>
                  </div>
                  {game.favoredTeam === 'home' && (
                    <div className="text-right">
                      <div className="text-sm font-bold text-green-500">-{game.spread}</div>
                      <div className={`text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>Favored</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {positions.map(position => (
                  <div key={position}>
                    <div className={`text-sm font-bold mb-2 mt-4 first:mt-0 px-1 ${isDarkMode ? 'text-[#555]' : 'text-slate-600'}`}>{position}</div>
                    <div className="space-y-2">
                      {homePlayersByPosition[position].map((player) => (
                        <div
                          key={player.id}
                          onClick={() => onPlayerClick(player)}
                          className={`rounded-lg p-4 border transition-all cursor-pointer group ${isDarkMode ? 'bg-[#111] border-[#222] hover:border-blue-600 hover:shadow-lg hover:shadow-blue-900/10' : 'bg-white border-slate-300 hover:border-blue-500 hover:shadow-md hover:bg-slate-50'}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className={`font-bold transition-colors ${isDarkMode ? 'text-slate-200 group-hover:text-white' : 'text-slate-900 group-hover:text-slate-800'}`}>{player.name}</div>
                              <div className={`text-xs mt-0.5 ${isDarkMode ? 'text-[#555]' : 'text-slate-600'}`}>
                                {player.position}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-blue-600">{player.projectedPoints}</div>
                              <div className={`text-xs ${isDarkMode ? 'text-[#555]' : 'text-slate-600'}`}>pts</div>
                            </div>
                          </div>
                          {player.projectedPoints > 0 && (
                            <div className={`text-xs mt-1 ${isDarkMode ? 'text-[#555]' : 'text-slate-600'}`}>
                              {player.position} pts
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}