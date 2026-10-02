import { describe, expect, it } from 'vitest';
import { findDuplicateTeamGroups, pickKeeperTeam, resolveActingUserTeam } from './teamDedupe';

describe('pickKeeperTeam', () => {
  it('keeps the most recently synced row', () => {
    const rows = [
      { id: 'stale', updatedAt: new Date('2026-04-11'), createdAt: new Date('2026-03-30') },
      { id: 'fresh', updatedAt: new Date('2026-10-02'), createdAt: new Date('2026-04-08') },
    ];
    expect(pickKeeperTeam(rows).id).toBe('fresh');
  });

  it('breaks an updatedAt tie toward the oldest row, then by id', () => {
    const t = new Date('2026-10-02');
    expect(pickKeeperTeam([
      { id: 'b', updatedAt: t, createdAt: new Date('2026-04-08') },
      { id: 'a', updatedAt: t, createdAt: new Date('2026-03-30') },
    ]).id).toBe('a');
    expect(pickKeeperTeam([
      { id: 'b', updatedAt: t, createdAt: t },
      { id: 'a', updatedAt: t, createdAt: t },
    ]).id).toBe('a');
  });
});

describe('findDuplicateTeamGroups', () => {
  it('groups only linked rows that share a Sleeper owner', () => {
    const groups = findDuplicateTeamGroups([
      { externalOwnerId: 'x' },
      { externalOwnerId: 'x' },
      { externalOwnerId: 'y' },
      { externalOwnerId: null },
      { externalOwnerId: null },
    ]);
    expect([...groups.keys()]).toEqual(['x']);
    expect(groups.get('x')).toHaveLength(2);
  });
});

describe('resolveActingUserTeam', () => {
  const mine = { id: 'mine', ownerId: 'other-app-user', externalOwnerId: 'sleeper-me' };
  const opponentOwnedByMe = { id: 'opp', ownerId: 'me', externalOwnerId: 'sleeper-opp' };
  const unlinkedMine = { id: 'custom', ownerId: 'me', externalOwnerId: null };

  it('prefers the row linked to the acting user’s Sleeper id even when the app owner is someone else', () => {
    expect(resolveActingUserTeam([opponentOwnedByMe, mine], 'me', 'sleeper-me')?.id).toBe('mine');
  });

  it('never claims an opponent’s linked row just because the app owner is the acting user', () => {
    // This was the duplicate-row bug: ownerId matched first and grabbed an
    // opponent's placeholder-owned row.
    expect(resolveActingUserTeam([opponentOwnedByMe], 'me', 'sleeper-me')).toBeUndefined();
    expect(resolveActingUserTeam([opponentOwnedByMe], 'me', null)).toBeUndefined();
  });

  it('falls back to a never-linked row the acting user owns (pre-Sleeper custom team)', () => {
    expect(resolveActingUserTeam([opponentOwnedByMe, unlinkedMine], 'me', 'sleeper-me')?.id).toBe('custom');
    expect(resolveActingUserTeam([unlinkedMine], 'me', null)?.id).toBe('custom');
  });

  it('returns nothing without an acting user', () => {
    expect(resolveActingUserTeam([mine, unlinkedMine], null, 'sleeper-me')).toBeUndefined();
  });
});
