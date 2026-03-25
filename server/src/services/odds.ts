const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

/** Strip API key from URLs before logging to prevent credential leakage */
function sanitizeUrl(url: string): string {
  return url.replace(/apiKey=[^&]+/, 'apiKey=***');
}

/**
 * Fetch wrapper that prevents API key leakage in error messages.
 * The Odds API requires the key as a query parameter (no header auth).
 * This wrapper ensures the key never appears in thrown errors or logs.
 */
async function safeFetch(url: string): Promise<Response> {
  try {
    return await fetch(url);
  } catch (err) {
    // Network errors may include the full URL — sanitize before re-throwing
    const msg = err instanceof Error ? err.message : 'Network error';
    throw new Error(`Odds API request failed: ${msg.replace(/apiKey=[^&\s]+/g, 'apiKey=***')}`);
  }
}

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
  description?: string;
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

  const response = await safeFetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch current odds: ${response.status} ${response.statusText}`);
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

  const response = await safeFetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch historical odds: ${response.status} ${response.statusText}`);
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

// Player props from The Odds API
interface PlayerPropMarket {
  key: string;
  last_update: string;
  outcomes: Array<{
    name: string;
    description?: string;
    price: number;
    point?: number;
  }>;
}

export interface ParsedPlayerProp {
  id: string;
  event_id: string;
  player_name: string;
  market: string;
  bookmaker: string;
  over_point?: number;
  over_price?: number;
  under_point?: number;
  under_price?: number;
  yes_price?: number;
  no_price?: number;
  snapshot_time: string;
  home_team: string;
  away_team: string;
  week?: number;
}

export async function fetchPlayerProps(
  apiKey: string,
  eventId: string,
  date?: string
): Promise<OddsGame | null> {
  const markets = 'player_pass_yds,player_rush_yds,player_reception_yds,player_pass_tds,player_rush_tds,player_receptions,player_anytime_td';

  const base = date
    ? `${ODDS_API_BASE}/historical/sports/americanfootball_nfl/events/${eventId}/odds`
    : `${ODDS_API_BASE}/sports/americanfootball_nfl/events/${eventId}/odds`;

  const url = new URL(base);
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('regions', 'us');
  url.searchParams.set('markets', markets);
  url.searchParams.set('oddsFormat', 'american');
  if (date) {
    url.searchParams.set('date', date);
  }

  const response = await safeFetch(url.toString());
  if (!response.ok) {
    console.error(`Failed to fetch player props for event ${eventId}: ${response.status} ${response.statusText}`);
    return null;
  }

  const json = await response.json() as any;
  // Historical endpoint wraps in 'data', current endpoint returns directly
  return date ? (json.data || null) : json;
}

export function parsePlayerProps(
  game: OddsGame,
  week: number,
  snapshotTime?: string
): ParsedPlayerProp[] {
  const parsed: ParsedPlayerProp[] = [];
  const timestamp = snapshotTime || new Date().toISOString();
  const homeTeamAbbr = teamNameToAbbr(game.home_team);
  const awayTeamAbbr = teamNameToAbbr(game.away_team);

  // Filter to FanDuel bookmaker only (fallback: DraftKings, then BetMGM)
  const bookmakersInOrder = ['fanduel', 'draftkings', 'betmgm'];
  let selectedBookmaker: OddsBookmaker | undefined;

  for (const bookmakerKey of bookmakersInOrder) {
    selectedBookmaker = game.bookmakers.find((b) => b.key === bookmakerKey);
    if (selectedBookmaker) {
      break;
    }
  }

  if (!selectedBookmaker) {
    // No supported bookmaker found
    return parsed;
  }

  for (const market of selectedBookmaker.markets) {
    // Player props have format like "player_pass_yds"
    if (!market.key.startsWith('player_')) {
      continue;
    }

    // Parse outcomes for this market
    // API returns outcomes where:
    // - outcome.description contains the player name (e.g., "Jalen Hurts")
    // - outcome.name contains "Over"/"Under" (for point-based) or "Yes"/"No" (for binary)
    // - outcome.point is the threshold (only for over/under)
    // - outcome.price is the odds

    // Group outcomes by player + outcome type
    const playerOutcomes: Record<string, any> = {};

    for (const outcome of market.outcomes) {
      // Player name is in outcome.description, not outcome.name
      const playerName = outcome.description || '';
      const type = outcome.name; // "Over", "Under", "Yes", "No"

      if (!playerName) {
        continue;
      }

      if (!playerOutcomes[playerName]) {
        playerOutcomes[playerName] = {};
      }

      if (type === 'Over') {
        playerOutcomes[playerName].over_point = outcome.point;
        playerOutcomes[playerName].over_price = outcome.price;
      } else if (type === 'Under') {
        playerOutcomes[playerName].under_point = outcome.point;
        playerOutcomes[playerName].under_price = outcome.price;
      } else if (type === 'Yes') {
        playerOutcomes[playerName].yes_price = outcome.price;
      } else if (type === 'No') {
        playerOutcomes[playerName].no_price = outcome.price;
      }
    }

    // Create a record for each player in this market
    for (const playerName of Object.keys(playerOutcomes)) {
      const outcome = playerOutcomes[playerName];
      const prop: ParsedPlayerProp = {
        id: `${game.id}_${selectedBookmaker.key}_${market.key}_${playerName}_${timestamp}`,
        event_id: game.id,
        player_name: playerName,
        market: market.key,
        bookmaker: selectedBookmaker.key,
        over_point: outcome.over_point,
        over_price: outcome.over_price,
        under_point: outcome.under_point,
        under_price: outcome.under_price,
        yes_price: outcome.yes_price,
        no_price: outcome.no_price,
        snapshot_time: timestamp,
        home_team: homeTeamAbbr,
        away_team: awayTeamAbbr,
        week,
      };
      parsed.push(prop);
    }
  }

  return parsed;
}
