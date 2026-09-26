/**
 * Open-Meteo forecast integration for outdoor NFL games.
 * Free, no API key required. Docs: https://open-meteo.com/en/docs
 */

/**
 * Home stadium coordinates by team abbreviation. Approximate (city/stadium
 * centroid) — good enough for an hourly forecast lookup, not for anything
 * requiring survey-grade precision.
 */
export const STADIUM_COORDS: Record<string, { lat: number; lon: number }> = {
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
  MIN: { lat: 44.9740, lon: -93.2581 },
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
  WAS: { lat: 38.9077, lon: -76.8645 },
  WSH: { lat: 38.9077, lon: -76.8645 },
};

/**
 * WMO weather codes (used by Open-Meteo) collapsed into the short labels
 * `WeatherIcon` (src/components/GameSlateView.tsx) already knows how to
 * pick an icon for via substring match on "rain"/"snow"/"sunny"/"clear".
 */
function weatherCodeToDisplay(code: number): string {
  if (code === 0) return 'Clear';
  if (code === 1 || code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Cloudy';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'Rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'Snow';
  if (code >= 95 && code <= 99) return 'Thunderstorms';
  return 'Cloudy';
}

interface OpenMeteoResponse {
  hourly?: {
    time: string[];
    temperature_2m: number[];
    weathercode: number[];
  };
}

export interface StadiumForecast {
  displayValue: string;
  temperature: number;
}

/**
 * Fetch the forecast for a specific game hour at a stadium's coordinates.
 * Returns null on any failure (missing coords, HTTP error, no matching
 * hourly slot) so callers can leave existing weather data untouched rather
 * than overwriting it with a guess.
 */
export async function fetchStadiumForecast(
  homeTeam: string,
  gameTime: Date,
): Promise<StadiumForecast | null> {
  const coords = STADIUM_COORDS[homeTeam];
  if (!coords) return null;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
    `&hourly=temperature_2m,weathercode&temperature_unit=fahrenheit&timezone=UTC&forecast_days=16`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.warn(`[weather] Open-Meteo HTTP ${res.status} for ${homeTeam}`);
      return null;
    }

    const data = (await res.json()) as OpenMeteoResponse;
    const times = data.hourly?.time;
    const temps = data.hourly?.temperature_2m;
    const codes = data.hourly?.weathercode;
    if (!times || !temps || !codes || times.length === 0) return null;

    // Open-Meteo returns hourly UTC timestamps as "YYYY-MM-DDTHH:mm" with no
    // trailing "Z" — append it so `new Date(...)` parses as UTC rather than
    // the runtime's local timezone.
    const targetMs = gameTime.getTime();
    let closestIndex = 0;
    let closestDiff = Infinity;
    for (let i = 0; i < times.length; i++) {
      const diff = Math.abs(new Date(`${times[i]}Z`).getTime() - targetMs);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = i;
      }
    }

    // More than 2 hours from the nearest hourly slot means the game falls
    // outside the forecast window (too far out, or bad game_time data) —
    // don't report a forecast for the wrong hour.
    if (closestDiff > 2 * 60 * 60 * 1000) return null;

    const temperature = temps[closestIndex];
    const code = codes[closestIndex];
    if (temperature == null || code == null) return null;

    return {
      displayValue: weatherCodeToDisplay(code),
      temperature: Math.round(temperature),
    };
  } catch (err) {
    console.error(`[weather] forecast fetch failed for ${homeTeam}:`, err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
