import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { jwtVerify } from 'jose';
import { eq, and, gt } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { Env, Variables } from '../index';
import { isLocalDevRequest } from './tier';

const AUTH_COOKIE_NAME = 'auth_token';

/**
 * Extract the auth token from the request.
 * Reads from httpOnly cookie first (secure, preferred).
 * Falls back to Authorization header for backwards compatibility during migration.
 */
function getAuthToken(c: Context): string | undefined {
  // Prefer httpOnly cookie (not accessible to JavaScript — XSS-safe)
  const cookieToken = getCookie(c, AUTH_COOKIE_NAME);
  if (cookieToken) return cookieToken;

  // Fallback: Authorization header (for API clients, mobile apps, etc.)
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return undefined;
}

/**
 * Local-dev auto-login. When `DEV_AUTO_LOGIN_EMAIL` is set (server/.dev.vars,
 * gitignored), requests that carry NO auth token are treated as that user —
 * so the login form can be skipped entirely on localhost. It applies only when
 * all four hold: the var is set, `ENVIRONMENT` is not 'production', the
 * request Host header is a local host, AND the request URL's own hostname
 * (from `c.req.url`, not attacker-controllable the way a Host header can be)
 * is ALSO a local host. Requiring both closes the gap where a spoofed/forwarded
 * Host header could otherwise trick this into auto-logging in a request whose
 * real URL is not local. A real token always takes precedence, and the
 * user row must exist (create it once with scripts/seed-dev-league.mjs).
 * Note: after "Sign out" the next request auto-logs-in again — that's expected.
 */
export function shouldDevAutoLogin(
  env: Pick<Env, 'ENVIRONMENT'> & { DEV_AUTO_LOGIN_EMAIL?: string },
  hostHeader: string | undefined | null,
  urlHostname: string | undefined | null,
): string | null {
  const email = env.DEV_AUTO_LOGIN_EMAIL?.trim().toLowerCase();
  if (!email) return null;
  if (env.ENVIRONMENT === 'production') return null;
  if (!isLocalDevRequest(hostHeader) || !isLocalDevRequest(urlHostname)) return null;
  return email;
}

async function resolveDevAutoLoginUser(c: Context<{ Bindings: Env; Variables: Variables }>) {
  let urlHostname: string | null = null;
  try {
    urlHostname = new URL(c.req.url).hostname;
  } catch {
    urlHostname = null;
  }
  const email = shouldDevAutoLogin(c.env, c.req.header('host'), urlHostname);
  if (!email) return null;
  const db = c.get('db');
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!user) {
    console.warn(`[auth] DEV_AUTO_LOGIN_EMAIL is set but no user exists for ${email}`);
    return null;
  }
  return user;
}

export const authMiddleware = async (
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) => {
  const token = getAuthToken(c);

  if (!token) {
    const devUser = await resolveDevAutoLoginUser(c);
    if (devUser) {
      c.set('user', devUser);
      await next();
      return;
    }
    return c.json({ error: 'Unauthorized - No token provided' }, 401);
  }

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
  const token = getAuthToken(c);

  if (!token) {
    const devUser = await resolveDevAutoLoginUser(c);
    if (devUser) c.set('user', devUser);
  }

  if (token) {
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
