import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { playerRoutes } from './players';
import * as schema from '../db/schema';
import { mountWithDb } from '../../test/testApp';

const SEASON = 2001;
const WEEK = 3;
const now = new Date();

type StatsSeed = Partial<typeof schema.playerWeeklyStats.$inferInsert>;

const player = (id: string, name: string, team: string, position: string) => ({
  id, externalId: `${id}-ext`, name, team, position, status: 'active' as const, createdAt: now, updatedAt: now,
});

const prop = (id: string, playerName: string, market: string, home: string, away: string, line: { over?: number; yes?: number }) => ({
  id, eventId: `evt-${home}-${away}`, playerName, market, bookmaker: 'fanduel',
  overPoint: line.over ?? null, underPoint: line.over ?? null,
  overPrice: line.over != null ? -114 : null, underPrice: line.over != null ? -114 : null,
  yesPrice: line.yes ?? null, snapshotTime: '2001-09-20T23:00:00.000Z',
  season: SEASON, week: WEEK, homeTeam: home, awayTeam: away, createdAt: now,
});

const stats = (id: string, playerId: string, opponent: string, values: StatsSeed) => ({
  id, playerId, week: WEEK, seasonYear: SEASON, opponent, ...values,
});

async function getProps(playerId: string) {
  const app = mountWithDb(playerRoutes);
  const res = await app.request(`/${playerId}/props?week=${WEEK}&season=${SEASON}`, {}, env);
  expect(res.status).toBe(200);
  return res.json() as Promise<{ status: string; actual: Record<string, unknown>; props: Record<string, unknown> }>;
}

describe('GET /api/players/:id/props grading (workers pool)', () => {
  beforeAll(async () => {
    const db = drizzle(env.DB, { schema });
    await db.batch([
      // KC @ DEN was played and synced; MIA @ BUF was played but its stats never synced.
      db.insert(schema.nflGames).values({
        id: 'pg-game-kc-den', week: WEEK, seasonYear: SEASON, seasonType: 'regular', homeTeam: 'DEN', awayTeam: 'KC',
        gameTime: new Date('2001-09-23T20:25:00Z'), isComplete: true, homeScore: 20, awayScore: 27,
      }),
      db.insert(schema.nflGames).values({
        id: 'pg-game-mia-buf', week: WEEK, seasonYear: SEASON, seasonType: 'regular', homeTeam: 'BUF', awayTeam: 'MIA',
        gameTime: new Date('2001-09-23T17:00:00Z'), isComplete: true, homeScore: 17, awayScore: 10,
      }),
      // Kicked off 6 hours ago: finished, but a post-game stats sync may not have run yet.
      db.insert(schema.nflGames).values({
        id: 'pg-game-nyg-dal', week: WEEK, seasonYear: SEASON, seasonType: 'regular', homeTeam: 'DAL', awayTeam: 'NYG',
        gameTime: new Date(now.getTime() - 6 * 60 * 60 * 1000), isComplete: true, homeScore: 24, awayScore: 21,
      }),
      db.insert(schema.nflPlayers).values(player('pg-wr-late', 'Grading Test Late Receiver', 'NYG', 'WR')),
      db.insert(schema.nflPlayers).values(player('pg-qb-nyg', 'Grading Test Giants Quarterback', 'NYG', 'QB')),
      db.insert(schema.playerProps).values(prop('pg-p8', 'Grading Test Late Receiver', 'player_reception_yds', 'DAL', 'NYG', { over: 35.5 })),
      db.insert(schema.playerWeeklyStats).values(stats('pg-s5', 'pg-qb-nyg', 'DAL', {
        passAttempts: 30, passYards: 240, offSnaps: 64, tmOffSnaps: 64,
      })),
      db.insert(schema.nflPlayers).values(player('pg-qb', 'Grading Test Quarterback', 'KC', 'QB')),
      db.insert(schema.nflPlayers).values(player('pg-wr-zeroed', 'Grading Test Zeroed Receiver', 'KC', 'WR')),
      db.insert(schema.nflPlayers).values(player('pg-wr-inactive', 'Grading Test Inactive Receiver', 'DEN', 'WR')),
      db.insert(schema.nflPlayers).values(player('pg-rb-absent', 'Grading Test Absent Back', 'DEN', 'RB')),
      db.insert(schema.nflPlayers).values(player('pg-te-unsynced', 'Grading Test Unsynced End', 'BUF', 'TE')),
      // Traded since: his current team is NYJ, but week 3's lines are from KC @ DEN.
      db.insert(schema.nflPlayers).values(player('pg-rb-traded', 'Grading Test Traded Back', 'NYJ', 'RB')),
      db.insert(schema.playerProps).values(prop('pg-p1', 'Grading Test Quarterback', 'player_anytime_td', 'DEN', 'KC', { yes: 900 })),
      db.insert(schema.playerProps).values(prop('pg-p2', 'Grading Test Quarterback', 'player_pass_yds', 'DEN', 'KC', { over: 255.5 })),
      db.insert(schema.playerProps).values(prop('pg-p3', 'Grading Test Zeroed Receiver', 'player_reception_yds', 'DEN', 'KC', { over: 64.5 })),
      db.insert(schema.playerProps).values(prop('pg-p4', 'Grading Test Inactive Receiver', 'player_reception_yds', 'DEN', 'KC', { over: 40.5 })),
      db.insert(schema.playerProps).values(prop('pg-p5', 'Grading Test Absent Back', 'player_rush_yds', 'DEN', 'KC', { over: 45.5 })),
      db.insert(schema.playerProps).values(prop('pg-p6', 'Grading Test Unsynced End', 'player_reception_yds', 'BUF', 'MIA', { over: 30.5 })),
      db.insert(schema.playerProps).values(prop('pg-p7', 'Grading Test Traded Back', 'player_rush_yds', 'DEN', 'KC', { over: 55.5 })),
      db.insert(schema.playerWeeklyStats).values(stats('pg-s1', 'pg-qb', 'DEN', {
        passAttempts: 34, passYards: 281, passTDs: 3, rushAttempts: 2, offSnaps: 66, tmOffSnaps: 66,
      })),
      // What a failed sync leaves: every column zero, team snaps included.
      db.insert(schema.playerWeeklyStats).values(stats('pg-s2', 'pg-wr-zeroed', 'DEN', {})),
      db.insert(schema.playerWeeklyStats).values(stats('pg-s3', 'pg-wr-inactive', 'KC', { offSnaps: 0, tmOffSnaps: 61 })),
      db.insert(schema.playerWeeklyStats).values(stats('pg-s4', 'pg-rb-traded', 'DEN', {
        rushAttempts: 18, rushYards: 77, offSnaps: 40, tmOffSnaps: 66,
      })),
    ] as any);
  });

  beforeEach(() => {
    // The live-week resolver falls back to ESPN when it has no schedule; keep tests offline.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('grades a QB\'s anytime TD on rushing and receiving touchdowns only', async () => {
    const body = await getProps('pg-qb');
    expect(body.status).toBe('played');
    expect(body.actual).toMatchObject({ passYds: 281, passTds: 3, scoredTd: false });
  });

  it('withholds results for an all-zero row with no team snaps', async () => {
    const body = await getProps('pg-wr-zeroed');
    expect(body.status).toBe('unknown');
    expect(body.actual).toEqual({});
  });

  it('voids a player listed as inactive', async () => {
    const body = await getProps('pg-wr-inactive');
    expect(body.status).toBe('did_not_play');
    expect(body.actual).toEqual({});
  });

  it('voids a player with no row once the rest of his game has stats', async () => {
    const body = await getProps('pg-rb-absent');
    expect(body.status).toBe('did_not_play');
  });

  it('withholds results for a player with no row when his game has no stats yet', async () => {
    const body = await getProps('pg-te-unsynced');
    expect(body.status).toBe('unknown');
    expect(body.actual).toEqual({});
  });

  it('does not call a missing player inactive until a post-game stats sync is due', async () => {
    const body = await getProps('pg-wr-late');
    expect(body.status).toBe('unknown');
  });

  it('finds the game from the lines\' event for a player who has changed teams', async () => {
    const body = await getProps('pg-rb-traded');
    expect(body.status).toBe('played');
    expect(body.actual).toMatchObject({ rushYds: 77 });
  });
});
