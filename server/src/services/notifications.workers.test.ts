import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { generateId } from '../utils/id';
import { generateInjuryNewsNotifications } from './notifications';

describe('generateInjuryNewsNotifications (workers pool)', () => {
  const db = () => drizzle(env.DB, { schema });

  async function seedPlayer(status: 'questionable' | 'out' = 'questionable') {
    const d = db();
    const playerId = generateId();
    await d.insert(schema.nflPlayers).values({
      id: playerId,
      name: `Watched Player ${playerId}`,
      team: 'KC',
      position: 'RB',
      status,
    });
    return playerId;
  }

  async function seedInjuryNews(playerId: string) {
    const d = db();
    const newsId = generateId();
    await d.insert(schema.playerNews).values({
      id: newsId,
      playerId,
      headline: 'Ruled out for Sunday with a hamstring injury',
      content: 'The team announced he is ruled out with a hamstring injury.',
      source: 'RSS',
      impactLevel: 'high',
      publishedAt: new Date(),
    });
    return newsId;
  }

  it('skips a user who disabled notifications but still notifies a watchlister with them enabled', async () => {
    const d = db();
    const playerId = await seedPlayer();
    await seedInjuryNews(playerId);

    const optedOut = generateId();
    const optedIn = generateId();
    await d.insert(schema.users).values([
      { id: optedOut, email: `${optedOut}@test.local`, username: `u-${optedOut}`, notificationsEnabled: false },
      { id: optedIn, email: `${optedIn}@test.local`, username: `u-${optedIn}`, notificationsEnabled: true },
    ]);
    await d.insert(schema.userPlayerWatchlist).values([
      { id: generateId(), userId: optedOut, playerId },
      { id: generateId(), userId: optedIn, playerId },
    ]);

    await generateInjuryNewsNotifications(d);

    const rows = await d.query.notifications.findMany({ where: eq(schema.notifications.playerId, playerId) });
    expect(rows.map((r) => r.userId)).toEqual([optedIn]);
  });

  it('defaults to notifying a watchlister whose notificationsEnabled column is unset', async () => {
    const d = db();
    const playerId = await seedPlayer('out');
    await seedInjuryNews(playerId);

    const user = generateId();
    await d.insert(schema.users).values({ id: user, email: `${user}@test.local`, username: `u-${user}` });
    await d.insert(schema.userPlayerWatchlist).values({ id: generateId(), userId: user, playerId });

    await generateInjuryNewsNotifications(d);

    const rows = await d.query.notifications.findMany({ where: eq(schema.notifications.playerId, playerId) });
    expect(rows.map((r) => r.userId)).toEqual([user]);
  });
});
