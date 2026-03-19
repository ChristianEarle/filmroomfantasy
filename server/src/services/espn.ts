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
    return { ...parsed, week: weekResult.resolvedWeek, season: s, source: 'espn' };
  }

  // 2. Week-based failed (ESPN returns 500 for completed seasons) — try date-range endpoint
  const dateResult = await fetchEspnByDateRange(weekNum, s, st);
  if (dateResult && dateResult.events.length > 0) {
    const parsed = parseEspnEvents(dateResult.events, weekNum, s, st);
    return { ...parsed, week: weekNum, season: s, source: 'espn' };
  }

  // 3. Both ESPN methods failed — fall back to static schedule
  if (st === '2') {
    console.warn(`ESPN API unavailable for ${s} week ${weekNum}, using static schedule`);
    try {
      const fallback = loadStaticSchedule(weekNum, s, st);
      if (fallback.games.length > 0) {
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
