import type { Context, Next } from 'hono';
import type { Env, Variables } from '../index';

// In-memory fallback store (used when D1 rate limit check fails)
const memoryStore = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = 0;

function cleanupMemory() {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (now > entry.resetAt) {
      memoryStore.delete(key);
    }
  }
}

/**
 * Check rate limit using in-memory store (fallback).
 * Returns { allowed, count, resetAt }.
 */
function checkMemory(key: string, maxRequests: number, windowMs: number): { allowed: boolean; count: number; resetAt: number } {
  const now = Date.now();
  if (now - lastCleanup > 60_000) {
    cleanupMemory();
    lastCleanup = now;
  }

  const entry = memoryStore.get(key);
  if (entry && now < entry.resetAt) {
    entry.count++;
    return { allowed: entry.count <= maxRequests, count: entry.count, resetAt: entry.resetAt };
  }

  const resetAt = now + windowMs;
  memoryStore.set(key, { count: 1, resetAt });
  return { allowed: true, count: 1, resetAt };
}

/**
 * Check rate limit using D1 (distributed across Workers isolates).
 * Uses INSERT OR REPLACE with atomic increment via SQL.
 * Falls back to in-memory if D1 call fails.
 */
async function checkD1(
  db: D1Database,
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; count: number; resetAt: number }> {
  const now = Date.now();
  const resetAt = now + windowMs;

  try {
    // Atomically insert or increment counter, resetting if window has expired
    // Uses a single statement with CASE to handle both fresh and existing entries
    await db.prepare(`
      INSERT INTO rate_limits (\`key\`, count, reset_at)
      VALUES (?1, 1, ?2)
      ON CONFLICT(\`key\`) DO UPDATE SET
        count = CASE
          WHEN reset_at <= ?3 THEN 1
          ELSE count + 1
        END,
        reset_at = CASE
          WHEN reset_at <= ?3 THEN ?2
          ELSE reset_at
        END
    `).bind(key, resetAt, now).run();

    // Read back the current count and reset time
    const row = await db.prepare(
      'SELECT count, reset_at FROM rate_limits WHERE `key` = ?1'
    ).bind(key).first<{ count: number; reset_at: number }>();

    if (!row) {
      return { allowed: true, count: 1, resetAt };
    }

    return {
      allowed: row.count <= maxRequests,
      count: row.count,
      resetAt: row.reset_at,
    };
  } catch (err) {
    // D1 failed — fall back to in-memory
    console.error('[rate-limit] D1 check failed, using memory fallback:', err);
    return checkMemory(key, maxRequests, windowMs);
  }
}

/**
 * Distributed rate limiting middleware for Cloudflare Workers.
 * Uses D1 for cross-isolate rate limiting (shared state across all Workers).
 * Falls back to in-memory if D1 is unavailable.
 *
 * Periodically cleans up expired entries via scheduled cron (or lazy cleanup).
 *
 * @param maxRequests - Max requests allowed in the window
 * @param windowMs - Time window in milliseconds
 */
export function rateLimit(maxRequests: number, windowMs: number) {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    // Use CF-Connecting-IP header (Cloudflare provides real client IP, cannot be spoofed).
    // Do NOT fall back to X-Forwarded-For as it can be trivially spoofed to bypass rate limits.
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    const path = c.req.path;
    const key = `${ip}:${path}`;

    let result: { allowed: boolean; count: number; resetAt: number };

    // Use D1 for distributed rate limiting if available
    if (c.env.DB) {
      result = await checkD1(c.env.DB, key, maxRequests, windowMs);
    } else {
      result = checkMemory(key, maxRequests, windowMs);
    }

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - result.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      c.header('Retry-After', String(Math.max(1, retryAfter)));
      return c.json({ error: 'Too many requests. Please try again later.' }, 429);
    }

    await next();
  };
}

/**
 * Clean up expired rate limit entries from D1.
 * Call this from a scheduled cron or admin endpoint.
 */
export async function cleanupExpiredRateLimits(db: D1Database): Promise<number> {
  const now = Date.now();
  const result = await db.prepare(
    'DELETE FROM rate_limits WHERE reset_at <= ?1'
  ).bind(now).run();
  return result.meta.changes ?? 0;
}
