// Free, no-API-key stadium forecasts for outdoor NFL games (Open-Meteo).
// ESPN's own scoreboard `weather` field (see services/espn.ts) only
// populates within a few hours of kickoff and never carries wind/precip —
// this fills the gap earlier in the week with a real hourly forecast.

// NFL teams that play in indoor/dome/retractable-roof stadiums — mirrors
// the set in routes/games.ts (kept here too so callers that only need the
// weather layer don't have to import a whole route file).
export const INDOOR_TEAMS = new Set(['NO', 'DET', 'MIN', 'LV', 'IND', 'ATL', 'DAL', 'HOU', 'ARI']);

export interface StadiumCoords {
  lat: number;
  lon: number;
}

// Home stadium coordinates for every NFL team, keyed by the abbreviation
// used throughout this codebase (see TEAM_NAMES in services/espn.ts).
// Indoor teams are included for completeness; callers should skip them via
// INDOOR_TEAMS since a dome forecast is meaningless for gameplay.
export const STADIUM_COORDS: Record<string, StadiumCoords> = {
  ARI: { lat: 33.5276, lon: -112.2626 },
  ATL: { lat: 33.7554, lon: -84.4008 },
  BAL: { lat: 39.2780, lon: -76.6227 },
  BUF: { lat: 42.7738, lon: -78.7870 },
  CAR: { lat: 35.2258, lon: -80.8528 },
  CHI: { lat: 41.8623, lon: -87.6167 },
  CIN: { lat: 39.0955, lon: -84.5160 },
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
  MIN: { lat: 44.9737, lon: -93.2581 },
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
  WAS: { lat: 38.9076, lon: -76.8645 },
  WSH: { lat: 38.9076, lon: -76.8645 },
};

export interface WeatherForecast {
  displayValue: string;
  temperature: number;
  windMph: number;
  precipChance: number;
}

// WMO weather codes (Open-Meteo's `weathercode`) -> short display label.
// https://open-meteo.com/en/docs#weathervariables
function describeWeatherCode(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly Cloudy';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain Showers';
  if (code >= 85 && code <= 86) return 'Snow Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Cloudy';
}

/**
 * Fetches an hourly forecast for a stadium at kickoff time from Open-Meteo
 * (free, no API key, no rate-limit auth needed). Returns null if the game
 * falls outside Open-Meteo's ~16-day forecast window or the request fails.
 */
export async function fetchStadiumForecast(
  coords: StadiumCoords,
  gameTime: Date
): Promise<WeatherForecast | null> {
  const daysOut = (gameTime.getTime() - Date.now()) / (24 * 3600 * 1000);
  if (daysOut < 0 || daysOut > 15) return null;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
    `&hourly=temperature_2m,precipitation_probability,windspeed_10m,weathercode` +
    `&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=UTC&forecast_days=16`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const data = (await res.json()) as {
    hourly?: {
      time: string[];
      temperature_2m: number[];
      precipitation_probability: number[];
      windspeed_10m: number[];
      weathercode: number[];
    };
  };
  const hourly = data.hourly;
  if (!hourly?.time?.length) return null;

  // Open-Meteo returns local-timezone-naive timestamps ("2026-10-05T13:00")
  // since we asked for timezone=UTC — append Z to parse them as UTC.
  const targetMs = gameTime.getTime();
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < hourly.time.length; i++) {
    const diff = Math.abs(new Date(`${hourly.time[i]}Z`).getTime() - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }

  return {
    displayValue: describeWeatherCode(hourly.weathercode[bestIdx]),
    temperature: Math.round(hourly.temperature_2m[bestIdx]),
    windMph: Math.round(hourly.windspeed_10m[bestIdx]),
    precipChance: Math.round(hourly.precipitation_probability[bestIdx]),
  };
}
