import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { authRoutes } from './auth';
import { mountWithDb } from '../../test/testApp';

describe('auth routes (workers pool)', () => {
  it('GET /me returns 401 when no token is provided (authMiddleware)', async () => {
    const app = mountWithDb(authRoutes);
    const res = await app.request('/me', {}, env);
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/unauthorized/i);
  });

  it('register -> login round trip: a freshly registered user can log back in with the same credentials', async () => {
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

    // JWTs here are signed with second-granularity `iat` (jose's setIssuedAt()),
    // and the same user id + same second produces a byte-identical HS256 token.
    // sessions.token has a UNIQUE constraint, so logging in again in the same
    // second as registration would collide on insert — wait for the clock to
    // tick over so login gets its own distinct session token.
    await new Promise((resolve) => setTimeout(resolve, 1100));

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
  });
});
