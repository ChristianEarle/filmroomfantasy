import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { generateId } from '../utils/id';
import { mergeDuplicateTeams } from './teamDedupe';

/**
 * Reproduces the production shape behind "league analyzer is wrong"
 * (2026-10-02): one Sleeper owner with two team rows in the same league. The
 * stale row carried last season's record and every matchup; the fresh row
 * carried this season's record and roster but no matchups.
 */
describe('mergeDuplicateTeams (workers pool)', () => {
  async function seedLeague() {
    const db = drizzle(env.DB, { schema });
    const user = generateId();
    await db.insert(schema.users).values({ id: user, email: `${user}@test.local`, username: `u-${user}` });
    const leagueId = generateId();
    await db.insert(schema.leagues).values({
      id: leagueId,
      name: 'Dedupe League',
      platform: 'sleeper',
      externalId: `sleeper-${leagueId}`,
      seasonYear: 2099,
    });
    return { db, user, leagueId };
  }

  it('folds the stale duplicate into the most recently synced row and repoints its matchups', async () => {
    const { db, user, leagueId } = await seedLeague();
    const stale = generateId();
    const fresh = generateId();
    const opponent = generateId();
    const april = new Date('2099-04-11T00:00:00Z');
    const october = new Date('2099-10-02T00:00:00Z');
    await db.insert(schema.teams).values([
      { id: stale, leagueId, ownerId: user, externalOwnerId: 'sleeper-me', name: 'Last Year Name', wins: 8, losses: 6, pointsFor: 1882, createdAt: april, updatedAt: april },
      { id: fresh, leagueId, ownerId: user, externalOwnerId: 'sleeper-me', name: 'This Year Name', wins: 2, losses: 1, pointsFor: 428, createdAt: april, updatedAt: october },
      { id: opponent, leagueId, ownerId: user, externalOwnerId: 'sleeper-opp', name: 'Opponent', wins: 1, losses: 2, pointsFor: 400, createdAt: april, updatedAt: october },
    ]);

    const playerId = generateId();
    await db.insert(schema.nflPlayers).values({ id: playerId, externalId: `ext-${playerId}`, name: 'Stale Roster Guy', position: 'RB', team: 'ATL' });
    await db.insert(schema.rosterSpots).values({ id: generateId(), teamId: stale, playerId, slot: 'RB1', isStarter: true });

    // All matchups reference the stale row: one as home, one as away.
    const m1 = generateId();
    const m2 = generateId();
    await db.insert(schema.matchups).values([
      { id: m1, leagueId, week: 1, homeTeamId: stale, awayTeamId: opponent, homeScore: 150, awayScore: 120, isComplete: true },
      { id: m2, leagueId, week: 2, homeTeamId: opponent, awayTeamId: stale, homeScore: 110, awayScore: 130, isComplete: true },
    ]);
    await db.insert(schema.transactions).values({ id: generateId(), leagueId, type: 'add', status: 'processed', addTeamId: stale });

    const result = await mergeDuplicateTeams(db, leagueId);

    expect(result.merged).toEqual([{ externalOwnerId: 'sleeper-me', keptTeamId: fresh, removedTeamIds: [stale] }]);
    expect([...result.removedTeamIds]).toEqual([stale]);

    const teams = await db.query.teams.findMany({ where: eq(schema.teams.leagueId, leagueId) });
    expect(teams.map((t) => t.id).sort()).toEqual([fresh, opponent].sort());
    expect(teams.find((t) => t.id === fresh)?.wins).toBe(2);

    const matchups = await db.query.matchups.findMany({ where: eq(schema.matchups.leagueId, leagueId) });
    expect(matchups.find((m) => m.id === m1)?.homeTeamId).toBe(fresh);
    expect(matchups.find((m) => m.id === m2)?.awayTeamId).toBe(fresh);

    const txns = await db.query.transactions.findMany({ where: eq(schema.transactions.leagueId, leagueId) });
    expect(txns[0]?.addTeamId).toBe(fresh);

    // The stale roster cascaded away with its row.
    const spots = await db.query.rosterSpots.findMany({ where: eq(schema.rosterSpots.teamId, stale) });
    expect(spots).toHaveLength(0);
  });

  it('drops a duplicate home matchup instead of violating the (league, week, home) uniqueness', async () => {
    const { db, user, leagueId } = await seedLeague();
    const stale = generateId();
    const fresh = generateId();
    const opponent = generateId();
    const early = new Date('2099-04-01T00:00:00Z');
    const late = new Date('2099-10-01T00:00:00Z');
    await db.insert(schema.teams).values([
      { id: stale, leagueId, ownerId: user, externalOwnerId: 'sleeper-me', name: 'Stale', createdAt: early, updatedAt: early },
      { id: fresh, leagueId, ownerId: user, externalOwnerId: 'sleeper-me', name: 'Fresh', createdAt: early, updatedAt: late },
      { id: opponent, leagueId, ownerId: user, externalOwnerId: 'sleeper-opp', name: 'Opp', createdAt: early, updatedAt: late },
    ]);
    const keep = generateId();
    const dupe = generateId();
    const selfPlay = generateId();
    await db.insert(schema.matchups).values([
      { id: keep, leagueId, week: 1, homeTeamId: fresh, awayTeamId: opponent },
      { id: dupe, leagueId, week: 1, homeTeamId: stale, awayTeamId: opponent },
      // Would become fresh-vs-fresh after repointing — must be removed.
      { id: selfPlay, leagueId, week: 2, homeTeamId: stale, awayTeamId: fresh },
    ]);

    await mergeDuplicateTeams(db, leagueId);

    const ids = (await db.query.matchups.findMany({ where: eq(schema.matchups.leagueId, leagueId) })).map((m) => m.id);
    expect(ids).toEqual([keep]);
    const teams = await db.query.teams.findMany({ where: eq(schema.teams.leagueId, leagueId) });
    expect(teams.map((t) => t.id).sort()).toEqual([fresh, opponent].sort());
  });

  it('is a no-op on a league without duplicates', async () => {
    const { db, user, leagueId } = await seedLeague();
    await db.insert(schema.teams).values([
      { id: generateId(), leagueId, ownerId: user, externalOwnerId: 'a', name: 'A' },
      { id: generateId(), leagueId, ownerId: user, externalOwnerId: 'b', name: 'B' },
      { id: generateId(), leagueId, ownerId: user, externalOwnerId: null, name: 'Custom 1' },
      { id: generateId(), leagueId, ownerId: user, externalOwnerId: null, name: 'Custom 2' },
    ]);
    const result = await mergeDuplicateTeams(db, leagueId);
    expect(result.merged).toEqual([]);
    const teams = await db.query.teams.findMany({ where: eq(schema.teams.leagueId, leagueId) });
    expect(teams).toHaveLength(4);
  });
});
