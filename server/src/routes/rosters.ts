import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { resolveMemberSleeperId } from '../services/leagueSync';
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

interface TeamPickOut {
  year: number;
  round: number;
  originalOwnerId: string;
  originalOwnerName: string | null;
  isNative: boolean;
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
  /** Draft picks currently owned by this team, sorted by year then round.
   *  Empty for leagues with no synced pick inventory (redraft). */
  picks: TeamPickOut[];
}

/**
 * Fetch every draft pick in a league in ONE query and group by current
 * owner, joining original-owner names in memory from the teams the routes
 * already loaded. Keeps the /all route free of per-team pick queries.
 */
async function fetchLeaguePicksByOwner(
  db: ReturnType<typeof import('drizzle-orm/d1').drizzle<typeof schema>>,
  leagueId: string,
  teams: Array<{ id: string; name: string }>
): Promise<Map<string, TeamPickOut[]>> {
  const rows = await db.query.teamDraftPicks.findMany({
    where: eq(schema.teamDraftPicks.leagueId, leagueId),
  });
  const nameById = new Map(teams.map((t) => [t.id, t.name]));
  const byOwner = new Map<string, TeamPickOut[]>();
  for (const r of rows) {
    const out: TeamPickOut = {
      year: r.draftYear,
      round: r.draftRound,
      originalOwnerId: r.originalOwnerId,
      originalOwnerName: nameById.get(r.originalOwnerId) ?? null,
      // A pick traded away and back is native again for display purposes.
      isNative: r.ownerId === r.originalOwnerId,
    };
    const list = byOwner.get(r.ownerId);
    if (list) list.push(out);
    else byOwner.set(r.ownerId, [out]);
  }
  for (const list of byOwner.values()) {
    list.sort((a, b) => a.year - b.year || a.round - b.round);
  }
  return byOwner;
}

export async function buildTeamRoster(
  db: ReturnType<typeof import('drizzle-orm/d1').drizzle<typeof schema>>,
  teamId: string,
  picks: TeamPickOut[] = []
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
    picks,
  };
}

/**
 * Resolve the app user's team id in a league: prefer the
 * `externalOwnerId` <-> `leagueMembers.externalUsername` link used for
 * Sleeper/ESPN/Yahoo-synced leagues (reliable even if `teams.ownerId` was
 * ever mis-assigned by a sync bug or is shared with another app user who
 * synced first), falling back to direct `ownerId` ownership for custom,
 * non-synced leagues. Shared by the /mine route and the Ask AI v2
 * `get_matchup` / `get_my_lineup` tools (services/askTools.ts).
 *
 * `externalOwnerId` on a team is always the Sleeper `user_id`, but
 * `externalUsername` on the member's row may have been stored as a
 * username/display_name instead (typed in when they joined) rather than
 * the numeric id — so this matches against both the raw stored value AND
 * the actual Sleeper id it resolves to (via `resolveMemberSleeperId`).
 */
export async function resolveUserTeamId(
  db: ReturnType<typeof import('drizzle-orm/d1').drizzle<typeof schema>>,
  leagueId: string,
  userId: string,
  sleeperIdCache?: Map<string, string | null>,
): Promise<string | null> {
  const allTeams = await db.query.teams.findMany({
    where: eq(schema.teams.leagueId, leagueId),
  });

  let team;
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(schema.leagueMembers.userId, userId),
      eq(schema.leagueMembers.leagueId, leagueId)
    ),
  });
  if (membership?.externalUsername) {
    team = allTeams.find((t) => t.externalOwnerId === membership.externalUsername);
  }
  if (!team) {
    const sleeperId = await resolveMemberSleeperId(db, leagueId, userId, sleeperIdCache);
    if (sleeperId) {
      team = allTeams.find((t) => t.externalOwnerId === sleeperId);
    }
  }
  if (!team) {
    team = allTeams.find((t) => t.ownerId === userId);
  }
  return team?.id ?? null;
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

  const picksByOwner = await fetchLeaguePicksByOwner(db, leagueId, allTeams);
  const out = await buildTeamRoster(db, userTeam.id, picksByOwner.get(userTeam.id) ?? []);
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

  // One query for the whole league's pick inventory (no per-team N+1)
  const picksByOwner = await fetchLeaguePicksByOwner(db, leagueId, allTeams);

  const results: TeamRosterOut[] = [];
  for (const t of allTeams) {
    const out = await buildTeamRoster(db, t.id, picksByOwner.get(t.id) ?? []);
    if (out) results.push(out);
  }

  return c.json({ teams: results });
});

export { rostersRoutes };
