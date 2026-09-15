import { afterEach, describe, expect, it, vi } from 'vitest';
import { processPendingBatches } from './draftRankings';

// Mirrors the anthropic-version/beta headers draftRankings.ts sends; the
// fake fetch below only cares about the URL, not these headers.
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
                name: 'Test Player',
                position: 'WR',
                overallRank: 1,
                positionRank: 1,
                tier: 1,
                projectedPoints: 300,
                rationale: 'test',
              },
            ]),
          },
        ],
      },
    },
  });
}

/**
 * Fake fetch that resolves batch status polls and results fetches for two
 * jobs (batch1/batch2), and fails (gracefully, not by throwing) any other
 * request — the ADP-source fetches inside writeVariantRankings all catch
 * their own network errors and return an empty Map, so a 500 here is enough
 * to keep them out of the way without needing real fixtures.
 */
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
      if (url === `${ANTHROPIC_BATCH_URL}/batch2`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'batch2', processing_status: 'ended', results_url: 'https://results.test/batch2' }),
        } as unknown as Response;
      }
      if (url === 'https://results.test/batch1') {
        return { ok: true, status: 200, text: async () => succeededResultLine('job1-variant') } as unknown as Response;
      }
      if (url === 'https://results.test/batch2') {
        return { ok: true, status: 200, text: async () => succeededResultLine('job2-variant') } as unknown as Response;
      }
      // Any ADP-source fetch (FFC/FantasyCalc/MFL) — fail gracefully.
      return { ok: false, status: 500, json: async () => ({}), text: async () => '' } as unknown as Response;
    }),
  );
}

/**
 * Minimal fake DB for processPendingBatches: enough player/stats/news query
 * surface for writeVariantRankings to match "Test Player" and build one
 * insert row, plus update()/batch() spies so the test can assert per-job
 * outcomes and force a write failure on demand.
 */
function makeFakeDb(opts: {
  jobs: Array<{ id: string; anthropicBatchId: string; status: string; seasonYear: number; variants: string }>;
  batch: (statements: unknown[]) => Promise<unknown>;
}) {
  const updates: Array<{ set: any }> = [];

  const db = {
    query: {
      rankingBatchJobs: { findMany: async () => opts.jobs },
      nflPlayers: {
        findMany: async () => [
          {
            id: 'p1',
            externalId: 'e1',
            name: 'Test Player',
            position: 'WR',
            team: 'KC',
            age: 25,
            yearsExp: 3,
            status: 'active',
            injuryNote: null,
            depthChartOrder: 1,
          },
        ],
      },
      playerWeeklyStats: { findMany: async () => [] },
      playerNews: { findMany: async () => [] },
    },
    delete: (_table: unknown) => ({ where: (_cond: unknown) => ({ __type: 'delete' }) }),
    insert: (_table: unknown) => ({ values: (row: unknown) => ({ __type: 'insert', row }) }),
    batch: vi.fn(opts.batch),
    update: (_table: unknown) => ({
      set: (setVal: any) => ({
        where: (_cond: unknown) => {
          updates.push({ set: setVal });
          return Promise.resolve();
        },
      }),
    }),
  };

  return { db, updates };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('processPendingBatches — per-job isolation', () => {
  it('marks the failing job failed with a truncated error and still processes the next job when a write throws', async () => {
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
      {
        id: 'job2',
        anthropicBatchId: 'batch2',
        status: 'submitted',
        seasonYear: 2026,
        variants: JSON.stringify([
          { customId: 'job2-variant', rankingType: 'redraft', scoringFormat: 'ppr', superflex: false },
        ]),
      },
    ];

    const longError = 'D1_ERROR boom '.repeat(50); // > 500 chars
    let batchCalls = 0;
    const { db, updates } = makeFakeDb({
      jobs,
      batch: async () => {
        batchCalls += 1;
        if (batchCalls === 1) {
          // Simulate the atomic delete+insert write throwing for job1.
          throw new Error(longError);
        }
        return { results: [] };
      },
    });

    const result = await processPendingBatches(db as any, 'test-anthropic-key');

    // Both jobs were polled/attempted this tick — job1's throw did not abort
    // the loop before job2 got a turn.
    expect(result.checked).toBe(2);
    expect(batchCalls).toBe(2);
    expect(result.failedJobs).toBe(1);
    expect(result.completedJobs).toBe(1);

    expect(updates).toHaveLength(2);

    // job1: marked failed, with the error message truncated to 500 chars.
    expect(updates[0].set.status).toBe('failed');
    expect(updates[0].set.errorMessage).toHaveLength(500);
    expect(longError.startsWith(updates[0].set.errorMessage)).toBe(true);

    // job2: still processed normally and marked completed.
    expect(updates[1].set.status).toBe('completed');
  });
});
