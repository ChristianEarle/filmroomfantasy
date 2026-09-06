import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  /** Optional click handler — only rendered as a button for non-terminal items */
  onClick?: () => void;
}

/**
 * Section (App activeView key) → breadcrumb label chain.
 * Mirrors the Sidebar group/item structure so crumbs read like the nav.
 */
const SECTION_TRAILS: Record<string, string[]> = {
  Home: ['Home'],
  Board: ['Rankings', 'Player Rankings'],
  Trends: ['Rankings', 'Trends'],
  DraftRankings: ['Rankings', 'Draft Rankings'],
  AllPlayers: ['Rankings', 'Player Rankings', 'All Players'],
  Team: ['League', 'Team'],
  Matchup: ['League', 'Matchup'],
  Waivers: ['League', 'Waivers'],
  Playoffs: ['League', 'Playoff Predictor'],
  LeagueAnalyzer: ['League', 'League Analyzer'],
  GameSlate: ['Tools', 'Game Slate'],
  Articles: ['Tools', 'Articles'],
  TradeAnalyzer: ['Trade Analyzer'],
};

/** Resolve a section key to a breadcrumb item chain (falls back to the raw key). */
export function breadcrumbTrail(section: string): BreadcrumbItem[] {
  return (SECTION_TRAILS[section] ?? [section]).map((label) => ({ label }));
}

interface BreadcrumbProps {
  /** Explicit item chain — takes precedence over `section` */
  items?: BreadcrumbItem[];
  /** App section key (e.g. "Board") mapped via the built-in trail map */
  section?: string;
  isDarkMode: boolean;
  className?: string;
}

/**
 * Small breadcrumb trail rendered above view headers,
 * e.g. "Rankings / Player Rankings". Micro-label styling per the design
 * standard: 10px uppercase, positive tracking, muted with a bright leaf.
 */
export function Breadcrumb({ items, section, isDarkMode, className = '' }: BreadcrumbProps) {
  const resolved = items ?? (section ? breadcrumbTrail(section) : []);
  if (resolved.length === 0) return null;

  const muted = isDarkMode ? 'text-slate-500' : 'text-slate-400';
  const leaf = isDarkMode ? 'text-slate-300' : 'text-slate-600';

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1">
        {resolved.map((item, i) => {
          const isLast = i === resolved.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className={`w-3 h-3 ${muted}`} aria-hidden="true" />}
              {item.onClick && !isLast ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className={`fr-text-10 font-semibold uppercase fr-tracking-wider transition-colors ${muted} ${
                    isDarkMode ? 'hover:text-slate-300' : 'hover:text-slate-600'
                  }`}
                >
                  {item.label}
                </button>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={`fr-text-10 font-semibold uppercase fr-tracking-wider ${isLast ? leaf : muted}`}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
