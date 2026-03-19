import { Player } from '../App';
import { X, TrendingUp, Target, Activity } from 'lucide-react';
import { PlayerAvatar } from './PlayerAvatar';

// Extended stats shape that may be available on player objects from the stats API
interface PlayerDetailStats {
  points?: number;
  gamesPlayed?: number;
  passingYards?: number;
  passingTDs?: number;
  rushingYards?: number;
  rushingTDs?: number;
  receivingYards?: number;
  receptions?: number;
  receivingTDs?: number;
  fieldGoals?: number;
  fieldGoalAttempts?: number;
}

// Player with optional stats and fields that may be passed from various contexts
interface PlayerWithStats extends Player {
  stats?: PlayerDetailStats;
  status?: string;
  imageUrl?: string;
}

interface PlayerStatsProps {
  player: PlayerWithStats;
  onClose: () => void;
}

export function PlayerStats({ player, onClose }: PlayerStatsProps) {
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

  // Guard against missing stats — the base Player interface doesn't include stats
  const stats: PlayerDetailStats | undefined = player.stats;

  const renderStats = () => {
    if (!stats) return [];
    const statItems = [];

    if (stats.passingYards !== undefined) {
      statItems.push({ label: 'Passing Yards', value: stats.passingYards, icon: Target });
      statItems.push({ label: 'Passing TDs', value: stats.passingTDs, icon: TrendingUp });
    }

    if (stats.rushingYards !== undefined) {
      statItems.push({ label: 'Rushing Yards', value: stats.rushingYards, icon: Activity });
      statItems.push({ label: 'Rushing TDs', value: stats.rushingTDs, icon: TrendingUp });
    }

    if (stats.receivingYards !== undefined) {
      statItems.push({ label: 'Receiving Yards', value: stats.receivingYards, icon: Target });
      statItems.push({ label: 'Receptions', value: stats.receptions, icon: Activity });
      statItems.push({ label: 'Receiving TDs', value: stats.receivingTDs, icon: TrendingUp });
    }

    if (stats.fieldGoals !== undefined) {
      statItems.push({ label: 'Field Goals', value: `${stats.fieldGoals}/${stats.fieldGoalAttempts}`, icon: Target });
    }

    return statItems;
  };

  const statItems = renderStats();

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-gradient-to-br from-slate-900 to-purple-900 border border-purple-500/30 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 border-b border-purple-500/30">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-purple-300" />
          </button>
          
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-purple-400/50 flex-shrink-0 bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <PlayerAvatar
                name={player.name}
                headshotUrl={player.headshotUrl}
                imageUrl={player.imageUrl}
                className="w-full h-full object-cover"
                fallbackClassName="text-2xl font-bold"
                fallbackColorClass="text-purple-300"
                isDarkMode={true}
              />
            </div>
            
            <div className="flex-1">
              <h2 className="text-white mb-2">{player.name}</h2>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className={`px-3 py-1 ${getPositionColor(player.position)} text-white rounded`}>
                  {player.position}
                </span>
                <span className="text-purple-300">{player.team}</span>
                {player.status && (
                  <span className={`px-3 py-1 rounded ${
                    player.status === 'healthy' ? 'bg-green-500/20 text-green-400' :
                    player.status === 'injured' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {player.status.charAt(0).toUpperCase() + player.status.slice(1)}
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <div className="text-4xl text-purple-400">{stats?.points ?? player.projectedPoints ?? '-'}</div>
              <div className="text-sm text-purple-300">Total Points</div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="p-6">
          <h3 className="text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            Season Statistics
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {stats?.gamesPlayed != null && (
              <div className="bg-black/40 backdrop-blur-sm border border-purple-500/20 rounded-lg p-4">
                <div className="text-purple-300 text-sm mb-1">Games Played</div>
                <div className="text-2xl text-white">{stats.gamesPlayed}</div>
              </div>
            )}

            {stats?.points != null && stats?.gamesPlayed != null && stats.gamesPlayed > 0 && (
              <div className="bg-black/40 backdrop-blur-sm border border-purple-500/20 rounded-lg p-4">
                <div className="text-purple-300 text-sm mb-1">Points Per Game</div>
                <div className="text-2xl text-white">
                  {(stats.points / stats.gamesPlayed).toFixed(1)}
                </div>
              </div>
            )}

            {statItems.map((stat, index) => (
              <div key={index} className="bg-black/40 backdrop-blur-sm border border-purple-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-purple-300 text-sm mb-1">
                  <stat.icon className="w-4 h-4" />
                  {stat.label}
                </div>
                <div className="text-2xl text-white">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
