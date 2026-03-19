// Matchup API services
import api from './api';
import type { Player } from './players';

// Types
export interface MatchupTeam {
  id: string;
  name: string;
  owner: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  record: string;
  score: number;
  projectedScore: number;
  starters: Array<{
    slot: string;
    player: Player;
    points: number;
    projectedPoints: number;
  }>;
  bench: Array<{
    slot: string;
    player: Player;
    points: number;
    projectedPoints: number;
  }>;
}

export interface MatchupDetails {
  id: string;
  week: number;
  isPlayoff: boolean;
  isChampionship: boolean;
  isComplete: boolean;
  league: {
    id: string;
    name: string;
    scoringFormat: string;
  };
  homeTeam: MatchupTeam;
  awayTeam: MatchupTeam;
}

export interface MatchupSummary {
  id: string;
  isPlayoff: boolean;
  isChampionship: boolean;
  isComplete: boolean;
  homeTeam: {
    id: string;
    name: string;
    owner: string;
    score: number;
    projectedScore: number;
  };
  awayTeam: {
    id: string;
    name: string;
    owner: string;
    score: number;
    projectedScore: number;
  };
}

export interface LiveScoring {
  matchupId: string;
  homeScore: number;
  awayScore: number;
  homeProjectedScore: number;
  awayProjectedScore: number;
  isComplete: boolean;
  lastUpdated: string;
}

export interface CurrentMatchup {
  matchupId: string;
  week: number;
  myTeam: {
    id: string;
    name: string;
    score: number;
  };
  opponent: {
    id: string;
    name: string;
    owner: string;
    score: number;
  };
  isComplete: boolean;
}

// Matchup API functions
export const matchupService = {
  // Get matchup details
  getMatchup: async (matchupId: string): Promise<{ matchup: MatchupDetails }> => {
    return api.get<{ matchup: MatchupDetails }>(`/matchups/${matchupId}`);
  },

  // Get live scoring for a matchup
  getLiveScoring: async (matchupId: string): Promise<LiveScoring> => {
    return api.get<LiveScoring>(`/matchups/${matchupId}/live`);
  },

  // Get all matchups for a league week
  getWeekMatchups: async (
    leagueId: string,
    week: number
  ): Promise<{ week: number; matchups: MatchupSummary[] }> => {
    return api.get<{ week: number; matchups: MatchupSummary[] }>(
      `/matchups/league/${leagueId}/week/${week}`
    );
  },

  // Get user's current matchup
  getCurrentMatchup: async (leagueId: string): Promise<CurrentMatchup> => {
    return api.get<CurrentMatchup>(`/matchups/my/current?leagueId=${leagueId}`);
  },
};

export default matchupService;
