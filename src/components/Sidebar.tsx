import { Home, LayoutDashboard, TrendingUp, Settings, Swords, Users as UsersIcon, ListPlus, CalendarRange, Trophy, CreditCard, BookOpen, ArrowLeftRight, ShieldCheck, Medal, BarChart3 } from 'lucide-react';
import { LeagueManager } from './LeagueManager';

type SidebarView = 'Board' | 'Team' | 'Matchup' | 'Waivers' | 'Home' | 'GameSlate' | 'Trends' | 'Research' | 'Playoffs' | 'DraftRankings' | 'TradeAnalyzer' | 'LeagueAnalyzer' | 'Settings' | 'Pricing' | 'Admin' | 'Articles' | 'ArticleDetail';

interface SidebarProps {
  activeView: SidebarView | 'Profile' | 'Login';
  onViewChange: (view: SidebarView) => void;
  isDarkMode: boolean;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
  selectedLeagueId: string | null;
  onLeagueSelect: (leagueId: string) => void;
  onConnectLeague: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  userTier?: 'free' | 'pro';
}

export function Sidebar({ activeView, onViewChange, isDarkMode, isAuthenticated = false, isAdmin = false, selectedLeagueId, onLeagueSelect, onConnectLeague, mobileOpen = false, onMobileClose, userTier = 'free' }: SidebarProps) {
  const menuItems = [
    { icon: Home, label: 'Home', view: 'Home' as const, comingSoon: false },
    { icon: LayoutDashboard, label: 'Player Rankings', view: 'Board' as const, comingSoon: false },
    { icon: Swords, label: 'Matchup', view: 'Matchup' as const, comingSoon: false },
    { icon: UsersIcon, label: 'Team', view: 'Team' as const, comingSoon: false },
    { icon: ListPlus, label: 'Waivers', view: 'Waivers' as const, comingSoon: false },
    { icon: CalendarRange, label: 'Game Slate', view: 'GameSlate' as const, comingSoon: false },
    { icon: TrendingUp, label: 'Trends', view: 'Trends' as const, comingSoon: false },
    { icon: BookOpen, label: 'Research', view: 'Research' as const, comingSoon: true },
    { icon: BarChart3, label: 'League Analyzer', view: 'LeagueAnalyzer' as const, comingSoon: true },
    { icon: Medal, label: 'Draft Rankings', view: 'DraftRankings' as const, comingSoon: true },
    { icon: ArrowLeftRight, label: 'Trade Analyzer', view: 'TradeAnalyzer' as const, comingSoon: false },
    { icon: Trophy, label: 'Playoff Predictor', view: 'Playoffs' as const, comingSoon: false },
    { icon: CreditCard, label: 'Pricing', view: 'Pricing' as const, comingSoon: false },
    { icon: Settings, label: 'Settings', view: 'Settings' as const, comingSoon: false },
    ...(isAdmin ? [{ icon: ShieldCheck, label: 'Admin', view: 'Admin' as const, comingSoon: false }] : []),
  ];

  const handleNavClick = (view: SidebarView) => {
    onViewChange(view);
    onMobileClose?.();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside className={`w-64 border-r z-50 flex flex-col ${mobileOpen ? 'sidebar-open' : 'sidebar-responsive'} ${isDarkMode ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'}`}>
        {/* Logo */}
        <div className={`h-14 sm:h-16 flex items-center px-6 border-b flex-shrink-0 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>FilmRoom</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {menuItems.map((item, index) => (
              <li key={index}>
                <button
                  onClick={() => handleNavClick(item.view)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    item.view === activeView
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isDarkMode
                        ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className={`text-sm font-medium`}>{item.label}</span>
                  {item.comingSoon && (
                    <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${
                      item.view === activeView
                        ? 'bg-white/20 text-white'
                        : isDarkMode
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-amber-100 text-amber-600'
                    }`}>
                      SOON
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* League Manager */}
        <LeagueManager
          isDarkMode={isDarkMode}
          isAuthenticated={isAuthenticated}
          selectedLeagueId={selectedLeagueId}
          onLeagueSelect={onLeagueSelect}
          onConnectLeague={onConnectLeague}
          userTier={userTier}
        />
      </aside>
    </>
  );
}
