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
});
