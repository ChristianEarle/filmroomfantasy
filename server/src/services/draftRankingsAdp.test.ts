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
    // the whole rookie pool.
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
    stubFetch({ players: [] }); // any ADP source; irrelevant here

    const inserted: any[] = [];
    const db = makeFakeDb(inserted);

    const result = await submitDraftRankingsBatch({
      db,
      anthropicKey: 'test-key',
      variants: [{ rankingType: 'rookie', scoringFormat: 'ppr', superflex: false }],
      seasonYear: 2026,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('All variants had zero eligible players');

    const failedRow = inserted.find((r) => /zero eligible players/.test(r.errorMessage ?? ''));
    expect(failedRow).toBeTruthy();
    expect(failedRow.status).toBe('failed');
    expect(failedRow.seasonYear).toBe(2026);
    expect(failedRow.anthropicBatchId).toMatch(/^no-batch-rookie-ppr-std-/);
    const variants = JSON.parse(failedRow.variants);
    expect(variants[0]).toMatchObject({ rankingType: 'rookie', scoringFormat: 'ppr', superflex: false });
  });

  it('leaves multiple variants each with their own failed job row', async () => {
    stubFetch({ players: [] });

    const inserted: any[] = [];
    const db = makeFakeDb(inserted);

    await submitDraftRankingsBatch({
      db,
      anthropicKey: 'test-key',
      variants: [
        { rankingType: 'rookie', scoringFormat: 'ppr', superflex: false },
        { rankingType: 'rookie', scoringFormat: 'half-ppr', superflex: false },
      ],
      seasonYear: 2026,
    });

    const zeroEligibleRows = inserted.filter((r) => /zero eligible players/.test(r.errorMessage ?? ''));
    expect(zeroEligibleRows).toHaveLength(2);
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
