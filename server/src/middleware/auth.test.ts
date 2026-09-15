import { describe, it, expect } from 'vitest';
import { shouldDevAutoLogin } from './auth';

describe('shouldDevAutoLogin', () => {
  const dev = { ENVIRONMENT: 'development', DEV_AUTO_LOGIN_EMAIL: 'DevTest@filmroom.local ' };

  it('returns the normalized email on a local host outside production', () => {
    expect(shouldDevAutoLogin(dev, 'localhost:8787', 'localhost')).toBe('devtest@filmroom.local');
    expect(shouldDevAutoLogin(dev, '127.0.0.1', '127.0.0.1')).toBe('devtest@filmroom.local');
  });

  it('never applies in production, even on localhost', () => {
    expect(shouldDevAutoLogin({ ...dev, ENVIRONMENT: 'production' }, 'localhost', 'localhost')).toBeNull();
  });

  it('never applies to a public host', () => {
    expect(shouldDevAutoLogin(dev, 'filmroom-api.earle2001.workers.dev', 'filmroom-api.earle2001.workers.dev')).toBeNull();
    expect(shouldDevAutoLogin(dev, 'localhost.evil.com', 'localhost.evil.com')).toBeNull();
  });

  it('is off when the var is unset or blank', () => {
    expect(shouldDevAutoLogin({ ENVIRONMENT: 'development' }, 'localhost', 'localhost')).toBeNull();
    expect(shouldDevAutoLogin({ ENVIRONMENT: 'development', DEV_AUTO_LOGIN_EMAIL: '  ' }, 'localhost', 'localhost')).toBeNull();
  });

  it('never applies when the Host header is local but the request URL hostname is not (spoofed Host)', () => {
    expect(shouldDevAutoLogin(dev, 'localhost', 'filmroom-api.earle2001.workers.dev')).toBeNull();
  });

  it('never applies when the request URL hostname is local but the Host header is not', () => {
    expect(shouldDevAutoLogin(dev, 'filmroom-api.earle2001.workers.dev', 'localhost')).toBeNull();
  });
});
