// Hand-off mechanism for opening the Trade Analyzer pre-populated with a
// player from another view (e.g. the Draft Rankings "Trade value" button).
// The source view seeds an asset into localStorage and navigates; the Trade
// Analyzer consumes it once on mount.

export const TRADE_SEED_KEY = 'filmroom.tradeAnalyzer.seedAsset';

export interface TradeSeedAsset {
  id: string;
  type: 'player';
  name: string;
  position?: string;
  team?: string;
}

export function seedTradeAsset(asset: TradeSeedAsset): void {
  try {
    localStorage.setItem(TRADE_SEED_KEY, JSON.stringify(asset));
  } catch {
    /* localStorage unavailable (private mode / SSR) — ignore */
  }
}

// Reads and clears the seed so it only applies to the next Trade Analyzer
// mount. Returns null when absent or malformed.
export function consumeTradeSeed(): TradeSeedAsset | null {
  try {
    const raw = localStorage.getItem(TRADE_SEED_KEY);
    if (!raw) return null;
    localStorage.removeItem(TRADE_SEED_KEY);
    const a = JSON.parse(raw);
    if (a && typeof a.id === 'string' && typeof a.name === 'string') {
      return {
        id: a.id,
        type: 'player',
        name: a.name,
        position: typeof a.position === 'string' ? a.position : undefined,
        team: typeof a.team === 'string' ? a.team : undefined,
      };
    }
  } catch {
    /* malformed seed — ignore */
  }
  return null;
}
