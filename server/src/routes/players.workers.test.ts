import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { playerRoutes } from './players';
import * as schema from '../db/schema';
import { mountWithDb } from '../../test/testApp';

describe('GET /api/players (workers pool)', () => {
  it('returns 200 with an inserted player on the happy path', async () => {
    const db = drizzle(env.DB, { schema });
    await db.insert(schema.nflPlayers).values({
      id: 'wp-test-1',
      externalId: 'ext-wp-test-1',
      name: 'Workers Pool Test Player',
      team: 'KC',
      position: 'WR',
      status: 'active',
    });

    const app = mountWithDb(playerRoutes);
    const res = await app.request('/?search=Workers Pool', {}, env);

    expect(res.status).toBe(200);
    const body = await res.json() as { players: Array<{ id: string; name: string }>; pagination: { total: number } };
    expect(body.players.some((p) => p.id === 'wp-test-1')).toBe(true);
    expect(body.pagination.total).toBeGreaterThanOrEqual(1);
  });
});
