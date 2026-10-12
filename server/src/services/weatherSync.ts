/**
 * Game-day weather forecasts via Open-Meteo (free, no API key).
 * Fetches an hourly forecast for each outdoor stadium hosting an upcoming
 * game and stores the kickoff-hour reading on `nflGames.weather`, in the
 * same `{ displayValue, temperature }` JSON shape ESPN's own weather field
 * already uses (see services/espn.ts, routes/games.ts).
 */

import { and, eq, gte, lte } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { NFL_STADIUMS } from '../data/nflStadiums';

type DB = ReturnType<typeof drizzle<typeof schema>>;

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

// Open-Meteo's free forecast endpoint covers up to 16 days out; stay a
// couple of days inside that so every fetched game has real hourly data
// rather than the tail end of the window getting clipped.
const FORECAST_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

// An hourly bucket more than this far from kickoff isn't a useful stand-in
// for the actual kickoff-hour forecast.
const MAX_BUCKET_GAP_MS = 90 * 60 * 1000;

const DOME_WEATHER = { displayValue: 'Indoor', temperature: 72 };

export interface GameWeather {
  displayValue: string;
  temperature: number;
}

export interface WeatherSyncResult {
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
  total: number;
}

interface OpenMeteoResponse {
  hourly?: {
    time: string[];
    temperature_2m: number[];
    weathercode: number[];
  };
}

/** WMO weather codes (used by Open-Meteo) mapped to a short display label. */
function weatherCodeToDisplay(code: number): string {
  if (code === 0) return 'Clear';
  if (code === 1 || code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Cloudy';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain Showers';
  if (code >= 85 && code <= 86) return 'Snow Showers';
  if (code >= 95) return 'Thunderstorms';
  return 'Cloudy';
}

/**
 * Fetches the Open-Meteo hourly forecast for a stadium and returns the
 * reading closest to kickoff, or null if the forecast doesn't cover
 * kickoff closely enough (too far out, or the fetch failed).
 */
export async function fetchKickoffForecast(lat: number, lon: number, kickoff: Date): Promise<GameWeather | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      hourly: 'temperature_2m,weathercode',
      temperature_unit: 'fahrenheit',
      timezone: 'UTC',
      forecast_days: '16',
    });
    const res = await fetch(`${OPEN_METEO_URL}?${params}`);
    if (!res.ok) {
      console.warn(`[weather] Open-Meteo request failed for (${lat}, ${lon}): HTTP ${res.status} ${res.statusText}`);
      return null;
    }
    const data = (await res.json()) as OpenMeteoResponse;
    const hourly = data.hourly;
    if (!hourly?.time?.length) return null;

    const targetMs = kickoff.getTime();
    let closestIdx = -1;
    let closestGap = Infinity;
    for (let i = 0; i < hourly.time.length; i++) {
      // Requested with timezone=UTC, so Open-Meteo's naive local-looking
      // timestamps are already UTC.
      const bucketMs = Date.parse(`${hourly.time[i]}Z`);
      const gap = Math.abs(bucketMs - targetMs);
      if (gap < closestGap) {
        closestGap = gap;
        closestIdx = i;
      }
    }
    if (closestIdx === -1 || closestGap > MAX_BUCKET_GAP_MS) return null;

    const temperature = Math.round(hourly.temperature_2m[closestIdx]);
    const displayValue = weatherCodeToDisplay(hourly.weathercode[closestIdx]);
    return { displayValue, temperature };
  } catch (err) {
    console.warn(`[weather] Open-Meteo request threw for (${lat}, ${lon}):`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Refreshes stored weather for every not-yet-complete game kicking off
 * within the forecast window. Dome games get a fixed "Indoor" reading with
 * no outbound fetch; outdoor games get the Open-Meteo forecast closest to
 * kickoff. A game whose home team isn't in `NFL_STADIUMS`, or whose fetch
 * fails, is skipped/counted as failed rather than aborting the whole sync.
 */
export async function syncGameWeather(db: DB, now: Date = new Date()): Promise<WeatherSyncResult> {
  const windowEnd = new Date(now.getTime() + FORECAST_WINDOW_MS);
  const games = await db.query.nflGames.findMany({
    where: and(
      eq(schema.nflGames.isComplete, false),
      gte(schema.nflGames.gameTime, now),
      lte(schema.nflGames.gameTime, windowEnd)
    ),
    columns: { id: true, homeTeam: true, gameTime: true, weather: true },
  });

  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  let failed = 0;

  for (const game of games) {
    const stadium = NFL_STADIUMS[game.homeTeam];
    if (!stadium) {
      skipped++;
      continue;
    }

    const weather: GameWeather | null = stadium.dome
      ? DOME_WEATHER
      : await fetchKickoffForecast(stadium.lat, stadium.lon, game.gameTime);

    if (!weather) {
      failed++;
      continue;
    }

    const serialized = JSON.stringify(weather);
    if (game.weather === serialized) {
      unchanged++;
      continue;
    }

    try {
      await db.update(schema.nflGames).set({ weather: serialized }).where(eq(schema.nflGames.id, game.id));
      updated++;
    } catch (err) {
      console.error(`[weather] Failed to store weather for game ${game.id}:`, err);
      failed++;
    }
  }

  return { updated, unchanged, skipped, failed, total: games.length };
}
