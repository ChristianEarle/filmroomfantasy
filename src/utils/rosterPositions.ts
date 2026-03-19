/**
 * Dynamic roster position ordering for Team and Matchup views.
 * Handles variable roster sizes: QB, RBs (1+), WRs (1+), TEs (1+), Flexes (0+), K, DEF, Bench, IR.
 */

const BASE_ORDER: Record<string, number> = {
  QB: 0,
  RB: 1,
  WR: 2,
  TE: 3,
  FLEX: 4,
  SUPER_FLEX: 5,
  K: 6,
  DEF: 7,
  BN: 8,
  IR: 9,
};

/** Parse slot string (e.g. "RB1", "WR3", "FLEX2", "BN") into base position and index for sorting */
function parseSlot(slot: string): { base: string; index: number } {
  const s = (slot || '').toUpperCase().replace(/\s/g, '');
  if (!s) return { base: 'BN', index: 0 };

  // Match base position + optional number (RB1, WR2, FLEX3, BN4, IR1, etc.)
  const match = s.match(/^(QB|RB|WR|TE|FLEX|SUPER_FLEX|SUPERFLEX|K|DEF|BN|IR)(\d*)$/i);
  if (match) {
    const base = match[1] === 'SUPERFLEX' ? 'SUPER_FLEX' : match[1];
    const index = match[2] ? parseInt(match[2], 10) : 1;
    return { base, index: isNaN(index) ? 1 : index };
  }

  // Fallback: use first letters to guess (e.g. "RB" -> RB, "WR" -> WR)
  for (const key of Object.keys(BASE_ORDER)) {
    if (s.startsWith(key) || key.startsWith(s)) {
      const numMatch = s.match(/\d+$/);
      return { base: key, index: numMatch ? parseInt(numMatch[0], 10) : 1 };
    }
  }

  return { base: 'BN', index: 0 };
}

/** Get sort key for a slot: lower = earlier in display order */
export function getPositionSortKey(slot: string): number {
  const { base, index } = parseSlot(slot);
  const baseOrder = BASE_ORDER[base] ?? 50;
  return baseOrder * 1000 + index;
}

/** Sort roster players by position: QB, RBs, WRs, TEs, Flexes, K, DEF, then Bench, IR */
export function sortByPosition<T extends { position: string; slot?: string }>(players: T[]): T[] {
  return [...players].sort((a, b) => {
    const slotA = a.slot || a.position || '';
    const slotB = b.slot || b.position || '';
    const keyA = getPositionSortKey(slotA);
    const keyB = getPositionSortKey(slotB);
    if (keyA !== keyB) return keyA - keyB;
    return slotA.localeCompare(slotB);
  });
}
