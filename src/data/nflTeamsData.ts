import { Player } from '../App';

// NFL Team Full Names for reference
export const nflTeams = {
  // AFC East
  BUF: 'Buffalo Bills',
  MIA: 'Miami Dolphins',
  NE: 'New England Patriots',
  NYJ: 'New York Jets',
  // AFC North
  BAL: 'Baltimore Ravens',
  CIN: 'Cincinnati Bengals',
  CLE: 'Cleveland Browns',
  PIT: 'Pittsburgh Steelers',
  // AFC South
  HOU: 'Houston Texans',
  IND: 'Indianapolis Colts',
  JAX: 'Jacksonville Jaguars',
  TEN: 'Tennessee Titans',
  // AFC West
  DEN: 'Denver Broncos',
  KC: 'Kansas City Chiefs',
  LV: 'Las Vegas Raiders',
  LAC: 'Los Angeles Chargers',
  // NFC East
  DAL: 'Dallas Cowboys',
  NYG: 'New York Giants',
  PHI: 'Philadelphia Eagles',
  WAS: 'Washington Commanders',
  // NFC North
  CHI: 'Chicago Bears',
  DET: 'Detroit Lions',
  GB: 'Green Bay Packers',
  MIN: 'Minnesota Vikings',
  // NFC South
  ATL: 'Atlanta Falcons',
  CAR: 'Carolina Panthers',
  NO: 'New Orleans Saints',
  TB: 'Tampa Bay Buccaneers',
  // NFC West
  ARI: 'Arizona Cardinals',
  LAR: 'Los Angeles Rams',
  SF: 'San Francisco 49ers',
  SEA: 'Seattle Seahawks',
};

export const nflPlayersData: Player[] = [
  // ==================== AFC EAST ====================
  
  // BUFFALO BILLS
  { id: 'buf-qb1', rank: 2, name: 'Josh Allen', team: 'BUF', position: 'QB', keyLine: 'O/U 265.5 pass yds', projectedPoints: 23.8, weekChange: 1.1 },
  { id: 'buf-rb1', rank: 18, name: 'James Cook', team: 'BUF', position: 'RB', keyLine: 'O/U 72.5 rush+rec', projectedPoints: 14.2, weekChange: 0.8 },
  { id: 'buf-rb2', rank: 89, name: 'Ray Davis', team: 'BUF', position: 'RB', keyLine: 'O/U 38.5 rush+rec', projectedPoints: 7.4, weekChange: -0.3 },
  { id: 'buf-wr1', rank: 22, name: 'Khalil Shakir', team: 'BUF', position: 'WR', keyLine: 'O/U 62.5 rec yds', projectedPoints: 13.1, weekChange: 0.5 },
  { id: 'buf-wr2', rank: 58, name: 'Keon Coleman', team: 'BUF', position: 'WR', keyLine: 'O/U 48.5 rec yds', projectedPoints: 9.8, weekChange: 1.2 },
  { id: 'buf-wr3', rank: 112, name: 'Curtis Samuel', team: 'BUF', position: 'WR', keyLine: 'O/U 32.5 rec yds', projectedPoints: 6.2, weekChange: -0.4 },
  { id: 'buf-te1', rank: 14, name: 'Dalton Kincaid', team: 'BUF', position: 'TE', keyLine: 'O/U 48.5 rec yds', projectedPoints: 11.5, weekChange: 0.3 },
  { id: 'buf-k1', rank: 8, name: 'Tyler Bass', team: 'BUF', position: 'K', keyLine: 'O/U 8.5 pts', projectedPoints: 9.2, weekChange: 0.1 },
  { id: 'buf-def', rank: 6, name: 'Buffalo', team: 'BUF', position: 'DEF', keyLine: 'O/U 2.5 sacks', projectedPoints: 8.4, weekChange: 0.6 },

  // MIAMI DOLPHINS
  { id: 'mia-qb1', rank: 8, name: 'Tua Tagovailoa', team: 'MIA', position: 'QB', keyLine: 'O/U 258.5 pass yds', projectedPoints: 20.4, weekChange: -0.8 },
  { id: 'mia-rb1', rank: 12, name: 'De\'Von Achane', team: 'MIA', position: 'RB', keyLine: 'O/U 82.5 rush+rec', projectedPoints: 16.8, weekChange: 2.1 },
  { id: 'mia-rb2', rank: 78, name: 'Raheem Mostert', team: 'MIA', position: 'RB', keyLine: 'O/U 42.5 rush+rec', projectedPoints: 8.1, weekChange: -0.5 },
  { id: 'mia-wr1', rank: 4, name: 'Tyreek Hill', team: 'MIA', position: 'WR', keyLine: 'O/U 84.5 rec yds', projectedPoints: 16.8, weekChange: -1.2 },
  { id: 'mia-wr2', rank: 15, name: 'Jaylen Waddle', team: 'MIA', position: 'WR', keyLine: 'O/U 68.5 rec yds', projectedPoints: 14.5, weekChange: 0.4 },
  { id: 'mia-wr3', rank: 95, name: 'Odell Beckham Jr.', team: 'MIA', position: 'WR', keyLine: 'O/U 36.5 rec yds', projectedPoints: 7.2, weekChange: 0.1 },
  { id: 'mia-te1', rank: 22, name: 'Jonnu Smith', team: 'MIA', position: 'TE', keyLine: 'O/U 38.5 rec yds', projectedPoints: 9.4, weekChange: 0.7 },
  { id: 'mia-k1', rank: 12, name: 'Jason Sanders', team: 'MIA', position: 'K', keyLine: 'O/U 7.5 pts', projectedPoints: 8.6, weekChange: -0.2 },
  { id: 'mia-def', rank: 18, name: 'Miami', team: 'MIA', position: 'DEF', keyLine: 'O/U 2.5 sacks', projectedPoints: 7.2, weekChange: 0.3 },

  // NEW ENGLAND PATRIOTS
  { id: 'ne-qb1', rank: 28, name: 'Drake Maye', team: 'NE', position: 'QB', keyLine: 'O/U 218.5 pass yds', projectedPoints: 16.2, weekChange: 1.5 },
  { id: 'ne-rb1', rank: 32, name: 'Rhamondre Stevenson', team: 'NE', position: 'RB', keyLine: 'O/U 68.5 rush+rec', projectedPoints: 12.4, weekChange: -0.6 },
  { id: 'ne-rb2', rank: 92, name: 'Antonio Gibson', team: 'NE', position: 'RB', keyLine: 'O/U 42.5 rush+rec', projectedPoints: 7.1, weekChange: 0.2 },
  { id: 'ne-wr1', rank: 52, name: 'DeMario Douglas', team: 'NE', position: 'WR', keyLine: 'O/U 52.5 rec yds', projectedPoints: 10.2, weekChange: 0.8 },
  { id: 'ne-wr2', rank: 88, name: 'Ja\'Lynn Polk', team: 'NE', position: 'WR', keyLine: 'O/U 38.5 rec yds', projectedPoints: 7.5, weekChange: 0.4 },
  { id: 'ne-wr3', rank: 124, name: 'Kendrick Bourne', team: 'NE', position: 'WR', keyLine: 'O/U 28.5 rec yds', projectedPoints: 5.8, weekChange: -0.1 },
  { id: 'ne-te1', rank: 18, name: 'Hunter Henry', team: 'NE', position: 'TE', keyLine: 'O/U 42.5 rec yds', projectedPoints: 10.1, weekChange: 0.5 },
  { id: 'ne-k1', rank: 22, name: 'Joey Slye', team: 'NE', position: 'K', keyLine: 'O/U 6.5 pts', projectedPoints: 7.4, weekChange: -0.3 },
  { id: 'ne-def', rank: 24, name: 'New England', team: 'NE', position: 'DEF', keyLine: 'O/U 2.0 sacks', projectedPoints: 6.5, weekChange: -0.4 },

  // NEW YORK JETS
  { id: 'nyj-qb1', rank: 12, name: 'Aaron Rodgers', team: 'NYJ', position: 'QB', keyLine: 'O/U 248.5 pass yds', projectedPoints: 19.2, weekChange: 0.3 },
  { id: 'nyj-rb1', rank: 6, name: 'Breece Hall', team: 'NYJ', position: 'RB', keyLine: 'O/U 89.5 rush+rec', projectedPoints: 17.2, weekChange: -0.8 },
  { id: 'nyj-rb2', rank: 68, name: 'Braelon Allen', team: 'NYJ', position: 'RB', keyLine: 'O/U 48.5 rush+rec', projectedPoints: 8.8, weekChange: 1.4 },
  { id: 'nyj-wr1', rank: 11, name: 'Garrett Wilson', team: 'NYJ', position: 'WR', keyLine: 'O/U 74.5 rec yds', projectedPoints: 15.3, weekChange: 0.6 },
  { id: 'nyj-wr2', rank: 38, name: 'Davante Adams', team: 'NYJ', position: 'WR', keyLine: 'O/U 62.5 rec yds', projectedPoints: 12.4, weekChange: -0.5 },
  { id: 'nyj-wr3', rank: 82, name: 'Allen Lazard', team: 'NYJ', position: 'WR', keyLine: 'O/U 38.5 rec yds', projectedPoints: 7.8, weekChange: 0.2 },
  { id: 'nyj-te1', rank: 24, name: 'Tyler Conklin', team: 'NYJ', position: 'TE', keyLine: 'O/U 34.5 rec yds', projectedPoints: 8.9, weekChange: -0.2 },
  { id: 'nyj-k1', rank: 15, name: 'Greg Zuerlein', team: 'NYJ', position: 'K', keyLine: 'O/U 7.5 pts', projectedPoints: 8.2, weekChange: 0.1 },
  { id: 'nyj-def', rank: 8, name: 'New York Jets', team: 'NYJ', position: 'DEF', keyLine: 'O/U 3.0 sacks', projectedPoints: 8.1, weekChange: 0.5 },

  // ==================== AFC NORTH ====================

  // BALTIMORE RAVENS
  { id: 'bal-qb1', rank: 3, name: 'Lamar Jackson', team: 'BAL', position: 'QB', keyLine: 'O/U 242.5 pass yds', projectedPoints: 22.9, weekChange: 0.4 },
  { id: 'bal-rb1', rank: 5, name: 'Derrick Henry', team: 'BAL', position: 'RB', keyLine: 'O/U 92.5 rush+rec', projectedPoints: 17.5, weekChange: 1.2 },
  { id: 'bal-rb2', rank: 72, name: 'Justice Hill', team: 'BAL', position: 'RB', keyLine: 'O/U 38.5 rush+rec', projectedPoints: 8.4, weekChange: 0.3 },
  { id: 'bal-wr1', rank: 19, name: 'Zay Flowers', team: 'BAL', position: 'WR', keyLine: 'O/U 68.5 rec yds', projectedPoints: 13.8, weekChange: 0.9 },
  { id: 'bal-wr2', rank: 56, name: 'Rashod Bateman', team: 'BAL', position: 'WR', keyLine: 'O/U 48.5 rec yds', projectedPoints: 9.9, weekChange: -0.3 },
  { id: 'bal-wr3', rank: 98, name: 'Nelson Agholor', team: 'BAL', position: 'WR', keyLine: 'O/U 32.5 rec yds', projectedPoints: 7.0, weekChange: 0.1 },
  { id: 'bal-te1', rank: 8, name: 'Mark Andrews', team: 'BAL', position: 'TE', keyLine: 'O/U 52.5 rec yds', projectedPoints: 12.4, weekChange: 0.6 },
  { id: 'bal-k1', rank: 1, name: 'Justin Tucker', team: 'BAL', position: 'K', keyLine: 'O/U 8.5 pts', projectedPoints: 9.8, weekChange: 0.2 },
  { id: 'bal-def', rank: 4, name: 'Baltimore', team: 'BAL', position: 'DEF', keyLine: 'O/U 3.0 sacks', projectedPoints: 8.8, weekChange: 0.7 },

  // CINCINNATI BENGALS
  { id: 'cin-qb1', rank: 5, name: 'Joe Burrow', team: 'CIN', position: 'QB', keyLine: 'O/U 278.5 pass yds', projectedPoints: 22.4, weekChange: 1.8 },
  { id: 'cin-rb1', rank: 24, name: 'Chase Brown', team: 'CIN', position: 'RB', keyLine: 'O/U 72.5 rush+rec', projectedPoints: 13.6, weekChange: 2.4 },
  { id: 'cin-rb2', rank: 85, name: 'Zack Moss', team: 'CIN', position: 'RB', keyLine: 'O/U 38.5 rush+rec', projectedPoints: 7.6, weekChange: -0.8 },
  { id: 'cin-wr1', rank: 1, name: 'Ja\'Marr Chase', team: 'CIN', position: 'WR', keyLine: 'O/U 96.5 rec yds', projectedPoints: 19.4, weekChange: 2.4 },
  { id: 'cin-wr2', rank: 21, name: 'Tee Higgins', team: 'CIN', position: 'WR', keyLine: 'O/U 72.5 rec yds', projectedPoints: 13.2, weekChange: 0.8 },
  { id: 'cin-wr3', rank: 78, name: 'Andrei Iosivas', team: 'CIN', position: 'WR', keyLine: 'O/U 38.5 rec yds', projectedPoints: 8.0, weekChange: 0.5 },
  { id: 'cin-te1', rank: 28, name: 'Mike Gesicki', team: 'CIN', position: 'TE', keyLine: 'O/U 32.5 rec yds', projectedPoints: 8.2, weekChange: -0.1 },
  { id: 'cin-k1', rank: 10, name: 'Evan McPherson', team: 'CIN', position: 'K', keyLine: 'O/U 8.0 pts', projectedPoints: 8.9, weekChange: 0.3 },
  { id: 'cin-def', rank: 20, name: 'Cincinnati', team: 'CIN', position: 'DEF', keyLine: 'O/U 2.0 sacks', projectedPoints: 7.0, weekChange: -0.2 },

  // CLEVELAND BROWNS
  { id: 'cle-qb1', rank: 22, name: 'Deshaun Watson', team: 'CLE', position: 'QB', keyLine: 'O/U 228.5 pass yds', projectedPoints: 17.4, weekChange: -1.2 },
  { id: 'cle-rb1', rank: 16, name: 'Nick Chubb', team: 'CLE', position: 'RB', keyLine: 'O/U 78.5 rush+rec', projectedPoints: 14.8, weekChange: 0.6 },
  { id: 'cle-rb2', rank: 62, name: 'Jerome Ford', team: 'CLE', position: 'RB', keyLine: 'O/U 52.5 rush+rec', projectedPoints: 9.2, weekChange: -0.4 },
  { id: 'cle-wr1', rank: 28, name: 'Amari Cooper', team: 'CLE', position: 'WR', keyLine: 'O/U 62.5 rec yds', projectedPoints: 12.6, weekChange: -0.3 },
  { id: 'cle-wr2', rank: 64, name: 'Jerry Jeudy', team: 'CLE', position: 'WR', keyLine: 'O/U 52.5 rec yds', projectedPoints: 9.4, weekChange: 0.7 },
  { id: 'cle-wr3', rank: 108, name: 'Elijah Moore', team: 'CLE', position: 'WR', keyLine: 'O/U 34.5 rec yds', projectedPoints: 6.5, weekChange: 0.2 },
  { id: 'cle-te1', rank: 12, name: 'David Njoku', team: 'CLE', position: 'TE', keyLine: 'O/U 48.5 rec yds', projectedPoints: 11.8, weekChange: 0.4 },
  { id: 'cle-k1', rank: 18, name: 'Dustin Hopkins', team: 'CLE', position: 'K', keyLine: 'O/U 7.5 pts', projectedPoints: 8.0, weekChange: 0.1 },
  { id: 'cle-def', rank: 3, name: 'Cleveland', team: 'CLE', position: 'DEF', keyLine: 'O/U 3.0 sacks', projectedPoints: 9.0, weekChange: 0.8 },

  // PITTSBURGH STEELERS
  { id: 'pit-qb1', rank: 18, name: 'Russell Wilson', team: 'PIT', position: 'QB', keyLine: 'O/U 238.5 pass yds', projectedPoints: 18.2, weekChange: 0.9 },
  { id: 'pit-rb1', rank: 14, name: 'Najee Harris', team: 'PIT', position: 'RB', keyLine: 'O/U 76.5 rush+rec', projectedPoints: 15.1, weekChange: 0.4 },
  { id: 'pit-rb2', rank: 48, name: 'Jaylen Warren', team: 'PIT', position: 'RB', keyLine: 'O/U 58.5 rush+rec', projectedPoints: 10.8, weekChange: 0.6 },
  { id: 'pit-wr1', rank: 24, name: 'George Pickens', team: 'PIT', position: 'WR', keyLine: 'O/U 68.5 rec yds', projectedPoints: 12.9, weekChange: 1.1 },
  { id: 'pit-wr2', rank: 72, name: 'Van Jefferson', team: 'PIT', position: 'WR', keyLine: 'O/U 42.5 rec yds', projectedPoints: 8.2, weekChange: -0.2 },
  { id: 'pit-wr3', rank: 102, name: 'Calvin Austin III', team: 'PIT', position: 'WR', keyLine: 'O/U 32.5 rec yds', projectedPoints: 6.8, weekChange: 0.3 },
  { id: 'pit-te1', rank: 16, name: 'Pat Freiermuth', team: 'PIT', position: 'TE', keyLine: 'O/U 44.5 rec yds', projectedPoints: 10.4, weekChange: 0.2 },
  { id: 'pit-k1', rank: 6, name: 'Chris Boswell', team: 'PIT', position: 'K', keyLine: 'O/U 8.5 pts', projectedPoints: 9.4, weekChange: 0.4 },
  { id: 'pit-def', rank: 2, name: 'Pittsburgh', team: 'PIT', position: 'DEF', keyLine: 'O/U 3.5 sacks', projectedPoints: 9.2, weekChange: 0.5 },

  // ==================== AFC SOUTH ====================

  // HOUSTON TEXANS
  { id: 'hou-qb1', rank: 6, name: 'C.J. Stroud', team: 'HOU', position: 'QB', keyLine: 'O/U 268.5 pass yds', projectedPoints: 21.8, weekChange: 1.4 },
  { id: 'hou-rb1', rank: 22, name: 'Joe Mixon', team: 'HOU', position: 'RB', keyLine: 'O/U 78.5 rush+rec', projectedPoints: 13.8, weekChange: 0.2 },
  { id: 'hou-rb2', rank: 75, name: 'Dameon Pierce', team: 'HOU', position: 'RB', keyLine: 'O/U 42.5 rush+rec', projectedPoints: 8.2, weekChange: -0.6 },
  { id: 'hou-wr1', rank: 8, name: 'Nico Collins', team: 'HOU', position: 'WR', keyLine: 'O/U 82.5 rec yds', projectedPoints: 15.8, weekChange: 1.8 },
  { id: 'hou-wr2', rank: 32, name: 'Stefon Diggs', team: 'HOU', position: 'WR', keyLine: 'O/U 62.5 rec yds', projectedPoints: 12.2, weekChange: -0.4 },
  { id: 'hou-wr3', rank: 54, name: 'Tank Dell', team: 'HOU', position: 'WR', keyLine: 'O/U 52.5 rec yds', projectedPoints: 10.1, weekChange: 0.9 },
  { id: 'hou-te1', rank: 20, name: 'Dalton Schultz', team: 'HOU', position: 'TE', keyLine: 'O/U 38.5 rec yds', projectedPoints: 9.6, weekChange: 0.3 },
  { id: 'hou-k1', rank: 14, name: 'Ka\'imi Fairbairn', team: 'HOU', position: 'K', keyLine: 'O/U 8.0 pts', projectedPoints: 8.4, weekChange: 0.2 },
  { id: 'hou-def', rank: 10, name: 'Houston', team: 'HOU', position: 'DEF', keyLine: 'O/U 2.5 sacks', projectedPoints: 7.9, weekChange: 0.4 },

  // INDIANAPOLIS COLTS
  { id: 'ind-qb1', rank: 15, name: 'Anthony Richardson', team: 'IND', position: 'QB', keyLine: 'O/U 218.5 pass yds', projectedPoints: 19.4, weekChange: -0.8 },
  { id: 'ind-rb1', rank: 10, name: 'Jonathan Taylor', team: 'IND', position: 'RB', keyLine: 'O/U 88.5 rush+rec', projectedPoints: 16.2, weekChange: 0.5 },
  { id: 'ind-rb2', rank: 82, name: 'Trey Sermon', team: 'IND', position: 'RB', keyLine: 'O/U 38.5 rush+rec', projectedPoints: 7.8, weekChange: 0.1 },
  { id: 'ind-wr1', rank: 36, name: 'Michael Pittman Jr.', team: 'IND', position: 'WR', keyLine: 'O/U 58.5 rec yds', projectedPoints: 12.0, weekChange: 0.2 },
  { id: 'ind-wr2', rank: 68, name: 'Josh Downs', team: 'IND', position: 'WR', keyLine: 'O/U 48.5 rec yds', projectedPoints: 9.1, weekChange: 1.2 },
  { id: 'ind-wr3', rank: 105, name: 'Adonai Mitchell', team: 'IND', position: 'WR', keyLine: 'O/U 34.5 rec yds', projectedPoints: 6.6, weekChange: 0.8 },
  { id: 'ind-te1', rank: 26, name: 'Mo Alie-Cox', team: 'IND', position: 'TE', keyLine: 'O/U 32.5 rec yds', projectedPoints: 8.5, weekChange: -0.2 },
  { id: 'ind-k1', rank: 20, name: 'Matt Gay', team: 'IND', position: 'K', keyLine: 'O/U 7.5 pts', projectedPoints: 7.8, weekChange: 0.1 },
  { id: 'ind-def', rank: 16, name: 'Indianapolis', team: 'IND', position: 'DEF', keyLine: 'O/U 2.0 sacks', projectedPoints: 7.4, weekChange: -0.3 },

  // JACKSONVILLE JAGUARS
  { id: 'jax-qb1', rank: 14, name: 'Trevor Lawrence', team: 'JAX', position: 'QB', keyLine: 'O/U 252.5 pass yds', projectedPoints: 19.6, weekChange: 0.6 },
  { id: 'jax-rb1', rank: 20, name: 'Travis Etienne Jr.', team: 'JAX', position: 'RB', keyLine: 'O/U 76.5 rush+rec', projectedPoints: 14.4, weekChange: -0.4 },
  { id: 'jax-rb2', rank: 76, name: 'Tank Bigsby', team: 'JAX', position: 'RB', keyLine: 'O/U 48.5 rush+rec', projectedPoints: 8.2, weekChange: 0.9 },
  { id: 'jax-wr1', rank: 42, name: 'Brian Thomas Jr.', team: 'JAX', position: 'WR', keyLine: 'O/U 62.5 rec yds', projectedPoints: 11.5, weekChange: 1.6 },
  { id: 'jax-wr2', rank: 48, name: 'Christian Kirk', team: 'JAX', position: 'WR', keyLine: 'O/U 54.5 rec yds', projectedPoints: 10.6, weekChange: 0.3 },
  { id: 'jax-wr3', rank: 86, name: 'Gabe Davis', team: 'JAX', position: 'WR', keyLine: 'O/U 42.5 rec yds', projectedPoints: 7.5, weekChange: -0.5 },
  { id: 'jax-te1', rank: 10, name: 'Evan Engram', team: 'JAX', position: 'TE', keyLine: 'O/U 52.5 rec yds', projectedPoints: 12.1, weekChange: 0.4 },
  { id: 'jax-k1', rank: 24, name: 'Cam Little', team: 'JAX', position: 'K', keyLine: 'O/U 7.0 pts', projectedPoints: 7.2, weekChange: -0.2 },
  { id: 'jax-def', rank: 22, name: 'Jacksonville', team: 'JAX', position: 'DEF', keyLine: 'O/U 2.0 sacks', projectedPoints: 6.8, weekChange: 0.1 },

  // TENNESSEE TITANS
  { id: 'ten-qb1', rank: 24, name: 'Will Levis', team: 'TEN', position: 'QB', keyLine: 'O/U 222.5 pass yds', projectedPoints: 17.0, weekChange: -0.6 },
  { id: 'ten-rb1', rank: 26, name: 'Tony Pollard', team: 'TEN', position: 'RB', keyLine: 'O/U 72.5 rush+rec', projectedPoints: 13.4, weekChange: 0.8 },
  { id: 'ten-rb2', rank: 80, name: 'Tyjae Spears', team: 'TEN', position: 'RB', keyLine: 'O/U 48.5 rush+rec', projectedPoints: 7.9, weekChange: 0.4 },
  { id: 'ten-wr1', rank: 34, name: 'DeAndre Hopkins', team: 'TEN', position: 'WR', keyLine: 'O/U 58.5 rec yds', projectedPoints: 12.1, weekChange: 0.2 },
  { id: 'ten-wr2', rank: 62, name: 'Calvin Ridley', team: 'TEN', position: 'WR', keyLine: 'O/U 52.5 rec yds', projectedPoints: 9.5, weekChange: -0.8 },
  { id: 'ten-wr3', rank: 96, name: 'Treylon Burks', team: 'TEN', position: 'WR', keyLine: 'O/U 38.5 rec yds', projectedPoints: 7.1, weekChange: 0.3 },
  { id: 'ten-te1', rank: 30, name: 'Chigoziem Okonkwo', team: 'TEN', position: 'TE', keyLine: 'O/U 34.5 rec yds', projectedPoints: 8.0, weekChange: 0.5 },
  { id: 'ten-k1', rank: 26, name: 'Nick Folk', team: 'TEN', position: 'K', keyLine: 'O/U 7.0 pts', projectedPoints: 7.0, weekChange: -0.1 },
  { id: 'ten-def', rank: 26, name: 'Tennessee', team: 'TEN', position: 'DEF', keyLine: 'O/U 2.0 sacks', projectedPoints: 6.4, weekChange: -0.4 },

  // ==================== AFC WEST ====================

  // DENVER BRONCOS
  { id: 'den-qb1', rank: 20, name: 'Bo Nix', team: 'DEN', position: 'QB', keyLine: 'O/U 232.5 pass yds', projectedPoints: 17.8, weekChange: 1.2 },
  { id: 'den-rb1', rank: 28, name: 'Javonte Williams', team: 'DEN', position: 'RB', keyLine: 'O/U 68.5 rush+rec', projectedPoints: 13.0, weekChange: 0.3 },
  { id: 'den-rb2', rank: 70, name: 'Jaleel McLaughlin', team: 'DEN', position: 'RB', keyLine: 'O/U 48.5 rush+rec', projectedPoints: 8.6, weekChange: 0.7 },
  { id: 'den-wr1', rank: 40, name: 'Courtland Sutton', team: 'DEN', position: 'WR', keyLine: 'O/U 58.5 rec yds', projectedPoints: 11.6, weekChange: 0.4 },
  { id: 'den-wr2', rank: 74, name: 'Marvin Mims Jr.', team: 'DEN', position: 'WR', keyLine: 'O/U 44.5 rec yds', projectedPoints: 8.1, weekChange: 0.9 },
  { id: 'den-wr3', rank: 110, name: 'Troy Franklin', team: 'DEN', position: 'WR', keyLine: 'O/U 32.5 rec yds', projectedPoints: 6.4, weekChange: 0.6 },
  { id: 'den-te1', rank: 32, name: 'Adam Trautman', team: 'DEN', position: 'TE', keyLine: 'O/U 28.5 rec yds', projectedPoints: 7.6, weekChange: 0.1 },
  { id: 'den-k1', rank: 16, name: 'Wil Lutz', team: 'DEN', position: 'K', keyLine: 'O/U 7.5 pts', projectedPoints: 8.1, weekChange: 0.2 },
  { id: 'den-def', rank: 12, name: 'Denver', team: 'DEN', position: 'DEF', keyLine: 'O/U 2.5 sacks', projectedPoints: 7.8, weekChange: 0.6 },

  // KANSAS CITY CHIEFS
  { id: 'kc-qb1', rank: 1, name: 'Patrick Mahomes', team: 'KC', position: 'QB', keyLine: 'O/U 287.5 pass yds', projectedPoints: 24.3, weekChange: 0.7 },
  { id: 'kc-rb1', rank: 30, name: 'Isiah Pacheco', team: 'KC', position: 'RB', keyLine: 'O/U 68.5 rush+rec', projectedPoints: 12.8, weekChange: 0.4 },
  { id: 'kc-rb2', rank: 88, name: 'Clyde Edwards-Helaire', team: 'KC', position: 'RB', keyLine: 'O/U 38.5 rush+rec', projectedPoints: 7.4, weekChange: -0.2 },
  { id: 'kc-wr1', rank: 26, name: 'Rashee Rice', team: 'KC', position: 'WR', keyLine: 'O/U 68.5 rec yds', projectedPoints: 12.8, weekChange: 1.4 },
  { id: 'kc-wr2', rank: 60, name: 'Xavier Worthy', team: 'KC', position: 'WR', keyLine: 'O/U 52.5 rec yds', projectedPoints: 9.7, weekChange: 1.8 },
  { id: 'kc-wr3', rank: 92, name: 'JuJu Smith-Schuster', team: 'KC', position: 'WR', keyLine: 'O/U 38.5 rec yds', projectedPoints: 7.2, weekChange: -0.3 },
  { id: 'kc-te1', rank: 2, name: 'Travis Kelce', team: 'KC', position: 'TE', keyLine: 'O/U 62.5 rec yds', projectedPoints: 14.2, weekChange: -0.3 },
  { id: 'kc-k1', rank: 4, name: 'Harrison Butker', team: 'KC', position: 'K', keyLine: 'O/U 9.0 pts', projectedPoints: 9.6, weekChange: 0.3 },
  { id: 'kc-def', rank: 5, name: 'Kansas City', team: 'KC', position: 'DEF', keyLine: 'O/U 2.5 sacks', projectedPoints: 8.6, weekChange: 0.4 },

  // LAS VEGAS RAIDERS
  { id: 'lv-qb1', rank: 26, name: 'Aidan O\'Connell', team: 'LV', position: 'QB', keyLine: 'O/U 218.5 pass yds', projectedPoints: 16.4, weekChange: -0.4 },
  { id: 'lv-rb1', rank: 34, name: 'Zamir White', team: 'LV', position: 'RB', keyLine: 'O/U 62.5 rush+rec', projectedPoints: 12.0, weekChange: 0.6 },
  { id: 'lv-rb2', rank: 84, name: 'Alexander Mattison', team: 'LV', position: 'RB', keyLine: 'O/U 42.5 rush+rec', projectedPoints: 7.6, weekChange: -0.3 },
  { id: 'lv-wr1', rank: 30, name: 'Davante Adams', team: 'LV', position: 'WR', keyLine: 'O/U 68.5 rec yds', projectedPoints: 12.4, weekChange: -0.6 },
  { id: 'lv-wr2', rank: 66, name: 'Jakobi Meyers', team: 'LV', position: 'WR', keyLine: 'O/U 52.5 rec yds', projectedPoints: 9.2, weekChange: 0.3 },
  { id: 'lv-wr3', rank: 100, name: 'Tre Tucker', team: 'LV', position: 'WR', keyLine: 'O/U 34.5 rec yds', projectedPoints: 6.9, weekChange: 0.5 },
  { id: 'lv-te1', rank: 15, name: 'Brock Bowers', team: 'LV', position: 'TE', keyLine: 'O/U 52.5 rec yds', projectedPoints: 11.2, weekChange: 1.6 },
  { id: 'lv-k1', rank: 28, name: 'Daniel Carlson', team: 'LV', position: 'K', keyLine: 'O/U 7.0 pts', projectedPoints: 6.8, weekChange: -0.2 },
  { id: 'lv-def', rank: 28, name: 'Las Vegas', team: 'LV', position: 'DEF', keyLine: 'O/U 1.5 sacks', projectedPoints: 6.2, weekChange: -0.5 },

  // LOS ANGELES CHARGERS
  { id: 'lac-qb1', rank: 10, name: 'Justin Herbert', team: 'LAC', position: 'QB', keyLine: 'O/U 262.5 pass yds', projectedPoints: 20.8, weekChange: 0.5 },
  { id: 'lac-rb1', rank: 36, name: 'J.K. Dobbins', team: 'LAC', position: 'RB', keyLine: 'O/U 68.5 rush+rec', projectedPoints: 11.8, weekChange: 1.2 },
  { id: 'lac-rb2', rank: 74, name: 'Gus Edwards', team: 'LAC', position: 'RB', keyLine: 'O/U 48.5 rush+rec', projectedPoints: 8.3, weekChange: -0.1 },
  { id: 'lac-wr1', rank: 46, name: 'Ladd McConkey', team: 'LAC', position: 'WR', keyLine: 'O/U 58.5 rec yds', projectedPoints: 10.8, weekChange: 1.4 },
  { id: 'lac-wr2', rank: 70, name: 'Quentin Johnston', team: 'LAC', position: 'WR', keyLine: 'O/U 48.5 rec yds', projectedPoints: 8.8, weekChange: 0.8 },
  { id: 'lac-wr3', rank: 104, name: 'Joshua Palmer', team: 'LAC', position: 'WR', keyLine: 'O/U 36.5 rec yds', projectedPoints: 6.7, weekChange: -0.2 },
  { id: 'lac-te1', rank: 34, name: 'Will Dissly', team: 'LAC', position: 'TE', keyLine: 'O/U 28.5 rec yds', projectedPoints: 7.4, weekChange: 0.2 },
  { id: 'lac-k1', rank: 11, name: 'Cameron Dicker', team: 'LAC', position: 'K', keyLine: 'O/U 8.0 pts', projectedPoints: 8.8, weekChange: 0.4 },
  { id: 'lac-def', rank: 14, name: 'Los Angeles Chargers', team: 'LAC', position: 'DEF', keyLine: 'O/U 2.5 sacks', projectedPoints: 7.6, weekChange: 0.3 },

  // ==================== NFC EAST ====================

  // DALLAS COWBOYS
  { id: 'dal-qb1', rank: 7, name: 'Dak Prescott', team: 'DAL', position: 'QB', keyLine: 'O/U 272.5 pass yds', projectedPoints: 21.4, weekChange: 0.8 },
  { id: 'dal-rb1', rank: 38, name: 'Rico Dowdle', team: 'DAL', position: 'RB', keyLine: 'O/U 62.5 rush+rec', projectedPoints: 11.6, weekChange: 1.0 },
  { id: 'dal-rb2', rank: 86, name: 'Ezekiel Elliott', team: 'DAL', position: 'RB', keyLine: 'O/U 38.5 rush+rec', projectedPoints: 7.5, weekChange: -0.4 },
  { id: 'dal-wr1', rank: 2, name: 'CeeDee Lamb', team: 'DAL', position: 'WR', keyLine: 'O/U 88.5 rec yds', projectedPoints: 18.7, weekChange: 3.1 },
  { id: 'dal-wr2', rank: 44, name: 'Brandin Cooks', team: 'DAL', position: 'WR', keyLine: 'O/U 52.5 rec yds', projectedPoints: 10.9, weekChange: 0.4 },
  { id: 'dal-wr3', rank: 90, name: 'Jalen Tolbert', team: 'DAL', position: 'WR', keyLine: 'O/U 38.5 rec yds', projectedPoints: 7.3, weekChange: 0.6 },
  { id: 'dal-te1', rank: 6, name: 'Jake Ferguson', team: 'DAL', position: 'TE', keyLine: 'O/U 48.5 rec yds', projectedPoints: 12.6, weekChange: 0.5 },
  { id: 'dal-k1', rank: 2, name: 'Brandon Aubrey', team: 'DAL', position: 'K', keyLine: 'O/U 9.5 pts', projectedPoints: 10.2, weekChange: 0.5 },
  { id: 'dal-def', rank: 7, name: 'Dallas', team: 'DAL', position: 'DEF', keyLine: 'O/U 2.5 sacks', projectedPoints: 8.2, weekChange: 0.2 },

  // NEW YORK GIANTS
  { id: 'nyg-qb1', rank: 30, name: 'Daniel Jones', team: 'NYG', position: 'QB', keyLine: 'O/U 212.5 pass yds', projectedPoints: 15.8, weekChange: -0.8 },
  { id: 'nyg-rb1', rank: 40, name: 'Devin Singletary', team: 'NYG', position: 'RB', keyLine: 'O/U 62.5 rush+rec', projectedPoints: 11.4, weekChange: 0.2 },
  { id: 'nyg-rb2', rank: 90, name: 'Tyrone Tracy Jr.', team: 'NYG', position: 'RB', keyLine: 'O/U 42.5 rush+rec', projectedPoints: 7.2, weekChange: 1.1 },
  { id: 'nyg-wr1', rank: 50, name: 'Malik Nabers', team: 'NYG', position: 'WR', keyLine: 'O/U 62.5 rec yds', projectedPoints: 10.4, weekChange: 2.2 },
  { id: 'nyg-wr2', rank: 76, name: 'Darius Slayton', team: 'NYG', position: 'WR', keyLine: 'O/U 44.5 rec yds', projectedPoints: 8.0, weekChange: -0.2 },
  { id: 'nyg-wr3', rank: 114, name: 'Wan\'Dale Robinson', team: 'NYG', position: 'WR', keyLine: 'O/U 32.5 rec yds', projectedPoints: 6.1, weekChange: 0.4 },
  { id: 'nyg-te1', rank: 36, name: 'Darren Waller', team: 'NYG', position: 'TE', keyLine: 'O/U 32.5 rec yds', projectedPoints: 7.2, weekChange: -0.4 },
  { id: 'nyg-k1', rank: 30, name: 'Graham Gano', team: 'NYG', position: 'K', keyLine: 'O/U 6.5 pts', projectedPoints: 6.6, weekChange: -0.3 },
  { id: 'nyg-def', rank: 30, name: 'New York Giants', team: 'NYG', position: 'DEF', keyLine: 'O/U 1.5 sacks', projectedPoints: 6.0, weekChange: -0.6 },

  // PHILADELPHIA EAGLES
  { id: 'phi-qb1', rank: 4, name: 'Jalen Hurts', team: 'PHI', position: 'QB', keyLine: 'O/U 248.5 pass yds', projectedPoints: 22.1, weekChange: 0.9 },
  { id: 'phi-rb1', rank: 3, name: 'Saquon Barkley', team: 'PHI', position: 'RB', keyLine: 'O/U 92.5 rush+rec', projectedPoints: 17.8, weekChange: 1.4 },
  { id: 'phi-rb2', rank: 64, name: 'Kenneth Gainwell', team: 'PHI', position: 'RB', keyLine: 'O/U 48.5 rush+rec', projectedPoints: 9.0, weekChange: 0.3 },
  { id: 'phi-wr1', rank: 6, name: 'A.J. Brown', team: 'PHI', position: 'WR', keyLine: 'O/U 82.5 rec yds', projectedPoints: 16.2, weekChange: 1.5 },
  { id: 'phi-wr2', rank: 16, name: 'DeVonta Smith', team: 'PHI', position: 'WR', keyLine: 'O/U 72.5 rec yds', projectedPoints: 14.2, weekChange: 0.8 },
  { id: 'phi-wr3', rank: 84, name: 'Jahan Dotson', team: 'PHI', position: 'WR', keyLine: 'O/U 38.5 rec yds', projectedPoints: 7.6, weekChange: 0.4 },
  { id: 'phi-te1', rank: 11, name: 'Dallas Goedert', team: 'PHI', position: 'TE', keyLine: 'O/U 48.5 rec yds', projectedPoints: 11.9, weekChange: 0.6 },
  { id: 'phi-k1', rank: 7, name: 'Jake Elliott', team: 'PHI', position: 'K', keyLine: 'O/U 8.5 pts', projectedPoints: 9.3, weekChange: 0.2 },
  { id: 'phi-def', rank: 9, name: 'Philadelphia', team: 'PHI', position: 'DEF', keyLine: 'O/U 2.5 sacks', projectedPoints: 8.0, weekChange: 0.5 },

  // WASHINGTON COMMANDERS
  { id: 'was-qb1', rank: 16, name: 'Jayden Daniels', team: 'WAS', position: 'QB', keyLine: 'O/U 238.5 pass yds', projectedPoints: 19.0, weekChange: 2.4 },
  { id: 'was-rb1', rank: 42, name: 'Brian Robinson Jr.', team: 'WAS', position: 'RB', keyLine: 'O/U 68.5 rush+rec', projectedPoints: 11.2, weekChange: 0.5 },
  { id: 'was-rb2', rank: 78, name: 'Austin Ekeler', team: 'WAS', position: 'RB', keyLine: 'O/U 52.5 rush+rec', projectedPoints: 8.0, weekChange: -0.6 },
  { id: 'was-wr1', rank: 18, name: 'Terry McLaurin', team: 'WAS', position: 'WR', keyLine: 'O/U 72.5 rec yds', projectedPoints: 13.9, weekChange: 1.2 },
  { id: 'was-wr2', rank: 80, name: 'Jahan Dotson', team: 'WAS', position: 'WR', keyLine: 'O/U 42.5 rec yds', projectedPoints: 7.9, weekChange: 0.3 },
  { id: 'was-wr3', rank: 118, name: 'Dyami Brown', team: 'WAS', position: 'WR', keyLine: 'O/U 28.5 rec yds', projectedPoints: 5.8, weekChange: 0.2 },
  { id: 'was-te1', rank: 38, name: 'Zach Ertz', team: 'WAS', position: 'TE', keyLine: 'O/U 34.5 rec yds', projectedPoints: 7.0, weekChange: -0.1 },
  { id: 'was-k1', rank: 19, name: 'Austin Seibert', team: 'WAS', position: 'K', keyLine: 'O/U 7.5 pts', projectedPoints: 7.9, weekChange: 0.3 },
  { id: 'was-def', rank: 19, name: 'Washington', team: 'WAS', position: 'DEF', keyLine: 'O/U 2.0 sacks', projectedPoints: 7.1, weekChange: 0.2 },

  // ==================== NFC NORTH ====================

  // CHICAGO BEARS
  { id: 'chi-qb1', rank: 17, name: 'Caleb Williams', team: 'CHI', position: 'QB', keyLine: 'O/U 242.5 pass yds', projectedPoints: 18.6, weekChange: 1.8 },
  { id: 'chi-rb1', rank: 44, name: "D'Andre Swift", team: 'CHI', position: 'RB', keyLine: 'O/U 68.5 rush+rec', projectedPoints: 11.0, weekChange: 0.4 },
  { id: 'chi-rb2', rank: 94, name: 'Roschon Johnson', team: 'CHI', position: 'RB', keyLine: 'O/U 38.5 rush+rec', projectedPoints: 7.0, weekChange: 0.1 },
  { id: 'chi-wr1', rank: 12, name: 'DJ Moore', team: 'CHI', position: 'WR', keyLine: 'O/U 72.5 rec yds', projectedPoints: 15.0, weekChange: 0.6 },
  { id: 'chi-wr2', rank: 38, name: 'Keenan Allen', team: 'CHI', position: 'WR', keyLine: 'O/U 58.5 rec yds', projectedPoints: 11.8, weekChange: -0.2 },
  { id: 'chi-wr3', rank: 58, name: 'Rome Odunze', team: 'CHI', position: 'WR', keyLine: 'O/U 52.5 rec yds', projectedPoints: 9.8, weekChange: 1.4 },
  { id: 'chi-te1', rank: 19, name: 'Cole Kmet', team: 'CHI', position: 'TE', keyLine: 'O/U 42.5 rec yds', projectedPoints: 9.8, weekChange: 0.4 },
  { id: 'chi-k1', rank: 21, name: 'Cairo Santos', team: 'CHI', position: 'K', keyLine: 'O/U 7.5 pts', projectedPoints: 7.6, weekChange: 0.1 },
  { id: 'chi-def', rank: 15, name: 'Chicago', team: 'CHI', position: 'DEF', keyLine: 'O/U 2.5 sacks', projectedPoints: 7.5, weekChange: 0.4 },

  // DETROIT LIONS
  { id: 'det-qb1', rank: 9, name: 'Jared Goff', team: 'DET', position: 'QB', keyLine: 'O/U 268.5 pass yds', projectedPoints: 20.6, weekChange: 0.4 },
  { id: 'det-rb1', rank: 8, name: 'Jahmyr Gibbs', team: 'DET', position: 'RB', keyLine: 'O/U 82.5 rush+rec', projectedPoints: 15.7, weekChange: 1.2 },
  { id: 'det-rb2', rank: 15, name: 'David Montgomery', team: 'DET', position: 'RB', keyLine: 'O/U 72.5 rush+rec', projectedPoints: 14.9, weekChange: 0.6 },
  { id: 'det-wr1', rank: 5, name: 'Amon-Ra St. Brown', team: 'DET', position: 'WR', keyLine: 'O/U 84.5 rec yds', projectedPoints: 17.6, weekChange: 0.3 },
  { id: 'det-wr2', rank: 52, name: 'Jameson Williams', team: 'DET', position: 'WR', keyLine: 'O/U 54.5 rec yds', projectedPoints: 10.2, weekChange: 1.6 },
  { id: 'det-wr3', rank: 94, name: 'Kalif Raymond', team: 'DET', position: 'WR', keyLine: 'O/U 34.5 rec yds', projectedPoints: 7.1, weekChange: 0.2 },
  { id: 'det-te1', rank: 4, name: 'Sam LaPorta', team: 'DET', position: 'TE', keyLine: 'O/U 52.5 rec yds', projectedPoints: 13.8, weekChange: 0.5 },
  { id: 'det-k1', rank: 9, name: 'Jake Bates', team: 'DET', position: 'K', keyLine: 'O/U 8.5 pts', projectedPoints: 9.0, weekChange: 0.3 },
  { id: 'det-def', rank: 11, name: 'Detroit', team: 'DET', position: 'DEF', keyLine: 'O/U 2.5 sacks', projectedPoints: 7.9, weekChange: 0.4 },

  // GREEN BAY PACKERS
  { id: 'gb-qb1', rank: 11, name: 'Jordan Love', team: 'GB', position: 'QB', keyLine: 'O/U 258.5 pass yds', projectedPoints: 20.2, weekChange: 0.8 },
  { id: 'gb-rb1', rank: 19, name: 'Josh Jacobs', team: 'GB', position: 'RB', keyLine: 'O/U 78.5 rush+rec', projectedPoints: 14.5, weekChange: 0.9 },
  { id: 'gb-rb2', rank: 66, name: 'AJ Dillon', team: 'GB', position: 'RB', keyLine: 'O/U 48.5 rush+rec', projectedPoints: 8.9, weekChange: -0.2 },
  { id: 'gb-wr1', rank: 14, name: 'Jayden Reed', team: 'GB', position: 'WR', keyLine: 'O/U 68.5 rec yds', projectedPoints: 14.6, weekChange: 1.1 },
  { id: 'gb-wr2', rank: 35, name: 'Christian Watson', team: 'GB', position: 'WR', keyLine: 'O/U 58.5 rec yds', projectedPoints: 12.0, weekChange: 0.7 },
  { id: 'gb-wr3', rank: 56, name: 'Romeo Doubs', team: 'GB', position: 'WR', keyLine: 'O/U 52.5 rec yds', projectedPoints: 9.9, weekChange: 0.3 },
  { id: 'gb-te1', rank: 21, name: 'Tucker Kraft', team: 'GB', position: 'TE', keyLine: 'O/U 38.5 rec yds', projectedPoints: 9.5, weekChange: 0.8 },
  { id: 'gb-k1', rank: 13, name: 'Brayden Narveson', team: 'GB', position: 'K', keyLine: 'O/U 7.5 pts', projectedPoints: 8.5, weekChange: 0.2 },
  { id: 'gb-def', rank: 17, name: 'Green Bay', team: 'GB', position: 'DEF', keyLine: 'O/U 2.0 sacks', projectedPoints: 7.3, weekChange: 0.1 },

  // MINNESOTA VIKINGS
  { id: 'min-qb1', rank: 13, name: 'Sam Darnold', team: 'MIN', position: 'QB', keyLine: 'O/U 252.5 pass yds', projectedPoints: 19.8, weekChange: 1.6 },
  { id: 'min-rb1', rank: 46, name: 'Aaron Jones', team: 'MIN', position: 'RB', keyLine: 'O/U 68.5 rush+rec', projectedPoints: 10.9, weekChange: 0.3 },
  { id: 'min-rb2', rank: 96, name: 'Ty Chandler', team: 'MIN', position: 'RB', keyLine: 'O/U 38.5 rush+rec', projectedPoints: 6.9, weekChange: 0.2 },
  { id: 'min-wr1', rank: 3, name: 'Justin Jefferson', team: 'MIN', position: 'WR', keyLine: 'O/U 92.5 rec yds', projectedPoints: 18.3, weekChange: -0.5 },
  { id: 'min-wr2', rank: 54, name: 'Jordan Addison', team: 'MIN', position: 'WR', keyLine: 'O/U 54.5 rec yds', projectedPoints: 10.0, weekChange: 0.6 },
  { id: 'min-wr3', rank: 106, name: 'Jalen Nailor', team: 'MIN', position: 'WR', keyLine: 'O/U 34.5 rec yds', projectedPoints: 6.5, weekChange: 0.4 },
  { id: 'min-te1', rank: 7, name: 'T.J. Hockenson', team: 'MIN', position: 'TE', keyLine: 'O/U 52.5 rec yds', projectedPoints: 12.5, weekChange: 0.7 },
  { id: 'min-k1', rank: 17, name: 'Will Reichard', team: 'MIN', position: 'K', keyLine: 'O/U 7.5 pts', projectedPoints: 8.1, weekChange: 0.2 },
  { id: 'min-def', rank: 13, name: 'Minnesota', team: 'MIN', position: 'DEF', keyLine: 'O/U 2.5 sacks', projectedPoints: 7.7, weekChange: 0.5 },

  // ==================== NFC SOUTH ====================

  // ATLANTA FALCONS
  { id: 'atl-qb1', rank: 19, name: 'Kirk Cousins', team: 'ATL', position: 'QB', keyLine: 'O/U 248.5 pass yds', projectedPoints: 18.4, weekChange: 0.2 },
  { id: 'atl-rb1', rank: 4, name: 'Bijan Robinson', team: 'ATL', position: 'RB', keyLine: 'O/U 96.5 rush+rec', projectedPoints: 17.1, weekChange: 1.9 },
  { id: 'atl-rb2', rank: 60, name: 'Tyler Allgeier', team: 'ATL', position: 'RB', keyLine: 'O/U 52.5 rush+rec', projectedPoints: 9.4, weekChange: 0.4 },
  { id: 'atl-wr1', rank: 20, name: 'Drake London', team: 'ATL', position: 'WR', keyLine: 'O/U 68.5 rec yds', projectedPoints: 13.6, weekChange: 0.8 },
  { id: 'atl-wr2', rank: 64, name: 'Darnell Mooney', team: 'ATL', position: 'WR', keyLine: 'O/U 48.5 rec yds', projectedPoints: 9.3, weekChange: 0.5 },
  { id: 'atl-wr3', rank: 102, name: 'Ray-Ray McCloud', team: 'ATL', position: 'WR', keyLine: 'O/U 32.5 rec yds', projectedPoints: 6.8, weekChange: 0.1 },
  { id: 'atl-te1', rank: 5, name: 'Kyle Pitts', team: 'ATL', position: 'TE', keyLine: 'O/U 48.5 rec yds', projectedPoints: 12.8, weekChange: 0.9 },
  { id: 'atl-k1', rank: 5, name: 'Younghoe Koo', team: 'ATL', position: 'K', keyLine: 'O/U 8.5 pts', projectedPoints: 9.5, weekChange: 0.3 },
  { id: 'atl-def', rank: 21, name: 'Atlanta', team: 'ATL', position: 'DEF', keyLine: 'O/U 2.0 sacks', projectedPoints: 6.9, weekChange: -0.1 },

  // CAROLINA PANTHERS
  { id: 'car-qb1', rank: 29, name: 'Bryce Young', team: 'CAR', position: 'QB', keyLine: 'O/U 208.5 pass yds', projectedPoints: 15.4, weekChange: -1.2 },
  { id: 'car-rb1', rank: 50, name: 'Chuba Hubbard', team: 'CAR', position: 'RB', keyLine: 'O/U 62.5 rush+rec', projectedPoints: 10.5, weekChange: 0.6 },
  { id: 'car-rb2', rank: 98, name: 'Miles Sanders', team: 'CAR', position: 'RB', keyLine: 'O/U 38.5 rush+rec', projectedPoints: 6.8, weekChange: -0.3 },
  { id: 'car-wr1', rank: 55, name: 'Diontae Johnson', team: 'CAR', position: 'WR', keyLine: 'O/U 52.5 rec yds', projectedPoints: 9.9, weekChange: -0.4 },
  { id: 'car-wr2', rank: 82, name: 'Adam Thielen', team: 'CAR', position: 'WR', keyLine: 'O/U 44.5 rec yds', projectedPoints: 7.8, weekChange: 0.2 },
  { id: 'car-wr3', rank: 120, name: 'Xavier Legette', team: 'CAR', position: 'WR', keyLine: 'O/U 28.5 rec yds', projectedPoints: 5.6, weekChange: 0.8 },
  { id: 'car-te1', rank: 40, name: 'Tommy Tremble', team: 'CAR', position: 'TE', keyLine: 'O/U 28.5 rec yds', projectedPoints: 6.8, weekChange: 0.1 },
  { id: 'car-k1', rank: 25, name: 'Eddy Pineiro', team: 'CAR', position: 'K', keyLine: 'O/U 6.5 pts', projectedPoints: 7.1, weekChange: -0.2 },
  { id: 'car-def', rank: 32, name: 'Carolina', team: 'CAR', position: 'DEF', keyLine: 'O/U 1.5 sacks', projectedPoints: 5.8, weekChange: -0.5 },

  // NEW ORLEANS SAINTS
  { id: 'no-qb1', rank: 21, name: 'Derek Carr', team: 'NO', position: 'QB', keyLine: 'O/U 242.5 pass yds', projectedPoints: 17.6, weekChange: -0.4 },
  { id: 'no-rb1', rank: 11, name: 'Alvin Kamara', team: 'NO', position: 'RB', keyLine: 'O/U 88.5 rush+rec', projectedPoints: 16.4, weekChange: 0.8 },
  { id: 'no-rb2', rank: 100, name: 'Jamaal Williams', team: 'NO', position: 'RB', keyLine: 'O/U 32.5 rush+rec', projectedPoints: 6.6, weekChange: -0.2 },
  { id: 'no-wr1', rank: 23, name: 'Chris Olave', team: 'NO', position: 'WR', keyLine: 'O/U 72.5 rec yds', projectedPoints: 13.0, weekChange: 0.4 },
  { id: 'no-wr2', rank: 60, name: 'Rashid Shaheed', team: 'NO', position: 'WR', keyLine: 'O/U 52.5 rec yds', projectedPoints: 9.6, weekChange: 1.0 },
  { id: 'no-wr3', rank: 116, name: 'Cedrick Wilson Jr.', team: 'NO', position: 'WR', keyLine: 'O/U 28.5 rec yds', projectedPoints: 5.9, weekChange: 0.1 },
  { id: 'no-te1', rank: 23, name: 'Juwan Johnson', team: 'NO', position: 'TE', keyLine: 'O/U 36.5 rec yds', projectedPoints: 9.0, weekChange: 0.3 },
  { id: 'no-k1', rank: 3, name: 'Blake Grupe', team: 'NO', position: 'K', keyLine: 'O/U 8.5 pts', projectedPoints: 9.7, weekChange: 0.4 },
  { id: 'no-def', rank: 23, name: 'New Orleans', team: 'NO', position: 'DEF', keyLine: 'O/U 2.0 sacks', projectedPoints: 6.7, weekChange: 0.2 },

  // TAMPA BAY BUCCANEERS
  { id: 'tb-qb1', rank: 23, name: 'Baker Mayfield', team: 'TB', position: 'QB', keyLine: 'O/U 252.5 pass yds', projectedPoints: 17.2, weekChange: 0.6 },
  { id: 'tb-rb1', rank: 52, name: 'Rachaad White', team: 'TB', position: 'RB', keyLine: 'O/U 62.5 rush+rec', projectedPoints: 10.4, weekChange: -0.2 },
  { id: 'tb-rb2', rank: 58, name: 'Bucky Irving', team: 'TB', position: 'RB', keyLine: 'O/U 58.5 rush+rec', projectedPoints: 9.6, weekChange: 1.4 },
  { id: 'tb-wr1', rank: 17, name: 'Mike Evans', team: 'TB', position: 'WR', keyLine: 'O/U 72.5 rec yds', projectedPoints: 14.0, weekChange: 0.5 },
  { id: 'tb-wr2', rank: 25, name: 'Chris Godwin', team: 'TB', position: 'WR', keyLine: 'O/U 68.5 rec yds', projectedPoints: 12.8, weekChange: 0.7 },
  { id: 'tb-wr3', rank: 88, name: 'Jalen McMillan', team: 'TB', position: 'WR', keyLine: 'O/U 38.5 rec yds', projectedPoints: 7.4, weekChange: 0.6 },
  { id: 'tb-te1', rank: 13, name: 'Cade Otton', team: 'TB', position: 'TE', keyLine: 'O/U 44.5 rec yds', projectedPoints: 11.4, weekChange: 0.8 },
  { id: 'tb-k1', rank: 23, name: 'Chase McLaughlin', team: 'TB', position: 'K', keyLine: 'O/U 7.0 pts', projectedPoints: 7.3, weekChange: 0.1 },
  { id: 'tb-def', rank: 25, name: 'Tampa Bay', team: 'TB', position: 'DEF', keyLine: 'O/U 2.0 sacks', projectedPoints: 6.5, weekChange: -0.2 },

  // ==================== NFC WEST ====================

  // ARIZONA CARDINALS
  { id: 'ari-qb1', rank: 25, name: 'Kyler Murray', team: 'ARI', position: 'QB', keyLine: 'O/U 242.5 pass yds', projectedPoints: 16.8, weekChange: 0.8 },
  { id: 'ari-rb1', rank: 21, name: 'James Conner', team: 'ARI', position: 'RB', keyLine: 'O/U 78.5 rush+rec', projectedPoints: 14.0, weekChange: 0.6 },
  { id: 'ari-rb2', rank: 102, name: 'Trey Benson', team: 'ARI', position: 'RB', keyLine: 'O/U 38.5 rush+rec', projectedPoints: 6.7, weekChange: 0.9 },
  { id: 'ari-wr1', rank: 13, name: 'Marvin Harrison Jr.', team: 'ARI', position: 'WR', keyLine: 'O/U 72.5 rec yds', projectedPoints: 14.8, weekChange: 2.0 },
  { id: 'ari-wr2', rank: 85, name: 'Michael Wilson', team: 'ARI', position: 'WR', keyLine: 'O/U 42.5 rec yds', projectedPoints: 7.6, weekChange: 0.3 },
  { id: 'ari-wr3', rank: 122, name: 'Greg Dortch', team: 'ARI', position: 'WR', keyLine: 'O/U 28.5 rec yds', projectedPoints: 5.5, weekChange: -0.1 },
  { id: 'ari-te1', rank: 17, name: 'Trey McBride', team: 'ARI', position: 'TE', keyLine: 'O/U 48.5 rec yds', projectedPoints: 10.2, weekChange: 0.6 },
  { id: 'ari-k1', rank: 27, name: 'Matt Prater', team: 'ARI', position: 'K', keyLine: 'O/U 7.0 pts', projectedPoints: 6.9, weekChange: -0.1 },
  { id: 'ari-def', rank: 29, name: 'Arizona', team: 'ARI', position: 'DEF', keyLine: 'O/U 1.5 sacks', projectedPoints: 6.1, weekChange: -0.3 },

  // LOS ANGELES RAMS
  { id: 'lar-qb1', rank: 27, name: 'Matthew Stafford', team: 'LAR', position: 'QB', keyLine: 'O/U 258.5 pass yds', projectedPoints: 16.6, weekChange: -0.2 },
  { id: 'lar-rb1', rank: 9, name: 'Kyren Williams', team: 'LAR', position: 'RB', keyLine: 'O/U 84.5 rush+rec', projectedPoints: 15.5, weekChange: -0.4 },
  { id: 'lar-rb2', rank: 104, name: 'Ronnie Rivers', team: 'LAR', position: 'RB', keyLine: 'O/U 32.5 rush+rec', projectedPoints: 6.5, weekChange: 0.2 },
  { id: 'lar-wr1', rank: 7, name: 'Puka Nacua', team: 'LAR', position: 'WR', keyLine: 'O/U 82.5 rec yds', projectedPoints: 15.9, weekChange: -0.2 },
  { id: 'lar-wr2', rank: 31, name: 'Cooper Kupp', team: 'LAR', position: 'WR', keyLine: 'O/U 62.5 rec yds', projectedPoints: 12.3, weekChange: 0.4 },
  { id: 'lar-wr3', rank: 79, name: 'Demarcus Robinson', team: 'LAR', position: 'WR', keyLine: 'O/U 42.5 rec yds', projectedPoints: 7.9, weekChange: 0.2 },
  { id: 'lar-te1', rank: 25, name: 'Tyler Higbee', team: 'LAR', position: 'TE', keyLine: 'O/U 38.5 rec yds', projectedPoints: 8.6, weekChange: -0.3 },
  { id: 'lar-k1', rank: 29, name: 'Joshua Karty', team: 'LAR', position: 'K', keyLine: 'O/U 6.5 pts', projectedPoints: 6.7, weekChange: 0.2 },
  { id: 'lar-def', rank: 27, name: 'Los Angeles Rams', team: 'LAR', position: 'DEF', keyLine: 'O/U 2.0 sacks', projectedPoints: 6.3, weekChange: 0.1 },

  // SAN FRANCISCO 49ERS
  { id: 'sf-qb1', rank: 31, name: 'Brock Purdy', team: 'SF', position: 'QB', keyLine: 'O/U 262.5 pass yds', projectedPoints: 15.2, weekChange: -0.6 },
  { id: 'sf-rb1', rank: 7, name: 'Christian McCaffrey', team: 'SF', position: 'RB', keyLine: 'O/U 92.5 rush+rec', projectedPoints: 16.9, weekChange: 0.1 },
  { id: 'sf-rb2', rank: 54, name: 'Jordan Mason', team: 'SF', position: 'RB', keyLine: 'O/U 58.5 rush+rec', projectedPoints: 10.2, weekChange: 1.8 },
  { id: 'sf-wr1', rank: 10, name: 'Deebo Samuel', team: 'SF', position: 'WR', keyLine: 'O/U 68.5 rec yds', projectedPoints: 15.2, weekChange: 0.6 },
  { id: 'sf-wr2', rank: 29, name: 'Brandon Aiyuk', team: 'SF', position: 'WR', keyLine: 'O/U 68.5 rec yds', projectedPoints: 12.5, weekChange: -0.4 },
  { id: 'sf-wr3', rank: 75, name: 'Jauan Jennings', team: 'SF', position: 'WR', keyLine: 'O/U 44.5 rec yds', projectedPoints: 8.1, weekChange: 0.5 },
  { id: 'sf-te1', rank: 3, name: 'George Kittle', team: 'SF', position: 'TE', keyLine: 'O/U 56.5 rec yds', projectedPoints: 13.5, weekChange: 0.4 },
  { id: 'sf-k1', rank: 31, name: 'Jake Moody', team: 'SF', position: 'K', keyLine: 'O/U 7.0 pts', projectedPoints: 6.5, weekChange: -0.4 },
  { id: 'sf-def', rank: 1, name: 'San Francisco', team: 'SF', position: 'DEF', keyLine: 'O/U 3.5 sacks', projectedPoints: 9.4, weekChange: 0.6 },

  // SEATTLE SEAHAWKS
  { id: 'sea-qb1', rank: 32, name: 'Geno Smith', team: 'SEA', position: 'QB', keyLine: 'O/U 252.5 pass yds', projectedPoints: 14.8, weekChange: -0.4 },
  { id: 'sea-rb1', rank: 17, name: 'Kenneth Walker III', team: 'SEA', position: 'RB', keyLine: 'O/U 78.5 rush+rec', projectedPoints: 14.6, weekChange: 0.5 },
  { id: 'sea-rb2', rank: 56, name: 'Zach Charbonnet', team: 'SEA', position: 'RB', keyLine: 'O/U 52.5 rush+rec', projectedPoints: 9.8, weekChange: 0.8 },
  { id: 'sea-wr1', rank: 9, name: 'DK Metcalf', team: 'SEA', position: 'WR', keyLine: 'O/U 78.5 rec yds', projectedPoints: 15.4, weekChange: 0.7 },
  { id: 'sea-wr2', rank: 27, name: 'Tyler Lockett', team: 'SEA', position: 'WR', keyLine: 'O/U 62.5 rec yds', projectedPoints: 12.7, weekChange: -0.2 },
  { id: 'sea-wr3', rank: 68, name: 'Jaxon Smith-Njigba', team: 'SEA', position: 'WR', keyLine: 'O/U 52.5 rec yds', projectedPoints: 8.9, weekChange: 1.2 },
  { id: 'sea-te1', rank: 29, name: 'Noah Fant', team: 'SEA', position: 'TE', keyLine: 'O/U 34.5 rec yds', projectedPoints: 8.1, weekChange: 0.2 },
  { id: 'sea-k1', rank: 32, name: 'Jason Myers', team: 'SEA', position: 'K', keyLine: 'O/U 7.0 pts', projectedPoints: 6.4, weekChange: -0.2 },
  { id: 'sea-def', rank: 31, name: 'Seattle', team: 'SEA', position: 'DEF', keyLine: 'O/U 2.0 sacks', projectedPoints: 5.9, weekChange: -0.4 },
];

// Helper function to get players by team
export const getPlayersByTeam = (teamCode: string): Player[] => {
  return nflPlayersData.filter(player => player.team === teamCode);
};

// Helper function to get players by position
export const getPlayersByPosition = (position: Player['position']): Player[] => {
  return nflPlayersData.filter(player => player.position === position);
};

// Helper function to get top players by projected points
export const getTopPlayers = (count: number = 10): Player[] => {
  return [...nflPlayersData].sort((a, b) => b.projectedPoints - a.projectedPoints).slice(0, count);
};

// Helper function to get players with positive week change (trending up)
export const getTrendingUpPlayers = (count: number = 10): Player[] => {
  return [...nflPlayersData]
    .filter(player => player.weekChange > 0)
    .sort((a, b) => b.weekChange - a.weekChange)
    .slice(0, count);
};

// Helper function to get players with negative week change (trending down)
export const getTrendingDownPlayers = (count: number = 10): Player[] => {
  return [...nflPlayersData]
    .filter(player => player.weekChange < 0)
    .sort((a, b) => a.weekChange - b.weekChange)
    .slice(0, count);
};
