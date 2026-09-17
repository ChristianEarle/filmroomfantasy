/**
 * Real weather forecasts for outdoor NFL games via Open-Meteo (free, no API key).
 * Used by espn.ts to fill in the `weather` field for future outdoor games that
 * ESPN hasn't attached its own forecast to yet (ESPN typically only sets
 * `event.weather` within ~a week of kickoff).
 */

const OPEN_METEO_FORECAST = 'https://api.open-meteo.com/v1/forecast';

// Open-Meteo's hourly forecast only extends this far out.
const MAX_FORECAST_DAYS = 16;

// Only trust a forecast hour if it's within this many ms of actual kickoff.
const MAX_HOUR_DRIFT_MS = 90 * 60 * 1000;

/** Home stadium coordinates, keyed by team abbreviation. */
const STADIUM_COORDS: Record<string, { lat: number; lon: number }> = {
  ARI: { lat: 33.5276, lon: -112.2626 },
  ATL: { lat: 33.7554, lon: -84.4008 },
  BAL: { lat: 39.2780, lon: -76.6227 },
  BUF: { lat: 42.7738, lon: -78.7870 },
  CAR: { lat: 35.2258, lon: -80.8528 },
  CHI: { lat: 41.8623, lon: -87.6167 },
  CIN: { lat: 39.0954, lon: -84.5160 },
  CLE: { lat: 41.5061, lon: -81.6995 },
  DAL: { lat: 32.7473, lon: -97.0945 },
  DEN: { lat: 39.7439, lon: -105.0201 },
  DET: { lat: 42.3400, lon: -83.0456 },
  GB: { lat: 44.5013, lon: -88.0622 },
  HOU: { lat: 29.6847, lon: -95.4107 },
  IND: { lat: 39.7601, lon: -86.1639 },
  JAX: { lat: 30.3239, lon: -81.6373 },
  KC: { lat: 39.0489, lon: -94.4839 },
  LAC: { lat: 33.9535, lon: -118.3392 },
  LAR: { lat: 33.9535, lon: -118.3392 },
  LV: { lat: 36.0909, lon: -115.1833 },
  MIA: { lat: 25.9580, lon: -80.2389 },
  MIN: { lat: 44.9738, lon: -93.2577 },
  NE: { lat: 42.0909, lon: -71.2643 },
  NO: { lat: 29.9511, lon: -90.0812 },
  NYG: { lat: 40.8135, lon: -74.0745 },
  NYJ: { lat: 40.8135, lon: -74.0745 },
  PHI: { lat: 39.9008, lon: -75.1675 },
  PIT: { lat: 40.4468, lon: -80.0158 },
  SEA: { lat: 47.5952, lon: -122.3316 },
  SF: { lat: 37.4030, lon: -121.9700 },
  TB: { lat: 27.9759, lon: -82.5033 },
  TEN: { lat: 36.1665, lon: -86.7713 },
  WAS: { lat: 38.9077, lon: -76.8645 },
  WSH: { lat: 38.9077, lon: -76.8645 },
};

// WMO weather codes (Open-Meteo's `weathercode`) collapsed to display labels
// that match the icon matching in GameSlateView/GameDetailModal's WeatherIcon
// (looks for "rain", "snow", "sunny"/"clear", "indoor", "outdoor").
const WEATHER_CODE_LABELS: Record<number, string> = {
  0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Cloudy',
  45: 'Fog', 48: 'Fog',
  51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
  56: 'Freezing Drizzle', 57: 'Freezing Drizzle',
  61: 'Rain', 63: 'Rain', 65: 'Rain',
  66: 'Freezing Rain', 67: 'Freezing Rain',
  71: 'Snow', 73: 'Snow', 75: 'Snow', 77: 'Snow',
  80: 'Rain Showers', 81: 'Rain Showers', 82: 'Rain Showers',
  85: 'Snow Showers', 86: 'Snow Showers',
  95: 'Thunderstorms', 96: 'Thunderstorms', 99: 'Thunderstorms',
};

export interface StadiumForecast {
  displayValue: string;
  temperature: number;
}

interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  weathercode: number[];
}

/**
 * Fetch real weather forecasts for a batch of (team, kickoff time) pairs in a
 * single request (Open-Meteo accepts comma-separated lat/lon lists). Returns
 * one entry per input, in the same order; an entry is `null` when the team
 * has no known stadium, the game is outside Open-Meteo's forecast window, or
 * the request fails — callers should treat `null` as "no forecast available"
 * and fall back to their existing behavior.
 */
export async function fetchStadiumForecasts(
  targets: Array<{ team: string; gameTime: Date }>
): Promise<Array<StadiumForecast | null>> {
  const results: Array<StadiumForecast | null> = targets.map(() => null);
  if (targets.length === 0) return results;

  const now = Date.now();
  const usable: number[] = [];
  for (let i = 0; i < targets.length; i++) {
    const coords = STADIUM_COORDS[targets[i].team];
    if (!coords) continue;
    const daysOut = (targets[i].gameTime.getTime() - now) / 86_400_000;
    if (daysOut < 0 || daysOut > MAX_FORECAST_DAYS) continue;
    usable.push(i);
  }
  if (usable.length === 0) return results;

  const forecastDays = Math.min(
    MAX_FORECAST_DAYS,
    Math.max(1, Math.ceil(Math.max(...usable.map(i => (targets[i].gameTime.getTime() - now) / 86_400_000))) + 1)
  );

  const lat = usable.map(i => STADIUM_COORDS[targets[i].team].lat).join(',');
  const lon = usable.map(i => STADIUM_COORDS[targets[i].team].lon).join(',');

  try {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      hourly: 'temperature_2m,weathercode',
      temperature_unit: 'fahrenheit',
      timezone: 'UTC',
      forecast_days: String(forecastDays),
    });
    const res = await fetch(`${OPEN_METEO_FORECAST}?${params}`);
    if (!res.ok) return results;

    const data = await res.json() as { hourly?: OpenMeteoHourly } | Array<{ hourly?: OpenMeteoHourly }>;
    // Open-Meteo returns a bare object for a single location, an array for
    // multiple — normalize to an array so single-target batches also work.
    const locations = Array.isArray(data) ? data : [data];

    usable.forEach((targetIndex, batchIndex) => {
      const hourly = locations[batchIndex]?.hourly;
      if (!hourly?.time?.length) return;

      const kickoffMs = targets[targetIndex].gameTime.getTime();
      let bestIdx = 0;
      let bestDiff = Infinity;
      for (let i = 0; i < hourly.time.length; i++) {
        const diff = Math.abs(new Date(`${hourly.time[i]}Z`).getTime() - kickoffMs);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      }
      if (bestDiff > MAX_HOUR_DRIFT_MS) return;

      const temperature = hourly.temperature_2m?.[bestIdx];
      const code = hourly.weathercode?.[bestIdx];
      if (temperature == null) return;

      results[targetIndex] = {
        displayValue: WEATHER_CODE_LABELS[code] ?? 'Cloudy',
        temperature: Math.round(temperature),
      };
    });
  } catch (err) {
    console.warn('[weather] forecast fetch failed:', err instanceof Error ? err.message : err);
  }

  return results;
}
