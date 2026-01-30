import { TrendingUp, Trophy, Flame, Clock, ChevronRight, AlertCircle } from 'lucide-react';
import { Player } from '../App';
import { Game, weekGames } from './GameSlateView';
import { nflPlayersData, getTrendingUpPlayers } from '../data/nflTeamsData';

interface HomeViewProps {
  onPlayerClick: (player: Player) => void;
  onViewChange: (view: 'Board' | 'Team' | 'Matchup' | 'Waivers' | 'Home' | 'GameSlate') => void;
  onGameSelect: (game: Game) => void;
  isDarkMode: boolean;
}

// Get players from the real data
const getPlayerByName = (name: string): Player | undefined =>
  nflPlayersData.find(p => p.name === name);

// Top waiver pickups - players with good projections trending up
const topPickups: Player[] = getTrendingUpPlayers(3).map((player, index) => ({
  ...player,
  id: `w${index + 1}`,
  rank: index + 1,
}));

// Players mentioned in news - get specific high-profile players
const newsPlayers: Player[] = [
  getPlayerByName('Christian McCaffrey') || nflPlayersData.find(p => p.team === 'SF' && p.position === 'RB')!,
  getPlayerByName('Tyreek Hill') || nflPlayersData.find(p => p.team === 'MIA' && p.position === 'WR')!,
].filter(Boolean);

// Injury watch - high-profile players (simulate questionable status)
const injuredPlayers: Player[] = [
  getPlayerByName('Travis Kelce') || nflPlayersData.find(p => p.team === 'KC' && p.position === 'TE')!,
  getPlayerByName('Justin Jefferson') || nflPlayersData.find(p => p.team === 'MIN' && p.position === 'WR')!,
].filter(Boolean);

export function HomeView({ onPlayerClick, onViewChange, onGameSelect, isDarkMode }: HomeViewProps) {
  // Find the Bills vs Chiefs game (Game 1) for the weather alert
  const weatherGame = weekGames.find(g => g.id === '1');

  // Team stats
  const yourProjection = 126.4;

  return (
    <div className="space-y-6">
      {/* Hero Section - Simplified */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-6 relative">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Welcome back to FilmRoom</h1>
            <p className="text-blue-100">
              Your team is projected to score <span className="font-bold text-white">{yourProjection} points</span> this week
            </p>
          </div>

          {/* Record Badge */}
          <div className="bg-slate-900/80 rounded-lg px-4 py-2 text-center">
            <div className="text-2xl font-bold text-white">3-1</div>
            <div className="text-xs text-slate-400">2nd place</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions - 3 Cards */}
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => onViewChange('Matchup')}
              className={`rounded-xl p-4 border transition-all text-left group ${isDarkMode ? 'bg-slate-900 border-slate-700 hover:bg-slate-800/50' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                <Trophy className="w-4 h-4 text-blue-400" />
              </div>
              <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>View Matchup</div>
              <div className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>vs. The Gronk Squad</div>
            </button>

            <button
              onClick={() => onViewChange('Waivers')}
              className={`rounded-xl p-4 border transition-all text-left group ${isDarkMode ? 'bg-slate-900 border-slate-700 hover:bg-slate-800/50' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                <Flame className="w-4 h-4 text-orange-400" />
              </div>
              <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Hot Pickups</div>
              <div className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>12 trending players</div>
            </button>

            <button
              onClick={() => onViewChange('Team')}
              className={`rounded-xl p-4 border transition-all text-left group ${isDarkMode ? 'bg-slate-900 border-slate-700 hover:bg-slate-800/50' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                <Clock className={`w-4 h-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
              </div>
              <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Set Lineup</div>
              <div className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Locks Thu 8:15 PM</div>
            </button>
          </div>

          {/* Important Updates */}
          <div className={`rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className={`p-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <h2 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Important Updates</h2>
            </div>
            <div className={`divide-y ${isDarkMode ? 'divide-slate-700/50' : 'divide-slate-100'}`}>
              {/* McCaffrey Injury */}
              <div
                onClick={() => onPlayerClick(newsPlayers[0])}
                className={`p-4 transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Christian McCaffrey ruled OUT for Week 5</span>
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded font-medium">Injury</span>
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Jordan Mason expected to start. Pick him up immediately if available.
                    </p>
                    <span className={`text-xs mt-2 block ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>2 hours ago</span>
                  </div>
                </div>
              </div>

              {/* Tyreek Hill Analysis */}
              <div
                onClick={() => onPlayerClick(newsPlayers[1])}
                className={`p-4 transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Tyreek Hill trending up for Week 5</span>
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded font-medium">Analysis</span>
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Miami faces a weak secondary. Hill projected for 22+ points in PPR formats.
                    </p>
                    <span className="text-xs text-slate-500 mt-2 block">4 hours ago</span>
                  </div>
                </div>
              </div>

              {/* Trade Deadline */}
              <div className={`p-4 transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Trade deadline approaching</span>
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-xs rounded font-medium">League</span>
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Make your moves before Friday at 11:59 PM. 3 pending trade offers.
                    </p>
                    <span className={`text-xs mt-2 block ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>6 hours ago</span>
                  </div>
                </div>
              </div>

              {/* Weather Alert */}
              <div
                onClick={() => weatherGame && onGameSelect(weatherGame)}
                className={`p-4 transition-colors ${weatherGame ? (isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50') + ' cursor-pointer' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2 flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Weather alert: Bills vs. Chiefs</span>
                      <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded font-medium">Weather</span>
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Heavy snow expected. Consider sitting WR/TE, start RBs.
                    </p>
                    <span className={`text-xs mt-2 block ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>8 hours ago</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* This Week's Matchup Preview */}
          <div className={`rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className={`p-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <h2 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>This Week's Matchup</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <div className={`text-3xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>126.4</div>
                  <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Your Team</div>
                  <div className="text-xs text-green-500 mt-1">Projected</div>
                </div>
                <div className="px-6">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>VS</span>
                  </div>
                </div>
                <div className="text-center flex-1">
                  <div className={`text-3xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>118.2</div>
                  <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>The Gronk Squad</div>
                  <div className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Projected</div>
                </div>
              </div>
              <button
                onClick={() => onViewChange('Matchup')}
                className={`w-full mt-6 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'}`}
              >
                View Full Matchup
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Injury Alerts */}
          <div className={`rounded-xl border p-4 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Injury Alerts</h3>
            </div>
            <div className="space-y-3">
              <div
                onClick={() => onPlayerClick(injuredPlayers[0])}
                className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 cursor-pointer hover:bg-red-500/20 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{injuredPlayers[0]?.name}</span>
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded font-bold">Q</span>
                </div>
                <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Ankle injury • Game-time decision</div>
              </div>

              <div
                onClick={() => onPlayerClick(injuredPlayers[1])}
                className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 cursor-pointer hover:bg-yellow-500/20 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{injuredPlayers[1]?.name}</span>
                  <span className="px-2 py-0.5 bg-purple-500 text-white text-xs rounded font-bold">P</span>
                </div>
                <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Limited in practice</div>
              </div>
            </div>
          </div>

          {/* Top Waiver Pickups */}
          <div className={`rounded-xl border p-4 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Top Waiver Pickups</h3>
            </div>
            <div className="space-y-3">
              {topPickups.map((player) => (
                <div
                  key={player.id}
                  onClick={() => onPlayerClick(player)}
                  className={`rounded-lg p-3 cursor-pointer transition-colors border ${isDarkMode ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.name}</span>
                    <span className="text-xs text-green-500 font-semibold">+{player.weekChange}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{player.team} • {player.position}</span>
                    <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{player.projectedPoints} pts proj.</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => onViewChange('Waivers')}
              className="w-full mt-4 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition-colors"
            >
              View All Available Players
            </button>
          </div>

          {/* Start/Sit Advice */}
          <div className={`rounded-xl border p-4 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <h3 className={`font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Start/Sit Advice</h3>
            <div className="space-y-3">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-500 font-semibold">START</span>
                </div>
                <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Nico Collins</div>
                <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>HOU • WR • Great matchup</div>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />
                  <span className="text-xs text-red-500 font-semibold">SIT</span>
                </div>
                <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>DK Metcalf</div>
                <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>SEA • WR • Tough matchup</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
