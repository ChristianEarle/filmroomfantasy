/**
 * Sleeper API integration for fetching NFL player data.
 * API docs: https://docs.sleeper.com/
 * Rate limit: ~1000 calls/minute. Players endpoint should be called at most once per day.
 */

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
