import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { generateId } from '../utils/id';
import { syncSleeperLeague } from './leagueSync';

/**
 * End to end through the real Sleeper sync with the Sleeper API stubbed,
 * run the way the cron runs it (no acting user).
 */
describe('syncSleeperLeague team identity (workers pool)', () => {
  afterEach(() => vi.unstubAllGlobals());

  type LeagueStub = { rosters: unknown[]; users: unknown[]; season: string; previousLeagueId?: string };

  /** Stubs Sleeper for any number of leagues; `userLeagues` answers /user/:id/leagues/nfl/:season. */
  function stubSleeper(leagues: Record<string, LeagueStub>, userLeagues: unknown[] = []) {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (/\/user\/[^/]+\/leagues\/nfl\//.test(url)) return json(userLeagues);
      for (const [externalId, l] of Object.entries(leagues)) {
        if (url.endsWith(`/league/${externalId}/rosters`)) return json(l.rosters);
        if (url.endsWith(`/league/${externalId}/users`)) return json(l.users);
        if (url.endsWith(`/league/${externalId}`)) {
          return json({
            league_id: externalId,
            previous_league_id: l.previousLeagueId ?? null,
            season: l.season,
            status: 'in_season',
            settings: { leg: 3, playoff_week_start: 15, num_teams: l.rosters.length, type: 0 },
            scoring_settings: { rec: 1 },
            roster_positions: ['QB', 'RB', 'WR', 'BN'],
          });
        }
      }
      if (url.includes('/players/nfl')) return json({});
      return json([]);
    }));
  }

  async function seedUsers(d: ReturnType<typeof drizzle<typeof schema>>, n: number) {
    const ids = Array.from({ length: n }, () => generateId());
    await d.insert(schema.users).values(ids.map((id) => ({ id, email: `${id}@test.local`, username: `u-${id}` })));
    return ids;
  }

  it('leaves exactly one row per roster after a cron sync (Skeetsters ghost + /connect placeholder)', async () => {
    const db = drizzle(env.DB, { schema });
    const [commish, joiner] = await seedUsers(db, 2);
    const leagueId = generateId();
    const externalId = `sl-${leagueId}`;
    await db.insert(schema.leagues).values({ id: leagueId, name: 'Cron League', platform: 'sleeper', externalId, seasonYear: 2026 });
    await db.insert(schema.leagueMembers).values([
      { id: generateId(), userId: commish, leagueId, role: 'commissioner', externalUsername: 'mgr-commish' },
      { id: generateId(), userId: joiner, leagueId, role: 'member', externalUsername: 'mgr-joiner' },
    ]);

    const old = new Date('2026-04-01T00:00:00Z');
    const recent = new Date('2026-09-30T00:00:00Z');
    const commishStale = generateId();
    const commishFresh = generateId();
    const joinerReal = generateId();
    const joinerPlaceholder = generateId();
    await db.insert(schema.teams).values([
      { id: commishStale, leagueId, ownerId: commish, externalOwnerId: 'mgr-commish', name: 'Ghost', wins: 8, losses: 6, createdAt: old, updatedAt: old },
      { id: commishFresh, leagueId, ownerId: commish, externalOwnerId: 'mgr-commish', name: 'Commish', wins: 2, losses: 1, createdAt: old, updatedAt: recent },
      { id: joinerReal, leagueId, ownerId: commish, externalOwnerId: 'mgr-joiner', name: 'Joiner', createdAt: old, updatedAt: old },
      { id: joinerPlaceholder, leagueId, ownerId: joiner, externalOwnerId: null, name: "joiner's Team", createdAt: recent, updatedAt: recent },
    ]);
    await db.insert(schema.matchups).values({ id: generateId(), leagueId, week: 1, homeTeamId: commishStale, awayTeamId: joinerReal, homeScore: 100, awayScore: 90, isComplete: true });

    stubSleeper({
      [externalId]: {
        season: String(new Date().getUTCFullYear() + 1),
        rosters: [
          { roster_id: 1, owner_id: 'mgr-commish', players: [], starters: [], settings: { wins: 2, losses: 1, ties: 0, fpts: 400 } },
          { roster_id: 2, owner_id: 'mgr-joiner', players: [], starters: [], settings: { wins: 1, losses: 2, ties: 0, fpts: 380 } },
        ],
        users: [
          { user_id: 'mgr-commish', username: 'commish', display_name: 'Commish' },
          { user_id: 'mgr-joiner', username: 'joiner', display_name: 'Joiner' },
        ],
      },
    });

    const league = await db.query.leagues.findFirst({ where: eq(schema.leagues.id, leagueId), with: { teams: true } });
    await syncSleeperLeague(db, league!, { targetSeason: 2026 });

    const teams = await db.query.teams.findMany({ where: eq(schema.teams.leagueId, leagueId) });
    expect(teams).toHaveLength(2);
    const byRoster = new Map(teams.map((t) => [t.externalTeamId, t]));
    expect(byRoster.get('1')?.id).toBe(commishFresh);
    expect(byRoster.get('1')?.wins).toBe(2);
    expect(byRoster.get('2')?.id).toBe(joinerReal);
    expect(byRoster.get('2')?.ownerId).toBe(joiner);

    const again = await db.query.leagues.findFirst({ where: eq(schema.leagues.id, leagueId), with: { teams: true } });
    await syncSleeperLeague(db, again!, { targetSeason: 2026 });
    expect(await db.query.teams.findMany({ where: eq(schema.teams.leagueId, leagueId) })).toHaveLength(2);
  });

  it('keeps the rows of rosters whose manager left (owner_id null), stamped or not', async () => {
    const db = drizzle(env.DB, { schema });
    const [commish] = await seedUsers(db, 1);
    const leagueId = generateId();
    const externalId = `sl-${leagueId}`;
    await db.insert(schema.leagues).values({ id: leagueId, name: 'Orphans', platform: 'sleeper', externalId, seasonYear: 2026 });
    const live = generateId();
    const stampedOrphan = generateId();
    const legacyOrphan = generateId();
    await db.insert(schema.teams).values([
      { id: live, leagueId, ownerId: commish, externalOwnerId: 'mgr-a', externalTeamId: '1', name: 'Live' },
      // Already keyed on its roster id; manager since left.
      { id: stampedOrphan, leagueId, ownerId: commish, externalOwnerId: 'mgr-gone', externalTeamId: '2', name: 'Abandoned' },
      // Written before roster ids were stored; its manager left too.
      { id: legacyOrphan, leagueId, ownerId: commish, externalOwnerId: 'mgr-gone-2', name: 'Abandoned (legacy)' },
    ]);

    stubSleeper({
      [externalId]: {
        season: String(new Date().getUTCFullYear() + 1),
        rosters: [
          { roster_id: 1, owner_id: 'mgr-a', players: [], starters: [], settings: {} },
          { roster_id: 2, owner_id: null, players: [], starters: [], settings: {} },
          { roster_id: 3, owner_id: null, players: [], starters: [], settings: {} },
        ],
        users: [{ user_id: 'mgr-a', username: 'a', display_name: 'A' }],
      },
    });

    const league = await db.query.leagues.findFirst({ where: eq(schema.leagues.id, leagueId), with: { teams: true } });
    await syncSleeperLeague(db, league!, { targetSeason: 2026 });

    const ids = (await db.query.teams.findMany({ where: eq(schema.teams.leagueId, leagueId) })).map((t) => t.id).sort();
    expect(ids).toEqual([live, stampedOrphan, legacyOrphan].sort());
  });

  it('on rollover onto an already-stored league, keeps the row with prior-season history', async () => {
    const db = drizzle(env.DB, { schema });
    const [veteran, newcomer] = await seedUsers(db, 2);
    const oldExt = `old-${generateId()}`;
    const newExt = `new-${generateId()}`;
    const historyLeague = generateId();
    const directLeague = generateId();
    await db.insert(schema.leagues).values([
      { id: historyLeague, name: 'Since 2025', platform: 'sleeper', externalId: oldExt, seasonYear: 2025 },
      { id: directLeague, name: 'Connected 2026', platform: 'sleeper', externalId: newExt, seasonYear: 2026 },
    ]);
    await db.insert(schema.leagueMembers).values([
      { id: generateId(), userId: veteran, leagueId: historyLeague, role: 'commissioner', externalUsername: 'mgr-v' },
      { id: generateId(), userId: newcomer, leagueId: directLeague, role: 'member', externalUsername: 'mgr-n' },
    ]);
    const vTeam = generateId();
    const nTeam = generateId();
    await db.insert(schema.teams).values([
      { id: vTeam, leagueId: historyLeague, ownerId: veteran, externalOwnerId: 'mgr-v', name: 'V' },
      { id: nTeam, leagueId: historyLeague, ownerId: veteran, externalOwnerId: 'mgr-n', name: 'N' },
    ]);
    const oldTrade = generateId();
    await db.insert(schema.trades).values({
      id: oldTrade, leagueId: historyLeague, proposingTeamId: vTeam, receivingTeamId: nTeam,
      status: 'executed', source: 'sleeper', externalId: 'tx-2025', seasonYear: 2025,
    });

    const rosters = [
      { roster_id: 1, owner_id: 'mgr-v', players: [], starters: [], settings: {} },
      { roster_id: 2, owner_id: 'mgr-n', players: [], starters: [], settings: {} },
    ];
    const users = [
      { user_id: 'mgr-v', username: 'v', display_name: 'V' },
      { user_id: 'mgr-n', username: 'n', display_name: 'N' },
    ];
    stubSleeper(
      {
        [oldExt]: { season: '2025', rosters, users },
        [newExt]: { season: '2026', rosters, users, previousLeagueId: oldExt },
      },
      [{ league_id: newExt, previous_league_id: oldExt, name: 'Since 2025', season: '2026', settings: { leg: 3 } }],
    );

    const league = await db.query.leagues.findFirst({ where: eq(schema.leagues.id, historyLeague), with: { teams: true } });
    const result = await syncSleeperLeague(db, league!, { targetSeason: 2026 });

    expect(result.rolledOver?.toExternalId).toBe(newExt);
    expect(await db.query.leagues.findFirst({ where: eq(schema.leagues.id, directLeague) })).toBeUndefined();
    const survivor = await db.query.leagues.findFirst({ where: eq(schema.leagues.id, historyLeague) });
    expect(survivor?.externalId).toBe(newExt);
    // The 2025 trade survived, and the newcomer is now a member of the survivor.
    expect(await db.query.trades.findFirst({ where: eq(schema.trades.id, oldTrade) })).toBeDefined();
    const members = await db.query.leagueMembers.findMany({ where: eq(schema.leagueMembers.leagueId, historyLeague) });
    expect(members.map((m) => m.userId).sort()).toEqual([veteran, newcomer].sort());
  });
});
