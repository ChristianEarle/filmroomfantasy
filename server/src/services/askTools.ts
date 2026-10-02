/**
 * Ask AI v2 tool definitions + handlers. Each tool gives the model a way to
 * pull live data it wasn't handed in the initial prompt: a specific
 * player's card, a filtered slice of the board, the caller's current
 * matchup, or the caller's own lineup. All handlers are read-only and scoped
 * to data the caller (an authenticated Pro/Elite user) is already allowed to
 * see — `leagueId` is pre-validated by the caller (the /ask route checks
 * league membership) before it ever reaches these handlers.
 */
import { eq, and, desc, inArray } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { AnthropicToolSchema, ToolHandler } from '../utils/anthropicTools';
import { buildPlayerCard } from './playerCard';
import { findPlayersByNameLoose } from '../utils/playerMentions';
import { findCurrentMatchupForTeam } from '../routes/matchups';
import { buildTeamRoster, resolveUserTeamId } from '../routes/rosters';

type DrizzleD1 = ReturnType<typeof import('drizzle-orm/d1').drizzle<typeof schema>>;

export interface AskToolsContext {
  db: DrizzleD1;
  season: number;
  week: number;
  scoringFormat: 'ppr' | 'half-ppr' | 'standard';
  /** Pre-validated: the caller has already confirmed membership, if present. */
  leagueId: string | null;
  userId: string;
}

export const ASK_TOOL_SCHEMAS: AnthropicToolSchema[] = [
  {
    name: 'lookup_player',
    description:
      "Look up a specific NFL player by name and get their full card: bio, season stats, recent form, this week's projection and matchup context, market/dynasty rankings, injury news, and any cached AI take. Use this whenever the question names a player who isn't already in the data you were given.",
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Player name, full or partial (e.g. "Puka Nacua", "Nacua").' },
      },
      required: ['name'],
    },
  },
  {
    name: 'search_players',
    description:
      'Search the current player board, optionally filtered by position and/or restricted to free agents in the caller\'s league. Returns players sorted by this week\'s projection, most first. Use this for "who are the top waiver options at X" or "best available RBs" style questions.',
    input_schema: {
      type: 'object',
      properties: {
        position: { type: 'string', description: 'QB, RB, WR, TE, K, or DEF. Omit for all positions.' },
        availableOnly: { type: 'boolean', description: 'Only include free agents (unrostered) in the caller\'s synced league. Requires a league to be selected.' },
        limit: { type: 'integer', minimum: 1, maximum: 25, description: 'Max players to return (default 25).' },
      },
    },
  },
  {
    name: 'get_matchup',
    description: "Get the caller's current fantasy matchup in their selected league: both teams, scores, and week. Use this for head-to-head or \"will I win this week\" questions.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_my_lineup',
    description: "Get the caller's own roster in their selected league — starters, bench, and IR — with each player's position, status, and bye week. Use this for start/sit or roster-management questions about the caller's own team.",
    input_schema: { type: 'object', properties: {} },
  },
];

function cardOpts(ctx: AskToolsContext) {
  return { season: ctx.season, week: ctx.week, scoringFormat: ctx.scoringFormat };
}

async function handleLookupPlayer(ctx: AskToolsContext, input: Record<string, unknown>) {
  const name = typeof input.name === 'string' ? input.name : '';
  if (!name.trim()) return { error: 'A player name is required.' };

  const matches = await findPlayersByNameLoose(ctx.db, name, 8);
  if (matches.length === 0) return { error: 'not_found', message: `No player found matching "${name}".` };

  if (matches.length > 1) {
    // Exact (case-insensitive) name match short-circuits ambiguity — e.g.
    // "Josh Allen" matching both the Bills QB and the Jaguars LB.
    const exact = matches.filter((m: any) => m.name.toLowerCase() === name.trim().toLowerCase());
    if (exact.length === 1) {
      const card = await buildPlayerCard(ctx.db, exact[0].id, cardOpts(ctx));
      return card ?? { error: 'not_found' };
    }
    return {
      ambiguous: true,
      candidates: matches.map((m: any) => ({ id: m.id, name: m.name, position: m.position, team: m.team })),
    };
  }

  const card = await buildPlayerCard(ctx.db, matches[0].id, cardOpts(ctx));
  return card ?? { error: 'not_found' };
}

async function handleSearchPlayers(ctx: AskToolsContext, input: Record<string, unknown>) {
  const position = typeof input.position === 'string' ? input.position.toUpperCase() : undefined;
  const availableOnly = input.availableOnly === true;
  const rawLimit = typeof input.limit === 'number' ? input.limit : 25;
  const limit = Math.max(1, Math.min(25, Math.floor(rawLimit)));

  if (availableOnly && !ctx.leagueId) {
    return { error: 'no_league', message: 'No league is selected, so free-agent status is unknown.' };
  }

  const conditions = [
    eq(schema.playerProjections.week, ctx.week),
    eq(schema.playerProjections.seasonYear, ctx.season),
    eq(schema.playerProjections.scoringFormat, ctx.scoringFormat),
  ];

  // Over-fetch when filtering by availability so we still return up to
  // `limit` free agents after excluding rostered players.
  const fetchLimit = availableOnly ? Math.max(limit * 4, 100) : limit;

  const projections = await ctx.db.query.playerProjections.findMany({
    where: and(...conditions),
    orderBy: desc(schema.playerProjections.projectedPoints),
    limit: fetchLimit,
    with: { player: { columns: { id: true, name: true, position: true, team: true, status: true } } },
  });

  let filtered = projections.filter((p: any) => p.player);
  if (position) filtered = filtered.filter((p: any) => p.player.position === position);

  if (availableOnly && ctx.leagueId) {
    const teams = await ctx.db.query.teams.findMany({
      where: eq(schema.teams.leagueId, ctx.leagueId),
      with: { roster: true },
    });
    const rosteredIds = new Set(teams.flatMap((t: any) => t.roster.map((r: any) => r.playerId)));
    filtered = filtered.filter((p: any) => !rosteredIds.has(p.player.id));
  }

  return {
    players: filtered.slice(0, limit).map((p: any) => ({
      id: p.player.id,
      name: p.player.name,
      position: p.player.position,
      team: p.player.team,
      status: p.player.status,
      proj: Math.round(p.projectedPoints * 10) / 10,
    })),
  };
}

async function handleGetMatchup(ctx: AskToolsContext) {
  if (!ctx.leagueId) return { error: 'no_league', message: 'No league is selected.' };
  const teamId = await resolveUserTeamId(ctx.db, ctx.leagueId, ctx.userId);
  if (!teamId) return { error: 'no_league', message: "Couldn't find the caller's team in this league." };
  const matchup = await findCurrentMatchupForTeam(ctx.db, ctx.leagueId, teamId);
  if (!matchup) return { error: 'no_matchup', message: 'No matchup found for the current week.' };
  return matchup;
}

async function handleGetMyLineup(ctx: AskToolsContext) {
  if (!ctx.leagueId) return { error: 'no_league', message: 'No league is selected.' };
  const teamId = await resolveUserTeamId(ctx.db, ctx.leagueId, ctx.userId);
  if (!teamId) return { error: 'no_league', message: "Couldn't find the caller's team in this league." };
  const roster = await buildTeamRoster(ctx.db, teamId);
  if (!roster) return { error: 'no_league', message: 'Team not found.' };
  return {
    teamName: roster.teamName,
    starters: roster.roster.starters,
    bench: roster.roster.bench,
    ir: roster.roster.ir,
  };
}

/** Build the tool schema list + a handler map bound to one request's context. */
export function buildAskTools(ctx: AskToolsContext): { schemas: AnthropicToolSchema[]; handlers: Record<string, ToolHandler> } {
  const handlers: Record<string, ToolHandler> = {
    lookup_player: (input) => handleLookupPlayer(ctx, input),
    search_players: (input) => handleSearchPlayers(ctx, input),
    get_matchup: () => handleGetMatchup(ctx),
    get_my_lineup: () => handleGetMyLineup(ctx),
  };
  return { schemas: ASK_TOOL_SCHEMAS, handlers };
}
