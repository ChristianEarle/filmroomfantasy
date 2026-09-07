/**
 * Sleeper API integration for fetching NFL player data.
 * API docs: https://docs.sleeper.com/
 * Rate limit: ~1000 calls/minute. Players endpoint should be called at most once per day.
 */

import { eq, sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { generateId } from '../utils/id';

type DB = ReturnType<typeof drizzle<typeof schema>>;

const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';
const SLEEPER_PLAYERS_URL = 'https://api.sleeper.app/v1/players/nfl';

// Fantasy-relevant positions we want to store
const FANTASY_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);

// NFL team abbreviations for DEF entries (in case Sleeper doesn't include them)
const NFL_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN',
  'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA',
  'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB',
  'TEN', 'WAS',
];

export interface SleeperPlayer {
  player_id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  team?: string | null;
  position?: string;
  fantasy_positions?: string[] | null;
  status?: string;
  injury_status?: string | null;
  injury_notes?: string | null;
  injury_body_part?: string | null;
  age?: number | null;
  height?: string | null;
  weight?: string | null;
  college?: string | null;
  years_exp?: number | null;
  number?: number | null;
  depth_chart_order?: number | null;
  espn_id?: number | null;
  yahoo_id?: number | null;
  swish_id?: number | null;
  active?: boolean;
}

/** Build headshot URL from Sleeper player. ESPN preferred; Sleeper CDN fallback for all players. */
export function buildHeadshotUrl(player: SleeperPlayer, sleeperId?: string): string | null {
  // ESPN has higher quality when available
  if (player.espn_id != null) {
    return `https://a.espncdn.com/i/headshots/nfl/players/full/${player.espn_id}.png`;
  }
  // Sleeper CDN - hosts images for all NFL players (covers rookies, players without espn_id)
  const id = player.player_id ?? sleeperId;
  if (id) {
    return `https://sleepercdn.com/content/nfl/players/${id}.jpg`;
  }
  return null;
}

export interface MappedPlayer {
  id: string;
  externalId: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  team: string;
  position: string;
  status: string;
  injuryNote: string | null;
  injuryBodyPart: string | null;
  headshotUrl: string | null;
  age: number | null;
  height: string | null;
  weight: number | null;
  college: string | null;
  yearsExp: number | null;
  jerseyNumber: number | null;
  depthChartOrder: number | null;
}

/**
 * Map Sleeper status/injury_status to our canonical status.
 * Sleeper returns "Invalid" and "Inactive" for non-injury cases; we treat those as active.
 */
export function mapStatus(sleeperStatus?: string, injuryStatus?: string | null): string {
  const status = (sleeperStatus || 'Active').toLowerCase();
  const injury = (injuryStatus || '').toLowerCase();

  if (status === 'injured_reserve' || injury === 'ir') return 'injured_reserve';
  if (status === 'out' || injury === 'out') return 'out';
  if (injury === 'doubtful') return 'doubtful';
  if (injury === 'questionable') return 'questionable';
  if (status === 'inactive') return 'inactive';
  // Sleeper returns "Invalid" for many active players (data-quality flag) - treat as active
  if (status === 'invalid' || injury === 'invalid') return 'active';
  return 'active'; // Active and other unknown values
}

function parseWeight(weight: string | number | null | undefined): number | null {
  if (weight == null) return null;
  const n = typeof weight === 'string' ? parseInt(weight, 10) : weight;
  return isNaN(n) ? null : n;
}

/**
 * Fetch all NFL players from Sleeper API.
 */
export async function fetchSleeperPlayers(): Promise<Record<string, SleeperPlayer>> {
  const response = await fetch(SLEEPER_PLAYERS_URL);
  if (!response.ok) {
    throw new Error(`Sleeper API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Map a Sleeper player to our database schema.
 */
export function mapSleeperPlayerToDb(
  sleeperId: string,
  player: SleeperPlayer
): MappedPlayer | null {
  const position = player.position;
  if (!position || !FANTASY_POSITIONS.has(position)) return null;

  // Skip players without team (except DEF and certain edge cases)
  const team = player.team || 'FA';
  if (team === 'FA' && position !== 'DEF') {
    // Include FAs for fantasy positions - they might get signed
    // Optional: filter to only rostered players by removing this block
  }

  const name =
    player.full_name ||
    [player.first_name, player.last_name].filter(Boolean).join(' ') ||
    `Player ${sleeperId}`;

  const status = mapStatus(player.status, player.injury_status);
  const headshotUrl = buildHeadshotUrl(player, sleeperId);

  return {
    id: crypto.randomUUID(),
    externalId: sleeperId,
    name: name.trim(),
    firstName: player.first_name || null,
    lastName: player.last_name || null,
    team,
    position,
    status,
    injuryNote: player.injury_notes || null,
    injuryBodyPart: player.injury_body_part || null,
    headshotUrl,
    age: player.age ?? null,
    height: player.height || null,
    weight: parseWeight(player.weight),
    college: player.college || null,
    yearsExp: player.years_exp ?? null,
    jerseyNumber: player.number ?? null,
    depthChartOrder: player.depth_chart_order ?? null,
  };
}

// ========================================
// Rate-limited fetch utilities
// ========================================

/** Sleep for the given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch multiple URLs concurrently with a concurrency limit.
 * Prevents overwhelming the Sleeper API (~1000 calls/min).
 * @param urls - Array of URLs to fetch
 * @param concurrency - Max concurrent requests (default: 5)
 * @param delayMs - Delay between batches in ms (default: 200)
 */
export async function throttledFetchAll<T>(
  urls: string[],
  concurrency = 5,
  delayMs = 200,
): Promise<(T | null)[]> {
  const results: (T | null)[] = new Array(urls.length).fill(null);

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(url =>
        fetch(url)
          .then(res => res.ok ? res.json() as Promise<T> : null)
          .catch(() => null)
      )
    );
    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = batchResults[j];
    }
    // Delay between batches (skip after last batch)
    if (i + concurrency < urls.length) {
      await sleep(delayMs);
    }
  }

  return results;
}

// ========================================
// Response validation
// ========================================

/** Validates that a Sleeper roster response entry has the expected shape. */
export function isValidSleeperRoster(obj: unknown): obj is {
  roster_id: number;
  owner_id: string;
  players: string[] | null;
  starters: string[] | null;
  settings: Record<string, number> | null;
} {
  if (typeof obj !== 'object' || obj === null) return false;
  const r = obj as Record<string, unknown>;
  return typeof r.roster_id === 'number' && typeof r.owner_id === 'string';
}

/** Validates that a Sleeper user response entry has the expected shape. */
export function isValidSleeperUser(obj: unknown): obj is {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar: string | null;
  metadata: Record<string, string> | null;
} {
  if (typeof obj !== 'object' || obj === null) return false;
  const u = obj as Record<string, unknown>;
  return typeof u.user_id === 'string';
}

/**
 * Validates that a Sleeper traded-pick response entry has the expected shape.
 * `roster_id` is the pick's ORIGINAL owner; `owner_id` is the CURRENT owner.
 */
export function isValidSleeperTradedPick(obj: unknown): obj is {
  season: string | number;
  round: number;
  roster_id: number;
  previous_owner_id?: number;
  owner_id: number;
} {
  if (typeof obj !== 'object' || obj === null) return false;
  const p = obj as Record<string, unknown>;
  return (
    (typeof p.season === 'string' || typeof p.season === 'number') &&
    typeof p.round === 'number' &&
    typeof p.roster_id === 'number' &&
    typeof p.owner_id === 'number'
  );
}

/** Validates that a Sleeper matchup response entry has the expected shape. */
export function isValidSleeperMatchup(obj: unknown): obj is {
  matchup_id: number | null;
  roster_id: number;
  points: number;
  projected_points?: number;
  starters: string[] | null;
  players: string[] | null;
} {
  if (typeof obj !== 'object' || obj === null) return false;
  const m = obj as Record<string, unknown>;
  return typeof m.roster_id === 'number';
}

/**
 * Validate and filter an array response from Sleeper API.
 * Logs warnings for invalid entries and returns only valid ones.
 */
export function validateSleeperArray<T>(
  data: unknown,
  validator: (item: unknown) => item is T,
  label: string,
): T[] {
  if (!Array.isArray(data)) {
    console.warn(`[sleeper] Expected array for ${label}, got ${typeof data}`);
    return [];
  }
  const valid: T[] = [];
  let invalidCount = 0;
  for (const item of data) {
    if (validator(item)) {
      valid.push(item);
    } else {
      invalidCount++;
    }
  }
  if (invalidCount > 0) {
    console.warn(`[sleeper] ${label}: skipped ${invalidCount} invalid entries out of ${data.length}`);
  }
  return valid;
}

/**
 * Get all fantasy-relevant players from Sleeper, including DEF entries.
 */
export async function getMappedPlayers(): Promise<MappedPlayer[]> {
  const raw = await fetchSleeperPlayers();
  const mapped: MappedPlayer[] = [];
  const seenDef = new Set<string>();

  for (const [sleeperId, player] of Object.entries(raw)) {
    if (!player) continue;

    const m = mapSleeperPlayerToDb(sleeperId, player as SleeperPlayer);
    if (m) {
      // Deduplicate DEF by team - Sleeper can return multiple entries per team
      if (m.position === 'DEF') {
        if (seenDef.has(m.team)) continue;
        seenDef.add(m.team);
      }
      mapped.push(m);
    }
  }

  // Add DEF entries for teams not in Sleeper response (team defenses)
  for (const team of NFL_TEAMS) {
    if (seenDef.has(team)) continue;
    mapped.push({
      id: crypto.randomUUID(),
      externalId: team,
      name: `${team} Defense`,
      firstName: null,
      lastName: null,
      team,
      position: 'DEF',
      status: 'active',
      injuryNote: null,
      injuryBodyPart: null,
      headshotUrl: null,
      age: null,
      height: null,
      weight: null,
      college: null,
      yearsExp: null,
      jerseyNumber: null,
      depthChartOrder: null,
    });
  }

  return mapped;
}

// ========================================
// Draft-pick inventory sync (dynasty/keeper)
// ========================================

export interface DraftPickSyncStats {
  /** Native pick rows seeded (upserted) this run. */
  seeded: number;
  /** Traded-pick overlay rows applied this run. */
  traded: number;
  /** Non-null when the sync was skipped entirely, with the reason. */
  skipped: string | null;
}

/** How many draft years (current + future) we track pick ownership for. */
const PICK_YEARS_TRACKED = 4;
/** Fallback when Sleeper doesn't report draft rounds in league settings. */
const DEFAULT_DRAFT_ROUNDS = 4;
/** Upsert chunk size: 9 columns/row keeps us under D1's ~100 bound params. */
const PICK_UPSERT_CHUNK = 10;

/**
 * Sync draft-pick ownership for a Sleeper dynasty/keeper league into
 * `team_draft_picks`.
 *
 * Strategy (idempotent, delete-nothing):
 *  1. Read league settings for draft rounds (default 4) + league type;
 *     redraft leagues are skipped so they never surface pick chips.
 *  2. Seed native ownership: every mapped team owns its own pick for the
 *     current season year + 3 future years x every round. The seed resets
 *     ownerId back to the original owner, so a pick whose trade was
 *     reversed on Sleeper reverts to native before the overlay re-applies.
 *  3. Overlay `/traded_picks`: each entry moves ownerId to the current
 *     owner's team and marks acquiredVia='trade', matched on
 *     (year, round, original owner roster_id) via the identity unique index.
 *
 * Roster mapping mirrors the league sync in routes/leagues.ts: Sleeper
 * roster_id -> roster.owner_id (Sleeper user_id) -> teams.externalOwnerId.
 */
export async function syncDraftPicks(
  db: DB,
  leagueId: string,
  externalLeagueId: string,
): Promise<DraftPickSyncStats> {
  const stats: DraftPickSyncStats = { seeded: 0, traded: 0, skipped: null };

  // 1. League metadata: type, draft rounds, season
  const leagueRes = await fetch(`${SLEEPER_API_BASE}/league/${externalLeagueId}`);
  if (!leagueRes.ok) {
    stats.skipped = `league metadata fetch failed (${leagueRes.status})`;
    return stats;
  }
  const sleeperLeague = (await leagueRes.json()) as {
    settings?: Record<string, number> | null;
    season?: string | number;
  } | null;
  const settings = (sleeperLeague && typeof sleeperLeague === 'object' ? sleeperLeague.settings : null) || {};

  // Sleeper settings.type: 0 redraft, 1 keeper, 2 dynasty. Future picks only
  // exist as tradeable assets in keeper/dynasty leagues.
  const sleeperType = Number(settings.type ?? 0);
  if (sleeperType !== 1 && sleeperType !== 2) {
    stats.skipped = 'redraft league — no future pick inventory';
    return stats;
  }

  const rawRounds = Number(settings.draft_rounds);
  const draftRounds =
    Number.isInteger(rawRounds) && rawRounds > 0 ? Math.min(rawRounds, 10) : DEFAULT_DRAFT_ROUNDS;
  const baseYear = Number(sleeperLeague?.season) || new Date().getFullYear();
  const maxYear = baseYear + PICK_YEARS_TRACKED - 1;

  // 2. Map Sleeper roster_id -> our team.id (roster.owner_id == teams.externalOwnerId)
  const rostersRes = await fetch(`${SLEEPER_API_BASE}/league/${externalLeagueId}/rosters`);
  if (!rostersRes.ok) {
    stats.skipped = `rosters fetch failed (${rostersRes.status})`;
    return stats;
  }
  const rosters = validateSleeperArray(
    await rostersRes.json(),
    isValidSleeperRoster,
    'draft-pick rosters',
  );
  if (rosters.length === 0) {
    stats.skipped = 'no valid rosters returned';
    return stats;
  }

  const teams = await db.query.teams.findMany({
    where: eq(schema.teams.leagueId, leagueId),
    columns: { id: true, externalOwnerId: true },
  });
  const teamByExternalOwner = new Map<string, string>();
  for (const t of teams) {
    if (t.externalOwnerId) teamByExternalOwner.set(t.externalOwnerId, t.id);
  }
  const rosterIdToTeamId = new Map<number, string>();
  for (const r of rosters) {
    const teamId = teamByExternalOwner.get(String(r.owner_id));
    if (teamId) rosterIdToTeamId.set(r.roster_id, teamId);
  }
  if (rosterIdToTeamId.size === 0) {
    stats.skipped = 'no rosters could be mapped to teams (run a league sync first)';
    return stats;
  }

  const now = new Date();
  const upsertChunked = async (rows: schema.NewTeamDraftPick[]) => {
    for (let i = 0; i < rows.length; i += PICK_UPSERT_CHUNK) {
      await db
        .insert(schema.teamDraftPicks)
        .values(rows.slice(i, i + PICK_UPSERT_CHUNK))
        .onConflictDoUpdate({
          target: [
            schema.teamDraftPicks.leagueId,
            schema.teamDraftPicks.draftYear,
            schema.teamDraftPicks.draftRound,
            schema.teamDraftPicks.originalOwnerId,
          ],
          set: {
            ownerId: sql`excluded.owner_id`,
            acquiredVia: sql`excluded.acquired_via`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }
  };

  // 3. Seed native ownership for every mapped team x year x round
  const mappedTeamIds = Array.from(new Set(rosterIdToTeamId.values()));
  const nativeRows: schema.NewTeamDraftPick[] = [];
  for (let year = baseYear; year <= maxYear; year++) {
    for (let round = 1; round <= draftRounds; round++) {
      for (const teamId of mappedTeamIds) {
        nativeRows.push({
          id: generateId(),
          leagueId,
          ownerId: teamId,
          originalOwnerId: teamId,
          draftYear: year,
          draftRound: round,
          acquiredVia: 'native',
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }
  await upsertChunked(nativeRows);
  stats.seeded = nativeRows.length;

  // 4. Overlay traded picks
  const tradedRes = await fetch(`${SLEEPER_API_BASE}/league/${externalLeagueId}/traded_picks`);
  if (!tradedRes.ok) {
    // Seed succeeded; report the overlay failure without throwing so the
    // caller's league sync isn't disrupted.
    console.warn(`[sleeper] traded_picks fetch failed (${tradedRes.status}) for league ${leagueId}`);
    return stats;
  }
  const tradedPicks = validateSleeperArray(
    await tradedRes.json(),
    isValidSleeperTradedPick,
    'traded picks',
  );

  // Dedupe by pick identity, keeping the LAST entry per pick so multi-hop
  // chains (A->B->C) collapse to the final owner.
  const overlayByIdentity = new Map<string, schema.NewTeamDraftPick>();
  for (const pick of tradedPicks) {
    const year = Number(pick.season);
    if (!Number.isInteger(year) || year < baseYear || year > maxYear) continue;
    if (!Number.isInteger(pick.round) || pick.round < 1 || pick.round > draftRounds) continue;
    const originalOwnerTeamId = rosterIdToTeamId.get(pick.roster_id);
    const currentOwnerTeamId = rosterIdToTeamId.get(pick.owner_id);
    if (!originalOwnerTeamId || !currentOwnerTeamId) continue;
    overlayByIdentity.set(`${year}-${pick.round}-${originalOwnerTeamId}`, {
      id: generateId(),
      leagueId,
      ownerId: currentOwnerTeamId,
      originalOwnerId: originalOwnerTeamId,
      draftYear: year,
      draftRound: pick.round,
      // A pick traded away and back reads as native again for display.
      acquiredVia: currentOwnerTeamId === originalOwnerTeamId ? 'native' : 'trade',
      createdAt: now,
      updatedAt: now,
    });
  }
  const overlayRows = Array.from(overlayByIdentity.values());
  await upsertChunked(overlayRows);
  stats.traded = overlayRows.length;

  return stats;
}

// ----------------------------------------------------------------
// In-memory cache for the Sleeper players blob (~5MB JSON).
// Persists across requests within a single Worker isolate. TTL 6h
// because the players list changes slowly (depth-chart updates,
// injuries, trades). Cuts sync wall-time by 1-3s on cache hits.
// For cross-isolate caching, move to KV / R2 — needs a binding the
// user provisions in Cloudflare, so left as an in-isolate cache.
// Shared by the user-triggered league sync route and the admin
// batch sync service (server/src/services/leagueSync.ts).
// ----------------------------------------------------------------
type SleeperPlayersBlob = Record<string, any>;
interface PlayerCacheEntry { data: SleeperPlayersBlob; fetchedAt: number; }
const PLAYER_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function getCachedSleeperPlayers(): SleeperPlayersBlob | null {
  const entry = (globalThis as any).__sleeperPlayerCache as PlayerCacheEntry | undefined;
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > PLAYER_CACHE_TTL_MS) return null;
  return entry.data;
}

function setCachedSleeperPlayers(data: SleeperPlayersBlob) {
  (globalThis as any).__sleeperPlayerCache = { data, fetchedAt: Date.now() } satisfies PlayerCacheEntry;
}

// Fetch the Sleeper players blob with caching. Returns {} on failure
// so callers can continue with degraded player matching.
export async function fetchSleeperPlayersCached(): Promise<SleeperPlayersBlob> {
  const cached = getCachedSleeperPlayers();
  if (cached) return cached;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    const res = await fetch('https://api.sleeper.app/v1/players/nfl', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json() as SleeperPlayersBlob;
      setCachedSleeperPlayers(data);
      return data;
    }
  } catch (e) {
    console.error('Failed to fetch Sleeper players blob:', e);
  }
  return {};
}
