/**
 * Twitter/X news fetcher for fantasy football.
 * Fetches tweets from RSS feeds (Nitter, or any RSS source).
 *
 * Configure via env: TWITTER_RSS_URLS (comma-separated RSS URLs)
 * Example: https://nitter.net/AdamSchefter/rss,https://nitter.net/RapSheet/rss
 *
 * Note: Public Nitter instances are often unreliable. Consider a private instance
 * or a paid API (RapidAPI, etc.) for production.
 */

export interface TweetItem {
  text: string;
  author: string;
  url: string | null;
  publishedAt: Date;
}

/** Extract text from RSS/CDATA content */
function extractText(raw: string): string {
  if (!raw) return '';
  // Strip CDATA
  const cdataMatch = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  const inner = cdataMatch ? cdataMatch[1] : raw;
  // Decode common entities
  return inner
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim();
}

/** Parse pubDate (RFC 2822) to Date */
function parsePubDate(raw: string): Date {
  if (!raw) return new Date();
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date() : d;
}

/** Extract URL from block - try link, guid, atom:link, href in description */
function extractUrl(block: string, desc: string): string | null {
  const clean = (s: string) => (s || '').replace(/<[^>]+>/g, '').trim() || null;
  // RSS <link href="..."> or <link>...</link>
  const linkMatch = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i)
    || block.match(/<link[^>]*>([^<]+)<\/link>/i);
  if (linkMatch) return clean(linkMatch[1]);
  // Atom <link rel="alternate" href="...">
  const atomLink = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  if (atomLink) return clean(atomLink[1]);
  // <guid isPermaLink="true"> or plain guid URL
  const guidMatch = block.match(/<guid[^>]*>([^<]+)<\/guid>/i);
  if (guidMatch) {
    const g = clean(guidMatch[1]);
    if (g && /^https?:\/\//i.test(g)) return g;
  }
  // href in description (e.g. <a href="https://...">)
  const hrefMatch = desc.match(/href=["'](https?:\/\/[^"']+)["']/i);
  if (hrefMatch) return hrefMatch[1].trim();
  return null;
}

/** Extract one item from RSS/Atom block */
function parseItemBlock(block: string, defaultAuthor: string): TweetItem | null {
  const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
  const contentMatch = block.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i)
    || block.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
  const pubMatch = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)
    || block.match(/<published[^>]*>([\s\S]*?)<\/published>/i)
    || block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);

  const title = titleMatch ? extractText(titleMatch[1]) : '';
  const desc = contentMatch ? contentMatch[1] : (descMatch ? descMatch[1] : '');
  const text = extractText(desc) || title;
  const pubDate = parsePubDate(pubMatch ? pubMatch[1].trim() : '');
  const link = extractUrl(block, desc);

  if (!text) return null;
  return { text, author: defaultAuthor, url: link, publishedAt: pubDate };
}

/**
 * Parse RSS 2.0 or Atom XML into TweetItem array.
 */
function parseRssXml(xml: string, defaultAuthor: string): TweetItem[] {
  const items: TweetItem[] = [];
  // RSS 2.0: <item>...</item>
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  // Atom: <entry>...</entry>
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;

  for (const regex of [itemRegex, entryRegex]) {
    regex.lastIndex = 0;
    while ((match = regex.exec(xml)) !== null) {
      const item = parseItemBlock(match[1], defaultAuthor);
      if (item) items.push(item);
    }
  }

  return items;
}

/**
 * Fetch items from an RSS feed URL with retry logic and exponential backoff.
 * Retries up to 2 times (3 total attempts) on transient failures.
 */
async function fetchRssFeed(
  url: string,
  author: string,
  maxRetries = 2
): Promise<{ items: TweetItem[]; error?: string; attempts: number }> {
  let lastError = '';
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff: 1s, 2s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        console.log(`[rss] Retry ${attempt}/${maxRetries} for ${url}`);
      }
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RSS-Reader/1.0; +https://filmroomfantasy.com)',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        // Don't retry 4xx client errors (except 429 rate limit)
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          return { items: [], error: `HTTP ${res.status}`, attempts: attempt + 1 };
        }
        lastError = `HTTP ${res.status}`;
        continue;
      }
      const xml = await res.text();
      const items = parseRssXml(xml, author);
      return { items, attempts: attempt + 1 };
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Fetch failed';
    }
  }
  return { items: [], error: lastError, attempts: maxRetries + 1 };
}

/**
 * Parse TWITTER_RSS_URLS format: "url1|Author1,url2|Author2" or "url1,url2" (author from URL)
 */
function parseRssUrls(config: string): { url: string; author: string }[] {
  if (!config || !config.trim()) return [];
  return config.split(',').map((s) => {
    const t = s.trim();
    const pipe = t.indexOf('|');
    if (pipe >= 0) {
      return { url: t.slice(0, pipe).trim(), author: t.slice(pipe + 1).trim() || 'Twitter' };
    }
    // Extract author from Nitter URL: .../username/rss -> username
    const m = t.match(/\/([^/]+)\/rss$/i);
    return { url: t, author: m ? m[1] : 'Twitter' };
  }).filter((x) => x.url);
}

export interface FetchResult {
  items: TweetItem[];
  diagnostics: { url: string; author: string; count: number; error?: string }[];
}

/**
 * Fetch items from all configured RSS URLs in parallel with retry logic.
 */
export async function fetchTwitterTweets(rssUrlsConfig: string): Promise<FetchResult> {
  const sources = parseRssUrls(rssUrlsConfig);
  const all: TweetItem[] = [];
  const diagnostics: { url: string; author: string; count: number; error?: string }[] = [];

  // Fetch all sources in parallel instead of sequentially
  const results = await Promise.allSettled(
    sources.map(({ url, author }) => fetchRssFeed(url, author))
  );

  for (let i = 0; i < sources.length; i++) {
    const { url, author } = sources[i];
    const result = results[i];
    if (result.status === 'fulfilled') {
      diagnostics.push({ url, author, count: result.value.items.length, error: result.value.error });
      all.push(...result.value.items);
    } else {
      diagnostics.push({ url, author, count: 0, error: result.reason?.message || 'Unknown error' });
    }
  }

  // Dedupe by text (same item from multiple sources)
  const seen = new Set<string>();
  const deduped = all.filter((t) => {
    const key = t.text.slice(0, 100);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { items: deduped, diagnostics };
}
