import { TrendingUp } from 'lucide-react';
import { getTrendingUpPlayers } from '../data/nflTeamsData';

interface BiggestMoversProps {
  currentWeek: number;
  isDarkMode: boolean;
}

export function BiggestMovers({ currentWeek, isDarkMode }: BiggestMoversProps) {
  // Get top 3 trending up players from the data
  const trendingPlayers = getTrendingUpPlayers(3);
  
  const movers = trendingPlayers.map(player => ({
    name: player.name,
    team: player.team,
    oldProjection: player.projectedPoints - player.weekChange,
    newProjection: player.projectedPoints,
    change: player.weekChange,
  }));
  return (
    <div className={`rounded-xl border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
      <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Biggest Movers (Week {currentWeek})</h3>
      <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        Largest week-over-week jumps in FilmRoom projections.
      </p>

      <div className="space-y-4">
        {movers.map((mover, index) => (
          <div
            key={index}
            className={`flex items-center justify-between p-4 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
          >
            <div className="flex-1">
              <div className={`text-sm mb-1 font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{mover.name}</div>
              <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{mover.team}</div>
              <div className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {mover.oldProjection} → {mover.newProjection} PPR
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 text-green-500">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">+{mover.change}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}