import { X, TrendingUp, TrendingDown, ArrowLeft } from 'lucide-react';
import { Player } from '../App';

interface Game {
  id: string;
  awayTeam: string;
  awayTeamLogo: string;
  homeTeam: string;
  homeTeamLogo: string;
  gameTime: string;
  spread: string;
  favoredTeam: 'home' | 'away';
  overUnder: number;
  tvNetwork: string;
}

interface GameDetailModalProps {
  game: Game;
  onClose: () => void;
  onPlayerClick: (player: Player) => void;
  isDarkMode: boolean;
}

// Mock player data for each team
const getPlayersForTeam = (teamLogo: string): Player[] => {
  const playersByTeam: Record<string, Player[]> = {
    'BUF': [
      { id: 'buf1', rank: 2, name: 'Josh Allen', team: 'BUF', position: 'QB', keyLine: 'O/U 285.5 pass yds', projectedPoints: 24.3, weekChange: 2.1 },
      { id: 'buf2', rank: 15, name: 'Stefon Diggs', team: 'BUF', position: 'WR', keyLine: 'O/U 68.5 rec yds', projectedPoints: 16.8, weekChange: -1.2 },
      { id: 'buf3', rank: 28, name: 'James Cook', team: 'BUF', position: 'RB', keyLine: 'O/U 54.5 rush yds', projectedPoints: 12.4, weekChange: 0.8 },
      { id: 'buf4', rank: 35, name: 'Gabe Davis', team: 'BUF', position: 'WR', keyLine: 'O/U 42.5 rec yds', projectedPoints: 10.2, weekChange: -0.5 },
      { id: 'buf5', rank: 42, name: 'Dalton Kincaid', team: 'BUF', position: 'TE', keyLine: 'O/U 38.5 rec yds', projectedPoints: 9.1, weekChange: 1.3 },
      { id: 'buf6', rank: 8, name: 'Tyler Bass', team: 'BUF', position: 'K', keyLine: 'O/U 8.5 pts', projectedPoints: 8.7, weekChange: 0.3 },
      { id: 'buf7', rank: 5, name: 'Bills DST', team: 'BUF', position: 'DEF', keyLine: '18.5 pts allowed', projectedPoints: 9.2, weekChange: 1.1 },
    ],
    'KC': [
      { id: 'kc1', rank: 1, name: 'Patrick Mahomes', team: 'KC', position: 'QB', keyLine: 'O/U 295.5 pass yds', projectedPoints: 25.7, weekChange: 1.8 },
      { id: 'kc2', rank: 5, name: 'Travis Kelce', team: 'KC', position: 'TE', keyLine: 'O/U 68.5 rec yds', projectedPoints: 18.2, weekChange: -0.9 },
      { id: 'kc3', rank: 22, name: 'Isiah Pacheco', team: 'KC', position: 'RB', keyLine: 'O/U 62.5 rush yds', projectedPoints: 13.6, weekChange: 0.4 },
      { id: 'kc4', rank: 38, name: 'Rashee Rice', team: 'KC', position: 'WR', keyLine: 'O/U 52.5 rec yds', projectedPoints: 11.8, weekChange: 2.3 },
      { id: 'kc5', rank: 48, name: 'Skyy Moore', team: 'KC', position: 'WR', keyLine: 'O/U 28.5 rec yds', projectedPoints: 7.4, weekChange: -0.2 },
      { id: 'kc6', rank: 4, name: 'Harrison Butker', team: 'KC', position: 'K', keyLine: 'O/U 9.5 pts', projectedPoints: 9.8, weekChange: 0.5 },
      { id: 'kc7', rank: 3, name: 'Chiefs DST', team: 'KC', position: 'DEF', keyLine: '17.5 pts allowed', projectedPoints: 10.4, weekChange: 0.8 },
    ],
    'SF': [
      { id: 'sf1', rank: 4, name: 'Brock Purdy', team: 'SF', position: 'QB', keyLine: 'O/U 265.5 pass yds', projectedPoints: 22.4, weekChange: 1.2 },
      { id: 'sf2', rank: 3, name: 'Christian McCaffrey', team: 'SF', position: 'RB', keyLine: 'O/U 125.5 rush+rec', projectedPoints: 23.8, weekChange: -2.1 },
      { id: 'sf3', rank: 8, name: 'Deebo Samuel', team: 'SF', position: 'WR', keyLine: 'O/U 72.5 rec yds', projectedPoints: 17.2, weekChange: 0.9 },
      { id: 'sf4', rank: 12, name: 'Brandon Aiyuk', team: 'SF', position: 'WR', keyLine: 'O/U 68.5 rec yds', projectedPoints: 15.6, weekChange: 1.4 },
      { id: 'sf5', rank: 18, name: 'George Kittle', team: 'SF', position: 'TE', keyLine: 'O/U 55.5 rec yds', projectedPoints: 14.3, weekChange: -0.6 },
      { id: 'sf6', rank: 6, name: 'Jake Moody', team: 'SF', position: 'K', keyLine: 'O/U 9.5 pts', projectedPoints: 9.2, weekChange: 0.2 },
      { id: 'sf7', rank: 1, name: '49ers DST', team: 'SF', position: 'DEF', keyLine: '16.5 pts allowed', projectedPoints: 11.8, weekChange: 1.5 },
    ],
    'DAL': [
      { id: 'dal1', rank: 6, name: 'Dak Prescott', team: 'DAL', position: 'QB', keyLine: 'O/U 278.5 pass yds', projectedPoints: 21.8, weekChange: 0.7 },
      { id: 'dal2', rank: 10, name: 'CeeDee Lamb', team: 'DAL', position: 'WR', keyLine: 'O/U 85.5 rec yds', projectedPoints: 18.9, weekChange: 1.6 },
      { id: 'dal3', rank: 16, name: 'Tony Pollard', team: 'DAL', position: 'RB', keyLine: 'O/U 68.5 rush yds', projectedPoints: 14.7, weekChange: -0.8 },
      { id: 'dal4', rank: 32, name: 'Jake Ferguson', team: 'DAL', position: 'TE', keyLine: 'O/U 42.5 rec yds', projectedPoints: 10.8, weekChange: 0.5 },
      { id: 'dal5', rank: 45, name: 'Brandin Cooks', team: 'DAL', position: 'WR', keyLine: 'O/U 38.5 rec yds', projectedPoints: 8.9, weekChange: -0.3 },
      { id: 'dal6', rank: 10, name: 'Brandon Aubrey', team: 'DAL', position: 'K', keyLine: 'O/U 8.5 pts', projectedPoints: 8.5, weekChange: -0.1 },
      { id: 'dal7', rank: 7, name: 'Cowboys DST', team: 'DAL', position: 'DEF', keyLine: '19.5 pts allowed', projectedPoints: 8.6, weekChange: 0.4 },
    ],
    'MIA': [
      { id: 'mia1', rank: 8, name: 'Tua Tagovailoa', team: 'MIA', position: 'QB', keyLine: 'O/U 268.5 pass yds', projectedPoints: 20.6, weekChange: 1.1 },
      { id: 'mia2', rank: 3, name: 'Tyreek Hill', team: 'MIA', position: 'WR', keyLine: 'O/U 92.5 rec yds', projectedPoints: 22.1, weekChange: 3.4 },
      { id: 'mia3', rank: 14, name: 'Raheem Mostert', team: 'MIA', position: 'RB', keyLine: 'O/U 58.5 rush yds', projectedPoints: 15.3, weekChange: 0.6 },
      { id: 'mia4', rank: 19, name: 'Jaylen Waddle', team: 'MIA', position: 'WR', keyLine: 'O/U 64.5 rec yds', projectedPoints: 14.8, weekChange: -0.4 },
      { id: 'mia5', rank: 52, name: 'Durham Smythe', team: 'MIA', position: 'TE', keyLine: 'O/U 22.5 rec yds', projectedPoints: 6.2, weekChange: 0.1 },
      { id: 'mia6', rank: 15, name: 'Jason Sanders', team: 'MIA', position: 'K', keyLine: 'O/U 7.5 pts', projectedPoints: 7.8, weekChange: 0.2 },
      { id: 'mia7', rank: 12, name: 'Dolphins DST', team: 'MIA', position: 'DEF', keyLine: '21.5 pts allowed', projectedPoints: 7.2, weekChange: -0.5 },
    ],
    'NYJ': [
      { id: 'nyj1', rank: 12, name: 'Aaron Rodgers', team: 'NYJ', position: 'QB', keyLine: 'O/U 255.5 pass yds', projectedPoints: 18.4, weekChange: -1.8 },
      { id: 'nyj2', rank: 7, name: 'Garrett Wilson', team: 'NYJ', position: 'WR', keyLine: 'O/U 75.5 rec yds', projectedPoints: 17.6, weekChange: 2.1 },
      { id: 'nyj3', rank: 24, name: 'Breece Hall', team: 'NYJ', position: 'RB', keyLine: 'O/U 72.5 rush+rec', projectedPoints: 13.2, weekChange: -0.9 },
      { id: 'nyj4', rank: 40, name: 'Allen Lazard', team: 'NYJ', position: 'WR', keyLine: 'O/U 38.5 rec yds', projectedPoints: 9.7, weekChange: 0.3 },
      { id: 'nyj5', rank: 55, name: 'Tyler Conklin', team: 'NYJ', position: 'TE', keyLine: 'O/U 28.5 rec yds', projectedPoints: 7.1, weekChange: -0.2 },
      { id: 'nyj6', rank: 18, name: 'Greg Zuerlein', team: 'NYJ', position: 'K', keyLine: 'O/U 7.5 pts', projectedPoints: 7.4, weekChange: -0.3 },
      { id: 'nyj7', rank: 6, name: 'Jets DST', team: 'NYJ', position: 'DEF', keyLine: '19.5 pts allowed', projectedPoints: 9.1, weekChange: 0.7 },
    ],
    'PHI': [
      { id: 'phi1', rank: 5, name: 'Jalen Hurts', team: 'PHI', position: 'QB', keyLine: 'O/U 245.5 pass yds', projectedPoints: 23.2, weekChange: 1.5 },
      { id: 'phi2', rank: 11, name: 'A.J. Brown', team: 'PHI', position: 'WR', keyLine: 'O/U 82.5 rec yds', projectedPoints: 18.4, weekChange: 0.8 },
      { id: 'phi3', rank: 13, name: "D'Andre Swift", team: 'PHI', position: 'RB', keyLine: 'O/U 65.5 rush yds', projectedPoints: 15.1, weekChange: -0.5 },
      { id: 'phi4', rank: 27, name: 'DeVonta Smith', team: 'PHI', position: 'WR', keyLine: 'O/U 58.5 rec yds', projectedPoints: 12.6, weekChange: 0.9 },
      { id: 'phi5', rank: 33, name: 'Dallas Goedert', team: 'PHI', position: 'TE', keyLine: 'O/U 48.5 rec yds', projectedPoints: 11.2, weekChange: 0.4 },
      { id: 'phi6', rank: 3, name: 'Jake Elliott', team: 'PHI', position: 'K', keyLine: 'O/U 9.5 pts', projectedPoints: 9.6, weekChange: 0.6 },
      { id: 'phi7', rank: 4, name: 'Eagles DST', team: 'PHI', position: 'DEF', keyLine: '18.5 pts allowed', projectedPoints: 9.8, weekChange: 1.2 },
    ],
    'WAS': [
      { id: 'was1', rank: 14, name: 'Sam Howell', team: 'WAS', position: 'QB', keyLine: 'O/U 238.5 pass yds', projectedPoints: 17.8, weekChange: -0.9 },
      { id: 'was2', rank: 17, name: 'Terry McLaurin', team: 'WAS', position: 'WR', keyLine: 'O/U 68.5 rec yds', projectedPoints: 15.2, weekChange: 1.1 },
      { id: 'was3', rank: 25, name: 'Brian Robinson Jr.', team: 'WAS', position: 'RB', keyLine: 'O/U 58.5 rush yds', projectedPoints: 12.8, weekChange: 0.3 },
      { id: 'was4', rank: 44, name: 'Jahan Dotson', team: 'WAS', position: 'WR', keyLine: 'O/U 42.5 rec yds', projectedPoints: 9.4, weekChange: -0.6 },
      { id: 'was5', rank: 58, name: 'Logan Thomas', team: 'WAS', position: 'TE', keyLine: 'O/U 32.5 rec yds', projectedPoints: 6.8, weekChange: 0.2 },
      { id: 'was6', rank: 22, name: 'Joey Slye', team: 'WAS', position: 'K', keyLine: 'O/U 7.5 pts', projectedPoints: 7.1, weekChange: -0.2 },
      { id: 'was7', rank: 18, name: 'Commanders DST', team: 'WAS', position: 'DEF', keyLine: '22.5 pts allowed', projectedPoints: 6.4, weekChange: -0.4 },
    ],
    'GB': [
      { id: 'gb1', rank: 9, name: 'Jordan Love', team: 'GB', position: 'QB', keyLine: 'O/U 262.5 pass yds', projectedPoints: 20.2, weekChange: 0.8 },
      { id: 'gb2', rank: 20, name: 'Aaron Jones', team: 'GB', position: 'RB', keyLine: 'O/U 68.5 rush+rec', projectedPoints: 14.3, weekChange: 0.6 },
      { id: 'gb3', rank: 26, name: 'Christian Watson', team: 'GB', position: 'WR', keyLine: 'O/U 58.5 rec yds', projectedPoints: 12.7, weekChange: -0.7 },
      { id: 'gb4', rank: 36, name: 'Romeo Doubs', team: 'GB', position: 'WR', keyLine: 'O/U 45.5 rec yds', projectedPoints: 10.5, weekChange: 0.4 },
      { id: 'gb5', rank: 41, name: 'Luke Musgrave', team: 'GB', position: 'TE', keyLine: 'O/U 35.5 rec yds', projectedPoints: 9.3, weekChange: 1.2 },
      { id: 'gb6', rank: 12, name: 'Anders Carlson', team: 'GB', position: 'K', keyLine: 'O/U 8.5 pts', projectedPoints: 8.2, weekChange: 0.3 },
      { id: 'gb7', rank: 10, name: 'Packers DST', team: 'GB', position: 'DEF', keyLine: '20.5 pts allowed', projectedPoints: 8.1, weekChange: 0.5 },
    ],
    'DET': [
      { id: 'det1', rank: 7, name: 'Jared Goff', team: 'DET', position: 'QB', keyLine: 'O/U 272.5 pass yds', projectedPoints: 21.4, weekChange: 1.3 },
      { id: 'det2', rank: 9, name: 'Amon-Ra St. Brown', team: 'DET', position: 'WR', keyLine: 'O/U 82.5 rec yds', projectedPoints: 18.7, weekChange: 2.0 },
      { id: 'det3', rank: 11, name: 'David Montgomery', team: 'DET', position: 'RB', keyLine: 'O/U 72.5 rush yds', projectedPoints: 16.2, weekChange: 0.5 },
      { id: 'det4', rank: 21, name: 'Jahmyr Gibbs', team: 'DET', position: 'RB', keyLine: 'O/U 58.5 rush+rec', projectedPoints: 13.8, weekChange: 1.1 },
      { id: 'det5', rank: 30, name: 'Sam LaPorta', team: 'DET', position: 'TE', keyLine: 'O/U 52.5 rec yds', projectedPoints: 11.6, weekChange: 0.7 },
      { id: 'det6', rank: 7, name: 'Riley Patterson', team: 'DET', position: 'K', keyLine: 'O/U 9.5 pts', projectedPoints: 8.9, weekChange: 0.4 },
      { id: 'det7', rank: 2, name: 'Lions DST', team: 'DET', position: 'DEF', keyLine: '17.5 pts allowed', projectedPoints: 10.7, weekChange: 1.3 },
    ],
    'BAL': [
      { id: 'bal1', rank: 3, name: 'Lamar Jackson', team: 'BAL', position: 'QB', keyLine: 'O/U 268.5 pass yds', projectedPoints: 24.8, weekChange: 1.9 },
      { id: 'bal2', rank: 15, name: 'Mark Andrews', team: 'BAL', position: 'TE', keyLine: 'O/U 62.5 rec yds', projectedPoints: 15.4, weekChange: -0.4 },
      { id: 'bal3', rank: 18, name: 'Gus Edwards', team: 'BAL', position: 'RB', keyLine: 'O/U 58.5 rush yds', projectedPoints: 14.1, weekChange: 0.8 },
      { id: 'bal4', rank: 29, name: 'Zay Flowers', team: 'BAL', position: 'WR', keyLine: 'O/U 68.5 rec yds', projectedPoints: 12.2, weekChange: 2.1 },
      { id: 'bal5', rank: 47, name: 'Rashod Bateman', team: 'BAL', position: 'WR', keyLine: 'O/U 38.5 rec yds', projectedPoints: 8.6, weekChange: -0.3 },
      { id: 'bal6', rank: 2, name: 'Justin Tucker', team: 'BAL', position: 'K', keyLine: 'O/U 9.5 pts', projectedPoints: 10.1, weekChange: 0.4 },
      { id: 'bal7', rank: 8, name: 'Ravens DST', team: 'BAL', position: 'DEF', keyLine: '20.5 pts allowed', projectedPoints: 8.4, weekChange: 0.6 },
    ],
    'CIN': [
      { id: 'cin1', rank: 10, name: 'Joe Burrow', team: 'CIN', position: 'QB', keyLine: 'O/U 275.5 pass yds', projectedPoints: 19.8, weekChange: 0.9 },
      { id: 'cin2', rank: 6, name: "Ja'Marr Chase", team: 'CIN', position: 'WR', keyLine: 'O/U 88.5 rec yds', projectedPoints: 19.3, weekChange: 1.7 },
      { id: 'cin3', rank: 23, name: 'Joe Mixon', team: 'CIN', position: 'RB', keyLine: 'O/U 68.5 rush yds', projectedPoints: 13.5, weekChange: -0.6 },
      { id: 'cin4', rank: 31, name: 'Tee Higgins', team: 'CIN', position: 'WR', keyLine: 'O/U 62.5 rec yds', projectedPoints: 11.4, weekChange: 0.5 },
      { id: 'cin5', rank: 50, name: 'Tyler Boyd', team: 'CIN', position: 'WR', keyLine: 'O/U 35.5 rec yds', projectedPoints: 7.8, weekChange: -0.2 },
      { id: 'cin6', rank: 5, name: 'Evan McPherson', team: 'CIN', position: 'K', keyLine: 'O/U 9.5 pts', projectedPoints: 9.4, weekChange: 0.5 },
      { id: 'cin7', rank: 14, name: 'Bengals DST', team: 'CIN', position: 'DEF', keyLine: '21.5 pts allowed', projectedPoints: 7.0, weekChange: -0.3 },
    ],
  };

  return playersByTeam[teamLogo] || [
    { id: `${teamLogo}1`, rank: 20, name: 'Player 1', team: teamLogo, position: 'QB', keyLine: 'O/U 250 yds', projectedPoints: 18.5, weekChange: 0.5 },
    { id: `${teamLogo}2`, rank: 25, name: 'Player 2', team: teamLogo, position: 'RB', keyLine: 'O/U 60 yds', projectedPoints: 14.2, weekChange: -0.3 },
    { id: `${teamLogo}3`, rank: 30, name: 'Player 3', team: teamLogo, position: 'WR', keyLine: 'O/U 55 yds', projectedPoints: 12.8, weekChange: 0.8 },
    { id: `${teamLogo}4`, rank: 35, name: 'Player 4', team: teamLogo, position: 'WR', keyLine: 'O/U 48 yds', projectedPoints: 10.5, weekChange: -0.2 },
    { id: `${teamLogo}5`, rank: 40, name: 'Player 5', team: teamLogo, position: 'TE', keyLine: 'O/U 42 yds', projectedPoints: 9.1, weekChange: 0.4 },
    { id: `${teamLogo}6`, rank: 15, name: 'Kicker', team: teamLogo, position: 'K', keyLine: 'O/U 8.5 pts', projectedPoints: 8.2, weekChange: 0.1 },
    { id: `${teamLogo}7`, rank: 10, name: `${teamLogo} DST`, team: teamLogo, position: 'DEF', keyLine: '20.5 pts allowed', projectedPoints: 7.8, weekChange: 0.3 },
  ];
};

export function GameDetailModal({ game, onClose, onPlayerClick, isDarkMode }: GameDetailModalProps) {
  const awayPlayers = getPlayersForTeam(game.awayTeamLogo);
  const homePlayers = getPlayersForTeam(game.homeTeamLogo);

  // Group players by position
  const groupByPosition = (players: Player[]) => {
    const grouped: Record<string, Player[]> = {
      QB: [],
      RB: [],
      WR: [],
      TE: [],
      K: [],
      DEF: [],
    };
    
    players.forEach(player => {
      if (grouped[player.position]) {
        grouped[player.position].push(player);
      }
    });
    
    return grouped;
  };

  const awayPlayersByPosition = groupByPosition(awayPlayers);
  const homePlayersByPosition = groupByPosition(homePlayers);

  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

  return (
    <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${isDarkMode ? 'bg-slate-950/80' : 'bg-black/20'}`}>
      <div className={`rounded-2xl border shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        {/* Header */}
        <div className={`border-b p-6 flex-shrink-0 ${isDarkMode ? 'bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700' : 'bg-gradient-to-r from-slate-50 to-white border-slate-200'}`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={onClose}
                  className={`flex items-center gap-2 transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm">Back to Slate</span>
                </button>
              </div>
              <div className={`text-sm mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{game.gameTime} • {game.tvNetwork}</div>
              <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{game.awayTeam} @ {game.homeTeam}</h2>
            </div>
            <button
              onClick={onClose}
              className={`transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* Game Info */}
          <div className="flex items-center gap-6 text-sm">
            <div className={`rounded-lg px-4 py-2 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>
              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Spread:</span>{' '}
              <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {game.favoredTeam === 'home' ? game.homeTeamLogo : game.awayTeamLogo} -{game.spread}
              </span>
            </div>
            <div className={`rounded-lg px-4 py-2 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>
              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Over/Under:</span>{' '}
              <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{game.overUnder}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-y-auto p-6 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
          <div className="grid grid-cols-2 gap-6">
            {/* Away Team */}
            <div>
              <div className={`rounded-lg p-4 mb-4 border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>
                      <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{game.awayTeamLogo}</span>
                    </div>
                    <div>
                      <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{game.awayTeam}</div>
                      <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Away Team</div>
                    </div>
                  </div>
                  {game.favoredTeam === 'away' && (
                    <div className="text-right">
                      <div className="text-sm font-bold text-green-500">-{game.spread}</div>
                      <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Favored</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {positions.map(position => (
                  <div key={position}>
                    <div className={`text-sm font-bold mb-2 mt-4 first:mt-0 px-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>{position}</div>
                    <div className="space-y-2">
                      {awayPlayersByPosition[position].map((player) => (
                        <div
                          key={player.id}
                          onClick={() => onPlayerClick(player)}
                          className={`rounded-lg p-4 border transition-all cursor-pointer group ${isDarkMode ? 'bg-slate-900 border-slate-700 hover:border-blue-600 hover:shadow-lg hover:shadow-blue-900/10' : 'bg-white border-slate-300 hover:border-blue-500 hover:shadow-md hover:bg-slate-50'}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className={`font-bold transition-colors ${isDarkMode ? 'text-slate-200 group-hover:text-white' : 'text-slate-900 group-hover:text-slate-800'}`}>{player.name}</div>
                              <div className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                                {player.position} • #{player.rank} Overall
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-blue-600">{player.projectedPoints}</div>
                              <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>pts</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className={isDarkMode ? 'text-slate-500' : 'text-slate-600'}>{player.keyLine}</div>
                            <div className={`flex items-center gap-1 ${player.weekChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {player.weekChange >= 0 ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              <span>{player.weekChange >= 0 ? '+' : ''}{player.weekChange}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Home Team */}
            <div>
              <div className={`rounded-lg p-4 mb-4 border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>
                      <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{game.homeTeamLogo}</span>
                    </div>
                    <div>
                      <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{game.homeTeam}</div>
                      <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Home Team</div>
                    </div>
                  </div>
                  {game.favoredTeam === 'home' && (
                    <div className="text-right">
                      <div className="text-sm font-bold text-green-500">-{game.spread}</div>
                      <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Favored</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {positions.map(position => (
                  <div key={position}>
                    <div className={`text-sm font-bold mb-2 mt-4 first:mt-0 px-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>{position}</div>
                    <div className="space-y-2">
                      {homePlayersByPosition[position].map((player) => (
                        <div
                          key={player.id}
                          onClick={() => onPlayerClick(player)}
                          className={`rounded-lg p-4 border transition-all cursor-pointer group ${isDarkMode ? 'bg-slate-900 border-slate-700 hover:border-blue-600 hover:shadow-lg hover:shadow-blue-900/10' : 'bg-white border-slate-300 hover:border-blue-500 hover:shadow-md hover:bg-slate-50'}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className={`font-bold transition-colors ${isDarkMode ? 'text-slate-200 group-hover:text-white' : 'text-slate-900 group-hover:text-slate-800'}`}>{player.name}</div>
                              <div className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                                {player.position} • #{player.rank} Overall
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-blue-600">{player.projectedPoints}</div>
                              <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>pts</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className={isDarkMode ? 'text-slate-500' : 'text-slate-600'}>{player.keyLine}</div>
                            <div className={`flex items-center gap-1 ${player.weekChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {player.weekChange >= 0 ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              <span>{player.weekChange >= 0 ? '+' : ''}{player.weekChange}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}