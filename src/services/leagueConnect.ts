// League Connection Service - Connects to external fantasy platforms.
//
// All upstream platform reads (Sleeper, ESPN, MFL) go through our own
// backend proxy now. The browser only ever talks to our origin, which
// removes a whole class of failures: CORS policy changes, ad-blocker
// false positives, browser extensions, mixed-content blocks, etc.
// See server/src/routes/platformProxy.ts for the proxy endpoints.

import api, { ApiError } from './api';

export type Platform = 'sleeper' | 'espn' | 'yahoo' | 'mfl';

export interface ExternalLeague {
  externalId: string;
  platform: Platform;
  name: string;
  seasonYear: number;
  teamCount: number;
  scoringFormat: string;
  userTeamId?: string;
  userTeamName?: string;
}

export interface ConnectLeagueResponse {
  league: {
    id: string;
    name: string;
    platform: Platform;
    externalId: string;
    scoringFormat: string;
    teamCount: number;
    seasonYear: number;
  };
  team: {
    id: string;
    name: string;
  };
}

// Sleeper API response types
export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  league_id: string;
  starters: string[];
  players: string[];
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fpts_decimal?: number;
    fpts_against?: number;
    fpts_against_decimal?: number;
    waiver_position?: number;
    waiver_budget_used?: number;
    [key: string]: number | undefined;
  };
  metadata?: Record<string, string>;
}

export interface SleeperLeagueUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
  metadata?: Record<string, string>;
  is_owner?: boolean;
}

// Typed errors so the UI can show meaningful messages instead of collapsing
// every failure into "user not found".
export type PlatformErrorKind =
  | 'not_found'        // 404 - the entity doesn't exist
  | 'rate_limited'     // 429 - back off and retry later
  | 'unavailable'      // 5xx - upstream platform is down
  | 'timeout'          // AbortError - the request took too long
  | 'network'          // TypeError "Failed to fetch" - no network
  | 'unknown';         // anything else

export class PlatformError extends Error {
  constructor(
    public kind: PlatformErrorKind,
    public platform: Platform,
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'PlatformError';
  }
}

// Call a backend proxy endpoint and translate ApiError into PlatformError
// so the UI's existing error-routing logic keeps working unchanged.
async function proxyGet<T>(path: string, platform: Platform): Promise<T | null> {
  try {
    return await api.get<T>(path);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) return null;
      if (err.status === 504) {
        throw new PlatformError('timeout', platform, `Timed out reaching ${platform}. Please try again.`, 504);
      }
      if (err.status === 502 || err.status === 503) {
        throw new PlatformError('unavailable', platform, `${platform} is currently unavailable. Please try again shortly.`, err.status);
      }
      if (err.status === 429) {
        throw new PlatformError('rate_limited', platform, `Too many requests — please wait a minute and try again.`, 429);
      }
      if (err.status === 403) {
        // ESPN private-league signal — bubble the upstream message through.
        throw new PlatformError('unknown', platform, err.message || `Access denied by ${platform}`, 403);
      }
      throw new PlatformError('unknown', platform, err.message || `Failed to reach ${platform}`, err.status);
    }
    // ApiError(0, ...) covers "backend unreachable" — surface as a network problem
    // pointing at our own server rather than the platform.
    if (err instanceof Error) {
      throw new PlatformError('network', platform, `Couldn't reach our server: ${err.message}`);
    }
    throw new PlatformError('unknown', platform, 'Unknown error');
  }
}

// Raw Sleeper response types (returned as-is by our backend proxy)
interface SleeperUserRaw { user_id: string; username: string; display_name: string }
interface SleeperLeagueRaw {
  league_id: string;
  name: string;
  season: string;
  total_rosters: number;
  scoring_settings?: { rec?: number };
}

function mapSleeperLeague(league: SleeperLeagueRaw): ExternalLeague {
  return {
    externalId: league.league_id,
    platform: 'sleeper',
    name: league.name,
    seasonYear: parseInt(league.season),
    teamCount: league.total_rosters,
    scoringFormat: league.scoring_settings?.rec === 1 ? 'ppr' :
                   league.scoring_settings?.rec === 0.5 ? 'half_ppr' : 'standard',
  };
}

// Sleeper API — all calls route through /api/sleeper/* (see platformProxy.ts).
// Browsers never hit api.sleeper.app directly; that path was killed off because
// every CORS or ad-blocker hiccup surfaced as "Failed to fetch" with no recovery.
export const sleeperApi = {
  getUser: async (username: string): Promise<SleeperUserRaw | null> => {
    return proxyGet<SleeperUserRaw>(`/sleeper/user/${encodeURIComponent(username)}`, 'sleeper');
  },

  getUserLeagues: async (userId: string): Promise<ExternalLeague[]> => {
    const result = await proxyGet<SleeperLeagueRaw[]>(`/sleeper/user/${encodeURIComponent(userId)}/leagues`, 'sleeper');
    if (!result) return [];
    return result.map(mapSleeperLeague);
  },

  getLeague: async (leagueId: string): Promise<ExternalLeague | null> => {
    const league = await proxyGet<SleeperLeagueRaw>(`/sleeper/league/${encodeURIComponent(leagueId)}`, 'sleeper');
    if (!league) return null;
    return mapSleeperLeague(league);
  },

  // The roster/users endpoints below are kept for the (currently unused)
  // direct-from-browser code path but would also benefit from proxying if
  // anything starts calling them. The backend sync path uses Sleeper directly
  // (no CORS exposure there), so adding proxy routes for them isn't urgent.
  getRosters: async (_leagueId: string): Promise<SleeperRoster[]> => {
    console.warn('[sleeperApi.getRosters] not yet proxied; not callable from browser');
    return [];
  },
  getLeagueUsers: async (_leagueId: string): Promise<SleeperLeagueUser[]> => {
    console.warn('[sleeperApi.getLeagueUsers] not yet proxied; not callable from browser');
    return [];
  },
};

// ESPN API — public leagues via /api/espn/league/:id. Private leagues
// (requiring SWID/ESPN_S2 cookies) surface as a 403 from the proxy, which
// proxyGet() maps to PlatformError('unknown', 'espn', ..., 403).
export const espnApi = {
  getLeague: async (leagueId: string, season: number = new Date().getFullYear()): Promise<ExternalLeague | null> => {
    interface EspnLeagueRaw {
      settings?: {
        name?: string;
        size?: number;
        scoringSettings?: { scoringItems?: Array<{ statId: number; points: number }> };
      };
    }
    const data = await proxyGet<EspnLeagueRaw>(`/espn/league/${encodeURIComponent(leagueId)}?year=${season}`, 'espn');
    if (!data) return null;
    const settings = data.settings;
    const scoringItems = settings?.scoringSettings?.scoringItems;

    let scoringFormat = 'standard';
    if (scoringItems) {
      // statId 53 = reception stat → points-per-reception determines format
      const recItem = scoringItems.find((item) => item.statId === 53);
      if (recItem) {
        if (recItem.points === 1) scoringFormat = 'ppr';
        else if (recItem.points === 0.5) scoringFormat = 'half_ppr';
      }
    }

    return {
      externalId: leagueId,
      platform: 'espn',
      name: settings?.name || `ESPN League ${leagueId}`,
      seasonYear: season,
      teamCount: settings?.size || 10,
      scoringFormat,
    };
  },
};

// MFL API — public read via /api/mfl/league/:id.
export const mflApi = {
  getLeague: async (leagueId: string, season: number = new Date().getFullYear()): Promise<ExternalLeague | null> => {
    interface MflLeagueResponse {
      league?: {
        name?: string;
        franchises?: { franchise?: Array<unknown> | unknown };
      };
    }
    const data = await proxyGet<MflLeagueResponse>(`/mfl/league/${encodeURIComponent(leagueId)}?year=${season}`, 'mfl');
    if (!data) return null;
    const league = data.league;
    if (!league) return null;

    const franchises = Array.isArray(league.franchises?.franchise)
      ? league.franchises!.franchise
      : league.franchises?.franchise ? [league.franchises.franchise] : [];

    return {
      externalId: leagueId,
      platform: 'mfl',
      name: league.name || `MFL League ${leagueId}`,
      seasonYear: season,
      teamCount: franchises.length || 12,
      scoringFormat: 'ppr',
    };
  },
};

// Yahoo API - Requires OAuth (handled by backend)
export const yahooApi = {
  getAuthUrl: async (): Promise<string> => {
    const res = await api.post<{ url: string }>('/yahoo/auth-url');
    return res.url;
  },

  getLeagues: async (): Promise<ExternalLeague[]> => {
    const res = await api.get<{ leagues: Array<{
      externalId: string;
      leagueKey: string;
      name: string;
      seasonYear: number;
      teamCount: number;
      scoringFormat: string;
      currentWeek: number;
    }> }>('/yahoo/leagues');

    return res.leagues.map(l => ({
      externalId: l.leagueKey,
      platform: 'yahoo' as Platform,
      name: l.name,
      seasonYear: l.seasonYear,
      teamCount: l.teamCount,
      scoringFormat: l.scoringFormat,
    }));
  },

  disconnect: async (): Promise<void> => {
    await api.post('/yahoo/disconnect');
  },
};

export const leagueConnectService = {
  connectLeague: async (
    platform: Platform,
    externalId: string,
    leagueData: ExternalLeague,
    sleeperUsername?: string,
    sleeperUserId?: string
  ): Promise<ConnectLeagueResponse> => {
    return api.post<ConnectLeagueResponse>('/leagues/connect', {
      platform,
      externalId,
      name: leagueData.name,
      scoringFormat: leagueData.scoringFormat,
      teamCount: leagueData.teamCount,
      seasonYear: leagueData.seasonYear,
      sleeperUsername,
      sleeperUserId,
    });
  },

  // Quick post-connect sync: rosters/teams/current-week only. Stays well under
  // the Workers wall-time limit so the first sync after connect almost always
  // succeeds. Heavy work (stats, projections, full schedule) runs via
  // syncLeagueFull() — typically triggered by the manual "Sync" button.
  syncLeagueQuick: async (leagueId: string): Promise<{
    success: boolean;
    message: string;
    userTeamMatched?: boolean;
    warning?: string | null;
  }> => {
    return api.post(`/leagues/${leagueId}/sync/quick`);
  },

  syncLeague: async (leagueId: string): Promise<{
    success: boolean;
    message: string;
    userTeamMatched?: boolean;
    warning?: string | null;
  }> => {
    return api.post(`/leagues/${leagueId}/sync`);
  },

  disconnectLeague: async (leagueId: string): Promise<{ success: boolean }> => {
    return api.delete<{ success: boolean }>(`/leagues/${leagueId}`);
  },

  // Yahoo doesn't support manual league-ID entry — its leagues are discovered
  // through the OAuth flow because the API requires an authenticated user.
  fetchExternalLeague: async (
    platform: Platform,
    leagueId: string,
    season?: number
  ): Promise<ExternalLeague | null> => {
    switch (platform) {
      case 'sleeper':
        return sleeperApi.getLeague(leagueId);
      case 'espn':
        return espnApi.getLeague(leagueId, season);
      case 'mfl':
        return mflApi.getLeague(leagueId, season);
      case 'yahoo':
        return null;
      default:
        return null;
    }
  },

  fetchSleeperUserLeagues: async (username: string): Promise<ExternalLeague[]> => {
    const user = await sleeperApi.getUser(username);
    if (!user) return [];
    return sleeperApi.getUserLeagues(user.user_id);
  },
};

export default leagueConnectService;
