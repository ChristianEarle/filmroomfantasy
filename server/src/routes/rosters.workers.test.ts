import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { generateId } from '../utils/id';
import { resolveUserTeamId } from './rosters';

/**
 * Regression coverage for the "wrong matchup team" bug: teams.ownerId used
 * to get defaulted to whichever app user last ran the league sync, so a
 * synced league with more than one app member could have `teams.ownerId`
 * pointing at the wrong person. resolveUserTeamId (shared by /rosters/mine,
 * /matchups/my/current, and the Ask AI v2 tools) now resolves via
 * `league_members.externalUsername` <-> `teams.externalOwnerId` FIRST, so it
 * still finds the right team even when ownerId is stale or wrong — falling
 * back to direct ownerId only for leagues with no external sync.
 */
describe('resolveUserTeamId (workers pool)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });


  it('resolves via externalOwnerId even when ownerId is stamped with a different app user', async () => {
    const db = drizzle(env.DB, { schema });

    const userA = generateId();
    const userB = generateId();
    await db.insert(schema.users).values([
      { id: userA, email: `${userA}@test.local`, username: `user-${userA}` },
      { id: userB, email: `${userB}@test.local`, username: `user-${userB}` },
    ]);

    const leagueId = generateId();
    await db.insert(schema.leagues).values({
      id: leagueId,
      name: 'Resolve Test League',
      platform: 'sleeper',
      externalId: 'sleeper-league-1',
      seasonYear: 2099, // isolated season — can't collide with other tests
    });

    // Both app users are members of the same Sleeper-synced league.
    await db.insert(schema.leagueMembers).values([
      { id: generateId(), userId: userA, leagueId, externalUsername: 'sleeper-user-a' },
      { id: generateId(), userId: userB, leagueId, externalUsername: 'sleeper-user-b' },
    ]);

    // Team A's row is stamped with the WRONG ownerId (userB) — simulating
    // the historical sync bug — but its externalOwnerId correctly matches
    // userA's Sleeper identity via league_members.externalUsername.
    const teamAId = generateId();
    const teamBId = generateId();
    await db.insert(schema.teams).values([
      {
        id: teamAId,
        leagueId,
        ownerId: userB, // wrong on purpose
        externalOwnerId: 'sleeper-user-a',
        name: "A's Team",
      },
      {
        id: teamBId,
        leagueId,
        ownerId: userB,
        externalOwnerId: 'sleeper-user-b',
        name: "B's Team",
      },
    ]);

    // Despite ownerId pointing at userB, resolving for userA must return
    // Team A because externalOwnerId is checked first.
    const resolvedForA = await resolveUserTeamId(db, leagueId, userA);
    expect(resolvedForA).toBe(teamAId);

    const resolvedForB = await resolveUserTeamId(db, leagueId, userB);
    expect(resolvedForB).toBe(teamBId);
  });

  it('falls back to direct ownerId for a custom (non-synced) league with no externalOwnerId', async () => {
    const db = drizzle(env.DB, { schema });

    const userC = generateId();
    await db.insert(schema.users).values({
      id: userC,
      email: `${userC}@test.local`,
      username: `user-${userC}`,
    });

    const leagueId = generateId();
    await db.insert(schema.leagues).values({
      id: leagueId,
      name: 'Custom League',
      platform: 'custom',
      seasonYear: 2099,
    });
    await db.insert(schema.leagueMembers).values({
      id: generateId(),
      userId: userC,
      leagueId,
      externalUsername: null,
    });

    const teamId = generateId();
    await db.insert(schema.teams).values({
      id: teamId,
      leagueId,
      ownerId: userC,
      externalOwnerId: null,
      name: "C's Team",
    });

    const resolved = await resolveUserTeamId(db, leagueId, userC);
    expect(resolved).toBe(teamId);
  });

  it('returns null (never someone else\'s team) when no roster matches this user', async () => {
    const db = drizzle(env.DB, { schema });

    const userD = generateId();
    const placeholderOwner = generateId();
    await db.insert(schema.users).values([
      { id: userD, email: `${userD}@test.local`, username: `user-${userD}` },
      { id: placeholderOwner, email: `${placeholderOwner}@test.local`, username: `user-${placeholderOwner}` },
    ]);

    const leagueId = generateId();
    await db.insert(schema.leagues).values({
      id: leagueId,
      name: 'Unowned Roster League',
      platform: 'sleeper',
      externalId: 'sleeper-league-2',
      seasonYear: 2099,
    });
    await db.insert(schema.leagueMembers).values({
      id: generateId(),
      userId: userD,
      leagueId,
      externalUsername: 'sleeper-user-d',
    });

    // An opponent roster with no matching app member — ownerId is stamped
    // with whoever ran the sync (placeholder ownership; teams.ownerId is
    // NOT NULL — see leagueSync.ts decideTeamOwnerId), not userD, and its
    // externalOwnerId doesn't match userD's Sleeper identity either.
    await db.insert(schema.teams).values({
      id: generateId(),
      leagueId,
      ownerId: placeholderOwner,
      externalOwnerId: 'sleeper-user-unmatched',
      name: 'Nobody\'s Team',
    });

    const resolved = await resolveUserTeamId(db, leagueId, userD);
    expect(resolved).toBeNull();
  });

  it('resolves via a username-based externalUsername by looking up the Sleeper user id', async () => {
    const db = drizzle(env.DB, { schema });

    const userE = generateId();
    await db.insert(schema.users).values({
      id: userE,
      email: `${userE}@test.local`,
      username: `user-${userE}`,
    });

    const leagueId = generateId();
    await db.insert(schema.leagues).values({
      id: leagueId,
      name: 'Username Member League',
      platform: 'sleeper',
      externalId: 'sleeper-league-3',
      seasonYear: 2099,
    });
    // externalUsername stored as a raw Sleeper *username* (typed in when
    // they joined) rather than the numeric user_id teams.externalOwnerId
    // actually stores.
    await db.insert(schema.leagueMembers).values({
      id: generateId(),
      userId: userE,
      leagueId,
      externalUsername: 'gridiron_gary',
    });

    const teamId = generateId();
    await db.insert(schema.teams).values({
      id: teamId,
      leagueId,
      ownerId: userE,
      externalOwnerId: '999888777', // numeric Sleeper user_id
      name: "E's Team",
    });

    const mockFetch = vi.fn(async (url: string | URL) => {
      expect(String(url)).toBe('https://api.sleeper.app/v1/user/gridiron_gary');
      return new Response(JSON.stringify({ user_id: '999888777', username: 'gridiron_gary' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const resolved = await resolveUserTeamId(db, leagueId, userE);
    expect(resolved).toBe(teamId);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
