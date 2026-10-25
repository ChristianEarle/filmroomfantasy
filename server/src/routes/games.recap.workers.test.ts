import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { gameRoutes } from './games';
import { authRoutes } from './auth';
import * as schema from '../db/schema';
import { mountWithDb } from '../../test/testApp';

/**
 * End-to-end coverage for GET /api/games/:id/recap: a real registered+promoted
 * Pro user, a real seeded finalized game + one player's box-score line, and a
 * mocked Anthropic `fetch` — verifies the tier gate, the "not final yet" gate,
 * that a successful generation is cached, and that a cache hit never calls
 * Anthropic again.
 */
describe('GET /api/games/:id/recap (workers pool, mocked Anthropic)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function registerProUser(authApp: ReturnType<typeof mountWithDb>, db: ReturnType<typeof drizzle>, email: string) {
    const registerRes = await authApp.request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'correct-horse-battery-staple',
        username: email.split('@')[0],
      }),
    }, env);
    expect(registerRes.status).toBe(201);
    const registerBody = await registerRes.json() as { token: string; user: { id: string } };
    await db.update(schema.users).set({ subscriptionTier: 'pro' }).where(eq(schema.users.id, registerBody.user.id));
    return registerBody.token;
  }

  it('generates and caches a recap for a finalized game', async () => {
    const db = drizzle(env.DB, { schema });
    const authApp = mountWithDb(authRoutes);
    const gameApp = mountWithDb(gameRoutes);
    const envWithKey = { ...env, ANTHROPIC_API_KEY: 'test-anthropic-key' } as typeof env;

    const token = await registerProUser(authApp, db, 'recap-pro-user@example.com');

    const gameId = 'recap-test-game-1';
    await db.insert(schema.nflGames).values({
      id: gameId,
      week: 1,
      seasonYear: 2099,
      seasonType: 'regular',
      homeTeam: 'KC',
      awayTeam: 'BUF',
      gameTime: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6h ago — final
      homeScore: 27,
      awayScore: 20,
      spread: -2.5,
      overUnder: 45.5,
      isComplete: true,
    });

    await db.insert(schema.nflPlayers).values({
      id: 'recap-test-player-1',
      externalId: 'ext-recap-test-player-1',
      name: 'Test Star QB',
      team: 'KC',
      position: 'QB',
      status: 'active',
    });
    await db.insert(schema.playerWeeklyStats).values({
      id: 'recap-test-stat-1',
      playerId: 'recap-test-player-1',
      week: 1,
      seasonYear: 2099,
      opponent: 'BUF',
      passYards: 310,
      passTDs: 3,
      passAttempts: 32,
      fantasyPointsPPR: 26.4,
    });

    const fetchCalls: { url: string; body: any }[] = [];
    const mockFetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : null;
      fetchCalls.push({ url: String(url), body });
      return new Response(JSON.stringify({
        content: [{ type: 'text', text: 'KC held on late. Test Star QB carried the offense.' }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await gameApp.request(`/${gameId}/recap`, {
      headers: { Authorization: `Bearer ${token}` },
    }, envWithKey);

    const body = await res.json() as { recap: string; cached: boolean };
    expect(res.status, JSON.stringify(body)).toBe(200);
    expect(body.cached).toBe(false);
    expect(body.recap).toBe('KC held on late. Test Star QB carried the offense.');
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toBe('https://api.anthropic.com/v1/messages');

    const dataBlock = fetchCalls[0].body.messages[0].content as string;
    expect(dataBlock).toContain('Test Star QB');
    expect(dataBlock).toContain('26.4');

    const cachedRow = await db.query.gameAiRecaps.findFirst({ where: eq(schema.gameAiRecaps.gameId, gameId) });
    expect(cachedRow?.recap).toBe('KC held on late. Test Star QB carried the offense.');

    // Second request must hit the cache — no second Anthropic call.
    const res2 = await gameApp.request(`/${gameId}/recap`, {
      headers: { Authorization: `Bearer ${token}` },
    }, envWithKey);
    const body2 = await res2.json() as { recap: string; cached: boolean };
    expect(res2.status).toBe(200);
    expect(body2.cached).toBe(true);
    expect(body2.recap).toBe(body.recap);
    expect(fetchCalls).toHaveLength(1);
  });

  it('rejects a free-tier user with 403', async () => {
    const db = drizzle(env.DB, { schema });
    const authApp = mountWithDb(authRoutes);
    const gameApp = mountWithDb(gameRoutes);

    const registerRes = await authApp.request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'recap-free-user@example.com',
        password: 'correct-horse-battery-staple',
        username: 'recap_free_user',
      }),
    }, env);
    const { token } = await registerRes.json() as { token: string };

    const gameId = 'recap-test-game-free-tier';
    await db.insert(schema.nflGames).values({
      id: gameId,
      week: 2,
      seasonYear: 2099,
      seasonType: 'regular',
      homeTeam: 'KC',
      awayTeam: 'BUF',
      gameTime: new Date(Date.now() - 6 * 60 * 60 * 1000),
      homeScore: 27,
      awayScore: 20,
      isComplete: true,
    });

    const res = await gameApp.request(`/${gameId}/recap`, {
      headers: { Authorization: `Bearer ${token}` },
    }, { ...env, ANTHROPIC_API_KEY: 'test-anthropic-key' } as typeof env);
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const gameApp = mountWithDb(gameRoutes);
    const res = await gameApp.request('/some-game-id/recap', {}, { ...env, ANTHROPIC_API_KEY: 'test-anthropic-key' } as typeof env);
    expect(res.status).toBe(401);
  });

  it('returns 400 for a game that has not gone final yet', async () => {
    const db = drizzle(env.DB, { schema });
    const authApp = mountWithDb(authRoutes);
    const gameApp = mountWithDb(gameRoutes);

    const token = await registerProUser(authApp, db, 'recap-pro-notfinal@example.com');

    const gameId = 'recap-test-game-not-final';
    await db.insert(schema.nflGames).values({
      id: gameId,
      week: 3,
      seasonYear: 2099,
      seasonType: 'regular',
      homeTeam: 'KC',
      awayTeam: 'BUF',
      gameTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // kicks off tomorrow
      isComplete: false,
    });

    const res = await gameApp.request(`/${gameId}/recap`, {
      headers: { Authorization: `Bearer ${token}` },
    }, { ...env, ANTHROPIC_API_KEY: 'test-anthropic-key' } as typeof env);
    expect(res.status).toBe(400);
  });

  it('returns 503 when ANTHROPIC_API_KEY is not configured', async () => {
    const db = drizzle(env.DB, { schema });
    const authApp = mountWithDb(authRoutes);
    const gameApp = mountWithDb(gameRoutes);

    const token = await registerProUser(authApp, db, 'recap-pro-nokey@example.com');

    const gameId = 'recap-test-game-nokey';
    await db.insert(schema.nflGames).values({
      id: gameId,
      week: 4,
      seasonYear: 2099,
      seasonType: 'regular',
      homeTeam: 'KC',
      awayTeam: 'BUF',
      gameTime: new Date(Date.now() - 6 * 60 * 60 * 1000),
      isComplete: true,
      homeScore: 10,
      awayScore: 7,
    });

    const envNoKey = { ...env, ANTHROPIC_API_KEY: undefined } as typeof env;
    const res = await gameApp.request(`/${gameId}/recap`, {
      headers: { Authorization: `Bearer ${token}` },
    }, envNoKey);
    expect(res.status).toBe(503);
  });
});
