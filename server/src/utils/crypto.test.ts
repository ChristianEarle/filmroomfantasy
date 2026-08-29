import { describe, it, expect } from 'vitest';
import { timingSafeEqual } from './crypto';

describe('timingSafeEqual', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqual('super-secret-key', 'super-secret-key')).toBe(true);
  });

  it('returns false for different strings of the same length', () => {
    expect(timingSafeEqual('super-secret-key', 'super-secret-kex')).toBe(false);
  });

  it('returns false for strings of different lengths', () => {
    expect(timingSafeEqual('short', 'a-much-longer-string')).toBe(false);
  });

  it('returns true for two empty strings', () => {
    expect(timingSafeEqual('', '')).toBe(true);
  });
});
