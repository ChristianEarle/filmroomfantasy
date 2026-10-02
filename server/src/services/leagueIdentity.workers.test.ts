import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { generateId } from '../utils/id';
import { mergeLeagueInto } from './leagueIdentity';

describe('league identity (workers pool)', () => {
  const db = () => drizzle(env.DB, { schema });

  async function user(d: ReturnType<typeof db>) {
    const id = generateId();
    await d.insert(schema.users).values({ id, email: `${id}@test.local`, username: `u-${id}` });
    return id;
  }

  it('rejects a second row for the same platform league (0050 unique index)', async () => {
    const d = db();
    const ext = `sl-${generateId()}`;
    await d.insert(schema.leagues).values({ id: generateId(), name: 'A', platform: 'sleeper', externalId: ext, seasonYear: 2099 });
    await expect(
      d.insert(schema.leagues).values({ id: generateId(), name: 'B', platform: 'sleeper', externalId: ext, seasonYear: 2099 }),
    ).rejects.toThrow(/UNIQUE/);
    // Custom leagues have no external id and are unaffected.
    await d.insert(schema.leagues).values({ id: generateId(), name: 'Custom 1', seasonYear: 2099 });
    await d.insert(schema.leagues).values({ id: generateId(), name: 'Custom 2', seasonYear: 2099 });
  });

  it('folds a duplicate league into the survivor: members carry over, rights are kept, the copy cascades away', async () => {
    const d = db();
    const owner = await user(d);
    const both = await user(d);
    const onlyLoser = await user(d);

    const keeper = generateId();
    const loser = generateId();
    await d.insert(schema.leagues).values([
      { id: keeper, name: 'Survivor', platform: 'sleeper', externalId: `sl-${keeper}`, seasonYear: 2099 },
      { id: loser, name: 'Duplicate', platform: 'sleeper', externalId: `sl-${loser}`, seasonYear: 2099 },
    ]);
    await d.insert(schema.leagueMembers).values([
      { id: generateId(), userId: owner, leagueId: keeper, role: 'commissioner' },
      { id: generateId(), userId: both, leagueId: keeper, role: 'member', externalUsername: null },
      { id: generateId(), userId: both, leagueId: loser, role: 'commissioner', externalUsername: 'sleeper-both' },
      { id: generateId(), userId: onlyLoser, leagueId: loser, role: 'member', externalUsername: 'sleeper-only' },
    ]);
    const t1 = generateId();
    const t2 = generateId();
    await d.insert(schema.teams).values([
      { id: t1, leagueId: loser, ownerId: both, name: 'Copy A', externalTeamId: '1' },
      { id: t2, leagueId: loser, ownerId: both, name: 'Copy B', externalTeamId: '2' },
    ]);
    await d.insert(schema.matchups).values({ id: generateId(), leagueId: loser, week: 1, homeTeamId: t1, awayTeamId: t2 });

    const out = await mergeLeagueInto(d, keeper, loser);

    expect(out.membersMoved).toBe(1);
    expect(await d.query.leagues.findFirst({ where: eq(schema.leagues.id, loser) })).toBeUndefined();
    const members = await d.query.leagueMembers.findMany({ where: eq(schema.leagueMembers.leagueId, keeper) });
    const byUser = new Map(members.map((m) => [m.userId, m]));
    expect(byUser.size).toBe(3);
    expect(byUser.get(both)?.role).toBe('commissioner');
    expect(byUser.get(both)?.externalUsername).toBe('sleeper-both');
    expect(byUser.get(onlyLoser)?.externalUsername).toBe('sleeper-only');
    expect(await d.query.teams.findMany({ where: eq(schema.teams.leagueId, loser) })).toHaveLength(0);
    expect(await d.query.matchups.findMany({ where: eq(schema.matchups.leagueId, loser) })).toHaveLength(0);
  });
});
