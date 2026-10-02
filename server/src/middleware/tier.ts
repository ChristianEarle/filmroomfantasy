import type { Context, Next } from 'hono';
import type { Env, Variables } from '../index';

export type SubscriptionTier = 'free' | 'pro' | 'elite';

const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, pro: 1, elite: 2 };

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

/** True when the request is being served to a local dev host (port ignored). */
export function isLocalDevRequest(hostHeader: string | undefined | null): boolean {
  if (!hostHeader) return false;
  // Strip the port, keeping bracketed IPv6 intact.
  const host = hostHeader.startsWith('[')
    ? hostHeader.slice(0, hostHeader.indexOf(']') + 1)
    : hostHeader.split(':')[0];
  const lower = host.toLowerCase();
  return LOCAL_HOSTS.has(lower) || lower.endsWith('.localhost');
}

function parseTier(value: unknown): SubscriptionTier | null {
  return value === 'pro' || value === 'elite' ? value : null;
}

/**
 * Local-dev tier override. Lets a developer exercise Pro/Elite features
 * (Ask AI, AI takes, League Analyzer AI) against a local worker without a
 * paid account. It applies ONLY when all four hold:
 *   1. `DEV_TIER_OVERRIDE=pro|elite` is set (in server/.dev.vars — gitignored;
 *      it is never defined in wrangler.toml or as a production secret),
 *   2. `ENVIRONMENT` is not 'production',
 *   3. the request Host header is a local host (localhost / 127.0.0.1 / *.localhost),
 *   4. the request URL's own hostname (from `c.req.url`, not attacker-controllable
 *      the way a Host header can be) is ALSO a local host.
 * Requiring both (3) and (4) closes the gap where a request forwarded with a
 * spoofed/forwarded Host header could otherwise be tricked into a local-dev
 * bypass while its actual URL is not local.
 * Returns null when no override applies.
 */
export function resolveTierOverride(
  env: Pick<Env, 'ENVIRONMENT'> & { DEV_TIER_OVERRIDE?: string },
  hostHeader: string | undefined | null,
  urlHostname: string | undefined | null,
): SubscriptionTier | null {
  const override = parseTier(env.DEV_TIER_OVERRIDE);
  if (!override) return null;
  if (env.ENVIRONMENT === 'production') return null;
  if (!isLocalDevRequest(hostHeader) || !isLocalDevRequest(urlHostname)) return null;
  return override;
}

/** The tier a request is treated as: the user's real tier, or the local override when higher. */
export function resolveEffectiveTier(
  user: { subscriptionTier?: string | null },
  env: Pick<Env, 'ENVIRONMENT'> & { DEV_TIER_OVERRIDE?: string },
  hostHeader: string | undefined | null,
  urlHostname: string | undefined | null,
): { tier: SubscriptionTier; overridden: boolean } {
  const real: SubscriptionTier = parseTier(user.subscriptionTier) ?? 'free';
  const override = resolveTierOverride(env, hostHeader, urlHostname);
  if (override && TIER_RANK[override] > TIER_RANK[real]) {
    return { tier: override, overridden: true };
  }
  return { tier: real, overridden: false };
}

/**
 * Route middleware requiring an authenticated user at or above the given
 * subscription tier. Must run after authMiddleware. Responds with the
 * app-wide 403 { code: 'TIER_REQUIRED' } convention the frontend already
 * handles for the inline gates this consolidates.
 */
export const requireTier = (minTier: SubscriptionTier, featureName = 'This feature') => {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    let urlHostname: string | null = null;
    try {
      urlHostname = new URL(c.req.url).hostname;
    } catch {
      urlHostname = null;
    }
    const { tier } = resolveEffectiveTier(user, c.env, c.req.header('host'), urlHostname);
    if ((TIER_RANK[tier] ?? 0) < TIER_RANK[minTier]) {
      return c.json(
        {
          error: `${featureName} requires a ${minTier === 'elite' ? 'Elite' : 'Pro or Elite'} subscription.`,
          code: 'TIER_REQUIRED',
        },
        403
      );
    }

    await next();
  };
};
