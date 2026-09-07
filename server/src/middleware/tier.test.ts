import { describe, it, expect } from 'vitest';
import { isLocalDevRequest, resolveEffectiveTier, resolveTierOverride } from './tier';

const dev = { ENVIRONMENT: 'development', DEV_TIER_OVERRIDE: 'pro' };

describe('isLocalDevRequest', () => {
  it('accepts localhost, loopback, and *.localhost with or without a port', () => {
    for (const h of ['localhost', 'localhost:8787', '127.0.0.1:8787', '[::1]:8787', 'app.localhost:3000']) {
      expect(isLocalDevRequest(h)).toBe(true);
    }
  });

  it('rejects public hosts and empty values', () => {
    for (const h of ['filmroom-api.earle2001.workers.dev', 'filmroomfantasy.com', 'localhost.evil.com', '', undefined, null]) {
      expect(isLocalDevRequest(h as string | undefined | null)).toBe(false);
    }
  });
});

describe('resolveTierOverride', () => {
  it('applies only when the var is set, not production, and the host is local', () => {
    expect(resolveTierOverride(dev, 'localhost:8787')).toBe('pro');
    expect(resolveTierOverride({ ...dev, DEV_TIER_OVERRIDE: 'elite' }, '127.0.0.1')).toBe('elite');
  });

  it('never applies in production, even on a local host', () => {
    expect(resolveTierOverride({ ENVIRONMENT: 'production', DEV_TIER_OVERRIDE: 'pro' }, 'localhost')).toBeNull();
  });

  it('never applies to a non-local host, even in development', () => {
    expect(resolveTierOverride(dev, 'filmroom-api.earle2001.workers.dev')).toBeNull();
  });

  it('ignores unset or invalid values', () => {
    expect(resolveTierOverride({ ENVIRONMENT: 'development' }, 'localhost')).toBeNull();
    expect(resolveTierOverride({ ENVIRONMENT: 'development', DEV_TIER_OVERRIDE: 'admin' }, 'localhost')).toBeNull();
    expect(resolveTierOverride({ ENVIRONMENT: 'development', DEV_TIER_OVERRIDE: 'free' }, 'localhost')).toBeNull();
  });
});

describe('resolveEffectiveTier', () => {
  it('raises a free user to the override tier locally and flags it', () => {
    expect(resolveEffectiveTier({ subscriptionTier: 'free' }, dev, 'localhost:8787')).toEqual({ tier: 'pro', overridden: true });
  });

  it('never lowers a real tier', () => {
    expect(resolveEffectiveTier({ subscriptionTier: 'elite' }, dev, 'localhost')).toEqual({ tier: 'elite', overridden: false });
  });

  it('returns the real tier when the override does not apply', () => {
    expect(
      resolveEffectiveTier({ subscriptionTier: null }, { ENVIRONMENT: 'production', DEV_TIER_OVERRIDE: 'pro' }, 'localhost'),
    ).toEqual({ tier: 'free', overridden: false });
  });
});
