import { describe, expect, it } from 'vitest';
import { assignRowsToPlatformTeams, pickKeeperTeam, type PlatformTeam } from './teamIdentity';

type Row = { id: string; ownerId: string; externalOwnerId: string | null; externalTeamId: string | null };
const row = (id: string, ownerId: string, externalOwnerId: string | null, externalTeamId: string | null = null): Row => ({
  id, ownerId, externalOwnerId, externalTeamId,
});

describe('assignRowsToPlatformTeams', () => {
  const platform: PlatformTeam[] = [
    { externalTeamId: '1', legacyOwnerKey: 'sleeper-a', appUserId: 'app-a' },
    { externalTeamId: '2', legacyOwnerKey: 'sleeper-b', appUserId: null },
  ];

  it('matches on the platform team key first', () => {
    const { groups, orphans } = assignRowsToPlatformTeams([row('r1', 'x', 'someone-else', '1')], platform);
    expect(groups.get('1')?.map((r) => r.id)).toEqual(['r1']);
    expect(orphans).toEqual([]);
  });

  it('adopts rows written before team keys existed by their legacy owner key', () => {
    const { groups } = assignRowsToPlatformTeams([row('legacy', 'x', 'sleeper-b')], platform);
    expect(groups.get('2')?.map((r) => r.id)).toEqual(['legacy']);
  });

  it('groups every row for the same platform team so they can be merged (the Skeetsters shape)', () => {
    const { groups } = assignRowsToPlatformTeams([row('stale', 'u1', 'sleeper-a'), row('fresh', 'u2', 'sleeper-a')], platform);
    expect(groups.get('1')?.map((r) => r.id).sort()).toEqual(['fresh', 'stale']);
  });

  it('lets a platform team claim its member’s unlinked placeholder', () => {
    const { groups, orphans } = assignRowsToPlatformTeams([row('placeholder', 'app-a', null)], platform);
    expect(groups.get('1')?.map((r) => r.id)).toEqual(['placeholder']);
    expect(orphans).toEqual([]);
  });

  it('never lets a placeholder claim by app ownership a row already linked elsewhere', () => {
    // Every opponent row is app-owned by whoever synced; owning it must not make it "yours".
    const { groups } = assignRowsToPlatformTeams([row('opponent', 'app-a', 'sleeper-b')], platform);
    expect(groups.get('2')?.map((r) => r.id)).toEqual(['opponent']);
    expect(groups.has('1')).toBe(false);
  });

  it('reports rows that match no platform team as orphans', () => {
    const { orphans } = assignRowsToPlatformTeams(
      [row('gone-key', 'x', 'sleeper-z', '9'), row('gone-owner', 'x', 'sleeper-z'), row('stranger-placeholder', 'app-q', null)],
      platform,
    );
    expect(orphans.map((r) => r.id).sort()).toEqual(['gone-key', 'gone-owner', 'stranger-placeholder']);
  });
});

describe('pickKeeperTeam', () => {
  const at = (iso: string) => new Date(iso);
  it('prefers the row already carrying the platform key', () => {
    expect(pickKeeperTeam([
      { id: 'newer', externalTeamId: null, externalOwnerId: 'o', updatedAt: at('2026-10-02'), createdAt: at('2026-01-01') },
      { id: 'keyed', externalTeamId: '3', externalOwnerId: 'o', updatedAt: at('2026-01-01'), createdAt: at('2026-01-01') },
    ], '3').id).toBe('keyed');
  });

  it('prefers a linked row over an unlinked placeholder even when the placeholder is newer', () => {
    // Unchanged synced rows are not rewritten, so a linked row's updatedAt can be older.
    expect(pickKeeperTeam([
      { id: 'placeholder', externalTeamId: null, externalOwnerId: null, updatedAt: at('2026-09-20'), createdAt: at('2026-09-20') },
      { id: 'linked', externalTeamId: null, externalOwnerId: 'o', updatedAt: at('2026-09-01'), createdAt: at('2026-09-01') },
    ], '3').id).toBe('linked');
  });

  it('otherwise keeps the most recently synced, then the oldest, then by id', () => {
    expect(pickKeeperTeam([
      { id: 'stale', externalTeamId: null, externalOwnerId: 'o', updatedAt: at('2026-04-11'), createdAt: at('2026-03-30') },
      { id: 'fresh', externalTeamId: null, externalOwnerId: 'o', updatedAt: at('2026-10-02'), createdAt: at('2026-04-08') },
    ]).id).toBe('fresh');
    const t = at('2026-10-02');
    expect(pickKeeperTeam([
      { id: 'b', externalTeamId: null, externalOwnerId: 'o', updatedAt: t, createdAt: at('2026-04-08') },
      { id: 'a', externalTeamId: null, externalOwnerId: 'o', updatedAt: t, createdAt: at('2026-03-30') },
    ]).id).toBe('a');
  });
});
