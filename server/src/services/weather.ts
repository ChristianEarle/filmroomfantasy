/**
 * Open-Meteo forecast integration for outdoor NFL stadiums.
 * Free, no API key required. Forecast window is ~16 days out — games
 * further away than that return null and keep the generic "Outdoor" label.
 */

// NFL teams that play in indoor / dome / retractable-roof stadiums — these
// never need a weather forecast (fixed 72°F "Indoor" fallback elsewhere).
export const INDOOR_TEAMS = new Set(['NO', 'DET', 'MIN', 'LV', 'IND', 'ATL', 'DAL', 'HOU', 'ARI']);

export function isIndoorStadium(teamAbbrev: string): boolean {
  return INDOOR_TEAMS.has(teamAbbrev);
}

// Approximate stadium coordinates for every NFL team (WSH/WAS both present
// since ESPN and our own team data disagree on the abbreviation).
export const TEAM_STADIUM_COORDS: Record<string, { lat: number; lon: number }> = {
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
  MIN: { lat: 44.9738, lon: -93.2575 },
  NE: { lat: 42.0909, lon: -71.2643 },
  NO: { lat: 29.9511, lon: -90.0812 },
  NYG: { lat: 40.8135, lon: -74.0745 },
  NYJ: { lat: 40.8135, lon: -74.0745 },
  PHI: { lat: 39.9008, lon: -75.1675 },
  PIT: { lat: 40.4468, lon: -80.0158 },
  SEA: { lat: 47.5952, lon: -122.3316 },
  SF: { lat: 37.4032, lon: -121.9698 },
  TB: { lat: 27.9759, lon: -82.5033 },
  TEN: { lat: 36.1665, lon: -86.7713 },
  WAS: { lat: 38.9076, lon: -76.8645 },
  WSH: { lat: 38.9076, lon: -76.8645 },
};

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

export interface StadiumForecast {
  displayValue: string;
  temperature: number;
  windMph: number;
  precipChance: number;
}

// Simplified WMO weather-code -> short label mapping (matches the subset
// GameSlateView's WeatherIcon already keys off: rain/snow/sunny/clear).
function describeWeatherCode(code: number | undefined): string {
  if (code == null) return 'Outdoor';
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Cloudy';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'Rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'Snow';
  if (code >= 95) return 'Thunderstorm';
  return 'Outdoor';
}

interface OpenMeteoResponse {
  hourly?: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    wind_speed_10m: number[];
    weather_code: number[];
  };
}

/**
 * Fetch the hourly forecast closest to kickoff for a team's home stadium.
 * Returns null for indoor teams, unknown teams, and games outside
 * Open-Meteo's ~16-day forecast window (caller keeps the generic label).
 */
export async function fetchStadiumForecast(
  teamAbbrev: string,
  gameTime: Date
): Promise<StadiumForecast | null> {
  if (isIndoorStadium(teamAbbrev)) return null;
  const coords = TEAM_STADIUM_COORDS[teamAbbrev];
  if (!coords) return null;

  const daysOut = (gameTime.getTime() - Date.now()) / 86_400_000;
  if (daysOut < -0.25 || daysOut > 15) return null;

  const params = new URLSearchParams({
    latitude: String(coords.lat),
    longitude: String(coords.lon),
    hourly: 'temperature_2m,precipitation_probability,wind_speed_10m,weather_code',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'UTC',
    forecast_days: '16',
  });

  try {
    const res = await fetch(`${OPEN_METEO_URL}?${params}`);
    if (!res.ok) return null;
    const data = (await res.json()) as OpenMeteoResponse;
    const hourly = data.hourly;
    if (!hourly?.time?.length) return null;

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

    const temperature = hourly.temperature_2m[bestIdx];
    if (temperature == null) return null;

    return {
      displayValue: describeWeatherCode(hourly.weather_code?.[bestIdx]),
      temperature: Math.round(temperature),
      windMph: Math.round(hourly.wind_speed_10m[bestIdx] ?? 0),
      precipChance: Math.round(hourly.precipitation_probability[bestIdx] ?? 0),
    };
  } catch {
    return null;
  }
}
