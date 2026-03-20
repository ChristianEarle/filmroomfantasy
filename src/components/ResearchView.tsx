import { useState, useEffect, useCallback } from 'react';
import { Search, Lock, TrendingUp, Zap } from 'lucide-react';
import { Player } from '../App';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import api from '../services/api';

interface ResearchViewProps {
  isDarkMode: boolean;
  userSubscriptionTier?: string;
  isAuthenticated: boolean;
  onPlayerClick?: (player: Player) => void;
}

interface PopularPlayer {
  id: string;
  name: string;
  team: string;
  position: string;
  headshotUrl?: string | null;
  projectedPoints: number;
  avgPointsPPR?: number;
}

interface VegasProp {
  market: string;
  line: number;
  overPrice: number;
  underPrice: number;
  result?: number;
  hit?: 'OVER' | 'UNDER' | null;
}

interface GameLog {
  week: number;
  opponent: string;
  fantasyPoints: number;
  stats: Record<string, number>;
  aboveAverage: boolean;
}

interface ProjectionAccuracy {
  week: number;
  projected: number;
  actual: number;
  difference: number;
  gameLine?: string;
}

const isPro = (tier?: string): boolean => tier === 'pro' || tier === 'elite';

export function ResearchView({
  isDarkMode,
  userSubscriptionTier = 'free',
  isAuthenticated,
}: ResearchViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<PopularPlayer | null>(null);
  const [popularPlayers, setPopularPlayers] = useState<PopularPlayer[]>([]);
  const [vegasProps, setVegasProps] = useState<VegasProp[]>([]);
  const [gameLogs, setGameLogs] = useState<GameLog[]>([]);
  const [projectionAccuracy, setProjectionAccuracy] = useState<ProjectionAccuracy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);

  const isProUser = isPro(userSubscriptionTier) && isAuthenticated;

  // Fetch popular players on mount
  useEffect(() => {
    const fetchPopularPlayers = async () => {
      try {
        setLoading(true);
        const response = await api.get<{
          players: PopularPlayer[];
        }>('/players?limit=12&sort=rank');
        setPopularPlayers(response.players || []);
      } catch (error) {
        console.error('Failed to load popular players:', error);
        setPopularPlayers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPopularPlayers();
  }, []);

  // Fetch player details when a player is selected
  useEffect(() => {
    if (!selectedPlayer) return;

    const fetchPlayerDetails = async () => {
      try {
        setLoadingDetails(true);
        const season = 2025;

        const [propsRes, statsRes, accuracyRes] = await Promise.all([
          api
            .get<{ props: VegasProp[] }>(
              `/players/${selectedPlayer.id}/props?week=${currentWeek}&season=${season}`
            )
            .catch(() => ({ props: [] })),
          api
            .get<{ gameLogs: GameLog[] }>(
              `/players/${selectedPlayer.id}/stats?season=${season}`
            )
            .catch(() => ({ gameLogs: [] })),
          api
            .get<{ projectionAccuracy: ProjectionAccuracy[] }>(
              `/players/${selectedPlayer.id}/projection-accuracy?season=${season}`
            )
            .catch(() => ({ projectionAccuracy: [] })),
        ]);

        setVegasProps(propsRes.props || []);
        setGameLogs(statsRes.gameLogs || []);
        setProjectionAccuracy(accuracyRes.projectionAccuracy || []);
      } catch (error) {
        console.error('Failed to load player details:', error);
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchPlayerDetails();
  }, [selectedPlayer, currentWeek]);

  const handlePlayerSelect = (player: PopularPlayer) => {
    setSelectedPlayer(player);
  };

  const handleBackToPopular = () => {
    setSelectedPlayer(null);
  };

  if (!isProUser) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1
            className={`text-3xl font-bold mb-2 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            Player Research
          </h1>
          <p
            className={`text-base ${
              isDarkMode ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            Deep dive into stats, Vegas props, game logs, and matchup analysis
          </p>
        </div>

        {/* Pro Paywall */}
        <div className="relative">
          <div
            className={`rounded-xl border p-12 text-center ${
              isDarkMode
                ? 'bg-slate-900 border-slate-700'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            {/* Blurred overlay */}
            <div className="absolute inset-0 rounded-xl backdrop-blur-sm bg-black/5 flex items-center justify-center">
              <div className="text-center">
                <div
                  className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                    isDarkMode
                      ? 'bg-amber-500/20'
                      : 'bg-amber-100'
                  }`}
                >
                  <Lock className={`w-8 h-8 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
                </div>
                <h3
                  className={`text-xl font-bold mb-2 ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Premium Research Feature
                </h3>
                <p
                  className={`text-sm mb-6 max-w-md mx-auto ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Player Research with Vegas props, game logs, and projection accuracy is available for Pro members.
                </p>
                <button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                  Upgrade to Pro
                </button>
              </div>
            </div>

            {/* Dummy content behind blur */}
            <div className="opacity-50 pointer-events-none">
              <div className="grid grid-cols-4 gap-4">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-4 ${
                      isDarkMode ? 'bg-slate-800' : 'bg-white'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-full mb-2 ${
                        isDarkMode ? 'bg-slate-700' : 'bg-slate-200'
                      }`}
                    />
                    <div
                      className={`h-4 rounded mb-2 ${
                        isDarkMode ? 'bg-slate-700' : 'bg-slate-200'
                      }`}
                    />
                    <div
                      className={`h-3 rounded ${
                        isDarkMode ? 'bg-slate-700' : 'bg-slate-200'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedPlayer) {
    return (
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1
            className={`text-3xl font-bold mb-2 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            Player Research
          </h1>
          <p
            className={`text-base mb-6 ${
              isDarkMode ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            Deep dive into stats, Vegas props, game logs, and matchup analysis
          </p>

          {/* Search Bar */}
          <div className="relative">
            <Search
              className={`absolute left-3 top-3 w-5 h-5 ${
                isDarkMode ? 'text-slate-500' : 'text-slate-400'
              }`}
            />
            <input
              type="text"
              placeholder="Search player..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
              } outline-none`}
            />
          </div>
        </div>

        {/* Popular Players Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {popularPlayers.map((player) => (
              <button
                key={player.id}
                onClick={() => handlePlayerSelect(player)}
                className={`rounded-lg border p-4 text-left transition-all hover:shadow-lg ${
                  isDarkMode
                    ? 'bg-slate-900 border-slate-700 hover:border-slate-600'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {player.headshotUrl && (
                  <img
                    src={player.headshotUrl}
                    alt={player.name}
                    className="w-16 h-16 rounded-full mb-3 object-cover"
                  />
                )}
                <h3
                  className={`font-semibold mb-1 ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {player.name}
                </h3>
                <p
                  className={`text-sm mb-3 ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  {player.position} • {player.team}
                </p>
                <div
                  className={`text-2xl font-bold ${
                    isDarkMode ? 'text-blue-400' : 'text-blue-600'
                  }`}
                >
                  {player.projectedPoints.toFixed(1)}
                </div>
                <p
                  className={`text-xs ${
                    isDarkMode ? 'text-slate-500' : 'text-slate-500'
                  }`}
                >
                  Projected pts
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Detailed Research Panel
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header with Back Button */}
      <button
        onClick={handleBackToPopular}
        className={`mb-6 text-sm font-semibold flex items-center gap-2 ${
          isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
        }`}
      >
        ← Back to Players
      </button>

      {/* Player Overview Card */}
      <div
        className={`rounded-xl border mb-6 p-6 ${
          isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-start gap-4">
          {selectedPlayer.headshotUrl && (
            <img
              src={selectedPlayer.headshotUrl}
              alt={selectedPlayer.name}
              className="w-24 h-24 rounded-full object-cover"
            />
          )}
          <div className="flex-1">
            <h2
              className={`text-2xl font-bold mb-1 ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              {selectedPlayer.name}
            </h2>
            <p
              className={`text-base mb-4 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              {selectedPlayer.position} • {selectedPlayer.team}
            </p>
            <div className="flex gap-6">
              <div>
                <p
                  className={`text-xs font-semibold mb-1 ${
                    isDarkMode ? 'text-slate-500' : 'text-slate-500'
                  }`}
                >
                  Season Avg
                </p>
                <p
                  className={`text-xl font-bold ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {selectedPlayer.avgPointsPPR?.toFixed(1) || 'N/A'}
                </p>
              </div>
              <div>
                <p
                  className={`text-xs font-semibold mb-1 ${
                    isDarkMode ? 'text-slate-500' : 'text-slate-500'
                  }`}
                >
                  This Week
                </p>
                <p
                  className={`text-xl font-bold ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {selectedPlayer.projectedPoints.toFixed(1)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className={`grid w-full grid-cols-4 mb-6 ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="props">Vegas Props</TabsTrigger>
          <TabsTrigger value="gamelog">Game Log</TabsTrigger>
          <TabsTrigger value="accuracy">Projection Accuracy</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div
              className={`rounded-xl border p-6 ${
                isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
              }`}
            >
              <h3
                className={`text-lg font-semibold mb-4 ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                Summary
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p
                    className={`text-xs font-semibold mb-1 ${
                      isDarkMode ? 'text-slate-500' : 'text-slate-500'
                    }`}
                  >
                    PPG
                  </p>
                  <p
                    className={`text-2xl font-bold ${
                      isDarkMode ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {selectedPlayer.avgPointsPPR?.toFixed(1) || 'N/A'}
                  </p>
                </div>
                <div>
                  <p
                    className={`text-xs font-semibold mb-1 ${
                      isDarkMode ? 'text-slate-500' : 'text-slate-500'
                    }`}
                  >
                    Position
                  </p>
                  <p
                    className={`text-2xl font-bold ${
                      isDarkMode ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {selectedPlayer.position}
                  </p>
                </div>
                <div>
                  <p
                    className={`text-xs font-semibold mb-1 ${
                      isDarkMode ? 'text-slate-500' : 'text-slate-500'
                    }`}
                  >
                    Team
                  </p>
                  <p
                    className={`text-2xl font-bold ${
                      isDarkMode ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {selectedPlayer.team}
                  </p>
                </div>
                <div>
                  <p
                    className={`text-xs font-semibold mb-1 ${
                      isDarkMode ? 'text-slate-500' : 'text-slate-500'
                    }`}
                  >
                    This Week
                  </p>
                  <p
                    className={`text-2xl font-bold text-blue-600 ${
                      isDarkMode ? 'text-blue-400' : ''
                    }`}
                  >
                    {selectedPlayer.projectedPoints.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Vegas Props Tab */}
        <TabsContent value="props" className="space-y-4">
          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : vegasProps.length === 0 ? (
            <div
              className={`rounded-xl border p-8 text-center ${
                isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <Zap
                className={`w-8 h-8 mx-auto mb-2 ${
                  isDarkMode ? 'text-slate-500' : 'text-slate-400'
                }`}
              />
              <p
                className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}
              >
                No Vegas props available for this player.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {vegasProps.map((prop, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg border p-4 ${
                    isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4
                        className={`font-semibold mb-1 ${
                          isDarkMode ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {prop.market}
                      </h4>
                      <p
                        className={`text-sm ${
                          isDarkMode ? 'text-slate-400' : 'text-slate-600'
                        }`}
                      >
                        Line: {prop.line.toFixed(1)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex gap-4">
                        <div>
                          <p
                            className={`text-xs mb-1 font-semibold ${
                              isDarkMode ? 'text-slate-500' : 'text-slate-500'
                            }`}
                          >
                            OVER
                          </p>
                          <p
                            className={`font-bold ${
                              isDarkMode ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            -{prop.overPrice}
                          </p>
                        </div>
                        <div>
                          <p
                            className={`text-xs mb-1 font-semibold ${
                              isDarkMode ? 'text-slate-500' : 'text-slate-500'
                            }`}
                          >
                            UNDER
                          </p>
                          <p
                            className={`font-bold ${
                              isDarkMode ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            -{prop.underPrice}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {prop.hit && (
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded ${
                          prop.hit === 'OVER'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {prop.hit} ({prop.result?.toFixed(1)})
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Game Log Tab */}
        <TabsContent value="gamelog" className="space-y-4">
          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : gameLogs.length === 0 ? (
            <div
              className={`rounded-xl border p-8 text-center ${
                isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <p
                className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}
              >
                No game log data available.
              </p>
            </div>
          ) : (
            <div
              className={`rounded-xl border overflow-hidden ${
                isDarkMode ? 'border-slate-700' : 'border-slate-200'
              }`}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      className={`border-b ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <th
                        className={`px-4 py-3 text-left text-sm font-semibold ${
                          isDarkMode ? 'text-slate-300' : 'text-slate-700'
                        }`}
                      >
                        Week
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-sm font-semibold ${
                          isDarkMode ? 'text-slate-300' : 'text-slate-700'
                        }`}
                      >
                        Opponent
                      </th>
                      <th
                        className={`px-4 py-3 text-right text-sm font-semibold ${
                          isDarkMode ? 'text-slate-300' : 'text-slate-700'
                        }`}
                      >
                        Fantasy Pts
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-sm font-semibold ${
                          isDarkMode ? 'text-slate-300' : 'text-slate-700'
                        }`}
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {gameLogs.map((log, idx) => (
                      <tr
                        key={idx}
                        className={`border-b ${
                          idx % 2 === 0
                            ? isDarkMode
                              ? 'bg-slate-900'
                              : 'bg-white'
                            : isDarkMode
                              ? 'bg-slate-800/50'
                              : 'bg-slate-50'
                        } ${
                          isDarkMode
                            ? 'border-slate-700'
                            : 'border-slate-200'
                        }`}
                      >
                        <td
                          className={`px-4 py-3 font-semibold ${
                            isDarkMode ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {log.week}
                        </td>
                        <td
                          className={`px-4 py-3 ${
                            isDarkMode ? 'text-slate-300' : 'text-slate-600'
                          }`}
                        >
                          {log.opponent}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-semibold ${
                            isDarkMode ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {log.fantasyPoints.toFixed(1)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-bold px-2 py-1 rounded ${
                              log.aboveAverage
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {log.aboveAverage ? '↑ Above Avg' : '↓ Below Avg'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Projection Accuracy Tab */}
        <TabsContent value="accuracy" className="space-y-4">
          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : projectionAccuracy.length === 0 ? (
            <div
              className={`rounded-xl border p-8 text-center ${
                isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <TrendingUp
                className={`w-8 h-8 mx-auto mb-2 ${
                  isDarkMode ? 'text-slate-500' : 'text-slate-400'
                }`}
              />
              <p
                className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}
              >
                No projection accuracy data available.
              </p>
            </div>
          ) : (
            <div
              className={`rounded-xl border overflow-hidden ${
                isDarkMode ? 'border-slate-700' : 'border-slate-200'
              }`}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      className={`border-b ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <th
                        className={`px-4 py-3 text-left text-sm font-semibold ${
                          isDarkMode ? 'text-slate-300' : 'text-slate-700'
                        }`}
                      >
                        Week
                      </th>
                      <th
                        className={`px-4 py-3 text-right text-sm font-semibold ${
                          isDarkMode ? 'text-slate-300' : 'text-slate-700'
                        }`}
                      >
                        Projected
                      </th>
                      <th
                        className={`px-4 py-3 text-right text-sm font-semibold ${
                          isDarkMode ? 'text-slate-300' : 'text-slate-700'
                        }`}
                      >
                        Actual
                      </th>
                      <th
                        className={`px-4 py-3 text-right text-sm font-semibold ${
                          isDarkMode ? 'text-slate-300' : 'text-slate-700'
                        }`}
                      >
                        Difference
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-sm font-semibold ${
                          isDarkMode ? 'text-slate-300' : 'text-slate-700'
                        }`}
                      >
                        Game Line
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectionAccuracy.map((acc, idx) => (
                      <tr
                        key={idx}
                        className={`border-b ${
                          idx % 2 === 0
                            ? isDarkMode
                              ? 'bg-slate-900'
                              : 'bg-white'
                            : isDarkMode
                              ? 'bg-slate-800/50'
                              : 'bg-slate-50'
                        } ${
                          isDarkMode
                            ? 'border-slate-700'
                            : 'border-slate-200'
                        }`}
                      >
                        <td
                          className={`px-4 py-3 font-semibold ${
                            isDarkMode ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {acc.week}
                        </td>
                        <td
                          className={`px-4 py-3 text-right ${
                            isDarkMode ? 'text-slate-300' : 'text-slate-600'
                          }`}
                        >
                          {acc.projected.toFixed(1)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-semibold ${
                            isDarkMode ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {acc.actual.toFixed(1)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-semibold ${
                            acc.difference >= 0
                              ? 'text-green-400'
                              : 'text-red-400'
                          }`}
                        >
                          {acc.difference > 0 ? '+' : ''}
                          {acc.difference.toFixed(1)}
                        </td>
                        <td
                          className={`px-4 py-3 text-sm ${
                            isDarkMode ? 'text-slate-400' : 'text-slate-600'
                          }`}
                        >
                          {acc.gameLine || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
