import { dispatchTick, releaseDispatch, writeHeartbeat } from './ledger';
import type { LeasedJob } from './ledger';
import type { IngestEnv, IngestMessage } from './types';

/** About 2x the `ingest` consumer's max_concurrency (wrangler.ingest.toml). */
export const MAX_QUEUED = 8;
/** Queues' per-sendBatch message limit. */
export const SEND_BATCH_LIMIT = 100;

export type DispatchSummary = {
  leased: number;
  reaped: number;
  released: number;
  sendFailures: number;
};

function toMessage({ key, token, kind }: LeasedJob): MessageSendRequest<IngestMessage> {
  return { body: { v: 1, key, token, kind } };
}

/**
 * Sends leased jobs to the ingest queue in batches. A batch that fails to
 * send has its leases released so the next tick can lease those jobs again.
 * Returns how many messages were not sent.
 */
export async function sendLeased(env: IngestEnv, leased: LeasedJob[]): Promise<number> {
  let failures = 0;
  for (let i = 0; i < leased.length; i += SEND_BATCH_LIMIT) {
    const part = leased.slice(i, i + SEND_BATCH_LIMIT);
    try {
      await env.INGEST_QUEUE.sendBatch(part.map(toMessage));
    } catch (error) {
      failures += part.length;
      console.error(`[ingest] dispatcher: sending ${part.length} messages failed; releasing their leases:`, error);
      await releaseDispatch(env.DB, part).catch((releaseError) => {
        // Left alone, these leases expire after 30 minutes and are released by a later tick.
        console.error('[ingest] dispatcher: releasing leases failed:', releaseError);
      });
    }
  }
  return failures;
}

/**
 * One dispatcher tick (cron, every 5 minutes): reap, lease and send due jobs,
 * then write the 'dispatcher' heartbeat. Never throws; returns what it did.
 * `now` overrides D1's clock, for tests.
 */
export async function runDispatcher(env: IngestEnv, now?: number): Promise<DispatchSummary> {
  const summary: DispatchSummary = { leased: 0, reaped: 0, released: 0, sendFailures: 0 };
  try {
    const tick = await dispatchTick(env.DB, { maxQueued: MAX_QUEUED, now });
    summary.leased = tick.leased.length;
    summary.reaped = tick.reaped;
    summary.released = tick.released;
    summary.sendFailures = await sendLeased(env, tick.leased);
    await writeHeartbeat(env.DB, 'dispatcher', summary);
  } catch (error) {
    console.error('[ingest] dispatcher tick failed:', error);
  }
  if (summary.leased > 0 || summary.reaped > 0 || summary.released > 0) {
    console.log(`[ingest] dispatcher: leased ${summary.leased}, reaped ${summary.reaped}, released ${summary.released}, send failures ${summary.sendFailures}`);
  }
  return summary;
}
