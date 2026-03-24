import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ArrowRightLeft,
  Plus,
  X,
  Loader2,
  Trophy,
  Users,
  AlertCircle,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';

// ── Types ──────────────────────────────────────────────────────────────

interface TradeTeam {
  id: number;
  label: string;
  sends: TradeAsset[];
}

interface TradeAsset {
  id: string;
  type: 'player' | 'pick';
  name: string;
  position?: string;
  team?: string;
  /** Which team this asset goes TO (team id). Required for 3+ team trades. */
  destinationTeamId?: number;
}

interface TeamGrade {
  team: string;
  grade: string;
  summary: string;
}

interface TradeResult {
  winner: string;
  winnerExplanation: string;
  teamGrades: TeamGrade[];
}

type LeagueType = 'redraft' | 'dynasty' | 'keeper';
type TeamStrategy = 'win-now' | 'rebuilding' | 'balanced';

// ── Player Search ──────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  name: string;
  position: string;
  team: string;
}

function PlayerSearchInput({
  isDarkMode,
  onSelect,
  placeholder,
}: {
  isDarkMode: boolean;
  onSelect: (asset: TradeAsset) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  const showDropdown = isFocused && results.length > 0;

  // Clean up timeout on unmount
  useEffect(() => {
    return () => clearTimeout(blurTimeoutRef.current);
  }, []);

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const data = await api.get<{ players: SearchResult[] }>(
        `/players/search?q=${encodeURIComponent(q)}&limit=8`
      );
      setResults(data.players || []);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectPlayer = (p: SearchResult) => {
    onSelect({
      id: p.id,
      type: 'player',
      name: p.name,
      position: p.position,
      team: p.team,
    });
    setQuery('');
    setResults([]);
    setIsFocused(false);
  };

  // Use focusin/focusout on the container so focus moving between input and
  // dropdown buttons within the same container doesn't close the dropdown.
  const handleFocusIn = () => {
    clearTimeout(blurTimeoutRef.current);
    setIsFocused(true);
  };

  const handleFocusOut = (e: React.FocusEvent) => {
    // If focus is moving to another element within the container, stay open
    if (
      e.relatedTarget &&
      containerRef.current?.contains(e.relatedTarget as Node)
    ) {
      return;
    }
    // Small delay as a safety net for cases where relatedTarget is null
    // (e.g. clicking non-focusable areas then quickly back)
    blurTimeoutRef.current = setTimeout(() => {
      if (
        containerRef.current &&
        !containerRef.current.contains(document.activeElement)
      ) {
        setIsFocused(false);
      }
    }, 100);
  };

  // Handle click on the container to re-focus the input even if blur races
  const handleContainerMouseDown = (e: React.MouseEvent) => {
    // If clicking within the container (but not on a dropdown button),
    // prevent the blur from firing and keep focus on the input
    if (e.target === containerRef.current || e.target === inputRef.current) {
      return;
    }
    // For dropdown buttons, let them handle their own click
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onFocus={handleFocusIn}
      onBlur={handleFocusOut}
      onMouseDown={handleContainerMouseDown}
    >
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={placeholder || 'Search player...'}
          className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors ${
            isDarkMode
              ? 'bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500'
              : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
          } outline-none`}
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        )}
      </div>
      {showDropdown && (
        <div
          className={`absolute z-50 mt-1 w-full rounded-lg border shadow-lg max-h-48 overflow-y-auto ${
            isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'
          }`}
        >
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => selectPlayer(r)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                isDarkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-50 text-slate-800'
              }`}
            >
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  r.position === 'QB'
                    ? 'bg-red-500/20 text-red-400'
                    : r.position === 'RB'
                    ? 'bg-green-500/20 text-green-400'
                    : r.position === 'WR'
                    ? 'bg-blue-500/20 text-blue-400'
                    : r.position === 'TE'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-slate-500/20 text-slate-400'
                }`}
              >
                {r.position}
              </span>
              <span className="font-medium">{r.name}</span>
              <span className={`ml-auto text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {r.team}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Draft Pick Input ───────────────────────────────────────────────────

function DraftPickInput({
  isDarkMode,
  onAdd,
}: {
  isDarkMode: boolean;
  onAdd: (asset: TradeAsset) => void;
}) {
  const [year, setYear] = useState('2025');
  const [round, setRound] = useState('1');

  const handleAdd = () => {
    const ordinal =
      round === '1' ? '1st' : round === '2' ? '2nd' : round === '3' ? '3rd' : `${round}th`;
    onAdd({
      id: `pick-${year}-${round}-${Date.now()}`,
      type: 'pick',
      name: `${year} ${ordinal} Round Pick`,
    });
  };

  const selectClasses = `px-2 py-1.5 text-sm rounded-lg border transition-colors ${
    isDarkMode
      ? 'bg-slate-800 border-slate-600 text-white'
      : 'bg-white border-slate-300 text-slate-900'
  } outline-none`;

  return (
    <div className="flex items-center gap-2">
      <select value={year} onChange={(e) => setYear(e.target.value)} className={selectClasses}>
        {[2025, 2026, 2027, 2028].map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <select value={round} onChange={(e) => setRound(e.target.value)} className={selectClasses}>
        {[1, 2, 3, 4, 5].map((r) => (
          <option key={r} value={r}>
            Round {r}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleAdd}
        className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
      >
        Add Pick
      </button>
    </div>
  );
}

// ── Asset Chip ─────────────────────────────────────────────────────────

function AssetChip({
  asset,
  isDarkMode,
  onRemove,
  otherTeams,
  onDestinationChange,
  showDestination,
}: {
  asset: TradeAsset;
  isDarkMode: boolean;
  onRemove: () => void;
  otherTeams?: { id: number; label: string }[];
  onDestinationChange?: (destinationTeamId: number) => void;
  showDestination?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${
          asset.type === 'player'
            ? isDarkMode
              ? 'bg-blue-500/20 text-blue-300'
              : 'bg-blue-50 text-blue-700'
            : isDarkMode
            ? 'bg-amber-500/20 text-amber-300'
            : 'bg-amber-50 text-amber-700'
        }`}
      >
        {asset.position && (
          <span className="text-[10px] font-bold opacity-70">{asset.position}</span>
        )}
        {asset.name}
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 hover:opacity-70 transition-opacity"
        >
          <X className="w-3 h-3" />
        </button>
      </span>
      {showDestination && otherTeams && otherTeams.length > 0 && onDestinationChange && (
        <div className="flex items-center gap-1">
          <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>→</span>
          <div className="relative">
            <select
              value={asset.destinationTeamId ?? ''}
              onChange={(e) => onDestinationChange(Number(e.target.value))}
              className={`appearance-none pr-6 pl-2 py-0.5 text-xs rounded border transition-colors cursor-pointer ${
                asset.destinationTeamId != null
                  ? isDarkMode
                    ? 'bg-slate-700 border-slate-500 text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                  : isDarkMode
                  ? 'bg-slate-700 border-amber-500/50 text-amber-400'
                  : 'bg-amber-50 border-amber-300 text-amber-700'
              } outline-none`}
            >
              <option value="">Select team...</option>
              {otherTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-slate-400" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Trade Team Card ────────────────────────────────────────────────────

function TradeTeamCard({
  team,
  teamIndex,
  isDarkMode,
  allTeams,
  isMultiTeam,
  onAddAsset,
  onRemoveAsset,
  onLabelChange,
  onAssetDestinationChange,
}: {
  team: TradeTeam;
  teamIndex: number;
  isDarkMode: boolean;
  allTeams: TradeTeam[];
  isMultiTeam: boolean;
  onAddAsset: (teamId: number, asset: TradeAsset) => void;
  onRemoveAsset: (teamId: number, assetId: string) => void;
  onLabelChange: (teamId: number, label: string) => void;
  onAssetDestinationChange: (teamId: number, assetId: string, destinationTeamId: number) => void;
}) {
  const [showPickInput, setShowPickInput] = useState(false);
  const colors = [
    { border: 'border-blue-500/30', bg: isDarkMode ? 'bg-blue-500/5' : 'bg-blue-50/50', accent: 'text-blue-500' },
    { border: 'border-emerald-500/30', bg: isDarkMode ? 'bg-emerald-500/5' : 'bg-emerald-50/50', accent: 'text-emerald-500' },
    { border: 'border-purple-500/30', bg: isDarkMode ? 'bg-purple-500/5' : 'bg-purple-50/50', accent: 'text-purple-500' },
    { border: 'border-orange-500/30', bg: isDarkMode ? 'bg-orange-500/5' : 'bg-orange-50/50', accent: 'text-orange-500' },
  ];
  const color = colors[teamIndex % colors.length];

  const otherTeams = allTeams
    .filter((t) => t.id !== team.id)
    .map((t) => ({ id: t.id, label: t.label || `Team ${t.id + 1}` }));

  return (
    <div className={`rounded-xl border ${color.border} ${color.bg} p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <Users className={`w-4 h-4 ${color.accent}`} />
        <input
          type="text"
          value={team.label}
          onChange={(e) => onLabelChange(team.id, e.target.value)}
          placeholder={`Team ${teamIndex + 1}`}
          className={`text-sm font-semibold bg-transparent border-none outline-none w-full ${
            isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
          }`}
        />
      </div>

      <p className={`text-xs mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        Sends away:
      </p>

      {/* Current assets */}
      {team.sends.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3">
          {team.sends.map((asset) => (
            <AssetChip
              key={asset.id}
              asset={asset}
              isDarkMode={isDarkMode}
              onRemove={() => onRemoveAsset(team.id, asset.id)}
              otherTeams={otherTeams}
              showDestination={isMultiTeam}
              onDestinationChange={(destId) =>
                onAssetDestinationChange(team.id, asset.id, destId)
              }
            />
          ))}
        </div>
      )}

      {/* Add player */}
      <PlayerSearchInput
        key={`search-${team.id}`}
        isDarkMode={isDarkMode}
        onSelect={(asset) => onAddAsset(team.id, asset)}
        placeholder="Search player to add..."
      />

      {/* Add pick toggle */}
      <div className="mt-2">
        {showPickInput ? (
          <div className="space-y-2">
            <DraftPickInput
              isDarkMode={isDarkMode}
              onAdd={(asset) => {
                onAddAsset(team.id, asset);
                setShowPickInput(false);
              }}
            />
            <button
              type="button"
              onClick={() => setShowPickInput(false)}
              className={`text-xs ${isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-600'}`}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowPickInput(true)}
            className={`flex items-center gap-1 text-xs font-medium mt-1 transition-colors ${
              isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-600'
            }`}
          >
            <Plus className="w-3 h-3" /> Add Draft Pick
          </button>
        )}
      </div>
    </div>
  );
}

// ── Grade Badge ────────────────────────────────────────────────────────

function GradeBadge({ grade, isDarkMode }: { grade: string; isDarkMode: boolean }) {
  const gradeColor = (() => {
    const g = grade.toUpperCase();
    if (g.startsWith('A')) return isDarkMode ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-50 text-green-700 border-green-200';
    if (g.startsWith('B')) return isDarkMode ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200';
    if (g.startsWith('C')) return isDarkMode ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200';
    if (g.startsWith('D')) return isDarkMode ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-orange-50 text-orange-700 border-orange-200';
    return isDarkMode ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-50 text-red-700 border-red-200';
  })();

  return (
    <span className={`inline-flex items-center justify-center w-12 h-12 rounded-xl border text-xl font-bold ${gradeColor}`}>
      {grade}
    </span>
  );
}

// ── Results Card ───────────────────────────────────────────────────────

function TradeResultsCard({
  result,
  isDarkMode,
  resultsRef,
}: {
  result: TradeResult;
  isDarkMode: boolean;
  resultsRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Scroll into view
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Trigger entrance animation
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [resultsRef]);

  return (
    <div
      ref={resultsRef}
      className={`space-y-4 transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {/* Results header */}
      <div className={`flex items-center gap-3 pt-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-50'}`}>
          <Sparkles className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
        </div>
        <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          Analysis Complete
        </h2>
      </div>

      <div className={`rounded-xl border p-6 space-y-6 ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
        {/* Winner callout */}
        <div className={`flex items-start gap-3 p-4 rounded-lg ${isDarkMode ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
          <Trophy className={`w-6 h-6 mt-0.5 flex-shrink-0 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
          <div>
            <p className={`text-base font-bold mb-1 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
              Trade Winner: {result.winner}
            </p>
            <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              {result.winnerExplanation}
            </p>
          </div>
        </div>

        {/* Per-team grades */}
        <div className="space-y-4">
          <h4 className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            Team Grades
          </h4>
          {result.teamGrades.map((tg, i) => (
            <div
              key={i}
              className={`flex items-start gap-4 p-4 rounded-lg transition-all duration-300 ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}
              style={{ transitionDelay: `${(i + 1) * 100}ms`, opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(8px)' }}
            >
              <GradeBadge grade={tg.grade} isDarkMode={isDarkMode} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {tg.team}
                </p>
                <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  {tg.summary}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main View ──────────────────────────────────────────────────────────

interface TradeAnalyzerViewProps {
  isDarkMode: boolean;
}

const MAX_CONTEXT_WORDS = 150;

function createInitialTeams(count: number): TradeTeam[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    label: `Team ${i + 1}`,
    sends: [],
  }));
}

export function TradeAnalyzerView({ isDarkMode }: TradeAnalyzerViewProps) {
  const [teamCount, setTeamCount] = useState<2 | 3 | 4>(2);
  const [teams, setTeams] = useState<TradeTeam[]>(createInitialTeams(2));
  const [leagueType, setLeagueType] = useState<LeagueType>('redraft');
  const [strategy, setStrategy] = useState<TeamStrategy>('balanced');
  const [context, setContext] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<TradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const isMultiTeam = teamCount > 2;
  const wordCount = context.trim() ? context.trim().split(/\s+/).length : 0;

  const handleTeamCountChange = useCallback((count: 2 | 3 | 4) => {
    setTeamCount(count);
    setTeams((prev) => {
      if (count > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: count - prev.length }, (_, i) => ({
            id: prev.length + i,
            label: `Team ${prev.length + i + 1}`,
            sends: [],
          })),
        ];
      }
      return prev.slice(0, count);
    });
    setResult(null);
  }, []);

  const handleAddAsset = useCallback((teamId: number, asset: TradeAsset) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? { ...t, sends: [...t.sends, asset] }
          : t
      )
    );
    setResult(null);
  }, []);

  const handleRemoveAsset = useCallback((teamId: number, assetId: string) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? { ...t, sends: t.sends.filter((a) => a.id !== assetId) }
          : t
      )
    );
    setResult(null);
  }, []);

  const handleLabelChange = useCallback((teamId: number, label: string) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, label } : t))
    );
  }, []);

  const handleAssetDestinationChange = useCallback(
    (teamId: number, assetId: string, destinationTeamId: number) => {
      setTeams((prev) =>
        prev.map((t) =>
          t.id === teamId
            ? {
                ...t,
                sends: t.sends.map((a) =>
                  a.id === assetId ? { ...a, destinationTeamId } : a
                ),
              }
            : t
        )
      );
      setResult(null);
    },
    []
  );

  // For 2-team trades: all assets implicitly go to the other team
  // For 3+ team trades: every asset must have a destination selected
  const allAssetsHaveDestination = isMultiTeam
    ? teams.every((t) => t.sends.every((a) => a.destinationTeamId != null))
    : true;

  const canAnalyze =
    teams.every((t) => t.sends.length > 0) && allAssetsHaveDestination && !isAnalyzing;

  const handleAnalyze = async () => {
    if (!canAnalyze) return;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        teams: teams.map((t) => ({
          label: t.label || `Team ${t.id + 1}`,
          sends: t.sends.map((a) => ({
            type: a.type,
            name: a.name,
            position: a.position,
            team: a.team,
            destinationTeam: isMultiTeam
              ? (teams.find((ot) => ot.id === a.destinationTeamId)?.label ||
                `Team ${(a.destinationTeamId ?? 0) + 1}`)
              : undefined,
          })),
        })),
        leagueType,
        strategy: leagueType !== 'redraft' ? strategy : undefined,
        context: context.trim() || undefined,
      };

      const data = await api.post<TradeResult>('/trades/analyze', payload);
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to analyze trade. Please try again.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleContextChange = (text: string) => {
    const words = text.trim().split(/\s+/);
    if (text.trim() === '' || words.length <= MAX_CONTEXT_WORDS) {
      setContext(text);
    }
  };

  const handleReset = () => {
    setTeams(createInitialTeams(teamCount));
    setContext('');
    setResult(null);
    setError(null);
  };

  const optionBtn = (
    active: boolean,
    onClick: () => void,
    label: string
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
        active
          ? 'bg-blue-600 text-white shadow-sm'
          : isDarkMode
          ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
      }`}
    >
      {label}
    </button>
  );

  // Validation message
  const validationMessage = (() => {
    if (isAnalyzing) return null;
    const emptyTeams = teams.filter((t) => t.sends.length === 0);
    if (emptyTeams.length > 0) {
      return 'Each team must send at least one player or pick';
    }
    if (isMultiTeam && !allAssetsHaveDestination) {
      return 'Select a destination team for each asset';
    }
    return null;
  })();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDarkMode ? 'bg-blue-600/20' : 'bg-blue-50'
            }`}
          >
            <ArrowRightLeft className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <div>
            <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              AI Trade Analyzer
            </h1>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Get AI-powered trade analysis with grades and insights
            </p>
          </div>
        </div>
        {(teams.some((t) => t.sends.length > 0) || context) && (
          <button
            type="button"
            onClick={handleReset}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
              isDarkMode
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            Reset
          </button>
        )}
      </div>

      {/* Configuration Row */}
      <div
        className={`rounded-xl border p-4 space-y-4 ${
          isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        {/* Trade Type (team count) */}
        <div>
          <label className={`block text-xs font-semibold mb-2 uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Trade Type
          </label>
          <div className="flex gap-2">
            {([2, 3, 4] as const).map((n) =>
              optionBtn(teamCount === n, () => handleTeamCountChange(n), `${n}-Team Trade`)
            )}
          </div>
        </div>

        {/* League Type */}
        <div>
          <label className={`block text-xs font-semibold mb-2 uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            League Format
          </label>
          <div className="flex gap-2">
            {optionBtn(leagueType === 'redraft', () => { setLeagueType('redraft'); setResult(null); }, 'Redraft')}
            {optionBtn(leagueType === 'dynasty', () => { setLeagueType('dynasty'); setResult(null); }, 'Dynasty')}
            {optionBtn(leagueType === 'keeper', () => { setLeagueType('keeper'); setResult(null); }, 'Keeper')}
          </div>
        </div>

        {/* Strategy (dynasty/keeper only) */}
        {leagueType !== 'redraft' && (
          <div>
            <label className={`block text-xs font-semibold mb-2 uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Your Team Strategy
            </label>
            <div className="flex gap-2">
              {optionBtn(strategy === 'win-now', () => { setStrategy('win-now'); setResult(null); }, 'Win Now')}
              {optionBtn(strategy === 'rebuilding', () => { setStrategy('rebuilding'); setResult(null); }, 'Rebuilding')}
              {optionBtn(strategy === 'balanced', () => { setStrategy('balanced'); setResult(null); }, 'Balanced')}
            </div>
          </div>
        )}
      </div>

      {/* Trade Teams */}
      <div className={`grid gap-4 ${teamCount <= 2 ? 'md:grid-cols-2' : teamCount === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
        {teams.map((team, i) => (
          <TradeTeamCard
            key={team.id}
            team={team}
            teamIndex={i}
            isDarkMode={isDarkMode}
            allTeams={teams}
            isMultiTeam={isMultiTeam}
            onAddAsset={handleAddAsset}
            onRemoveAsset={handleRemoveAsset}
            onLabelChange={handleLabelChange}
            onAssetDestinationChange={handleAssetDestinationChange}
          />
        ))}
      </div>

      {/* Context */}
      <div
        className={`rounded-xl border p-4 ${
          isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        <label className={`block text-xs font-semibold mb-2 uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Additional Context{' '}
          <span className="font-normal normal-case">(optional)</span>
        </label>
        <textarea
          value={context}
          onChange={(e) => handleContextChange(e.target.value)}
          placeholder="Add context about your league, roster needs, scoring settings, or anything else the AI should consider..."
          rows={3}
          className={`w-full px-3 py-2 text-sm rounded-lg border resize-none transition-colors ${
            isDarkMode
              ? 'bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500'
              : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
          } outline-none`}
        />
        <p className={`text-xs mt-1 ${wordCount >= MAX_CONTEXT_WORDS ? (isDarkMode ? 'text-amber-400' : 'text-amber-600') : isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {wordCount}/{MAX_CONTEXT_WORDS} words
        </p>
      </div>

      {/* Analyze Button */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          className={`w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            canAnalyze
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20'
              : isDarkMode
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing Trade...
            </>
          ) : (
            <>
              <ArrowRightLeft className="w-4 h-4" />
              Analyze Trade
            </>
          )}
        </button>

        {validationMessage && (
          <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {validationMessage}
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${isDarkMode ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && <TradeResultsCard result={result} isDarkMode={isDarkMode} resultsRef={resultsRef} />}
    </div>
  );
}
