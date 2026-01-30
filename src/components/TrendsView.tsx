import { useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Clock, ArrowRight } from 'lucide-react';
import { Player } from '../App';
import { Game, weekGames } from './GameSlateView';
import { getTrendingUpPlayers, getTrendingDownPlayers } from '../data/nflTeamsData';

interface TrendsViewProps {
  onPlayerClick: (player: Player) => void;
  onGameSelect: (game: Game) => void;
  isDarkMode: boolean;
}

// Helper to get prop type based on position
const getPropType = (position: string): string => {
  switch (position) {
    case 'QB': return 'Passing Yards';
    case 'RB': return 'Rush + Rec Yards';
    case 'WR': return 'Receiving Yards';
    case 'TE': return 'Receiving Yards';
    case 'K': return 'Points Scored';
    case 'DEF': return 'Sacks';
    default: return 'Total Yards';
  }
};

// Helper to extract line value from keyLine
const extractLineValue = (keyLine: string): number => {
  const match = keyLine.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 50;
};

// Generate reason based on week change
const getMovementReason = (weekChange: number): string => {
  if (weekChange > 2) return 'Heavy over action (78% of bets)';
  if (weekChange > 1.5) return 'Sharp money on over';
  if (weekChange > 1) return 'Volume trending up';
  if (weekChange > 0.5) return 'Favorable matchup';
  if (weekChange < -1.5) return 'Injury concerns, practice limited';
  if (weekChange < -1) return 'Opponent defense upgrade';
  if (weekChange < -0.5) return 'Game script concerns';
  return 'Minor line adjustment';
};

// Build player prop movements from real data
const buildPlayerPropMovements = () => {
  const trendingUp = getTrendingUpPlayers(5);
  const trendingDown = getTrendingDownPlayers(3);
  
  const upMovements = trendingUp.map(player => {
    const lineValue = extractLineValue(player.keyLine);
    return {
      name: player.name,
      team: player.team,
      position: player.position,
      prop: getPropType(player.position),
      oldLine: lineValue - Math.abs(player.weekChange) * 2,
      newLine: lineValue,
      movement: Math.abs(player.weekChange) * 2,
      direction: 'up' as const,
      projection: player.projectedPoints,
      reason: getMovementReason(player.weekChange),
      time: `${Math.floor(Math.random() * 4) + 1}h ago`
    };
  });

  const downMovements = trendingDown.map(player => {
    const lineValue = extractLineValue(player.keyLine);
    return {
      name: player.name,
      team: player.team,
      position: player.position,
      prop: getPropType(player.position),
      oldLine: lineValue + Math.abs(player.weekChange) * 2,
      newLine: lineValue,
      movement: player.weekChange * 2,
      direction: 'down' as const,
      projection: player.projectedPoints,
      reason: getMovementReason(player.weekChange),
      time: `${Math.floor(Math.random() * 6) + 2}h ago`
    };
  });

  // Interleave up and down movements
  const combined = [];
  for (let i = 0; i < Math.max(upMovements.length, downMovements.length); i++) {
    if (upMovements[i]) combined.push(upMovements[i]);
    if (downMovements[i]) combined.push(downMovements[i]);
  }
  return combined;
};

const playerPropMovements = buildPlayerPropMovements();

const gameLineMovements = [
  {
    id: '1',
    game: 'BUF @ KC',
    awayTeam: 'BUF',
    homeTeam: 'KC',
    prop: 'Total Points',
    oldLine: 51.5,
    newLine: 54.5,
    movement: 3.0,
    direction: 'up' as const,
    reason: 'Weather clearing, offensive matchup',
    time: '2h ago'
  },
  {
    id: '2',
    game: 'SF vs DAL',
    awayTeam: 'DAL',
    homeTeam: 'SF',
    prop: 'Spread',
    oldLine: 'SF -6.5',
    newLine: 'SF -7.5',
    movement: 1.0,
    direction: 'up' as const,
    reason: 'Sharp action on 49ers',
    time: '3h ago'
  },
  {
    id: '3',
    game: 'MIA @ NYJ',
    awayTeam: 'MIA',
    homeTeam: 'NYJ',
    prop: 'Total Points',
    oldLine: 47.5,
    newLine: 45.5,
    movement: -2.0,
    direction: 'down' as const,
    reason: 'Wind concerns, defensive trend',
    time: '4h ago'
  },
  {
    id: '4',
    game: 'PHI @ WAS',
    awayTeam: 'PHI',
    homeTeam: 'WAS',
    prop: 'Spread',
    oldLine: 'PHI -8.5',
    newLine: 'PHI -9.5',
    movement: 1.0,
    direction: 'up' as const,
    reason: 'WAS injuries mounting',
    time: '5h ago'
  },
  {
    id: '5',
    game: 'GB vs DET',
    awayTeam: 'DET',
    homeTeam: 'GB',
    prop: 'Total Points',
    oldLine: 48.5,
    newLine: 50.5,
    movement: 2.0,
    direction: 'up' as const,
    reason: 'Both offenses clicking, pace up',
    time: '6h ago'
  },
  {
    id: '6',
    game: 'BAL @ CIN',
    awayTeam: 'BAL',
    homeTeam: 'CIN',
    prop: 'Spread',
    oldLine: 'BAL -2.5',
    newLine: 'BAL -1.5',
    movement: -1.0,
    direction: 'down' as const,
    reason: 'Burrow health improving',
    time: '7h ago'
  },
];

export function TrendsView({ onPlayerClick, onGameSelect, isDarkMode }: TrendsViewProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'up' | 'down'>('all');
  const [activeTab, setActiveTab] = useState<'players' | 'games'>('players');

  const filteredPlayerMovements = playerPropMovements.filter(m => {
    if (activeFilter === 'all') return true;
    return m.direction === activeFilter;
  });

  const filteredGameMovements = gameLineMovements.filter(m => {
    if (activeFilter === 'all') return true;
    return m.direction === activeFilter;
  });

  const convertToPlayer = (movement: typeof playerPropMovements[number], index: number): Player => ({
    id: `trend-${index}`,
    rank: index + 1,
    name: movement.name,
    team: movement.team,
    position: movement.position,
    keyLine: `O/U ${movement.newLine} ${movement.prop.toLowerCase()}`,
    projectedPoints: movement.projection,
    weekChange: movement.movement,
  });

  const handleGameClick = (gameId: string) => {
    const game = weekGames.find(g => g.id === gameId);
    if (game) {
      onGameSelect(game);
    }
  };

  // Stats for header
  const totalUpMoves = playerPropMovements.filter(m => m.direction === 'up').length + 
                       gameLineMovements.filter(m => m.direction === 'up').length;
  const totalDownMoves = playerPropMovements.filter(m => m.direction === 'down').length + 
                         gameLineMovements.filter(m => m.direction === 'down').length;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-5 h-5 text-blue-500" />
                <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Line Movements</h1>
              </div>
              <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Track real-time betting line changes across player props and game totals
              </p>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-3">
              <div className={`px-4 py-2 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{totalUpMoves} Up</span>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{totalDownMoves} Down</span>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>2m ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters inside card */}
        <div className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${isDarkMode ? 'bg-slate-800/30' : 'bg-slate-50'}`}>
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>View:</span>
            <button
              onClick={() => setActiveTab('players')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                activeTab === 'players'
                  ? 'bg-blue-600 text-white'
                  : isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Player Props
            </button>
            <button
              onClick={() => setActiveTab('games')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                activeTab === 'games'
                  ? 'bg-blue-600 text-white'
                  : isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Game Lines
            </button>
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center gap-2">
            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Filter:</span>
            {(['all', 'up', 'down'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  activeFilter === filter
                    ? 'bg-blue-600 text-white'
                    : isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {filter === 'all' ? 'All' : filter === 'up' ? '↑ Rising' : '↓ Falling'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        {activeTab === 'players' ? (
          <div className="divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-slate-200'}">
            {filteredPlayerMovements.map((movement, index) => (
              <button
                key={index}
                onClick={() => onPlayerClick(convertToPlayer(movement, index))}
                className={`w-full p-4 text-left transition-colors ${
                  isDarkMode 
                    ? 'hover:bg-slate-800/50' 
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Player avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                      {movement.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{movement.name}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {movement.position}
                        </span>
                        <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{movement.team}</span>
                      </div>
                      <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {movement.prop}: <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{movement.oldLine.toFixed(1)}</span>
                        <ArrowRight className="w-3 h-3 inline mx-1" />
                        <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{movement.newLine.toFixed(1)}</span>
                        <span className={`ml-2 text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>• {movement.reason}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Proj</div>
                      <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{movement.projection}</div>
                    </div>
                    
                    <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg ${
                      movement.direction === 'up' 
                        ? 'bg-green-500/10 text-green-500' 
                        : 'bg-red-500/10 text-red-500'
                    }`}>
                      {movement.direction === 'up' ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <span className="font-semibold text-sm">
                        {movement.direction === 'up' ? '+' : ''}{movement.movement.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-slate-200'}`}>
            {filteredGameMovements.map((movement, index) => (
              <button
                key={index}
                onClick={() => handleGameClick(movement.id)}
                className={`w-full p-4 text-left transition-colors ${
                  isDarkMode 
                    ? 'hover:bg-slate-800/50' 
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Team badges */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900'}`}>
                        {movement.awayTeam}
                      </div>
                      <span className={`text-xs ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>@</span>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900'}`}>
                        {movement.homeTeam}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                          movement.prop === 'Total Points' 
                            ? isDarkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'
                            : isDarkMode ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'
                        }`}>
                          {movement.prop}
                        </span>
                        <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{movement.time}</span>
                      </div>
                      <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{movement.oldLine}</span>
                        <ArrowRight className="w-3 h-3 inline mx-1" />
                        <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{movement.newLine}</span>
                        <span className={`ml-2 text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>• {movement.reason}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg flex-shrink-0 ${
                    movement.direction === 'up' 
                      ? 'bg-green-500/10 text-green-500' 
                      : 'bg-red-500/10 text-red-500'
                  }`}>
                    {movement.direction === 'up' ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    <span className="font-semibold text-sm">
                      {movement.direction === 'up' ? '+' : ''}{Math.abs(movement.movement).toFixed(1)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Empty state - shown inside the content card */}
      {((activeTab === 'players' && filteredPlayerMovements.length === 0) || 
        (activeTab === 'games' && filteredGameMovements.length === 0)) && (
        <div className={`rounded-xl border p-12 text-center ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <Activity className={`w-10 h-10 mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
          <h3 className={`font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>No movements found</h3>
          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Try changing your filter to see more results.
          </p>
        </div>
      )}
    </div>
  );
}
