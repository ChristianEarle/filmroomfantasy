// Team API services
import api from './api';
import type { Player } from './players';

// Types
export interface RosterSpot {
  id: string;
  slot: string;
  isStarter: boolean;
  acquiredAt: string;
  acquiredType: 'draft' | 'trade' | 'waiver' | 'free_agent';
  player: Player;
}

export interface TeamDetails {
  id: string;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  streak?: string;
  waiverPriority?: number;
  faabBudget?: number;
  isOwner: boolean;
  owner: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  league: {
    id: string;
    name: string;
    scoringFormat: string;
  };
  roster: RosterSpot[];
}

export interface Roster {
  starters: Array<{
    slot: string;
    player: Player;
  }>;
  bench: Array<{
    slot: string;
    player: Player;
  }>;
}

export interface LineupMove {
  playerId: string;
  newSlot: string;
  isStarter: boolean;
}

// Team API functions
export const teamService = {
  // Get team details
  getTeam: async (teamId: string): Promise<{ team: TeamDetails }> => {
    return api.get<{ team: TeamDetails }>(`/teams/${teamId}`);
  },

  // Update team name
  updateTeam: async (teamId: string, name: string): Promise<{ team: TeamDetails }> => {
    return api.put<{ team: TeamDetails }>(`/teams/${teamId}`, { name });
  },

  // Get team roster
  getRoster: async (teamId: string): Promise<{ roster: Roster }> => {
    return api.get<{ roster: Roster }>(`/teams/${teamId}/roster`);
  },

  // Set lineup (move players)
  setLineup: async (teamId: string, moves: LineupMove[]): Promise<{ message: string }> => {
    return api.put<{ message: string }>(`/teams/${teamId}/roster`, { moves });
  },

  // Add player to roster (free agent pickup)
  addPlayer: async (
    teamId: string,
    playerId: string,
    slot?: string,
    dropPlayerId?: string
  ): Promise<{ message: string }> => {
    return api.post<{ message: string }>(`/teams/${teamId}/roster/add`, {
      playerId,
      slot,
      dropPlayerId,
    });
  },

  // Drop player from roster
  dropPlayer: async (teamId: string, playerId: string): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`/teams/${teamId}/roster/${playerId}`);
  },
};

export default teamService;
