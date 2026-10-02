import { describe, expect, it } from 'vitest';
import { sleeperWeeklyByPlayer } from './sleeperWeekly';

describe('sleeperWeeklyByPlayer', () => {
  it('keys the array shape by player_id and flattens nested stats', () => {
    const raw = [
      { player_id: '4034', opponent: 'DAL', stats: { pts_ppr: 24.88, rush_yd: 92 } },
      { player_id: 'HOU', opponent: 'JAX', stats: { pts_ppr: 7 } },
    ];

    const byPlayer = sleeperWeeklyByPlayer(raw);

    expect(byPlayer.get('4034')).toEqual({ pts_ppr: 24.88, rush_yd: 92, opponent: 'DAL' });
    expect(byPlayer.get('HOU')).toEqual({ pts_ppr: 7, opponent: 'JAX' });
  });

  it('never resolves a small numeric id to an array position', () => {
    const raw = [
      { player_id: '9999', stats: { pts_ppr: 30 } },
      { player_id: '8888', stats: { pts_ppr: 20 } },
    ];

    const byPlayer = sleeperWeeklyByPlayer(raw);

    expect(byPlayer.has('0')).toBe(false);
    expect(byPlayer.has('1')).toBe(false);
    expect(byPlayer.size).toBe(2);
  });

  it('skips array entries without a player id or stats', () => {
    const byPlayer = sleeperWeeklyByPlayer([{ stats: { pts_ppr: 5 } }, { player_id: '96' }, null]);

    expect(byPlayer.size).toBe(1);
    expect(byPlayer.get('96')).toEqual({ opponent: undefined });
  });

  it('passes the object shape through unchanged', () => {
    const raw = { '421': { pts_ppr: 18.2, pass_yd: 280 }, '96': null };

    const byPlayer = sleeperWeeklyByPlayer(raw);

    expect(byPlayer.get('421')).toEqual({ pts_ppr: 18.2, pass_yd: 280 });
    expect(byPlayer.has('96')).toBe(false);
  });

  it('returns an empty map for anything else', () => {
    expect(sleeperWeeklyByPlayer(null).size).toBe(0);
    expect(sleeperWeeklyByPlayer('[]').size).toBe(0);
  });
});
