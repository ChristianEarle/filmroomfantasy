import { afterEach, describe, expect, it, vi } from 'vitest';
import { processPendingBatches } from './draftRankings';

// Verifies task B: writeVariantRankings persists the Market rank that was in
// effect at generation time onto each draft_rankings row (market_rank
// column, migration 0047), in addition to the existing live join that
// routes/draftRankings.ts uses for display.

const ANTHROPIC_BATCH_URL = 'https://api.anthropic.com/v1/messages/batches';

function succeededResultLine(customId: string) {
  return JSON.stringify({
    custom_id: customId,
    result: {
      type: 'succeeded',
      message: {
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                name: 'Market Player',
                position: 'WR',
                overallRank: 1,
                positionRank: 1,
                tier: 1,
                projectedPoints: 300,
                rationale: 'test',
              },
              {
                name: 'No Market Player',
                position: 'RB',
                overallRank: 2,
                positionRank: 1,
                tier: 1,
                projectedPoints: 200,
                rationale: 'test',
              },
            ]),
          },
        ],
      },
    },
  });
}

function stubBatchFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === `${ANTHROPIC_BATCH_URL}/batch1`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'batch1', processing_status: 'ended', results_url: 'https://results.test/batch1' }),
        } as unknown as Response;
      }
      if (url === 'https://results.test/batch1') {
        return { ok: true, status: 200, text: async () => succeededResultLine('job1-variant') } as unknown as Response;
      }
      // ADP-source fetches (FFC/FantasyCalc/MFL) fail gracefully.
      return { ok: false, status: 500, json: async () => ({}), text: async () => '' } as unknown as Response;
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('writeVariantRankings — persists market_rank at generation time', () => {
  it('sets marketRank on the row for a player with market coverage and null for one without', async () => {
    stubBatchFetch();

    const jobs = [
      {
        id: 'job1',
        anthropicBatchId: 'batch1',
        status: 'submitted',
        seasonYear: 2026,
        variants: JSON.stringify([
          { customId: 'job1-variant', rankingType: 'redraft', scoringFormat: 'ppr', superflex: false },
        ]),
      },
    ];

    const insertedRows: any[] = [];
    const db = {
      query: {
        rankingBatchJobs: { findMany: async () => jobs },
        nflPlayers: {
          findMany: async () => [
            {
              id: 'p1',
              externalId: 'e1',
              name: 'Market Player',
              position: 'WR',
              team: 'KC',
              age: 25,
              yearsExp: 3,
              status: 'active',
              injuryNote: null,
              depthChartOrder: 1,
            },
            {
              id: 'p2',
              externalId: 'e2',
              name: 'No Market Player',
              position: 'RB',
              team: 'SF',
              age: 26,
              yearsExp: 4,
              status: 'active',
              injuryNote: null,
              depthChartOrder: 1,
            },
          ],
        },
        playerWeeklyStats: { findMany: async () => [] },
        playerNews: { findMany: async () => [] },
        // Market coverage exists for this season/scoring format (as_of_week 3)...
        playerMarketProjections: {
          findFirst: async () => ({ asOfWeek: 3 }),
          // ...but only "Market Player" (p1) has a row at that week.
          findMany: async () => [
            { playerId: 'p1', marketRank: 7, seasonPoints: 288.4, tier: 1 },
          ],
        },
      },
      delete: (_table: unknown) => ({ where: (_cond: unknown) => ({ __type: 'delete' }) }),
      insert: (_table: unknown) => ({
        values: (row: unknown) => {
          insertedRows.push(row);
          return { __type: 'insert', row };
        },
      }),
      batch: vi.fn(async () => ({ results: [] })),
      update: (_table: unknown) => ({ set: (_v: any) => ({ where: (_c: unknown) => Promise.resolve() }) }),
    };

    const result = await processPendingBatches(db as any, 'test-anthropic-key');

    expect(result.completedJobs).toBe(1);
    expect(insertedRows).toHaveLength(2);

    const marketRow = insertedRows.find((r) => r.playerId === 'p1');
    const noMarketRow = insertedRows.find((r) => r.playerId === 'p2');
    expect(marketRow.marketRank).toBe(7);
    expect(noMarketRow.marketRank).toBeNull();
  });
});
