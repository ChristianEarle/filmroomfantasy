import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.workers.test.ts', 'node_modules/**'],
        },
      },
      './vitest.workers.config.ts',
    ],
  },
});
