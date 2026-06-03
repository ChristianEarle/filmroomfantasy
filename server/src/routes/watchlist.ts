import { Hono } from 'hono';
import { and, eq, desc } from 'drizzle-orm';
import * as schema from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { generateId } from '../utils/id';
import type { Env, Variables } from '../index';

export const watchlistRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Every watchlist route requires a logged-in user; all queries below are scoped
// to that user's id from the JWT (never a client-supplied id) to prevent IDOR.
watchlistRoutes.use('*', authMiddleware);

/**
 * GET /api/watchlist
 * Returns the authenticated user's watched players (newest first), joined with
 * player metadata so callers can render a list without a second lookup.
 */
watchlistRoutes.get('/', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const players = await db
      .select({
        playerId: schema.userPlayerWatchlist.playerId,
        addedAt: schema.userPlayerWatchlist.createdAt,
        name: schema.nflPlayers.name,
        position: schema.nflPlayers.position,
        team: schema.nflPlayers.team,
        headshotUrl: schema.nflPlayers.headshotUrl,
      })
      .from(schema.userPlayerWatchlist)
      .innerJoin(schema.nflPlayers, eq(schema.userPlayerWatchlist.playerId, schema.nflPlayers.id))
      .where(eq(schema.userPlayerWatchlist.userId, user.id))
      .orderBy(desc(schema.userPlayerWatchlist.createdAt));

    return c.json({ players });
  } catch (err) {
    console.error('[watchlist] list error:', err);
    return c.json({ error: 'Failed to load watchlist' }, 500);
  }
});

/**
 * POST /api/watchlist  { playerId }
 * Adds a player to the user's watchlist. Idempotent via the unique
 * (user_id, player_id) index. Validates the player exists first so we don't
 * rely solely on FK enforcement (which requires PRAGMA foreign_keys in SQLite).
 */
watchlistRoutes.post('/', rateLimit(60, 60_000), async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  let body: { playerId?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }
  const playerId = typeof body.playerId === 'string' ? body.playerId.trim() : '';
  if (!playerId) return c.json({ error: 'playerId required' }, 400);

  try {
    const player = await db.query.nflPlayers.findFirst({
      where: eq(schema.nflPlayers.id, playerId),
      columns: { id: true },
    });
    if (!player) return c.json({ error: 'Player not found' }, 404);

    await db
      .insert(schema.userPlayerWatchlist)
      .values({ id: generateId(), userId: user.id, playerId, createdAt: new Date() })
      .onConflictDoNothing();

    return c.json({ ok: true, playerId });
  } catch (err) {
    console.error('[watchlist] add error:', err);
    return c.json({ error: 'Failed to add to watchlist' }, 500);
  }
});

/**
 * DELETE /api/watchlist/:playerId
 * Removes a player from the user's watchlist. Scoped to the user's id.
 */
watchlistRoutes.delete('/:playerId', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const playerId = c.req.param('playerId');
  if (!playerId) return c.json({ error: 'playerId required' }, 400);

  try {
    await db
      .delete(schema.userPlayerWatchlist)
      .where(
        and(
          eq(schema.userPlayerWatchlist.userId, user.id),
          eq(schema.userPlayerWatchlist.playerId, playerId),
        ),
      );
    return c.json({ ok: true, playerId });
  } catch (err) {
    console.error('[watchlist] remove error:', err);
    return c.json({ error: 'Failed to remove from watchlist' }, 500);
  }
});
