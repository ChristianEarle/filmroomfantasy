import { defineConfig } from 'vitest/config';

// Plain Node environment — these tests target pure logic (scoring math,
// name normalization, cache/chunking helpers, password hashing) that
// doesn't touch D1 or the Workers runtime, so no wrangler/Miniflare pool
// is needed here.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
});
