// NFL Games API services
import api from './api';
import type { Player, PlayerProjection } from './players';

// Types
export interface TopPerformer {
  playerName: string;
  position: string;
  fantasyPoints: number;
  statLine: string;
  headshotUrl: string | null;
}

export interface EspnScoreboardGame {
  id: string;
  awayTeam: string;
  awayTeamLogo: string;
  awayTeamLogoUrl?: string;
  homeTeam: string;
  homeTeamLogo: string;
  homeTeamLogoUrl?: string;
  gameTime: string;
  gameTimeDisplay?: string;
  spread: number | null;
  favoredTeam: 'home' | 'away';
  overUnder: number | null;
  tvNetwork?: string;
  stadium?: string;
  indoor?: boolean;
  weather?: {
    displayValue: string;
    temperature?: number;
    highTemperature?: number;
    conditionId?: string;
  } | null;
  homeScore?: number;
  awayScore?: number;
  status?: string;
  topPerformers?: {
    home: TopPerformer | null;
    away: TopPerformer | null;
  };
}

export interface NFLGame {
  id: string;
  externalId?: string;
  week: number;
  seasonYear: number;
  seasonType?: string;
  homeTeam: string;
  awayTeam: string;
  gameTime: string;
  homeScore?: number;
  awayScore?: number;
  spread?: number;
  overUnder?: number;
  homeMoneyline?: number;
  awayMoneyline?: number;
  tvNetwork?: string;
  stadium?: string;
  weather?: string;
  isComplete: boolean;
  quarter?: string;
  timeRemaining?: string;
}

export interface GamesByDay {
  [date: string]: NFLGame[];
}

export interface GameProps {
  gameId: string;
  spread?: number;
  overUnder?: number;
  homeMoneyline?: number;
  awayMoneyline?: number;
  props: Array<{
    player: Player;
    projectedPoints: number;
    weekRank?: number;
    positionRank?: number;
    projPassYards?: number;
    projPassTDs?: number;
    projRushYards?: number;
    projRushTDs?: number;
    projReceptions?: number;
    projRecYards?: number;
    projRecTDs?: number;
  }>;
}

export interface LiveScore {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  quarter?: string;
  timeRemaining?: string;
  isComplete: boolean;
}

export interface TeamScheduleGame extends NFLGame {
  isHome: boolean;
  opponent: string;
}

// Games API functions
export const gameService = {
  // Get games for a week
  getWeekGames: async (
    week: number,
    season?: number
  ): Promise<{ week: number; season: number; games: NFLGame[]; gamesByDay: GamesByDay }> => {
    const query = season ? `?season=${season}` : '';
    return api.get<{ week: number; season: number; games: NFLGame[]; gamesByDay: GamesByDay }>(
      `/games/week/${week}${query}`
    );
  },

  // Get single game details
  getGame: async (
    gameId: string
  ): Promise<{ game: NFLGame; homePlayers: Player[]; awayPlayers: Player[] }> => {
    return api.get<{ game: NFLGame; homePlayers: Player[]; awayPlayers: Player[] }>(
      `/games/${gameId}`
    );
  },

  // Get player props for a game
  getGameProps: async (gameId: string): Promise<GameProps> => {
    return api.get<GameProps>(`/games/${gameId}/props`);
  },

  // Get live scores
  getLiveScores: async (): Promise<{ games: LiveScore[]; lastUpdated: string }> => {
    return api.get<{ games: LiveScore[]; lastUpdated: string }>('/games/live/scores');
  },

  // Get upcoming games
  getUpcomingGames: async (limit?: number): Promise<{ games: NFLGame[] }> => {
    const query = limit ? `?limit=${limit}` : '';
    return api.get<{ games: NFLGame[] }>(`/games/upcoming${query}`);
  },

  // Get ESPN scoreboard (real games + weather)
  getEspnScoreboard: async (
    week?: number,
    season?: number,
    seasonType?: number
  ): Promise<{
    week: number;
    season: number;
    seasonType?: string;
    weekLabel?: string;
    games: EspnScoreboardGame[];
  }> => {
    const params = new URLSearchParams();
    if (season != null) params.set('season', String(season));
    if (week != null) params.set('week', String(week));
    if (seasonType != null) params.set('seasontype', String(seasonType));
    const query = params.toString();
    return api.get<{
      week: number;
      season: number;
      seasonType?: string;
      weekLabel?: string;
      games: EspnScoreboardGame[];
    }>(`/games/slate${query ? `?${query}` : ''}`);
  },

  // Get team schedule
  getTeamSchedule: async (
    team: string,
    season?: number
  ): Promise<{ team: string; season: number; schedule: TeamScheduleGame[] }> => {
    const query = season ? `?season=${season}` : '';
    return api.get<{ team: string; season: number; schedule: TeamScheduleGame[] }>(
      `/games/team/${team}${query}`
    );
  },
};

export default gameService;
