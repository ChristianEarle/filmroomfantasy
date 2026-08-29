import { jwtVerify } from 'jose';
import { eq, and, gt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

/**
 * Resolve the authenticated user for a raw JWT, enforcing the same checks as the
 * main authMiddleware: valid HS256 signature AND a matching, non-expired,
 * non-revoked row in the sessions table. Returns null on any failure.
 *
 * Used by the admin route middlewares so that revoking a session (logout,
 * password reset, incident response) immediately cuts off admin API access
 * instead of waiting for the JWT to expire on its own.
 */
export async function resolveSessionUser(
  token: string,
  db: ReturnType<typeof drizzle<typeof schema>>,
  jwtSecret: string,
): Promise<schema.User | null> {
  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    if (!payload.sub) return null;

    const session = await db.query.sessions.findFirst({
      where: and(
        eq(schema.sessions.token, token),
        gt(schema.sessions.expiresAt, new Date()),
      ),
    });
    if (!session) return null;

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, payload.sub as string),
    });
    return user ?? null;
  } catch {
    return null;
  }
}
