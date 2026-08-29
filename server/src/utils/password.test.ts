import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('hashPassword / verifyPassword', () => {
  it('verifies the correct password against its own hash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  });

  it('produces a different hash each time (random salt)', async () => {
    const hashA = await hashPassword('same-password');
    const hashB = await hashPassword('same-password');
    expect(hashA).not.toBe(hashB);
    await expect(verifyPassword('same-password', hashA)).resolves.toBe(true);
    await expect(verifyPassword('same-password', hashB)).resolves.toBe(true);
  });

  it('resolves false instead of throwing on a malformed stored hash', async () => {
    await expect(verifyPassword('anything', 'not-valid-base64!!!')).resolves.toBe(false);
  });
});
