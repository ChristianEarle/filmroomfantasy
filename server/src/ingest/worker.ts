import { consumeBatch, consumeDeadLetters } from './consumer';
import { runDispatcher } from './dispatcher';
import type { IngestEnv, IngestMessage } from './types';

const DEAD_LETTER_QUEUE = 'ingest-dlq';
const REQUIRED: Array<keyof IngestEnv> = ['DB', 'INGEST_QUEUE', 'INGEST_INTERACTIVE_QUEUE', 'ODDS_API_KEY'];

// Bindings are only reachable inside a handler, so the check runs on each
// isolate's first invocation.
let configChecked = false;

function checkConfig(env: IngestEnv): void {
  if (configChecked) return;
  configChecked = true;
  for (const name of REQUIRED) {
    if (!env[name]) console.error(`[ingest] CRITICAL: ${name} not set`);
  }
}

/** The filmroom-ingest Worker (wrangler.ingest.toml). It has no fetch handler. */
export default {
  async scheduled(_controller, env) {
    checkConfig(env);
    await runDispatcher(env);
  },

  async queue(batch, env) {
    checkConfig(env);
    if (batch.queue === DEAD_LETTER_QUEUE) await consumeDeadLetters(batch, env);
    else await consumeBatch(batch, env);
  },
} satisfies ExportedHandler<IngestEnv, IngestMessage>;
