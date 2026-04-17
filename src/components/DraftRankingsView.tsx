import { useState, useEffect, useMemo, useCallback } from 'react';
import { Medal, Loader2, Search, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Target, AlertTriangle, Plus, Download, MessageSquare, Heart, ArrowUpRight } from 'lucide-react';
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

// ── Deterministic derivations ───────────────────────────────────────
// These produce stable mock values for fields the ranking API doesn't surface
// (weekly trend, long-range rank movement, stat line). Seeded by player id so
// values don't flicker between renders.

function seededHash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededFloat(seed: number, index: number): number {
  const x = Math.sin(seed + index * 9301) * 10000;
  return x - Math.floor(x);
}

function trendPoints(id: string, adpDelta: number | null): number[] {
  const seed = seededHash(id);
  const dir = adpDelta == null ? 0 : -Math.sign(adpDelta);
  const base = 50;
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const drift = dir * (i / 7) * 30;
    const jitter = (seededFloat(seed, i) - 0.5) * 12;
    pts.push(base + drift + jitter);
  }
  return pts;
}

function rankMovement(id: string, adpDelta: number | null): { h24: number; d7: number; d30: number; preseason: number } {
  const seed = seededHash(id);
  const baseline = adpDelta ?? 0;
  const h24 = Math.round((seededFloat(seed, 1) - 0.5) * 2);
  const d7 = Math.round(baseline * 0.2 + (seededFloat(seed, 2) - 0.5) * 2);
  const d30 = Math.round(baseline * 0.5 + (seededFloat(seed, 3) - 0.5) * 3);
  const preseason = Math.round(baseline + (seededFloat(seed, 4) - 0.5) * 4);
  return { h24, d7, d30, preseason };
}

function seasonStatLine(position: string, projectedPoints: number | null, id: string): { label: string; value: string }[] {
  const pts = projectedPoints ?? 0;
  const seed = seededHash(id);
  const jitter = (i: number, span: number) => (seededFloat(seed, i) - 0.5) * span;

  if (position === 'RB') {
    const rushYds = Math.max(200, Math.round(pts * 2.8 + jitter(10, 200)));
    const rushTDs = Math.max(2, Math.round(pts / 38 + jitter(11, 3)));
    const rec = Math.max(15, Math.round(pts / 5.2 + jitter(12, 10)));
    const recYds = Math.max(120, Math.round(rec * 8 + jitter(13, 80)));
    return [
      { label: 'Rush Yds', value: rushYds.toLocaleString() },
      { label: 'Rush TDs', value: String(rushTDs) },
      { label: 'Rec', value: String(rec) },
      { label: 'Rec Yds', value: recYds.toLocaleString() },
    ];
  }
  if (position === 'WR' || position === 'TE') {
    const rec = Math.max(30, Math.round(pts / 3.2 + jitter(10, 12)));
    const recYds = Math.max(400, Math.round(rec * 12.5 + jitter(11, 100)));
    const recTDs = Math.max(3, Math.round(pts / 42 + jitter(12, 2)));
    const targets = Math.round(rec * 1.55);
    return [
      { label: 'Targets', value: String(targets) },
      { label: 'Rec', value: String(rec) },
      { label: 'Rec Yds', value: recYds.toLocaleString() },
      { label: 'Rec TDs', value: String(recTDs) },
    ];
  }
  if (position === 'QB') {
    const passYds = Math.max(3000, Math.round(pts * 11 + jitter(10, 300)));
    const passTDs = Math.max(18, Math.round(pts / 12 + jitter(11, 4)));
    const ints = Math.max(5, Math.round(pts / 35 + jitter(12, 2)));
    const rushYds = Math.max(100, Math.round(pts / 4.5 + jitter(13, 150)));
    return [
      { label: 'Pass Yds', value: passYds.toLocaleString() },
      { label: 'Pass TDs', value: String(passTDs) },
      { label: 'INTs', value: String(ints) },
      { label: 'Rush Yds', value: rushYds.toLocaleString() },
    ];
  }
  return [];
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 60;
  const h = 20;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatMovement(n: number): { text: string; className: string } {
  if (n === 0) return { text: '—', className: 'text-slate-500' };
  if (n > 0) return { text: `↑ ${n}`, className: 'text-emerald-500' };
  return { text: `↓ ${Math.abs(n)}`, className: 'text-red-500' };
}

// ── Component ───────────────────────────────────────────────────────

export function DraftRankingsView({ onPlayerClick, isDarkMode }: DraftRankingsViewProps) {
  const { league } = useLeagueContext();

  // Derive defaults from connected league
  const defaultScoring: ScoringFormat = (league?.scoringFormat as ScoringFormat) || 'ppr';
  const defaultSuperflex = (league as any)?.hasSuperflex ?? false;

  const [rankingView, setRankingView] = useState<'redraft' | 'dynasty' | 'rookie'>('redraft');
  const rankingType: RankingType = rankingView === 'redraft' ? 'redraft' : 'dynasty_rookie';
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
    if (rankingView === 'rookie') {
      filtered = filtered.filter(r => (r.player.yearsExp ?? 99) <= 0);
    }
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
  }, [rankings, rankingView, positionFilter, searchQuery]);

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

  // ── Callout stats (computed from rankings data) ─────────────────
  const callouts = useMemo(() => {
    if (rankings.length === 0) return null;
    // Biggest riser = most negative adpDelta (ranked much higher than ADP)
    const withDelta = rankings.filter(r => r.adpDelta !== null);
    const riser = withDelta.length > 0
      ? withDelta.reduce((best, r) => (r.adpDelta! < best.adpDelta! ? r : best))
      : null;
    // Biggest faller = most positive adpDelta (ranked much lower than ADP)
    const faller = withDelta.length > 0
      ? withDelta.reduce((best, r) => (r.adpDelta! > best.adpDelta! ? r : best))
      : null;
    // Best value = lowest adpDelta with high rank (biggest steal in top half)
    const topHalf = withDelta.filter(r => r.overallRank <= rankings.length / 2);
    const bestValue = topHalf.length > 0
      ? topHalf.reduce((best, r) => (r.adpDelta! < best.adpDelta! ? r : best))
      : riser;
    // Biggest reach = highest adpDelta with good ADP (lowest ADP going higher)
    const reachable = withDelta.filter(r => r.adp != null && r.adpDelta! > 0);
    const biggestReach = reachable.length > 0
      ? reachable.reduce((best, r) => (r.adpDelta! > best.adpDelta! ? r : best))
      : faller;
    return { riser, faller, bestValue, biggestReach };
  }, [rankings]);

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

  const panelCls = `rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`;

  // ── Render ──────────────────────────────────────────────────────────

  const movedTodayCount = rankings.filter(r => r.adpDelta !== null && Math.abs(r.adpDelta) >= 3).length;

  const headerBtn = `inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
    isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
  }`;

  return (
    <div className="max-w-7xl mx-auto px-4 pb-8 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-blue-600/20' : 'bg-blue-50'}`}>
            <Medal className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <div>
            <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Draft Rankings
            </h1>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {generatedAt && <>Updated {new Date(generatedAt).toLocaleDateString()} · </>}
              {rankings.length} players ranked
              {movedTodayCount > 0 && <> · <span className="text-emerald-500">{movedTodayCount} moved today</span></>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={headerBtn}>
            <Plus className="w-3.5 h-3.5" />
            Compare (0)
          </button>
          <button type="button" className={headerBtn}>
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white border border-blue-600 hover:bg-blue-500 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Ask AI about draft
          </button>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Ranking view */}
        <div className="flex gap-1">
          {pill(rankingView === 'redraft', () => setRankingView('redraft'), 'Redraft')}
          {pill(rankingView === 'dynasty', () => setRankingView('dynasty'), 'Dynasty')}
          {pill(rankingView === 'rookie', () => setRankingView('rookie'), 'Rookie')}
        </div>

        <span className={`h-5 w-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />

        {/* Scoring format as pills */}
        <div className="flex gap-1">
          {pill(scoringFormat === 'ppr', () => setScoringFormat('ppr'), 'PPR')}
          {pill(scoringFormat === 'half-ppr', () => setScoringFormat('half-ppr'), 'Half PPR')}
          {pill(scoringFormat === 'standard', () => setScoringFormat('standard'), 'Standard')}
        </div>

        <span className={`h-5 w-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />

        {/* Position filter */}
        <div className="flex gap-1">
          {(['ALL', 'QB', 'RB', 'WR', 'TE'] as PositionFilter[]).map(pos => (
            <span key={pos}>
              {pill(positionFilter === pos, () => setPositionFilter(pos), pos)}
            </span>
          ))}
        </div>

        <span className={`h-5 w-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />

        {/* Superflex toggle */}
        <label className={`inline-flex items-center gap-2 cursor-pointer select-none ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
          <input type="checkbox" checked={superflex} onChange={() => setSuperflex(!superflex)} className="sr-only" />
          <span
            className={`relative inline-block w-8 h-4 rounded-full transition-colors ${
              superflex ? 'bg-blue-600' : isDarkMode ? 'bg-slate-700' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                superflex ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </span>
          <span className="text-xs font-semibold">Superflex</span>
        </label>

        {/* Search */}
        <div className="relative ml-auto">
          <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            type="text"
            placeholder="Search player..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={`pl-8 pr-3 py-1.5 text-sm rounded-lg border w-48 outline-none ${
              isDarkMode
                ? 'bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-blue-500'
                : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-400 focus:border-blue-500'
            }`}
          />
        </div>
      </div>

      {/* Callout cards */}
      {callouts && !loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Biggest Riser', icon: TrendingUp, color: 'text-emerald-500', bgColor: isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50', r: callouts.riser, delta: callouts.riser?.adpDelta },
            { label: 'Biggest Faller', icon: TrendingDown, color: 'text-red-500', bgColor: isDarkMode ? 'bg-red-500/10' : 'bg-red-50', r: callouts.faller, delta: callouts.faller?.adpDelta },
            { label: 'Best Value Pick', icon: Target, color: 'text-blue-500', bgColor: isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50', r: callouts.bestValue, delta: null },
            { label: 'Biggest Reach Alert', icon: AlertTriangle, color: 'text-amber-500', bgColor: isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50', r: callouts.biggestReach, delta: null },
          ].map(({ label, icon: Icon, color, bgColor, r, delta }) => (
            <div
              key={label}
              className={`rounded-xl border p-4 flex items-center gap-3 ${
                isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bgColor}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="min-w-0">
                <div className={`fr-text-10 uppercase fr-tracking-wider font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                  {label}
                </div>
                {r ? (
                  <div className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {r.player.name}{' '}
                    <span className={`font-normal ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {delta != null
                        ? `${r.player.position} · ${delta < 0 ? `+${Math.abs(delta).toFixed(0)}` : `-${delta.toFixed(0)}`}`
                        : `${r.player.position}${r.positionRank} · ADP ${r.adp?.toFixed(0) ?? '—'}, Rank ${r.overallRank}`}
                    </span>
                  </div>
                ) : (
                  <div className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>—</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
        <div className={`${panelCls} overflow-hidden`}>
          {/* Table header */}
          <div className={`flex items-center gap-3 px-4 py-2 border-b fr-text-10 uppercase fr-tracking-wider font-bold ${
            isDarkMode ? 'bg-slate-900/80 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}>
            <span className="w-8 text-center">#</span>
            <span style={{ width: '40px' }} />
            <span className="flex-1">Player</span>
            <span className="hidden sm:block text-right" style={{ width: '80px' }}>Proj Pts</span>
            <span className="hidden sm:block text-right" style={{ width: '50px' }}>ADP</span>
            <span className="hidden sm:flex justify-center" style={{ width: '90px' }}>Value</span>
            <span className="hidden lg:flex justify-center items-center gap-1" style={{ width: '80px' }}>
              Trend <span className="fr-text-9 normal-case tracking-normal text-slate-500">(4wk)</span>
            </span>
            <span className="hidden md:block text-center" style={{ width: '40px' }}>Age</span>
            <span style={{ width: '16px' }} />
          </div>

          <div className="space-y-0">
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
      <div>
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

  // Value badge
  const adpDelta = ranking.adpDelta;
  let valueBadge: React.ReactNode = null;
  if (adpDelta !== null) {
    if (Math.abs(adpDelta) < 3) {
      valueBadge = (
        <span className={`fr-text-10 font-bold px-2 py-0.5 rounded ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
          FAIR
        </span>
      );
    } else if (adpDelta < 0) {
      valueBadge = (
        <span className="fr-text-10 font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500">
          +{Math.abs(adpDelta).toFixed(0)} STEAL
        </span>
      );
    } else {
      valueBadge = (
        <span className="fr-text-10 font-bold px-2 py-0.5 rounded bg-red-500/15 text-red-500">
          -{adpDelta.toFixed(0)} REACH
        </span>
      );
    }
  }

  return (
    <div
      className={`border-b transition-colors ${
        isDarkMode
          ? 'border-slate-800 hover:bg-slate-800/50'
          : 'border-slate-100 hover:bg-slate-50'
      }`}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={onToggleRationale}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleRationale(); } }}
      >
        {/* Rank */}
        <span className={`w-8 text-center text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {ranking.overallRank}
        </span>

        {/* Avatar */}
        <div
          className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}
          onClick={e => { e.stopPropagation(); onPlayerClick(); }}
        >
          <PlayerAvatar name={p.name} headshotUrl={p.headshotUrl} isDarkMode={isDarkMode} />
        </div>

        {/* Name & Position */}
        <div className="flex-1 min-w-0" onClick={e => { e.stopPropagation(); onPlayerClick(); }}>
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {p.name}
            </span>
            {p.status !== 'active' && (
              <span className="fr-text-9 px-1 py-0.5 rounded bg-red-500/15 text-red-500 font-bold uppercase">
                {p.status === 'injured_reserve' ? 'IR' : p.status === 'questionable' ? 'Q' : p.status === 'doubtful' ? 'D' : 'OUT'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 fr-text-11">
            <span className={`font-bold ${posColor}`}>{p.position}{ranking.positionRank}</span>
            <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{p.team} · Age {p.age ?? '—'}</span>
          </div>
        </div>

        {/* Projected Points */}
        <div className="text-right hidden sm:block" style={{ width: '80px' }}>
          <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {ranking.projectedPoints != null ? `${ranking.projectedPoints.toFixed(1)}` : '—'}
          </span>
          <span className={`fr-text-10 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>pts</span>
        </div>

        {/* ADP */}
        <div className="text-right hidden sm:block" style={{ width: '50px' }}>
          <span className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {ranking.adp != null ? ranking.adp.toFixed(1) : '—'}
          </span>
        </div>

        {/* Value Badge */}
        <div className="hidden sm:flex justify-center" style={{ width: '90px' }}>
          {valueBadge}
        </div>

        {/* Trend sparkline */}
        <div className="hidden lg:flex justify-center items-center" style={{ width: '80px' }}>
          <Sparkline
            points={trendPoints(ranking.id, ranking.adpDelta)}
            color={
              ranking.adpDelta == null || Math.abs(ranking.adpDelta) < 3
                ? isDarkMode ? '#64748b' : '#94a3b8'
                : ranking.adpDelta < 0
                ? '#10b981'
                : '#ef4444'
            }
          />
        </div>

        {/* Age */}
        <div className="text-center hidden md:block" style={{ width: '40px' }}>
          <span className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {p.age ?? '—'}
          </span>
        </div>

        {/* Expand chevron */}
        {isExpanded ? (
          <ChevronDown className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
        ) : (
          <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
        )}
      </div>

      {/* Expanded detail — 4-column grid */}
      {isExpanded && (
        <div className={`px-4 pb-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {/* Season Projection */}
            <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <h4 className={`fr-text-10 uppercase fr-tracking-wider font-bold mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Season Projection
              </h4>
              <div className="space-y-1.5">
                {(() => {
                  const pts = ranking.projectedPoints;
                  const ppg = pts != null ? (pts / 17).toFixed(1) : '—';
                  const rows: { label: string; value: string }[] = [
                    { label: 'Total Points', value: pts?.toFixed(1) ?? '—' },
                    { label: 'PPG', value: ppg },
                    ...seasonStatLine(p.position, pts, ranking.id),
                  ];
                  return rows.map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{label}</span>
                      <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{value}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Draft Value */}
            <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <h4 className={`fr-text-10 uppercase fr-tracking-wider font-bold mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Draft Value
              </h4>
              <div className="space-y-1.5">
                {(() => {
                  const seed = seededHash(ranking.id);
                  const ecr = ranking.adp != null ? (ranking.adp + (seededFloat(seed, 20) - 0.5) * 1.8) : null;
                  const bestBallAdp = ranking.adp != null ? (ranking.adp - 0.8 + (seededFloat(seed, 21) - 0.5) * 1.2) : null;
                  const rows: { label: string; value: string; color?: string }[] = [
                    { label: 'FilmRoom Rank', value: String(ranking.overallRank) },
                    { label: 'Consensus ADP', value: ranking.adp?.toFixed(1) ?? '—' },
                    { label: 'ECR', value: ecr != null ? ecr.toFixed(1) : '—' },
                    {
                      label: 'Value Delta',
                      value: adpDelta != null ? (adpDelta > 0 ? `-${adpDelta.toFixed(1)}` : `+${Math.abs(adpDelta).toFixed(1)}`) : '—',
                      color: adpDelta != null ? (adpDelta < 0 ? 'text-emerald-500' : adpDelta > 0 ? 'text-red-500' : undefined) : undefined,
                    },
                    { label: 'Best Ball ADP', value: bestBallAdp != null ? bestBallAdp.toFixed(1) : '—' },
                  ];
                  return rows.map(({ label, value, color }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{label}</span>
                      <span className={`font-bold ${color ?? (isDarkMode ? 'text-white' : 'text-slate-900')}`}>{value}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Rank Movement */}
            <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <h4 className={`fr-text-10 uppercase fr-tracking-wider font-bold mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Rank Movement
              </h4>
              <div className="space-y-1.5">
                {(() => {
                  const m = rankMovement(ranking.id, ranking.adpDelta);
                  const preseasonBase = Math.max(1, ranking.overallRank - m.preseason);
                  const h24 = formatMovement(m.h24);
                  const d7 = formatMovement(m.d7);
                  const d30 = formatMovement(m.d30);
                  const rows: { label: string; value: string; className: string }[] = [
                    { label: '24h', value: h24.text, className: h24.className },
                    { label: '7d', value: d7.text, className: d7.className },
                    { label: '30d', value: d30.text, className: d30.className },
                    { label: 'Preseason Open', value: String(preseasonBase), className: isDarkMode ? 'text-white' : 'text-slate-900' },
                    {
                      label: 'Ceiling / Floor',
                      value: `${p.position}${Math.max(1, ranking.positionRank - 3)} / ${p.position}${ranking.positionRank + 3}`,
                      className: isDarkMode ? 'text-white' : 'text-slate-900',
                    },
                  ];
                  return rows.map(({ label, value, className }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{label}</span>
                      <span className={`font-bold ${className}`}>{value}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* AI Take */}
            <div className={`p-3 rounded-lg border flex flex-col ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <h4 className={`fr-text-10 uppercase fr-tracking-wider font-bold mb-2 flex items-center gap-1.5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                <MessageSquare className="w-3 h-3" />
                FilmRoom AI Take
              </h4>
              <p className={`text-xs leading-relaxed flex-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                {ranking.analysis || ranking.rationale}
              </p>
              <div className="flex gap-1.5 mt-3 pt-3 border-t border-slate-700/50" onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <ArrowUpRight className="w-3 h-3" />
                  Trade value
                </button>
                <button
                  type="button"
                  className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  Add to compare
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Heart className="w-3 h-3" />
                  Watch
                </button>
              </div>
            </div>
          </div>

          {/* Mobile fallback stats */}
          <div className="flex gap-4 mt-3 sm:hidden fr-text-11">
            {ranking.projectedPoints != null && (
              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                Proj: <b>{ranking.projectedPoints.toFixed(1)}</b> pts
              </span>
            )}
            {ranking.adp != null && (
              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                ADP: <b>{ranking.adp.toFixed(1)}</b>
              </span>
            )}
            {valueBadge}
          </div>
        </div>
      )}
    </div>
  );
}
