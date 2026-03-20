const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

// Team name mapping: The Odds API uses full names, Sleeper uses abbreviations
const TEAM_NAME_TO_ABBR: Record<string, string> = {
  'Arizona Cardinals': 'ARI',
  'Atlanta Falcons': 'ATL',
  'Baltimore Ravens': 'BAL',
  'Buffalo Bills': 'BUF',
  'Carolina Panthers': 'CAR',
  'Chicago Bears': 'CHI',
  'Cincinnati Bengals': 'CIN',
  'Cleveland Browns': 'CLE',
  'Dallas Cowboys': 'DAL',
  'Denver Broncos': 'DEN',
  'Detroit Lions': 'DET',
  'Green Bay Packers': 'GB',
  'Houston Texans': 'HOU',
  'Indianapolis Colts': 'IND',
  'Jacksonville Jaguars': 'JAX',
  'Kansas City Chiefs': 'KC',
  'Las Vegas Raiders': 'LV',
  'Los Angeles Chargers': 'LAC',
  'Los Angeles Rams': 'LAR',
  'Miami Dolphins': 'MIA',
  'Minnesota Vikings': 'MIN',
  'New England Patriots': 'NE',
  'New Orleans Saints': 'NO',
  'New York Giants': 'NYG',
  'New York Jets': 'NYJ',
  'Philadelphia Eagles': 'PHI',
  'Pittsburgh Steelers': 'PIT',
  'San Francisco 49ers': 'SF',
  'Seattle Seahawks': 'SEA',
  'Tampa Bay Buccaneers': 'TB',
  'Tennessee Titans': 'TEN',
  'Washington Commanders': 'WAS',
};

export function teamNameToAbbr(fullName: string): string {
  return TEAM_NAME_TO_ABBR[fullName] || fullName;
}

interface OddsBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsMarket[];
}

interface OddsMarket {
  key: string;
  last_update: string;
  outcomes: OddsOutcome[];
}

interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
}

interface OddsGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

export interface ParsedOdds {
  id: string;
  game_id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmaker: string;
  market: string;
  home_point?: number;
  away_point?: number;
  home_price?: number;
  away_price?: number;
  over_point?: number;
  under_point?: number;
  over_price?: number;
  under_price?: number;
  snapshot_time: string;
  season: number;
  week?: number;
}

export async function fetchCurrentOdds(apiKey: string): Promise<OddsGame[]> {
  const url = new URL(`${ODDS_API_BASE}/sports/americanfootball_nfl/odds`);
  url.searchParams.set('regions', 'us');
  url.searchParams.set('markets', 'spreads,totals,h2h');
  url.searchParams.set('oddsFormat', 'american');
  url.searchParams.set('apiKey', apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch current odds: ${response.statusText}`);
  }

  return response.json();
}

interface HistoricalOddsResponse {
  games: OddsGame[];
  timestamp?: string;
}

export async function fetchHistoricalOdds(
  apiKey: string,
  date: string
): Promise<HistoricalOddsResponse> {
  const url = new URL(
    `${ODDS_API_BASE}/historical/sports/americanfootball_nfl/odds`
  );
  url.searchParams.set('regions', 'us');
  url.searchParams.set('markets', 'spreads,totals,h2h');
  url.searchParams.set('oddsFormat', 'american');
  url.searchParams.set('date', date);
  url.searchParams.set('apiKey', apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch historical odds: ${response.statusText}`);
  }

  const json = await response.json() as {
    data?: OddsGame[];
    timestamp?: string;
    previous_timestamp?: string;
  };
  // Historical API wraps games in a 'data' key and provides a timestamp
  const games = json.data || (Array.isArray(json) ? json : []);
  const timestamp = json.timestamp || json.previous_timestamp;

  return {
    games,
    timestamp,
  };
}

export function parseOddsResponse(
  games: OddsGame[],
  week?: number,
  snapshotTime?: string
): ParsedOdds[] {
  const parsed: ParsedOdds[] = [];
  const timestamp = snapshotTime || new Date().toISOString();

  for (const game of games) {
    const homeTeamAbbr = teamNameToAbbr(game.home_team);
    const awayTeamAbbr = teamNameToAbbr(game.away_team);
    const gameId = `${awayTeamAbbr}_${homeTeamAbbr}`;

    for (const bookmaker of game.bookmakers) {
      for (const market of bookmaker.markets) {
        let oddsRecord: ParsedOdds = {
          id: `${gameId}_${bookmaker.key}_${market.key}_${timestamp}`,
          game_id: gameId,
          sport_key: game.sport_key,
          home_team: homeTeamAbbr,
          away_team: awayTeamAbbr,
          commence_time: game.commence_time,
          bookmaker: bookmaker.key,
          market: market.key,
          snapshot_time: timestamp,
          season: 2025,
          week,
        };

        if (market.key === 'spreads') {
          for (const outcome of market.outcomes) {
            if (outcome.name === game.home_team) {
              oddsRecord.home_point = outcome.point;
              oddsRecord.home_price = outcome.price;
            } else if (outcome.name === game.away_team) {
              oddsRecord.away_point = outcome.point;
              oddsRecord.away_price = outcome.price;
            }
          }
        } else if (market.key === 'totals') {
          for (const outcome of market.outcomes) {
            if (outcome.name === 'Over') {
              oddsRecord.over_point = outcome.point;
              oddsRecord.over_price = outcome.price;
            } else if (outcome.name === 'Under') {
              oddsRecord.under_point = outcome.point;
              oddsRecord.under_price = outcome.price;
            }
          }
        } else if (market.key === 'h2h') {
          for (const outcome of market.outcomes) {
            if (outcome.name === game.home_team) {
              oddsRecord.home_price = outcome.price;
            } else if (outcome.name === game.away_team) {
              oddsRecord.away_price = outcome.price;
            }
          }
        }

        parsed.push(oddsRecord);
      }
    }
  }

  return parsed;
}
