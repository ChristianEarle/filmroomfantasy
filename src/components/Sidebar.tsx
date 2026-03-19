import { Home, LayoutDashboard, TrendingUp, Settings, Swords, Users as UsersIcon, ListPlus, CalendarRange, Trophy } from 'lucide-react';
import { LeagueManager } from './LeagueManager';

type SidebarView = 'Board' | 'Team' | 'Matchup' | 'Waivers' | 'Home' | 'GameSlate' | 'Trends' | 'Playoffs' | 'DraftRankings' | 'TradeAnalyzer' | 'Settings';

interface SidebarProps {
  activeView: SidebarView | 'Profile' | 'Login';
  onViewChange: (view: SidebarView) => void;
  isDarkMode: boolean;
  isAuthenticated?: boolean;
  selectedLeagueId: string | null;
  onLeagueSelect: (leagueId: string) => void;
  onConnectLeague: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ activeView, onViewChange, isDarkMode, isAuthenticated = false, selectedLeagueId, onLeagueSelect, onConnectLeague, mobileOpen = false, onMobileClose }: SidebarProps) {
  const menuItems = [
    { icon: Home, label: 'Home', view: 'Home' as const },
    { icon: LayoutDashboard, label: 'Board', view: 'Board' as const },
    { icon: Swords, label: 'Matchup', view: 'Matchup' as const },
    { icon: UsersIcon, label: 'Team', view: 'Team' as const },
    { icon: ListPlus, label: 'Waivers', view: 'Waivers' as const },
    { icon: CalendarRange, label: 'Game Slate', view: 'GameSlate' as const },
    { icon: TrendingUp, label: 'Trends', view: 'Trends' as const },
    { icon: Trophy, label: 'Playoff Predictor', view: 'Playoffs' as const },
    { icon: Settings, label: 'Settings', view: 'Settings' as const },
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

      <aside className={`w-64 border-r z-50 ${mobileOpen ? 'sidebar-open' : 'sidebar-responsive'} ${isDarkMode ? 'bg-[#0a0a0a] border-[#222]' : 'bg-white border-slate-200'}`}>
        {/* Logo */}
        <div className={`h-16 flex items-center px-6 border-b ${isDarkMode ? 'border-[#222]' : 'border-slate-200'}`}>
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    item.view === activeView
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isDarkMode
                        ? 'text-[#737373] hover:bg-[#1a1a1a] hover:text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className={`text-sm ${item.view === activeView ? 'font-semibold' : ''}`}>{item.label}</span>
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
        />
      </aside>
    </>
  );
}
