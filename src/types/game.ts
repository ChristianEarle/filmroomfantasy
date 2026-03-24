import type { TopPerformer } from '../services/games';

export interface Game {
  id: string;
  awayTeam: string;
  awayTeamLogo: string;
  homeTeam: string;
  homeTeamLogo: string;
  gameTime: string;
  gameTimeFormatted: string;
  spread: number | null;
  favoredTeam: 'home' | 'away';
  overUnder: number | null;
  tvNetwork: string;
  weather?: {
    displayValue: string;
    temperature?: number;
    highTemperature?: number;
  } | null;
  homeScore?: number;
  awayScore?: number;
  status?: string;
  topPerformers?: {
    home: TopPerformer | null;
    away: TopPerformer | null;
  };
}
