import { useCallback, useSyncExternalStore } from 'react';
import type { Player } from '../App';

const STORAGE_KEY = 'filmroom_compare_players';
export const MAX_COMPARE = 4;

function readStored(): Player[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Module-level store shared by every useCompare() caller (PlayerCard toggle
// buttons and the global CompareBar) so they stay in sync without prop
// drilling or a context provider.
let compareList: Player[] = readStored();
const listeners = new Set<() => void>();

function emit() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compareList));
  } catch {
    // Ignore storage failures (private browsing, quota exceeded).
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return compareList;
}

/**
 * Client-side player comparison basket (up to MAX_COMPARE players), backed
 * by a module-level store persisted to localStorage. No backend involved —
 * mirrors the Draft Rankings compare-basket pattern but scoped globally so
 * it can be triggered from PlayerCard anywhere in the app.
 */
export function useCompare() {
  const list = useSyncExternalStore(subscribe, getSnapshot);

  const toggleCompare = useCallback((player: Player) => {
    const exists = compareList.some((p) => p.id === player.id);
    if (exists) {
      compareList = compareList.filter((p) => p.id !== player.id);
    } else {
      if (compareList.length >= MAX_COMPARE) return;
      compareList = [...compareList, player];
    }
    emit();
  }, []);

  const removeFromCompare = useCallback((playerId: string) => {
    compareList = compareList.filter((p) => p.id !== playerId);
    emit();
  }, []);

  const clearCompare = useCallback(() => {
    compareList = [];
    emit();
  }, []);

  const isInCompare = useCallback((playerId: string) => list.some((p) => p.id === playerId), [list]);

  return { compareList: list, toggleCompare, removeFromCompare, clearCompare, isInCompare, maxCompare: MAX_COMPARE };
}
