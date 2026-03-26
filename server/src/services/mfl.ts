/**
 * MyFantasyLeague (MFL) API integration.
 * API docs: https://api.myfantasyleague.com/
 *
 * MFL's export API is publicly accessible for most league data.
 * No OAuth required - just the league ID and season year.
 * Responses are JSON when &JSON=1 is appended.
 */

const MFL_BASE = 'https://api.myfantasyleague.com';

// ========================================
// Response types
// ========================================

export interface MflLeagueResponse {
  league: {
    id: string;
    name: string;
    rosterSize?: string;
    injuredReserve?: string;
    startCount?: string;
    nflPoolType?: string;
    rostersPerPlayer?: string;
    starters?: {
      position: { name: string; limit: string }[];
    };
    franchises?: {
      franchise: MflFranchise[];
    };
    history?: {
      league?: { year: string; url: string }[];
    };
  };
}

export interface MflFranchise {
  id: string;
  name: string;
  owner_name?: string;
  abbrev?: string;
  waiverSortOrder?: string;
  bbidAvailableBalance?: string;
}

export interface MflRostersResponse {
  rosters: {
    franchise: {
      id: string;
      player?: MflRosterPlayer[];
    }[];
  };
}

export interface MflRosterPlayer {
  id: string;
  status: string; // 'ROSTER', 'INJURED_RESERVE', 'TAXI_SQUAD', etc.
}

export interface MflPlayersResponse {
  players: {
    player: MflPlayer[];
  };
}

export interface MflPlayer {
  id: string;
  name: string; // "LastName, FirstName"
  position: string;
  team: string;
  status?: string;
  jersey?: string;
  weight?: string;
  height?: string;
  college?: string;
  age?: string;
  draft_year?: string;
  birthdate?: string;
}

export interface MflScheduleResponse {
  schedule: {
    weeklySchedule: MflWeekSchedule[] | MflWeekSchedule;
  };
}

export interface MflWeekSchedule {
  week: string;
  matchup: MflMatchup[] | MflMatchup;
}

export interface MflMatchup {
  franchise: { id: string; score?: string; result?: string; isHome?: string }[];
}

export interface MflPlayerScoresResponse {
  playerScores: {
    week: string;
    playerScore?: MflPlayerScore[] | MflPlayerScore;
  };
}

export interface MflPlayerScore {
  id: string;
  score: string;
  isAvailable?: string;
}

export interface MflLiveScoringResponse {
  liveScoring: {
    week: string;
    matchup: MflLiveMatchup[] | MflLiveMatchup;
  };
}

export interface MflLiveMatchup {
  franchise: {
    id: string;
    score: string;
    gameSecondsRemaining?: string;
    playersCurrentlyPlaying?: string;
    playersYetToPlay?: string;
    isHome?: string;
    player?: MflLivePlayer[] | MflLivePlayer;
  }[];
}

export interface MflLivePlayer {
  id: string;
  score: string;
  gameSecondsRemaining?: string;
  status?: string;
}

// ========================================
// API fetch helpers
// ========================================

function buildUrl(year: number, type: string, params: Record<string, string> = {}): string {
  const url = new URL(`${MFL_BASE}/${year}/export`);
  url.searchParams.set('TYPE', type);
  url.searchParams.set('JSON', '1');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function mflFetch<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'FilmRoomFantasy/1.0',
    },
  });
  if (!response.ok) {
    throw new Error(`MFL API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

// ========================================
// Public API functions
// ========================================

/** Fetch league settings and franchise list. */
export async function fetchLeague(leagueId: string, year: number): Promise<MflLeagueResponse> {
  return mflFetch<MflLeagueResponse>(buildUrl(year, 'league', { L: leagueId }));
}

/** Fetch all rosters for a league. */
export async function fetchRosters(leagueId: string, year: number): Promise<MflRostersResponse> {
  return mflFetch<MflRostersResponse>(buildUrl(year, 'rosters', { L: leagueId }));
}

/** Fetch the full schedule (all weeks). */
export async function fetchSchedule(leagueId: string, year: number): Promise<MflScheduleResponse> {
  return mflFetch<MflScheduleResponse>(buildUrl(year, 'schedule', { L: leagueId }));
}

/** Fetch player scores for a specific week. */
export async function fetchPlayerScores(leagueId: string, year: number, week: number): Promise<MflPlayerScoresResponse> {
  return mflFetch<MflPlayerScoresResponse>(buildUrl(year, 'playerScores', { L: leagueId, W: String(week) }));
}

/** Fetch live scoring for the current week. */
export async function fetchLiveScoring(leagueId: string, year: number): Promise<MflLiveScoringResponse> {
  return mflFetch<MflLiveScoringResponse>(buildUrl(year, 'liveScoring', { L: leagueId }));
}

/** Fetch all MFL players (large dataset). */
export async function fetchPlayers(year: number): Promise<MflPlayersResponse> {
  return mflFetch<MflPlayersResponse>(buildUrl(year, 'players', { DETAILS: '1' }));
}

// ========================================
// Data mapping utilities
// ========================================

/** MFL returns names as "LastName, FirstName" - parse into parts. */
export function parseMflName(mflName: string): { firstName: string; lastName: string; fullName: string } {
  const parts = mflName.split(', ');
  if (parts.length === 2) {
    return {
      firstName: parts[1].trim(),
      lastName: parts[0].trim(),
      fullName: `${parts[1].trim()} ${parts[0].trim()}`,
    };
  }
  // Team defenses or other formats (e.g., "Bears, Chicago" or "Chiefs D/ST")
  return { firstName: '', lastName: mflName, fullName: mflName };
}

/** Map MFL position codes to canonical positions. */
export function mapMflPosition(mflPosition: string): string | null {
  const posMap: Record<string, string> = {
    QB: 'QB',
    RB: 'RB',
    WR: 'WR',
    TE: 'TE',
    PK: 'K',
    K: 'K',
    Def: 'DEF',
    DEF: 'DEF',
    DT: null as unknown as string,
    DE: null as unknown as string,
    LB: null as unknown as string,
    CB: null as unknown as string,
    S: null as unknown as string,
  };
  return posMap[mflPosition] ?? null;
}

/** Map MFL team abbreviations to standard NFL team codes. */
export function mapMflTeam(mflTeam: string): string {
  const teamMap: Record<string, string> = {
    ARI: 'ARI',
    ATL: 'ATL',
    BAL: 'BAL',
    BUF: 'BUF',
    CAR: 'CAR',
    CHI: 'CHI',
    CIN: 'CIN',
    CLE: 'CLE',
    DAL: 'DAL',
    DEN: 'DEN',
    DET: 'DET',
    GBP: 'GB',
    GB: 'GB',
    HOU: 'HOU',
    IND: 'IND',
    JAC: 'JAX',
    JAX: 'JAX',
    KCC: 'KC',
    KC: 'KC',
    LAC: 'LAC',
    LAR: 'LAR',
    LVR: 'LV',
    LV: 'LV',
    MIA: 'MIA',
    MIN: 'MIN',
    NEP: 'NE',
    NE: 'NE',
    NOS: 'NO',
    NO: 'NO',
    NYG: 'NYG',
    NYJ: 'NYJ',
    PHI: 'PHI',
    PIT: 'PIT',
    SEA: 'SEA',
    SFO: 'SF',
    SF: 'SF',
    TBB: 'TB',
    TB: 'TB',
    TEN: 'TEN',
    WAS: 'WAS',
    FA: 'FA',
  };
  return teamMap[mflTeam] || mflTeam;
}

/** Normalize an array from MFL - MFL returns a single object instead of array when there's only one item. */
export function ensureArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}
