import { applyD1Migrations, env } from 'cloudflare:test';

// Applies every migration in server/migrations/ to the isolated in-memory D1
// instance before any workers-pool test runs. TEST_MIGRATIONS is populated in
// vitest.workers.config.ts (Node-side readD1Migrations -> Miniflare binding),
// since applyD1Migrations runs inside the Workers runtime and can't read the
// filesystem itself.
await applyD1Migrations(env.DB, (env as unknown as { TEST_MIGRATIONS: Parameters<typeof applyD1Migrations>[1] }).TEST_MIGRATIONS);
