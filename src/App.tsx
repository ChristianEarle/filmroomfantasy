import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { PlayerTable } from './components/PlayerTable';
import { NewsPanel } from './components/NewsPanel';
import { BiggestMovers } from './components/BiggestMovers';
import { PlayerCard } from './components/PlayerCard';
import { TeamView } from './components/TeamView';
import { MatchupView } from './components/MatchupView';
import { WaiversView } from './components/WaiversView';
import { HomeView } from './components/HomeView';
import { GameSlateView, Game } from './components/GameSlateView';
import { TrendsView } from './components/TrendsView';
import { PlayoffPredictorView } from './components/PlayoffPredictorView';
import { GameDetailModal } from './components/GameDetailModal';
import { SettingsView } from './components/SettingsView';
import { LoginView } from './components/LoginView';
import { RegisterView } from './components/RegisterView';

// Page transition wrapper component
function PageTransition({ children, viewKey }: { children: React.ReactNode; viewKey: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const [displayChildren, setDisplayChildren] = useState(children);
  const prevKeyRef = useRef(viewKey);

  useEffect(() => {
    if (viewKey !== prevKeyRef.current) {
      // View is changing - fade out, then update, then fade in
      setIsVisible(false);
      const timer = setTimeout(() => {
        setDisplayChildren(children);
        prevKeyRef.current = viewKey;
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      }, 150);
      return () => clearTimeout(timer);
    } else {
      // Initial mount or children update without view change
      setDisplayChildren(children);
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    }
  }, [viewKey, children]);

  return (
    <div
      className={`transition-all duration-300 ease-out ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2'
      }`}
    >
      {displayChildren}
    </div>
  );
}

export interface Player {
  id: string;
  rank: number;
  name: string;
  team: string;
  position: 'WR' | 'RB' | 'QB' | 'TE' | 'K' | 'DEF';
  keyLine: string;
  projectedPoints: number;
  weekChange: number;
}

export default function App() {
  const [selectedScoring, setSelectedScoring] = useState<'PPR' | 'Half PPR' | 'Standard'>('PPR');
  const [selectedPosition, setSelectedPosition] = useState<string>('ALL');
  const [currentWeek, setCurrentWeek] = useState(5);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [activeView, setActiveView] = useState<'Board' | 'Team' | 'Matchup' | 'Waivers' | 'Home' | 'GameSlate' | 'Trends' | 'Playoffs' | 'Settings'>('Home');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  const handleGameSelect = (game: Game | null) => {
    setSelectedGame(game);
  };

  const handleToggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // When clicking a player from the game modal, close the game modal first
  const handlePlayerClickFromGame = (player: Player) => {
    setSelectedGame(null);
    setSelectedPlayer(player);
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthView('login');
  };

  // Show login/register pages if not authenticated
  if (!isAuthenticated) {
    if (authView === 'login') {
      return (
        <LoginView
          onLogin={handleLogin}
          onSwitchToRegister={() => setAuthView('register')}
          isDarkMode={isDarkMode}
        />
      );
    }
    return (
      <RegisterView
        onRegister={handleLogin}
        onSwitchToLogin={() => setAuthView('login')}
        isDarkMode={isDarkMode}
      />
    );
  }

  return (
    <div className={`flex h-screen ${isDarkMode ? 'dark bg-slate-900' : 'bg-slate-100'}`}>
      <Sidebar activeView={activeView} onViewChange={setActiveView} isDarkMode={isDarkMode} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onPlayerClick={setSelectedPlayer} isDarkMode={isDarkMode} />
        
        <main className={`flex-1 overflow-y-auto p-6 ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
          <PageTransition viewKey={activeView}>
            {activeView === 'Home' ? (
              <HomeView
                onPlayerClick={setSelectedPlayer}
                onViewChange={setActiveView}
                onGameSelect={handleGameSelect}
                isDarkMode={isDarkMode}
              />
            ) : activeView === 'Board' ? (
              <div className="max-w-[1600px] mx-auto">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {/* Main Content - 2/3 width */}
                  <div className="xl:col-span-2 space-y-6">
                    <PlayerTable
                      selectedScoring={selectedScoring}
                      onScoringChange={setSelectedScoring}
                      selectedPosition={selectedPosition}
                      onPositionChange={setSelectedPosition}
                      currentWeek={currentWeek}
                      onWeekChange={setCurrentWeek}
                      onPlayerClick={setSelectedPlayer}
                      isDarkMode={isDarkMode}
                    />
                  </div>

                  {/* Right Sidebar - 1/3 width */}
                  <div className="space-y-6">
                    <NewsPanel isDarkMode={isDarkMode} />
                    <BiggestMovers currentWeek={currentWeek} isDarkMode={isDarkMode} />
                  </div>
                </div>
              </div>
            ) : activeView === 'Team' ? (
              <TeamView onPlayerClick={setSelectedPlayer} isDarkMode={isDarkMode} />
            ) : activeView === 'Matchup' ? (
              <MatchupView onPlayerClick={setSelectedPlayer} isDarkMode={isDarkMode} />
            ) : activeView === 'GameSlate' ? (
              <GameSlateView
                onSelectGame={setSelectedGame}
                isDarkMode={isDarkMode}
              />
            ) : activeView === 'Trends' ? (
              <TrendsView
                onPlayerClick={setSelectedPlayer}
                onGameSelect={handleGameSelect}
                isDarkMode={isDarkMode}
              />
            ) : activeView === 'Playoffs' ? (
              <PlayoffPredictorView isDarkMode={isDarkMode} />
            ) : activeView === 'Settings' ? (
              <SettingsView
                isDarkMode={isDarkMode}
                onToggleDarkMode={handleToggleDarkMode}
              />
            ) : (
              <WaiversView onPlayerClick={setSelectedPlayer} isDarkMode={isDarkMode} />
            )}
          </PageTransition>
        </main>
      </div>

      {/* Player Card Modal */}
      {selectedPlayer && (
        <PlayerCard
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Game Detail Modal */}
      {selectedGame && (
        <GameDetailModal
          game={selectedGame}
          onPlayerClick={handlePlayerClickFromGame}
          onClose={() => setSelectedGame(null)}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}