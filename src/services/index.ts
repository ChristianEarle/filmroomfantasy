// Export all services
export { default as api, ApiError } from './api';
export { default as authService } from './auth';
export { default as playerService } from './players';
export { default as leagueService } from './leagues';
export { default as teamService } from './teams';
export { default as matchupService } from './matchups';
export { default as gameService } from './games';
export {
  default as leagueConnectService,
  sleeperApi,
  espnApi,
  yahooApi,
  mflApi,
} from './leagueConnect';

// Export types
export type { User, League as AuthLeague, AuthResponse, MeResponse, UpdateProfileData, ScoringFormat } from './auth';
export type {
  Player,
  PlayerWeeklyStats,
  PlayerProjection,
  PlayerNews,
  PlayersResponse,
  PlayerStatsResponse,
  TrendingPlayer,
  MatchupGradeResponse,
} from './players';
export type { League, Team, Standing, LeagueDetails } from './leagues';
export type { RosterSpot, TeamDetails, Roster, LineupMove } from './teams';
export type {
  MatchupTeam,
  MatchupDetails,
  MatchupSummary,
  LiveScoring,
  CurrentMatchup,
} from './matchups';
export type {
  EspnScoreboardGame,
  NFLGame,
  GamesByDay,
  GameProps,
  LiveScore,
  TeamScheduleGame,
} from './games';
export type { Platform, ExternalLeague, ConnectLeagueResponse } from './leagueConnect';
