import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { generateId } from '../utils/id';
import { syncSleeperLeague } from './leagueSync';

/**
 * End to end through the real Sleeper sync with the Sleeper API stubbed,
 * run the way the cron runs it (no acting user). Reproduces the production
 * shapes from 2026-10-02: a member's /connect placeholder sitting beside
 * their real roster row (11 leagues), and two rows for one manager
 * (Skeetsters). After one sync each roster has exactly one row.
 */
describe('syncSleeperLeague team identity (workers pool)', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubSleeper(externalId: string, rosters: unknown[], users: unknown[]) {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.endsWith(`/league/${externalId}/rosters`)) return json(rosters);
      if (url.endsWith(`/league/${externalId}/users`)) return json(users);
      if (url.endsWith(`/league/${externalId}`)) {
        return json({
          league_id: externalId,
          season: String(new Date().getUTCFullYear() + 1), // never "behind" the target season: no rollover
          status: 'in_season',
          settings: { leg: 3, playoff_week_start: 15, num_teams: rosters.length, type: 0 },
          scoring_settings: { rec: 1 },
          roster_positions: ['QB', 'RB', 'WR', 'BN'],
        });
      }
      if (url.includes('/players/nfl')) return json({});
      return json([]);
    }));
  }

  it('leaves exactly one row per roster after a cron sync', async () => {
    const db = drizzle(env.DB, { schema });
    const commish = generateId();
    const joiner = generateId();
    await db.insert(schema.users).values([
      { id: commish, email: `${commish}@test.local`, username: `c-${commish}` },
      { id: joiner, email: `${joiner}@test.local`, username: `j-${joiner}` },
    ]);
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
      // Two rows for one manager: the stale one holds last season's record and the matchups.
      { id: commishStale, leagueId, ownerId: commish, externalOwnerId: 'mgr-commish', name: 'Ghost', wins: 8, losses: 6, createdAt: old, updatedAt: old },
      { id: commishFresh, leagueId, ownerId: commish, externalOwnerId: 'mgr-commish', name: 'Commish', wins: 2, losses: 1, createdAt: old, updatedAt: recent },
      // The joiner's real roster row, created by an earlier sync and owned by whoever ran it.
      { id: joinerReal, leagueId, ownerId: commish, externalOwnerId: 'mgr-joiner', name: 'Joiner', createdAt: old, updatedAt: old },
      // The placeholder /connect created when the joiner joined.
      { id: joinerPlaceholder, leagueId, ownerId: joiner, externalOwnerId: null, name: "joiner's Team", createdAt: recent, updatedAt: recent },
    ]);
    await db.insert(schema.matchups).values({ id: generateId(), leagueId, week: 1, homeTeamId: commishStale, awayTeamId: joinerReal, homeScore: 100, awayScore: 90, isComplete: true });

    stubSleeper(externalId, [
      { roster_id: 1, owner_id: 'mgr-commish', players: [], starters: [], settings: { wins: 2, losses: 1, ties: 0, fpts: 400 } },
      { roster_id: 2, owner_id: 'mgr-joiner', players: [], starters: [], settings: { wins: 1, losses: 2, ties: 0, fpts: 380 } },
    ], [
      { user_id: 'mgr-commish', username: 'commish', display_name: 'Commish' },
      { user_id: 'mgr-joiner', username: 'joiner', display_name: 'Joiner' },
    ]);

    const league = await db.query.leagues.findFirst({ where: eq(schema.leagues.id, leagueId), with: { teams: true } });
    await syncSleeperLeague(db, league!, { targetSeason: 2026 });

    const teams = await db.query.teams.findMany({ where: eq(schema.teams.leagueId, leagueId) });
    expect(teams).toHaveLength(2);
    const byRoster = new Map(teams.map((t) => [t.externalTeamId, t]));
    expect(byRoster.get('1')?.id).toBe(commishFresh);
    expect(byRoster.get('1')?.wins).toBe(2);
    expect(byRoster.get('2')?.id).toBe(joinerReal);
    // The joiner's roster now belongs to the joiner, not to whoever synced first.
    expect(byRoster.get('2')?.ownerId).toBe(joiner);

    // A second sync is a no-op for identity.
    const again = await db.query.leagues.findFirst({ where: eq(schema.leagues.id, leagueId), with: { teams: true } });
    await syncSleeperLeague(db, again!, { targetSeason: 2026 });
    expect(await db.query.teams.findMany({ where: eq(schema.teams.leagueId, leagueId) })).toHaveLength(2);
  });
});
