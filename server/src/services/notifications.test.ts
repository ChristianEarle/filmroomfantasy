import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildInjuryDigestHtml, sendInjuryDigestEmail } from './notifications';

function stubFetch(ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({ ok } as unknown as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildInjuryDigestHtml', () => {
  it('links each item to its player page under the given app URL', () => {
    const html = buildInjuryDigestHtml(
      [{ title: 'Player X (out, hamstring)', body: 'Ruled out for Sunday.', link: '/players/player-x-123' }],
      'https://filmroomfantasy.com',
    );
    expect(html).toContain('href="https://filmroomfantasy.com/players/player-x-123"');
    expect(html).toContain('Player X (out, hamstring)');
    expect(html).toContain('Ruled out for Sunday.');
  });

  it('renders a plain heading (no link) when an item has no link', () => {
    const html = buildInjuryDigestHtml([{ title: 'Player Y', body: null, link: null }], 'https://filmroomfantasy.com');
    expect(html).not.toContain('<a href');
    expect(html).toContain('Player Y');
  });

  it('renders multiple items in one digest', () => {
    const html = buildInjuryDigestHtml(
      [
        { title: 'Player A', body: null, link: null },
        { title: 'Player B', body: null, link: null },
      ],
      'https://filmroomfantasy.com',
    );
    expect(html).toContain('Player A');
    expect(html).toContain('Player B');
  });
});

describe('sendInjuryDigestEmail', () => {
  it('posts to Resend with the recipient, a single-item subject, and an authorization header', async () => {
    const fetchMock = stubFetch(true);
    const ok = await sendInjuryDigestEmail(
      'user@example.com',
      [{ title: 'Player X', body: 'Out for the season.', link: '/players/player-x-1' }],
      'https://filmroomfantasy.com',
      'test-resend-key',
    );

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-resend-key' }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.to).toEqual(['user@example.com']);
    expect(body.subject).toBe('Injury alert: Player X');
  });

  it('uses a count-based subject for multiple items', async () => {
    const fetchMock = stubFetch(true);
    await sendInjuryDigestEmail(
      'user@example.com',
      [
        { title: 'Player A', body: null, link: null },
        { title: 'Player B', body: null, link: null },
      ],
      'https://filmroomfantasy.com',
      'test-resend-key',
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.subject).toBe('2 new injury alerts');
  });

  it('returns false (never throws) when Resend responds non-OK', async () => {
    stubFetch(false);
    const ok = await sendInjuryDigestEmail('user@example.com', [{ title: 'Player X', body: null, link: null }], 'https://filmroomfantasy.com', 'test-resend-key');
    expect(ok).toBe(false);
  });

  it('returns false (never throws) when the fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const ok = await sendInjuryDigestEmail('user@example.com', [{ title: 'Player X', body: null, link: null }], 'https://filmroomfantasy.com', 'test-resend-key');
    expect(ok).toBe(false);
  });
});
