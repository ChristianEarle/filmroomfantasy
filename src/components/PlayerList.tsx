import { Player } from '../App';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { nflPlayersData } from '../data/nflTeamsData';

interface PlayerListProps {
  searchQuery: string;
  selectedPosition: string;
  onPlayerSelect: (player: Player) => void;
  selectedPlayer: Player | null;
}

export function PlayerList({ searchQuery, selectedPosition, onPlayerSelect, selectedPlayer }: PlayerListProps) {
  const filteredPlayers = nflPlayersData.filter((player) => {
    const matchesSearch = 
      player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      player.team.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPosition = 
      selectedPosition === 'ALL' || player.position === selectedPosition;
    
    return matchesSearch && matchesPosition;
  }).sort((a, b) => b.projectedPoints - a.projectedPoints);

  const getPositionColor = (position: string) => {
    const colors: Record<string, string> = {
      QB: 'bg-red-500',
      RB: 'bg-green-500',
      WR: 'bg-blue-500',
      TE: 'bg-purple-500',
      K: 'bg-amber-500',
      DEF: 'bg-indigo-500',
    };
    return colors[position] || 'bg-gray-500';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white">
          {filteredPlayers.length} Player{filteredPlayers.length !== 1 ? 's' : ''} Found
        </h2>
        <div className="flex items-center gap-2 text-purple-300 text-sm">
          <TrendingUp className="w-4 h-4" />
          <span>Sorted by Points</span>
        </div>
      </div>

      <div className="space-y-3">
        {filteredPlayers.map((player) => (
          <button
            key={player.id}
            onClick={() => onPlayerSelect(player)}
            className={`w-full text-left p-4 rounded-lg transition-all ${
              selectedPlayer?.id === player.id
                ? 'bg-purple-500/40 border-2 border-purple-400 scale-[1.02]'
                : 'bg-black/40 backdrop-blur-sm border border-purple-500/20 hover:bg-purple-500/20 hover:border-purple-400/50'
            }`}
          >
            <div className="flex items-center gap-4">
              {/* Player Avatar */}
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-purple-400/50 flex-shrink-0 bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <span className="text-white text-lg font-bold">
                  {player.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>

              {/* Player Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-white truncate">{player.name}</h3>
                  {player.weekChange > 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  ) : player.weekChange < 0 ? (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-sm text-purple-300">
                  <span className={`px-2 py-0.5 ${getPositionColor(player.position)} text-white rounded text-xs`}>
                    {player.position}
                  </span>
                  <span>{player.team}</span>
                  <span className="opacity-50">•</span>
                  <span className="text-xs">{player.keyLine}</span>
                </div>
              </div>

              {/* Points */}
              <div className="text-right">
                <div className="text-2xl text-purple-400">{player.projectedPoints.toFixed(1)}</div>
                <div className="text-xs text-purple-300">proj pts</div>
              </div>
            </div>
          </button>
        ))}

        {filteredPlayers.length === 0 && (
          <div className="text-center py-12 text-purple-300">
            <p>No players found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
