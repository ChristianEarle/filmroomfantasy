// Player API services
import api from './api';

// Types
export interface Player {
  id: string;
  externalId?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  team: string;
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
  jerseyNumber?: number;
  byeWeek?: number;
  status: 'active' | 'injured_reserve' | 'out' | 'questionable' | 'doubtful';
  injuryNote?: string;
  injuryBodyPart?: string;
  headshotUrl?: string;
  age?: number;
  yearsExp?: number;
}

export interface PlayerWeeklyStats {
  id: string;
  playerId: string;
  week: number;
  seasonYear: number;
  opponent?: string;
  gameResult?: string;
  passYards?: number;
  passTDs?: number;
  passInterceptions?: number;
  passCompletions?: number;
  passAttempts?: number;
  rushYards?: number;
  rushTDs?: number;
  rushAttempts?: number;
  receptions?: number;
  receivingYards?: number;
  receivingTDs?: number;
  targets?: number;
  targetShare?: number;
  fgMade?: number;
  fgAttempts?: number;
  xpMade?: number;
  xpAttempts?: number;
  offSnaps?: number;
  defSnaps?: number;
  stSnaps?: number;
  snapPct?: number;
  sacks?: number;
  defInterceptions?: number;
  fumblesRecovered?: number;
  defenseTDs?: number;
  pointsAllowed?: number;
  fantasyPointsPPR?: number;
  fantasyPointsHalf?: number;
  fantasyPointsStd?: number;
}

export interface PlayerProjection {
  id: string;
  playerId: string;
  week: number;
  seasonYear: number;
  projectedPoints: number;
  projectedPointsLow?: number;
  projectedPointsHigh?: number;
  scoringFormat: string;
  weekRank?: number;
  positionRank?: number;
  /** Per-category projected stats. GET /players/:id/projections returns full DB rows, which include these. */
  projPassYards?: number | null;
  projPassTDs?: number | null;
  projRushYards?: number | null;
  projRushTDs?: number | null;
  projReceptions?: number | null;
  projRecYards?: number | null;
  projRecTDs?: number | null;
}

export interface PlayerNews {
  id: string;
  playerId: string;
  headline: string;
  content: string;
  source?: string;
  sourceUrl?: string;
  aiSummary?: string;
  impactLevel?: 'high' | 'medium' | 'low';
  publishedAt: string;
  player?: Player;
}

/** Aggregated season stats returned by GET /players when includeStats=true */
export interface PlayerSeasonStats {
  games: number;
  gamesPlayed?: number;
  fantasyPointsPPR: number;
  fantasyPointsHalf: number;
  fantasyPointsStd: number;
  passYards: number;
  passTDs: number;
  rushYards: number;
  rushTDs: number;
  receptions: number;
  receivingYards: number;
  receivingTDs: number;
  averageSnapPct?: number | null;
}

/** Enrichment fields the GET /players list endpoint adds when includeStats=true */
export interface EnrichedPlayerFields {
  avgPointsPPR?: number;
  projectedPoints?: number;
  weeklyProjectedPoints?: number;
  isRostered?: boolean;
  /**
   * The player's last up-to-4 finalized weekly fantasy scores for the requested
   * scoring format, most recent last. Empty when no finalized weeks exist.
   */
  recentWeeklyScores?: number[];
  seasonStats?: PlayerSeasonStats;
}

export type EnrichedPlayer = Player & EnrichedPlayerFields;

export interface PlayersResponse {
  players: EnrichedPlayer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  weekComplete?: boolean;
  pointsType?: 'actual' | 'projected';
}

export interface PlayerStatsResponse {
  weeklyStats: PlayerWeeklyStats[];
  seasonTotals: Record<string, number>;
  averagePointsPPR: number;
}

export interface TrendingPlayer extends Player {
  trendDirection: 'up' | 'down';
  trendValue: number;
  ownedPct: number;
}

/** GET /players/:id/analysis — cached per-player AI take (Pro/Elite). */
export interface PlayerAnalysisResponse {
  analysis: string;
  cached: boolean;
  generatedAt: string;
  season: number;
  week: number;
}

export interface MatchupGradeResponse {
  grade: string | null;
  label: string;
  opponent: string | null;
  week: number | null;
  season?: number;
  position?: string;
  format?: string;
  gamesAnalyzed?: number;
  avgPointsAllowed?: number;
  leagueAvg?: number;
  ratio?: number;
  gameBreakdown?: { week: number; pointsAllowed: number }[];
  message: string;
}

// Player API functions
export const playerService = {
  // Get all players with pagination and filters
  getPlayers: async (params?: {
    page?: number;
    limit?: number;
    position?: string;
    team?: string;
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    /** Include seasonStats/avgPointsPPR/recentWeeklyScores enrichment */
    includeStats?: boolean;
    /** Omit week to get full-season aggregates */
    week?: number;
    season?: number;
    scoringFormat?: 'ppr' | 'half-ppr' | 'standard';
    leagueId?: string;
    availableOnly?: boolean;
  }): Promise<PlayersResponse> => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return api.get<PlayersResponse>(`/players${query ? `?${query}` : ''}`);
  },

  // Search players
  searchPlayers: async (query: string): Promise<{ players: Player[] }> => {
    return api.get<{ players: Player[] }>(`/players/search?q=${encodeURIComponent(query)}`);
  },

  // Get trending players
  getTrending: async (direction: 'up' | 'down' = 'up'): Promise<{ trending: TrendingPlayer[] }> => {
    return api.get<{ trending: TrendingPlayer[] }>(`/players/trending?direction=${direction}`);
  },

  // Get single player details
  getPlayer: async (playerId: string): Promise<{ player: Player & { news: PlayerNews[] } }> => {
    return api.get<{ player: Player & { news: PlayerNews[] } }>(`/players/${playerId}`);
  },

  // Get player stats
  getPlayerStats: async (playerId: string, season?: number): Promise<PlayerStatsResponse> => {
    const query = season ? `?season=${season}` : '';
    return api.get<PlayerStatsResponse>(`/players/${playerId}/stats${query}`);
  },

  // Get player projections
  getPlayerProjections: async (
    playerId: string,
    params?: { week?: number; season?: number; format?: string }
  ): Promise<{ projections: PlayerProjection[] }> => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return api.get<{ projections: PlayerProjection[] }>(
      `/players/${playerId}/projections${query ? `?${query}` : ''}`
    );
  },

  // Get player news
  getPlayerNews: async (playerId: string): Promise<{ news: PlayerNews[] }> => {
    return api.get<{ news: PlayerNews[] }>(`/players/${playerId}/news`);
  },

  // Get all recent news
  getAllNews: async (limit?: number): Promise<{ news: PlayerNews[] }> => {
    const query = limit ? `?limit=${limit}` : '';
    return api.get<{ news: PlayerNews[] }>(`/players/news${query}`);
  },

  // Get available players for a league
  getAvailablePlayers: async (leagueId: string): Promise<{ players: Player[] }> => {
    return api.get<{ players: Player[] }>(`/players/available/${leagueId}`);
  },

  // Get matchup grade for a player (defense performance vs position over last 5 games)
  getMatchupGrade: async (
    playerId: string,
    params?: { season?: number; week?: number; format?: 'ppr' | 'half' | 'std' }
  ): Promise<MatchupGradeResponse> => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return api.get<MatchupGradeResponse>(
      `/players/${playerId}/matchup-grade${query ? `?${query}` : ''}`
    );
  },

  // Get the cached/generated per-player AI take (Pro/Elite only — server enforces via requireTier)
  getPlayerAnalysis: async (
    playerId: string,
    params?: { week?: number; season?: number }
  ): Promise<PlayerAnalysisResponse> => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return api.get<PlayerAnalysisResponse>(
      `/players/${playerId}/analysis${query ? `?${query}` : ''}`
    );
  },
};

export default playerService;
