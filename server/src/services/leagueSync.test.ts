import { describe, expect, it } from 'vitest';
import { decideTeamOwnerId } from './leagueSync';

/**
 * Regression coverage for the sync bug this file fixes: every "opponent"
 * team used to get `ownerId: <whichever app user ran the sync>` on insert,
 * and the update branch never corrected a pre-existing wrong owner. That
 * meant the first app user to sync a shared league ended up "owning" every
 * team in it, so `findCurrentMatchupForTeam` / `resolveUserTeamId` could
 * resolve the wrong team for other members.
 */
describe('decideTeamOwnerId', () => {
  it('assigns ownership to the known app member whose Sleeper id matches this roster', () => {
    const sleeperIdToAppUserId = new Map([['sleeper-1', 'app-user-a']]);
    const result = decideTeamOwnerId({
      sleeperOwnerId: 'sleeper-1',
      sleeperIdToAppUserId,
      currentOwnerId: null,
      actingUserId: 'app-user-a',
    });
    expect(result).toBe('app-user-a');
  });

  it('corrects a historically wrong owner once the roster resolves to a different known member', () => {
    // This is the "update branch must correct historical rows" case: the
    // team row was previously (wrongly) stamped with actingUserId's id, but
    // the roster actually belongs to a different known app member.
    const sleeperIdToAppUserId = new Map([['sleeper-2', 'app-user-b']]);
    const result = decideTeamOwnerId({
      sleeperOwnerId: 'sleeper-2',
      sleeperIdToAppUserId,
      currentOwnerId: 'app-user-a', // wrong — left over from the old bug
      actingUserId: 'app-user-a',
    });
    expect(result).toBe('app-user-b');
  });

  it('does not default an unmatched roster to whoever is running the sync (the core bug)', () => {
    const result = decideTeamOwnerId({
      sleeperOwnerId: 'sleeper-unknown',
      sleeperIdToAppUserId: new Map(),
      currentOwnerId: null,
      actingUserId: 'app-user-a',
    });
    expect(result).toBeNull();
  });

  it('clears a stale ownerId on an unmatched roster when it was defaulted to the acting user', () => {
    // Simulates a team row created by the old buggy code path — no known
    // member maps to this roster, and its current owner is exactly the
    // person running this sync, so it gets corrected to null.
    const result = decideTeamOwnerId({
      sleeperOwnerId: 'sleeper-unknown',
      sleeperIdToAppUserId: new Map(),
      currentOwnerId: 'app-user-a',
      actingUserId: 'app-user-a',
    });
    expect(result).toBeNull();
  });

  it('never clobbers a team already owned by a different known app member', () => {
    // No mapping resolves for this roster on *this* sync pass (e.g. that
    // member's own membership row is temporarily unresolvable), but the
    // team is already owned by someone else entirely — must be left alone.
    const result = decideTeamOwnerId({
      sleeperOwnerId: 'sleeper-3',
      sleeperIdToAppUserId: new Map(),
      currentOwnerId: 'app-user-c',
      actingUserId: 'app-user-a',
    });
    expect(result).toBe('app-user-c');
  });

  it('has no acting user (admin/cron sync) and still assigns known members, nulling the rest', () => {
    const sleeperIdToAppUserId = new Map([['sleeper-1', 'app-user-a']]);
    expect(
      decideTeamOwnerId({
        sleeperOwnerId: 'sleeper-1',
        sleeperIdToAppUserId,
        currentOwnerId: null,
        actingUserId: null,
      })
    ).toBe('app-user-a');

    expect(
      decideTeamOwnerId({
        sleeperOwnerId: 'sleeper-unknown',
        sleeperIdToAppUserId,
        currentOwnerId: null,
        actingUserId: null,
      })
    ).toBeNull();
  });
});
