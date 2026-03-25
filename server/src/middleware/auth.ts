import { Context, Next } from 'hono';
import { jwtVerify } from 'jose';
import { eq, and, gt } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { Env, Variables } from '../index';

export const authMiddleware = async (
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized - No token provided' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    if (!payload.sub) {
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    const db = c.get('db');

    // Check if the session exists and hasn't been revoked
    const session = await db.query.sessions.findFirst({
      where: and(
        eq(schema.sessions.token, token),
        gt(schema.sessions.expiresAt, new Date()),
      ),
    });

    if (!session) {
      return c.json({ error: 'Unauthorized - Session expired or revoked' }, 401);
    }

    // Get user from database
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, payload.sub as string),
    });

    if (!user) {
      return c.json({ error: 'Unauthorized - User not found' }, 401);
    }

    c.set('user', user);
    await next();
  } catch {
    return c.json({ error: 'Unauthorized - Invalid token' }, 401);
  }
};

// Optional auth - doesn't fail if no token, just doesn't set user
export const optionalAuthMiddleware = async (
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) => {
  const authHeader = c.req.header('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    try {
      const secret = new TextEncoder().encode(c.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ['HS256'],
      });

      if (payload.sub) {
        const db = c.get('db');

        // Verify session is still valid (not revoked/expired)
        const session = await db.query.sessions.findFirst({
          where: and(
            eq(schema.sessions.token, token),
            gt(schema.sessions.expiresAt, new Date()),
          ),
        });

        if (session) {
          const user = await db.query.users.findFirst({
            where: eq(schema.users.id, payload.sub as string),
          });

          if (user) {
            c.set('user', user);
          }
        }
      }
    } catch {
      // Token invalid, but we continue without user
    }
  }

  await next();
};
