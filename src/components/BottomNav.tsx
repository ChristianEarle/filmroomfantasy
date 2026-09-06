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
      style={{ left: 0, right: 0 }}
      className={`bottom-nav-mobile z-mobile-bottomnav fixed inset-x-0 bottom-0 border-t ${
        isDarkMode ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'
      }`}
    >
      {/* Inline sizes: h-14 / text-[10px] / gap-0.5 / leading-none / min-w-[44px]
          are not in the precompiled src/index.css, so without these the labels
          rendered at 16px and ran into each other. */}
      <div className="flex items-stretch" style={{ height: 56, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.view;
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => onViewChange(item.view)}
              aria-current={isActive ? 'page' : undefined}
              style={{ minWidth: 44, gap: 3 }}
              className={`flex-1 flex flex-col items-center justify-center transition-colors duration-150 ${
                isActive
                  ? 'text-blue-500'
                  : isDarkMode
                    ? 'text-slate-400 active:text-slate-200'
                    : 'text-slate-500 active:text-slate-700'
              }`}
            >
              <item.icon className="w-5 h-5" aria-hidden="true" />
              <span className="font-medium" style={{ fontSize: 10, lineHeight: 1 }}>{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onMoreClick}
          aria-label="More navigation options"
          style={{ minWidth: 44, gap: 3 }}
              className={`flex-1 flex flex-col items-center justify-center transition-colors duration-150 ${
            isDarkMode ? 'text-slate-400 active:text-slate-200' : 'text-slate-500 active:text-slate-700'
          }`}
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
          <span className="font-medium" style={{ fontSize: 10, lineHeight: 1 }}>More</span>
        </button>
      </div>
    </nav>
  );
}
