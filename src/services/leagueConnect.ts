// League Connection Service - Connects to external fantasy platforms
import api from './api';

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

// Wrap a fetch call so failures land in PlatformError with a stable `kind`
// the UI can branch on. 404s become `not_found` (caller sees null);
// other non-OK responses + network errors throw with a meaningful kind.
async function platformFetch(
  url: string,
  platform: Platform,
  timeoutMs = 10_000,
  init?: RequestInit
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (res.status === 404) return null;
    if (res.status === 429) {
      throw new PlatformError('rate_limited', platform, `${platform} is rate-limiting requests. Please wait a minute and try again.`, 429);
    }
    if (res.status >= 500) {
      throw new PlatformError('unavailable', platform, `${platform} is currently unavailable (HTTP ${res.status}). Please try again shortly.`, res.status);
    }
    if (!res.ok) {
      throw new PlatformError('unknown', platform, `${platform} returned HTTP ${res.status}`, res.status);
    }
    return res;
  } catch (err) {
    if (err instanceof PlatformError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new PlatformError('timeout', platform, `Timed out reaching ${platform}. Please try again.`);
    }
    const msg = err instanceof Error ? err.message : 'Network error';
    throw new PlatformError('network', platform, `Couldn't reach ${platform}: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
}

// Sleeper API - Public API, no auth needed
export const sleeperApi = {
  // Get user by username. Returns null for 404, throws PlatformError otherwise
  // so the UI can distinguish "username doesn't exist" from "Sleeper is down".
  getUser: async (username: string): Promise<{ user_id: string; username: string; display_name: string } | null> => {
    const res = await platformFetch(`https://api.sleeper.app/v1/user/${encodeURIComponent(username)}`, 'sleeper');
    if (!res) return null;
    return res.json();
  },

  // Get leagues for a user (fetches last 3 seasons in parallel).
  // If every season fails the request throws (so the UI doesn't silently
  // show "no leagues found" when Sleeper is actually down).
  getUserLeagues: async (userId: string): Promise<ExternalLeague[]> => {
    const currentYear = new Date().getFullYear();
    const seasons = [currentYear, currentYear - 1, currentYear - 2];
    const allLeagues: ExternalLeague[] = [];
    const seen = new Set<string>();

    const results = await Promise.allSettled(
      seasons.map(season =>
        platformFetch(`https://api.sleeper.app/v1/user/${userId}/leagues/nfl/${season}`, 'sleeper')
          .then(res => res ? res.json() as Promise<any[]> : [])
      )
    );

    const allRejected = results.every(r => r.status === 'rejected');
    if (allRejected) {
      const firstErr = results[0] as PromiseRejectedResult;
      if (firstErr.reason instanceof PlatformError) throw firstErr.reason;
      throw new PlatformError('unknown', 'sleeper', 'Failed to fetch Sleeper leagues');
    }

    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      for (const league of r.value) {
        const id = league.league_id;
        if (seen.has(id)) continue;
        seen.add(id);
        allLeagues.push({
          externalId: id,
          platform: 'sleeper' as Platform,
          name: league.name,
          seasonYear: parseInt(league.season),
          teamCount: league.total_rosters,
          scoringFormat: league.scoring_settings?.rec === 1 ? 'ppr' :
                         league.scoring_settings?.rec === 0.5 ? 'half_ppr' : 'standard',
        });
      }
    }
    return allLeagues;
  },

  // Get league details
  getLeague: async (leagueId: string): Promise<ExternalLeague | null> => {
    const res = await platformFetch(`https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}`, 'sleeper');
    if (!res) return null;
    const league = await res.json();
    return {
      externalId: league.league_id,
      platform: 'sleeper',
      name: league.name,
      seasonYear: parseInt(league.season),
      teamCount: league.total_rosters,
      scoringFormat: league.scoring_settings?.rec === 1 ? 'ppr' :
                     league.scoring_settings?.rec === 0.5 ? 'half_ppr' : 'standard',
    };
  },

  // Get rosters for a league
  getRosters: async (leagueId: string): Promise<SleeperRoster[]> => {
    const res = await platformFetch(`https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}/rosters`, 'sleeper');
    if (!res) return [];
    return res.json();
  },

  // Get users in a league
  getLeagueUsers: async (leagueId: string): Promise<SleeperLeagueUser[]> => {
    const res = await platformFetch(`https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}/users`, 'sleeper');
    if (!res) return [];
    return res.json();
  },
};

// ESPN API - public leagues only (private leagues require SWID/ESPN_S2 cookies — TODO)
export const espnApi = {
  getLeague: async (leagueId: string, season: number = new Date().getFullYear()): Promise<ExternalLeague | null> => {
    const res = await platformFetch(
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${encodeURIComponent(leagueId)}?view=mSettings`,
      'espn'
    );
    if (!res) return null;
    const data = await res.json();
    const settings = data.settings;
    const scoringSettings = settings?.scoringSettings;

    let scoringFormat = 'standard';
    if (scoringSettings?.scoringItems) {
      // statId 53 is the reception stat — points per reception determines PPR/Half/Std
      const recItem = scoringSettings.scoringItems.find((item: { statId: number; points: number }) => item.statId === 53);
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

// MFL API - Public API (league ID + year)
export const mflApi = {
  getLeague: async (leagueId: string, season: number = new Date().getFullYear()): Promise<ExternalLeague | null> => {
    const res = await platformFetch(
      `https://api.myfantasyleague.com/${season}/export?TYPE=league&L=${encodeURIComponent(leagueId)}&JSON=1`,
      'mfl'
    );
    if (!res) return null;
    const data = await res.json();
    const league = data?.league;
    if (!league) return null;

    const franchises = Array.isArray(league.franchises?.franchise)
      ? league.franchises.franchise
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
