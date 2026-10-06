/**
 * NFL stadium locations, keyed by home-team abbreviation (matching
 * `nflGames.homeTeam`). Used to fetch a per-game weather forecast and to
 * flag domed/fixed-roof stadiums that never need one.
 *
 * `dome: true` means weather is never a game factor: fixed-roof domes
 * (NO, DET, MIN, LV) and retractable-roof stadiums whose roof is closed for
 * essentially every game (IND, ATL, DAL, HOU, ARI). Mirrors the
 * `INDOOR_TEAMS` set previously duplicated in services/espn.ts and
 * routes/games.ts.
 *
 * LAR/LAC (SoFi Stadium) has a translucent canopy but an open-air field, so
 * it's listed as outdoor, matching the prior INDOOR_TEAMS exclusion.
 */
export interface StadiumInfo {
  lat: number;
  lon: number;
  dome: boolean;
}

export const NFL_STADIUMS: Record<string, StadiumInfo> = {
  ARI: { lat: 33.5276, lon: -112.2626, dome: true }, // State Farm Stadium
  ATL: { lat: 33.7554, lon: -84.4008, dome: true }, // Mercedes-Benz Stadium
  BAL: { lat: 39.2780, lon: -76.6227, dome: false }, // M&T Bank Stadium
  BUF: { lat: 42.7738, lon: -78.7870, dome: false }, // Highmark Stadium
  CAR: { lat: 35.2258, lon: -80.8528, dome: false }, // Bank of America Stadium
  CHI: { lat: 41.8623, lon: -87.6167, dome: false }, // Soldier Field
  CIN: { lat: 39.0955, lon: -84.5160, dome: false }, // Paycor Stadium
  CLE: { lat: 41.5061, lon: -81.6995, dome: false }, // Huntington Bank Field
  DAL: { lat: 32.7473, lon: -97.0945, dome: true }, // AT&T Stadium
  DEN: { lat: 39.7439, lon: -105.0201, dome: false }, // Empower Field at Mile High
  DET: { lat: 42.3400, lon: -83.0456, dome: true }, // Ford Field
  GB: { lat: 44.5013, lon: -88.0622, dome: false }, // Lambeau Field
  HOU: { lat: 29.6847, lon: -95.4107, dome: true }, // NRG Stadium
  IND: { lat: 39.7601, lon: -86.1639, dome: true }, // Lucas Oil Stadium
  JAX: { lat: 30.3239, lon: -81.6373, dome: false }, // EverBank Stadium
  KC: { lat: 39.0489, lon: -94.4839, dome: false }, // GEHA Field at Arrowhead Stadium
  LAC: { lat: 33.9535, lon: -118.3392, dome: false }, // SoFi Stadium
  LAR: { lat: 33.9535, lon: -118.3392, dome: false }, // SoFi Stadium
  LV: { lat: 36.0909, lon: -115.1833, dome: true }, // Allegiant Stadium
  MIA: { lat: 25.9580, lon: -80.2389, dome: false }, // Hard Rock Stadium
  MIN: { lat: 44.9735, lon: -93.2575, dome: true }, // U.S. Bank Stadium
  NE: { lat: 42.0909, lon: -71.2643, dome: false }, // Gillette Stadium
  NO: { lat: 29.9511, lon: -90.0812, dome: true }, // Caesars Superdome
  NYG: { lat: 40.8128, lon: -74.0742, dome: false }, // MetLife Stadium
  NYJ: { lat: 40.8128, lon: -74.0742, dome: false }, // MetLife Stadium
  PHI: { lat: 39.9008, lon: -75.1675, dome: false }, // Lincoln Financial Field
  PIT: { lat: 40.4468, lon: -80.0158, dome: false }, // Acrisure Stadium
  SEA: { lat: 47.5952, lon: -122.3316, dome: false }, // Lumen Field
  SF: { lat: 37.4030, lon: -121.9700, dome: false }, // Levi's Stadium
  TB: { lat: 27.9759, lon: -82.5033, dome: false }, // Raymond James Stadium
  TEN: { lat: 36.1665, lon: -86.7713, dome: false }, // Nissan Stadium
  WAS: { lat: 38.9077, lon: -76.8645, dome: false }, // Northwest Stadium
  WSH: { lat: 38.9077, lon: -76.8645, dome: false }, // Northwest Stadium (ESPN abbreviation alias)
};

export function getStadiumInfo(teamAbbrev: string): StadiumInfo | undefined {
  return NFL_STADIUMS[teamAbbrev];
}

export function isDomeTeam(teamAbbrev: string): boolean {
  return NFL_STADIUMS[teamAbbrev]?.dome ?? false;
}
