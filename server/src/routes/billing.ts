import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import type { Env, Variables } from '../index';

const billingRateLimit = rateLimit(30, 60 * 1000);

export const billingRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

billingRoutes.use('*', billingRateLimit);

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
          metadata: JSON.stringify({ userId: user.id }),
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
        line_items: JSON.stringify([
          {
            price: stripePriceId,
            quantity: 1,
          },
        ]),
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
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
    stripeCustomerId: user.stripeCustomerId || null,
  });
});

// POST /api/billing/webhook
// Handles Stripe webhook events
billingRoutes.post('/webhook', async (c) => {
  const db = c.get('db');
  const stripeWebhookSecret = c.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeWebhookSecret) {
    console.warn('[billing] Stripe webhook secret not configured');
    return c.json({ received: true }, 200);
  }

  try {
    const body = await c.req.text();
    const signature = c.req.header('stripe-signature');

    if (!signature) {
      return c.json({ error: 'Missing signature' }, 400);
    }

    // Verify signature (basic check - just verify it's present for now)
    // In production, you'd use crypto to verify the actual signature
    // const isValid = verifyStripeSignature(body, signature, stripeWebhookSecret);
    // if (!isValid) return c.json({ error: 'Invalid signature' }, 401);

    const event = JSON.parse(body) as {
      type: string;
      data: {
        object: {
          customer?: string;
          subscription?: string;
          status?: string;
          id?: string;
        };
      };
    };

    // Handle checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const customerId = event.data.object.customer;
      const subscriptionId = event.data.object.subscription;

      if (customerId) {
        // Find user by stripe customer ID and update subscription
        const users = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.stripeCustomerId, customerId));

        if (users.length > 0) {
          const user = users[0];
          await db
            .update(schema.users)
            .set({
              subscriptionTier: 'pro',
              stripeSubscriptionId: subscriptionId || undefined,
              subscriptionExpiresAt: new Date(
                Date.now() + 365 * 24 * 60 * 60 * 1000
              ).toISOString(),
            })
            .where(eq(schema.users.id, user.id));
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
        }
      }
    }

    return c.json({ received: true });
  } catch (error) {
    console.error('[billing] Error processing webhook:', error);
    return c.json({ received: true }, 200); // Always return 200 to prevent Stripe retries
  }
});
