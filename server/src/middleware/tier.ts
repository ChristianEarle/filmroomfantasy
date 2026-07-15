import type { Context, Next } from 'hono';
import type { Env, Variables } from '../index';

export type SubscriptionTier = 'free' | 'pro' | 'elite';

const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, pro: 1, elite: 2 };

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

    const tier = (user.subscriptionTier || 'free') as SubscriptionTier;
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
