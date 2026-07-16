import { Hono } from 'hono';
import { and, eq, desc, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import type { Env, Variables } from '../index';

export const notificationRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Every notification route requires a logged-in user; all queries below are
// scoped to that user's id from the JWT (never a client-supplied id) to
// prevent IDOR. Available to all tiers — no tier gate.
notificationRoutes.use('*', authMiddleware);

/**
 * GET /api/notifications
 * Returns the authenticated user's latest 50 notifications (newest first)
 * plus their total unread count.
 */
notificationRoutes.get('/', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const items = await db
      .select({
        id: schema.notifications.id,
        type: schema.notifications.type,
        title: schema.notifications.title,
        body: schema.notifications.body,
        playerId: schema.notifications.playerId,
        link: schema.notifications.link,
        isRead: schema.notifications.isRead,
        createdAt: schema.notifications.createdAt,
      })
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, user.id))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(50);

    const [unread] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, user.id),
          eq(schema.notifications.isRead, false),
        ),
      );

    return c.json({ notifications: items, unreadCount: Number(unread?.count ?? 0) });
  } catch (err) {
    console.error('[notifications] list error:', err);
    return c.json({ error: 'Failed to load notifications' }, 500);
  }
});

/**
 * POST /api/notifications/:id/read
 * Marks one notification as read. Scoped to the user's id, so marking
 * another user's notification is a silent no-op (still returns ok to keep
 * the endpoint non-enumerable).
 */
notificationRoutes.post('/:id/read', rateLimit(120, 60_000), async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  if (!id) return c.json({ error: 'id required' }, 400);

  try {
    await db
      .update(schema.notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(schema.notifications.id, id),
          eq(schema.notifications.userId, user.id),
        ),
      );
    return c.json({ ok: true, id });
  } catch (err) {
    console.error('[notifications] mark read error:', err);
    return c.json({ error: 'Failed to mark notification read' }, 500);
  }
});

/**
 * POST /api/notifications/read-all
 * Marks all of the user's unread notifications as read.
 */
notificationRoutes.post('/read-all', rateLimit(30, 60_000), async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    await db
      .update(schema.notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(schema.notifications.userId, user.id),
          eq(schema.notifications.isRead, false),
        ),
      );
    return c.json({ ok: true });
  } catch (err) {
    console.error('[notifications] read-all error:', err);
    return c.json({ error: 'Failed to mark notifications read' }, 500);
  }
});
