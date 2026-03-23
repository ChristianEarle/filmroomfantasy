// League API services
import api from './api';
import type { User } from './auth';

// Types
export interface League {
  id: string;
  name: string;
  platform?: string;
  scoringFormat: string;
  teamCount: number;
  currentWeek: number;
  seasonYear: number;
  playoffWeeks: number;
  playoffTeams: number;
  waiverType: string;
  waiverBudget?: number;
  role?: string;
  teams?: Team[];
  updatedAt?: string;
}

export interface Team {
  id: string;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  streak?: string;
  playoffSeed?: number;
  waiverPriority?: number;
  faabBudget?: number;
  owner: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
}

export interface Standing extends Team {
  rank: number;
  winPct: number;
}

export interface LeagueDetails extends League {
  teams: Team[];
  members: Array<{
    user: User;
    role: string;
    joinedAt: string;
  }>;
}

// League API functions
export const leagueService = {
  // Get user's leagues
  getLeagues: async (): Promise<{ leagues: League[] }> => {
    return api.get<{ leagues: League[] }>('/leagues');
  },

  // Create a new league
  createLeague: async (data: {
    name: string;
    scoringFormat?: string;
    teamCount?: number;
    seasonYear?: number;
    playoffWeeks?: number;
    playoffTeams?: number;
    waiverType?: string;
    waiverBudget?: number;
  }): Promise<{ league: League; teamId: string }> => {
    return api.post<{ league: League; teamId: string }>('/leagues', data);
  },

  // Get league details
  getLeague: async (leagueId: string): Promise<{ league: LeagueDetails }> => {
    return api.get<{ league: LeagueDetails }>(`/leagues/${leagueId}`);
  },

  // Update league settings
  updateLeague: async (
    leagueId: string,
    data: Partial<League>
  ): Promise<{ league: League }> => {
    return api.put<{ league: League }>(`/leagues/${leagueId}`, data);
  },

  // Join a league
  joinLeague: async (
    leagueId: string,
    teamName?: string
  ): Promise<{ message: string; teamId: string }> => {
    return api.post<{ message: string; teamId: string }>(`/leagues/${leagueId}/join`, {
      teamName,
    });
  },

  // Get league standings
  getStandings: async (leagueId: string): Promise<{ standings: Standing[] }> => {
    return api.get<{ standings: Standing[] }>(`/leagues/${leagueId}/standings`);
  },
};

export default leagueService;
