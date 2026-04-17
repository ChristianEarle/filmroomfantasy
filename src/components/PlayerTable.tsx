import { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import { ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Search, Loader2, SearchX } from 'lucide-react';
import { Player } from '../App';
import { useLeagueContext } from '../context/LeagueContext';
import api from '../services/api';
import { useOdds } from '../hooks/useOdds';
import { usePlayerProps, formatPropLine } from '../hooks/usePlayerProps';
import { type APIPlayer, convertAPIPlayerToPlayer, getEffectiveSeason, scoringToFormat, NFL_WEEKS } from '../utils/playerUtils';
import { AdUnit } from './AdUnit';

// Memoized table row component to prevent unnecessary re-renders
interface PlayerRowProps {
  player: Player;
  onToggleExpand: (id: string) => void;
  onOpenCard: (player: Player) => void;
  isDarkMode: boolean;
  oddsData?: { homeTeam: string; awayTeam: string; homeSpread: number | null; total: number | null } | null;
  pointsType?: 'actual' | 'projected';
  propLine?: string | null;
  isOwned?: boolean;
  isExpanded?: boolean;
  /** Raw API seasonStats (week-scoped when the API returns week-specific stats) */
  seasonStats?: {
    passYards?: number;
    passTDs?: number;
    rushYards?: number;
    rushTDs?: number;
    receptions?: number;
    receivingYards?: number;
    receivingTDs?: number;
    fantasyPointsPPR?: number;
    gamesPlayed?: number;
  } | null;
  currentWeek: number;
}

const PlayerRow = memo(function PlayerRow({ player, onToggleExpand, onOpenCard, isDarkMode, oddsData, pointsType = 'projected', propLine, isOwned = false, isExpanded = false, seasonStats, currentWeek }: PlayerRowProps) {
  // Format odds display for this player's game
  const formatOdds = () => {
    if (!oddsData || oddsData.homeSpread === null || oddsData.total === null) {
      return null;
    }
    const isHome = oddsData.homeTeam === player.team;
    const spread = Math.abs(oddsData.homeSpread);
    const spreadSign = (isHome && oddsData.homeSpread < 0) || (!isHome && oddsData.homeSpread > 0) ? '-' : '+';
    return `${player.team} ${spreadSign}${spread} • O/U ${oddsData.total}`;
  };

  const oddsDisplay = formatOdds();

  return (
    <>
    <tr
      tabIndex={0}
      role="button"
      aria-expanded={isExpanded}
      onClick={() => onToggleExpand(player.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleExpand(player.id);
        }
      }}
      className={`border-b transition-colors cursor-pointer group ${
        isOwned
          ? isDarkMode
            ? 'border-slate-800 bg-blue-500/10 hover:bg-blue-500/15'
            : 'border-slate-100 bg-blue-50 hover:bg-blue-100'
          : isDarkMode
          ? 'border-slate-800 hover:bg-slate-800'
          : 'border-slate-100 hover:bg-slate-50'
      }`}
      style={isOwned ? { boxShadow: 'inset 3px 0 0 rgb(59, 130, 246)' } : undefined}
    >
      {/* # */}
      <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4">
        <span className={`font-medium text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{player.rank}</span>
      </td>

      {/* PLAYER (name + YOUR TEAM pill + team/pos subline) */}
      <td className="px-2 sm:px-4 py-3 sm:py-4">
        <div>
          <div className="flex items-center gap-1.5">
            <span className={`font-bold group-hover:text-blue-500 transition-colors ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.name}</span>
            {isOwned && (
              <span className="fr-text-9 font-bold uppercase fr-tracking-wider px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-500">
                YOUR TEAM
              </span>
            )}
          </div>
          <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {player.team} · {player.position}
            {oddsDisplay && (
              <div className={`text-xs ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                {oddsDisplay}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* PTS (actual points when available, else projection) */}
      <td className="px-2 sm:px-4 py-3 sm:py-4 text-right">
        <span className={`font-bold text-base sm:text-lg tabular-nums ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.projectedPoints.toFixed(1)}</span>
      </td>

      {/* PROJ (weekly projection) */}
      <td className="px-2 sm:px-4 py-3 sm:py-4 text-right hidden sm:table-cell">
        <span className={`text-sm tabular-nums ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {player.weeklyProjectedPoints != null ? player.weeklyProjectedPoints.toFixed(1) : '—'}
        </span>
      </td>

      {/* +/- (actual - projected, or projection movement) */}
      <td className="px-2 sm:px-4 py-3 sm:py-4 text-right hidden sm:table-cell">
        {pointsType === 'actual' && player.weeklyProjectedPoints !== undefined ? (
          (() => {
            const diff = player.projectedPoints - player.weeklyProjectedPoints;
            return (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm font-bold tabular-nums ${
                diff >= 0 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'
              }`}>
                {diff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
              </span>
            );
          })()
        ) : (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm font-bold tabular-nums ${
            player.weekChange >= 0 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'
          }`}>
            {player.weekChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {player.weekChange >= 0 ? '+' : ''}{player.weekChange.toFixed(1)}
          </span>
        )}
      </td>

      {/* OUTCOME — only for finalized weeks */}
      {pointsType === 'actual' && (
        <td className="px-2 sm:px-4 py-3 sm:py-4 text-center hidden md:table-cell">
          {player.weeklyProjectedPoints !== undefined && player.weeklyProjectedPoints > 0 ? (
            (() => {
              const delta = player.projectedPoints - player.weeklyProjectedPoints;
              const magnitude = Math.abs(delta);
              const projected = player.weeklyProjectedPoints;
              if (delta > 0 && magnitude >= projected * 0.4 && projected >= 3) {
                return (
                  <span className="fr-text-10 font-bold uppercase fr-tracking-wider px-2 py-1 rounded bg-emerald-500/15 text-emerald-500">
                    BOOM
                  </span>
                );
              }
              if (delta < 0 && magnitude >= projected * 0.4 && projected >= 10) {
                return (
                  <span className="fr-text-10 font-bold uppercase fr-tracking-wider px-2 py-1 rounded bg-red-500/15 text-red-500">
                    BUST
                  </span>
                );
              }
              return (
                <span className={`fr-text-10 font-bold uppercase fr-tracking-wider px-2 py-1 rounded ${
                  isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                }`}>
                  MET
                </span>
              );
            })()
          ) : (
            <span className={`fr-text-10 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>—</span>
          )}
        </td>
      )}

      {/* TREND (mini sparkline — deterministic from player id + delta direction) */}
      <td className="px-2 sm:px-4 py-3 sm:py-4 text-center hidden md:table-cell">
        {(() => {
          // Seeded pseudo-random points so the chart is stable across renders
          let h = 2166136261;
          for (let i = 0; i < player.id.length; i++) { h ^= player.id.charCodeAt(i); h = Math.imul(h, 16777619); }
          const dir = player.weekChange >= 0 ? 1 : -1;
          const pts: number[] = [];
          for (let i = 0; i < 8; i++) {
            const jitter = ((Math.sin(h + i * 9301) * 10000) % 1 + 1) % 1;
            pts.push(50 + dir * (i / 7) * 25 + (jitter - 0.5) * 10);
          }
          const min = Math.min(...pts);
          const max = Math.max(...pts);
          const range = max - min || 1;
          const w = 60, ht = 20;
          const path = pts.map((p, i) => {
            const x = (i / (pts.length - 1)) * w;
            const y = ht - ((p - min) / range) * ht;
            return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
          }).join(' ');
          const color = player.weekChange >= 0 ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)';
          return (
            <svg width={w} height={ht} viewBox={`0 0 ${w} ${ht}`} className="inline-block overflow-visible">
              <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          );
        })()}
      </td>

      {/* Chevron (rotates when expanded) */}
      <td className="px-2 py-3 sm:py-4 w-8 text-right">
        <ChevronRight
          className={`w-4 h-4 inline transition-transform ${isExpanded ? 'rotate-90' : ''} ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
        />
      </td>
    </tr>

    {isExpanded && (
      <tr
        className={`border-b ${
          isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50/70 border-slate-200'
        }`}
      >
        <td colSpan={pointsType === 'actual' ? 8 : 7} className="px-2 sm:px-4 md:px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Panel 1 — position-specific primary stats (PASSING / RUSHING / RECEIVING) */}
            {(() => {
              const pos = player.position;
              let label = 'STATS';
              let rows: Array<{ label: string; value: string }> = [];
              if (pos === 'QB') {
                label = 'PASSING';
                rows = [
                  { label: 'Pass Yds', value: String(seasonStats?.passYards ?? '—') },
                  { label: 'Pass TDs', value: String(seasonStats?.passTDs ?? '—') },
                  { label: 'Rush Yds', value: String(seasonStats?.rushYards ?? '—') },
                ];
              } else if (pos === 'RB') {
                label = 'RUSHING';
                rows = [
                  { label: 'Rush Yds', value: String(seasonStats?.rushYards ?? '—') },
                  { label: 'Rush TDs', value: String(seasonStats?.rushTDs ?? '—') },
                  { label: 'Rec', value: String(seasonStats?.receptions ?? '—') },
                ];
              } else if (pos === 'WR' || pos === 'TE') {
                label = 'RECEIVING';
                rows = [
                  { label: 'Rec', value: String(seasonStats?.receptions ?? '—') },
                  { label: 'Rec Yds', value: String(seasonStats?.receivingYards ?? '—') },
                  { label: 'Rec TDs', value: String(seasonStats?.receivingTDs ?? '—') },
                ];
              } else {
                label = 'STATS';
                rows = [{ label: 'FPts', value: seasonStats?.fantasyPointsPPR?.toFixed(1) ?? '—' }];
              }
              return (
                <div className={`rounded-lg p-3 border ${isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className={`fr-text-10 font-bold uppercase fr-tracking-wider mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{label}</div>
                  {rows.map((r) => (
                    <div key={r.label} className="flex justify-between items-baseline mb-1">
                      <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{r.label}</span>
                      <span className={`text-sm font-bold tabular-nums ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{r.value}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Panel 2 — secondary stats (varies by position) */}
            {(() => {
              const pos = player.position;
              let label = 'SECONDARY';
              let rows: Array<{ label: string; value: string }> = [];
              if (pos === 'QB') {
                label = 'RUSHING';
                rows = [
                  { label: 'Rush Yds', value: String(seasonStats?.rushYards ?? '—') },
                  { label: 'Rush TDs', value: String(seasonStats?.rushTDs ?? '—') },
                ];
              } else if (pos === 'RB') {
                label = 'RECEIVING';
                rows = [
                  { label: 'Rec Yds', value: String(seasonStats?.receivingYards ?? '—') },
                  { label: 'Rec TDs', value: String(seasonStats?.receivingTDs ?? '—') },
                ];
              } else if (pos === 'WR' || pos === 'TE') {
                label = 'EFFICIENCY';
                const rec = seasonStats?.receptions ?? 0;
                const yds = seasonStats?.receivingYards ?? 0;
                const ypr = rec > 0 ? (yds / rec).toFixed(1) : '—';
                rows = [
                  { label: 'Y/Rec', value: ypr },
                  { label: 'Total Yds', value: String(yds || '—') },
                ];
              } else {
                rows = [{ label: 'Games', value: String(seasonStats?.gamesPlayed ?? '—') }];
              }
              return (
                <div className={`rounded-lg p-3 border ${isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className={`fr-text-10 font-bold uppercase fr-tracking-wider mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{label}</div>
                  {rows.map((r) => (
                    <div key={r.label} className="flex justify-between items-baseline mb-1">
                      <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{r.label}</span>
                      <span className={`text-sm font-bold tabular-nums ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{r.value}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Panel 3 — Week summary */}
            <div className={`rounded-lg p-3 border ${isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className={`fr-text-10 font-bold uppercase fr-tracking-wider mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                {pointsType === 'actual' ? 'WEEK SUMMARY' : 'PROJECTION'}
              </div>
              <div className={`text-2xl font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {player.projectedPoints.toFixed(1)}
              </div>
              <div className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {pointsType === 'actual' ? `${player.position} · Week ${currentWeek}` : `${player.position} · Proj Wk ${currentWeek}`}
              </div>
              {pointsType === 'actual' && player.weeklyProjectedPoints != null && (
                <div className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Proj was <b className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>{player.weeklyProjectedPoints.toFixed(1)}</b>
                </div>
              )}
            </div>

            {/* Panel 4 — FilmRoom take + actions */}
            <div className={`rounded-lg p-3 border ${isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className={`fr-text-10 font-bold uppercase fr-tracking-wider mb-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                ★ FILMROOM AI
              </div>
              <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                {player.keyLine || 'Tap "Full game log" for the full weekly breakdown and trends.'}
                {propLine && <span className={`block mt-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{propLine}</span>}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenCard(player);
                  }}
                  className={`flex-1 text-xs font-semibold py-1.5 rounded-md border transition-colors ${
                    isDarkMode
                      ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-600'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  Full game log
                </button>
              </div>
            </div>
          </div>
        </td>
      </tr>
    )}
    </>
  );
});

interface PlayerTableProps {
  selectedScoring: 'PPR' | 'Half PPR' | 'Standard';
  onScoringChange: (scoring: 'PPR' | 'Half PPR' | 'Standard') => void;
  selectedPosition: string;
  onPositionChange: (position: string) => void;
  currentWeek: number;
  onWeekChange: (week: number) => void;
  onPlayerClick: (player: Player) => void;
  onViewAll: () => void;
  isDarkMode: boolean;
}

type SortField = 'rank' | 'name' | 'position' | 'projectedPoints' | 'weekChange';
type SortDirection = 'asc' | 'desc';

export function PlayerTable({
  selectedScoring,
  onScoringChange,
  selectedPosition,
  onPositionChange,
  currentWeek,
  onWeekChange,
  onPlayerClick,
  onViewAll,
  isDarkMode,
}: PlayerTableProps) {
  const { league, roster } = useLeagueContext();
  // Owned-player ids — used to highlight rows the current user rosters.
  const ownedPlayerIds = useMemo(() => new Set((roster ?? []).map((r) => r.id)), [roster]);
  const scoringOptions: Array<'PPR' | 'Half PPR' | 'Standard'> = ['PPR', 'Half PPR', 'Standard'];
  const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF'];

  const [sortField, setSortField] = useState<SortField>('projectedPoints');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [showWeekDropdown, setShowWeekDropdown] = useState(false);
  const [players, setPlayers] = useState<APIPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [pointsType, setPointsType] = useState<'actual' | 'projected'>('projected');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // Map converted Player.id -> raw APIPlayer.seasonStats for the expand panel
  const apiPlayerById = useMemo(() => {
    const m = new Map<string, APIPlayer>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);
  const weekDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch odds and player props for the current week
  const season = 2025;
  const { odds } = useOdds(currentWeek, season);
  const { getPropsForPlayer } = usePlayerProps(currentWeek, season);

  // Helper to find odds for a player's team
  const getOddsForTeam = (teamAbbr: string) => {
    return odds.find(o => o.homeTeam === teamAbbr || o.awayTeam === teamAbbr) || null;
  };

  // BUG-006 fix: Close week dropdown when clicking outside
  useEffect(() => {
    if (!showWeekDropdown) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (weekDropdownRef.current && !weekDropdownRef.current.contains(event.target as Node)) {
        setShowWeekDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showWeekDropdown]);

  const seasonYear = getEffectiveSeason(league?.seasonYear);
  const scoringFormat = scoringToFormat(selectedScoring);

  // Fetch players from API
  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '500',
        includeStats: 'true',
        sortBy: 'projectedPoints',
        sortOrder: 'desc',
        week: String(currentWeek),
        season: String(seasonYear),
        scoringFormat,
      });

      if (selectedPosition !== 'ALL' && selectedPosition !== 'FLEX') {
        params.set('position', selectedPosition);
      }

      if (league?.id) {
        params.set('leagueId', league.id);
      }

      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const response = await api.get<{
        players?: APIPlayer[];
        pagination?: { page: number; limit: number; total: number; totalPages: number };
        weekComplete?: boolean;
        pointsType?: 'actual' | 'projected';
      }>(`/players?${params.toString()}`);

      const playersList = Array.isArray(response?.players) ? response.players : [];
      const pagination = response?.pagination;
      setPlayers(playersList);
      setTotalPlayers(pagination?.total ?? playersList.length);
      setPointsType(response?.pointsType ?? 'projected');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch players';
      setError(errorMessage);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [selectedPosition, league?.id, searchQuery, currentWeek, seasonYear, scoringFormat]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-500" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 text-blue-400" />
      : <ArrowDown className="w-3 h-3 text-blue-400" />;
  };

  // Convert API player to display format (uses shared utility)

  const sortedAndFilteredPlayers = useMemo(() => {
    let filtered = players;

    // Apply FLEX filter (includes RB, WR, TE)
    if (selectedPosition === 'FLEX') {
      filtered = filtered.filter(p => p.position === 'RB' || p.position === 'WR' || p.position === 'TE');
    }

    // BUG-003 fix: Tighten fuzzy API results with strict client-side filtering.
    // Only keep players whose name or team actually contains the search query.
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)
      );
    }

    // Convert to display format
    const displayPlayers = filtered.map((p, i) => convertAPIPlayerToPlayer(p, i));

    // Apply sorting
    const sorted = [...displayPlayers].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'rank':
          comparison = a.rank - b.rank;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'position':
          comparison = a.position.localeCompare(b.position);
          break;
        case 'projectedPoints':
          comparison = a.projectedPoints - b.projectedPoints;
          break;
        case 'weekChange':
          comparison = a.weekChange - b.weekChange;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    // Limit to top 12 for display
    return sorted.slice(0, 12);
  }, [players, selectedPosition, searchQuery, sortField, sortDirection]);

  // ── Weekly callouts (BOOM / BUST / WK MVP) ──
  // Only meaningful when viewing an actual (finalized) week — need
  // both actual and projected points to compute over/under performance.
  const callouts = useMemo(() => {
    if (pointsType !== 'actual') return null;
    const pool = players
      .map((p, i) => convertAPIPlayerToPlayer(p, i))
      .filter((p) => p.weeklyProjectedPoints !== undefined && p.weeklyProjectedPoints > 0);
    if (pool.length === 0) return null;

    // Delta = actual - projected (positive = overperformed)
    const withDelta = pool.map((p) => ({
      player: p,
      delta: p.projectedPoints - (p.weeklyProjectedPoints ?? 0),
    }));

    // BOOM — biggest positive delta (with projection >= 5 to avoid 0-proj noise)
    const boomPool = withDelta.filter((x) => (x.player.weeklyProjectedPoints ?? 0) >= 3);
    const boom = boomPool.length > 0
      ? boomPool.reduce((best, x) => (x.delta > best.delta ? x : best))
      : null;

    // BUST — biggest negative delta (only for players projected to score meaningfully)
    const bustPool = withDelta.filter((x) => (x.player.weeklyProjectedPoints ?? 0) >= 10);
    const bust = bustPool.length > 0
      ? bustPool.reduce((worst, x) => (x.delta < worst.delta ? x : worst))
      : null;

    // WK MVP — highest actual score
    const mvp = pool.reduce((best, p) =>
      p.projectedPoints > best.projectedPoints ? p : best,
    );

    return { boom, bust, mvp };
  }, [players, pointsType]);

  const pill = (active: boolean, onClick: () => void, label: string) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all ${
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : isDarkMode
          ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-blue-600/20' : 'bg-blue-50'}`}>
            <svg className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="20" x2="12" y2="10" />
              <line x1="18" y1="20" x2="18" y2="4" />
              <line x1="6" y1="20" x2="6" y2="16" />
            </svg>
          </div>
          <div>
            <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Player Rankings
            </h1>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {seasonYear} Season · Week {currentWeek} {pointsType === 'actual' ? '(Final)' : '(Projections)'} · {pointsType === 'actual' ? 'Actual points scored' : 'Projected points'}
              {totalPlayers > 0 && <> · {totalPlayers} players</>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              // CSV export of currently-loaded players
              const rows = [
                ['Rank', 'Player', 'Pos', 'Team', 'Pts', 'Proj', '+/-'],
                ...sortedAndFilteredPlayers.map(p => [
                  String(p.rank),
                  p.name,
                  p.position,
                  p.team,
                  p.projectedPoints.toFixed(1),
                  (p.weeklyProjectedPoints ?? 0).toFixed(1),
                  (p.projectedPoints - (p.weeklyProjectedPoints ?? 0)).toFixed(1),
                ]),
              ];
              const csv = rows.map(r => r.map(c => /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `player-rankings-week${currentWeek}-${seasonYear}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
              isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            Export
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
            title="Ask AI about rankings (coming soon)"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></svg>
            Ask AI
          </button>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Scoring */}
        <div className="flex gap-1">
          {scoringOptions.map(opt => (
            <span key={opt}>{pill(selectedScoring === opt, () => onScoringChange(opt), opt)}</span>
          ))}
        </div>

        {/* Position */}
        <div className="flex gap-1 flex-wrap">
          {positions.map(pos => (
            <span key={pos}>{pill(selectedPosition === pos, () => onPositionChange(pos), pos)}</span>
          ))}
        </div>

        {/* Search (inline) */}
        <div className={`ml-auto flex items-center rounded-md border px-2 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <Search className={`w-3.5 h-3.5 flex-shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            id="player-search"
            type="text"
            placeholder="Player or team..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`py-1.5 px-2 bg-transparent text-xs focus:outline-none w-32 sm:w-40 ${isDarkMode ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'}`}
          />
        </div>

        {/* Week nav: prev / label / next + Full Season */}
        <div className={`inline-flex items-center rounded-md border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <button
            type="button"
            onClick={() => onWeekChange(Math.max(1, currentWeek - 1))}
            disabled={currentWeek <= 1}
            aria-label="Previous week"
            className={`px-2 py-1.5 disabled:opacity-40 ${isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <span className={`px-3 py-1.5 text-xs font-semibold border-x ${isDarkMode ? 'border-slate-700 text-white' : 'border-slate-200 text-slate-900'}`}>
            Week {currentWeek}
          </span>
          <button
            type="button"
            onClick={() => onWeekChange(Math.min(18, currentWeek + 1))}
            disabled={currentWeek >= 18}
            aria-label="Next week"
            className={`px-2 py-1.5 disabled:opacity-40 ${isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>

      {/* Boom / Bust / MVP callouts — only shown for finalized weeks */}
      {callouts && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              label: 'BOOM',
              icon: '🔥',
              color: 'text-emerald-500',
              bgColor: isDarkMode ? 'bg-emerald-500/15' : 'bg-emerald-50',
              borderColor: isDarkMode ? 'border-emerald-500/30' : 'border-emerald-200',
              entry: callouts.boom,
              deltaPrefix: '+',
              deltaColor: 'text-emerald-500',
            },
            {
              label: 'BUST',
              icon: '🧊',
              color: 'text-red-500',
              bgColor: isDarkMode ? 'bg-red-500/15' : 'bg-red-50',
              borderColor: isDarkMode ? 'border-red-500/30' : 'border-red-200',
              entry: callouts.bust,
              deltaPrefix: '',
              deltaColor: 'text-red-500',
            },
            {
              label: 'WK MVP',
              icon: '👑',
              color: 'text-amber-500',
              bgColor: isDarkMode ? 'bg-amber-500/15' : 'bg-amber-50',
              borderColor: isDarkMode ? 'border-amber-500/30' : 'border-amber-200',
              entry: { player: callouts.mvp, delta: null as number | null },
              deltaPrefix: '',
              deltaColor: isDarkMode ? 'text-white' : 'text-slate-900',
            },
          ].map((c) =>
            c.entry?.player ? (
              <div
                key={c.label}
                onClick={() => onPlayerClick(c.entry!.player)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onPlayerClick(c.entry!.player);
                  }
                }}
                className={`cursor-pointer rounded-xl border p-4 flex items-center gap-3 transition-colors ${
                  isDarkMode ? 'bg-slate-900 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${c.bgColor} ${c.borderColor}`}>
                  <span className="text-lg">{c.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`fr-text-10 uppercase fr-tracking-wider font-bold ${c.color}`}>
                    {c.label}
                  </div>
                  <div className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {c.entry.player.name}
                  </div>
                  <div className={`fr-text-11 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {c.entry.player.team} · {c.entry.player.position} · Proj {(c.entry.player.weeklyProjectedPoints ?? 0).toFixed(1)}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-xl font-extrabold ${c.deltaColor}`}>
                    {c.entry.player.projectedPoints.toFixed(1)}
                  </div>
                  {c.entry.delta !== null && (
                    <div className={`fr-text-11 font-bold ${c.deltaColor}`}>
                      {c.deltaPrefix}{c.entry.delta.toFixed(1)}
                    </div>
                  )}
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}

      {/* Table */}
      <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        {/* Table */}
        <div className="overflow-x-auto">
          {error ? (
            <div className={`m-4 p-4 rounded-lg ${isDarkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
              <p className="font-medium">Error loading players</p>
              <p className="text-sm opacity-80 mt-1">{error}</p>
              <button
                onClick={fetchPlayers}
                className="mt-3 px-4 py-2 text-sm font-medium rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" aria-label="Loading players" />
            </div>
          ) : (
            <table className="w-full border-collapse" role="grid" aria-label="Player rankings">
              <thead>
                <tr className={`border-b ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <th
                    scope="col"
                    onClick={() => handleSort('rank')}
                    aria-sort={sortField === 'rank' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`text-left px-2 sm:px-4 md:px-6 py-3 sm:py-4 text-xs font-semibold cursor-pointer transition-colors w-10 sm:w-16 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    <div className="flex items-center gap-1.5">
                      #
                      {getSortIcon('rank')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('name')}
                    aria-sort={sortField === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`text-left px-2 sm:px-4 py-3 sm:py-4 text-xs font-semibold cursor-pointer transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    <div className="flex items-center gap-1.5">
                      PLAYER
                      {getSortIcon('name')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('projectedPoints')}
                    aria-sort={sortField === 'projectedPoints' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`text-right px-2 sm:px-4 py-3 sm:py-4 text-xs font-semibold cursor-pointer transition-colors w-20 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    <div className="flex items-center gap-1.5 justify-end">
                      PTS
                      {getSortIcon('projectedPoints')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className={`text-right px-2 sm:px-4 py-3 sm:py-4 text-xs font-semibold w-20 hidden sm:table-cell ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
                  >
                    PROJ
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('weekChange')}
                    aria-sort={sortField === 'weekChange' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`text-right px-2 sm:px-4 py-3 sm:py-4 text-xs font-semibold cursor-pointer transition-colors w-20 hidden sm:table-cell ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    <div className="flex items-center gap-1.5 justify-end">
                      +/-
                      {getSortIcon('weekChange')}
                    </div>
                  </th>
                  {pointsType === 'actual' && (
                    <th
                      scope="col"
                      className={`text-center px-2 sm:px-4 py-3 sm:py-4 text-xs font-semibold w-24 hidden md:table-cell ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
                    >
                      OUTCOME
                    </th>
                  )}
                  <th
                    scope="col"
                    className={`text-center px-2 sm:px-4 py-3 sm:py-4 text-xs font-semibold w-20 hidden md:table-cell ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
                  >
                    TREND
                  </th>
                  <th scope="col" className="w-8" aria-label="Expand" />
                </tr>
              </thead>
              <tbody>
                {sortedAndFilteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={pointsType === 'actual' ? 7 : 6} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <SearchX className={`w-10 h-10 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                        <p className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          {searchQuery.trim()
                            ? `No players found for "${searchQuery}"`
                            : `No player data available for Week ${currentWeek}`}
                        </p>
                        <p className={`text-xs max-w-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          {searchQuery.trim()
                            ? 'Check the spelling or try a different player name or team abbreviation.'
                            : 'Projections for this week may not be available yet. Try selecting a different week.'}
                        </p>
                        {searchQuery.trim() && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="mt-1 px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                          >
                            Clear search
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedAndFilteredPlayers.map((player) => {
                    const playerProps = getPropsForPlayer(player.name);
                    const propLine = playerProps ? formatPropLine(playerProps.props, player.position) : null;
                    return (
                      <PlayerRow
                        key={player.id}
                        player={player}
                        onToggleExpand={toggleExpand}
                        onOpenCard={onPlayerClick}
                        isDarkMode={isDarkMode}
                        oddsData={getOddsForTeam(player.team)}
                        pointsType={pointsType}
                        propLine={propLine}
                        isOwned={ownedPlayerIds.has(player.id)}
                        isExpanded={expandedId === player.id}
                        seasonStats={apiPlayerById.get(player.id)?.seasonStats ?? null}
                        currentWeek={currentWeek}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Table Footer */}
        {!error && totalPlayers > 0 && (
          <div className={`px-6 py-4 border-t ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Showing top {Math.min(12, totalPlayers)} of {totalPlayers} players
                </span>
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Stats from current season
                </p>
              </div>
              <button
                onClick={onViewAll}
                className="text-sm text-blue-500 hover:text-blue-400 font-semibold transition-colors"
              >
                View more players →
              </button>
            </div>
          </div>
        )}

        {/* AdSense Ad Unit — only when table has substantial content */}
        {!error && totalPlayers >= 10 && (
          <div className="my-4 rounded-lg overflow-hidden px-6">
            <div className={`text-[10px] text-slate-600 text-center mb-1`}>Ad</div>
            <AdUnit slot="board-below-table" isDarkMode={isDarkMode} />
          </div>
        )}
      </div>
    </div>
  );
}
