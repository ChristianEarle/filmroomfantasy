import { Hono } from 'hono';
import * as schema from '../db/schema';
import { rateLimit } from '../middleware/rateLimit';
import { generateId } from '../utils/id';
import type { Env, Variables } from '../index';

export const newsletterRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate limit signups: 5 per 15 minutes per IP — matches the feedback endpoint,
// this is a low-frequency, low-value-per-request write.
const newsletterRateLimit = rateLimit(5, 15 * 60 * 1000);

// Subscribe to the weekly newsletter (public — no auth required).
newsletterRoutes.post('/subscribe', newsletterRateLimit, async (c) => {
  try {
    const body = await c.req.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const source = typeof body?.source === 'string' ? body.source.slice(0, 50) : null;

    if (!email || !EMAIL_REGEX.test(email) || email.length > 254) {
      return c.json({ error: 'Please enter a valid email address' }, 400);
    }

    const db = c.get('db');

    // Idempotent — re-subscribing an existing email is a no-op success, not an error.
    await db.insert(schema.newsletterSubscribers).values({
      id: generateId(),
      email,
      source,
    }).onConflictDoNothing();

    return c.json({ success: true, message: "You're subscribed!" }, 201);
  } catch {
    return c.json({ error: 'Failed to subscribe' }, 500);
  }
});
