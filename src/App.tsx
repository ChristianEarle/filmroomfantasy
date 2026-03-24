import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
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
import { GameDetailModal } from './components/GameDetailModal';

// Lazy load heavy views for better initial bundle size
const TrendsView = lazy(() => import('./components/TrendsView').then(m => ({ default: m.TrendsView })));
const PlayoffPredictorView = lazy(() => import('./components/PlayoffPredictorView').then(m => ({ default: m.PlayoffPredictorView })));
const ResearchView = lazy(() => import('./components/ResearchView').then(m => ({ default: m.ResearchView })));
import { SettingsView } from './components/SettingsView';
import { LoginView } from './components/LoginView';
import { RegisterView } from './components/RegisterView';
import { ForgotPasswordView, ResetPasswordView } from './components/ForgotPasswordView';
import { ProfileView } from './components/ProfileView';
import { AllPlayersView } from './components/AllPlayersView';
import { ComingSoonView } from './components/ComingSoonView';
import { TradeAnalyzerView } from './components/TradeAnalyzerView';
import { PricingView } from './components/PricingView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LeagueProvider, useLeagueContext } from './context/LeagueContext';
import { LeaguesProvider, useLeaguesContext } from './context/LeaguesContext';

// Page transition wrapper component
function PageTransition({ children, viewKey }: { children: React.ReactNode; viewKey: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const [displayChildren, setDisplayChildren] = useState(children);
  const prevKeyRef = useRef(viewKey);
  const childrenRef = useRef(children);
  childrenRef.current = children;

  useEffect(() => {
    if (viewKey !== prevKeyRef.current) {
      // View is changing - fade out, then update, then fade in
      setIsVisible(false);
      const timer = setTimeout(() => {
        setDisplayChildren(childrenRef.current);
        prevKeyRef.current = viewKey;
        const rafId = requestAnimationFrame(() => {
          setIsVisible(true);
        });
        // Store rafId for cleanup on next run
        cleanupRaf = rafId;
      }, 150);
      let cleanupRaf: number | undefined;
      return () => {
        clearTimeout(timer);
        if (cleanupRaf !== undefined) cancelAnimationFrame(cleanupRaf);
      };
    } else {
      // Initial mount or children update without view change
      setDisplayChildren(childrenRef.current);
      const rafId = requestAnimationFrame(() => {
        setIsVisible(true);
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [viewKey]);

  // Keep displayed children in sync when viewKey hasn't changed (re-renders)
  useEffect(() => {
    if (viewKey === prevKeyRef.current) {
      setDisplayChildren(children);
    }
  }, [children, viewKey]);

  return (
    <div
      className={`transition-all duration-300 ease-out motion-reduce:transition-none ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2'
      }`}
    >
      {displayChildren}
    </div>
  );
}

// Shown when a view requires login or league sync (Team, Matchup, Waivers, Home, Playoffs, Settings when not logged in)
function LoginSyncGate({
  needsLogin,
  onGoToLogin,
  onGoToSettings,
  isDarkMode,
}: {
  needsLogin: boolean;
  onGoToLogin: () => void;
  onGoToSettings: () => void;
  isDarkMode: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center min-h-[60vh] p-8 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
      <div className={`max-w-sm w-full rounded-xl border p-8 text-center ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
        <p className="text-lg font-semibold mb-2">
          {needsLogin ? 'Login and sync league to view' : 'Sync league to view'}
        </p>
        <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {needsLogin
            ? 'Sign in and connect your league in Settings to see this page.'
            : 'Connect or sync your league in Settings to see this page.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {needsLogin ? (
            <button
              type="button"
              onClick={onGoToLogin}
              className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
            >
              Log in
            </button>
          ) : (
            <button
              type="button"
              onClick={onGoToSettings}
              className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
            >
              Go to Settings
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export interface Player {
  id: string;
  rank: number;
  name: string;
  team: string;
  position: 'WR' | 'RB' | 'QB' | 'TE' | 'K' | 'DEF' | 'FLEX';
  keyLine: string;
  projectedPoints: number;
  weekChange: number;
  weeklyProjectedPoints?: number;
  headshotUrl?: string | null;
}

// URL path <-> view mapping for client-side routing (BUG-001/002 fix)
const VIEW_TO_PATH: Record<string, string> = {
  Home: '/home',
  Board: '/board',
  Matchup: '/matchup',
  Team: '/team',
  Waivers: '/waivers',
  GameSlate: '/game-slate',
  Trends: '/trends',
  Research: '/research',
  Playoffs: '/playoff-predictor',
  DraftRankings: '/draft-rankings',
  TradeAnalyzer: '/trade-analyzer',
  Settings: '/settings',
  Profile: '/profile',
  Login: '/login',
  Register: '/register',
  AllPlayers: '/all-players',
  Pricing: '/pricing',
};

const PATH_TO_VIEW: Record<string, string> = Object.fromEntries(
  Object.entries(VIEW_TO_PATH).map(([view, path]) => [path, view])
);

/** Read the current URL pathname and return the matching view, defaulting to 'Board'. */
function getViewFromURL(): string {
  let path: string;

  // Handle redirect from landing page: landing.html encodes the original path
  // in a hash fragment when Cloudflare Pages serves it for SPA routes.
  const hash = window.location.hash;
  if (hash.startsWith('#redirect=')) {
    const redirectPath = decodeURIComponent(hash.substring('#redirect='.length));
    // Use the decoded path directly — don't re-read window.location.pathname
    // because replaceState may not update it synchronously in all browsers.
    path = redirectPath.split('?')[0].toLowerCase().replace(/\/+$/, '') || '/';
    // Restore the clean URL in the address bar
    window.history.replaceState({}, '', redirectPath);
  } else {
    path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  }

  // Root path or /app.html: show Board
  if (path === '/' || path === '/app.html' || path === '/app') return 'Board';

  const view = PATH_TO_VIEW[path] ?? 'Board';
  // /register is handled within the Login view via authView state
  if (view === 'Register') return 'Login';
  return view;
}

// Main App content component that uses auth context
function AppContent() {
  const { user, isLoading, isAuthenticated, login, register, logout, updateProfile } = useAuth();
  const { selectedLeagueId, setSelectedLeagueId, league, refreshAll } = useLeagueContext();
  const { leagues, isLoading: leaguesLoading } = useLeaguesContext();

  const [selectedScoring, setSelectedScoring] = useState<'PPR' | 'Half PPR' | 'Standard'>('PPR');
  const [selectedPosition, setSelectedPosition] = useState<string>('ALL');
  const [currentWeek, setCurrentWeek] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Sync currentWeek when league data arrives or league changes
  useEffect(() => {
    if (league?.currentWeek != null && league.currentWeek >= 1 && league.currentWeek <= 18) {
      setCurrentWeek(league.currentWeek);
    }
  }, [league?.id, league?.currentWeek]);
  // Initialize activeView from URL so direct navigation works (BUG-002 fix)
  const [activeView, setActiveView] = useState<'Board' | 'Team' | 'Matchup' | 'Waivers' | 'Home' | 'GameSlate' | 'Trends' | 'Research' | 'Playoffs' | 'Settings' | 'Profile' | 'Login' | 'AllPlayers' | 'Pricing' | 'TradeAnalyzer' | 'DraftRankings'>(() => getViewFromURL() as any);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const isDarkMode = user?.darkMode ?? true;

  // Re-sync activeView from URL after auth loading completes, in case mounting
  // or provider initialization changed state before the first meaningful render.
  const hasResyncedRef = useRef(false);
  useEffect(() => {
    if (!isLoading && !hasResyncedRef.current) {
      hasResyncedRef.current = true;
      const urlView = getViewFromURL();
      if (urlView !== activeView) {
        setActiveView(urlView as any);
      }
    }
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync dark class to <html> so CSS variables apply to html/body
  // (prevents white bars on mobile in dark mode)
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const [allPlayersSource, setAllPlayersSource] = useState<'board' | 'waivers'>('board');
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sync URL when activeView changes (BUG-001 fix: URL now updates on sidebar nav)
  useEffect(() => {
    const targetPath = VIEW_TO_PATH[activeView] || '/board';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ view: activeView }, '', targetPath);
    }
  }, [activeView]);

  // Handle browser back/forward buttons (popstate) so routing stays in sync
  useEffect(() => {
    const handlePopState = () => {
      const view = getViewFromURL();
      setActiveView(view as any);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Dynamic page title per view (SEO + better browser tab UX)
  useEffect(() => {
    const titles: Record<string, string> = {
      Home: 'Dashboard | FilmRoom',
      Board: 'Player Rankings | FilmRoom',
      Team: 'My Team | FilmRoom',
      Matchup: 'Matchup | FilmRoom',
      Waivers: 'Waivers | FilmRoom',
      GameSlate: 'NFL Games | FilmRoom',
      Trends: 'Trends | FilmRoom',
      Research: 'Player Research | FilmRoom',
      Playoffs: 'Playoff Predictor | FilmRoom',
      DraftRankings: 'Draft Rankings | FilmRoom',
      TradeAnalyzer: 'AI Trade Analyzer | FilmRoom',
      Settings: 'Settings | FilmRoom',
      Profile: 'Profile | FilmRoom',
      Login: authView === 'register' ? 'Sign Up | FilmRoom' : 'Sign In | FilmRoom',
      AllPlayers: 'All Players | FilmRoom',
      Pricing: 'Pricing | FilmRoom',
    };
    document.title = titles[activeView] || 'FilmRoom - Fantasy Football Analysis & Management';
  }, [activeView]);

  // Check URL for reset_token parameter on mount (query or hash fragment)
  useEffect(() => {
    // Check hash fragment first (more secure — not sent in referrer headers)
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const hashToken = hashParams.get('reset_token');
    // Fall back to query params for backward compatibility
    const queryParams = new URLSearchParams(window.location.search);
    const queryToken = queryParams.get('reset_token');
    const token = hashToken || queryToken;
    if (token) {
      setResetToken(token);
      setAuthView('reset');
      setActiveView('Login');
      // Clean the URL immediately to remove token from browser history
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Handle /register URL — set activeView to Login and authView to register
  useEffect(() => {
    const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    if (path === '/register') {
      setActiveView('Login');
      setAuthView('register');
    }
  }, []);

  // Check if user has synced leagues (use LeaguesContext - same source as sidebar/dropdown)
  const isLeagueSynced = leagues.length > 0;

  const handleGameSelect = useCallback((game: Game | null) => {
    setSelectedGame(game);
  }, []);

  const handleToggleDarkMode = useCallback(() => {
    if (isAuthenticated) {
      updateProfile({ darkMode: !isDarkMode });
    }
  }, [isAuthenticated, isDarkMode, updateProfile]);

  // When clicking a player from the game modal, close the game modal first
  const handlePlayerClickFromGame = useCallback((player: Player) => {
    setSelectedGame(null);
    setSelectedPlayer(player);
  }, []);

  const handlePlayerClick = useCallback((player: Player) => {
    setSelectedPlayer(player);
  }, []);

  const handleLogin = useCallback(async (email: string, password: string) => {
    try {
      setLoginError(null);
      await login(email, password);
      setActiveView('Home');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Login failed');
      throw error;
    }
  }, [login]);

  const handleRegister = useCallback(async (email: string, password: string, username: string) => {
    try {
      setRegisterError(null);
      await register(email, password, username);
      setActiveView('Home');
    } catch (error) {
      setRegisterError(error instanceof Error ? error.message : 'Registration failed');
      throw error;
    }
  }, [register]);

  const handleLogout = useCallback(() => {
    logout();
    setAuthView('login');
    setActiveView('Board');
  }, [logout]);

  const showLoginGate = !isAuthenticated;
  const showSyncGate = isAuthenticated && !leaguesLoading && !isLeagueSynced;

  const goToLogin = useCallback(() => { setAuthView('login'); setActiveView('Login'); }, []);
  const goToSettings = useCallback(() => setActiveView('Settings'), []);

  const handleViewAllFromBoard = useCallback(() => {
    setAllPlayersSource('board');
    setActiveView('AllPlayers');
  }, []);

  const handleViewAllFromWaivers = useCallback(() => {
    setAllPlayersSource('waivers');
    setActiveView('AllPlayers');
  }, []);

  const handleBackFromAllPlayers = useCallback(() => {
    setActiveView(allPlayersSource === 'board' ? 'Board' : 'Waivers');
  }, [allPlayersSource]);

  // Show loading screen while checking auth
  if (isLoading) {
    return (
      <div className={`flex h-dvh min-h-screen items-center justify-center ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-dvh min-h-screen ${isDarkMode ? 'dark bg-slate-950' : 'bg-slate-100'}`}>
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        isDarkMode={isDarkMode}
        isAuthenticated={isAuthenticated}
        selectedLeagueId={selectedLeagueId}
        onLeagueSelect={setSelectedLeagueId}
        onConnectLeague={() => setActiveView('Settings')}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
        userTier={(user?.subscriptionTier as 'free' | 'pro' | undefined) || 'free'}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          onPlayerClick={setSelectedPlayer}
          isDarkMode={isDarkMode}
          isAuthenticated={isAuthenticated}
          onProfileClick={() => {
            if (isAuthenticated) setActiveView('Profile');
            else { setAuthView('login'); setActiveView('Login'); }
          }}
          onMenuToggle={() => setSidebarOpen(prev => !prev)}
        />

        <main className={`flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
          <PageTransition viewKey={activeView}>
            {activeView === 'Home' ? (
              showLoginGate ? (
                <LoginSyncGate
                  needsLogin
                  onGoToLogin={goToLogin}
                  onGoToSettings={goToSettings}
                  isDarkMode={isDarkMode}
                />
              ) : showSyncGate ? (
                <LoginSyncGate
                  needsLogin={false}
                  onGoToLogin={goToLogin}
                  onGoToSettings={goToSettings}
                  isDarkMode={isDarkMode}
                />
              ) : (
                <HomeView
                  onPlayerClick={setSelectedPlayer}
                  onViewChange={setActiveView}
                  onGameSelect={handleGameSelect}
                  isDarkMode={isDarkMode}
                />
              )
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
                      onViewAll={handleViewAllFromBoard}
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
              showLoginGate ? (
                <LoginSyncGate needsLogin onGoToLogin={goToLogin} onGoToSettings={goToSettings} isDarkMode={isDarkMode} />
              ) : showSyncGate ? (
                <LoginSyncGate needsLogin={false} onGoToLogin={goToLogin} onGoToSettings={goToSettings} isDarkMode={isDarkMode} />
              ) : (
                <TeamView onPlayerClick={setSelectedPlayer} isDarkMode={isDarkMode} />
              )
            ) : activeView === 'Matchup' ? (
              showLoginGate ? (
                <LoginSyncGate needsLogin onGoToLogin={goToLogin} onGoToSettings={goToSettings} isDarkMode={isDarkMode} />
              ) : showSyncGate ? (
                <LoginSyncGate needsLogin={false} onGoToLogin={goToLogin} onGoToSettings={goToSettings} isDarkMode={isDarkMode} />
              ) : (
                <MatchupView onPlayerClick={setSelectedPlayer} isDarkMode={isDarkMode} />
              )
            ) : activeView === 'GameSlate' ? (
              <GameSlateView
                onSelectGame={setSelectedGame}
                isDarkMode={isDarkMode}
              />
            ) : activeView === 'Trends' ? (
              <ErrorBoundary isDarkMode={isDarkMode}>
                <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                  <TrendsView
                    onPlayerClick={handlePlayerClick}
                    isDarkMode={isDarkMode}
                  />
                </Suspense>
              </ErrorBoundary>
            ) : activeView === 'Research' ? (
              <ErrorBoundary isDarkMode={isDarkMode}>
                <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                  <ResearchView
                    isDarkMode={isDarkMode}
                    userSubscriptionTier={user?.subscriptionTier}
                    isAuthenticated={isAuthenticated}
                    onPlayerClick={handlePlayerClick}
                  />
                </Suspense>
              </ErrorBoundary>
            ) : activeView === 'Playoffs' ? (
              showLoginGate ? (
                <LoginSyncGate needsLogin onGoToLogin={goToLogin} onGoToSettings={goToSettings} isDarkMode={isDarkMode} />
              ) : showSyncGate ? (
                <LoginSyncGate needsLogin={false} onGoToLogin={goToLogin} onGoToSettings={goToSettings} isDarkMode={isDarkMode} />
              ) : (
                <ErrorBoundary isDarkMode={isDarkMode}>
                  <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                    <PlayoffPredictorView isDarkMode={isDarkMode} />
                  </Suspense>
                </ErrorBoundary>
              )
            ) : activeView === 'Settings' ? (
              showLoginGate ? (
                <LoginSyncGate needsLogin onGoToLogin={goToLogin} onGoToSettings={goToSettings} isDarkMode={isDarkMode} />
              ) : (
                <SettingsView
                  isDarkMode={isDarkMode}
                  onToggleDarkMode={handleToggleDarkMode}
                  onLeagueSynced={() => refreshAll()}
                />
              )
            ) : activeView === 'Profile' ? (
              showLoginGate ? (
                <LoginSyncGate needsLogin onGoToLogin={goToLogin} onGoToSettings={goToSettings} isDarkMode={isDarkMode} />
              ) : (
                <ProfileView isDarkMode={isDarkMode} onLogout={handleLogout} />
              )
            ) : activeView === 'Login' ? (
              authView === 'forgot' ? (
                <ForgotPasswordView
                  onBackToLogin={() => setAuthView('login')}
                  isDarkMode={isDarkMode}
                />
              ) : authView === 'reset' && resetToken ? (
                <ResetPasswordView
                  token={resetToken}
                  onSuccess={() => { setResetToken(null); setAuthView('login'); }}
                  isDarkMode={isDarkMode}
                />
              ) : authView === 'register' ? (
                <RegisterView
                  onRegister={handleRegister}
                  onSwitchToLogin={() => setAuthView('login')}
                  isDarkMode={isDarkMode}
                  error={registerError}
                />
              ) : (
                <LoginView
                  onLogin={handleLogin}
                  onSwitchToRegister={() => setAuthView('register')}
                  onForgotPassword={() => setAuthView('forgot')}
                  isDarkMode={isDarkMode}
                  error={loginError}
                />
              )
            ) : activeView === 'AllPlayers' ? (
              <AllPlayersView
                selectedScoring={selectedScoring}
                onScoringChange={setSelectedScoring}
                selectedPosition={selectedPosition}
                onPositionChange={setSelectedPosition}
                currentWeek={currentWeek}
                onWeekChange={setCurrentWeek}
                onPlayerClick={setSelectedPlayer}
                onBack={handleBackFromAllPlayers}
                isDarkMode={isDarkMode}
                source={allPlayersSource}
              />
            ) : activeView === 'Waivers' ? (
              showLoginGate ? (
                <LoginSyncGate needsLogin onGoToLogin={goToLogin} onGoToSettings={goToSettings} isDarkMode={isDarkMode} />
              ) : showSyncGate ? (
                <LoginSyncGate needsLogin={false} onGoToLogin={goToLogin} onGoToSettings={goToSettings} isDarkMode={isDarkMode} />
              ) : (
                <WaiversView onPlayerClick={setSelectedPlayer} onViewAll={handleViewAllFromWaivers} isDarkMode={isDarkMode} />
              )
            ) : activeView === 'DraftRankings' ? (
              <ComingSoonView title="Draft Rankings" description="AI-powered draft rankings with ADP tracking, tier breakdowns, and custom scoring projections." icon="draft" isDarkMode={isDarkMode} />
            ) : activeView === 'TradeAnalyzer' ? (
              <TradeAnalyzerView isDarkMode={isDarkMode} />
            ) : activeView === 'Pricing' ? (
              <PricingView isDarkMode={isDarkMode} userTier={user?.subscriptionTier as 'free' | 'pro' | 'elite'} isAuthenticated={isAuthenticated} onNavigate={(view) => setActiveView(view as any)} />
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Page Not Found</h2>
                <p className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>The page you're looking for doesn't exist.</p>
                <button onClick={() => setActiveView('Home')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Go Home
                </button>
              </div>
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
          seasonYear={league?.seasonYear}
          currentWeek={currentWeek}
          scoringFormat={league?.scoringFormat}
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

// Root App component with AuthProvider
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LeaguesProvider>
          <LeagueProvider>
            <AppContent />
          </LeagueProvider>
        </LeaguesProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
