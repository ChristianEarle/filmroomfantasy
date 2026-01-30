import { ChevronDown, User } from 'lucide-react';
import { Player } from '../App';
import { useState, useMemo } from 'react';
import { nflPlayersData } from '../data/nflTeamsData';

interface WaiversViewProps {
  onPlayerClick: (player: Player) => void;
  isDarkMode: boolean;
}

// Get waiver wire players - mid-tier players with decent projections (simulating available players)
const getWaiverPlayers = (): Player[] => {
  // Filter players with ranks between 30-120 (mid-tier available players)
  // Sort by highest projection first
  const availablePlayers = nflPlayersData
    .filter(p => p.rank >= 15 && p.rank <= 100)
    .sort((a, b) => b.projectedPoints - a.projectedPoints)
    .slice(0, 20)
    .map((player, index) => ({
      ...player,
      id: `w${index + 1}`,
      rank: index + 1,
    }));
  
  return availablePlayers;
};

const waiverPlayers: Player[] = getWaiverPlayers();

export function WaiversView({ onPlayerClick, isDarkMode }: WaiversViewProps) {
  const [selectedScoring, setSelectedScoring] = useState<'PPR' | 'Half PPR' | 'Standard'>('PPR');
  const [selectedPosition, setSelectedPosition] = useState<string>('ALL');
  
  const scoringOptions: Array<'PPR' | 'Half PPR' | 'Standard'> = ['PPR', 'Half PPR', 'Standard'];
  const positions = ['ALL', 'WR', 'RB', 'QB', 'TE', 'K', 'DEF'];

  const filteredPlayers = waiverPlayers.filter((player) => {
    if (selectedPosition === 'ALL') return true;
    return player.position === selectedPosition;
  }).slice(0, 12);

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Content - 2/3 width */}
        <div className="xl:col-span-2">
          <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            {/* Header */}
            <div className={`p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <h2 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Waiver Wire (Week 5)</h2>
              <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Top available players based on FilmRoom projections • Updated every 2 minutes
              </p>

              {/* Filters */}
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                {/* Scoring Type */}
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Score:</span>
                  {scoringOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => setSelectedScoring(option)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        selectedScoring === option
                          ? 'bg-blue-600 text-white'
                          : isDarkMode 
                            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                <div className={`w-px h-6 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>

                {/* Position Filter */}
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Position:</span>
                  {positions.map((position) => (
                    <button
                      key={position}
                      onClick={() => setSelectedPosition(position)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        selectedPosition === position
                          ? 'bg-blue-600 text-white'
                          : isDarkMode 
                            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {position}
                    </button>
                  ))}
                </div>

                <div className={`w-px h-6 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>

                {/* Week Selector */}
                <button className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  <span className="text-sm">Week 5</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <th className={`px-6 py-4 text-xs font-medium w-16 text-center ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>#</th>
                    <th className={`px-4 py-4 text-xs font-medium w-1/3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Player</th>
                    <th className={`px-4 py-4 text-xs font-medium w-24 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Pos</th>
                    <th className={`px-4 py-4 text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Key Line</th>
                    <th className={`px-6 py-4 text-xs font-medium text-right ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Proj (PPR)</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                  {filteredPlayers.map((player) => (
                    <tr
                      key={player.id}
                      onClick={() => onPlayerClick(player)}
                      className={`group cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}
                    >
                      <td className={`px-6 py-4 text-sm text-center font-mono ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{player.rank}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center border shrink-0 transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 group-hover:border-slate-600' : 'bg-slate-100 border-slate-200 group-hover:border-slate-300'}`}>
                            <User className={`w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                          </div>
                          <div>
                            <div className={`font-bold text-base group-hover:text-blue-500 transition-colors ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.name}</div>
                            <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{player.team}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {player.position}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{player.keyLine}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.projectedPoints.toFixed(1)}</div>
                        <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>pts</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-xs mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Showing top available players based on projected points.
              </p>
              <button className="text-sm text-blue-500 hover:text-blue-400 font-semibold">
                View all available players →
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Waiver Priority */}
          <div className={`rounded-xl border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Waiver Priority</h3>
            <div className="space-y-3">
              <div className={`rounded-lg p-4 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Your Priority</div>
                <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>3rd</div>
                <div className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Resets weekly</div>
              </div>
            </div>
          </div>

          {/* Trending Adds */}
          <div className={`rounded-xl p-6 border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <h3 className="font-bold mb-4">Trending Adds</h3>
            <div className="space-y-3">
              {waiverPlayers.slice(0, 3).map((player, index) => (
                <div key={player.id} className={`rounded-lg p-3 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-sm mb-1 font-semibold">{player.name}</div>
                  <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{player.team} • {player.position}</div>
                  <div className="text-xs text-green-500 mt-1">+{Math.round(45 - index * 7)}% rostered this week</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}