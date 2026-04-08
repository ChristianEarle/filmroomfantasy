import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import type { Env, Variables } from '../index';

const rostersRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// All roster reads are auth-only and fairly cheap — 120/min per IP is plenty.
rostersRoutes.use('*', rateLimit(120, 60 * 1000));

interface RosterPlayerOut {
  playerId: string;
  name: string;
  position: string;
  nflTeam: string;
  slot: string;
  isStarter: boolean;
  status: string;
  byeWeek: number | null;
  age: number | null;
  injuryNote: string | null;
  depthChartOrder: number | null;
}

interface TeamRosterOut {
  teamId: string;
  teamName: string;
  ownerDisplayName: string | null;
  externalOwnerId: string | null;
  record: { wins: number; losses: number; ties: number };
  pointsFor: number;
  pointsAgainst: number;
  roster: {
    starters: RosterPlayerOut[];
    bench: RosterPlayerOut[];
    ir: RosterPlayerOut[];
  };
}

async function buildTeamRoster(
  db: ReturnType<typeof import('drizzle-orm/d1').drizzle<typeof schema>>,
  teamId: string
): Promise<TeamRosterOut | null> {
  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, teamId),
  });
  if (!team) return null;

  const rosterRows = await db.query.rosterSpots.findMany({
    where: eq(schema.rosterSpots.teamId, teamId),
    with: { player: true },
  });

  const toOut = (r: (typeof rosterRows)[number]): RosterPlayerOut => ({
    playerId: r.playerId,
    name: r.player?.name ?? '(unknown)',
    position: r.player?.position ?? 'UNK',
    nflTeam: r.player?.team ?? 'FA',
    slot: r.slot,
    isStarter: r.isStarter,
    status: r.player?.status ?? 'active',
    byeWeek: r.player?.byeWeek ?? null,
    age: r.player?.age ?? null,
    injuryNote: r.player?.injuryNote ?? null,
    depthChartOrder: r.player?.depthChartOrder ?? null,
  });

  const starters: RosterPlayerOut[] = [];
  const bench: RosterPlayerOut[] = [];
  const ir: RosterPlayerOut[] = [];

  for (const r of rosterRows) {
    const out = toOut(r);
    if (r.slot === 'IR') ir.push(out);
    else if (r.isStarter) starters.push(out);
    else bench.push(out);
  }

  // Sort starters by a conventional slot order so the UI is predictable
  const slotOrder = [
    'QB',
    'RB1',
    'RB2',
    'WR1',
    'WR2',
    'WR3',
    'TE',
    'FLEX',
    'SUPERFLEX',
    'K',
    'DEF',
  ];
  starters.sort(
    (a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot)
  );

  // Sort bench by position then depth order
  const posOrder = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  bench.sort((a, b) => {
    const pi = posOrder.indexOf(a.position) - posOrder.indexOf(b.position);
    if (pi !== 0) return pi;
    return (a.depthChartOrder ?? 99) - (b.depthChartOrder ?? 99);
  });

  return {
    teamId: team.id,
    teamName: team.name,
    ownerDisplayName: team.ownerDisplayName,
    externalOwnerId: team.externalOwnerId,
    record: { wins: team.wins, losses: team.losses, ties: team.ties },
    pointsFor: team.pointsFor,
    pointsAgainst: team.pointsAgainst,
    roster: { starters, bench, ir },
  };
}

/**
 * GET /api/rosters/:leagueId/mine
 * Returns the authenticated user's own team roster in the given league.
 */
rostersRoutes.get('/:leagueId/mine', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const leagueId = c.req.param('leagueId');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  // Verify membership
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(schema.leagueMembers.userId, user.id),
      eq(schema.leagueMembers.leagueId, leagueId)
    ),
  });
  if (!membership) {
    return c.json({ error: 'Not a member of this league' }, 403);
  }

  // Resolve the user's team: prefer externalOwnerId matching, fall back to ownerId
  const allTeams = await db.query.teams.findMany({
    where: eq(schema.teams.leagueId, leagueId),
  });

  // externalUsername may contain a Sleeper user_id (preferred). If so, prefer that match.
  let userTeam = null;
  if (membership.externalUsername) {
    userTeam = allTeams.find(
      (t) => t.externalOwnerId === membership.externalUsername
    );
  }
  // If the league has no external sync (custom league), there will only be one team per owner.
  if (!userTeam) {
    userTeam = allTeams.find((t) => t.ownerId === user.id);
  }

  if (!userTeam) {
    return c.json({ error: 'No team found for user in this league' }, 404);
  }

  const out = await buildTeamRoster(db, userTeam.id);
  if (!out) return c.json({ error: 'Team not found' }, 404);

  return c.json({ team: out });
});

/**
 * GET /api/rosters/:leagueId/all
 * Returns every team's roster in the league. Used by the Trade Finder.
 */
rostersRoutes.get('/:leagueId/all', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const leagueId = c.req.param('leagueId');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(schema.leagueMembers.userId, user.id),
      eq(schema.leagueMembers.leagueId, leagueId)
    ),
  });
  if (!membership) {
    return c.json({ error: 'Not a member of this league' }, 403);
  }

  const allTeams = await db.query.teams.findMany({
    where: eq(schema.teams.leagueId, leagueId),
  });

  const results: TeamRosterOut[] = [];
  for (const t of allTeams) {
    const out = await buildTeamRoster(db, t.id);
    if (out) results.push(out);
  }

  return c.json({ teams: results });
});

export { rostersRoutes };
