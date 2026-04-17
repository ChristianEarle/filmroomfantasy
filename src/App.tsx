import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { PlayerTable } from './components/PlayerTable';
import { NewsPanel } from './components/NewsPanel';
import { BiggestMovers } from './components/BiggestMovers';
import { PlayerCard } from './components/PlayerCard';
import type { Game } from './types/game';
import { GameDetailModal } from './components/GameDetailModal';
import { SEO, getSEOPropsForView } from './components/SEO';

// Lazy load with auto-reload on stale chunks after deploy.
// When a deploy changes chunk hashes, users with cached HTML get 404s on old
// chunk filenames. This wrapper reloads the page once to fetch fresh HTML.
function lazyWithReload<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() =>
    factory().catch((err) => {
      const hasReloaded = sessionStorage.getItem('chunk_reload');
      if (!hasReloaded) {
        sessionStorage.setItem('chunk_reload', '1');
        window.location.reload();
      }
      throw err;
    })
  );
}
// Clear the reload flag on successful page load
if (sessionStorage.getItem('chunk_reload')) sessionStorage.removeItem('chunk_reload');

const TrendsView = lazyWithReload(() => import('./components/TrendsView').then(m => ({ default: m.TrendsView })));
const PlayoffPredictorView = lazyWithReload(() => import('./components/PlayoffPredictorView').then(m => ({ default: m.PlayoffPredictorView })));
const ResearchView = lazyWithReload(() => import('./components/ResearchView').then(m => ({ default: m.ResearchView })));
const TeamView = lazyWithReload(() => import('./components/TeamView').then(m => ({ default: m.TeamView })));
const MatchupView = lazyWithReload(() => import('./components/MatchupView').then(m => ({ default: m.MatchupView })));
const WaiversView = lazyWithReload(() => import('./components/WaiversView').then(m => ({ default: m.WaiversView })));
const HomeView = lazyWithReload(() => import('./components/HomeView').then(m => ({ default: m.HomeView })));
const GameSlateView = lazyWithReload(() => import('./components/GameSlateView').then(m => ({ default: m.GameSlateView })));
const TradeAnalyzerShell = lazyWithReload(() => import('./components/TradeAnalyzerShell').then(m => ({ default: m.TradeAnalyzerShell })));
const SettingsView = lazyWithReload(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView })));
const PricingView = lazyWithReload(() => import('./components/PricingView').then(m => ({ default: m.PricingView })));
const AdminView = lazyWithReload(() => import('./components/AdminView').then(m => ({ default: m.AdminView })));
const AllPlayersView = lazyWithReload(() => import('./components/AllPlayersView').then(m => ({ default: m.AllPlayersView })));
const ProfileView = lazyWithReload(() => import('./components/ProfileView').then(m => ({ default: m.ProfileView })));
const ArticlesView = lazyWithReload(() => import('./components/ArticlesView').then(m => ({ default: m.ArticlesView })));
const ArticleDetailView = lazyWithReload(() => import('./components/ArticleDetailView').then(m => ({ default: m.ArticleDetailView })));
const PrivacyPolicyView = lazyWithReload(() => import('./components/PrivacyPolicyView').then(m => ({ default: m.PrivacyPolicyView })));
const TermsOfServiceView = lazyWithReload(() => import('./components/TermsOfServiceView').then(m => ({ default: m.TermsOfServiceView })));
const CookiePolicyView = lazyWithReload(() => import('./components/CookiePolicyView').then(m => ({ default: m.CookiePolicyView })));
const DMCAView = lazyWithReload(() => import('./components/DMCAView').then(m => ({ default: m.DMCAView })));
const RefundPolicyView = lazyWithReload(() => import('./components/RefundPolicyView').then(m => ({ default: m.RefundPolicyView })));
const DoNotSellView = lazyWithReload(() => import('./components/DoNotSellView').then(m => ({ default: m.DoNotSellView })));
const DisclaimerView = lazyWithReload(() => import('./components/DisclaimerView').then(m => ({ default: m.DisclaimerView })));
const AccessibilityView = lazyWithReload(() => import('./components/AccessibilityView').then(m => ({ default: m.AccessibilityView })));
const AcceptableUseView = lazyWithReload(() => import('./components/AcceptableUseView').then(m => ({ default: m.AcceptableUseView })));
const DraftRankingsView = lazyWithReload(() => import('./components/DraftRankingsView').then(m => ({ default: m.DraftRankingsView })));
import { LoginView } from './components/LoginView';
import { RegisterView } from './components/RegisterView';
import { ForgotPasswordView, ResetPasswordView } from './components/ForgotPasswordView';
import { ComingSoonView } from './components/ComingSoonView';
import { LandingPage } from './components/LandingPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { AppFooter } from './components/AppFooter';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LeagueProvider, useLeagueContext } from './context/LeagueContext';
import { LeaguesProvider, useLeaguesContext } from './context/LeaguesContext';
import { trackPageView } from './services/analytics';
import { trackSignUp } from './services/tracking';

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
  Landing: '/',
  Home: '/home',
  Board: '/player-rankings',
  Matchup: '/matchup',
  Team: '/team',
  Waivers: '/waivers',
  GameSlate: '/game-slate',
  Trends: '/trends',
  Research: '/research',
  Playoffs: '/playoff-predictor',
  DraftRankings: '/draft-rankings',
  LeagueAnalyzer: '/league-analyzer',
  TradeAnalyzer: '/trade-analyzer',
  Settings: '/settings',
  Profile: '/profile',
  Login: '/login',
  Register: '/register',
  AllPlayers: '/all-players',
  Pricing: '/pricing',
  Admin: '/admin',
  Articles: '/articles',
  ArticleDetail: '/articles', // handled with slug in URL
  Privacy: '/privacy',
  Terms: '/terms',
  CookiePolicy: '/cookies',
  DMCA: '/dmca',
  Refunds: '/refunds',
  DoNotSell: '/do-not-sell',
  Disclaimer: '/disclaimer',
  Accessibility: '/accessibility',
  AcceptableUse: '/acceptable-use',
};

const PATH_TO_VIEW: Record<string, string> = Object.fromEntries(
  Object.entries(VIEW_TO_PATH).map(([view, path]) => [path, view])
);

/** Read the current URL pathname and return the matching view, defaulting to 'Landing'. */
function getViewFromURL(): string {
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';

  // Root path shows the landing page for unauthenticated users (handled in render)
  if (path === '/') return 'Landing';

  // Handle article detail routes (/articles/some-slug)
  if (path.startsWith('/articles/') && path.length > '/articles/'.length) return 'ArticleDetail';
  if (path === '/articles') return 'Articles';

  const view = PATH_TO_VIEW[path] ?? 'NotFound';
  // /register is handled within the Login view via authView state
  if (view === 'Register') return 'Login';
  return view;
}

/** Extract article slug from URL */
function getArticleSlugFromURL(): string | null {
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  if (path.startsWith('/articles/')) {
    return path.slice('/articles/'.length);
  }
  return null;
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
  // Initialize activeView from URL so direct navigation works
  const [activeView, setActiveView] = useState<'Landing' | 'Board' | 'Team' | 'Matchup' | 'Waivers' | 'Home' | 'GameSlate' | 'Trends' | 'Research' | 'Playoffs' | 'Settings' | 'Profile' | 'Login' | 'AllPlayers' | 'Pricing' | 'TradeAnalyzer' | 'DraftRankings' | 'LeagueAnalyzer' | 'Admin' | 'Articles' | 'ArticleDetail' | 'Privacy' | 'Terms' | 'CookiePolicy' | 'DMCA' | 'Refunds' | 'DoNotSell' | 'Disclaimer' | 'Accessibility' | 'AcceptableUse' | 'NotFound'>(() => getViewFromURL() as any);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [articleSlug, setArticleSlug] = useState<string | null>(() => getArticleSlugFromURL());
  // Local dark mode state for unauthenticated users (initialized from localStorage)
  const [localDarkMode, setLocalDarkMode] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('darkMode');
      return stored !== null ? stored === 'true' : true;
    } catch {
      // localStorage unavailable (Safari private mode, disabled storage, etc.)
      return true;
    }
  });
  const isDarkMode = isAuthenticated ? (user?.darkMode ?? true) : localDarkMode;

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
    // Keep the user's typo'd URL visible when they hit a 404 — don't rewrite it.
    if (activeView === 'NotFound') {
      trackPageView(window.location.pathname);
      return;
    }
    let targetPath: string;
    if (activeView === 'ArticleDetail' && articleSlug) {
      targetPath = `/articles/${articleSlug}`;
    } else {
      targetPath = VIEW_TO_PATH[activeView] || '/player-rankings';
    }
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ view: activeView }, '', targetPath);
    }
    trackPageView(targetPath);
  }, [activeView, articleSlug]);

  // Handle browser back/forward buttons (popstate) so routing stays in sync
  useEffect(() => {
    const handlePopState = () => {
      const view = getViewFromURL();
      setActiveView(view as any);
      setArticleSlug(getArticleSlugFromURL());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // SEO props for current view (dynamic meta tags, canonical, JSON-LD)
  const seoProps = useMemo(() => getSEOPropsForView(activeView, authView), [activeView, authView]);

  // Check URL for reset_token in hash fragment on mount
  // Only accept hash fragments (not query params) to prevent token leakage via referrer headers
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const token = hashParams.get('reset_token');
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
    } else {
      const newValue = !isDarkMode;
      setLocalDarkMode(newValue);
      try {
        localStorage.setItem('darkMode', String(newValue));
      } catch {
        // localStorage unavailable — keep the in-memory state
      }
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
      trackSignUp('email');
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

  // Suspense fallback for lazy-loaded views
  const suspenseFallback = (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  // Landing page: fullscreen, no sidebar/header
  if (activeView === 'Landing' && !isAuthenticated) {
    return (
      <>
        <SEO {...seoProps} />
        <LandingPage onNavigate={(view) => setActiveView(view as any)} />
        <CookieConsentBanner
          isDarkMode={isDarkMode}
          onNavigate={(view) => setActiveView(view as any)}
        />
      </>
    );
  }

  // If authenticated user lands on '/', redirect to Home
  if (activeView === 'Landing' && isAuthenticated) {
    setActiveView('Home');
  }

  return (
    <div className={`flex h-dvh min-h-screen ${isDarkMode ? 'dark bg-slate-950' : 'bg-slate-100'}`}>
      <SEO {...seoProps} />
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        isDarkMode={isDarkMode}
        isAuthenticated={isAuthenticated}
        isAdmin={user?.role === 'admin'}
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
                <Suspense fallback={suspenseFallback}>
                  <HomeView
                    onPlayerClick={setSelectedPlayer}
                    onViewChange={setActiveView}
                    onGameSelect={handleGameSelect}
                    isDarkMode={isDarkMode}
                  />
                </Suspense>
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
                <Suspense fallback={suspenseFallback}><TeamView onPlayerClick={setSelectedPlayer} isDarkMode={isDarkMode} /></Suspense>
              )
            ) : activeView === 'Matchup' ? (
              showLoginGate ? (
                <LoginSyncGate needsLogin onGoToLogin={goToLogin} onGoToSettings={goToSettings} isDarkMode={isDarkMode} />
              ) : showSyncGate ? (
                <LoginSyncGate needsLogin={false} onGoToLogin={goToLogin} onGoToSettings={goToSettings} isDarkMode={isDarkMode} />
              ) : (
                <Suspense fallback={suspenseFallback}><MatchupView onPlayerClick={setSelectedPlayer} isDarkMode={isDarkMode} /></Suspense>
              )
            ) : activeView === 'GameSlate' ? (
              <Suspense fallback={suspenseFallback}>
                <GameSlateView
                  onSelectGame={setSelectedGame}
                  isDarkMode={isDarkMode}
                />
              </Suspense>
            ) : activeView === 'Trends' ? (
              <ErrorBoundary isDarkMode={isDarkMode}>
                <Suspense fallback={suspenseFallback}>
                  <TrendsView
                    onPlayerClick={handlePlayerClick}
                    isDarkMode={isDarkMode}
                  />
                </Suspense>
              </ErrorBoundary>
            ) : activeView === 'Research' ? (
              <ComingSoonView title="Player Research" description="In-depth player analysis with Vegas props, game logs, projection accuracy tracking, and advanced metrics." icon="draft" isDarkMode={isDarkMode} />
            ) : activeView === 'Playoffs' ? (
              showLoginGate ? (
                <LoginSyncGate needsLogin onGoToLogin={goToLogin} onGoToSettings={goToSettings} isDarkMode={isDarkMode} />
              ) : showSyncGate ? (
                <LoginSyncGate needsLogin={false} onGoToLogin={goToLogin} onGoToSettings={goToSettings} isDarkMode={isDarkMode} />
              ) : (
                <ErrorBoundary isDarkMode={isDarkMode}>
                  <Suspense fallback={suspenseFallback}>
                    <PlayoffPredictorView isDarkMode={isDarkMode} />
                  </Suspense>
                </ErrorBoundary>
              )
            ) : activeView === 'Settings' ? (
              showLoginGate ? (
                <LoginSyncGate needsLogin onGoToLogin={goToLogin} onGoToSettings={goToSettings} isDarkMode={isDarkMode} />
              ) : (
                <Suspense fallback={suspenseFallback}>
                  <SettingsView
                    isDarkMode={isDarkMode}
                    onToggleDarkMode={handleToggleDarkMode}
                    onLeagueSynced={() => refreshAll()}
                  />
                </Suspense>
              )
            ) : activeView === 'Profile' ? (
              showLoginGate ? (
                <LoginSyncGate needsLogin onGoToLogin={goToLogin} onGoToSettings={goToSettings} isDarkMode={isDarkMode} />
              ) : (
                <Suspense fallback={suspenseFallback}><ProfileView isDarkMode={isDarkMode} onLogout={handleLogout} onNavigate={(view) => setActiveView(view as any)} /></Suspense>
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
              <Suspense fallback={suspenseFallback}>
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
              </Suspense>
            ) : activeView === 'Waivers' ? (
              showLoginGate ? (
                <LoginSyncGate needsLogin onGoToLogin={goToLogin} onGoToSettings={goToSettings} isDarkMode={isDarkMode} />
              ) : showSyncGate ? (
                <LoginSyncGate needsLogin={false} onGoToLogin={goToLogin} onGoToSettings={goToSettings} isDarkMode={isDarkMode} />
              ) : (
                <Suspense fallback={suspenseFallback}><WaiversView onPlayerClick={setSelectedPlayer} onViewAll={handleViewAllFromWaivers} isDarkMode={isDarkMode} /></Suspense>
              )
            ) : activeView === 'DraftRankings' ? (
              <Suspense fallback={suspenseFallback}><DraftRankingsView onPlayerClick={setSelectedPlayer} isDarkMode={isDarkMode} /></Suspense>
            ) : activeView === 'LeagueAnalyzer' ? (
              <ComingSoonView title="League Analyzer" description="Deep dive into your league with power rankings, strength of schedule analysis, and roster composition breakdowns." icon="league" isDarkMode={isDarkMode} />
            ) : activeView === 'TradeAnalyzer' ? (
              <Suspense fallback={suspenseFallback}><TradeAnalyzerShell isDarkMode={isDarkMode} /></Suspense>
            ) : activeView === 'Admin' ? (
              user?.role === 'admin' ? (
                <Suspense fallback={suspenseFallback}><AdminView isDarkMode={isDarkMode} /></Suspense>
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                  <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Access Denied</h2>
                  <p className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>You don't have permission to view this page.</p>
                  <button onClick={() => setActiveView('Home')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Go Home
                  </button>
                </div>
              )
            ) : activeView === 'Pricing' ? (
              <Suspense fallback={suspenseFallback}><PricingView isDarkMode={isDarkMode} userTier={user?.subscriptionTier as 'free' | 'pro' | 'elite'} isAuthenticated={isAuthenticated} onNavigate={(view) => setActiveView(view as any)} /></Suspense>
            ) : activeView === 'Articles' ? (
              <Suspense fallback={suspenseFallback}>
                <ArticlesView
                  isDarkMode={isDarkMode}
                  onNavigate={(view) => setActiveView(view as any)}
                  onArticleSelect={(slug) => { setArticleSlug(slug); setActiveView('ArticleDetail'); }}
                />
              </Suspense>
            ) : activeView === 'ArticleDetail' && articleSlug ? (
              <Suspense fallback={suspenseFallback}>
                <ArticleDetailView
                  slug={articleSlug}
                  isDarkMode={isDarkMode}
                  onBack={() => { setArticleSlug(null); setActiveView('Articles'); }}
                  onArticleSelect={(slug) => { setArticleSlug(slug); }}
                  onNavigate={(view) => setActiveView(view as any)}
                />
              </Suspense>
            ) : activeView === 'Privacy' ? (
              <Suspense fallback={suspenseFallback}><PrivacyPolicyView isDarkMode={isDarkMode} /></Suspense>
            ) : activeView === 'Terms' ? (
              <Suspense fallback={suspenseFallback}><TermsOfServiceView isDarkMode={isDarkMode} /></Suspense>
            ) : activeView === 'CookiePolicy' ? (
              <Suspense fallback={suspenseFallback}><CookiePolicyView isDarkMode={isDarkMode} /></Suspense>
            ) : activeView === 'DMCA' ? (
              <Suspense fallback={suspenseFallback}><DMCAView isDarkMode={isDarkMode} /></Suspense>
            ) : activeView === 'Refunds' ? (
              <Suspense fallback={suspenseFallback}><RefundPolicyView isDarkMode={isDarkMode} /></Suspense>
            ) : activeView === 'DoNotSell' ? (
              <Suspense fallback={suspenseFallback}><DoNotSellView isDarkMode={isDarkMode} /></Suspense>
            ) : activeView === 'Disclaimer' ? (
              <Suspense fallback={suspenseFallback}><DisclaimerView isDarkMode={isDarkMode} /></Suspense>
            ) : activeView === 'Accessibility' ? (
              <Suspense fallback={suspenseFallback}><AccessibilityView isDarkMode={isDarkMode} /></Suspense>
            ) : activeView === 'AcceptableUse' ? (
              <Suspense fallback={suspenseFallback}><AcceptableUseView isDarkMode={isDarkMode} /></Suspense>
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
          <AppFooter isDarkMode={isDarkMode} onNavigate={(view) => setActiveView(view as any)} />
        </main>
      </div>

      {/* Cookie consent banner — shown on first visit until user chooses */}
      <CookieConsentBanner
        isDarkMode={isDarkMode}
        onNavigate={(view) => setActiveView(view as any)}
        offsetForSidebar
      />

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
