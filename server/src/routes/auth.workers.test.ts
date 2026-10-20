import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { authRoutes } from './auth';
import { mountWithDb } from '../../test/testApp';
import * as schema from '../db/schema';

describe('auth routes (workers pool)', () => {
  it('GET /me returns 401 when no token is provided (authMiddleware)', async () => {
    const app = mountWithDb(authRoutes);
    const res = await app.request('/me', {}, env);
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/unauthorized/i);
  });

  // Two PBKDF2 hashes + a cold workerd boot can exceed vitest's 5s default on CI.
  it('register -> login round trip: a freshly registered user can log back in with the same credentials', { timeout: 30_000 }, async () => {
    const app = mountWithDb(authRoutes);

    const registerRes = await app.request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'workers-pool-test@example.com',
        password: 'correct-horse-battery-staple',
        username: 'workers_pool_test',
      }),
    }, env);
    expect(registerRes.status).toBe(201);
    const registerBody = await registerRes.json() as { token: string; user: { email: string } };
    expect(registerBody.token).toBeTruthy();
    expect(registerBody.user.email).toBe('workers-pool-test@example.com');

    // Tokens carry a random `jti` claim, so registering and immediately logging
    // back in within the same second still produces two distinct session
    // tokens — no need to wait out the clock for sessions.token's UNIQUE
    // constraint.
    const loginRes = await app.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'workers-pool-test@example.com',
        password: 'correct-horse-battery-staple',
      }),
    }, env);
    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json() as { token: string };
    expect(loginBody.token).toBeTruthy();
    expect(loginBody.token).not.toBe(registerBody.token);
  });

  it('PUT /profile resets email verification and re-issues a token when the email changes', { timeout: 30_000 }, async () => {
    const app = mountWithDb(authRoutes);

    const registerRes = await app.request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'change-email-test@example.com',
        password: 'correct-horse-battery-staple',
        username: 'change_email_test',
      }),
    }, env);
    expect(registerRes.status).toBe(201);
    const registerBody = await registerRes.json() as { token: string; user: { id: string } };
    const userId = registerBody.user.id;

    // Simulate an already-verified account before changing the email.
    const db = drizzle(env.DB, { schema });
    await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, userId));

    const profileRes = await app.request('/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${registerBody.token}`,
      },
      body: JSON.stringify({ email: 'new-address-test@example.com' }),
    }, env);
    expect(profileRes.status).toBe(200);
    const profileBody = await profileRes.json() as { user: { email: string; emailVerifiedAt: string | null } };
    expect(profileBody.user.email).toBe('new-address-test@example.com');
    expect(profileBody.user.emailVerifiedAt).toBeNull();

    // A fresh verification token should have been issued for the new address.
    const tokens = await db.query.emailVerificationTokens.findMany({ where: eq(schema.emailVerificationTokens.userId, userId) });
    expect(tokens.length).toBeGreaterThan(0);
  });

  it('PUT /profile leaves email verification untouched when the email is not changed', async () => {
    const app = mountWithDb(authRoutes);

    const registerRes = await app.request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'keep-email-test@example.com',
        password: 'correct-horse-battery-staple',
        username: 'keep_email_test',
      }),
    }, env);
    const registerBody = await registerRes.json() as { token: string; user: { id: string } };
    const userId = registerBody.user.id;

    const db = drizzle(env.DB, { schema });
    await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, userId));

    const profileRes = await app.request('/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${registerBody.token}`,
      },
      body: JSON.stringify({ username: 'keep_email_test_renamed' }),
    }, env);
    expect(profileRes.status).toBe(200);
    const profileBody = await profileRes.json() as { user: { username: string; emailVerifiedAt: string | null } };
    expect(profileBody.user.username).toBe('keep_email_test_renamed');
    expect(profileBody.user.emailVerifiedAt).not.toBeNull();
  });
});
