import { useCallback, useEffect, useState } from 'react';

export interface CompareStub {
  id: string;
  name: string;
  position: string;
  team: string;
}

const STORAGE_KEY = 'filmroom_compare_basket';
const CHANGE_EVENT = 'filmroom:compare-basket-changed';
export const MAX_COMPARE = 4;

function readBasket(): CompareStub[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBasket(list: CompareStub[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable (private mode, quota) — the in-memory state still
    // updates for this session via the dispatched event below.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Client-only "compare basket" for PlayerCard — lets a user star up to
 * MAX_COMPARE players while browsing and pull up a side-by-side season-stat
 * view. Deliberately separate from Draft Rankings' own compare feature: that
 * one compares rank/tier/ADP within a single ranking variant, this one
 * compares season averages for any player regardless of context, so the two
 * data shapes don't need to be unified.
 */
export function useCompareBasket() {
  const [basket, setBasket] = useState<CompareStub[]>(() => readBasket());

  useEffect(() => {
    const onChange = () => setBasket(readBasket());
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const isInBasket = useCallback(
    (id: string) => basket.some((p) => p.id === id),
    [basket],
  );

  const toggle = useCallback((stub: CompareStub) => {
    const current = readBasket();
    const exists = current.some((p) => p.id === stub.id);
    if (exists) {
      writeBasket(current.filter((p) => p.id !== stub.id));
      return;
    }
    if (current.length >= MAX_COMPARE) return;
    writeBasket([...current, stub]);
  }, []);

  const remove = useCallback((id: string) => {
    writeBasket(readBasket().filter((p) => p.id !== id));
  }, []);

  const clear = useCallback(() => writeBasket([]), []);

  return { basket, isInBasket, toggle, remove, clear, max: MAX_COMPARE };
}
