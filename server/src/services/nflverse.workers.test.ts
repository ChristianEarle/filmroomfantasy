import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import {
  applyGsisCrosswalk,
  loadPlayerIdsByGsis,
  upsertUsageRows,
  upsertPracticeRows,
  enrichGames,
  type UsageRow,
  type PracticeRow,
} from './nflverse';

const SEASON = 2098; // isolated season so rows can't collide with other tests

function usageRow(over: Partial<UsageRow> = {}): UsageRow {
  return {
    gsisId: '00-9900001', seasonYear: SEASON, week: 2, team: 'MIN', opponent: 'GB',
    completions: 0, passAttempts: 0, passYards: 0, passTDs: 0, passInterceptions: 0, sacksSuffered: 0,
    passAirYards: 0, passYardsAfterCatch: 0, passFirstDowns: 0, passEpa: null, passCpoe: null, pacr: null,
    carries: 1, rushYards: 6, rushTDs: 0, rushFirstDowns: 0, rushEpa: 0.123,
    targets: 11, receptions: 8, recYards: 124, recTDs: 1, recAirYards: 150, recYardsAfterCatch: 40,
    recFirstDowns: 6, recEpa: 5.679, racr: 0.8267, targetShare: 0.3235, airYardsShare: 0.4512, wopr: 0.8011,
    fantasyPoints: 18.9, fantasyPointsPPR: 26.9,
    ...over,
  };
}

function practiceRow(over: Partial<PracticeRow> = {}): PracticeRow {
  return {
    gsisId: '00-9900001', seasonYear: SEASON, week: 2, team: 'MIN',
    reportStatus: 'Questionable', reportPrimaryInjury: 'Ankle', reportSecondaryInjury: null,
    practiceStatus: 'Limited Participation in Practice', practicePrimaryInjury: 'Ankle', practiceSecondaryInjury: null,
    ...over,
  };
}

describe('nflverse writers (workers pool)', () => {
  it('crosswalk stamps gsis ids by Sleeper id and skips rows already stamped', async () => {
    const db = drizzle(env.DB, { schema });
    const now = new Date();
    await db.insert(schema.nflPlayers).values([
      { id: 'nv-p1', externalId: '990001', name: 'Usage One', team: 'MIN', position: 'WR', status: 'active', createdAt: now, updatedAt: now },
      { id: 'nv-p2', externalId: '990002', name: 'Usage Two', team: 'KC', position: 'QB', status: 'active', createdAt: now, updatedAt: now },
    ]);

    const pairs = [
      { sleeperId: '990001', gsisId: '00-9900001', week: 2 },
      { sleeperId: '990002', gsisId: '00-9900002', week: 2 },
      { sleeperId: '990003', gsisId: '00-9900003', week: 2 }, // not in nfl_players
    ];
    const first = await applyGsisCrosswalk(db, pairs);
    expect(first).toEqual({ updated: 2, unchanged: 0, unmatched: 1 });

    const second = await applyGsisCrosswalk(db, pairs);
    expect(second).toEqual({ updated: 0, unchanged: 2, unmatched: 1 });

    const ids = await loadPlayerIdsByGsis(db);
    expect(ids.get('00-9900001')).toBe('nv-p1');
    expect(ids.get('00-9900002')).toBe('nv-p2');
  });

  it('usage rows insert, then only rewrite when a compared value changes', async () => {
    const db = drizzle(env.DB, { schema });
    const ids = await loadPlayerIdsByGsis(db);

    const rows = [usageRow(), usageRow({ gsisId: '00-9900002', week: 2, targets: 0 }), usageRow({ gsisId: '00-unknown' })];
    const first = await upsertUsageRows(db, rows, ids, SEASON);
    expect(first).toEqual({ inserted: 2, updated: 0, unchanged: 0, unmatched: 1 });

    const second = await upsertUsageRows(db, rows, ids, SEASON);
    expect(second).toEqual({ inserted: 0, updated: 0, unchanged: 2, unmatched: 1 });

    const third = await upsertUsageRows(db, [usageRow({ targets: 12, targetShare: 0.35 })], ids, SEASON);
    expect(third).toEqual({ inserted: 0, updated: 1, unchanged: 0, unmatched: 0 });

    const stored = await db.query.playerUsageWeekly.findFirst({
      where: and(eq(schema.playerUsageWeekly.playerId, 'nv-p1'), eq(schema.playerUsageWeekly.seasonYear, SEASON), eq(schema.playerUsageWeekly.week, 2)),
    });
    expect(stored?.targets).toBe(12);
    expect(stored?.targetShare).toBe(0.35);
    expect(stored?.gsisId).toBe('00-9900001');
  });

  it('practice reports upsert the same way, with null designations compared as equal', async () => {
    const db = drizzle(env.DB, { schema });
    const ids = await loadPlayerIdsByGsis(db);

    const first = await upsertPracticeRows(db, [practiceRow()], ids, SEASON);
    expect(first).toEqual({ inserted: 1, updated: 0, unchanged: 0, unmatched: 0 });
    const second = await upsertPracticeRows(db, [practiceRow()], ids, SEASON);
    expect(second).toEqual({ inserted: 0, updated: 0, unchanged: 1, unmatched: 0 });

    // Friday: designation cleared, full practice.
    const third = await upsertPracticeRows(db, [practiceRow({ reportStatus: null, practiceStatus: 'Full Participation in Practice' })], ids, SEASON);
    expect(third).toEqual({ inserted: 0, updated: 1, unchanged: 0, unmatched: 0 });
    const stored = await db.query.playerPracticeReports.findFirst({
      where: and(eq(schema.playerPracticeReports.playerId, 'nv-p1'), eq(schema.playerPracticeReports.seasonYear, SEASON)),
    });
    expect(stored?.reportStatus).toBeNull();
    expect(stored?.practiceStatus).toBe('Full Participation in Practice');
  });

  it('game enrichment fills environment and moneylines, keeps the ESPN total, and is idempotent', async () => {
    const db = drizzle(env.DB, { schema });
    await db.insert(schema.nflGames).values([
      { id: 'nv-g1', externalId: 'nv-g1', week: 1, seasonYear: SEASON, seasonType: 'regular', homeTeam: 'PIT', awayTeam: 'ATL', gameTime: new Date(), overUnder: 44, isComplete: false },
      { id: 'nv-g2', externalId: 'nv-g2', week: 1, seasonYear: SEASON, seasonType: 'regular', homeTeam: 'PHI', awayTeam: 'DAL', gameTime: new Date(), isComplete: false },
    ]);
    const rows = [
      { espnId: 'nv-g1', seasonYear: SEASON, week: 1, roof: 'outdoors', surface: 'grass', temp: 68, wind: 7, homeMoneyline: -165, awayMoneyline: 140, totalLine: 44.5 },
      { espnId: 'nv-g2', seasonYear: SEASON, week: 1, roof: 'outdoors', surface: 'grass', temp: null, wind: null, homeMoneyline: -180, awayMoneyline: 150, totalLine: 47 },
      { espnId: 'nv-missing', seasonYear: SEASON, week: 2, roof: 'dome', surface: 'fieldturf', temp: null, wind: null, homeMoneyline: null, awayMoneyline: null, totalLine: null },
    ];
    const first = await enrichGames(db, rows, SEASON);
    expect(first).toEqual({ updated: 2, unchanged: 0, unmatched: 1 });
    const second = await enrichGames(db, rows, SEASON);
    expect(second).toEqual({ updated: 0, unchanged: 2, unmatched: 1 });

    const g1 = await db.query.nflGames.findFirst({ where: eq(schema.nflGames.id, 'nv-g1') });
    expect(g1).toMatchObject({ roof: 'outdoors', temp: 68, wind: 7, homeMoneyline: -165, awayMoneyline: 140, overUnder: 44 });
    const g2 = await db.query.nflGames.findFirst({ where: eq(schema.nflGames.id, 'nv-g2') });
    expect(g2?.overUnder).toBe(47);
    expect(g2?.temp).toBeNull();
  });
});
