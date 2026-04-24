import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  ArrowRightLeft,
  Plus,
  X,
  Loader2,
  Trophy,
  Users,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Settings2,
  Send,
  Lightbulb,
  Crown,
  Scale,
  BarChart3,
  Calendar,
  Target,
  TrendingUp,
  Shield,
  MessageCircle,
  Wand2,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLeaguesContext } from '../context/LeaguesContext';

interface TradeUsage {
  used: number;
  limit: number; // -1 = unlimited
  remaining: number; // -1 = unlimited
  resetsDaily: boolean;
  resetsWeekly?: boolean;
}

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

interface FairnessScore {
  score: number; // 0-100
  diff: number;
  favored: string;
}

interface TradeResult {
  winner: string;
  winnerExplanation: string;
  teamGrades: TeamGrade[];
  fairnessScore: FairnessScore;
  improvements: string[];
  keyFactors: string[];
}

type LeagueType = 'redraft' | 'dynasty' | 'keeper';
type TeamStrategy = 'win-now' | 'rebuilding' | 'balanced';
type ScoringFormat = 'ppr' | 'half-ppr' | 'standard';

interface AdvancedSettings {
  scoringFormat: ScoringFormat;
  superflex: boolean;
  tePremium: boolean;
  teamCount: number;
}

const DEFAULT_ADVANCED_SETTINGS: AdvancedSettings = {
  scoringFormat: 'ppr',
  superflex: false,
  tePremium: false,
  teamCount: 12,
};

interface RosterPlayer {
  playerId: string;
  name: string;
  position: string;
  nflTeam: string;
  slot: string;
  isStarter: boolean;
  status: string;
  byeWeek: number | null;
}

interface MyRoster {
  teamId: string;
  teamName: string;
  record: { wins: number; losses: number; ties: number };
  roster: {
    starters: RosterPlayer[];
    bench: RosterPlayer[];
    ir: RosterPlayer[];
  };
}

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const LEAGUE_SELECTION_KEY = 'filmroom.tradeAnalyzer.selectedLeagueId';
const ADVANCED_KEY = 'filmroom.tradeAnalyzer.advanced';

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Show the dropdown whenever there's any state worth surfacing — not
  // just when we have results. Previously, an empty result set (or any
  // error, which the old code silently treated as empty) collapsed the
  // dropdown entirely, making search look broken during rate-limits.
  const trimmedQuery = query.trim();
  const showDropdown =
    isFocused &&
    trimmedQuery.length >= 2 &&
    (results.length > 0 || isSearching || errorMsg !== null || hasSearched);

  // Clean up timers and in-flight requests on unmount
  useEffect(() => {
    return () => {
      clearTimeout(blurTimeoutRef.current);
      clearTimeout(debounceTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const runSearch = async (q: string) => {
    // Cancel any in-flight request so stale responses can't overwrite
    // fresh ones when the user is typing quickly.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    setErrorMsg(null);
    try {
      const data = await api.get<{ players: SearchResult[] }>(
        `/players/search?q=${encodeURIComponent(q)}&limit=8`,
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setResults(data.players || []);
      setHasSearched(true);
    } catch (err) {
      if (controller.signal.aborted) return;
      if ((err as { name?: string })?.name === 'AbortError') return;
      const status = (err as { status?: number })?.status;
      setResults([]);
      setHasSearched(true);
      setErrorMsg(
        status === 429
          ? 'Searching too fast — pause for a moment, then try again.'
          : 'Search is temporarily unavailable. Try again in a moment.',
      );
    } finally {
      if (!controller.signal.aborted) setIsSearching(false);
    }
  };

  const handleSearch = (q: string) => {
    setQuery(q);
    // Reset per-keystroke UI state
    clearTimeout(debounceTimerRef.current);
    setErrorMsg(null);

    if (q.trim().length < 2) {
      // Cancel anything in flight and clear results — too short to search.
      abortRef.current?.abort();
      setResults([]);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    // Debounce so we don't fire a request per keystroke. 30 req/min
    // rate limit on the server means a fast typer could otherwise
    // trip a 429 within seconds.
    debounceTimerRef.current = setTimeout(() => {
      runSearch(q.trim());
    }, 250);
  };

  const selectPlayer = (p: SearchResult) => {
    onSelect({
      id: p.id,
      type: 'player',
      name: p.name,
      position: p.position,
      team: p.team,
    });
    clearTimeout(debounceTimerRef.current);
    abortRef.current?.abort();
    setQuery('');
    setResults([]);
    setErrorMsg(null);
    setHasSearched(false);
    setIsSearching(false);
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
          {results.length > 0 ? (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => selectPlayer(r)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                  isDarkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-50 text-slate-800'
                }`}
              >
                <span
                  className={`fr-text-10 font-bold px-1.5 py-0.5 rounded ${
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
            ))
          ) : (
            <div
              className={`px-3 py-2 text-sm ${
                errorMsg
                  ? 'text-amber-500'
                  : isDarkMode
                    ? 'text-slate-400'
                    : 'text-slate-500'
              }`}
            >
              {isSearching
                ? 'Searching…'
                : errorMsg
                  ? errorMsg
                  : 'No players match that search.'}
            </div>
          )}
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
  // NFL Draft is in late April — if we're past May, the next tradeable draft is next year
  const now = new Date();
  const nextDraftYear = now.getMonth() >= 4 ? now.getFullYear() + 1 : now.getFullYear();
  const pickYears = [nextDraftYear, nextDraftYear + 1, nextDraftYear + 2, nextDraftYear + 3];

  const [year, setYear] = useState(String(nextDraftYear));
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
        {pickYears.map((y) => (
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

function positionBadgeClasses(position: string | undefined, isDarkMode: boolean) {
  const p = (position || '').toUpperCase();
  if (p === 'QB') return isDarkMode ? 'bg-red-500/20 text-red-300' : 'bg-red-50 text-red-700';
  if (p === 'RB') return isDarkMode ? 'bg-green-500/20 text-green-300' : 'bg-green-50 text-green-700';
  if (p === 'WR') return isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700';
  if (p === 'TE') return isDarkMode ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-50 text-amber-700';
  return isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600';
}

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
  const isPick = asset.type === 'pick';
  const badgeLabel = isPick ? 'PICK' : asset.position || '—';
  const badgeClasses = isPick
    ? isDarkMode
      ? 'bg-slate-700 text-slate-200'
      : 'bg-slate-200 text-slate-600'
    : positionBadgeClasses(asset.position, isDarkMode);

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
        isDarkMode
          ? 'bg-slate-900 border-slate-700 hover:border-blue-500/60'
          : 'bg-white border-slate-200 hover:border-blue-400'
      }`}
    >
      <span
        style={{ minWidth: '34px' }}
        className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded fr-text-10 font-bold ${badgeClasses}`}
      >
        {badgeLabel}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className={`truncate text-sm font-semibold ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}
        >
          {asset.name}
        </p>
        {asset.team && !isPick && (
          <p className={`fr-text-10 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {asset.team}
          </p>
        )}
      </div>
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
                    ? 'bg-slate-800 border-slate-600 text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                  : isDarkMode
                  ? 'bg-slate-800 border-amber-500/50 text-amber-400'
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
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove asset"
        className={`p-1 rounded transition-colors ${
          isDarkMode
            ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'
            : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
        }`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
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
  isUserTeam,
  opponentOptions,
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
  /** True when this card represents the logged-in user's team. */
  isUserTeam?: boolean;
  /**
   * League opponent teams the user can pick from. Only passed for
   * non-user cards when a league is selected.
   */
  opponentOptions?: Array<{ teamId: string; teamName: string }>;
  onAddAsset: (teamId: number, asset: TradeAsset) => void;
  onRemoveAsset: (teamId: number, assetId: string) => void;
  onLabelChange: (teamId: number, label: string) => void;
  onAssetDestinationChange: (teamId: number, assetId: string, destinationTeamId: number) => void;
}) {
  const [showPickInput, setShowPickInput] = useState(false);

  const otherTeams = allTeams
    .filter((t) => t.id !== team.id)
    .map((t) => ({ id: t.id, label: t.label || `Team ${t.id + 1}` }));

  const assetCount = team.sends.length;

  const defaultLabel = `Team ${teamIndex + 1}`;
  // Lock the label input whenever it comes from a trusted source — the
  // user's connected-league team or an opponent picked from the league
  // dropdown. In those cases the label is used server-side to match
  // the user's team to the "(YOU)" marker in the analyzer prompt, and
  // letting the user blank it or rename it silently breaks direction
  // detection. For fully-manual trades (no league), the label stays
  // editable so users can still name teams for their own reference.
  const labelLocked = !!isUserTeam || !!opponentOptions;

  // Controlled input would lose focus if we nulled empty strings, so
  // we restore the default on blur instead. That keeps editing fluid
  // (you can clear and retype) but guarantees a non-empty final value.
  // Only relevant when the label isn't locked.
  const handleLabelBlur = (value: string) => {
    if (labelLocked) return;
    if (!value.trim()) {
      onLabelChange(team.id, defaultLabel);
    }
  };

  const matchedOpponentId = opponentOptions?.find((o) => o.teamName === team.label)?.teamId ?? '';

  return (
    <div
      style={{ minHeight: '260px' }}
      className={`flex flex-col w-full rounded-xl border p-4 ${
        isDarkMode
          ? 'bg-slate-950/60 border-slate-800'
          : 'bg-slate-50 border-slate-200'
      }`}
    >
      {/* Opponent picker (only for non-user cards when in a league) */}
      {opponentOptions && opponentOptions.length > 0 && (
        <div className="mb-2">
          <label
            className={`block fr-text-10 uppercase fr-tracking-wider font-bold mb-1 ${
              isDarkMode ? 'text-slate-500' : 'text-slate-500'
            }`}
          >
            Pick opponent from league
          </label>
          <div className="relative">
            <select
              value={matchedOpponentId}
              onChange={(e) => {
                const picked = opponentOptions.find((o) => o.teamId === e.target.value);
                if (picked) onLabelChange(team.id, picked.teamName);
              }}
              className={`appearance-none w-full pr-8 pl-2 py-1.5 text-xs font-semibold rounded border transition-colors cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-900 border-slate-800 text-white hover:border-slate-600'
                  : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300'
              } outline-none`}
            >
              <option value="">Custom team…</option>
              {opponentOptions.map((o) => (
                <option key={o.teamId} value={o.teamId}>
                  {o.teamName}
                </option>
              ))}
            </select>
            <ChevronDown
              className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${
                isDarkMode ? 'text-slate-500' : 'text-slate-400'
              }`}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Users
            className={`w-4 h-4 flex-shrink-0 ${
              isDarkMode ? 'text-blue-400' : 'text-blue-600'
            }`}
          />
          <input
            type="text"
            value={team.label}
            onChange={(e) => onLabelChange(team.id, e.target.value)}
            onBlur={(e) => handleLabelBlur(e.target.value)}
            placeholder={defaultLabel}
            readOnly={labelLocked}
            aria-readonly={labelLocked}
            title={
              labelLocked
                ? isUserTeam
                  ? "Your team name comes from your connected league and can't be edited here."
                  : "Opponent name is set by the 'Pick opponent from league' dropdown above."
                : undefined
            }
            className={`text-sm font-bold bg-transparent border-none outline-none w-full truncate ${
              isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
            } ${labelLocked ? 'cursor-default select-none' : ''}`}
          />
          {isUserTeam && (
            <span
              className={`flex-shrink-0 fr-text-10 font-bold uppercase fr-tracking-wider px-1.5 py-0.5 rounded ${
                isDarkMode ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-700'
              }`}
            >
              You
            </span>
          )}
        </div>
      </div>

      {/* Summary line */}
      <div
        className={`flex items-center justify-between fr-text-11 font-medium mb-2 ${
          isDarkMode ? 'text-slate-500' : 'text-slate-500'
        }`}
      >
        <span>Sends away</span>
        <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
          {assetCount} {assetCount === 1 ? 'asset' : 'assets'}
        </span>
      </div>

      {/* Asset chips */}
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

      {/* Spacer pushes search to bottom */}
      <div className="flex-1" />

      {/* Add player + pick */}
      <div className="mt-2 space-y-2">
        <PlayerSearchInput
          key={`search-${team.id}`}
          isDarkMode={isDarkMode}
          onSelect={(asset) => onAddAsset(team.id, asset)}
          placeholder="Search player or add draft pick..."
        />
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
              className={`text-xs ${
                isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-600'
              }`}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowPickInput(true)}
            className={`flex items-center gap-1 fr-text-11 font-medium transition-colors ${
              isDarkMode
                ? 'text-slate-400 hover:text-blue-400'
                : 'text-slate-500 hover:text-blue-600'
            }`}
          >
            <Plus className="w-3 h-3" /> Add draft pick
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

// ── Fairness Meter ────────────────────────────────────────────────────

function FairnessMeter({
  score,
  favored,
  isDarkMode,
}: {
  score: number;
  favored: string;
  isDarkMode: boolean;
}) {
  const leftPct = Math.max(0, Math.min(100, score));
  const diff = Math.abs(score - 50);
  const label =
    diff < 5
      ? 'Perfectly Fair'
      : diff < 15
      ? 'Slightly Favored'
      : diff < 30
      ? 'Favored'
      : 'Heavily Favored';

  const markerBorder =
    diff < 5
      ? 'border-emerald-500'
      : diff < 15
      ? 'border-lime-500'
      : diff < 30
      ? 'border-amber-500'
      : 'border-orange-500';

  const tagClasses =
    diff < 5
      ? isDarkMode
        ? 'bg-emerald-500/15 text-emerald-300'
        : 'bg-emerald-50 text-emerald-700'
      : diff < 15
      ? isDarkMode
        ? 'bg-lime-500/15 text-lime-300'
        : 'bg-lime-50 text-lime-700'
      : diff < 30
      ? isDarkMode
        ? 'bg-amber-500/15 text-amber-300'
        : 'bg-amber-50 text-amber-700'
      : isDarkMode
      ? 'bg-orange-500/15 text-orange-300'
      : 'bg-orange-50 text-orange-700';

  return (
    <div
      className={`rounded-xl border p-5 ${
        isDarkMode
          ? 'bg-slate-900/50 border-slate-700'
          : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Scale className={`w-4 h-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
          <h4 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Fairness Score
          </h4>
        </div>
        <span
          className={`fr-text-11 font-bold px-2.5 py-1 rounded ${tagClasses}`}
        >
          {Math.round(score)} · {diff < 5 ? 'Even' : `Favors ${favored}`}
        </span>
      </div>
      <div
        className="relative h-2.5 rounded-full"
        style={{
          background:
            'linear-gradient(90deg, rgb(239,68,68) 0%, rgb(234,179,8) 35%, rgb(34,197,94) 50%, rgb(234,179,8) 65%, rgb(239,68,68) 100%)',
          opacity: 0.45,
        }}
      />
      <div className="relative h-0">
        <div
          className={`absolute w-5 h-5 rounded-full shadow transition-all duration-500 ${markerBorder} ${
            isDarkMode ? 'bg-white' : 'bg-slate-900'
          }`}
          style={{
            top: '-18px',
            borderWidth: '3px',
            borderStyle: 'solid',
            left: `calc(${leftPct}% - 10px)`,
            boxShadow: isDarkMode
              ? '0 0 0 3px rgba(2,6,23,1)'
              : '0 0 0 3px rgba(255,255,255,1)',
          }}
          aria-label={`Fairness score ${score}`}
        />
      </div>
      <div
        className={`flex justify-between fr-text-10 font-semibold mt-4 ${
          isDarkMode ? 'text-slate-500' : 'text-slate-400'
        }`}
      >
        <span>0 · Team A robs</span>
        <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
          50 · {label}
        </span>
        <span>Team B robs · 100</span>
      </div>
    </div>
  );
}

// ── Follow-up Chat ────────────────────────────────────────────────────

function FollowUpChat({
  isDarkMode,
  turns,
  onSend,
  isSending,
  isAllowed,
  disabledReason,
}: {
  isDarkMode: boolean;
  turns: ChatTurn[];
  onSend: (question: string) => void;
  isSending: boolean;
  isAllowed: boolean;
  disabledReason: string | null;
}) {
  const [draft, setDraft] = useState('');
  const handleSend = (question?: string) => {
    const q = (question ?? draft).trim();
    if (!q || !isAllowed) return;
    onSend(q);
    setDraft('');
  };

  const quickChips = ['Counter-offer?', 'Roster fit?', 'Dynasty angle?'];

  return (
    <div className="space-y-3">
      {turns.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {turns.map((t, i) => (
            <div
              key={i}
              className={`text-sm rounded-lg px-3 py-2 ${
                t.role === 'user'
                  ? isDarkMode
                    ? 'bg-blue-500/10 text-blue-200'
                    : 'bg-blue-50 text-blue-900'
                  : isDarkMode
                  ? 'bg-slate-900 text-slate-200 border border-slate-800'
                  : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              {t.content}
            </div>
          ))}
        </div>
      )}

      <div
        className={`flex items-center gap-2 p-2 rounded-2xl border shadow-lg ${
          isDarkMode
            ? 'bg-slate-900 border-slate-700 shadow-black/40'
            : 'bg-white border-slate-200 shadow-slate-200/60'
        }`}
      >
        <div
          className={`flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 ${
            isDarkMode ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
        </div>

        {turns.length === 0 && isAllowed && (
          <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
            {quickChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleSend(chip)}
                disabled={isSending}
                className={`px-2.5 py-1 rounded-full border fr-text-11 font-medium whitespace-nowrap transition-colors ${
                  isDarkMode
                    ? 'bg-slate-950 border-slate-700 text-slate-300 hover:border-blue-500 hover:text-blue-300'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-700'
                } disabled:opacity-50`}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={!isAllowed || isSending}
          placeholder={
            isAllowed
              ? 'Ask about roster fit, a counter-offer, alternate packages...'
              : disabledReason || 'Upgrade to Pro for follow-ups'
          }
          className={`flex-1 min-w-0 bg-transparent border-0 outline-none text-sm px-2 ${
            isDarkMode
              ? 'text-white placeholder:text-slate-500'
              : 'text-slate-900 placeholder:text-slate-400'
          } disabled:cursor-not-allowed`}
        />

        {!isAllowed && (
          <span
            className={`inline-flex items-center gap-1 fr-text-10 font-bold uppercase px-1.5 py-0.5 rounded flex-shrink-0 ${
              isDarkMode
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            <Crown className="w-3 h-3" /> Pro
          </span>
        )}

        <button
          type="button"
          onClick={() => handleSend()}
          disabled={!isAllowed || isSending || !draft.trim()}
          aria-label="Send follow-up"
          className={`flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 transition-colors ${
            !isAllowed || isSending || !draft.trim()
              ? isDarkMode
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

// ── Results Card ───────────────────────────────────────────────────────

const FACTOR_ICONS = [BarChart3, Calendar, Target, TrendingUp, Shield, Users];

function TradeResultsCard({
  result,
  teams,
  isDarkMode,
  resultsRef,
  chatTurns,
  onSendFollowUp,
  isSendingFollowUp,
  followUpAllowed,
  followUpDisabledReason,
}: {
  result: TradeResult;
  teams: TradeTeam[];
  isDarkMode: boolean;
  resultsRef: React.RefObject<HTMLDivElement | null>;
  chatTurns: ChatTurn[];
  onSendFollowUp: (question: string) => void;
  isSendingFollowUp: boolean;
  followUpAllowed: boolean;
  followUpDisabledReason: string | null;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [resultsRef]);

  const winnerGrade =
    result.teamGrades.find(
      (g) => g.team.toLowerCase() === result.winner.toLowerCase(),
    )?.grade ?? '';

  const winnerGradeColor = (() => {
    const g = winnerGrade.toUpperCase();
    if (g.startsWith('A')) return isDarkMode ? 'text-emerald-400' : 'text-emerald-600';
    if (g.startsWith('B')) return isDarkMode ? 'text-blue-400' : 'text-blue-600';
    if (g.startsWith('C')) return isDarkMode ? 'text-amber-400' : 'text-amber-600';
    if (g.startsWith('D')) return isDarkMode ? 'text-orange-400' : 'text-orange-600';
    return isDarkMode ? 'text-red-400' : 'text-red-600';
  })();

  return (
    <div
      ref={resultsRef}
      className={`space-y-4 transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {/* Results header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-lg ${
              isDarkMode ? 'bg-blue-500/20' : 'bg-blue-50'
            }`}
          >
            <Sparkles className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Analysis
          </h2>
        </div>
        <span className={`fr-text-11 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          Analyzed just now
        </span>
      </div>

      {/* Persistent trade recap strip */}
      <div
        className={`sticky top-2 z-10 rounded-xl border backdrop-blur px-4 py-3 ${
          isDarkMode
            ? 'bg-slate-950/85 border-slate-800'
            : 'bg-white/90 border-slate-200'
        }`}
      >
        <div className="flex flex-wrap items-center gap-3">
          {teams.map((team, idx) => (
            <div key={team.id} className="flex items-center gap-2 flex-wrap">
              {idx > 0 && (
                <span className={`text-base font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  ⇄
                </span>
              )}
              <span
                className={`fr-text-10 font-bold uppercase fr-tracking-wider ${
                  isDarkMode ? 'text-slate-500' : 'text-slate-500'
                }`}
              >
                {team.label || `Team ${team.id + 1}`} sends
              </span>
              {team.sends.map((a) => (
                <span
                  key={a.id}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border fr-text-11 font-semibold ${
                    isDarkMode
                      ? 'bg-slate-900 border-slate-700 text-slate-200'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <span
                    className={`px-1 py-0.5 rounded fr-text-9 font-bold ${positionBadgeClasses(
                      a.type === 'pick' ? undefined : a.position,
                      isDarkMode,
                    )}`}
                  >
                    {a.type === 'pick' ? 'PICK' : a.position || '—'}
                  </span>
                  {a.name}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Hero verdict */}
      <div
        style={{
          backgroundImage: isDarkMode
            ? 'linear-gradient(135deg, rgb(15,23,42), rgba(16,185,129,0.05))'
            : 'linear-gradient(135deg, #ffffff, rgba(236,253,245,0.5))',
        }}
        className={`rounded-2xl border p-6 ${
          isDarkMode
            ? 'border-emerald-500/30'
            : 'border-emerald-200'
        }`}
      >
        <div className="fr-verdict-grid">
          <div
            className={`flex items-center justify-center w-12 h-12 rounded-xl border flex-shrink-0 ${
              isDarkMode
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-emerald-50 border-emerald-200 text-emerald-600'
            }`}
          >
            <Trophy className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`fr-text-11 font-bold uppercase fr-tracking-wider mb-1 ${
                isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
              }`}
            >
              Trade Winner · {result.winner}
            </p>
            <h3
              className={`text-lg font-extrabold leading-snug mb-1 ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              {result.winner} wins this trade
            </h3>
            <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              {result.winnerExplanation}
            </p>
          </div>
          {winnerGrade && (
            <div
              className={`md:pl-6 md:border-l flex md:block items-baseline gap-3 md:text-center ${
                isDarkMode ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              <div
                className={`fr-text-5xl font-black leading-none ${winnerGradeColor}`}
              >
                {winnerGrade}
              </div>
              <div
                className={`fr-text-10 font-bold uppercase fr-tracking-wider mt-2 ${
                  isDarkMode ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                Winner Grade
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fairness meter */}
      <FairnessMeter
        score={result.fairnessScore.score}
        favored={result.fairnessScore.favored}
        isDarkMode={isDarkMode}
      />

      {/* Team grade cards */}
      <div
        className={`grid gap-4 ${
          result.teamGrades.length === 1
            ? 'grid-cols-1'
            : result.teamGrades.length === 2
            ? 'md:grid-cols-2'
            : 'md:grid-cols-2 xl:grid-cols-3'
        }`}
      >
        {result.teamGrades.map((tg, i) => {
          const isWinner = tg.team.toLowerCase() === result.winner.toLowerCase();
          const cardBorderClass = isWinner
            ? isDarkMode ? 'border-emerald-500/30' : 'border-emerald-200'
            : isDarkMode ? 'border-amber-500/30' : 'border-amber-200';
          const cardBgImage = isWinner
            ? isDarkMode
              ? 'linear-gradient(135deg, rgb(15,23,42), rgba(16,185,129,0.05))'
              : 'linear-gradient(135deg, #ffffff, rgba(236,253,245,0.6))'
            : isDarkMode
              ? 'linear-gradient(135deg, rgb(15,23,42), rgba(245,158,11,0.05))'
              : 'linear-gradient(135deg, #ffffff, rgba(255,251,235,0.6))';
          const badgeClasses = isWinner
            ? isDarkMode
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-emerald-50 text-emerald-700'
            : isDarkMode
            ? 'bg-amber-500/15 text-amber-400'
            : 'bg-amber-50 text-amber-700';

          // Per-team derived stats (using data we already have)
          const teamForGrade = teams.find(
            (t) => (t.label || `Team ${t.id + 1}`).toLowerCase() === tg.team.toLowerCase(),
          );
          const isFavored =
            result.fairnessScore.favored.toLowerCase() === tg.team.toLowerCase();
          const fairnessMagnitude = Math.abs(result.fairnessScore.score - 50);
          const fairnessDeltaLabel = fairnessMagnitude === 0
            ? '0'
            : isFavored
            ? `+${Math.round(fairnessMagnitude)}`
            : `-${Math.round(fairnessMagnitude)}`;
          const fairnessColorClass = fairnessMagnitude === 0
            ? (isDarkMode ? 'text-slate-300' : 'text-slate-700')
            : isFavored
            ? 'text-emerald-500'
            : isDarkMode
            ? 'text-amber-400'
            : 'text-amber-600';
          const sendsCount = teamForGrade?.sends.length ?? 0;
          // Receives = assets from other teams destined for this team.
          // In 2-team trades, destinationTeamId is unset — every asset from
          // the other team comes to this one, so we fall back to that count.
          const receivesCount = teams.length === 2
            ? (teams.find((t) => t.id !== (teamForGrade?.id ?? -1))?.sends.length ?? 0)
            : teams.reduce(
                (n, t) =>
                  t.id === teamForGrade?.id
                    ? n
                    : n + t.sends.filter((a) => a.destinationTeamId === teamForGrade?.id).length,
                0,
              );

          const statLabelCls = `fr-text-10 uppercase fr-tracking-wider font-bold mt-1 ${
            isDarkMode ? 'text-slate-500' : 'text-slate-500'
          }`;
          const statValueCls = `text-lg font-extrabold leading-none ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`;

          return (
            <div
              key={i}
              className={`rounded-xl border p-5 transition-all duration-300 ${cardBorderClass}`}
              style={{
                backgroundImage: cardBgImage,
                transitionDelay: `${(i + 1) * 100}ms`,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(8px)',
              }}
            >
              <div className="flex items-start gap-4 mb-4">
                <GradeBadge grade={tg.grade} isDarkMode={isDarkMode} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p
                      className={`text-sm font-bold ${
                        isDarkMode ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {tg.team}
                    </p>
                    <span
                      className={`fr-text-10 font-bold px-2 py-0.5 rounded ${badgeClasses}`}
                    >
                      {isWinner ? 'Wins' : 'Loses'}
                    </span>
                  </div>
                </div>
              </div>
              <p
                className={`text-sm leading-relaxed ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-600'
                }`}
              >
                {tg.summary}
              </p>
              <div
                className={`flex items-center gap-4 mt-4 pt-4 border-t ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-200'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className={`${statValueCls} ${fairnessColorClass}`}>{fairnessDeltaLabel}</div>
                  <div className={statLabelCls}>Fairness Δ</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={statValueCls}>{sendsCount}</div>
                  <div className={statLabelCls}>Sends</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={statValueCls}>{receivesCount}</div>
                  <div className={statLabelCls}>Receives</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Balance suggestions */}
      {result.improvements.length > 0 && (
        <div
          style={{
            backgroundImage: isDarkMode
              ? 'linear-gradient(135deg, rgb(15,23,42), rgba(59,130,246,0.05))'
              : 'linear-gradient(135deg, #ffffff, rgba(239,246,255,0.6))',
          }}
          className={`rounded-xl border p-5 ${
            isDarkMode ? 'border-blue-500/30' : 'border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb
              className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
            />
            <h4 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              How to balance this trade
            </h4>
            <span className={`ml-auto text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {result.improvements.length} suggestion{result.improvements.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grid gap-2">
            {result.improvements.map((imp, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  isDarkMode
                    ? 'bg-slate-950/50 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div
                  className={`flex items-center justify-center w-6 h-6 rounded-full fr-text-11 font-bold flex-shrink-0 ${
                    isDarkMode
                      ? 'bg-blue-500/15 text-blue-400'
                      : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  {i + 1}
                </div>
                <p
                  className={`flex-1 text-sm leading-relaxed ${
                    isDarkMode ? 'text-slate-200' : 'text-slate-700'
                  }`}
                >
                  {imp}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key factors grid */}
      {result.keyFactors.length > 0 && (
        <div
          className={`rounded-xl border p-5 ${
            isDarkMode
              ? 'bg-slate-900/50 border-slate-700'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <h4 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Key Factors Considered
            </h4>
            <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {result.keyFactors.length} factors
            </span>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {result.keyFactors.map((kf, i) => {
              const Icon = FACTOR_ICONS[i % FACTOR_ICONS.length];
              return (
                <div
                  key={i}
                  className={`p-4 rounded-lg border ${
                    isDarkMode
                      ? 'bg-slate-950/50 border-slate-800'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div
                    className={`flex items-center justify-center w-7 h-7 rounded-lg mb-2 ${
                      isDarkMode
                        ? 'bg-slate-800 text-slate-300'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <p
                    className={`text-sm leading-relaxed ${
                      isDarkMode ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    {kf}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Follow-up chat */}
      <FollowUpChat
        isDarkMode={isDarkMode}
        turns={chatTurns}
        onSend={onSendFollowUp}
        isSending={isSendingFollowUp}
        isAllowed={followUpAllowed}
        disabledReason={followUpDisabledReason}
      />
    </div>
  );
}

// ── Main View ──────────────────────────────────────────────────────────

interface TradeAnalyzerViewProps {
  isDarkMode: boolean;
}

const MAX_CONTEXT_CHARS = 750;

function createInitialTeams(count: number): TradeTeam[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    label: `Team ${i + 1}`,
    sends: [],
  }));
}

export function TradeAnalyzerView({ isDarkMode }: TradeAnalyzerViewProps) {
  const { user } = useAuth();
  const { leagues, refetch: refetchLeagues } = useLeaguesContext();
  const [teamCount, setTeamCount] = useState<2 | 3 | 4>(2);
  const [teams, setTeams] = useState<TradeTeam[]>(createInitialTeams(2));
  const [leagueType, setLeagueType] = useState<LeagueType>('redraft');
  const [strategy, setStrategy] = useState<TeamStrategy>('balanced');
  const [context, setContext] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<TradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [usage, setUsage] = useState<TradeUsage | null>(null);

  // League selection (persisted to localStorage)
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(() => {
    try {
      return localStorage.getItem(LEAGUE_SELECTION_KEY) || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      if (selectedLeagueId) {
        localStorage.setItem(LEAGUE_SELECTION_KEY, selectedLeagueId);
      } else {
        localStorage.removeItem(LEAGUE_SELECTION_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, [selectedLeagueId]);

  // Advanced settings (persisted to localStorage)
  const [advanced, setAdvanced] = useState<AdvancedSettings>(() => {
    try {
      const raw = localStorage.getItem(ADVANCED_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_ADVANCED_SETTINGS, ...parsed };
      }
    } catch {
      // ignore
    }
    return DEFAULT_ADVANCED_SETTINGS;
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(ADVANCED_KEY, JSON.stringify(advanced));
    } catch {
      // ignore
    }
  }, [advanced]);

  // Roster panel
  const [myRoster, setMyRoster] = useState<MyRoster | null>(null);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [showMyRoster, setShowMyRoster] = useState(false);

  // All teams in the selected league — used to let users pick real
  // opponent teams for teams 2+ in the trade. Null when no league
  // is selected.
  const [allLeagueTeams, setAllLeagueTeams] = useState<MyRoster[] | null>(null);

  // Opponent options = every league team that isn't the user's own.
  // Used for the per-card "Pick opponent" dropdown on slots 2+.
  const opponentLeagueTeams = useMemo(() => {
    if (!allLeagueTeams || !myRoster) return [] as MyRoster[];
    return allLeagueTeams.filter((t) => t.teamId !== myRoster.teamId);
  }, [allLeagueTeams, myRoster]);

  // When the user's roster loads and Team 1 still has its placeholder
  // label ("Team 1"), auto-fill it with the real team name from the
  // league. This is a one-time sync; the user can edit the label and
  // we'll leave their custom value alone.
  useEffect(() => {
    if (!myRoster) return;
    setTeams((prev) => {
      if (prev.length === 0) return prev;
      const first = prev[0];
      if (first.label !== 'Team 1') return prev;
      return prev.map((t, i) => (i === 0 ? { ...t, label: myRoster.teamName } : t));
    });
  }, [myRoster]);

  // Follow-up chat
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);

  // Reset chat whenever the main analysis changes
  useEffect(() => {
    setChatTurns([]);
  }, [result]);

  // Auto-sync advanced settings + league format from the chosen league.
  // The user can still override any of these after selecting — we only
  // re-run this effect when the selected league actually changes.
  const selectedLeague = useMemo(
    () => leagues.find((l) => l.id === selectedLeagueId) || null,
    [leagues, selectedLeagueId]
  );

  // Track the last leagueId we auto-synced so we can re-run whenever
  // the user actually picks a different league (but not on every
  // leagues-array mutation, which could otherwise clobber a manual
  // override right after a context refetch).
  const lastAutoSyncedLeagueId = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedLeagueId) {
      lastAutoSyncedLeagueId.current = null;
      return;
    }
    const current = leagues.find((l) => l.id === selectedLeagueId);
    if (!current) return;
    // Only auto-sync when the user actually switches leagues. Context
    // refetches that return the same league shouldn't overwrite any
    // manual override the user just made.
    if (lastAutoSyncedLeagueId.current === selectedLeagueId) return;
    lastAutoSyncedLeagueId.current = selectedLeagueId;

    setAdvanced((prev) => ({
      ...prev,
      scoringFormat:
        (current.scoringFormat as ScoringFormat) || prev.scoringFormat,
      teamCount: current.teamCount || prev.teamCount,
      superflex: current.hasSuperflex ?? prev.superflex,
      tePremium: current.hasTePremium ?? prev.tePremium,
    }));
    // leagueType column has a NOT NULL default of 'redraft' in the DB,
    // so this is always present. Set unconditionally so switching to a
    // dynasty/keeper league always flips the Format pill.
    if (
      current.leagueType === 'redraft' ||
      current.leagueType === 'dynasty' ||
      current.leagueType === 'keeper'
    ) {
      setLeagueType(current.leagueType);
    }
    setResult(null);

    // Kick off a background re-sync so a stale stored leagueType (e.g.,
    // league connected before derived-type detection landed) gets
    // corrected. When it finishes, refetch the leagues context; the
    // effect's lastAutoSyncedLeagueId guard prevents it from clobbering
    // a manual override the user may have made in the meantime.
    (async () => {
      try {
        await api.post(`/leagues/${selectedLeagueId}/sync`);
        await refetchLeagues();
        // Reset the guard for this one league so the effect re-runs
        // once against the refreshed data.
        if (lastAutoSyncedLeagueId.current === selectedLeagueId) {
          lastAutoSyncedLeagueId.current = null;
        }
      } catch {
        // Silent — fallback to whatever leagueType we already have.
      }
    })();
  }, [selectedLeagueId, leagues, refetchLeagues]);

  // Fetch my roster whenever selectedLeagueId changes
  useEffect(() => {
    if (!selectedLeagueId) {
      setMyRoster(null);
      setAllLeagueTeams(null);
      return;
    }
    let cancelled = false;
    setIsLoadingRoster(true);
    // Fetch both the user's roster and the full set of league teams
    // in parallel. The "all teams" call powers the opponent picker on
    // trade slots 2+; we fall through silently if it fails so the rest
    // of the analyzer still works.
    Promise.all([
      api.get<{ team: MyRoster }>(`/rosters/${selectedLeagueId}/mine`),
      api.get<{ teams: MyRoster[] }>(`/rosters/${selectedLeagueId}/all`).catch(() => ({ teams: [] as MyRoster[] })),
    ])
      .then(([mine, all]) => {
        if (cancelled) return;
        setMyRoster(mine.team);
        setAllLeagueTeams(all.teams ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setMyRoster(null);
          setAllLeagueTeams(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRoster(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLeagueId]);

  const fetchUsage = useCallback(async () => {
    try {
      const data = await api.get<TradeUsage>('/trades/usage');
      setUsage(data);
    } catch {
      // Non-critical — don't block the UI
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  // Pick up a recommendation sent from the Trade Finder tab on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('filmroom.tradeAnalyzer.incoming');
      if (!raw) return;
      sessionStorage.removeItem('filmroom.tradeAnalyzer.incoming');
      const rec = JSON.parse(raw) as {
        targetTeamName: string;
        userSends: Array<{ playerId: string; name: string; position: string }>;
        userReceives: Array<{ playerId: string; name: string; position: string }>;
        userSendsPicks?: Array<{ year: number; round: number }>;
      };
      if (!rec || !rec.userSends || !rec.userReceives) return;
      const pickOrdinal = (round: number) =>
        round === 1 ? '1st' : round === 2 ? '2nd' : round === 3 ? '3rd' : `${round}th`;
      setTeamCount(2);
      setTeams([
        {
          id: 0,
          label: 'Me',
          sends: [
            ...rec.userSends.map((p) => ({
              id: `rec-send-${p.playerId}`,
              type: 'player' as const,
              name: p.name,
              position: p.position,
            })),
            ...(rec.userSendsPicks ?? []).map((pick, i) => ({
              id: `rec-pick-${i}`,
              type: 'pick' as const,
              name: `${pick.year} ${pickOrdinal(pick.round)} Round Pick`,
            })),
          ],
        },
        {
          id: 1,
          label: rec.targetTeamName,
          sends: rec.userReceives.map((p) => ({
            id: `rec-recv-${p.playerId}`,
            type: 'player' as const,
            name: p.name,
            position: p.position,
          })),
        },
      ]);
      setResult(null);
    } catch {
      // ignore malformed payload
    }
  }, []);

  const isUnlimited = usage?.limit === -1;
  const hasUsesLeft = !usage || isUnlimited || usage.remaining > 0;

  const isMultiTeam = teamCount > 2;
  const charCount = context.length;

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
    setTeams((prev) => {
      // In multi-team trades, auto-assign destination to the first other team
      // so the user doesn't get silently blocked by validation
      const isMulti = prev.length > 2;
      const defaultDest = isMulti
        ? prev.find((t) => t.id !== teamId)?.id ?? undefined
        : undefined;
      const assetWithDest = defaultDest != null
        ? { ...asset, destinationTeamId: defaultDest }
        : asset;
      return prev.map((t) =>
        t.id === teamId
          ? { ...t, sends: [...t.sends, assetWithDest] }
          : t
      );
    });
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
    teams.every((t) => t.sends.length > 0) && allAssetsHaveDestination && !isAnalyzing && hasUsesLeft;

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
        leagueSettings: {
          scoringFormat: advanced.scoringFormat,
          superflex: advanced.superflex,
          tePremium: advanced.tePremium,
          teamCount: advanced.teamCount,
        },
        connectedLeagueId: selectedLeagueId || null,
        userTeamId: myRoster?.teamId ?? null,
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
      fetchUsage();
    }
  };

  // Follow-up chat handler (Pro/Elite only)
  const followUpAllowed =
    !!user && (user.subscriptionTier === 'pro' || user.subscriptionTier === 'elite');
  const followUpDisabledReason = !user
    ? 'Sign in to ask follow-ups'
    : !followUpAllowed
    ? 'Upgrade to Pro for follow-up questions'
    : null;

  const handleSendFollowUp = async (question: string) => {
    if (!result || !followUpAllowed || isSendingFollowUp) return;

    // Seed initial context if this is the first follow-up turn
    const seedHistory: ChatTurn[] =
      chatTurns.length === 0
        ? [
            {
              role: 'user',
              content:
                `Trade: ${teams
                  .map(
                    (t) =>
                      `${t.label} sends ${t.sends.map((a) => a.name).join(', ')}`
                  )
                  .join(' | ')}`,
            },
            {
              role: 'assistant',
              content: `Analysis: Winner: ${result.winner}. ${result.winnerExplanation} ` +
                `Grades: ${result.teamGrades
                  .map((g) => `${g.team} ${g.grade}`)
                  .join(', ')}. ` +
                (result.keyFactors.length > 0
                  ? `Key factors: ${result.keyFactors.join('; ')}`
                  : ''),
            },
          ]
        : chatTurns;

    const newTurns: ChatTurn[] = [
      ...seedHistory,
      { role: 'user', content: question },
    ];
    setChatTurns(newTurns);
    setIsSendingFollowUp(true);

    try {
      const data = await api.post<{ answer: string }>('/trades/follow-up', {
        conversationHistory: newTurns,
        question,
      });
      setChatTurns([
        ...newTurns,
        { role: 'assistant', content: data.answer },
      ]);
    } catch (err) {
      setChatTurns([
        ...newTurns,
        {
          role: 'assistant',
          content:
            err instanceof Error
              ? `Sorry — ${err.message}`
              : 'Sorry, the follow-up failed. Please try again.',
        },
      ]);
    } finally {
      setIsSendingFollowUp(false);
    }
  };

  const handleContextChange = (text: string) => {
    if (text.length <= MAX_CONTEXT_CHARS) {
      setContext(text);
    }
  };

  const handleReset = () => {
    setTeams(createInitialTeams(teamCount));
    setContext('');
    setResult(null);
    setError(null);
  };

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

  const pill = (active: boolean, onClick: () => void, label: string) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all ${
        active
          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
          : isDarkMode
          ? 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );

  const hasDraft = teams.some((t) => t.sends.length > 0) || !!context;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Page head */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-xl border flex items-center justify-center ${
              isDarkMode
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                : 'bg-blue-50 border-blue-200 text-blue-600'
            }`}
          >
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <h1
              className={`text-2xl font-extrabold ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              AI Trade Analyzer
            </h1>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Get AI-powered trade analysis with grades, fairness scoring, and balance suggestions.
            </p>
          </div>
        </div>
        {hasDraft && (
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

      {/* Compact setup bar */}
      <div
        className={`rounded-xl border px-4 py-3 flex items-center gap-5 flex-wrap ${
          isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        {user && (
          <div className="flex items-center gap-2.5">
            <span
              className={`fr-text-10 uppercase fr-tracking-wider font-bold ${
                isDarkMode ? 'text-slate-500' : 'text-slate-500'
              }`}
            >
              League
            </span>
            <div className="relative">
              <select
                value={selectedLeagueId}
                onChange={(e) => {
                  setSelectedLeagueId(e.target.value);
                  setResult(null);
                }}
                style={{ maxWidth: '220px' }}
                className={`appearance-none pr-8 pl-3 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer truncate ${
                  isDarkMode
                    ? 'bg-slate-950 border-slate-800 text-white hover:border-slate-600'
                    : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300'
                } outline-none`}
              >
                <option value="">Custom Scenario</option>
                {leagues.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.platform ? ` (${l.platform})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown
                className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${
                  isDarkMode ? 'text-slate-500' : 'text-slate-400'
                }`}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <span
            className={`fr-text-10 uppercase fr-tracking-wider font-bold ${
              isDarkMode ? 'text-slate-500' : 'text-slate-500'
            }`}
          >
            Type
          </span>
          <div className="flex items-center gap-1">
            {([2, 3, 4] as const).map((n) => (
              <span key={n}>
                {pill(teamCount === n, () => handleTeamCountChange(n), `${n}-Team`)}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span
            className={`fr-text-10 uppercase fr-tracking-wider font-bold ${
              isDarkMode ? 'text-slate-500' : 'text-slate-500'
            }`}
          >
            Format
          </span>
          <div className="flex items-center gap-1">
            {pill(
              leagueType === 'redraft',
              () => {
                setLeagueType('redraft');
                setResult(null);
              },
              'Redraft',
            )}
            {pill(
              leagueType === 'dynasty',
              () => {
                setLeagueType('dynasty');
                setResult(null);
              },
              'Dynasty',
            )}
            {pill(
              leagueType === 'keeper',
              () => {
                setLeagueType('keeper');
                setResult(null);
              },
              'Keeper',
            )}
          </div>
        </div>

        {leagueType !== 'redraft' && (
          <div className="flex items-center gap-2.5">
            <span
              className={`fr-text-10 uppercase fr-tracking-wider font-bold ${
                isDarkMode ? 'text-slate-500' : 'text-slate-500'
              }`}
            >
              Strategy
            </span>
            <div className="flex items-center gap-1">
              {pill(
                strategy === 'win-now',
                () => {
                  setStrategy('win-now');
                  setResult(null);
                },
                'Win Now',
              )}
              {pill(
                strategy === 'rebuilding',
                () => {
                  setStrategy('rebuilding');
                  setResult(null);
                },
                'Rebuilding',
              )}
              {pill(
                strategy === 'balanced',
                () => {
                  setStrategy('balanced');
                  setResult(null);
                },
                'Balanced',
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className={`ml-auto flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded transition-colors ${
            isDarkMode
              ? 'text-slate-400 hover:text-white'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          Advanced Settings
          {showAdvanced ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Advanced Settings drawer */}
      {showAdvanced && (
        <div
          className={`rounded-xl border p-4 space-y-3 ${
            isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <div>
            <label
              className={`block fr-text-10 uppercase fr-tracking-wider font-bold mb-2 ${
                isDarkMode ? 'text-slate-500' : 'text-slate-500'
              }`}
            >
              Scoring Format
            </label>
            <div className="flex gap-1 flex-wrap">
              {(['ppr', 'half-ppr', 'standard'] as const).map((fmt) => (
                <span key={fmt}>
                  {pill(
                    advanced.scoringFormat === fmt,
                    () => {
                      setAdvanced((a) => ({ ...a, scoringFormat: fmt }));
                      setResult(null);
                    },
                    fmt === 'ppr' ? 'Full PPR' : fmt === 'half-ppr' ? 'Half PPR' : 'Standard',
                  )}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <label
              className={`flex items-center gap-2 text-sm cursor-pointer ${
                isDarkMode ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              <input
                type="checkbox"
                checked={advanced.superflex}
                onChange={(e) => {
                  setAdvanced((a) => ({ ...a, superflex: e.target.checked }));
                  setResult(null);
                }}
                className="accent-blue-600"
              />
              Superflex
            </label>
            <label
              className={`flex items-center gap-2 text-sm cursor-pointer ${
                isDarkMode ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              <input
                type="checkbox"
                checked={advanced.tePremium}
                onChange={(e) => {
                  setAdvanced((a) => ({ ...a, tePremium: e.target.checked }));
                  setResult(null);
                }}
                className="accent-blue-600"
              />
              TE Premium
            </label>
            <label
              className={`flex items-center gap-2 text-sm ${
                isDarkMode ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                Teams
              </span>
              <input
                type="number"
                min={4}
                max={20}
                value={advanced.teamCount}
                onChange={(e) => {
                  const n = Math.max(
                    4,
                    Math.min(20, parseInt(e.target.value, 10) || 12),
                  );
                  setAdvanced((a) => ({ ...a, teamCount: n }));
                  setResult(null);
                }}
                className={`w-16 px-2 py-1 text-sm rounded border transition-colors ${
                  isDarkMode
                    ? 'bg-slate-950 border-slate-800 text-white'
                    : 'bg-white border-slate-200 text-slate-900'
                } outline-none`}
              />
            </label>
          </div>
          {selectedLeagueId && (
            <p
              className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
            >
              The AI will use your team's record, standings, and roster when
              analyzing.
            </p>
          )}
        </div>
      )}

      {/* My Roster Panel */}
      {selectedLeagueId && (
        <div
          className={`rounded-xl border ${
            isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => setShowMyRoster((v) => !v)}
            className={`w-full flex items-center justify-between p-4 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users
                className={`w-4 h-4 ${
                  isDarkMode ? 'text-blue-400' : 'text-blue-600'
                }`}
              />
              <span className="text-sm font-semibold">
                {myRoster ? myRoster.teamName : 'My Roster'}
              </span>
              {myRoster && (
                <span
                  className={`text-xs font-medium ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {myRoster.record.wins}-{myRoster.record.losses}
                  {myRoster.record.ties ? `-${myRoster.record.ties}` : ''}
                </span>
              )}
            </div>
            {showMyRoster ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          {showMyRoster && (
            <div className="px-4 pb-4">
              {isLoadingRoster ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading roster...
                </div>
              ) : myRoster ? (
                <div className="space-y-3">
                  {myRoster.roster.starters.length > 0 && (
                    <div>
                      <p
                        className={`fr-text-10 font-bold uppercase mb-1 ${
                          isDarkMode ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        Starters
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {myRoster.roster.starters.map((p) => (
                          <span
                            key={p.playerId}
                            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${
                              isDarkMode
                                ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            <span className="fr-text-9 opacity-70">
                              {p.slot}
                            </span>
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {myRoster.roster.bench.length > 0 && (
                    <div>
                      <p
                        className={`fr-text-10 font-bold uppercase mb-1 ${
                          isDarkMode ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        Bench
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {myRoster.roster.bench.map((p) => (
                          <span
                            key={p.playerId}
                            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${
                              isDarkMode
                                ? 'bg-slate-800 text-slate-300'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            <span className="fr-text-9 opacity-70">
                              {p.position}
                            </span>
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p
                  className={`text-sm ${
                    isDarkMode ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  Could not load roster for this league.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Trade Flow Builder */}
      <div
        className={`rounded-2xl border p-5 space-y-4 ${
          isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2
              className={`w-4 h-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
            />
            <h3
              className={`text-sm font-bold ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              Build Your Trade
            </h3>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border fr-text-11 font-semibold ${
              isDarkMode
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isDarkMode ? 'bg-blue-400' : 'bg-blue-500'
              } animate-pulse`}
            />
            {teamCount}-team trade
          </span>
        </div>

        {(() => {
          // Options passed to each non-user card so the user can pick
          // a real league opponent instead of typing a label by hand.
          const opponentOptions = opponentLeagueTeams.map((t) => ({
            teamId: t.teamId,
            teamName: t.teamName,
          }));
          const opponentPickerProps = (i: number) =>
            i === 0 || opponentOptions.length === 0
              ? undefined
              : opponentOptions;

          if (teamCount === 2) {
            return (
              <div className="fr-grid-teams">
                <TradeTeamCard
                  key={teams[0].id}
                  team={teams[0]}
                  teamIndex={0}
                  isDarkMode={isDarkMode}
                  allTeams={teams}
                  isMultiTeam={isMultiTeam}
                  isUserTeam
                  onAddAsset={handleAddAsset}
                  onRemoveAsset={handleRemoveAsset}
                  onLabelChange={handleLabelChange}
                  onAssetDestinationChange={handleAssetDestinationChange}
                />
                <div className="flex items-center justify-center flex-shrink-0">
                  <div
                    className={`w-10 h-10 rounded-full border flex items-center justify-center ${
                      isDarkMode
                        ? 'bg-slate-900 border-slate-700 text-slate-400'
                        : 'bg-slate-100 border-slate-200 text-slate-500'
                    }`}
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                  </div>
                </div>
                <TradeTeamCard
                  key={teams[1].id}
                  team={teams[1]}
                  teamIndex={1}
                  isDarkMode={isDarkMode}
                  allTeams={teams}
                  isMultiTeam={isMultiTeam}
                  opponentOptions={opponentPickerProps(1)}
                  onAddAsset={handleAddAsset}
                  onRemoveAsset={handleRemoveAsset}
                  onLabelChange={handleLabelChange}
                  onAssetDestinationChange={handleAssetDestinationChange}
                />
              </div>
            );
          }

          return (
            <div
              className={`grid gap-3 ${
                teamCount === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'
              }`}
            >
              {teams.map((team, i) => (
                <TradeTeamCard
                  key={team.id}
                  team={team}
                  teamIndex={i}
                  isDarkMode={isDarkMode}
                  allTeams={teams}
                  isMultiTeam={isMultiTeam}
                  isUserTeam={i === 0}
                  opponentOptions={opponentPickerProps(i)}
                  onAddAsset={handleAddAsset}
                  onRemoveAsset={handleRemoveAsset}
                  onLabelChange={handleLabelChange}
                  onAssetDestinationChange={handleAssetDestinationChange}
                />
              ))}
            </div>
          );
        })()}

        {/* Context (subtle collapsible) */}
        <div>
          {showContext ? (
            <div
              className={`rounded-lg border p-3 ${
                isDarkMode
                  ? 'bg-slate-950/50 border-slate-800'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <label
                  className={`fr-text-10 uppercase fr-tracking-wider font-bold ${
                    isDarkMode ? 'text-slate-500' : 'text-slate-500'
                  }`}
                >
                  Additional context for the AI
                </label>
                <div className="flex items-center gap-3">
                  <span
                    className={`fr-text-10 font-semibold ${
                      charCount >= MAX_CONTEXT_CHARS
                        ? isDarkMode
                          ? 'text-amber-400'
                          : 'text-amber-600'
                        : isDarkMode
                        ? 'text-slate-500'
                        : 'text-slate-400'
                    }`}
                  >
                    {charCount}/{MAX_CONTEXT_CHARS}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowContext(false)}
                    className={`fr-text-10 font-semibold uppercase fr-tracking-wider ${
                      isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Hide
                  </button>
                </div>
              </div>
              <textarea
                value={context}
                onChange={(e) => handleContextChange(e.target.value)}
                placeholder="League quirks, roster needs, trade motivation, anything the AI should weigh..."
                rows={2}
                autoFocus
                className={`w-full px-2 py-1.5 text-sm rounded border resize-none transition-colors ${
                  isDarkMode
                    ? 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 focus:border-blue-500'
                    : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
                } outline-none`}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowContext(true)}
              className={`text-xs font-medium flex items-center gap-1.5 transition-colors ${
                isDarkMode ? 'text-slate-400 hover:text-blue-400' : 'text-slate-500 hover:text-blue-600'
              }`}
            >
              <Plus className="w-3 h-3" />
              {context
                ? `Context added (${charCount}/${MAX_CONTEXT_CHARS})`
                : 'Add context for the AI (optional)'}
            </button>
          )}
        </div>

        {/* CTA row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {hasDraft && (
            <button
              type="button"
              onClick={handleReset}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                isDarkMode
                  ? 'bg-transparent border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white'
                  : 'bg-transparent border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className={`flex-1 px-6 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              canAnalyze
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20'
                : isDarkMode
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
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
                Analyze Trade with AI
              </>
            )}
          </button>
        </div>

        {/* Usage + validation */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          {usage ? (
            <p
              className={`fr-text-11 ${
                !hasUsesLeft
                  ? isDarkMode
                    ? 'text-amber-400'
                    : 'text-amber-600'
                  : isDarkMode
                  ? 'text-slate-500'
                  : 'text-slate-400'
              }`}
            >
              {isUnlimited
                ? 'Unlimited analyses'
                : !hasUsesLeft
                ? !user
                  ? 'Create an account for 1 free analysis per day'
                  : user.subscriptionTier === 'free'
                  ? 'No analyses left today. Upgrade for more.'
                  : 'No analyses left today. Resets at midnight.'
                : `${usage.remaining}/${usage.limit} analyses remaining${
                    usage.resetsDaily
                      ? ' today'
                      : usage.resetsWeekly
                      ? ' this week'
                      : ''
                  }`}
            </p>
          ) : (
            <span />
          )}
          {validationMessage && (
            <p
              className={`fr-text-11 ${
                isDarkMode ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              {validationMessage}
            </p>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${isDarkMode ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <TradeResultsCard
          result={result}
          teams={teams}
          isDarkMode={isDarkMode}
          resultsRef={resultsRef}
          chatTurns={chatTurns}
          onSendFollowUp={handleSendFollowUp}
          isSendingFollowUp={isSendingFollowUp}
          followUpAllowed={followUpAllowed}
          followUpDisabledReason={followUpDisabledReason}
        />
      )}
    </div>
  );
}
