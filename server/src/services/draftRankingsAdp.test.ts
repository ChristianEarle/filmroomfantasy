import { afterEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import {
  ADP_CANARY_MIN_ENTRIES,
  fetchFfcAdp,
  isRookieEligible,
  normalizePlayerName,
  submitDraftRankingsBatch,
} from './draftRankings';

// ── Fixtures ─────────────────────────────────────────────────────────

/** Shape mirrors https://fantasyfootballcalculator.com/api/v1/adp/ppr */
function ffcFixture(players: Array<{ name: string; adp: number; position?: string }>) {
  return {
    meta: { format: 'ppr', teams: 12, year: 2026 },
    players: players.map((p, i) => ({
      player_id: 1000 + i,
      name: p.name,
      position: p.position ?? 'WR',
      team: 'XX',
      adp: p.adp,
      adp_formatted: `${Math.floor(p.adp / 12) + 1}.${((p.adp - 1) % 12) + 1}`,
      times_drafted: 500,
      high: Math.max(1, p.adp - 3),
      low: p.adp + 3,
      stdev: 2.1,
      bye: 9,
    })),
  };
}

function stubFetch(body: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response),
  );
}

/**
 * Route fetch by URL so the MFL IS_KEEPER=R rookie fallback returns real
 * entries while the FantasyCalc dynasty-values call (which doesn't match
 * MFL's shape) falls back to an empty map, same as it would for a real
 * partial outage. Used to give buildRookieAdpMap a non-zero result without
 * needing a matching player row in the fake DB (FC contributes 0 rookies
 * when the DB has none, same as `makeFakeDb`'s default empty findMany).
 */
function stubMflRookieAdpOnly(entries: Array<{ id: string; lastFirst: string; adp: number }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => {
      const respond = (body: unknown) => ({
        ok: true,
        status: 200,
        json: async () => body,
        text: async () => JSON.stringify(body),
      } as unknown as Response);

      if (url.includes('TYPE=adp')) {
        return respond({ adp: { player: entries.map((e) => ({ id: e.id, averagePick: String(e.adp) })) } });
      }
      if (url.includes('TYPE=players')) {
        return respond({ players: { player: entries.map((e) => ({ id: e.id, name: e.lastFirst, position: 'WR' })) } });
      }
      // FantasyCalc (or anything else) — non-array payload, handled gracefully.
      return respond({});
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── normalizePlayerName ──────────────────────────────────────────────

describe('normalizePlayerName', () => {
  it('strips apostrophes so FFC-style names match our DB spelling', () => {
    expect(normalizePlayerName("Ja'Marr Chase")).toBe('jamarr chase');
  });

  it('strips periods so "St." collapses to "st"', () => {
    expect(normalizePlayerName('Amon-Ra St. Brown')).toBe('amonra st brown');
  });

  it('drops generational suffixes so "III" matches the suffix-free form', () => {
    expect(normalizePlayerName('Kenneth Walker III')).toBe('kenneth walker');
    expect(normalizePlayerName('Kenneth Walker')).toBe('kenneth walker');
  });
});

// ── fetchFfcAdp ──────────────────────────────────────────────────────

describe('fetchFfcAdp', () => {
  it('parses the FFC players array into a normalized-name -> adp map', async () => {
    stubFetch(
      ffcFixture([
        { name: "Ja'Marr Chase", adp: 1.2 },
        { name: 'Amon-Ra St. Brown', adp: 4.5 },
        { name: 'Kenneth Walker III', adp: 18.3 },
      ]),
    );

    const result = await fetchFfcAdp('ppr', 2026);

    expect(result.get('jamarr chase')).toBe(1.2);
    expect(result.get('amonra st brown')).toBe(4.5);
    expect(result.get('kenneth walker')).toBe(18.3);
    expect(result.size).toBe(3);
  });

  it('requests the scoring-format-specific FFC endpoint', async () => {
    stubFetch(ffcFixture([{ name: 'Test Player', adp: 1 }]));
    await fetchFfcAdp('half-ppr', 2026);
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/adp/half-ppr'),
      expect.any(Object),
    );
    expect(fetchMock.mock.calls[0][0]).toContain('year=2026');
  });

  it('returns an empty map (not a throw) when FFC responds non-OK', async () => {
    stubFetch({}, false);
    const result = await fetchFfcAdp('ppr', 2026);
    expect(result.size).toBe(0);
  });

  it('returns an empty map when the payload has no players array', async () => {
    stubFetch({ meta: {} });
    const result = await fetchFfcAdp('ppr', 2026);
    expect(result.size).toBe(0);
  });

  it('skips entries with a missing name or non-numeric adp instead of throwing', async () => {
    stubFetch({
      players: [
        { name: 'Good Player', adp: 5 },
        { name: null, adp: 6 },
        { name: 'Bad Adp', adp: 'NaN' },
      ],
    });
    const result = await fetchFfcAdp('ppr', 2026);
    expect(result.size).toBe(1);
    expect(result.get('good player')).toBe(5);
  });
});

// ── ADP canary threshold ─────────────────────────────────────────────

describe('ADP_CANARY_MIN_ENTRIES canary', () => {
  it('is set to 100, well below FFC/FantasyCalc real-world coverage (~250+)', () => {
    expect(ADP_CANARY_MIN_ENTRIES).toBe(100);
  });

  it('records a failed ranking_batch_jobs row and skips submitting the variant when the FFC map comes back under the canary threshold', async () => {
    // Fewer than ADP_CANARY_MIN_ENTRIES players — simulates a broken/blocked
    // feed (e.g. FantasyPros's old login-walled page returning ~5 rows).
    stubFetch(ffcFixture([{ name: 'Only Player', adp: 1 }]));

    const inserted: any[] = [];
    // Give the variant a real eligible player so that, absent the canary
    // skip, buildPlayerContexts/the batch submission would proceed normally
    // (proving the skip is what stops it, not an unrelated zero-context
    // bailout like the "zero eligible players" tests below).
    const nflPlayersFindMany = vi.fn(async () => [
      {
        id: 'p1',
        externalId: 'e1',
        name: 'Eligible Player',
        position: 'WR',
        team: 'KC',
        age: 25,
        yearsExp: 3,
        status: 'active',
        injuryNote: null,
        depthChartOrder: 1,
      },
    ]);
    const db = makeFakeDb(inserted);
    db.query.nflPlayers.findMany = nflPlayersFindMany;

    const result = await submitDraftRankingsBatch({
      db,
      anthropicKey: 'test-key',
      variants: [{ rankingType: 'redraft', scoringFormat: 'ppr', superflex: false }],
      seasonYear: 2026,
    });

    // The canary trip must skip the variant entirely — it never reaches
    // buildPlayerContexts (proven by the spy never firing), so no batch gets
    // submitted for it and any previously-written rankings for this variant
    // are left untouched (a full FFC outage keeps last week's board instead
    // of regenerating it without ADP).
    expect(result.ok).toBe(false);
    expect(nflPlayersFindMany).not.toHaveBeenCalled();

    const canaryRow = inserted.find((r) => /ADP coverage canary tripped/.test(r.errorMessage));
    expect(canaryRow).toBeTruthy();
    expect(canaryRow.status).toBe('failed');
    expect(canaryRow.anthropicBatchId).toMatch(/^no-batch-/);

    // Only the canary problem row should exist for this variant — no
    // separate "zero eligible players" row, since the variant is skipped
    // before that check is ever reached.
    expect(inserted).toHaveLength(1);
  });
});

// ── Rookie pool selection (playerTenure-backed) ─────────────────────

describe('isRookieEligible', () => {
  it('treats yearsExp === 0 with no stats history as an incoming rookie', () => {
    expect(
      isRookieEligible(
        { id: 'p1', yearsExp: 0 },
        { playedInCurrentSeason: false, playedInPreviousSeason: false, seasonYear: 2026 },
      ),
    ).toBe(true);
  });

  it('treats yearsExp === null (blanked by a sync-players run) with no stats history as still rookie-eligible', () => {
    // This is the exact regression: a sync run wrote null instead of 0, and
    // the old `p.yearsExp === 0` filter excluded every true rookie, zeroing
    // the whole dynasty_rookie pool.
    expect(
      isRookieEligible(
        { id: 'p2', yearsExp: null },
        { playedInCurrentSeason: false, playedInPreviousSeason: false, seasonYear: 2026 },
      ),
    ).toBe(true);
  });

  it('excludes a sophomore (played the previous NFL season) even if yearsExp is blank', () => {
    expect(
      isRookieEligible(
        { id: 'p3', yearsExp: null },
        { playedInCurrentSeason: false, playedInPreviousSeason: true, seasonYear: 2026 },
      ),
    ).toBe(false);
  });

  it('excludes an established veteran with a real yearsExp', () => {
    expect(
      isRookieEligible(
        { id: 'p4', yearsExp: 6 },
        { playedInCurrentSeason: false, playedInPreviousSeason: true, seasonYear: 2026 },
      ),
    ).toBe(false);
  });

  it('includes a rookie who is actively producing this season (rookie-active)', () => {
    expect(
      isRookieEligible(
        { id: 'p5', yearsExp: 0 },
        { playedInCurrentSeason: true, playedInPreviousSeason: false, seasonYear: 2026 },
      ),
    ).toBe(true);
  });
});

// ── Zero-eligible-players variants must leave a queryable trace ──────

describe('submitDraftRankingsBatch — zero-context variants', () => {
  it('inserts a failed ranking_batch_jobs row instead of silently skipping the variant', async () => {
    // Non-empty MFL rookie ADP fallback so the ADP map is non-zero and the
    // dynasty_rookie-specific empty-ADP canary (tested separately below)
    // doesn't intercept this before it reaches the zero-eligible-players
    // check this test is actually about.
    stubMflRookieAdpOnly([{ id: '1', lastFirst: 'Doe, John', adp: 1 }]);

    const inserted: any[] = [];
    const db = makeFakeDb(inserted);

    const result = await submitDraftRankingsBatch({
      db,
      anthropicKey: 'test-key',
      variants: [{ rankingType: 'dynasty_rookie', scoringFormat: 'ppr', superflex: false }],
      seasonYear: 2026,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('All variants had zero eligible players');

    const failedRow = inserted.find((r) => /zero eligible players/.test(r.errorMessage ?? ''));
    expect(failedRow).toBeTruthy();
    expect(failedRow.status).toBe('failed');
    expect(failedRow.seasonYear).toBe(2026);
    expect(failedRow.anthropicBatchId).toMatch(/^no-batch-dynasty_rookie-ppr-std-/);
    const variants = JSON.parse(failedRow.variants);
    expect(variants[0]).toMatchObject({ rankingType: 'dynasty_rookie', scoringFormat: 'ppr', superflex: false });
  });

  it('leaves multiple variants each with their own failed job row', async () => {
    // Same reasoning as above: keep the ADP map non-zero so the empty-ADP
    // canary doesn't fire ahead of the zero-eligible-players check.
    stubMflRookieAdpOnly([{ id: '1', lastFirst: 'Doe, John', adp: 1 }]);

    const inserted: any[] = [];
    const db = makeFakeDb(inserted);

    await submitDraftRankingsBatch({
      db,
      anthropicKey: 'test-key',
      variants: [
        { rankingType: 'dynasty_rookie', scoringFormat: 'ppr', superflex: false },
        { rankingType: 'dynasty_rookie', scoringFormat: 'half-ppr', superflex: false },
      ],
      seasonYear: 2026,
    });

    const zeroEligibleRows = inserted.filter((r) => /zero eligible players/.test(r.errorMessage ?? ''));
    expect(zeroEligibleRows).toHaveLength(2);
  });
});

// ── Rookie ADP outage canary (empty map, not just a small pool) ─────

describe('submitDraftRankingsBatch — dynasty_rookie empty ADP canary', () => {
  it('rookies eligible but ADP map empty (total outage) → failed job row, no submission', async () => {
    // Both the FantasyCalc dynasty feed and the MFL IS_KEEPER=R fallback
    // return payloads that resolve to an empty ADP map — a total outage,
    // not just a small rookie class.
    stubFetch({});

    const inserted: any[] = [];
    // Rookies ARE eligible (unlike the zero-eligible-players tests above) —
    // this proves the skip is caused by the empty-ADP guard specifically,
    // not by there being no players to rank.
    const nflPlayersFindMany = vi.fn(async () => [
      {
        id: 'p1',
        externalId: 'e1',
        name: 'Eligible Rookie',
        position: 'WR',
        team: 'KC',
        age: 22,
        yearsExp: 0,
        status: 'active',
        injuryNote: null,
        depthChartOrder: 1,
      },
    ]);
    const db = makeFakeDb(inserted);
    db.query.nflPlayers.findMany = nflPlayersFindMany;

    const result = await submitDraftRankingsBatch({
      db,
      anthropicKey: 'test-key',
      variants: [{ rankingType: 'dynasty_rookie', scoringFormat: 'ppr', superflex: false }],
      seasonYear: 2026,
    });

    expect(result.ok).toBe(false);

    // buildRookieAdpMap makes its own single nflPlayers.findMany call to
    // filter FC's dynasty ranks down to rookies; buildPlayerContexts would
    // make a second, separate call. Exactly one call proves the empty-ADP
    // guard skipped the variant before buildPlayerContexts ever ran.
    expect(nflPlayersFindMany).toHaveBeenCalledTimes(1);

    const canaryRow = inserted.find((r) => /Rookie ADP coverage canary tripped/.test(r.errorMessage ?? ''));
    expect(canaryRow).toBeTruthy();
    expect(canaryRow.status).toBe('failed');
    expect(canaryRow.anthropicBatchId).toMatch(/^no-batch-/);

    // No separate "zero eligible players" row — the variant never reaches
    // that check, and last week's rankings for it are left untouched.
    expect(inserted).toHaveLength(1);
  });
});

// ── Test doubles ─────────────────────────────────────────────────────

/**
 * Minimal stand-in for the Drizzle `DB` handle used by draftRankings.ts.
 * Only implements the query surface submitDraftRankingsBatch's code path
 * actually touches: empty result sets for every `findMany` (so
 * buildPlayerContexts always yields zero players, deterministically
 * exercising the zero-context / canary paths without a real D1 binding),
 * and an `insert().values()` that records what would have been written so
 * assertions can inspect it.
 */
function makeFakeDb(inserted: any[]): any {
  return {
    query: {
      nflPlayers: { findMany: async () => [] },
      playerWeeklyStats: { findMany: async () => [] },
      playerNews: { findMany: async () => [] },
      rankingBatchJobs: { findMany: async () => [] },
    },
    insert: (_table: typeof schema.rankingBatchJobs) => ({
      values: async (val: any) => {
        inserted.push(val);
        return { success: true } as any;
      },
    }),
  };
}
