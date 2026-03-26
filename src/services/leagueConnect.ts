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

// Sleeper API - Public API, no auth needed
export const sleeperApi = {
  // Get user by username
  getUser: async (username: string): Promise<{ user_id: string; username: string; display_name: string } | null> => {
    try {
      const response = await fetch(`https://api.sleeper.app/v1/user/${username}`);
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  },

  // Get leagues for a user (fetches last 3 seasons in parallel)
  getUserLeagues: async (userId: string): Promise<ExternalLeague[]> => {
    const currentYear = new Date().getFullYear();
    const seasons = [currentYear, currentYear - 1, currentYear - 2];
    const allLeagues: ExternalLeague[] = [];
    const seen = new Set<string>();

    // Fetch all seasons in parallel
    const results = await Promise.all(
      seasons.map(season =>
        fetch(`https://api.sleeper.app/v1/user/${userId}/leagues/nfl/${season}`)
          .then(res => res.ok ? res.json() : [])
          .catch(() => [])
      )
    );

    for (const leagues of results) {
      for (const league of leagues) {
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
    try {
      const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
      if (!response.ok) return null;
      const league = await response.json();

      return {
        externalId: league.league_id,
        platform: 'sleeper',
        name: league.name,
        seasonYear: parseInt(league.season),
        teamCount: league.total_rosters,
        scoringFormat: league.scoring_settings?.rec === 1 ? 'ppr' :
                       league.scoring_settings?.rec === 0.5 ? 'half_ppr' : 'standard',
      };
    } catch {
      return null;
    }
  },

  // Get rosters for a league
  getRosters: async (leagueId: string): Promise<SleeperRoster[]> => {
    try {
      const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
      if (!response.ok) return [];
      return response.json();
    } catch {
      return [];
    }
  },

  // Get users in a league
  getLeagueUsers: async (leagueId: string): Promise<SleeperLeagueUser[]> => {
    try {
      const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
      if (!response.ok) return [];
      return response.json();
    } catch {
      return [];
    }
  },
};

// ESPN API - Requires league to be public or SWID/ESPN_S2 cookies
export const espnApi = {
  // Get league by ID (public leagues only for now)
  getLeague: async (leagueId: string, season: number = new Date().getFullYear()): Promise<ExternalLeague | null> => {
    try {
      // ESPN's public API endpoint
      const response = await fetch(
        `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?view=mSettings`
      );
      if (!response.ok) return null;
      const data = await response.json();

      const settings = data.settings;
      const scoringSettings = settings?.scoringSettings;

      // Determine scoring format based on PPR value
      let scoringFormat = 'standard';
      if (scoringSettings?.scoringItems) {
        const recItem = scoringSettings.scoringItems.find((item: { statId: number; points: number }) => item.statId === 53); // Reception stat
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
    } catch {
      return null;
    }
  },
};

// MFL API - Public API, no auth needed (league ID + year)
export const mflApi = {
  // Get league by ID and year
  getLeague: async (leagueId: string, season: number = new Date().getFullYear()): Promise<ExternalLeague | null> => {
    try {
      const response = await fetch(
        `https://api.myfantasyleague.com/${season}/export?TYPE=league&L=${encodeURIComponent(leagueId)}&JSON=1`
      );
      if (!response.ok) return null;
      const data = await response.json();

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
        scoringFormat: 'ppr', // MFL scoring varies; default to PPR, user can adjust
      };
    } catch {
      return null;
    }
  },
};

// Yahoo API - Requires OAuth (handled by backend)
export const yahooApi = {
  // Get Yahoo OAuth authorization URL from backend
  getAuthUrl: async (): Promise<string> => {
    const res = await api.post<{ url: string }>('/yahoo/auth-url');
    return res.url;
  },

  // Get user's Yahoo Fantasy leagues from backend
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
      externalId: l.leagueKey, // Use full league_key as externalId for Yahoo
      platform: 'yahoo' as Platform,
      name: l.name,
      seasonYear: l.seasonYear,
      teamCount: l.teamCount,
      scoringFormat: l.scoringFormat,
    }));
  },

  // Disconnect Yahoo account
  disconnect: async (): Promise<void> => {
    await api.post('/yahoo/disconnect');
  },
};

// Main league connection service
export const leagueConnectService = {
  // Connect a league to FilmRoom
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
      sleeperUserId, // Sleeper user_id for reliable team matching during sync
    });
  },

  // Sync league data from external platform
  syncLeague: async (leagueId: string): Promise<{ success: boolean; message: string }> => {
    return api.post<{ success: boolean; message: string }>(`/leagues/${leagueId}/sync`);
  },

  // Disconnect a league
  disconnectLeague: async (leagueId: string): Promise<{ success: boolean }> => {
    return api.delete<{ success: boolean }>(`/leagues/${leagueId}`);
  },

  // Fetch league from platform by ID
  fetchExternalLeague: async (platform: Platform, leagueId: string): Promise<ExternalLeague | null> => {
    switch (platform) {
      case 'sleeper':
        return sleeperApi.getLeague(leagueId);
      case 'espn':
        return espnApi.getLeague(leagueId);
      case 'mfl':
        return mflApi.getLeague(leagueId);
      case 'yahoo':
        return null; // Yahoo leagues are fetched through OAuth flow, not by ID
      default:
        return null;
    }
  },

  // Fetch user's leagues from Sleeper
  fetchSleeperUserLeagues: async (username: string): Promise<ExternalLeague[]> => {
    const user = await sleeperApi.getUser(username);
    if (!user) return [];
    return sleeperApi.getUserLeagues(user.user_id);
  },
};

export default leagueConnectService;
