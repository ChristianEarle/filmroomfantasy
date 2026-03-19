/**
 * Simple in-memory TTL cache for Cloudflare Workers.
 *
 * Note: Each Workers isolate has its own memory, so this cache is per-isolate.
 * For most read-heavy endpoints this still provides significant D1 query reduction
 * since a single isolate typically handles many requests before being recycled.
 *
 * For cross-isolate caching, consider Cloudflare KV or Cache API in the future.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();
let lastCleanup = 0;
const CLEANUP_INTERVAL = 60_000; // Clean expired entries every 60s
const MAX_ENTRIES = 500; // Prevent unbounded memory growth

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of store) {
    if (now > entry.expiresAt) {
      store.delete(key);
    }
  }

  // If still over limit after TTL cleanup, evict oldest entries
  if (store.size > MAX_ENTRIES) {
    const entries = [...store.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const toRemove = entries.slice(0, store.size - MAX_ENTRIES);
    for (const [key] of toRemove) {
      store.delete(key);
    }
  }
}

/**
 * Get a cached value, or compute and cache it if missing/expired.
 *
 * @param key - Cache key
 * @param ttlMs - Time-to-live in milliseconds
 * @param fetcher - Async function to compute the value if not cached
 * @returns The cached or freshly computed value
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  cleanup();

  const existing = store.get(key) as CacheEntry<T> | undefined;
  if (existing && Date.now() < existing.expiresAt) {
    return existing.data;
  }

  const data = await fetcher();
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

/**
 * Invalidate a specific cache key or all keys matching a prefix.
 */
export function invalidateCache(keyOrPrefix: string, prefix = false): number {
  if (!prefix) {
    return store.delete(keyOrPrefix) ? 1 : 0;
  }
  let count = 0;
  for (const key of store.keys()) {
    if (key.startsWith(keyOrPrefix)) {
      store.delete(key);
      count++;
    }
  }
  return count;
}

/**
 * Get current cache stats for monitoring.
 */
export function cacheStats(): { size: number; maxEntries: number } {
  return { size: store.size, maxEntries: MAX_ENTRIES };
}
