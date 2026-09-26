import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchStadiumForecast } from './weather';

function stubFetch(body: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      json: async () => body,
    } as unknown as Response),
  );
}

/** Builds an Open-Meteo-shaped hourly response starting at `startIso`. */
function hourlyFixture(startIso: string, entries: Array<{ temp: number; code: number }>) {
  const start = new Date(startIso);
  return {
    hourly: {
      time: entries.map((_, i) => new Date(start.getTime() + i * 3600000).toISOString().slice(0, 16)),
      temperature_2m: entries.map((e) => e.temp),
      weathercode: entries.map((e) => e.code),
    },
  };
}

describe('fetchStadiumForecast', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the forecast for the hourly slot closest to game time', async () => {
    stubFetch(hourlyFixture('2026-10-04T00:00:00.000Z', [
      { temp: 50, code: 0 },
      { temp: 55, code: 1 },
      { temp: 62, code: 61 }, // 2026-10-04T02:00Z — matches the game time below
      { temp: 58, code: 3 },
    ]));

    const forecast = await fetchStadiumForecast('GB', new Date('2026-10-04T02:00:00.000Z'));

    expect(forecast).toEqual({ displayValue: 'Rain', temperature: 62 });
  });

  it('maps clear/cloudy/snow codes to their display labels', async () => {
    stubFetch(hourlyFixture('2026-10-04T00:00:00.000Z', [{ temp: 20, code: 71 }]));
    const forecast = await fetchStadiumForecast('BUF', new Date('2026-10-04T00:00:00.000Z'));
    expect(forecast).toEqual({ displayValue: 'Snow', temperature: 20 });
  });

  it('returns null for a team with no known stadium coordinates', async () => {
    stubFetch(hourlyFixture('2026-10-04T00:00:00.000Z', [{ temp: 60, code: 0 }]));
    const forecast = await fetchStadiumForecast('ZZZ', new Date('2026-10-04T00:00:00.000Z'));
    expect(forecast).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns null when the game time falls outside the forecast window', async () => {
    stubFetch(hourlyFixture('2026-10-04T00:00:00.000Z', [{ temp: 60, code: 0 }]));
    const forecast = await fetchStadiumForecast('GB', new Date('2026-11-04T00:00:00.000Z'));
    expect(forecast).toBeNull();
  });

  it('returns null on HTTP failure', async () => {
    stubFetch({}, false);
    const forecast = await fetchStadiumForecast('GB', new Date('2026-10-04T00:00:00.000Z'));
    expect(forecast).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const forecast = await fetchStadiumForecast('GB', new Date('2026-10-04T00:00:00.000Z'));
    expect(forecast).toBeNull();
  });
});
