import { Hono } from 'hono';
import { eq, desc, and, inArray } from 'drizzle-orm';
import * as schema from '../db/schema';
import { generateId } from '../utils/id';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import { resolveSessionUser } from '../utils/sessionUser';
import type { Env, Variables } from '../index';

export const articleRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

const VALID_CATEGORIES = ['strategy', 'rankings', 'news', 'tools', 'beginners'] as const;
const VALID_STATUSES = ['draft', 'published'] as const;

/** Generate a URL-safe slug from a title */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Estimate reading time from HTML content */
function estimateReadingTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, '').trim();
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 225));
}

// ============================================
// PUBLIC ENDPOINTS
// ============================================

// GET /api/articles — List published articles (public)
articleRoutes.get('/', async (c) => {
  const db = c.get('db');
  const category = c.req.query('category');

  const conditions = [eq(schema.articles.status, 'published')];
  if (category && VALID_CATEGORIES.includes(category as any)) {
    conditions.push(eq(schema.articles.category, category));
  }

  const items = await db.query.articles.findMany({
    where: and(...conditions),
    orderBy: [desc(schema.articles.publishedAt)],
  });

  // Parse tags JSON for each article
  const parsed = items.map(a => ({
    ...a,
    tags: JSON.parse(a.tags || '[]') as string[],
  }));

  return c.json({ articles: parsed });
});

// ============================================
// ADMIN ENDPOINTS (must be registered before /:slug catch-all)
// ============================================

// Extract user from JWT before admin auth check (same pattern as analytics/admin-stats routes)
articleRoutes.use('/admin/*', async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    await next();
    return;
  }

  const { getCookie } = await import('hono/cookie');
  const cookieToken = getCookie(c, 'auth_token');
  const authHeader = c.req.header('Authorization');
  const token = cookieToken || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

  if (token) {
    // Verify JWT *and* the session row so revoked sessions lose admin access.
    const user = await resolveSessionUser(token, c.get('db'), c.env.JWT_SECRET);
    if (user) c.set('user', user);
  }

  await adminAuthMiddleware(c, next);
});

// GET /api/articles/admin/all — List all articles including drafts (admin only)
articleRoutes.get('/admin/all', async (c) => {
  const db = c.get('db');

  const items = await db.query.articles.findMany({
    orderBy: [desc(schema.articles.updatedAt)],
    with: {
      playerLinks: {
        with: { player: true },
      },
    },
  });

  const parsed = items.map(a => ({
    ...a,
    tags: JSON.parse(a.tags || '[]') as string[],
    players: a.playerLinks.map((lnk: any) => lnk.player).filter(Boolean),
    playerIds: a.playerLinks.map((lnk: any) => lnk.playerId),
  }));

  return c.json({ articles: parsed });
});

// POST /api/articles/admin — Create a new article (admin only)
articleRoutes.post('/admin', async (c) => {
  const db = c.get('db');
  const body = await c.req.json();

  const { title, description, content, category, tags, author, status, imageUrl, playerIds } = body;

  if (!title || typeof title !== 'string' || title.trim().length < 1) {
    return c.json({ error: 'Title is required' }, 400);
  }
  if (!description || typeof description !== 'string' || description.trim().length < 1) {
    return c.json({ error: 'Description is required' }, 400);
  }
  if (!content || typeof content !== 'string' || content.trim().length < 1) {
    return c.json({ error: 'Content is required' }, 400);
  }
  if (!category || !VALID_CATEGORIES.includes(category as any)) {
    return c.json({ error: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` }, 400);
  }

  const slug = slugify(title);

  // Check for duplicate slug
  const existing = await db.query.articles.findFirst({
    where: eq(schema.articles.slug, slug),
  });
  if (existing) {
    return c.json({ error: 'An article with a similar title already exists' }, 409);
  }

  const effectiveStatus = status && VALID_STATUSES.includes(status) ? status : 'draft';
  const id = generateId();
  const now = new Date();

  await db.insert(schema.articles).values({
    id,
    slug,
    title: title.trim(),
    description: description.trim(),
    content: content.trim(),
    category,
    tags: JSON.stringify(Array.isArray(tags) ? tags : []),
    author: author || 'FilmRoom',
    status: effectiveStatus,
    readingTime: estimateReadingTime(content),
    imageUrl: imageUrl || null,
    publishedAt: effectiveStatus === 'published' ? now.toISOString().split('T')[0] : null,
    createdAt: now,
    updatedAt: now,
  });

  // Link players to this article
  const validPlayerIds = Array.isArray(playerIds) ? playerIds.filter((id: any) => typeof id === 'string') : [];
  if (validPlayerIds.length > 0) {
    await db.insert(schema.articlePlayers).values(
      validPlayerIds.map((pid: string) => ({ articleId: id, playerId: pid }))
    );
  }

  const article = await db.query.articles.findFirst({
    where: eq(schema.articles.id, id),
    with: {
      playerLinks: {
        with: { player: true },
      },
    },
  });

  return c.json({
    article: {
      ...article,
      tags: JSON.parse(article?.tags || '[]'),
      players: article?.playerLinks?.map((lnk: any) => lnk.player).filter(Boolean) || [],
      playerIds: article?.playerLinks?.map((lnk: any) => lnk.playerId) || [],
    },
  }, 201);
});

// PUT /api/articles/admin/:id — Update an article (admin only)
articleRoutes.put('/admin/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const body = await c.req.json();

  const existing = await db.query.articles.findFirst({
    where: eq(schema.articles.id, id),
  });
  if (!existing) {
    return c.json({ error: 'Article not found' }, 404);
  }

  const { title, description, content, category, tags, author, status, imageUrl, playerIds } = body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length < 1) {
      return c.json({ error: 'Title cannot be empty' }, 400);
    }
    updates.title = title.trim();
    updates.slug = slugify(title);

    // Check slug collision (exclude self)
    const slugCollision = await db.query.articles.findFirst({
      where: and(
        eq(schema.articles.slug, updates.slug as string),
      ),
    });
    if (slugCollision && slugCollision.id !== id) {
      return c.json({ error: 'An article with a similar title already exists' }, 409);
    }
  }

  if (description !== undefined) updates.description = description.trim();
  if (content !== undefined) {
    updates.content = content.trim();
    updates.readingTime = estimateReadingTime(content);
  }
  if (category !== undefined) {
    if (!VALID_CATEGORIES.includes(category as any)) {
      return c.json({ error: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` }, 400);
    }
    updates.category = category;
  }
  if (tags !== undefined) updates.tags = JSON.stringify(Array.isArray(tags) ? tags : []);
  if (author !== undefined) updates.author = author;
  if (imageUrl !== undefined) updates.imageUrl = imageUrl || null;

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status as any)) {
      return c.json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` }, 400);
    }
    updates.status = status;
    // Set publishedAt when first publishing
    if (status === 'published' && !existing.publishedAt) {
      updates.publishedAt = new Date().toISOString().split('T')[0];
    }
  }

  await db.update(schema.articles).set(updates).where(eq(schema.articles.id, id));

  // Update player associations if provided
  if (playerIds !== undefined) {
    // Remove existing associations
    await db.delete(schema.articlePlayers).where(eq(schema.articlePlayers.articleId, id));
    // Insert new ones
    const validPlayerIds = Array.isArray(playerIds) ? playerIds.filter((pid: any) => typeof pid === 'string') : [];
    if (validPlayerIds.length > 0) {
      await db.insert(schema.articlePlayers).values(
        validPlayerIds.map((pid: string) => ({ articleId: id, playerId: pid }))
      );
    }
  }

  const updated = await db.query.articles.findFirst({
    where: eq(schema.articles.id, id),
    with: {
      playerLinks: {
        with: { player: true },
      },
    },
  });

  return c.json({
    article: {
      ...updated,
      tags: JSON.parse(updated?.tags || '[]'),
      players: updated?.playerLinks?.map((lnk: any) => lnk.player).filter(Boolean) || [],
      playerIds: updated?.playerLinks?.map((lnk: any) => lnk.playerId) || [],
    },
  });
});

// DELETE /api/articles/admin/:id — Delete an article (admin only)
articleRoutes.delete('/admin/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');

  const existing = await db.query.articles.findFirst({
    where: eq(schema.articles.id, id),
  });
  if (!existing) {
    return c.json({ error: 'Article not found' }, 404);
  }

  await db.delete(schema.articles).where(eq(schema.articles.id, id));

  return c.json({ success: true, message: 'Article deleted' });
});

// GET /api/articles/:slug — Get single published article by slug (public)
// NOTE: This catch-all must be LAST so it doesn't intercept /admin/* routes
articleRoutes.get('/:slug', async (c) => {
  const db = c.get('db');
  const slug = c.req.param('slug');

  const article = await db.query.articles.findFirst({
    where: and(
      eq(schema.articles.slug, slug),
      eq(schema.articles.status, 'published'),
    ),
  });

  if (!article) {
    return c.json({ error: 'Article not found' }, 404);
  }

  return c.json({
    article: {
      ...article,
      tags: JSON.parse(article.tags || '[]') as string[],
    },
  });
});
