import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { adminRoutes } from './admin';
import * as schema from '../db/schema';
import type { Env, Variables } from '../index';

function stubOpenMeteo(entries: Array<{ hoursFromNow: number; temp: number; code: number }>) {
  const now = Date.now();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        hourly: {
          time: entries.map((e) => new Date(now + e.hoursFromNow * 3600000).toISOString().slice(0, 16)),
          temperature_2m: entries.map((e) => e.temp),
          weathercode: entries.map((e) => e.code),
        },
      }),
    } as unknown as Response),
  );
}

describe('POST /api/admin/sync-game-weather (workers pool)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes a real forecast onto upcoming outdoor games and skips indoor/far-out/complete ones', async () => {
    const db = drizzle(env.DB, { schema });
    const now = new Date();
    const gameTimeMs = now.getTime() + 3 * 24 * 60 * 60 * 1000; // 3 days out, inside the default 7-day window

    stubOpenMeteo([{ hoursFromNow: 3 * 24, temp: 48, code: 61 }]);

    // Outdoor, upcoming, incomplete — should get a real forecast.
    await db.insert(schema.nflGames).values({
      id: 'weather-test-outdoor',
      week: 5,
      seasonYear: 2099,
      homeTeam: 'GB', // outdoor
      awayTeam: 'CHI',
      gameTime: new Date(gameTimeMs),
      isComplete: false,
      weather: null,
    });

    // Indoor — should be skipped, weather left untouched.
    await db.insert(schema.nflGames).values({
      id: 'weather-test-indoor',
      week: 5,
      seasonYear: 2099,
      homeTeam: 'NO', // indoor
      awayTeam: 'CHI',
      gameTime: new Date(gameTimeMs),
      isComplete: false,
      weather: JSON.stringify({ displayValue: 'Indoor', temperature: 72 }),
    });

    // Outdoor but already final — outside the "upcoming" window, should be skipped.
    await db.insert(schema.nflGames).values({
      id: 'weather-test-complete',
      week: 4,
      seasonYear: 2099,
      homeTeam: 'GB',
      awayTeam: 'DET',
      gameTime: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      isComplete: true,
      weather: null,
    });

    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', async (c, next) => {
      c.set('db', db);
      await next();
    });
    app.route('/', adminRoutes);

    const res = await app.request('/sync-game-weather', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'test-sync-secret-for-vitest-only' },
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json() as { checked: number; updated: number; skipped: number };
    expect(body.checked).toBe(2); // the two upcoming, incomplete games
    expect(body.updated).toBe(1);
    expect(body.skipped).toBe(1);

    const outdoor = await db.query.nflGames.findFirst({ where: (t, { eq }) => eq(t.id, 'weather-test-outdoor') });
    expect(JSON.parse(outdoor!.weather!)).toEqual({ displayValue: 'Rain', temperature: 48 });

    const indoor = await db.query.nflGames.findFirst({ where: (t, { eq }) => eq(t.id, 'weather-test-indoor') });
    expect(JSON.parse(indoor!.weather!)).toEqual({ displayValue: 'Indoor', temperature: 72 });

    const complete = await db.query.nflGames.findFirst({ where: (t, { eq }) => eq(t.id, 'weather-test-complete') });
    expect(complete!.weather).toBeNull();
  });
});
