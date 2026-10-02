import { describe, it, expect, beforeEach, vi } from 'vitest';

// checkMemory keeps its counter state in a module-level Map, so each test
// resets the module registry and re-imports fresh to avoid cross-test
// contamination (there's no exported "reset" — this is the module's own
// isolation boundary).
describe('checkMemory', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('allows requests under the limit and increments the count', async () => {
    const { checkMemory } = await import('./rateLimit');
    const key = 'test-key-under-limit';
    const first = checkMemory(key, 3, 60_000);
    const second = checkMemory(key, 3, 60_000);
    expect(first).toMatchObject({ allowed: true, count: 1 });
    expect(second).toMatchObject({ allowed: true, count: 2 });
  });

  it('denies requests once the count exceeds maxRequests, then resets after the window actually expires', async () => {
    vi.useFakeTimers();
    try {
      const { checkMemory } = await import('./rateLimit');
      const key = 'test-key-over-limit';
      checkMemory(key, 2, 1000);
      checkMemory(key, 2, 1000);
      const third = checkMemory(key, 2, 1000);
      expect(third).toMatchObject({ allowed: false, count: 3 });

      // Advance past the window so the next call resets the counter to 1.
      vi.advanceTimersByTime(1001);
      const afterExpiry = checkMemory(key, 2, 1000);
      expect(afterExpiry).toMatchObject({ allowed: true, count: 1 });
    } finally {
      vi.useRealTimers();
    }
  });
});
