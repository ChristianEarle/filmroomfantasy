import { useEffect, useState } from 'react';
import { gameService, type NflState } from '../services/games';

const STORAGE_KEY = 'filmroom_nfl_state';
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
// Matches the server's own cache TTL — no point asking more often than it
// can answer differently.
const REFRESH_TTL_MS = 5 * 60 * 1000;

interface CachedEntry {
  state: NflState;
  cachedAtMs: number;
}

function readCache(): CachedEntry | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedEntry> | null;
    if (!parsed || typeof parsed.cachedAtMs !== 'number' || !parsed.state) return null;
    if (Date.now() - parsed.cachedAtMs > CACHE_MAX_AGE_MS) return null;
    return { state: parsed.state, cachedAtMs: parsed.cachedAtMs };
  } catch {
    // Private browsing, blocked storage, corrupt entry, etc. — just skip the seed.
    return null;
  }
}

function writeCache(state: NflState): void {
  try {
    const entry: CachedEntry = { state, cachedAtMs: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Non-fatal — the hook still works without a persisted cache.
  }
}

// Module-level singleton: every component calling useNflState() shares one
// fetch per page load instead of each week-scoped view hitting the API on
// its own, and a resolved value keeps every caller in sync via subscribers.
const seed = readCache();
let sharedState: NflState | null = seed?.state ?? null;
// When the shared value was last confirmed by the API (or the cache it
// came from); a fresh value is reused instead of refetched on every mount.
let sharedFetchedAtMs: number = seed?.cachedAtMs ?? 0;
let inFlight: Promise<NflState> | null = null;
const subscribers = new Set<() => void>();

function notifySubscribers(): void {
  subscribers.forEach((fn) => fn());
}

/**
 * Deterministic client-side fallback mirroring the server's calendar
 * resolver (server/src/services/nflState.ts): week 1 runs from the Tuesday
 * after Labor Day, each week is Tuesday -> Monday, clamped to 1..18. Only
 * used when the API is unreachable and nothing is cached, so a cold load
 * never spins forever or silently lands on week 1 of the wrong season.
 */
export function resolveWeekFromCalendar(now: Date = new Date()): NflState {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const season = month >= 7 ? year : year - 1;

  const sept1 = new Date(Date.UTC(season, 8, 1));
  const daysUntilMonday = (8 - sept1.getUTCDay()) % 7;
  const laborDay = Date.UTC(season, 8, 1 + daysUntilMonday);
  // Tuesday after Labor Day at 09:00 UTC (5am ET), safely after Monday Night Football
  const week1Start = laborDay + (24 + 9) * 3600000;
  const msPerWeek = 7 * 24 * 3600000;
  const postseasonStart = week1Start + 18 * msPerWeek;
  const resolvedAt = now.toISOString();

  if (now.getTime() < week1Start) {
    return { season, week: 1, seasonType: 'preseason', source: 'calendar', resolvedAt };
  }
  if (now.getTime() < postseasonStart) {
    const week = Math.min(18, Math.max(1, Math.floor((now.getTime() - week1Start) / msPerWeek) + 1));
    return { season, week, seasonType: 'regular', source: 'calendar', resolvedAt };
  }
  const isPostseason = month === 0 || (month === 1 && now.getUTCDate() <= 15);
  return { season, week: 18, seasonType: isPostseason ? 'postseason' : 'offseason', source: 'calendar', resolvedAt };
}

/** The season in progress, or the upcoming one during the Feb-Jul offseason (see the server's resolveSeasonInFocus). */
export function resolveSeasonInFocus(now: Date = new Date()): number {
  const { season, seasonType } = resolveWeekFromCalendar(now);
  return seasonType === 'offseason' ? season + 1 : season;
}

function fetchNflState(): Promise<NflState> {
  if (inFlight) return inFlight;
  if (sharedState != null && Date.now() - sharedFetchedAtMs < REFRESH_TTL_MS) {
    return Promise.resolve(sharedState);
  }
  inFlight = gameService
    .getNflState()
    .then((state) => {
      sharedState = state;
      sharedFetchedAtMs = Date.now();
      writeCache(state);
      notifySubscribers();
      return state;
    })
    .catch((err) => {
      // API unreachable: fall back to the calendar so views still resolve a
      // sensible week. Not cached, so the next page load retries the API.
      if (sharedState == null) {
        sharedState = resolveWeekFromCalendar();
        notifySubscribers();
      }
      throw err;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export interface UseNflStateResult {
  state: NflState | null;
  week: number | null;
  season: number | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Resolves the current NFL season/week/phase from the server (see
 * server/src/services/nflState.ts), seeded synchronously from a short-lived
 * localStorage cache so views don't flash a "loading" state on every visit.
 * Views that depend on a week number should gate on `week == null` rather
 * than defaulting to 1 — showing week 1 for the wrong season is the bug this
 * hook exists to fix.
 */
export function useNflState(): UseNflStateResult {
  const [state, setState] = useState<NflState | null>(sharedState);
  const [isLoading, setIsLoading] = useState(sharedState == null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    const onUpdate = () => {
      if (!cancelled) setState(sharedState);
    };
    subscribers.add(onUpdate);

    fetchNflState()
      .then(() => {
        if (!cancelled) setIsLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setIsLoading(false);
          setError(err instanceof Error ? err : new Error('Failed to load NFL state'));
        }
      });

    return () => {
      cancelled = true;
      subscribers.delete(onUpdate);
    };
  }, []);

  return { state, week: state?.week ?? null, season: state?.season ?? null, isLoading, error };
}
