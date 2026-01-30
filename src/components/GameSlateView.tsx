import { Calendar, TrendingUp } from 'lucide-react';
import { Player } from '../App';

export interface Game {
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
}

export const weekGames: Game[] = [
  {
    id: '1',
    awayTeam: 'Buffalo Bills',
    awayTeamLogo: 'BUF',
    homeTeam: 'Kansas City Chiefs',
    homeTeamLogo: 'KC',
    gameTime: 'Sun 1:00 PM ET',
    spread: '3.5',
    favoredTeam: 'home',
    overUnder: 52.5,
    tvNetwork: 'CBS',
  },
  {
    id: '2',
    awayTeam: 'San Francisco 49ers',
    awayTeamLogo: 'SF',
    homeTeam: 'Dallas Cowboys',
    homeTeamLogo: 'DAL',
    gameTime: 'Sun 4:25 PM ET',
    spread: '2.5',
    favoredTeam: 'away',
    overUnder: 48.5,
    tvNetwork: 'FOX',
  },
  {
    id: '3',
    awayTeam: 'Miami Dolphins',
    awayTeamLogo: 'MIA',
    homeTeam: 'New York Jets',
    homeTeamLogo: 'NYJ',
    gameTime: 'Sun 1:00 PM ET',
    spread: '6.5',
    favoredTeam: 'away',
    overUnder: 44.5,
    tvNetwork: 'CBS',
  },
  {
    id: '4',
    awayTeam: 'Philadelphia Eagles',
    awayTeamLogo: 'PHI',
    homeTeam: 'Washington Commanders',
    homeTeamLogo: 'WAS',
    gameTime: 'Sun 1:00 PM ET',
    spread: '4.5',
    favoredTeam: 'away',
    overUnder: 46.5,
    tvNetwork: 'FOX',
  },
  {
    id: '5',
    awayTeam: 'Green Bay Packers',
    awayTeamLogo: 'GB',
    homeTeam: 'Detroit Lions',
    homeTeamLogo: 'DET',
    gameTime: 'Sun 1:00 PM ET',
    spread: '7.5',
    favoredTeam: 'home',
    overUnder: 51.5,
    tvNetwork: 'FOX',
  },
  {
    id: '6',
    awayTeam: 'Baltimore Ravens',
    awayTeamLogo: 'BAL',
    homeTeam: 'Cincinnati Bengals',
    homeTeamLogo: 'CIN',
    gameTime: 'Sun 1:00 PM ET',
    spread: '1.5',
    favoredTeam: 'away',
    overUnder: 49.5,
    tvNetwork: 'CBS',
  },
  {
    id: '7',
    awayTeam: 'Los Angeles Rams',
    awayTeamLogo: 'LAR',
    homeTeam: 'Seattle Seahawks',
    homeTeamLogo: 'SEA',
    gameTime: 'Sun 4:05 PM ET',
    spread: '3.0',
    favoredTeam: 'home',
    overUnder: 47.5,
    tvNetwork: 'FOX',
  },
  {
    id: '8',
    awayTeam: 'Minnesota Vikings',
    awayTeamLogo: 'MIN',
    homeTeam: 'Chicago Bears',
    homeTeamLogo: 'CHI',
    gameTime: 'Sun 1:00 PM ET',
    spread: '5.5',
    favoredTeam: 'away',
    overUnder: 43.5,
    tvNetwork: 'FOX',
  },
  {
    id: '9',
    awayTeam: 'Tampa Bay Buccaneers',
    awayTeamLogo: 'TB',
    homeTeam: 'Atlanta Falcons',
    homeTeamLogo: 'ATL',
    gameTime: 'Sun 1:00 PM ET',
    spread: '2.5',
    favoredTeam: 'home',
    overUnder: 45.5,
    tvNetwork: 'FOX',
  },
  {
    id: '10',
    awayTeam: 'New Orleans Saints',
    awayTeamLogo: 'NO',
    homeTeam: 'Carolina Panthers',
    homeTeamLogo: 'CAR',
    gameTime: 'Sun 1:00 PM ET',
    spread: '6.0',
    favoredTeam: 'away',
    overUnder: 41.5,
    tvNetwork: 'FOX',
  },
  {
    id: '11',
    awayTeam: 'Cleveland Browns',
    awayTeamLogo: 'CLE',
    homeTeam: 'Pittsburgh Steelers',
    homeTeamLogo: 'PIT',
    gameTime: 'Sun 1:00 PM ET',
    spread: '4.5',
    favoredTeam: 'home',
    overUnder: 38.5,
    tvNetwork: 'CBS',
  },
  {
    id: '12',
    awayTeam: 'Las Vegas Raiders',
    awayTeamLogo: 'LV',
    homeTeam: 'Los Angeles Chargers',
    homeTeamLogo: 'LAC',
    gameTime: 'Sun 4:05 PM ET',
    spread: '7.0',
    favoredTeam: 'home',
    overUnder: 42.5,
    tvNetwork: 'CBS',
  },
  {
    id: '13',
    awayTeam: 'Jacksonville Jaguars',
    awayTeamLogo: 'JAX',
    homeTeam: 'Tennessee Titans',
    homeTeamLogo: 'TEN',
    gameTime: 'Sun 1:00 PM ET',
    spread: '3.5',
    favoredTeam: 'away',
    overUnder: 40.5,
    tvNetwork: 'CBS',
  },
  {
    id: '14',
    awayTeam: 'New England Patriots',
    awayTeamLogo: 'NE',
    homeTeam: 'New York Giants',
    homeTeamLogo: 'NYG',
    gameTime: 'Sun 1:00 PM ET',
    spread: '1.5',
    favoredTeam: 'home',
    overUnder: 37.5,
    tvNetwork: 'CBS',
  },
  {
    id: '15',
    awayTeam: 'Denver Broncos',
    awayTeamLogo: 'DEN',
    homeTeam: 'Houston Texans',
    homeTeamLogo: 'HOU',
    gameTime: 'Sun 8:20 PM ET',
    spread: '5.5',
    favoredTeam: 'home',
    overUnder: 44.5,
    tvNetwork: 'NBC',
  },
];

interface GameSlateViewProps {
  onSelectGame?: (game: Game | null) => void;
  isDarkMode?: boolean;
}

export function GameSlateView({ onSelectGame, isDarkMode = true }: GameSlateViewProps = {}) {
  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className={`border rounded-xl p-8 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Week 5 • December 15-17, 2025</span>
            </div>
            <h1 className={`text-3xl mb-2 font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>NFL Game Slate</h1>
            <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
              All Week 5 matchups with Vegas lines and spreads
            </p>
          </div>
          <div className={`rounded-lg px-6 py-4 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <div className={`text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Games</div>
            <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{weekGames.length}</div>
            <div className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>This Week</div>
          </div>
        </div>
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {weekGames.map((game) => (
          <div
            key={game.id}
            onClick={() => onSelectGame?.(game)}
            className={`rounded-xl border overflow-hidden hover:shadow-lg transition-all cursor-pointer hover:border-blue-500 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
          >
            {/* Game Header */}
            <div className={`px-6 py-3 border-b flex items-center justify-between ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <Calendar className={`w-4 h-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                <span className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{game.gameTime}</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded border ${isDarkMode ? 'text-slate-300 bg-slate-700 border-slate-600' : 'text-slate-600 bg-slate-100 border-slate-200'}`}>
                {game.tvNetwork}
              </span>
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
                    <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{game.awayTeam}</div>
                    <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Away</div>
                  </div>
                </div>
                {game.favoredTeam === 'away' && (
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-500">-{game.spread}</div>
                    <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Favored</div>
                  </div>
                )}
              </div>

              {/* Home Team */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                    <span className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{game.homeTeamLogo}</span>
                  </div>
                  <div>
                    <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{game.homeTeam}</div>
                    <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Home</div>
                  </div>
                </div>
                {game.favoredTeam === 'home' && (
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-500">-{game.spread}</div>
                    <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Favored</div>
                  </div>
                )}
              </div>

              {/* Betting Lines */}
              <div className={`rounded-lg p-4 mt-4 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className={`text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Spread</div>
                    <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {game.favoredTeam === 'home' ? game.homeTeamLogo : game.awayTeamLogo} -{game.spread}
                    </div>
                  </div>
                  <div>
                    <div className={`text-xs mb-1 flex items-center gap-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      <TrendingUp className="w-3 h-3" />
                      Over/Under
                    </div>
                    <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{game.overUnder}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info Footer */}
      <div className={`border rounded-xl p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>How to Use This Information</h3>
            <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              The spread indicates the favored team and by how many points. Over/Under represents the total combined points expected in the game. 
              Use these lines to identify high-scoring game environments for your fantasy players.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}