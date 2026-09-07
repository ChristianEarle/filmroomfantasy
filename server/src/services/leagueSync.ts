/**
 * Sleeper league sync — shared by the user-triggered POST /:id/sync route
 * (server/src/routes/leagues.ts) and the admin/cron batch sync route
 * (POST /api/admin/sync-leagues, server/src/routes/admin.ts). Extracted so
 * both call exactly the same logic instead of drifting apart.
 *
 * Ownership rule: `teams.ownerId` is NOT NULL (a team always has some app
 * user "owning" it for access purposes), so `decideTeamOwnerId` below never
 * returns null. It corrects a real bug — historically every new "opponent"
 * team row was defaulted to `ownerId: <whichever app user ran the sync>`,
 * so the first app user to sync a shared league ended up "owning" every
 * team in it, and `findCurrentMatchupForTeam` / `resolveUserTeamId` (which
 * resolve "my matchup" via `teams.ownerId`) could resolve to the wrong
 * team — by preferring a *known* app member's id (resolved via
 * `league_members.externalUsername` matched against the Sleeper roster's
 * `owner_id`) whenever one is available, and otherwise falling back to
 * today's placeholder-ownership status quo instead of clobbering it.
 */

import { eq, and, inArray } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import {
  mapStatus,
  throttledFetchAll,
  isValidSleeperRoster,
  isValidSleeperUser,
  isValidSleeperMatchup,
  validateSleeperArray,
  syncDraftPicks,
  fetchSleeperPlayersCached,
} from './sleeper';
import { generateId } from '../utils/id';
import { generateProjectionsFromProps } from './projections';

type DB = ReturnType<typeof drizzle<typeof schema>>;
type LeagueRow = typeof schema.leagues.$inferSelect;
type TeamRow = typeof schema.teams.$inferSelect;
export type LeagueWithTeams = LeagueRow & { teams: TeamRow[] };

export interface SyncSleeperLeagueResult {
  success: true;
  message: string;
  teamsUpdated: number;
  matchupsImported: number;
  statsImported: number;
  projectionsImported: number;
  propsProjections: number;
  tradesIngested: number;
  draftPicksSynced: number;
  userTeamMatched: boolean;
  warning: string | null;
}

export interface SyncSleeperLeagueOptions {
  /**
   * The app user who triggered this sync (the manual "Sync" button in the
   * UI). Used only to (a) resolve "my roster" for the special-case pairing
   * of a pre-existing custom team to a Sleeper roster and (b) build the
   * couldn't-match warning in the response. Omit for the admin/cron batch
   * sync — there's no single acting user there, but ownership for every
   * *known* league member is still corrected from their own
   * `league_members.externalUsername`.
   */
  actingUserId?: string | null;
}

/**
 * Pure ownership decision for one Sleeper roster during sync. Exported so it
 * can be unit tested without a database or network. Never returns null —
 * `teams.ownerId` is NOT NULL — applying these rules in order:
 *
 *   (a) The roster is the acting user's own Sleeper roster (matched via
 *       `actingUserSleeperId`) — always theirs, even before their own
 *       `league_members` row resolves into `sleeperIdToAppUserId`.
 *   (b) The roster's Sleeper `owner_id` resolves to a *different* known app
 *       member (via `sleeperIdToAppUserId`) — always theirs, on both insert
 *       and update, which is what corrects historically wrong rows.
 *   (c) The team row already belongs to a different app user — left alone
 *       so we never clobber someone else's team.
 *   (d) Otherwise: keep the existing owner if the row already has one, or
 *       fall back to whoever is running the sync — the pre-existing
 *       "placeholder ownership" status quo for an unmatched opponent roster
 *       with no other information available.
 */
export function decideTeamOwnerId(params: {
  sleeperOwnerId: string;
  sleeperIdToAppUserId: Map<string, string>;
  currentOwnerId: string | null;
  actingUserId?: string | null;
  actingUserSleeperId?: string | null;
}): string {
  const { sleeperOwnerId, sleeperIdToAppUserId, currentOwnerId, actingUserId, actingUserSleeperId } = params;

  if (actingUserId && actingUserSleeperId && sleeperOwnerId === actingUserSleeperId) {
    return actingUserId;
  }

  const matched = sleeperIdToAppUserId.get(sleeperOwnerId);
  if (matched) return matched;

  if (currentOwnerId && currentOwnerId !== actingUserId) {
    return currentOwnerId;
  }

  // Every real call site reaches this point with at least one of the two
  // set: the user-triggered sync always has an actingUserId, and the
  // admin/cron sync (no actingUserId) only hits the "brand new row" case
  // for rosters that resolve via rule (b) above.
  return (currentOwnerId ?? actingUserId) as string;
}

/**
 * Resolve a single league member's Sleeper user id from their stored
 * `league_members.externalUsername`, which may already be a Sleeper
 * `user_id` (numeric string) or a username/display_name typed in when they
 * joined. Shared by `resolveUserTeamId` (server/src/routes/rosters.ts) and
 * the `/api/matchups/my/current` resolution so both match a team's
 * `externalOwnerId` against the *actual* Sleeper id, not just whatever
 * string happens to be stored.
 *
 * Unlike the bulk `sleeperIdToAppUserId` map built during a full sync
 * (which matches against a live roster of every league member in one
 * `/v1/league/:id/users` call), this resolves one user on demand via
 * Sleeper's `/v1/user/<username>` lookup — so callers should pass a `cache`
 * to memoize repeat lookups within the same request (e.g. resolving every
 * team's owner in a matchup list).
 */
export async function resolveMemberSleeperId(
  db: DB,
  leagueId: string,
  userId: string,
  cache?: Map<string, string | null>
): Promise<string | null> {
  const cacheKey = `${leagueId}:${userId}`;
  if (cache?.has(cacheKey)) return cache.get(cacheKey)!;

  const member = await db.query.leagueMembers.findFirst({
    where: and(eq(schema.leagueMembers.leagueId, leagueId), eq(schema.leagueMembers.userId, userId)),
  });
  const stored = member?.externalUsername;

  let resolved: string | null = null;
  if (stored) {
    if (/^\d+$/.test(stored)) {
      // Already a Sleeper user_id.
      resolved = stored;
    } else {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`https://api.sleeper.app/v1/user/${encodeURIComponent(stored)}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = (await res.json()) as { user_id?: string } | null;
          resolved = data?.user_id ?? null;
        }
      } catch (e) {
        console.error(`Failed to resolve Sleeper username "${stored}" for user ${userId}:`, e);
      }
    }
  }

  cache?.set(cacheKey, resolved);
  return resolved;
}

// Sleeper uses "Invalid"/"0" for empty IR/starter slots - skip these
const INVALID_PLAYER_IDS = new Set(['invalid', '0', '']);

// Build the real starter slot template from the league's `roster_positions`.
// Sleeper's `roster.starters` array is ordered the same way as the non-bench
// entries in `roster_positions`, so mapping index → slot is only correct if
// we use the league's actual starting lineup shape. When the same position
// appears multiple times (e.g. RB, RB, WR, WR, WR) we append a 1-based index
// (RB1, RB2, WR1, WR2, WR3) so downstream sorting can order them correctly.
function buildStarterSlotTemplate(rosterPositions: string[]): string[] {
  const BENCH_SLOTS = new Set(['BN', 'IR', 'TAXI']);
  const startingPositions = rosterPositions.filter(
    (p) => typeof p === 'string' && !BENCH_SLOTS.has(p.toUpperCase())
  );
  const totalCounts: Record<string, number> = {};
  for (const pos of startingPositions) {
    totalCounts[pos] = (totalCounts[pos] || 0) + 1;
  }
  const runningCounts: Record<string, number> = {};
  return startingPositions.map((pos) => {
    runningCounts[pos] = (runningCounts[pos] || 0) + 1;
    // Only number the slot when the same position appears more than once.
    return totalCounts[pos] > 1 ? `${pos}${runningCounts[pos]}` : pos;
  });
}

export async function syncSleeperLeague(
  db: DB,
  league: LeagueWithTeams,
  opts: SyncSleeperLeagueOptions = {}
): Promise<SyncSleeperLeagueResult> {
  const actingUserId = opts.actingUserId ?? null;

  // Fetch rosters, users, players, and league metadata from Sleeper in parallel.
  // We need the league metadata up-front (specifically `roster_positions`) so we
  // can map each starter's array index to its real slot label (QB/RB1/WR3/FLEX/…)
  // instead of using a hardcoded template that breaks for non-standard leagues.
  const [rostersResponse, usersResponse, playersResult, sleeperLeagueResult] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${league.externalId}/rosters`),
    fetch(`https://api.sleeper.app/v1/league/${league.externalId}/users`),
    fetchSleeperPlayersCached(),
    (async () => {
      try {
        const res = await fetch(`https://api.sleeper.app/v1/league/${league.externalId}`);
        if (res.ok) {
          return await res.json() as any;
        }
      } catch (e) {
        console.error('Failed to fetch Sleeper league metadata (sync continues with fallback slot template):', e);
      }
      return null;
    })(),
  ]);

  if (!rostersResponse.ok) {
    throw new Error('Failed to fetch rosters from Sleeper');
  }
  const rostersRaw = await rostersResponse.json();
  const rosters = validateSleeperArray(rostersRaw, isValidSleeperRoster, 'rosters');
  if (rosters.length === 0) {
    throw new Error('No valid rosters returned from Sleeper');
  }

  if (!usersResponse.ok) {
    throw new Error('Failed to fetch users from Sleeper');
  }
  const sleeperUsersRaw = await usersResponse.json();
  const sleeperUsers = validateSleeperArray(sleeperUsersRaw, isValidSleeperUser, 'users');

  const sleeperPlayers = playersResult;

  const leagueRosterPositions: string[] = Array.isArray(sleeperLeagueResult?.roster_positions)
    ? sleeperLeagueResult.roster_positions
    : [];
  // If we couldn't read roster_positions from the Sleeper league metadata, fall
  // back to the standard starting lineup shape. This preserves the old behavior
  // for leagues whose metadata fetch failed rather than blocking the whole sync.
  const starterSlots = leagueRosterPositions.length > 0
    ? buildStarterSlotTemplate(leagueRosterPositions)
    : ['QB', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX', 'K', 'DEF'];

  // Create a map of owner_id to user info
  const userMap = new Map<string, any>();
  for (const sleeperUser of sleeperUsers) {
    userMap.set(sleeperUser.user_id, sleeperUser);
  }

  // Every app user who's a member of this league — not just the one who
  // triggered this sync. Each member's `externalUsername` (a Sleeper
  // user_id or a username/display_name, set when they joined) is resolved
  // against the live Sleeper users list so ownership can be corrected for
  // everyone, and so an admin/cron sync (no acting user) still gets it right.
  const members = await db.query.leagueMembers.findMany({
    where: eq(schema.leagueMembers.leagueId, league.id),
  });

  const sleeperIdToAppUserId = new Map<string, string>();
  for (const member of members) {
    if (!member.externalUsername) continue;
    const stored = member.externalUsername;
    // First try direct user_id match (most reliable)
    const directMatch = sleeperUsers.find(u => u.user_id === stored);
    if (directMatch) {
      sleeperIdToAppUserId.set(directMatch.user_id, member.userId);
      continue;
    }
    // Fall back to username/display_name matching
    for (const sleeperUser of sleeperUsers) {
      if (
        sleeperUser.display_name?.toLowerCase() === stored.toLowerCase() ||
        sleeperUser.username?.toLowerCase() === stored.toLowerCase()
      ) {
        sleeperIdToAppUserId.set(sleeperUser.user_id, member.userId);
        break;
      }
    }
  }

  // The acting user's own Sleeper roster id (if resolvable) — used only for
  // the special-case pairing of a pre-existing custom team below and the
  // couldn't-match warning in the response.
  let userSleeperUserId: string | null = null;
  const actingMembership = actingUserId ? members.find(m => m.userId === actingUserId) ?? null : null;
  if (actingUserId) {
    for (const [sleeperId, appUserId] of sleeperIdToAppUserId) {
      if (appUserId === actingUserId) {
        userSleeperUserId = sleeperId;
        break;
      }
    }
  }

  // Find the acting user's pre-existing team in our database, if any. This
  // only matters the first time a manually-created (pre-Sleeper) team gets
  // linked up — once externalOwnerId is set, the generic externalOwnerId
  // match below finds it every time.
  const userTeam = actingUserId
    ? (league.teams.find(t => t.ownerId === actingUserId) ||
        (userSleeperUserId
          ? league.teams.find(t => t.externalOwnerId === userSleeperUserId)
          : undefined))
    : undefined;

  // Track whether the acting user's roster has been paired up yet
  let userRosterAssigned = false;

  // Pre-fetch all players referenced across all rosters in one batch query
  const allExternalPlayerIds = new Set<string>();
  for (const roster of rosters) {
    if (roster.players) {
      for (const pid of roster.players) {
        if (pid && !INVALID_PLAYER_IDS.has(String(pid).toLowerCase())) {
          allExternalPlayerIds.add(String(pid));
        }
      }
    }
  }
  const externalIdArray = Array.from(allExternalPlayerIds);
  const existingPlayersByExtId = new Map<string, { id: string }>();
  if (externalIdArray.length > 0) {
    // Batch in chunks of 50 to stay within D1's SQL variable limits
    for (let i = 0; i < externalIdArray.length; i += 50) {
      const chunk = externalIdArray.slice(i, i + 50);
      const found = await db.query.nflPlayers.findMany({
        where: inArray(schema.nflPlayers.externalId, chunk),
        columns: { id: true, externalId: true },
      });
      for (const p of found) {
        if (p.externalId) existingPlayersByExtId.set(p.externalId, { id: p.id });
      }
    }
  }

  // Process each roster
  for (const roster of rosters) {
    const sleeperUser = userMap.get(roster.owner_id);
    const teamName = sleeperUser?.metadata?.team_name || sleeperUser?.display_name || `Team ${roster.roster_id}`;
    const ownerDisplayName = sleeperUser?.display_name || sleeperUser?.username || `Owner ${roster.roster_id}`;
    const sleeperOwnerId = String(roster.owner_id);

    // Check if this roster belongs to the acting user - match by Sleeper user ID only (no fallback to first roster)
    const isUserTeam = !!(actingUserId && userTeam && !userRosterAssigned && userSleeperUserId && roster.owner_id === userSleeperUserId);

    let team;
    if (isUserTeam) {
      // Update the existing user team with Sleeper data
      team = userTeam!;
      userRosterAssigned = true;
      await db.update(schema.teams)
        .set({
          ownerId: decideTeamOwnerId({ sleeperOwnerId, sleeperIdToAppUserId, currentOwnerId: team.ownerId, actingUserId, actingUserSleeperId: userSleeperUserId }),
          externalOwnerId: sleeperOwnerId,
          ownerDisplayName,
          name: teamName,
          wins: roster.settings?.wins || 0,
          losses: roster.settings?.losses || 0,
          ties: roster.settings?.ties || 0,
          pointsFor: roster.settings?.fpts || 0,
          pointsAgainst: roster.settings?.fpts_against || 0,
          waiverPriority: roster.settings?.waiver_position || 1,
          faabBudget: roster.settings?.waiver_budget_used != null
            ? Math.max(0, (league.waiverBudget || 100) - roster.settings.waiver_budget_used)
            : league.waiverBudget || 100,
          updatedAt: new Date(),
        })
        .where(eq(schema.teams.id, team.id));
    } else {
      // Check if an opponent team already exists for this Sleeper user.
      // Prefer externalOwnerId — it's the stable Sleeper user_id and won't
      // collide when two teams share a display name. Fall back to the
      // legacy name-based match only for teams created by older syncs
      // that never recorded externalOwnerId.
      const existingTeam =
        league.teams.find(t => t.externalOwnerId === sleeperOwnerId) ||
        league.teams.find(t =>
          !t.externalOwnerId && (t.name === teamName || t.name.includes(`Roster ${roster.roster_id}`))
        );

      if (existingTeam) {
        team = existingTeam;
        await db.update(schema.teams)
          .set({
            ownerId: decideTeamOwnerId({ sleeperOwnerId, sleeperIdToAppUserId, currentOwnerId: existingTeam.ownerId, actingUserId, actingUserSleeperId: userSleeperUserId }),
            externalOwnerId: sleeperOwnerId,
            ownerDisplayName,
            name: teamName,
            wins: roster.settings?.wins || 0,
            losses: roster.settings?.losses || 0,
            ties: roster.settings?.ties || 0,
            pointsFor: roster.settings?.fpts || 0,
            pointsAgainst: roster.settings?.fpts_against || 0,
            waiverPriority: roster.settings?.waiver_position || 1,
            updatedAt: new Date(),
          })
          .where(eq(schema.teams.id, team.id));
      } else {
        // Create new team for this roster. ownerId prefers a known app
        // member match — an unmatched opponent roster falls back to
        // whoever is running the sync, since teams.ownerId is NOT NULL
        // (see decideTeamOwnerId doc comment above).
        const teamId = generateId();
        await db.insert(schema.teams).values({
          id: teamId,
          leagueId: league.id,
          ownerId: decideTeamOwnerId({ sleeperOwnerId, sleeperIdToAppUserId, currentOwnerId: null, actingUserId, actingUserSleeperId: userSleeperUserId }),
          externalOwnerId: sleeperOwnerId,
          ownerDisplayName,
          name: teamName,
          wins: roster.settings?.wins || 0,
          losses: roster.settings?.losses || 0,
          ties: roster.settings?.ties || 0,
          pointsFor: roster.settings?.fpts || 0,
          pointsAgainst: roster.settings?.fpts_against || 0,
          waiverPriority: roster.settings?.waiver_position || 1,
          faabBudget: roster.settings?.waiver_budget_used != null
            ? Math.max(0, (league.waiverBudget || 100) - roster.settings.waiver_budget_used)
            : league.waiverBudget || 100,
        });
        team = { id: teamId };
      }
    }

    // Sync roster players.
    // We build the full set of new roster_spots rows in memory first, then
    // delete + bulk-insert at the end. D1 has no real transactions, so the
    // previous pattern (delete-then-insert-in-a-loop) left a team with an
    // empty roster if any player insert failed mid-way. Doing all the work
    // up-front means a thrown error aborts before we wipe the old rows.
    if (roster.players && roster.players.length > 0 && (isUserTeam || team)) {
      // Get starters array from roster. Sleeper orders this array to match the
      // non-bench entries of the league's `roster_positions`, and uses the
      // sentinel "0" / "Invalid" for empty starter slots — so `starters[i]`
      // corresponds to `starterSlots[i]` position-for-position.
      const starters = roster.starters || [];

      const newSpots: Array<{
        id: string;
        teamId: string;
        playerId: string;
        slot: string;
        isStarter: boolean;
        acquiredType: 'sync';
      }> = [];

      for (let i = 0; i < roster.players.length; i++) {
        const playerId = roster.players[i];
        if (!playerId || INVALID_PLAYER_IDS.has(String(playerId).toLowerCase())) continue;
        const starterIndex = starters.indexOf(playerId);
        const isStarter = starterIndex >= 0 && starterIndex < starterSlots.length;

        // Determine slot
        let slot: string;
        if (isStarter) {
          slot = starterSlots[starterIndex];
        } else {
          // Bench slot
          const benchIndex = roster.players.filter((p: string, idx: number) =>
            !starters.includes(p) && idx < i
          ).length;
          slot = `BN${benchIndex + 1}`;
        }

        // Check if player exists in our database (from pre-fetched batch)
        let player = existingPlayersByExtId.get(playerId) || null;

        // If player doesn't exist, create from pre-fetched Sleeper data.
        // Player-row leaks across syncs are harmless (rows in a shared
        // table), so we don't bother rolling them back if a later step
        // fails — but we still let the error propagate to abort the sync
        // rather than silently producing an incomplete roster.
        if (!player) {
          const playerData = sleeperPlayers[playerId];

          const newPlayerId = generateId();
          await db.insert(schema.nflPlayers).values({
            id: newPlayerId,
            externalId: playerId,
            name: playerData
              ? `${playerData.first_name || ''} ${playerData.last_name || ''}`.trim() || `Player ${playerId}`
              : `Player ${playerId}`,
            firstName: playerData?.first_name,
            lastName: playerData?.last_name,
            team: playerData?.team || 'FA',
            position: playerData?.position || 'UNK',
            status: mapStatus(playerData?.status, playerData?.injury_status),
            injuryNote: playerData?.injury_notes,
            injuryBodyPart: playerData?.injury_body_part,
            byeWeek: playerData?.bye_week,
            age: playerData?.age,
            height: playerData?.height,
            weight: playerData?.weight,
            college: playerData?.college,
            yearsExp: playerData?.years_exp,
            jerseyNumber: playerData?.number,
            depthChartOrder: playerData?.depth_chart_order,
          });
          player = { id: newPlayerId };
          existingPlayersByExtId.set(playerId, { id: newPlayerId });
        }

        newSpots.push({
          id: generateId(),
          teamId: team.id,
          playerId: player.id,
          slot,
          isStarter,
          acquiredType: 'sync',
        });
      }

      // All new rows successfully constructed — now swap them in.
      // Delete + insert still aren't atomic in D1, but the window is tiny
      // and any failure here is logged at the outer catch.
      await db.delete(schema.rosterSpots)
        .where(eq(schema.rosterSpots.teamId, team.id));
      if (newSpots.length > 0) {
        // Chunk inserts to stay well under D1's bound-parameter ceiling.
        for (let i = 0; i < newSpots.length; i += 50) {
          await db.insert(schema.rosterSpots).values(newSpots.slice(i, i + 50));
        }
      }
    }
  }

  // Now sync matchups from Sleeper
  // Build a map of roster_id to team_id
  const rosterIdToTeamId = new Map<number, string>();

  // Re-fetch teams after creating them
  const updatedTeams = await db.query.teams.findMany({
    where: eq(schema.teams.leagueId, league.id),
  });

  // Map rosters to teams by externalOwnerId (stable Sleeper user_id).
  // Falling back to name would mis-route matchups when two Sleeper users
  // share a display name; the team rows we just upserted above all carry
  // externalOwnerId, so this lookup is reliable.
  for (const roster of rosters) {
    const sleeperOwnerId = String(roster.owner_id);
    const matchingTeam = updatedTeams.find(t => t.externalOwnerId === sleeperOwnerId);
    if (matchingTeam) {
      rosterIdToTeamId.set(roster.roster_id, matchingTeam.id);
    }
  }

  // ── Apply Sleeper league metadata (fetched earlier) for week & settings ──
  let matchupsImported = 0;
  let regularSeasonWeeks = 14; // fallback
  let playoffWeeksCount = league.playoffWeeks || 3; // fallback
  let effectiveCurrentWeek = league.currentWeek || 1;

  try {
    if (sleeperLeagueResult) {
      const sleeperLeague = sleeperLeagueResult;
      const settings = sleeperLeague?.settings || {};
      const scoringSettings = sleeperLeague?.scoring_settings || {};
      const rosterPositions: string[] = leagueRosterPositions;
      const playoffWeekStart = settings.playoff_week_start || 15;
      regularSeasonWeeks = playoffWeekStart - 1; // e.g., 14
      const sleeperLeg = settings.leg || 1;
      const leagueStatus = sleeperLeague?.status || 'in_season';
      const sleeperPlayoffTeams = settings.playoff_teams || league.playoffTeams || 6;
      const sleeperTeamCount = settings.num_teams || league.teamCount || 12;

      // If season is complete or in playoffs, all regular season weeks are done
      if (leagueStatus === 'complete' || sleeperLeg > regularSeasonWeeks) {
        effectiveCurrentWeek = regularSeasonWeeks + 1;
      } else {
        effectiveCurrentWeek = sleeperLeg;
      }

      // Derive extended settings so the Trade Analyzer can auto-populate
      // format + advanced toggles instead of asking the user.
      //
      // Scoring format — Sleeper stores a `rec` value in scoring_settings:
      //   1.0 = full PPR, 0.5 = half, 0 = standard
      const recVal = Number(scoringSettings.rec ?? 0);
      const derivedScoringFormat: 'ppr' | 'half-ppr' | 'standard' =
        recVal >= 0.9 ? 'ppr' : recVal >= 0.4 ? 'half-ppr' : 'standard';

      // TE premium — TE-specific reception bonus beyond base PPR
      const recTeVal = Number(scoringSettings.rec_te ?? 0);
      const bonusRecTeVal = Number(scoringSettings.bonus_rec_te ?? 0);
      const derivedTePremium = recTeVal + bonusRecTeVal > 0;

      // Superflex — a SUPER_FLEX slot (or 2+ QB slots) in the roster
      const qbSlotCount = rosterPositions.filter((p) => p === 'QB').length;
      const derivedSuperflex =
        rosterPositions.includes('SUPER_FLEX') || qbSlotCount >= 2;

      // League type — Sleeper `settings.type`: 0 redraft, 1 keeper, 2 dynasty
      const sleeperType = Number(settings.type ?? 0);
      const derivedLeagueType: 'redraft' | 'dynasty' | 'keeper' =
        sleeperType === 2 ? 'dynasty' : sleeperType === 1 ? 'keeper' : 'redraft';

      // Persist accurate league settings from Sleeper
      await db.update(schema.leagues)
        .set({
          currentWeek: effectiveCurrentWeek,
          playoffTeams: sleeperPlayoffTeams,
          teamCount: sleeperTeamCount,
          playoffWeeks: (playoffWeeksCount = settings.playoff_round_type === 2 ? 2 : 3),
          scoringFormat: derivedScoringFormat,
          leagueType: derivedLeagueType,
          hasSuperflex: derivedSuperflex,
          hasTePremium: derivedTePremium,
          updatedAt: new Date(),
        })
        .where(eq(schema.leagues.id, league.id));
    }
  } catch (e) {
    console.log('Could not fetch Sleeper league metadata, using stored currentWeek');
  }

  // Fetch matchups for ALL weeks including playoffs
  const totalWeeks = regularSeasonWeeks + playoffWeeksCount;
  const weekNumbers = Array.from({ length: totalWeeks }, (_, i) => i + 1);
  const matchupUrls = weekNumbers.map(week =>
    `https://api.sleeper.app/v1/league/${league.externalId}/matchups/${week}`
  );
  const matchupResponses = await throttledFetchAll<any[]>(matchupUrls, 5, 200);

  // Process matchups for each week
  for (let i = 0; i < weekNumbers.length; i++) {
    const week = weekNumbers[i];
    const rawMatchups = matchupResponses[i];
    if (!rawMatchups) continue;

    const weekMatchups = validateSleeperArray(rawMatchups, isValidSleeperMatchup, `matchups week ${week}`);
    if (weekMatchups.length === 0) continue;

    // Group matchups by matchup_id
    const matchupGroups = new Map<number, typeof weekMatchups>();
    for (const m of weekMatchups) {
      if (m.matchup_id) {
        if (!matchupGroups.has(m.matchup_id)) {
          matchupGroups.set(m.matchup_id, []);
        }
        matchupGroups.get(m.matchup_id)!.push(m);
      }
    }

    // Process each matchup pair
    for (const [, teams] of matchupGroups) {
      if (teams.length === 2) {
        const team1 = teams[0];
        const team2 = teams[1];

        const homeTeamId = rosterIdToTeamId.get(team1.roster_id);
        const awayTeamId = rosterIdToTeamId.get(team2.roster_id);

        if (homeTeamId && awayTeamId) {
          // Check if matchup already exists
          const existingMatchup = await db.query.matchups.findFirst({
            where: and(
              eq(schema.matchups.leagueId, league.id),
              eq(schema.matchups.week, week),
              eq(schema.matchups.homeTeamId, homeTeamId)
            ),
          });

          const isPlayoffWeek = week > regularSeasonWeeks;
          const isChampionshipWeek = week === regularSeasonWeeks + playoffWeeksCount;

          // Convert Sleeper starters (external IDs) to internal IDs
          const homeStarters = (team1.starters || [])
            .map((eid: string) => existingPlayersByExtId.get(eid)?.id)
            .filter((id: string | undefined): id is string => !!id);
          const awayStarters = (team2.starters || [])
            .map((eid: string) => existingPlayersByExtId.get(eid)?.id)
            .filter((id: string | undefined): id is string => !!id);

          if (!existingMatchup) {
            // Create the matchup
            await db.insert(schema.matchups).values({
              id: generateId(),
              leagueId: league.id,
              week,
              homeTeamId,
              awayTeamId,
              homeScore: team1.points || 0,
              awayScore: team2.points || 0,
              homeProjectedScore: team1.projected_points || 0,
              awayProjectedScore: team2.projected_points || 0,
              isComplete: week < effectiveCurrentWeek,
              isPlayoff: isPlayoffWeek,
              isChampionship: isChampionshipWeek,
              homeStartersJson: homeStarters.length > 0 ? JSON.stringify(homeStarters) : null,
              awayStartersJson: awayStarters.length > 0 ? JSON.stringify(awayStarters) : null,
            });
            matchupsImported++;
          } else {
            // Update existing matchup scores and playoff flags
            await db.update(schema.matchups)
              .set({
                homeScore: team1.points || 0,
                awayScore: team2.points || 0,
                isComplete: week < effectiveCurrentWeek,
                isPlayoff: isPlayoffWeek,
                isChampionship: isChampionshipWeek,
                homeStartersJson: homeStarters.length > 0 ? JSON.stringify(homeStarters) : null,
                awayStartersJson: awayStarters.length > 0 ? JSON.stringify(awayStarters) : null,
              })
              .where(eq(schema.matchups.id, existingMatchup.id));
          }
        }
      }
    }
  }

  // ========================================
  // STEP 4: Import player stats for the current season
  // ========================================
  let statsImported = 0;

  // Get all unique player external IDs from all rosters (exclude placeholders like Invalid/0)
  const allRosteredPlayerIds = new Set<string>();
  for (const roster of rosters) {
    if (roster.players) {
      for (const playerId of roster.players) {
        if (playerId && !INVALID_PLAYER_IDS.has(String(playerId).toLowerCase())) {
          allRosteredPlayerIds.add(playerId);
        }
      }
    }
  }

  // Fetch all weeks of stats in parallel (much faster than sequential)
  const statsWeekLimit = Math.min(effectiveCurrentWeek, totalWeeks);
  const statsUrls = Array.from({ length: statsWeekLimit }, (_, i) => {
    const week = i + 1;
    const seasonType = week > regularSeasonWeeks ? 'post' : 'regular';
    return `https://api.sleeper.com/stats/nfl/${league.seasonYear}/${week}?season_type=${seasonType}`;
  });
  const allWeekStats = await throttledFetchAll<Record<string, any>>(statsUrls, 5, 200);

  // Pre-fetch existing stats for all rostered players in bulk
  const playerIdArray = Array.from(existingPlayersByExtId.entries());
  const existingStatsMap = new Map<string, { id: string }>();
  for (let i = 0; i < playerIdArray.length; i += 50) {
    const chunk = playerIdArray.slice(i, i + 50).map(([, p]) => p.id);
    const found = await db.query.playerWeeklyStats.findMany({
      where: and(
        inArray(schema.playerWeeklyStats.playerId, chunk),
        eq(schema.playerWeeklyStats.seasonYear, league.seasonYear)
      ),
      columns: { id: true, playerId: true, week: true },
    });
    for (const s of found) {
      existingStatsMap.set(`${s.playerId}_${s.week}`, { id: s.id });
    }
  }

  // Process stats using pre-fetched maps (no per-player DB lookups)
  for (let i = 0; i < statsWeekLimit; i++) {
    const week = i + 1;
    const weekStats = allWeekStats[i];
    if (!weekStats) continue;

    try {
      for (const sleeperPlayerId of allRosteredPlayerIds) {
        const playerStats = weekStats[sleeperPlayerId];
        if (!playerStats) continue;

        // Use pre-fetched player map instead of DB query
        const player = existingPlayersByExtId.get(sleeperPlayerId);
        if (!player) continue;

        const statsKey = `${player.id}_${week}`;
        const existingStats = existingStatsMap.get(statsKey);

        const statsData = {
          playerId: player.id,
          week,
          seasonYear: league.seasonYear,
          opponent: playerStats.opponent || null,
          passAttempts: playerStats.pass_att || 0,
          passCompletions: playerStats.pass_cmp || 0,
          passYards: playerStats.pass_yd || 0,
          passTDs: playerStats.pass_td || 0,
          passInterceptions: playerStats.pass_int || 0,
          rushAttempts: playerStats.rush_att || 0,
          rushYards: playerStats.rush_yd || 0,
          rushTDs: playerStats.rush_td || 0,
          targets: playerStats.rec_tgt || 0,
          receptions: playerStats.rec || 0,
          receivingYards: playerStats.rec_yd || 0,
          receivingTDs: playerStats.rec_td || 0,
          fumbles: playerStats.fum || 0,
          fumblesLost: playerStats.fum_lost || 0,
          twoPointConversions: (playerStats.pass_2pt || 0) + (playerStats.rush_2pt || 0) + (playerStats.rec_2pt || 0),
          fgMade: playerStats.fgm || 0,
          fgAttempts: playerStats.fga || 0,
          fg40PlusMade: (playerStats.fgm_40_49 || 0) + (playerStats.fgm_50p || 0),
          fg50PlusMade: playerStats.fgm_50p || 0,
          xpMade: playerStats.xpm || 0,
          xpAttempts: playerStats.xpa || 0,
          offSnaps: Math.round(playerStats.off_snp || 0),
          defSnaps: Math.round(playerStats.def_snp || 0),
          stSnaps: Math.round(playerStats.st_snp || 0),
          tmOffSnaps: Math.round(playerStats.tm_off_snp || 0),
          tmDefSnaps: Math.round(playerStats.tm_def_snp || 0),
          tmStSnaps: Math.round(playerStats.tm_st_snp || 0),
          sacks: playerStats.sack || 0,
          defInterceptions: playerStats.int || 0,
          fumblesRecovered: playerStats.fum_rec || 0,
          defenseTDs: (playerStats.def_td || 0) + (playerStats.st_td || 0),
          safeties: playerStats.safe || 0,
          pointsAllowed: playerStats.pts_allow || 0,
          fantasyPointsPPR: playerStats.pts_ppr || 0,
          fantasyPointsHalf: playerStats.pts_half_ppr || 0,
          fantasyPointsStd: playerStats.pts_std || 0,
        };

        if (existingStats) {
          await db.update(schema.playerWeeklyStats)
            .set(statsData)
            .where(eq(schema.playerWeeklyStats.id, existingStats.id));
        } else {
          await db.insert(schema.playerWeeklyStats).values({
            id: generateId(),
            ...statsData,
          });
          existingStatsMap.set(statsKey, { id: 'new' });
          statsImported++;
        }
      }
    } catch (e) {
      console.error(`Failed to process stats for week ${week}:`, e);
    }
  }

  // ========================================
  // STEP 5: Import projections for current/upcoming week (ALL players in DB)
  // Projections are calculated from book lines (player props) first,
  // then Sleeper projections fill in any remaining players.
  // ========================================
  let projectionsImported = 0;
  let propsProjectionsCount = 0;
  // Use the current week for projections (capped to regular season)
  const projectionWeek = Math.min(effectiveCurrentWeek, regularSeasonWeeks);

  try {
    // Step 5a: Generate projections from book lines (player props)
    const propsResult = await generateProjectionsFromProps(db, projectionWeek, league.seasonYear);
    propsProjectionsCount = propsResult.generated + propsResult.updated;

    // Track which players already have props-based projections
    const playersCoveredByProps = new Set<string>();
    if (propsProjectionsCount > 0) {
      const propsProjections = await db.query.playerProjections.findMany({
        where: and(
          eq(schema.playerProjections.week, projectionWeek),
          eq(schema.playerProjections.seasonYear, league.seasonYear)
        ),
        columns: { playerId: true },
      });
      for (const p of propsProjections) {
        playersCoveredByProps.add(p.playerId);
      }
    }

    // Step 5b: Sleeper fallback for players without prop lines
    const projectionsResponse = await fetch(
      `https://api.sleeper.com/projections/nfl/${league.seasonYear}/${projectionWeek}?season_type=regular`
    );

    if (projectionsResponse.ok) {
      const projections = await projectionsResponse.json() as Record<string, any>;

      // Check if week is complete (for snapshot - only snapshot before overwrite if game not played)
      const gamesForWeek = await db.query.nflGames.findMany({
        where: and(eq(schema.nflGames.week, projectionWeek), eq(schema.nflGames.seasonYear, league.seasonYear)),
        columns: { isComplete: true, homeScore: true, awayScore: true },
      });
      const weekComplete = gamesForWeek.length > 0 && gamesForWeek.every(g => g.isComplete || (g.homeScore != null && g.awayScore != null));

      // Pre-fetch existing projections for this week in bulk
      const scoringFormat = league.scoringFormat || 'ppr';
      const existingProjMap = new Map<string, any>();
      const allPlayerIds = Array.from(existingPlayersByExtId.values()).map(p => p.id);
      for (let pi = 0; pi < allPlayerIds.length; pi += 50) {
        const chunk = allPlayerIds.slice(pi, pi + 50);
        const found = await db.query.playerProjections.findMany({
          where: and(
            inArray(schema.playerProjections.playerId, chunk),
            eq(schema.playerProjections.week, projectionWeek),
            eq(schema.playerProjections.seasonYear, league.seasonYear),
            eq(schema.playerProjections.scoringFormat, scoringFormat)
          ),
        });
        for (const p of found) {
          existingProjMap.set(p.playerId, p);
        }
      }

      // Import projections for players NOT already covered by book lines
      for (const [sleeperPlayerId, playerProj] of Object.entries(projections)) {
        if (!playerProj) continue;

        // Use pre-fetched player map instead of DB query
        const player = existingPlayersByExtId.get(sleeperPlayerId);
        if (!player) continue;

        // Skip players already covered by book line projections
        if (playersCoveredByProps.has(player.id)) continue;

        const existingProj = existingProjMap.get(player.id);

        const projData = {
          playerId: player.id,
          week: projectionWeek,
          seasonYear: league.seasonYear,
          scoringFormat,
          projectedPoints: scoringFormat === 'ppr'
            ? (playerProj.pts_ppr || 0)
            : scoringFormat === 'half_ppr'
              ? (playerProj.pts_half_ppr || 0)
              : (playerProj.pts_std || 0),
          projPassYards: playerProj.pass_yd || null,
          projPassTDs: playerProj.pass_td || null,
          projRushYards: playerProj.rush_yd || null,
          projRushTDs: playerProj.rush_td || null,
          projReceptions: playerProj.rec || null,
          projRecYards: playerProj.rec_yd || null,
          projRecTDs: playerProj.rec_td || null,
          updatedAt: new Date(),
        };

        if (existingProj) {
          if (!weekComplete) {
            await db.insert(schema.projectionLineSnapshots).values({
              id: generateId(),
              playerId: player.id,
              week: projectionWeek,
              seasonYear: league.seasonYear,
              scoringFormat,
              snapshotAt: new Date(),
              projectedPoints: existingProj.projectedPoints,
              projPassYards: existingProj.projPassYards ?? null,
              projPassTDs: existingProj.projPassTDs ?? null,
              projRushYards: existingProj.projRushYards ?? null,
              projRushTDs: existingProj.projRushTDs ?? null,
              projReceptions: existingProj.projReceptions ?? null,
              projRecYards: existingProj.projRecYards ?? null,
              projRecTDs: existingProj.projRecTDs ?? null,
            });
          }
          await db.update(schema.playerProjections)
            .set(projData)
            .where(eq(schema.playerProjections.id, existingProj.id));
        } else {
          await db.insert(schema.playerProjections).values({
            id: generateId(),
            ...projData,
          });
          projectionsImported++;
        }
      }
    }
  } catch (e) {
    console.error('Failed to fetch projections:', e);
  }

  // Auto-ingest executed trades into the historical trades table.
  // Safe + idempotent — failures don't block the rest of the sync.
  let tradesIngested = 0;
  try {
    const { ingestSleeperTrades } = await import('./tradeIngest');
    const stats = await ingestSleeperTrades(db, league.id);
    tradesIngested = stats.inserted + stats.updated;
    if (stats.errors > 0) {
      console.warn(
        `[sleeper sync] Trade ingest completed with ${stats.errors} errors for league ${league.id}`
      );
    }
  } catch (e) {
    console.error('Trade ingest failed (non-blocking):', e);
  }

  // Draft-pick inventory (dynasty/keeper leagues only — redraft skips
  // inside the service). Try/caught so a pick-sync failure never fails
  // the league sync. Non-Sleeper platforms never reach this branch.
  let draftPicksSynced = 0;
  try {
    const pickStats = await syncDraftPicks(db, league.id, league.externalId!);
    if (pickStats.skipped) {
      console.log(`[sleeper sync] Draft pick sync skipped for league ${league.id}: ${pickStats.skipped}`);
    } else {
      draftPicksSynced = pickStats.seeded;
      console.log(
        `[sleeper sync] Draft picks synced for league ${league.id}: ${pickStats.seeded} seeded, ${pickStats.traded} traded overlays`
      );
    }
  } catch (e) {
    console.error('Draft pick sync failed (non-blocking):', e);
  }

  // If we couldn't pin the acting user to a Sleeper roster, surface a
  // warning so the UI can prompt them to set their Sleeper username
  // (otherwise their "my team" view will be empty even though the league
  // synced fine). Admin/cron syncs have no acting user, so no warning.
  const userMatchWarning = actingUserId && !userRosterAssigned
    ? (actingMembership?.externalUsername
        ? `We synced the league but couldn't find a Sleeper roster matching "${actingMembership.externalUsername}". Re-enter your Sleeper username in league settings.`
        : 'We synced the league but don\'t know which roster is yours. Add your Sleeper username in league settings to see your team.')
    : null;

  return {
    success: true,
    message: `League synced successfully from Sleeper. ${rosters.length} teams, ${matchupsImported} matchups, ${statsImported} player stats, ${propsProjectionsCount} projections from book lines, ${projectionsImported} projections from Sleeper, and ${tradesIngested} trades updated.`,
    teamsUpdated: rosters.length,
    matchupsImported,
    statsImported,
    projectionsImported,
    propsProjections: propsProjectionsCount,
    tradesIngested,
    draftPicksSynced,
    userTeamMatched: userRosterAssigned,
    warning: userMatchWarning,
  };
}
