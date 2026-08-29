import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import type { Env, Variables } from '../index';

const billingRateLimit = rateLimit(30, 60 * 1000);

export const billingRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Exempt webhook from rate limiting (Stripe sends bursts during events)
billingRoutes.use('*', async (c, next) => {
  if (c.req.path.endsWith('/webhook') && c.req.method === 'POST') {
    return next();
  }
  return billingRateLimit(c, next);
});

// ── Stripe Webhook Signature Verification ──
// Uses Web Crypto API (available in Cloudflare Workers) to verify HMAC-SHA256 signatures
async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300
): Promise<{ valid: boolean; error?: string }> {
  // Parse the Stripe-Signature header: t=timestamp,v1=signature[,v1=signature...]
  const parts = signatureHeader.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=', 2);
    if (key && value) {
      if (!acc[key]) acc[key] = [];
      acc[key].push(value);
    }
    return acc;
  }, {} as Record<string, string[]>);

  const timestamp = parts['t']?.[0];
  const signatures = parts['v1'] || [];

  if (!timestamp || signatures.length === 0) {
    return { valid: false, error: 'Missing timestamp or signature in header' };
  }

  // Check timestamp tolerance (prevent replay attacks)
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) {
    return { valid: false, error: 'Invalid timestamp' };
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSeconds) {
    return { valid: false, error: `Timestamp outside tolerance (${Math.abs(now - ts)}s > ${toleranceSeconds}s)` };
  }

  // Compute expected signature: HMAC-SHA256(secret, "timestamp.payload")
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expectedSig = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison against all v1 signatures
  const match = signatures.some((sig) => {
    if (sig.length !== expectedSig.length) return false;
    let result = 0;
    for (let i = 0; i < sig.length; i++) {
      result |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
    }
    return result === 0;
  });

  if (!match) {
    return { valid: false, error: 'Signature mismatch' };
  }

  return { valid: true };
}

// Map Stripe Price IDs back to subscription tiers
const PRICE_TO_TIER: Record<string, string> = {
  price_1TCzKbKcWZmDI9ul6vSQmJai: 'pro',     // pro_monthly
  price_1TD9fkKcWZmDI9ulddloDohc: 'pro',     // pro_yearly
  price_1TCzMMKcWZmDI9ulav5tWax6: 'elite',    // elite_monthly
  price_1TD9h3KcWZmDI9ulKippuUB8: 'elite',    // elite_yearly
};

// Allowed redirect URL origins for checkout
const ALLOWED_REDIRECT_ORIGINS = [
  'https://filmroomfantasy.com',
  'https://www.filmroomfantasy.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
];

function isAllowedRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_REDIRECT_ORIGINS.some(
      (origin) => `${parsed.protocol}//${parsed.host}` === origin
    ) || parsed.hostname.endsWith('.pages.dev');
  } catch {
    return false;
  }
}

const STRIPE_API_URL = 'https://api.stripe.com/v1';

// Map internal price IDs to Stripe Price IDs
const PRICE_MAP: Record<string, string> = {
  pro_monthly: 'price_1TCzKbKcWZmDI9ul6vSQmJai',
  pro_yearly: 'price_1TD9fkKcWZmDI9ulddloDohc',
  elite_monthly: 'price_1TCzMMKcWZmDI9ulav5tWax6',
  elite_yearly: 'price_1TD9h3KcWZmDI9ulKippuUB8',
};

// POST /api/billing/create-checkout
// Creates a Stripe Checkout session for Pro/Elite subscription
billingRoutes.post('/create-checkout', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const stripeSecretKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return c.json({ error: 'Stripe not configured' }, 500);
  }

  try {
    const body = await c.req.json<{ priceId: string; successUrl: string; cancelUrl: string }>();
    let { priceId, successUrl, cancelUrl } = body;

    if (!priceId || !successUrl || !cancelUrl) {
      return c.json(
        { error: 'Missing required fields: priceId, successUrl, cancelUrl' },
        400
      );
    }

    // Validate redirect URLs to prevent open redirect attacks
    if (!isAllowedRedirectUrl(successUrl) || !isAllowedRedirectUrl(cancelUrl)) {
      return c.json({ error: 'Invalid redirect URL' }, 400);
    }

    // Resolve internal price ID to Stripe Price ID
    const stripePriceId = PRICE_MAP[priceId] || priceId;

    // Create or retrieve Stripe customer
    let stripeCustomerId = user.stripeCustomerId;

    if (!stripeCustomerId) {
      const customerResponse = await fetch(`${STRIPE_API_URL}/customers`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: user.email,
          'metadata[userId]': user.id,
        }),
      });

      if (!customerResponse.ok) {
        const error = await customerResponse.json();
        console.error('[billing] Failed to create Stripe customer:', error);
        return c.json({ error: 'Failed to create checkout session' }, 500);
      }

      const customer = await customerResponse.json() as { id: string };
      stripeCustomerId = customer.id;

      // Update user with Stripe customer ID
      await db
        .update(schema.users)
        .set({ stripeCustomerId })
        .where(eq(schema.users.id, user.id));
    }

    // Create checkout session
    const checkoutResponse = await fetch(`${STRIPE_API_URL}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: stripeCustomerId,
        'line_items[0][price]': stripePriceId,
        'line_items[0][quantity]': '1',
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        'subscription_data[trial_period_days]': '3',
      }),
    });

    if (!checkoutResponse.ok) {
      const error = await checkoutResponse.json();
      console.error('[billing] Failed to create checkout session:', error);
      return c.json({ error: 'Failed to create checkout session' }, 500);
    }

    const session = await checkoutResponse.json() as { url: string | null };

    if (!session.url) {
      return c.json({ error: 'Failed to generate checkout URL' }, 500);
    }

    return c.json({ url: session.url });
  } catch (error) {
    console.error('[billing] Error in create-checkout:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/billing/status
// Returns user's current subscription status
billingRoutes.get('/status', authMiddleware, async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  return c.json({
    tier: user.subscriptionTier,
    expiresAt: user.subscriptionExpiresAt,
    hasStripeCustomer: !!user.stripeCustomerId,
  });
});

// POST /api/billing/create-portal
// Creates a Stripe Customer Portal session for managing/canceling subscriptions
billingRoutes.post('/create-portal', authMiddleware, async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const stripeSecretKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return c.json({ error: 'Stripe not configured' }, 500);
  }

  if (!user.stripeCustomerId) {
    return c.json({ error: 'No active subscription' }, 400);
  }

  try {
    const body = await c.req.json<{ returnUrl: string }>();
    const { returnUrl } = body;

    if (!returnUrl) {
      return c.json({ error: 'Missing required field: returnUrl' }, 400);
    }

    // Validate returnUrl to prevent open redirect attacks
    if (!isAllowedRedirectUrl(returnUrl)) {
      return c.json({ error: 'Invalid redirect URL' }, 400);
    }

    const portalResponse = await fetch(`${STRIPE_API_URL}/billing_portal/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: user.stripeCustomerId,
        return_url: returnUrl,
      }),
    });

    if (!portalResponse.ok) {
      const error = await portalResponse.json();
      console.error('[billing] Failed to create portal session:', error);
      return c.json({ error: 'Failed to create portal session' }, 500);
    }

    const session = await portalResponse.json() as { url: string };
    return c.json({ url: session.url });
  } catch (error) {
    console.error('[billing] Error in create-portal:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/billing/cancel
// Cancels the user's subscription at the end of the current billing period
billingRoutes.post('/cancel', authMiddleware, async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const stripeSecretKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return c.json({ error: 'Stripe not configured' }, 500);
  }

  if (!user.stripeSubscriptionId) {
    return c.json({ error: 'No active subscription to cancel' }, 400);
  }

  try {
    // Cancel at period end (user keeps access until the billing cycle ends)
    const cancelResponse = await fetch(
      `${STRIPE_API_URL}/subscriptions/${user.stripeSubscriptionId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          cancel_at_period_end: 'true',
        }),
      }
    );

    if (!cancelResponse.ok) {
      const error = await cancelResponse.json();
      console.error('[billing] Failed to cancel subscription:', error);
      return c.json({ error: 'Failed to cancel subscription' }, 500);
    }

    const sub = await cancelResponse.json() as { cancel_at_period_end: boolean; current_period_end: number };

    return c.json({
      cancelled: true,
      accessUntil: new Date(sub.current_period_end * 1000).toISOString(),
    });
  } catch (error) {
    console.error('[billing] Error in cancel:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/billing/webhook
// Handles Stripe webhook events with signature verification
billingRoutes.post('/webhook', async (c) => {
  const db = c.get('db');
  const stripeSecretKey = c.env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret = c.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeWebhookSecret) {
    console.warn('[billing] Stripe webhook secret not configured');
    return c.json({ error: 'Webhook not configured' }, 500);
  }

  try {
    const body = await c.req.text();
    const signature = c.req.header('stripe-signature');

    if (!signature) {
      return c.json({ error: 'Missing signature' }, 400);
    }

    // Verify Stripe webhook signature using HMAC-SHA256
    const verification = await verifyStripeSignature(body, signature, stripeWebhookSecret);
    if (!verification.valid) {
      console.error(`[billing] Webhook signature verification failed: ${verification.error}`);
      return c.json({ error: 'Invalid signature' }, 401);
    }

    const event = JSON.parse(body) as {
      type: string;
      data: {
        object: {
          customer?: string;
          subscription?: string;
          status?: string;
          id?: string;
          // checkout.session fields
          line_items?: { data: { price: { id: string } }[] };
        };
      };
    };

    // Handle checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const customerId = event.data.object.customer;
      const subscriptionId = event.data.object.subscription;

      if (customerId) {
        // Determine the subscription tier strictly from the purchased price.
        // We never default to a paid tier: if we can't confirm exactly which
        // mapped price was bought, we grant nothing (fail closed) to prevent a
        // free upgrade via an unmapped/cheaper price or a failed Stripe re-fetch.
        let tier: string | null = null;
        let resolvedExpiry: Date | null = null;
        if (subscriptionId && stripeSecretKey) {
          try {
            const subResponse = await fetch(
              `${STRIPE_API_URL}/subscriptions/${subscriptionId}`,
              {
                headers: { Authorization: `Bearer ${stripeSecretKey}` },
                signal: AbortSignal.timeout(10000),
              }
            );
            if (subResponse.ok) {
              const sub = await subResponse.json() as {
                current_period_end?: number;
                items?: { data?: { price?: { id: string } }[] };
              };
              const priceId = sub.items?.data?.[0]?.price?.id;
              if (priceId && PRICE_TO_TIER[priceId]) {
                tier = PRICE_TO_TIER[priceId];
              }
              // Drive entitlement off Stripe's period end, not a hardcoded year.
              if (sub.current_period_end) {
                resolvedExpiry = new Date(sub.current_period_end * 1000);
              }
              console.log(`[billing] Checkout completed: customer=${customerId}, price=${priceId}, tier=${tier ?? 'unrecognized'}`);
            } else {
              console.error(`[billing] Subscription fetch returned ${subResponse.status} — not granting tier`);
            }
          } catch (err) {
            console.error('[billing] Failed to fetch subscription for tier detection:', err);
            // Fail closed — leave tier null so we do not grant access.
          }
        }

        if (!tier) {
          console.warn(`[billing] Could not resolve a mapped tier for customer ${customerId} — skipping upgrade`);
        }

        // Find user by stripe customer ID and update subscription
        const users = tier
          ? await db
              .select()
              .from(schema.users)
              .where(eq(schema.users.stripeCustomerId, customerId))
          : [];

        if (tier && users.length > 0) {
          const user = users[0];
          await db
            .update(schema.users)
            .set({
              subscriptionTier: tier,
              stripeSubscriptionId: subscriptionId || undefined,
              subscriptionExpiresAt: (
                resolvedExpiry ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
              ).toISOString(),
            })
            .where(eq(schema.users.id, user.id));
          console.log(`[billing] User ${user.id} upgraded to ${tier}`);
        } else {
          console.warn(`[billing] No user found for Stripe customer ${customerId}`);
        }
      }
    }

    // Handle customer.subscription.updated (plan changes, renewals)
    if (event.type === 'customer.subscription.updated') {
      const customerId = event.data.object.customer;
      const subStatus = event.data.object.status;

      if (customerId && (subStatus === 'active' || subStatus === 'trialing')) {
        // Re-fetch subscription to get updated tier. Fail closed: only apply a
        // tier we can map from the actual price — never default to a paid tier.
        const subscriptionId = event.data.object.id;
        let tier: string | null = null;
        let resolvedExpiry: Date | null = null;
        if (subscriptionId && stripeSecretKey) {
          try {
            const subResponse = await fetch(
              `${STRIPE_API_URL}/subscriptions/${subscriptionId}`,
              {
                headers: { Authorization: `Bearer ${stripeSecretKey}` },
                signal: AbortSignal.timeout(10000),
              }
            );
            if (subResponse.ok) {
              const sub = await subResponse.json() as {
                current_period_end?: number;
                items?: { data?: { price?: { id: string } }[] };
              };
              const priceId = sub.items?.data?.[0]?.price?.id;
              if (priceId && PRICE_TO_TIER[priceId]) {
                tier = PRICE_TO_TIER[priceId];
              }
              if (sub.current_period_end) {
                resolvedExpiry = new Date(sub.current_period_end * 1000);
              }
            } else {
              console.error(`[billing] Subscription fetch returned ${subResponse.status} on update — not changing tier`);
            }
          } catch (err) {
            console.error('[billing] Failed to fetch subscription on update:', err);
          }
        }

        if (!tier) {
          console.warn(`[billing] Update event for customer ${customerId} had no mapped tier — skipping`);
        }

        const users = tier
          ? await db
              .select()
              .from(schema.users)
              .where(eq(schema.users.stripeCustomerId, customerId))
          : [];

        if (tier && users.length > 0) {
          await db
            .update(schema.users)
            .set({
              subscriptionTier: tier,
              ...(resolvedExpiry ? { subscriptionExpiresAt: resolvedExpiry.toISOString() } : {}),
            })
            .where(eq(schema.users.id, users[0].id));
          console.log(`[billing] User ${users[0].id} subscription updated to ${tier}`);
        }
      }
    }

    // Handle customer.subscription.deleted (cancellation)
    if (event.type === 'customer.subscription.deleted') {
      const customerId = event.data.object.customer;

      if (customerId) {
        const users = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.stripeCustomerId, customerId));

        if (users.length > 0) {
          const user = users[0];
          await db
            .update(schema.users)
            .set({
              subscriptionTier: 'free',
              stripeSubscriptionId: null,
              subscriptionExpiresAt: null,
            })
            .where(eq(schema.users.id, user.id));
          console.log(`[billing] User ${user.id} subscription cancelled, reverted to free`);
        }
      }
    }

    return c.json({ received: true });
  } catch (error) {
    console.error('[billing] Error processing webhook:', error);
    return c.json({ error: 'Webhook processing failed' }, 400);
  }
});
