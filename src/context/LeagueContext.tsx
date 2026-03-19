import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useLeaguesContext } from './LeaguesContext';
import api from '../services/api';

// Types
export interface LeagueTeam {
  id: string;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  playoffSeed?: number;
  streak?: string;
  waiverPriority?: number;
  faabBudget?: number;
  isCurrentUserTeam?: boolean; // True when this is the team for the connected Sleeper user
  owner: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
}

export interface LeagueDetails {
  id: string;
  name: string;
  platform?: string;
  externalId?: string;
  scoringFormat: string;
  teamCount: number;
  currentWeek: number;
  seasonYear: number;
  playoffWeeks: number;
  playoffTeams: number;
  waiverType: string;
  waiverBudget?: number;
  teams: LeagueTeam[];
}

export interface UserTeam {
  id: string;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  waiverPriority?: number;
  faabBudget?: number;
  streak?: string;
  playoffSeed?: number;
}

export interface RosterPlayer {
  id: string;
  name: string;
  team: string;
  position: string;
  slot: string;
  isStarter: boolean;
  projectedPoints: number;
  actualPoints?: number;
  status?: string;
  injuryNote?: string;
  injuryBodyPart?: string;
  byeWeek?: number;
  imageUrl?: string;
  lastWeekPoints?: number;
  seasonStats?: {
    games: number;
    gamesPlayed?: number;
    totalPoints: number;
    avgPoints: number;
    passYards?: number;
    passTDs?: number;
    rushYards?: number;
    rushTDs?: number;
    receptions?: number;
    receivingYards?: number;
    receivingTDs?: number;
  };
}

export interface Matchup {
  id: string;
  week: number;
  isComplete: boolean;
  userTeam: {
    id: string;
    name: string;
    score: number;
    projectedScore: number;
    roster: RosterPlayer[];
  };
  opponent: {
    id: string;
    name: string;
    ownerName: string;
    score: number;
    projectedScore: number;
    roster: RosterPlayer[];
  };
}

export interface Standing {
  rank: number;
  teamId: string;
  teamName: string;
  ownerName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  winPct: number;
  streak?: string;
  playoffSeed?: number;
  isUserTeam: boolean;
}

export interface LeagueMatchup {
  id: string;
  week: number;
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

interface LeagueContextType {
  // Selected league
  selectedLeagueId: string | null;
  setSelectedLeagueId: (id: string | null) => void;

  // League details
  league: LeagueDetails | null;
  leagueLoading: boolean;

  // User's team in this league (the one they own)
  userTeam: UserTeam | null;
  userTeamLoading: boolean;

  // Currently viewed team (can be any team in the league)
  viewedTeamId: string | null;
  setViewedTeamId: (id: string | null) => void;

  // Roster for the currently viewed team
  roster: RosterPlayer[];
  rosterLoading: boolean;

  // Current matchup
  matchup: Matchup | null;
  matchupLoading: boolean;

  // League standings
  standings: Standing[];
  standingsLoading: boolean;

  // All league matchups (for simulator)
  allMatchups: LeagueMatchup[];
  allMatchupsLoading: boolean;

  // Error state
  error: string | null;

  // Refresh functions
  refreshLeague: () => Promise<void>;
  refreshRoster: (teamId?: string) => Promise<void>;
  refreshMatchup: () => Promise<void>;
  refreshStandings: () => Promise<void>;
  refreshAllMatchups: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const LeagueContext = createContext<LeagueContextType | undefined>(undefined);

export function LeagueProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const { leagues } = useLeaguesContext();

  // State
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [league, setLeague] = useState<LeagueDetails | null>(null);
  const [leagueLoading, setLeagueLoading] = useState(false);
  const [userTeam, setUserTeam] = useState<UserTeam | null>(null);
  const [userTeamLoading, setUserTeamLoading] = useState(false);
  const [viewedTeamId, setViewedTeamId] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [matchup, setMatchup] = useState<Matchup | null>(null);
  const [matchupLoading, setMatchupLoading] = useState(false);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [allMatchups, setAllMatchups] = useState<LeagueMatchup[]>([]);
  const [allMatchupsLoading, setAllMatchupsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-select first league when leagues change
  useEffect(() => {
    if (leagues.length > 0 && !selectedLeagueId) {
      setSelectedLeagueId(leagues[0].id);
    } else if (leagues.length === 0) {
      setSelectedLeagueId(null);
      setLeague(null);
      setUserTeam(null);
      setViewedTeamId(null);
      setRoster([]);
      setMatchup(null);
      setStandings([]);
    }
  }, [leagues, selectedLeagueId]);

  // Reset viewedTeamId when league changes (so we can set it to the user's team)
  useEffect(() => {
    setViewedTeamId(null);
    setUserTeam(null);
    setRoster([]);
  }, [selectedLeagueId]);

  // Fetch league details
  const refreshLeague = useCallback(async () => {
    if (!selectedLeagueId || !isAuthenticated) {
      setLeague(null);
      return;
    }

    setLeagueLoading(true);
    setError(null);
    try {
      const response = await api.get<{ league: LeagueDetails }>(`/leagues/${selectedLeagueId}`);
      setLeague(response.league);

      // Find user's team in this league (prefer isCurrentUserTeam from Sleeper match, then owner)
      if (response.league.teams && response.league.teams.length > 0) {
        let myTeam =
          response.league.teams.find(t => t.isCurrentUserTeam) ??
          (user ? response.league.teams.find(t => t.owner.id === user.id) : null);

        if (!myTeam) {
          myTeam = response.league.teams[0];
        }

        if (myTeam) {
          setUserTeam({
            id: myTeam.id,
            name: myTeam.name,
            wins: myTeam.wins,
            losses: myTeam.losses,
            ties: myTeam.ties,
            pointsFor: myTeam.pointsFor,
            pointsAgainst: myTeam.pointsAgainst,
            streak: myTeam.streak,
            playoffSeed: myTeam.playoffSeed,
            waiverPriority: myTeam.waiverPriority,
            faabBudget: myTeam.faabBudget,
          });

          // Always set viewed team to user's team when loading a league
          // This ensures the user sees their own team by default
          setViewedTeamId(myTeam.id);
        }
      }
    } catch (err) {
      setLeague(null);
      setError(err instanceof Error ? err.message : 'Failed to load league');
    } finally {
      setLeagueLoading(false);
    }
  }, [selectedLeagueId, isAuthenticated, user]);

  // Fetch roster for a team (defaults to viewed team)
  const refreshRoster = useCallback(async (teamId?: string) => {
    const targetTeamId = teamId || viewedTeamId;

    if (!selectedLeagueId || !targetTeamId || !isAuthenticated) {
      setRoster([]);
      return;
    }

    setRosterLoading(true);
    try {
      interface RosterSpot {
        slot: string;
        player: {
          id: string;
          name: string;
          team: string;
          position: string;
          projectedPoints?: number;
          actualPoints?: number;
          lastWeekPoints?: number;
          status?: string;
          injuryNote?: string;
          injuryBodyPart?: string;
          byeWeek?: number;
          headshotUrl?: string;
          imageUrl?: string;
          seasonStats?: RosterPlayer['seasonStats'];
        };
      }
      const response = await api.get<{ roster: { starters: RosterSpot[]; bench: RosterSpot[]; projectedTotal?: number; scoringFormat?: string } }>(`/teams/${targetTeamId}/roster`);

      // Helper function to map player data
      const mapPlayer = (spot: RosterSpot, isStarter: boolean): RosterPlayer => ({
        id: spot.player.id,
        name: spot.player.name,
        team: spot.player.team,
        position: spot.player.position,
        slot: spot.slot,
        isStarter,
        projectedPoints: spot.player.projectedPoints || 0,
        actualPoints: spot.player.actualPoints,
        lastWeekPoints: spot.player.lastWeekPoints,
        status: spot.player.status,
        injuryNote: spot.player.injuryNote,
        injuryBodyPart: spot.player.injuryBodyPart,
        byeWeek: spot.player.byeWeek,
        imageUrl: spot.player.headshotUrl || spot.player.imageUrl,
        seasonStats: spot.player.seasonStats || undefined,
      });

      // Combine starters and bench into a single roster array
      const allPlayers: RosterPlayer[] = [];

      if (response.roster.starters) {
        response.roster.starters.forEach((spot) => {
          if (spot.player) {
            allPlayers.push(mapPlayer(spot, true));
          }
        });
      }

      if (response.roster.bench) {
        response.roster.bench.forEach((spot) => {
          if (spot.player) {
            allPlayers.push(mapPlayer(spot, false));
          }
        });
      }

      setRoster(allPlayers);
    } catch (err) {
      setRoster([]);
      setError(err instanceof Error ? err.message : 'Failed to load roster');
    } finally {
      setRosterLoading(false);
    }
  }, [selectedLeagueId, viewedTeamId, isAuthenticated]);

  // Fetch current matchup
  const refreshMatchup = useCallback(async () => {
    if (!selectedLeagueId || !userTeam || !isAuthenticated) {
      setMatchup(null);
      return;
    }

    setMatchupLoading(true);
    try {
      const response = await api.get<{
        matchupId?: string;
        week?: number;
        myTeam?: { id: string; name: string; score: number };
        opponent?: { id: string; name: string; owner: string; score: number };
        isComplete?: boolean;
      }>(`/matchups/my/current?leagueId=${selectedLeagueId}`);

      // Transform API response to Matchup interface
      if (response.matchupId) {
        setMatchup({
          id: response.matchupId,
          week: response.week || 1,
          isComplete: response.isComplete || false,
          userTeam: {
            id: response.myTeam?.id || userTeam.id,
            name: response.myTeam?.name || userTeam.name,
            score: response.myTeam?.score || 0,
            projectedScore: 0,
            roster: [], // Roster loaded separately through refreshRoster
          },
          opponent: {
            id: response.opponent?.id || '',
            name: response.opponent?.name || 'Opponent',
            ownerName: response.opponent?.owner || 'Unknown',
            score: response.opponent?.score || 0,
            projectedScore: 0,
            roster: [],
          },
        });
      } else {
        setMatchup(null);
      }
    } catch (err) {
      // No matchup exists for current week (404 is expected, not an error)
      setMatchup(null);
    } finally {
      setMatchupLoading(false);
    }
  }, [selectedLeagueId, userTeam, isAuthenticated]);

  // Fetch league standings
  const refreshStandings = useCallback(async () => {
    if (!selectedLeagueId || !isAuthenticated) {
      setStandings([]);
      return;
    }

    setStandingsLoading(true);
    try {
      interface StandingResponse {
        rank: number;
        id: string;
        name: string;
        owner?: { username: string };
        wins?: number;
        losses?: number;
        ties?: number;
        pointsFor?: number;
        pointsAgainst?: number;
        winPct?: number;
        streak?: string;
        playoffSeed?: number;
        isCurrentUserTeam?: boolean;
      }
      const response = await api.get<{ standings: StandingResponse[] }>(`/leagues/${selectedLeagueId}/standings`);

      // Map API response to Standing interface and mark user's team
      // Use isCurrentUserTeam from the backend (which does Sleeper user lookup),
      // falling back to userTeam.id match
      const standingsWithUser: Standing[] = response.standings.map(s => ({
        rank: s.rank,
        teamId: s.id,
        teamName: s.name,
        ownerName: s.owner?.username || 'Unknown',
        wins: s.wins || 0,
        losses: s.losses || 0,
        ties: s.ties || 0,
        pointsFor: s.pointsFor || 0,
        pointsAgainst: s.pointsAgainst || 0,
        winPct: s.winPct || 0,
        streak: s.streak,
        playoffSeed: s.playoffSeed,
        isUserTeam: s.isCurrentUserTeam || (userTeam ? s.id === userTeam.id : false),
      }));

      setStandings(standingsWithUser);
    } catch (err) {
      setStandings([]);
      setError(err instanceof Error ? err.message : 'Failed to load standings');
    } finally {
      setStandingsLoading(false);
    }
  }, [selectedLeagueId, isAuthenticated, userTeam]);

  // Fetch all league matchups (for simulator)
  const refreshAllMatchups = useCallback(async () => {
    if (!selectedLeagueId || !isAuthenticated) {
      setAllMatchups([]);
      return;
    }

    setAllMatchupsLoading(true);
    try {
      const response = await api.get<{ matchups: LeagueMatchup[] }>(`/matchups/league/${selectedLeagueId}/all`);
      setAllMatchups(response.matchups || []);
    } catch (err) {
      setAllMatchups([]);
      setError(err instanceof Error ? err.message : 'Failed to load matchups');
    } finally {
      setAllMatchupsLoading(false);
    }
  }, [selectedLeagueId, isAuthenticated]);

  // Refresh all data — refreshes league first (sets userTeam), then dependent data in parallel
  const refreshAll = useCallback(async () => {
    await refreshLeague();
    await Promise.all([
      refreshRoster(),
      refreshMatchup(),
      refreshStandings(),
    ]);
  }, [refreshLeague, refreshRoster, refreshMatchup, refreshStandings]);

  // Fetch league when selected league changes
  useEffect(() => {
    if (selectedLeagueId && isAuthenticated) {
      refreshLeague();
    }
  }, [selectedLeagueId, isAuthenticated, refreshLeague]);

  // Fetch roster when viewedTeamId changes
  useEffect(() => {
    if (viewedTeamId && isAuthenticated) {
      refreshRoster();
    }
  }, [viewedTeamId, isAuthenticated, refreshRoster]);

  // Fetch matchup and standings when userTeam is set
  useEffect(() => {
    if (userTeam && isAuthenticated) {
      refreshMatchup();
      refreshStandings();
    }
  }, [userTeam, isAuthenticated, refreshMatchup, refreshStandings]);

  return (
    <LeagueContext.Provider
      value={{
        selectedLeagueId,
        setSelectedLeagueId,
        league,
        leagueLoading,
        userTeam,
        userTeamLoading,
        viewedTeamId,
        setViewedTeamId,
        roster,
        rosterLoading,
        matchup,
        matchupLoading,
        standings,
        standingsLoading,
        allMatchups,
        allMatchupsLoading,
        error,
        refreshLeague,
        refreshRoster,
        refreshMatchup,
        refreshStandings,
        refreshAllMatchups,
        refreshAll,
      }}
    >
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeagueContext() {
  const context = useContext(LeagueContext);
  if (context === undefined) {
    throw new Error('useLeagueContext must be used within a LeagueProvider');
  }
  return context;
}
