import { describe, it, expect } from 'vitest';
import {
  buildTransactionNotificationRows,
  isRelevantTransaction,
} from './notifications';
import type { SleeperTransaction } from './sleeper';

function txn(overrides: Partial<SleeperTransaction>): SleeperTransaction {
  return {
    transaction_id: 'txn-1',
    type: 'waiver',
    status: 'complete',
    roster_ids: [1],
    adds: null,
    drops: null,
    created: Date.now(),
    ...overrides,
  };
}

describe('isRelevantTransaction', () => {
  it('ignores pending transactions', () => {
    expect(isRelevantTransaction(txn({ status: 'pending' }))).toBe(false);
  });

  it('treats both complete and failed waivers as relevant', () => {
    expect(isRelevantTransaction(txn({ type: 'waiver', status: 'complete' }))).toBe(true);
    expect(isRelevantTransaction(txn({ type: 'waiver', status: 'failed' }))).toBe(true);
  });

  it('only treats a completed trade as relevant, not a failed one', () => {
    expect(isRelevantTransaction(txn({ type: 'trade', status: 'complete' }))).toBe(true);
    expect(isRelevantTransaction(txn({ type: 'trade', status: 'failed' }))).toBe(false);
  });

  it('ignores free_agent and commissioner moves', () => {
    expect(isRelevantTransaction(txn({ type: 'free_agent', status: 'complete' }))).toBe(false);
    expect(isRelevantTransaction(txn({ type: 'commissioner', status: 'complete' }))).toBe(false);
  });
});

describe('buildTransactionNotificationRows', () => {
  const names = new Map([
    ['100', 'Breece Hall'],
    ['200', 'Zack Moss'],
    ['300', 'CeeDee Lamb'],
    ['400', 'Jerry Jeudy'],
  ]);

  it('builds a successful-waiver row with the FAAB amount and the drop', () => {
    const t = txn({
      type: 'waiver',
      status: 'complete',
      roster_ids: [1],
      adds: { '100': 1 },
      drops: { '200': 1 },
      waiver_budget: [{ sender: 1, receiver: 0, amount: 12 }],
    });
    const rows = buildTransactionNotificationRows([t], new Map([[1, ['user-1']]]), names);
    expect(rows).toEqual([
      {
        userId: 'user-1',
        type: 'waiver',
        title: 'Waiver claim successful',
        body: 'You added Breece Hall, dropped Zack Moss ($12 FAAB).',
        dedupeKey: 'txn:txn-1:user-1',
      },
    ]);
  });

  it('builds a failed-waiver row naming the missed player', () => {
    const t = txn({
      type: 'waiver',
      status: 'failed',
      roster_ids: [1],
      adds: { '100': 1 },
      drops: { '200': 1 },
    });
    const rows = buildTransactionNotificationRows([t], new Map([[1, ['user-1']]]), names);
    expect(rows).toEqual([
      {
        userId: 'user-1',
        type: 'waiver',
        title: 'Waiver claim unsuccessful',
        body: 'Your claim for Breece Hall did not go through.',
        dedupeKey: 'txn:txn-1:user-1',
      },
    ]);
  });

  it('builds one row per side of a completed trade, each naming what THAT roster gave and received', () => {
    const t = txn({
      transaction_id: 'txn-trade',
      type: 'trade',
      status: 'complete',
      roster_ids: [1, 2],
      adds: { '300': 1, '400': 2 },
      drops: { '400': 1, '300': 2 },
    });
    const rows = buildTransactionNotificationRows(
      [t],
      new Map([[1, ['user-1']], [2, ['user-2']]]),
      names,
    );
    expect(rows).toEqual([
      {
        userId: 'user-1',
        type: 'trade',
        title: 'Trade completed',
        body: 'You received CeeDee Lamb and sent Jerry Jeudy.',
        dedupeKey: 'txn:txn-trade:user-1',
      },
      {
        userId: 'user-2',
        type: 'trade',
        title: 'Trade completed',
        body: 'You received Jerry Jeudy and sent CeeDee Lamb.',
        dedupeKey: 'txn:txn-trade:user-2',
      },
    ]);
  });

  it('notifies every co-owner when a roster maps to more than one user', () => {
    const t = txn({ roster_ids: [1], adds: { '100': 1 } });
    const rows = buildTransactionNotificationRows([t], new Map([[1, ['user-1', 'user-2']]]), names);
    expect(rows.map((r) => r.userId)).toEqual(['user-1', 'user-2']);
  });

  it('skips rosters with no resolved recipient', () => {
    const t = txn({ roster_ids: [99], adds: { '100': 99 } });
    const rows = buildTransactionNotificationRows([t], new Map(), names);
    expect(rows).toEqual([]);
  });

  it('skips pending and failed-trade transactions entirely', () => {
    const pending = txn({ status: 'pending', roster_ids: [1] });
    const failedTrade = txn({ type: 'trade', status: 'failed', roster_ids: [1] });
    const rows = buildTransactionNotificationRows([pending, failedTrade], new Map([[1, ['user-1']]]), names);
    expect(rows).toEqual([]);
  });

  it('falls back to a generic label for an unknown player id', () => {
    const t = txn({ roster_ids: [1], adds: { '999': 1 } });
    const rows = buildTransactionNotificationRows([t], new Map([[1, ['user-1']]]), new Map());
    expect(rows[0].body).toBe('You added a player.');
  });
});
