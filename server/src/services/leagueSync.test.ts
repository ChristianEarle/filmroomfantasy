import { describe, expect, it } from 'vitest';
import { decideTeamOwnerId } from './leagueSync';

/**
 * Regression coverage for the sync ownership rules (see the doc comment on
 * `decideTeamOwnerId`). `teams.ownerId` is NOT NULL, so this function must
 * never return null — it prefers a known app member's id when one resolves,
 * otherwise it falls back to today's placeholder-ownership status quo
 * (keep the existing owner, or default to whoever is running the sync)
 * instead of clobbering it.
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

  it('assigns the acting user their own roster even before their membership resolves in sleeperIdToAppUserId', () => {
    // Rule (a): matched via actingUserSleeperId, independent of the
    // sleeperIdToAppUserId map (which might not have resolved yet).
    const result = decideTeamOwnerId({
      sleeperOwnerId: 'sleeper-me',
      sleeperIdToAppUserId: new Map(),
      currentOwnerId: null,
      actingUserId: 'app-user-a',
      actingUserSleeperId: 'sleeper-me',
    });
    expect(result).toBe('app-user-a');
  });

  it('rule (a) takes precedence over a stale currentOwnerId owned by someone else', () => {
    const result = decideTeamOwnerId({
      sleeperOwnerId: 'sleeper-me',
      sleeperIdToAppUserId: new Map(),
      currentOwnerId: 'app-user-z', // stale/wrong
      actingUserId: 'app-user-a',
      actingUserSleeperId: 'sleeper-me',
    });
    expect(result).toBe('app-user-a');
  });

  it('defaults an unmatched roster to whoever is running the sync when it has no other owner', () => {
    // Placeholder-ownership status quo: with no known member match and no
    // pre-existing owner, a brand new team row still needs a non-null
    // owner, so it goes to the acting user (for app access) rather than
    // being left ownerless.
    const result = decideTeamOwnerId({
      sleeperOwnerId: 'sleeper-unknown',
      sleeperIdToAppUserId: new Map(),
      currentOwnerId: null,
      actingUserId: 'app-user-a',
    });
    expect(result).toBe('app-user-a');
  });

  it('leaves an unmatched roster\'s existing owner unchanged rather than clearing it', () => {
    // Simulates a team row created by an earlier sync (placeholder owner) —
    // no known member maps to this roster on this pass, so it's left as-is.
    const result = decideTeamOwnerId({
      sleeperOwnerId: 'sleeper-unknown',
      sleeperIdToAppUserId: new Map(),
      currentOwnerId: 'app-user-a',
      actingUserId: 'app-user-a',
    });
    expect(result).toBe('app-user-a');
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

  it('has no acting user (admin/cron sync) and still assigns known members', () => {
    const sleeperIdToAppUserId = new Map([['sleeper-1', 'app-user-a']]);
    expect(
      decideTeamOwnerId({
        sleeperOwnerId: 'sleeper-1',
        sleeperIdToAppUserId,
        currentOwnerId: null,
        actingUserId: null,
      })
    ).toBe('app-user-a');
  });

  it('has no acting user (admin/cron sync) and leaves an unmatched roster\'s existing placeholder owner unchanged', () => {
    const sleeperIdToAppUserId = new Map([['sleeper-1', 'app-user-a']]);
    expect(
      decideTeamOwnerId({
        sleeperOwnerId: 'sleeper-unknown',
        sleeperIdToAppUserId,
        currentOwnerId: 'app-user-b', // placeholder owner from an earlier sync
        actingUserId: null,
      })
    ).toBe('app-user-b');
  });
});
