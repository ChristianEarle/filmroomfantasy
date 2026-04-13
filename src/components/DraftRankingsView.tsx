import { useState, useEffect, useMemo, useCallback } from 'react';
import { Medal, Loader2, Search, ChevronDown, ArrowUp, ArrowDown, Minus, Info } from 'lucide-react';
import { Player } from '../App';
import { useLeagueContext } from '../context/LeagueContext';
import api from '../services/api';
import { PlayerAvatar } from './PlayerAvatar';

// ── Types ───────────────────────────────────────────────────────────

interface DraftRankingPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  age: number | null;
  yearsExp: number | null;
  status: string;
  injuryNote: string | null;
  headshotUrl: string | null;
  externalId: string | null;
}

interface DraftRanking {
  id: string;
  overallRank: number;
  positionRank: number;
  tier: number;
  projectedPoints: number | null;
  adp: number | null;
  adpDelta: number | null;
  rationale: string;
  analysis: string | null;
  generatedAt: string;
  player: DraftRankingPlayer;
}

interface DraftRankingsResponse {
  rankings: DraftRanking[];
  meta: {
    rankingType: string;
    scoringFormat: string;
    superflex: boolean;
    season: number;
    count: number;
    generatedAt: string | null;
  };
}

interface DraftRankingsViewProps {
  onPlayerClick: (player: Player) => void;
  isDarkMode: boolean;
}

// ── Constants ───────────────────────────────────────────────────────

type RankingType = 'redraft' | 'dynasty_rookie';
type ScoringFormat = 'ppr' | 'half-ppr' | 'standard';
type PositionFilter = 'ALL' | 'QB' | 'RB' | 'WR' | 'TE';

const TIER_LABELS: Record<string, Record<number, string>> = {
  redraft: {
    1: 'Elite',
    2: 'High-End Starters',
    3: 'Solid Starters',
    4: 'Starter-Quality',
    5: 'Flex-Worthy',
    6: 'Bench Upside',
    7: 'Late-Round Fliers',
    8: 'Deep Sleepers',
  },
  dynasty_rookie: {
    1: 'Top Picks',
    2: 'Strong Starters',
    3: 'Solid Picks',
    4: 'Upside Picks',
    5: 'Dart Throws',
  },
};

const TIER_COLORS: Record<number, { dark: string; light: string }> = {
  1: { dark: 'bg-amber-500/10 border-amber-500/30', light: 'bg-amber-50 border-amber-200' },
  2: { dark: 'bg-blue-500/10 border-blue-500/30', light: 'bg-blue-50 border-blue-200' },
  3: { dark: 'bg-green-500/10 border-green-500/30', light: 'bg-green-50 border-green-200' },
  4: { dark: 'bg-purple-500/10 border-purple-500/30', light: 'bg-purple-50 border-purple-200' },
  5: { dark: 'bg-slate-500/10 border-slate-500/30', light: 'bg-slate-50 border-slate-200' },
  6: { dark: 'bg-slate-500/10 border-slate-500/20', light: 'bg-slate-50 border-slate-200' },
  7: { dark: 'bg-slate-500/10 border-slate-500/20', light: 'bg-slate-50 border-slate-200' },
  8: { dark: 'bg-slate-500/10 border-slate-500/20', light: 'bg-slate-50 border-slate-200' },
};

const POSITION_COLORS: Record<string, string> = {
  QB: 'text-red-400',
  RB: 'text-green-400',
  WR: 'text-blue-400',
  TE: 'text-orange-400',
};

// ── Component ───────────────────────────────────────────────────────

export function DraftRankingsView({ onPlayerClick, isDarkMode }: DraftRankingsViewProps) {
  const { league } = useLeagueContext();

  // Derive defaults from connected league
  const defaultScoring: ScoringFormat = (league?.scoringFormat as ScoringFormat) || 'ppr';
  const defaultSuperflex = (league as any)?.hasSuperflex ?? false;

  const [rankingType, setRankingType] = useState<RankingType>('redraft');
  const [scoringFormat, setScoringFormat] = useState<ScoringFormat>(defaultScoring);
  const [superflex, setSuperflex] = useState(defaultSuperflex);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRationale, setExpandedRationale] = useState<string | null>(null);
  const [rankings, setRankings] = useState<DraftRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sf = superflex ? '1' : '0';
      const season = new Date().getFullYear();
      const data = await api.get<DraftRankingsResponse>(
        `/draft-rankings?type=${rankingType}&scoring=${scoringFormat}&superflex=${sf}&season=${season}`,
      );
      setRankings(data.rankings);
      setGeneratedAt(data.meta.generatedAt);
    } catch (err) {
      console.error('Failed to fetch draft rankings:', err);
      setError('Failed to load draft rankings');
      setRankings([]);
    } finally {
      setLoading(false);
    }
  }, [rankingType, scoringFormat, superflex]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  // Filter and group by tier
  const filteredRankings = useMemo(() => {
    let filtered = rankings;
    if (positionFilter !== 'ALL') {
      filtered = filtered.filter(r => r.player.position === positionFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        r => r.player.name.toLowerCase().includes(q) || r.player.team.toLowerCase().includes(q),
      );
    }
    return filtered;
  }, [rankings, positionFilter, searchQuery]);

  const tierGroups = useMemo(() => {
    const groups = new Map<number, DraftRanking[]>();
    for (const r of filteredRankings) {
      const tier = r.tier;
      const list = groups.get(tier) || [];
      list.push(r);
      groups.set(tier, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [filteredRankings]);

  const handlePlayerClick = useCallback((ranking: DraftRanking) => {
    const p = ranking.player;
    onPlayerClick({
      id: p.id,
      rank: ranking.overallRank,
      name: p.name,
      team: p.team,
      position: p.position as Player['position'],
      keyLine: ranking.rationale,
      projectedPoints: ranking.projectedPoints ?? 0,
      weekChange: 0,
      headshotUrl: p.headshotUrl,
    });
  }, [onPlayerClick]);

  const tierLabels = TIER_LABELS[rankingType] || TIER_LABELS.redraft;

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-blue-600/20' : 'bg-blue-50'}`}>
          <Medal className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
        </div>
        <div>
          <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Draft Rankings
          </h1>
          {generatedAt && (
            <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Updated {new Date(generatedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Ranking Type Tabs */}
        <div className={`inline-flex rounded-lg p-0.5 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
          {(['redraft', 'dynasty_rookie'] as RankingType[]).map(type => (
            <button
              key={type}
              onClick={() => setRankingType(type)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                rankingType === type
                  ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 shadow-sm'
                  : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {type === 'redraft' ? 'Redraft' : 'Dynasty Rookie'}
            </button>
          ))}
        </div>

        {/* Scoring Format */}
        <div className="relative">
          <select
            value={scoringFormat}
            onChange={e => setScoringFormat(e.target.value as ScoringFormat)}
            className={`appearance-none pl-3 pr-8 py-1.5 text-sm font-medium rounded-lg border cursor-pointer ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <option value="ppr">PPR</option>
            <option value="half-ppr">Half PPR</option>
            <option value="standard">Standard</option>
          </select>
          <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
        </div>

        {/* Superflex Toggle */}
        <button
          onClick={() => setSuperflex(!superflex)}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
            superflex
              ? isDarkMode ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700'
              : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
          }`}
        >
          Superflex {superflex ? 'ON' : 'OFF'}
        </button>

        {/* Position Filter */}
        <div className={`inline-flex rounded-lg p-0.5 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
          {(['ALL', 'QB', 'RB', 'WR', 'TE'] as PositionFilter[]).map(pos => (
            <button
              key={pos}
              onClick={() => setPositionFilter(pos)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                positionFilter === pos
                  ? isDarkMode ? 'bg-slate-600 text-white' : 'bg-white text-slate-900 shadow-sm'
                  : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative ml-auto">
          <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            type="text"
            placeholder="Search player..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={`pl-8 pr-3 py-1.5 text-sm rounded-lg border w-48 ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500'
                : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-400'
            }`}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className={`w-8 h-8 animate-spin ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          <p className={`mt-3 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Loading rankings...
          </p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className={`text-sm ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
        </div>
      ) : rankings.length === 0 ? (
        <EmptyState rankingType={rankingType} isDarkMode={isDarkMode} />
      ) : filteredRankings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            No players match your filters.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {tierGroups.map(([tier, players]) => (
            <TierGroup
              key={tier}
              tier={tier}
              label={tierLabels[tier] || `Tier ${tier}`}
              rankings={players}
              rankingType={rankingType}
              isDarkMode={isDarkMode}
              expandedRationale={expandedRationale}
              onToggleRationale={id => setExpandedRationale(prev => prev === id ? null : id)}
              onPlayerClick={handlePlayerClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function EmptyState({ rankingType, isDarkMode }: { rankingType: RankingType; isDarkMode: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Medal className={`w-12 h-12 mb-4 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
      <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
        No {rankingType === 'dynasty_rookie' ? 'Dynasty Rookie' : 'Redraft'} Rankings Yet
      </h3>
      <p className={`text-sm max-w-md ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
        Rankings are generated by our AI and updated periodically. Check back soon for the latest rankings.
      </p>
    </div>
  );
}

function TierGroup({
  tier,
  label,
  rankings,
  rankingType,
  isDarkMode,
  expandedRationale,
  onToggleRationale,
  onPlayerClick,
}: {
  tier: number;
  label: string;
  rankings: DraftRanking[];
  rankingType: RankingType;
  isDarkMode: boolean;
  expandedRationale: string | null;
  onToggleRationale: (id: string) => void;
  onPlayerClick: (ranking: DraftRanking) => void;
}) {
  const colors = TIER_COLORS[tier] || TIER_COLORS[5];
  const colorClass = isDarkMode ? colors.dark : colors.light;

  return (
    <div>
      {/* Tier Header */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-2 ${colorClass}`}>
        <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
          TIER {tier}
        </span>
        <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {label}
        </span>
        <span className={`text-xs ml-auto ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {rankings.length} player{rankings.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Player Rows */}
      <div className="space-y-1">
        {rankings.map(ranking => (
          <PlayerRow
            key={ranking.id}
            ranking={ranking}
            rankingType={rankingType}
            isDarkMode={isDarkMode}
            isExpanded={expandedRationale === ranking.id}
            onToggleRationale={() => onToggleRationale(ranking.id)}
            onPlayerClick={() => onPlayerClick(ranking)}
          />
        ))}
      </div>
    </div>
  );
}

function PlayerRow({
  ranking,
  rankingType,
  isDarkMode,
  isExpanded,
  onToggleRationale,
  onPlayerClick,
}: {
  ranking: DraftRanking;
  rankingType: RankingType;
  isDarkMode: boolean;
  isExpanded: boolean;
  onToggleRationale: () => void;
  onPlayerClick: () => void;
}) {
  const p = ranking.player;
  const posColor = POSITION_COLORS[p.position] || 'text-slate-400';

  // ADP value indicator
  const adpDelta = ranking.adpDelta;
  let valueIndicator: React.ReactNode = null;
  if (adpDelta !== null && Math.abs(adpDelta) >= 3) {
    if (adpDelta < 0) {
      // Ranked HIGHER than ADP = value (they go before ADP says)
      valueIndicator = (
        <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-400" title={`Ranked ${Math.abs(adpDelta).toFixed(0)} spots above ADP — value pick`}>
          <ArrowUp className="w-3 h-3" />
          {Math.abs(adpDelta).toFixed(0)}
        </span>
      );
    } else {
      // Ranked LOWER than ADP = reach
      valueIndicator = (
        <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-400" title={`Ranked ${adpDelta.toFixed(0)} spots below ADP — potential reach`}>
          <ArrowDown className="w-3 h-3" />
          {adpDelta.toFixed(0)}
        </span>
      );
    }
  } else if (adpDelta !== null) {
    valueIndicator = (
      <span className="inline-flex items-center text-xs text-slate-500" title="Ranked near ADP">
        <Minus className="w-3 h-3" />
      </span>
    );
  }

  return (
    <div
      className={`group rounded-lg border transition-colors ${
        isDarkMode
          ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800'
          : 'bg-white border-slate-200 hover:bg-slate-50'
      }`}
    >
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
        onClick={onPlayerClick}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPlayerClick(); } }}
      >
        {/* Rank */}
        <span className={`w-8 text-center text-sm font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
          {ranking.overallRank}
        </span>

        {/* Avatar */}
        <div className={`w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
          <PlayerAvatar name={p.name} headshotUrl={p.headshotUrl} isDarkMode={isDarkMode} />
        </div>

        {/* Name & Position */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {p.name}
            </span>
            {p.status !== 'active' && (
              <span className="text-[10px] px-1 py-0.5 rounded bg-red-500/20 text-red-400 font-medium uppercase">
                {p.status === 'injured_reserve' ? 'IR' : p.status === 'questionable' ? 'Q' : p.status === 'doubtful' ? 'D' : 'OUT'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className={`font-medium ${posColor}`}>{p.position}{ranking.positionRank}</span>
            <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{p.team}</span>
            {p.age && (
              <span className={isDarkMode ? 'text-slate-600' : 'text-slate-300'}>
                Age {p.age}
              </span>
            )}
          </div>
        </div>

        {/* Projected Points */}
        {ranking.projectedPoints != null && (
          <div className="text-right hidden sm:block">
            <div className={`text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
              {ranking.projectedPoints.toFixed(1)}
            </div>
            <div className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              proj pts
            </div>
          </div>
        )}

        {/* ADP */}
        {ranking.adp != null && (
          <div className="text-right hidden sm:block">
            <div className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              {ranking.adp.toFixed(1)}
            </div>
            <div className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              ADP
            </div>
          </div>
        )}

        {/* Value Indicator */}
        <div className="w-10 text-center hidden sm:block">
          {valueIndicator}
        </div>

        {/* Rationale toggle */}
        <button
          onClick={e => { e.stopPropagation(); onToggleRationale(); }}
          className={`p-1 rounded-md transition-colors ${
            isDarkMode
              ? 'hover:bg-slate-700 text-slate-500 hover:text-slate-300'
              : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
          }`}
          title="View AI analysis"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expanded Analysis */}
      {isExpanded && (ranking.analysis || ranking.rationale) && (
        <div className={`px-3 pb-3 pt-0 ml-11`}>
          {ranking.analysis ? (
            <div className="space-y-1.5">
              <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                AI Analysis
              </p>
              <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {ranking.analysis}
              </p>
            </div>
          ) : (
            <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {ranking.rationale}
            </p>
          )}
          {/* Mobile-only: show projected points and ADP */}
          <div className="flex gap-4 mt-2 sm:hidden">
            {ranking.projectedPoints != null && (
              <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Proj: {ranking.projectedPoints.toFixed(1)} pts
              </span>
            )}
            {ranking.adp != null && (
              <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                ADP: {ranking.adp.toFixed(1)}
              </span>
            )}
            {valueIndicator && (
              <span className="text-xs">
                {valueIndicator}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
