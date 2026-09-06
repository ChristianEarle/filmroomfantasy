import { describe, it, expect } from 'vitest';
import { mapSleeperPlayerToDb, mapStatus, type SleeperPlayer } from './sleeper';

describe('mapSleeperPlayerToDb', () => {
  it('maps a fantasy-relevant player to the expected DB shape (id is random, everything else asserted)', () => {
    const player: SleeperPlayer = {
      player_id: '4046',
      first_name: 'Patrick',
      last_name: 'Mahomes',
      full_name: 'Patrick Mahomes',
      team: 'KC',
      position: 'QB',
      status: 'Active',
      injury_status: null,
      age: 29,
      height: '6\'3"',
      weight: '225',
      college: 'Texas Tech',
      years_exp: 8,
      number: 15,
      depth_chart_order: 1,
      espn_id: 3139477,
    };

    const mapped = mapSleeperPlayerToDb('4046', player);

    expect(mapped).not.toBeNull();
    expect(typeof mapped!.id).toBe('string');
    expect(mapped!.id.length).toBeGreaterThan(0);
    expect(mapped).toMatchObject({
      externalId: '4046',
      name: 'Patrick Mahomes',
      firstName: 'Patrick',
      lastName: 'Mahomes',
      team: 'KC',
      position: 'QB',
      status: 'active',
      injuryNote: null,
      headshotUrl: 'https://a.espncdn.com/i/headshots/nfl/players/full/3139477.png',
      age: 29,
      weight: 225,
      college: 'Texas Tech',
      yearsExp: 8,
      jerseyNumber: 15,
      depthChartOrder: 1,
    });
  });

  it('returns null for non-fantasy positions (e.g. offensive line)', () => {
    const player: SleeperPlayer = {
      player_id: '9999',
      first_name: 'Some',
      last_name: 'Lineman',
      position: 'OL',
      team: 'KC',
    };
    expect(mapSleeperPlayerToDb('9999', player)).toBeNull();
  });
});

describe('mapStatus', () => {
  it('treats Sleeper "Invalid" data-quality flags as active', () => {
    expect(mapStatus('Invalid', null)).toBe('active');
    expect(mapStatus('Active', 'Invalid')).toBe('active');
  });

  it('maps injury_status over the base status when present', () => {
    expect(mapStatus('Active', 'Questionable')).toBe('questionable');
    expect(mapStatus('Active', 'Out')).toBe('out');
  });
});
