import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { generateId } from '../utils/id';
import { computeLeagueAnalysis, formatLeagueContext, formatTeamFacts } from './leagueAnalyzer';

type Db = ReturnType<typeof drizzle<typeof schema>>;

/** Lineup used by every seeded team: one of each slot plus a bench player. */
const LINEUP: Array<{ slot: string; position: string; isStarter: boolean }> = [
  { slot: 'QB', position: 'QB', isStarter: true },
  { slot: 'RB1', position: 'RB', isStarter: true },
  { slot: 'WR1', position: 'WR', isStarter: true },
  { slot: 'TE', position: 'TE', isStarter: true },
  { slot: 'FLEX', position: 'RB', isStarter: true },
  { slot: 'SUPER_FLEX', position: 'QB', isStarter: true },
  { slot: 'K', position: 'K', isStarter: true },
  { slot: 'DEF', position: 'DEF', isStarter: true },
  { slot: 'BN1', position: 'WR', isStarter: false },
];

/**
 * A superflex league on an archived season (so the analysis week is the
 * league's own stored week). Team i's players score base*(i+1) each week, so
 * team 3 is strongest. Weeks 1-3 are played; weeks 4-5 are left to play.
 */
async function seedLeague(db: Db, teamCount = 4) {
  const owner = generateId();
  await db.insert(schema.users).values({ id: owner, email: `${owner}@test.local`, username: `u-${owner}` });
  const leagueId = generateId();
  await db.insert(schema.leagues).values({
    id: leagueId, name: 'Analyzer League', platform: 'sleeper', externalId: `sl-${leagueId}`,
    seasonYear: 2099, currentWeek: 4, playoffTeams: 2, scoringFormat: 'ppr', hasSuperflex: true, leagueType: 'dynasty',
  });
  const membership = { id: generateId(), userId: owner, leagueId, role: 'commissioner', externalUsername: null };
  await db.insert(schema.leagueMembers).values(membership);

  const teamIds: string[] = [];
  for (let i = 0; i < teamCount; i++) {
    const teamId = generateId();
    teamIds.push(teamId);
    await db.insert(schema.teams).values({
      id: teamId, leagueId, ownerId: owner, ownerDisplayName: `Manager ${i}`, name: `Team ${i}`,
      externalTeamId: String(i + 1), wins: i >= 2 ? 2 : 1, losses: i >= 2 ? 1 : 2, pointsFor: 300 + i * 30, pointsAgainst: 330,
    });
    for (const [j, spot] of LINEUP.entries()) {
      const playerId = generateId();
      await db.insert(schema.nflPlayers).values({
        id: playerId, externalId: `p-${playerId}`, name: `Player ${i}-${spot.slot}`, team: 'KC', position: spot.position,
        status: j === 1 && i === 0 ? 'questionable' : 'active', injuryNote: j === 1 && i === 0 ? 'Hamstring' : null, byeWeek: 6,
      });
      await db.insert(schema.rosterSpots).values({ id: generateId(), teamId, playerId, slot: spot.slot, isStarter: spot.isStarter });
      const base = spot.position === 'QB' ? 20 : spot.position === 'K' || spot.position === 'DEF' ? 8 : 12;
      for (let week = 1; week <= 3; week++) {
        await db.insert(schema.playerWeeklyStats).values({
          id: generateId(), playerId, week, seasonYear: 2099,
          fantasyPointsPPR: base * (1 + i * 0.1) + week, fantasyPointsHalf: base, fantasyPointsStd: base, offSnaps: 40,
        });
      }
    }
  }
  // Weeks 1-3 played; higher-index team wins each pairing. Weeks 4-5 to play.
  const pairings = [[0, 1, 2, 3], [0, 2, 1, 3], [0, 3, 1, 2]];
  for (const [w, [a, b, c, d]] of pairings.entries()) {
    const week = w + 1;
    await db.insert(schema.matchups).values([
      { id: generateId(), leagueId, week, homeTeamId: teamIds[a], awayTeamId: teamIds[b], homeScore: 100 + a * 10, awayScore: 100 + b * 10, isComplete: true },
      { id: generateId(), leagueId, week, homeTeamId: teamIds[c], awayTeamId: teamIds[d], homeScore: 100 + c * 10, awayScore: 100 + d * 10, isComplete: true },
    ]);
  }
  for (const week of [4, 5]) {
    await db.insert(schema.matchups).values([
      { id: generateId(), leagueId, week, homeTeamId: teamIds[0], awayTeamId: teamIds[week === 4 ? 1 : 2], isComplete: false },
      { id: generateId(), leagueId, week, homeTeamId: teamIds[week === 4 ? 2 : 1], awayTeamId: teamIds[3], isComplete: false },
    ]);
  }
  const league = (await db.query.leagues.findFirst({ where: (l, { eq }) => eq(l.id, leagueId) }))!;
  const member = (await db.query.leagueMembers.findFirst({ where: (m, { eq }) => eq(m.leagueId, leagueId) }))!;
  return { league, member, teamIds };
}

describe('league analyzer (workers pool)', () => {
  it('breaks positions down by lineup slot, with FLEX and SUPERFLEX as their own rows', async () => {
    const db = drizzle(env.DB, { schema });
    const { league, member, teamIds } = await seedLeague(db);
    const analysis = await computeLeagueAnalysis(db, league, member);

    const team0 = analysis.teams.find((t) => t.id === teamIds[0])!;
    expect(team0.positions.map((p) => p.position)).toEqual(['QB', 'RB', 'WR', 'TE', 'FLEX', 'SFLEX', 'K', 'DEF']);
    const byGroup = new Map(team0.positions.map((p) => [p.position, p]));
    // The RB in the FLEX slot counts toward FLEX, not RB; the superflex QB toward SFLEX, not QB.
    expect(byGroup.get('RB')?.starterCount).toBe(1);
    expect(byGroup.get('FLEX')?.starterCount).toBe(1);
    expect(byGroup.get('QB')?.starterCount).toBe(1);
    expect(byGroup.get('SFLEX')?.starterCount).toBe(1);
    // Team 0 scores 12+week for its flex RB: (13+14+15)/3 = 14.
    expect(byGroup.get('FLEX')?.avgPoints).toBe(14);
    // Bench players never count.
    expect(team0.positions.reduce((s, p) => s + p.starterCount, 0)).toBe(8);
    // Each team's players score more with its index, so team 0 ranks last and team 3 first at every slot.
    expect(team0.positions.every((p) => p.rank === 4 && p.rankOf === 4)).toBe(true);
    const team3 = analysis.teams.find((t) => t.id === teamIds[3])!;
    expect(team3.positions.every((p) => p.rank === 1)).toBe(true);
    expect(analysis.aiDetail).toBeUndefined();
  });

  it('computes all-play records and schedule luck', async () => {
    const db = drizzle(env.DB, { schema });
    const { league, member, teamIds } = await seedLeague(db);
    const analysis = await computeLeagueAnalysis(db, league, member);
    const t3 = analysis.teams.find((t) => t.id === teamIds[3])!;
    const t0 = analysis.teams.find((t) => t.id === teamIds[0])!;
    // Team 3 has the top score every week; team 0 the bottom.
    expect(t3.allPlay).toEqual({ wins: 9, losses: 0, ties: 0, winPct: 100 });
    expect(t0.allPlay).toEqual({ wins: 0, losses: 9, ties: 0, winPct: 0 });
    // Team 3's stored record is 2-1 (66.7%) against a 100% all-play: unlucky.
    expect(t3.luck).toBe(-33.3);
  });

  it('builds the full AI fact sheet: ranks, all-play, game log, slots, schedule and roster', async () => {
    const db = drizzle(env.DB, { schema });
    const { league, member, teamIds } = await seedLeague(db);
    const analysis = await computeLeagueAnalysis(db, league, member, { withAiDetail: true });
    const detail = analysis.aiDetail?.[teamIds[0]];
    expect(detail?.roster).toHaveLength(LINEUP.length);
    expect(detail?.roster.map((p) => p.slot)).toEqual(['QB', 'RB1', 'WR1', 'TE', 'FLEX', 'SUPER_FLEX', 'K', 'DEF', 'BN1']);
    // Trade advice never names a flex slot.
    for (const t of analysis.teams) expect(['FLEX', 'SFLEX']).not.toContain(t.tradeTargetPosition);
    expect(analysis.teams.map((t) => t.narrative).join(' ')).not.toMatch(/hole is (FLEX|SFLEX)\b/);
    expect(detail?.weeklyResults.map((r) => r.week)).toEqual([1, 2, 3]);
    expect(detail?.streak).toBe('L3');
    expect(detail?.remainingSchedule.map((s) => s.week)).toEqual([4, 5]);

    const team = analysis.teams.find((t) => t.id === teamIds[0])!;
    const sheet = formatTeamFacts(team, analysis, detail);
    for (const fragment of [
      'Standings rank (by record):',
      'Power-by-scoring rank (by PPG):',
      'All-play record: 0-9 (0.0%)',
      'Schedule luck:',
      'SUPERFLEX (1 starter)',
      'FLEX (1 starter): 14.0 PPG per starter',
      'ranked #4 of 4 in the league',
      'Game log:',
      'Wk 1: L 100.0-110.0 vs Team 1',
      'Remaining opponents: Wk 4 Team 1',
      'SUPER_FLEX: Player 0-SUPER_FLEX (QB, KC)',
      'questionable: Hamstring',
      'BN: Player 0-BN1 (WR, KC)',
      'bye wk 6',
    ]) {
      expect(sheet).toContain(fragment);
    }
    // The compact sheet (used for rivals) leaves out roster and game log.
    const compact = formatTeamFacts(team, analysis);
    expect(compact).not.toContain('Game log:');
    expect(compact).not.toContain('Roster');

    const context = formatLeagueContext(analysis, league, 4);
    expect(context).toContain('Format: PPR, dynasty, superflex');
    expect(context).toContain('SUPERFLEX');
  });
});
