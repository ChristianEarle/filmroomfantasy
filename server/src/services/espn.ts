/**
 * ESPN NFL Scoreboard API integration.
 * Fetches real NFL games with weather and maps to DB format.
 * Falls back to static 2025 schedule when ESPN API fails (500/timeout).
 */

import staticSchedule from '../data/nfl-schedule-2025.json';

const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

// Abbrev -> display name for API responses (subset used by ESPN)
const TEAM_NAMES: Record<string, string> = {
  ARI: 'Arizona Cardinals', ATL: 'Atlanta Falcons', BAL: 'Baltimore Ravens', BUF: 'Buffalo Bills',
  CAR: 'Carolina Panthers', CHI: 'Chicago Bears', CIN: 'Cincinnati Bengals', CLE: 'Cleveland Browns',
  DAL: 'Dallas Cowboys', DEN: 'Denver Broncos', DET: 'Detroit Lions', GB: 'Green Bay Packers',
  HOU: 'Houston Texans', IND: 'Indianapolis Colts', JAX: 'Jacksonville Jaguars', KC: 'Kansas City Chiefs',
  LAC: 'Los Angeles Chargers', LAR: 'Los Angeles Rams', LV: 'Las Vegas Raiders', MIA: 'Miami Dolphins',
  MIN: 'Minnesota Vikings', NE: 'New England Patriots', NO: 'New Orleans Saints', NYG: 'New York Giants',
  NYJ: 'New York Jets', PHI: 'Philadelphia Eagles', PIT: 'Pittsburgh Steelers', SEA: 'Seattle Seahawks',
  SF: 'San Francisco 49ers', TB: 'Tampa Bay Buccaneers', TEN: 'Tennessee Titans', WAS: 'Washington Commanders',
  WSH: 'Washington Commanders',
};

export function getTeamDisplayName(abbrev: string): string {
  return TEAM_NAMES[abbrev] ?? abbrev;
}

/**
 * NFL teams that play in indoor / dome / retractable-roof stadiums.
 * Used as a fallback when ESPN doesn't set `venue.indoor` or when
 * fetching completed games that lack weather data.
 *
 * Fixed roof:  NO (Caesars Superdome), DET (Ford Field), MIN (U.S. Bank Stadium),
 *              LV (Allegiant Stadium)
 * Retractable: IND (Lucas Oil Stadium), ATL (Mercedes-Benz Stadium),
 *              DAL (AT&T Stadium), HOU (NRG Stadium), ARI (State Farm Stadium)
 *
 * Note: LAR/LAC (SoFi Stadium) is open-air despite having a canopy roof,
 * so it's intentionally excluded.
 */
const INDOOR_TEAMS = new Set(['NO', 'DET', 'MIN', 'LV', 'IND', 'ATL', 'DAL', 'HOU', 'ARI']);

/** Home stadium coordinates by team abbreviation, for pre-game weather forecasts. */
const STADIUM_COORDINATES: Record<string, { lat: number; lon: number }> = {
  ARI: { lat: 33.5276, lon: -112.2626 }, ATL: { lat: 33.7554, lon: -84.4008 },
  BAL: { lat: 39.2780, lon: -76.6227 }, BUF: { lat: 42.7738, lon: -78.7870 },
  CAR: { lat: 35.2258, lon: -80.8528 }, CHI: { lat: 41.8623, lon: -87.6167 },
  CIN: { lat: 39.0955, lon: -84.5160 }, CLE: { lat: 41.5061, lon: -81.6995 },
  DAL: { lat: 32.7473, lon: -97.0945 }, DEN: { lat: 39.7439, lon: -105.0201 },
  DET: { lat: 42.3400, lon: -83.0456 }, GB: { lat: 44.5013, lon: -88.0622 },
  HOU: { lat: 29.6847, lon: -95.4107 }, IND: { lat: 39.7601, lon: -86.1639 },
  JAX: { lat: 30.3239, lon: -81.6373 }, KC: { lat: 39.0489, lon: -94.4839 },
  LAC: { lat: 33.9535, lon: -118.3392 }, LAR: { lat: 33.9535, lon: -118.3392 },
  LV: { lat: 36.0909, lon: -115.1833 }, MIA: { lat: 25.9580, lon: -80.2389 },
  MIN: { lat: 44.9736, lon: -93.2575 }, NE: { lat: 42.0909, lon: -71.2643 },
  NO: { lat: 29.9511, lon: -90.0812 }, NYG: { lat: 40.8135, lon: -74.0745 },
  NYJ: { lat: 40.8135, lon: -74.0745 }, PHI: { lat: 39.9008, lon: -75.1675 },
  PIT: { lat: 40.4468, lon: -80.0158 }, SEA: { lat: 47.5952, lon: -122.3316 },
  SF: { lat: 37.4032, lon: -121.9698 }, TB: { lat: 27.9759, lon: -82.5033 },
  TEN: { lat: 36.1665, lon: -86.7713 }, WAS: { lat: 38.9078, lon: -76.8645 },
  WSH: { lat: 38.9078, lon: -76.8645 },
};

/** WMO weather codes (used by Open-Meteo) mapped to short display strings. */
const WMO_WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Cloudy',
  45: 'Fog', 48: 'Fog',
  51: 'Light Rain', 53: 'Rain', 55: 'Rain',
  56: 'Freezing Rain', 57: 'Freezing Rain',
  61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
  66: 'Freezing Rain', 67: 'Freezing Rain',
  71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow', 77: 'Snow',
  80: 'Rain Showers', 81: 'Rain Showers', 82: 'Heavy Rain Showers',
  85: 'Snow Showers', 86: 'Snow Showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
};

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
// Open-Meteo's free-tier hourly forecast horizon.
const FORECAST_WINDOW_HOURS = 16 * 24;

/**
 * Pre-game weather forecast for an outdoor stadium via Open-Meteo (free, no
 * API key). ESPN's `weather` field is only populated once a game has
 * started or finished, so this fills the gap for upcoming games — returns
 * null for indoor stadiums, games outside the 16-day forecast horizon, or
 * on any fetch/parse failure.
 */
export async function fetchOutdoorForecast(
  homeAbbrev: string,
  gameTime: Date
): Promise<{ displayValue: string; temperature: number } | null> {
  const coords = STADIUM_COORDINATES[homeAbbrev];
  if (!coords) return null;

  const hoursUntilGame = (gameTime.getTime() - Date.now()) / 3600000;
  if (hoursUntilGame < 0 || hoursUntilGame > FORECAST_WINDOW_HOURS) return null;

  try {
    const params = new URLSearchParams({
      latitude: String(coords.lat),
      longitude: String(coords.lon),
      hourly: 'temperature_2m,weathercode',
      temperature_unit: 'fahrenheit',
      timezone: 'UTC',
      forecast_days: '16',
    });
    const res = await fetch(`${OPEN_METEO_FORECAST_URL}?${params}`);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      hourly?: { time?: string[]; temperature_2m?: number[]; weathercode?: number[] };
    };
    const hourly = data.hourly;
    if (!hourly?.time?.length || !hourly.temperature_2m || !hourly.weathercode) return null;

    const targetMs = gameTime.getTime();
    let closestIdx = -1;
    let closestDiff = Infinity;
    for (let i = 0; i < hourly.time.length; i++) {
      const diff = Math.abs(new Date(`${hourly.time[i]}Z`).getTime() - targetMs);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIdx = i;
      }
    }
    if (closestIdx === -1) return null;

    const temperature = hourly.temperature_2m[closestIdx];
    const code = hourly.weathercode[closestIdx];
    if (temperature == null) return null;

    return {
      displayValue: WMO_WEATHER_DESCRIPTIONS[code] ?? 'Outdoor',
      temperature: Math.round(temperature),
    };
  } catch {
    return null;
  }
}

/**
 * Fills in pre-game forecasts (in place) for any parsed rows still missing
 * weather — i.e. upcoming outdoor games ESPN hasn't reported live/final
 * conditions for yet. `games` and `dbRows` are parsed in lockstep by the
 * callers below, so they share indices.
 */
async function enrichWeatherForecasts(games: EspnSlateGame[], dbRows: EspnGameRow[]): Promise<void> {
  await Promise.all(dbRows.map(async (row, i) => {
    if (row.weather) return;
    const forecast = await fetchOutdoorForecast(row.homeTeam, row.gameTime);
    if (!forecast) return;
    row.weather = JSON.stringify(forecast);
    if (games[i]) games[i].weather = forecast;
  }));
}

/**
 * Determine the current NFL season year and phase based on the calendar date.
 * ESPN season types: '1' = preseason, '2' = regular season, '3' = postseason.
 *
 * NFL calendar (approximate):
 *   Jan 1 – Feb 15:   Previous year's postseason
 *   Feb 16 – Jul 31:  Offseason (return previous year's regular season for historical data)
 *   Aug 1 – Sep 4:    Current year's preseason
 *   Sep 5 – Jan 15*:  Current year's regular season (* extends into next calendar year)
 *
 * Note: The exact cutoff dates shift year-to-year. These are close enough for
 * default context when the caller doesn't specify an explicit week/season.
 */
export function getNflSeasonContext(): { season: number; seasontype: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const day = now.getDate();

  // Jan 1 – Feb 15: previous year's postseason
  if (month === 0 || (month === 1 && day <= 15)) {
    return { season: year - 1, seasontype: '3' };
  }

  // Feb 16 – Jul 31: offseason — show previous year's regular season data
  if (month <= 6) {
    return { season: year - 1, seasontype: '2' };
  }

  // Aug 1 – Sep 4: preseason
  if (month === 7 || (month === 8 && day <= 4)) {
    return { season: year, seasontype: '1' };
  }

  // Sep 5 – Dec 31: regular season
  return { season: year, seasontype: '2' };
}

export interface EspnGameRow {
  id: string;
  week: number;
  seasonYear: number;
  seasonType: string;
  homeTeam: string;
  awayTeam: string;
  gameTime: Date;
  spread: number | null;
  overUnder: number | null;
  tvNetwork: string | null;
  stadium: string | null;
  weather: string | null;
  homeScore?: number;
  awayScore?: number;
  status?: string;
}

export interface EspnSlateGame {
  id: string;
  awayTeam: string;
  awayTeamLogo: string;
  homeTeam: string;
  homeTeamLogo: string;
  gameTime: string;
  gameTimeDisplay: string;
  spread: number | null;
  favoredTeam: 'home' | 'away';
  overUnder: number | null;
  tvNetwork: string;
  weather: { displayValue: string; temperature?: number } | null;
  homeScore?: number;
  awayScore?: number;
  status?: string;
}

interface StaticGame {
  away: string;
  home: string;
  date: string;
  network?: string;
  stadium?: string;
}

function loadStaticSchedule(
  week: number,
  season: number,
  seasonType: string
): { games: EspnSlateGame[]; dbRows: EspnGameRow[] } {
  const weeks = (staticSchedule as { weeks?: Record<string, StaticGame[]> }).weeks;
  const weekGames = weeks?.[String(week)] ?? [];
  const st = seasonType === '1' ? 'preseason' : seasonType === '3' ? 'postseason' : 'regular';

  const games: EspnSlateGame[] = [];
  const dbRows: EspnGameRow[] = [];

  weekGames.forEach((g, i) => {
    const id = `static-${season}-w${week}-${i}`;
    const gameTime = new Date(g.date);
    const awayName = getTeamDisplayName(g.away);
    const homeName = getTeamDisplayName(g.home);
    const network = g.network ?? 'TBD';

    games.push({
      id,
      awayTeam: awayName,
      awayTeamLogo: g.away,
      homeTeam: homeName,
      homeTeamLogo: g.home,
      gameTime: g.date,
      gameTimeDisplay: gameTime.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }),
      spread: null,
      favoredTeam: 'home',
      overUnder: null,
      tvNetwork: network,
      weather: INDOOR_TEAMS.has(g.home)
        ? { displayValue: 'Indoor', temperature: 72 }
        : gameTime.getTime() < Date.now() ? { displayValue: 'Outdoor' } : null,
    });

    const weatherObj = INDOOR_TEAMS.has(g.home)
      ? { displayValue: 'Indoor', temperature: 72 }
      : gameTime.getTime() < Date.now() ? { displayValue: 'Outdoor' } : null;
    dbRows.push({
      id,
      week,
      seasonYear: season,
      seasonType: st,
      homeTeam: g.home,
      awayTeam: g.away,
      gameTime,
      spread: null,
      overUnder: null,
      tvNetwork: network,
      stadium: g.stadium ?? null,
      weather: weatherObj ? JSON.stringify(weatherObj) : null,
    });
  });

  return { games, dbRows };
}

/**
 * Parse ESPN events array into our game/dbRow format.
 */
function parseEspnEvents(
  events: any[],
  resolvedWeek: number,
  s: number,
  st: string
): { games: EspnSlateGame[]; dbRows: EspnGameRow[] } {
  const games: EspnSlateGame[] = [];
  const dbRows: EspnGameRow[] = [];

  for (const ev of events) {
    const comp = ev.competitions?.[0];
    const home = comp?.competitors?.find((c: any) => c.homeAway === 'home');
    const away = comp?.competitors?.find((c: any) => c.homeAway === 'away');
    const homeTeam = home?.team;
    const awayTeam = away?.team;
    const homeAbbrev = homeTeam?.abbreviation ?? '';
    const awayAbbrev = awayTeam?.abbreviation ?? '';
    const odds = ev.odds?.[0];
    const spreadVal = odds?.spread ?? odds?.pointSpread?.away?.close?.line;
    const overUnderVal = odds?.overUnder ?? odds?.total?.over?.close?.line;
    const awayFavorite = odds?.awayTeamOdds?.favorite ?? String(odds?.pointSpread?.away?.close?.line || '').startsWith('-');
    const venue = comp?.venue;
    const weather = ev.weather;
    const broadcast = ev.broadcasts?.[0]?.names?.[0] ?? ev.broadcast;

    const absSpread = spreadVal != null ? (Math.abs(parseFloat(String(spreadVal).replace(/[+-]/g, '')) || 0)) : null;
    const signedSpread = absSpread != null ? (awayFavorite ? absSpread : -absSpread) : null;
    const overUnder = overUnderVal ? parseFloat(String(overUnderVal).replace(/[ou]/gi, '')) || null : null;
    const isIndoor = venue?.indoor || INDOOR_TEAMS.has(homeAbbrev);
    const isFinalOrPast = ev.status?.type?.name === 'STATUS_FINAL' ||
      new Date(ev.date).getTime() < Date.now() - 4 * 3600000;
    const weatherObj = weather
      ? { displayValue: weather.displayValue, temperature: weather.temperature }
      : isIndoor
        ? { displayValue: 'Indoor', temperature: 72 }
        : isFinalOrPast
          ? { displayValue: 'Outdoor' }
          : null;

    const gameTime = new Date(ev.date);
    const statusName = ev.status?.type?.name;
    const isFinal = statusName === 'STATUS_FINAL';
    const gameTimeDisplay = isFinal
      ? gameTime.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
      : ev.status?.type?.detail ?? ev.shortName ?? gameTime.toLocaleString('en-US', {
          weekday: 'short',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        });

    games.push({
      id: ev.id,
      awayTeam: awayTeam?.displayName ?? getTeamDisplayName(awayAbbrev),
      awayTeamLogo: awayAbbrev,
      homeTeam: homeTeam?.displayName ?? getTeamDisplayName(homeAbbrev),
      homeTeamLogo: homeAbbrev,
      gameTime: ev.date,
      gameTimeDisplay,
      spread: absSpread,
      favoredTeam: awayFavorite ? 'away' : 'home',
      overUnder,
      tvNetwork: (Array.isArray(broadcast) ? broadcast[0] : broadcast) || (isFinal ? '' : 'TBD'),
      weather: weatherObj,
      homeScore: home?.score != null ? parseInt(String(home.score), 10) : undefined,
      awayScore: away?.score != null ? parseInt(String(away.score), 10) : undefined,
      status: isFinal ? 'final'
        : (statusName === 'STATUS_IN_PROGRESS' || statusName === 'STATUS_HALFTIME' || statusName === 'STATUS_END_PERIOD') ? 'in_progress'
        : 'scheduled',
    });

    dbRows.push({
      id: ev.id,
      week: resolvedWeek,
      seasonYear: s,
      seasonType: st === '1' ? 'preseason' : st === '3' ? 'postseason' : 'regular',
      homeTeam: homeAbbrev,
      awayTeam: awayAbbrev,
      gameTime,
      spread: signedSpread,
      overUnder,
      tvNetwork: (Array.isArray(broadcast) ? broadcast[0] : broadcast) || undefined,
      stadium: venue?.fullName ?? null,
      weather: weatherObj ? JSON.stringify(weatherObj) : null,
      homeScore: home?.score != null ? parseInt(String(home.score), 10) : undefined,
      awayScore: away?.score != null ? parseInt(String(away.score), 10) : undefined,
    });
  }

  return { games, dbRows };
}

/**
 * Fetch ESPN scoreboard using the standard week-based endpoint.
 * Returns null if the request fails (so caller can try fallback).
 */
async function fetchEspnByWeek(
  week: number | undefined,
  season: number,
  seasonType: string
): Promise<{ events: any[]; resolvedWeek: number } | null> {
  try {
    const params = new URLSearchParams({ season: String(season), seasontype: seasonType });
    if (week != null) params.set('week', String(week));

    const res = await fetch(`${ESPN_SCOREBOARD}?${params}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) return null;

    const data = await res.json() as any;
    if (!data || typeof data !== 'object') return null;

    const events = data.events || [];
    const resolvedWeek = week ?? data.week?.number ?? 1;
    return { events, resolvedWeek };
  } catch {
    return null;
  }
}

/**
 * Fetch ESPN scoreboard using the date-range endpoint.
 * This works for completed seasons where the week-based endpoint returns 500.
 * Uses the static schedule to determine the date range for a given week.
 */
async function fetchEspnByDateRange(
  week: number,
  season: number,
  seasonType: string
): Promise<{ events: any[] } | null> {
  // Get game dates from static schedule to determine the date range
  const weeks = (staticSchedule as { weeks?: Record<string, StaticGame[]> }).weeks;
  const weekGames = weeks?.[String(week)] ?? [];
  if (weekGames.length === 0) return null;

  // Find the min and max dates for this week's games
  const dates = weekGames.map(g => new Date(g.date));
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

  // Expand range by 1 day on each side to account for timezone differences
  minDate.setDate(minDate.getDate() - 1);
  maxDate.setDate(maxDate.getDate() + 1);

  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const dateRange = `${fmt(minDate)}-${fmt(maxDate)}`;

  try {
    const res = await fetch(`${ESPN_SCOREBOARD}?dates=${dateRange}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) return null;

    const data = await res.json() as any;
    if (!data || typeof data !== 'object') return null;

    return { events: data.events || [] };
  } catch {
    return null;
  }
}

export async function fetchEspnScoreboard(
  week?: number,
  season?: number,
  seasonType?: string
): Promise<{ games: EspnSlateGame[]; dbRows: EspnGameRow[]; week: number; season: number; source: 'espn' | 'static' }> {
  const ctx = getNflSeasonContext();
  const s = season ?? ctx.season;
  const st = seasonType ?? ctx.seasontype;
  const weekNum = week ?? 1;

  // 1. Try week-based ESPN endpoint (works for current/active season)
  const weekResult = await fetchEspnByWeek(week, s, st);
  if (weekResult && weekResult.events.length > 0) {
    const parsed = parseEspnEvents(weekResult.events, weekResult.resolvedWeek, s, st);
    await enrichWeatherForecasts(parsed.games, parsed.dbRows);
    return { ...parsed, week: weekResult.resolvedWeek, season: s, source: 'espn' };
  }

  // 2. Week-based failed (ESPN returns 500 for completed seasons) — try date-range endpoint
  const dateResult = await fetchEspnByDateRange(weekNum, s, st);
  if (dateResult && dateResult.events.length > 0) {
    const parsed = parseEspnEvents(dateResult.events, weekNum, s, st);
    await enrichWeatherForecasts(parsed.games, parsed.dbRows);
    return { ...parsed, week: weekNum, season: s, source: 'espn' };
  }

  // 3. Both ESPN methods failed — fall back to static schedule
  if (st === '2') {
    console.warn(`ESPN API unavailable for ${s} week ${weekNum}, using static schedule`);
    try {
      const fallback = loadStaticSchedule(weekNum, s, st);
      if (fallback.games.length > 0) {
        await enrichWeatherForecasts(fallback.games, fallback.dbRows);
        return { ...fallback, week: weekNum, season: s, source: 'static' };
      }
    } catch { /* static schedule doesn't exist for this season */ }
  }

  throw new Error(`ESPN unavailable and no static schedule for season ${s} week ${weekNum}`);
}

// ESPN uses WSH, static schedule may use WAS — normalize
const TEAM_ALIASES: Record<string, string> = { WSH: 'WAS', WAS: 'WSH' };

function teamMatch(a: string, b: string): boolean {
  return a === b || TEAM_ALIASES[a] === b;
}

/**
 * Look up the TV network from the static 2025 schedule by week and team matchup.
 * Handles home/away direction differences and team abbreviation aliases.
 * Returns null if not found.
 */
export function getStaticNetwork(week: number, homeTeam: string, awayTeam: string): string | null {
  const weeks = (staticSchedule as { weeks?: Record<string, StaticGame[]> }).weeks;
  const weekGames = weeks?.[String(week)] ?? [];
  const match = weekGames.find(g =>
    (teamMatch(g.home, homeTeam) && teamMatch(g.away, awayTeam)) ||
    (teamMatch(g.home, awayTeam) && teamMatch(g.away, homeTeam))
  );
  return match?.network ?? null;
}
