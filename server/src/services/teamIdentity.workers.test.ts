import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { generateId } from '../utils/id';
import { insertPlatformTeam, reconcileLeagueTeams } from './teamIdentity';

/**
 * Runs against in-memory D1 with every migration applied, including 0050's
 * unique index on (league_id, external_team_id). Each case reproduces a
 * ghost-team shape found in production on 2026-10-02.
 */
describe('reconcileLeagueTeams (workers pool)', () => {
  const db = () => drizzle(env.DB, { schema });
  const april = new Date('2099-04-11T00:00:00Z');
  const october = new Date('2099-10-02T00:00:00Z');

  async function seedLeague() {
    const d = db();
    const user = generateId();
    await d.insert(schema.users).values({ id: user, email: `${user}@test.local`, username: `u-${user}` });
    const leagueId = generateId();
    await d.insert(schema.leagues).values({ id: leagueId, name: 'Identity League', platform: 'sleeper', externalId: `sl-${leagueId}`, seasonYear: 2099 });
    return { d, user, leagueId };
  }

  async function teamIds(leagueId: string) {
    return (await db().query.teams.findMany({ where: eq(schema.teams.leagueId, leagueId) })).map((t) => t.id).sort();
  }

  it('merges two rows for one manager, keeps the fresh one, repoints matchups and stamps the roster id', async () => {
    const { d, user, leagueId } = await seedLeague();
    const stale = generateId();
    const fresh = generateId();
    const opp = generateId();
    await d.insert(schema.teams).values([
      { id: stale, leagueId, ownerId: user, externalOwnerId: 'mgr-a', name: 'Last Year', wins: 8, losses: 6, createdAt: april, updatedAt: april },
      { id: fresh, leagueId, ownerId: user, externalOwnerId: 'mgr-a', name: 'This Year', wins: 2, losses: 1, createdAt: april, updatedAt: october },
      { id: opp, leagueId, ownerId: user, externalOwnerId: 'mgr-b', name: 'Opp', createdAt: april, updatedAt: october },
    ]);
    const m1 = generateId();
    const m2 = generateId();
    await d.insert(schema.matchups).values([
      { id: m1, leagueId, week: 1, homeTeamId: stale, awayTeamId: opp, isComplete: true },
      { id: m2, leagueId, week: 2, homeTeamId: opp, awayTeamId: stale, isComplete: true },
    ]);

    const result = await reconcileLeagueTeams(d, leagueId, [
      { externalTeamId: '1', legacyOwnerKey: 'mgr-a' },
      { externalTeamId: '2', legacyOwnerKey: 'mgr-b' },
    ]);

    expect(result.merged).toEqual([{ externalTeamId: '1', keptTeamId: fresh, removedTeamIds: [stale] }]);
    expect(await teamIds(leagueId)).toEqual([fresh, opp].sort());
    expect(result.teamsByExternalTeamId.get('1')?.id).toBe(fresh);
    expect((await d.query.teams.findFirst({ where: eq(schema.teams.id, fresh) }))?.externalTeamId).toBe('1');
    expect((await d.query.teams.findFirst({ where: eq(schema.teams.id, opp) }))?.externalTeamId).toBe('2');
    const ms = await d.query.matchups.findMany({ where: eq(schema.matchups.leagueId, leagueId) });
    expect(ms.find((m) => m.id === m1)?.homeTeamId).toBe(fresh);
    expect(ms.find((m) => m.id === m2)?.awayTeamId).toBe(fresh);
  });

  it('folds a member’s /connect placeholder into their real roster row (the 11-league shape)', async () => {
    const { d, user, leagueId } = await seedLeague();
    const member = generateId();
    await d.insert(schema.users).values({ id: member, email: `${member}@test.local`, username: `u-${member}` });
    const real = generateId();
    const placeholder = generateId();
    await d.insert(schema.teams).values([
      { id: real, leagueId, ownerId: user, externalOwnerId: 'mgr-m', name: 'Real Roster', createdAt: april, updatedAt: april },
      { id: placeholder, leagueId, ownerId: member, externalOwnerId: null, name: "member's Team", createdAt: october, updatedAt: october },
    ]);

    const result = await reconcileLeagueTeams(d, leagueId, [{ externalTeamId: '7', legacyOwnerKey: 'mgr-m', appUserId: member }]);

    expect(result.merged).toEqual([{ externalTeamId: '7', keptTeamId: real, removedTeamIds: [placeholder] }]);
    expect(await teamIds(leagueId)).toEqual([real]);
  });

  it('prunes an unreferenced row that matches no platform team but keeps one with history', async () => {
    const { d, user, leagueId } = await seedLeague();
    const live = generateId();
    const emptyGhost = generateId();
    const historyGhost = generateId();
    await d.insert(schema.teams).values([
      { id: live, leagueId, ownerId: user, externalOwnerId: 'mgr-a', name: 'Live' },
      { id: emptyGhost, leagueId, ownerId: user, externalOwnerId: null, name: 'Nobody' },
      { id: historyGhost, leagueId, ownerId: user, externalOwnerId: 'mgr-left', name: 'Departed Manager' },
    ]);
    await d.insert(schema.matchups).values({ id: generateId(), leagueId, week: 1, homeTeamId: historyGhost, awayTeamId: live });

    const result = await reconcileLeagueTeams(d, leagueId, [{ externalTeamId: '1', legacyOwnerKey: 'mgr-a' }]);

    expect(result.pruned).toEqual([emptyGhost]);
    expect(result.keptOrphans).toEqual([historyGhost]);
    expect(await teamIds(leagueId)).toEqual([live, historyGhost].sort());
  });

  it('does not prune when told the team list may be incomplete', async () => {
    const { d, user, leagueId } = await seedLeague();
    const live = generateId();
    const unknown = generateId();
    await d.insert(schema.teams).values([
      { id: live, leagueId, ownerId: user, externalOwnerId: 'mgr-a', name: 'Live' },
      { id: unknown, leagueId, ownerId: user, externalOwnerId: 'mgr-left', name: 'Manager left' },
    ]);
    const result = await reconcileLeagueTeams(d, leagueId, [{ externalTeamId: '1', legacyOwnerKey: 'mgr-a' }], { prune: false });
    expect(result.pruned).toEqual([]);
    expect(await teamIds(leagueId)).toEqual([live, unknown].sort());
  });

  it('never prunes when the platform returned no teams', async () => {
    const { d, user, leagueId } = await seedLeague();
    await d.insert(schema.teams).values({ id: generateId(), leagueId, ownerId: user, externalOwnerId: null, name: 'Mine' });
    const result = await reconcileLeagueTeams(d, leagueId, []);
    expect(result.pruned).toEqual([]);
    expect(await teamIds(leagueId)).toHaveLength(1);
  });

  it('follows a roster to its new manager instead of creating a second row', async () => {
    const { d, user, leagueId } = await seedLeague();
    const team = generateId();
    await d.insert(schema.teams).values({ id: team, leagueId, ownerId: user, externalOwnerId: 'mgr-old', externalTeamId: '4', name: 'Roster 4' });
    const result = await reconcileLeagueTeams(d, leagueId, [{ externalTeamId: '4', legacyOwnerKey: 'mgr-new' }]);
    expect(result.teamsByExternalTeamId.get('4')?.id).toBe(team);
    expect(result.pruned).toEqual([]);
    expect(await teamIds(leagueId)).toEqual([team]);
  });

  it('drops a duplicate home matchup instead of violating (league, week, home) uniqueness', async () => {
    const { d, user, leagueId } = await seedLeague();
    const stale = generateId();
    const fresh = generateId();
    const opp = generateId();
    await d.insert(schema.teams).values([
      { id: stale, leagueId, ownerId: user, externalOwnerId: 'mgr-a', name: 'Stale', createdAt: april, updatedAt: april },
      { id: fresh, leagueId, ownerId: user, externalOwnerId: 'mgr-a', name: 'Fresh', createdAt: april, updatedAt: october },
      { id: opp, leagueId, ownerId: user, externalOwnerId: 'mgr-b', name: 'Opp', createdAt: april, updatedAt: october },
    ]);
    const keep = generateId();
    await d.insert(schema.matchups).values([
      { id: keep, leagueId, week: 1, homeTeamId: fresh, awayTeamId: opp },
      { id: generateId(), leagueId, week: 1, homeTeamId: stale, awayTeamId: opp },
      { id: generateId(), leagueId, week: 2, homeTeamId: stale, awayTeamId: fresh },
    ]);

    await reconcileLeagueTeams(d, leagueId, [
      { externalTeamId: '1', legacyOwnerKey: 'mgr-a' },
      { externalTeamId: '2', legacyOwnerKey: 'mgr-b' },
    ]);

    const ids = (await d.query.matchups.findMany({ where: eq(schema.matchups.leagueId, leagueId) })).map((m) => m.id);
    expect(ids).toEqual([keep]);
  });
});

describe('insertPlatformTeam and the 0050 unique index (workers pool)', () => {
  it('is idempotent: a second insert for the same platform team returns the same row', async () => {
    const d = drizzle(env.DB, { schema });
    const user = generateId();
    await d.insert(schema.users).values({ id: user, email: `${user}@test.local`, username: `u-${user}` });
    const leagueId = generateId();
    await d.insert(schema.leagues).values({ id: leagueId, name: 'L', platform: 'espn', externalId: `espn-${leagueId}`, seasonYear: 2099 });

    const a = await insertPlatformTeam(d, { id: generateId(), leagueId, ownerId: user, name: 'Team 3', externalTeamId: '3' });
    const b = await insertPlatformTeam(d, { id: generateId(), leagueId, ownerId: user, name: 'Team 3 again', externalTeamId: '3' });
    expect(b).toBe(a);
    expect(await d.query.teams.findMany({ where: eq(schema.teams.leagueId, leagueId) })).toHaveLength(1);
  });

  it('rejects a raw duplicate at the database level', async () => {
    const d = drizzle(env.DB, { schema });
    const user = generateId();
    await d.insert(schema.users).values({ id: user, email: `${user}@test.local`, username: `u-${user}` });
    const leagueId = generateId();
    await d.insert(schema.leagues).values({ id: leagueId, name: 'L', platform: 'yahoo', externalId: `y-${leagueId}`, seasonYear: 2099 });
    await d.insert(schema.teams).values({ id: generateId(), leagueId, ownerId: user, name: 'A', externalTeamId: '1' });
    await expect(
      d.insert(schema.teams).values({ id: generateId(), leagueId, ownerId: user, name: 'B', externalTeamId: '1' }),
    ).rejects.toThrow(/UNIQUE/);
  });
});
