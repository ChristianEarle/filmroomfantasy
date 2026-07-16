import { Home, LayoutDashboard, Swords, Users as UsersIcon, Menu } from 'lucide-react';

type BottomNavView = 'Home' | 'Board' | 'Matchup' | 'Team';

interface BottomNavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  view: BottomNavView;
}

const NAV_ITEMS: BottomNavItem[] = [
  { icon: Home, label: 'Home', view: 'Home' },
  { icon: LayoutDashboard, label: 'Rankings', view: 'Board' },
  { icon: Swords, label: 'Matchup', view: 'Matchup' },
  { icon: UsersIcon, label: 'Team', view: 'Team' },
];

interface BottomNavProps {
  /** Current active view from App.tsx — compared against each item's view. */
  activeView: string;
  onViewChange: (view: BottomNavView) => void;
  /** Opens the sidebar drawer (the existing mobile-open mechanism). */
  onMoreClick: () => void;
  isDarkMode: boolean;
}

/**
 * Fixed bottom tab bar shown only on mobile (< md). Mirrors the top-level
 * Sidebar destinations plus a "More" entry that opens the sidebar drawer for
 * everything else. Hidden entirely at the md breakpoint and up, where the
 * persistent Sidebar already provides navigation.
 */
export function BottomNav({ activeView, onViewChange, onMoreClick, isDarkMode }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary mobile navigation"
      className={`bottom-nav-mobile z-mobile-bottomnav fixed inset-x-0 bottom-0 border-t ${
        isDarkMode ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex items-stretch h-14">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.view;
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => onViewChange(item.view)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 min-w-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors duration-150 ${
                isActive
                  ? 'text-blue-500'
                  : isDarkMode
                    ? 'text-slate-400 active:text-slate-200'
                    : 'text-slate-500 active:text-slate-700'
              }`}
            >
              <item.icon className="w-5 h-5" aria-hidden="true" />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onMoreClick}
          aria-label="More navigation options"
          className={`flex-1 min-w-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors duration-150 ${
            isDarkMode ? 'text-slate-400 active:text-slate-200' : 'text-slate-500 active:text-slate-700'
          }`}
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
          <span className="text-[10px] font-medium leading-none">More</span>
        </button>
      </div>
    </nav>
  );
}
