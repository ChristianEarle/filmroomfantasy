import { useState, useEffect, useRef } from 'react';
import { Home, LayoutDashboard, TrendingUp, Settings, Swords, Users as UsersIcon, ListPlus, CalendarRange, Trophy, CreditCard, ArrowLeftRight, ShieldCheck, Medal, BarChart3, FileText, ChevronDown, ChartNoAxesCombined, Shield, Wrench } from 'lucide-react';
import { LeagueManager } from './LeagueManager';

type SidebarView = 'Board' | 'Team' | 'Matchup' | 'Waivers' | 'Home' | 'GameSlate' | 'Trends' | 'Playoffs' | 'DraftRankings' | 'TradeAnalyzer' | 'LeagueAnalyzer' | 'Settings' | 'Pricing' | 'Admin' | 'Articles' | 'ArticleDetail' | 'PlayerProfile';

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  view: SidebarView;
}

interface MenuGroup {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  items: MenuItem[];
}

interface SidebarProps {
  activeView: SidebarView | 'Profile' | 'Login' | (string & {});
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

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Sidebar({ activeView, onViewChange, isDarkMode, isAuthenticated = false, isAdmin = false, selectedLeagueId, onLeagueSelect, onConnectLeague, mobileOpen = false, onMobileClose, userTier = 'free' }: SidebarProps) {
  const asideRef = useRef<HTMLElement>(null);

  // Mobile drawer only: force-close if the viewport crosses into the desktop
  // breakpoint while open, so a resize/rotation can't leave a fixed-position
  // overlay stuck on top of the desktop layout with no way to dismiss it.
  useEffect(() => {
    if (!mobileOpen) return;
    const mql = window.matchMedia('(min-width: 768px)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) onMobileClose?.();
    };
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [mobileOpen, onMobileClose]);

  // Mobile drawer only: Escape to close, Tab trapped within the drawer,
  // and focus restored to whatever opened it on close — matches the same
  // pattern used by the app's modals (e.g. GameDetailModal).
  useEffect(() => {
    if (!mobileOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    asideRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onMobileClose?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = asideRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !root.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [mobileOpen, onMobileClose]);

  // Top-level items (always visible)
  const topItems: MenuItem[] = [
    { icon: Home, label: 'Home', view: 'Home' },
    { icon: ArrowLeftRight, label: 'Trade Analyzer', view: 'TradeAnalyzer' },
  ];

  // Collapsible groups
  const groups: MenuGroup[] = [
    {
      icon: ChartNoAxesCombined,
      label: 'Rankings',
      items: [
        { icon: LayoutDashboard, label: 'Player Rankings', view: 'Board' },
        { icon: TrendingUp, label: 'Trends', view: 'Trends' },
        { icon: Medal, label: 'Draft Rankings', view: 'DraftRankings' },
      ],
    },
    {
      icon: Shield,
      label: 'League',
      items: [
        { icon: UsersIcon, label: 'Team', view: 'Team' },
        { icon: Swords, label: 'Matchup', view: 'Matchup' },
        { icon: ListPlus, label: 'Waivers', view: 'Waivers' },
        { icon: Trophy, label: 'Playoff Predictor', view: 'Playoffs' },
        { icon: BarChart3, label: 'League Analyzer', view: 'LeagueAnalyzer' },
      ],
    },
    {
      icon: Wrench,
      label: 'Tools',
      items: [
        { icon: CalendarRange, label: 'Game Slate', view: 'GameSlate' },
        { icon: FileText, label: 'Articles', view: 'Articles' },
      ],
    },
  ];

  // Bottom items (always visible, separated)
  const bottomItems: MenuItem[] = [
    { icon: CreditCard, label: 'Pricing', view: 'Pricing' },
    { icon: Settings, label: 'Settings', view: 'Settings' },
    ...(isAdmin ? [{ icon: ShieldCheck, label: 'Admin', view: 'Admin' as SidebarView }] : []),
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
      aria-current={item.view === activeView ? 'page' : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        item.view === activeView
          ? 'bg-blue-600 text-white'
          : isDarkMode
            ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <item.icon className="w-5 h-5" />
      <span className="text-sm font-medium">{item.label}</span>
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

      <aside
        ref={asideRef}
        tabIndex={-1}
        className={`w-64 border-r z-mobile-sidebar flex flex-col outline-none ${mobileOpen ? 'sidebar-open' : 'sidebar-responsive'} ${isDarkMode ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'}`}
      >
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
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4">
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
            const groupPanelId = `sidebar-group-${group.label.toLowerCase().replace(/\s+/g, '-')}`;

            return (
              <li key={group.label}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={isExpanded}
                  aria-controls={groupPanelId}
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
                  <ul id={groupPanelId} className="mt-0.5 space-y-0.5 pl-4">
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
