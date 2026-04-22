import { useState, useEffect } from 'react';
import { Home, LayoutDashboard, TrendingUp, Settings, Swords, Users as UsersIcon, ListPlus, CalendarRange, Trophy, CreditCard, BookOpen, ArrowLeftRight, ShieldCheck, Medal, BarChart3, FileText, ChevronDown, ChartNoAxesCombined, Shield, Wrench } from 'lucide-react';
import { LeagueManager } from './LeagueManager';

type SidebarView = 'Board' | 'Team' | 'Matchup' | 'Waivers' | 'Home' | 'GameSlate' | 'Trends' | 'Research' | 'Playoffs' | 'DraftRankings' | 'TradeAnalyzer' | 'LeagueAnalyzer' | 'Settings' | 'Pricing' | 'Admin' | 'Articles' | 'ArticleDetail';

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  view: SidebarView;
  comingSoon: boolean;
}

interface MenuGroup {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  items: MenuItem[];
}

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
  // Top-level items (always visible)
  const topItems: MenuItem[] = [
    { icon: Home, label: 'Home', view: 'Home', comingSoon: false },
    { icon: ArrowLeftRight, label: 'Trade Analyzer', view: 'TradeAnalyzer', comingSoon: false },
  ];

  // Collapsible groups
  const groups: MenuGroup[] = [
    {
      icon: ChartNoAxesCombined,
      label: 'Rankings',
      items: [
        { icon: LayoutDashboard, label: 'Player Rankings', view: 'Board', comingSoon: false },
        { icon: TrendingUp, label: 'Trends', view: 'Trends', comingSoon: false },
        { icon: Medal, label: 'Draft Rankings', view: 'DraftRankings', comingSoon: false },
      ],
    },
    {
      icon: Shield,
      label: 'League',
      items: [
        { icon: UsersIcon, label: 'Team', view: 'Team', comingSoon: false },
        { icon: Swords, label: 'Matchup', view: 'Matchup', comingSoon: false },
        { icon: ListPlus, label: 'Waivers', view: 'Waivers', comingSoon: false },
        { icon: Trophy, label: 'Playoff Predictor', view: 'Playoffs', comingSoon: false },
        { icon: BarChart3, label: 'League Analyzer', view: 'LeagueAnalyzer', comingSoon: true },
      ],
    },
    {
      icon: Wrench,
      label: 'Tools',
      items: [
        { icon: CalendarRange, label: 'Game Slate', view: 'GameSlate', comingSoon: false },
        { icon: BookOpen, label: 'Research', view: 'Research', comingSoon: true },
        { icon: FileText, label: 'Articles', view: 'Articles', comingSoon: false },
      ],
    },
  ];

  // Bottom items (always visible, separated)
  const bottomItems: MenuItem[] = [
    { icon: CreditCard, label: 'Pricing', view: 'Pricing', comingSoon: false },
    { icon: Settings, label: 'Settings', view: 'Settings', comingSoon: false },
    ...(isAdmin ? [{ icon: ShieldCheck, label: 'Admin', view: 'Admin' as SidebarView, comingSoon: false }] : []),
  ];

  // Auto-expand the group that contains the active view
  const activeGroup = groups.find((g) => g.items.some((item) => item.view === activeView));
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (activeGroup) initial.add(activeGroup.label);
    return initial;
  });

  // Auto-expand group when navigating to a child view (e.g. browser back/forward)
  useEffect(() => {
    if (activeGroup && !expandedGroups.has(activeGroup.label)) {
      setExpandedGroups((prev) => new Set(prev).add(activeGroup.label));
    }
  }, [activeView]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleNavClick = (view: SidebarView) => {
    onViewChange(view);
    onMobileClose?.();
  };

  const renderItem = (item: MenuItem) => (
    <button
      onClick={() => handleNavClick(item.view)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        item.view === activeView
          ? 'bg-blue-600 text-white shadow-sm'
          : isDarkMode
            ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <item.icon className="w-5 h-5" />
      <span className="text-sm font-medium">{item.label}</span>
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
  );

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-mobile-backdrop md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside className={`w-64 border-r z-mobile-sidebar flex flex-col ${mobileOpen ? 'sidebar-open' : 'sidebar-responsive'} ${isDarkMode ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'}`}>
        {/* Logo */}
        <div className={`h-14 sm:h-16 flex items-center px-6 border-b flex-shrink-0 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <button
            onClick={() => handleNavClick('Home')}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <img src="/logo.png" alt="FilmRoom logo" className="w-9 h-9 rounded-lg object-contain" />
            <span className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>FilmRoom</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {/* Top-level items */}
          <ul className="space-y-0.5">
            {topItems.map((item) => (
              <li key={item.view}>{renderItem(item)}</li>
            ))}
          </ul>

          {/* Collapsible groups */}
          <ul className="mt-1 space-y-0.5">
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.label);
            const hasActiveChild = group.items.some((item) => item.view === activeView);
            const GroupIcon = group.icon;

            return (
              <li key={group.label}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isDarkMode
                      ? `text-slate-400 hover:bg-slate-800 hover:text-white ${hasActiveChild && !isExpanded ? 'text-blue-400' : ''}`
                      : `text-slate-600 hover:bg-slate-100 hover:text-slate-900 ${hasActiveChild && !isExpanded ? 'text-blue-600' : ''}`
                  }`}
                >
                  <GroupIcon className="w-5 h-5" />
                  <span className="text-sm font-medium">{group.label}</span>
                  <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                {isExpanded && (
                  <ul className="mt-0.5 space-y-0.5 pl-4">
                    {group.items.map((item) => (
                      <li key={item.view}>{renderItem(item)}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
          </ul>

          {/* Bottom items */}
          <div className={`mt-4 pt-3 border-t space-y-1 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            {bottomItems.map((item) => renderItem(item))}
          </div>
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
