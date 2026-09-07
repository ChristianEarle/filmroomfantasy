import { defineProject } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';

// Migrations must be read on the Node side (readD1Migrations uses fs) and
// handed to the worker as a binding — `cloudflare:test`'s applyD1Migrations
// runs *inside* the Workers runtime, which has no filesystem access.
const migrations = await readD1Migrations('./migrations');

export default defineProject({
  test: {
    name: 'workers',
    include: ['src/**/*.workers.test.ts'],
    setupFiles: ['./test/workers-setup.ts'],
  },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: migrations,
          // wrangler.toml's top-level [vars] ENVIRONMENT is "production" (CI
          // deploys with `wrangler deploy --env=""`, which uses that block).
          // Tests want the pre-existing "development" behavior (verbose
          // logging, raw error messages, dev-only bypass gates reachable),
          // so set it explicitly here rather than inheriting the prod value.
          ENVIRONMENT: 'development',
          // Auth routes need JWT_SECRET to sign/verify tokens; wrangler.toml
          // leaves it to .dev.vars (gitignored) for real dev, so tests supply
          // their own throwaway value.
          JWT_SECRET: 'test-jwt-secret-for-vitest-only',
          // Admin routes accept X-Admin-Key matching SYNC_SECRET as an
          // alternative to JWT admin auth; tests supply their own throwaway
          // value the same way (see admin.workers.test.ts).
          SYNC_SECRET: 'test-sync-secret-for-vitest-only',
        },
      },
    }),
  ],
});
