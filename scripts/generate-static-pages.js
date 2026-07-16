/**
 * Post-build script to generate static HTML pages for SEO-critical routes.
 *
 * This creates individual index.html files for each public route so that
 * search engine crawlers see proper meta tags and content even without
 * JavaScript execution.
 *
 * It also:
 *  - fetches the top rostered skill players (QB/RB/WR/TE, capped at
 *    MAX_PLAYER_PAGES) from the live API and emits
 *    build/players/<slug>-<id>/index.html for each, with per-player title,
 *    description, OG/Twitter tags, canonical, and JSON-LD Person markup that
 *    mirrors getPlayerProfileSEOProps in src/components/SEO.tsx;
 *  - regenerates build/sitemap.xml = public/sitemap.xml (hand-maintained
 *    base) + one <url> per generated player page.
 *
 * The player fetch is best-effort: if the API is unreachable (e.g. CI with no
 * egress to prod) the script warns, skips player pages, and still exits 0.
 * Set SKIP_PLAYER_PAGES=1 to skip the API fetch entirely, or SEO_API_BASE to
 * point at a different API origin.
 *
 * Run after `vite build`: node scripts/generate-static-pages.js
 *
 * For full prerendering with JavaScript execution, consider:
 * - vite-plugin-prerender (requires puppeteer)
 * - @prerenderer/prerenderer
 * - A prerendering service like prerender.io or Cloudflare Workers
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = join(__dirname, '..', 'build');
const PUBLIC_DIR = join(__dirname, '..', 'public');
const BASE_URL = 'https://filmroomfantasy.com';

// Live API used to seed per-player static pages at build time.
// Override with SEO_API_BASE for local testing.
const API_BASE = process.env.SEO_API_BASE || 'https://filmroomfantasy.com/api';
const FETCH_TIMEOUT_MS = 15_000;
// Top rostered skill players per position (roughly mirrors startable depth +
// bench-stash territory). Total ≈ 360, hard-capped at MAX_PLAYER_PAGES.
const POSITION_QUOTAS = [
  ['QB', 60],
  ['RB', 100],
  ['WR', 140],
  ['TE', 60],
];
const MAX_PLAYER_PAGES = 400;

// SEO metadata for each public route
const ROUTES = [
  {
    path: '/player-rankings',
    title: 'Fantasy Football Player Rankings | FilmRoom',
    description: 'Weekly fantasy football player rankings powered by Vegas lines. PPR, Half PPR, and Standard scoring projections updated every 4 hours.',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        'name': 'Fantasy Football Player Rankings',
        'description': 'Weekly fantasy football player rankings powered by Vegas lines. PPR, Half PPR, and Standard scoring projections updated every 4 hours.',
        'url': `${BASE_URL}/player-rankings`,
        'isPartOf': { '@type': 'WebApplication', 'name': 'FilmRoom' },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
          { '@type': 'ListItem', 'position': 2, 'name': 'Player Rankings', 'item': `${BASE_URL}/player-rankings` },
        ],
      },
    ],
  },
  {
    path: '/waivers',
    title: 'Waiver Wire Picks | FilmRoom',
    description: 'Find the best waiver wire pickups and free agent adds for your fantasy football league, ranked by projected value.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'Waiver Wire', 'item': `${BASE_URL}/waivers` },
      ],
    },
  },
  {
    path: '/trade-analyzer',
    title: 'AI Trade Analyzer | FilmRoom',
    description: 'Evaluate fantasy football trades with AI-powered analysis. Get instant trade values and fair deal recommendations.',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        'name': 'AI Fantasy Football Trade Analyzer',
        'description': 'Evaluate fantasy football trades with AI-powered analysis. Get instant trade values and fair deal recommendations.',
        'url': `${BASE_URL}/trade-analyzer`,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
          { '@type': 'ListItem', 'position': 2, 'name': 'Trade Analyzer', 'item': `${BASE_URL}/trade-analyzer` },
        ],
      },
    ],
  },
  {
    path: '/game-slate',
    title: 'NFL Game Slate & Scores | FilmRoom',
    description: 'Live NFL game slate with scores, spreads, over/unders, and fantasy-relevant stats for every matchup.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'NFL Games', 'item': `${BASE_URL}/game-slate` },
      ],
    },
  },
  {
    path: '/trends',
    title: 'Fantasy Football Trends | FilmRoom',
    description: 'Track trending players, roster percentages, and add/drop activity across fantasy football leagues.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'Trends', 'item': `${BASE_URL}/trends` },
      ],
    },
  },
  {
    path: '/pricing',
    title: 'Pricing & Plans | FilmRoom',
    description: 'FilmRoom pricing plans. Free fantasy football rankings, Pro features for serious managers, and Elite tools for the competitive edge.',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        'name': 'FilmRoom Fantasy Football',
        'description': 'Fantasy football analysis platform with player rankings, trade analyzer, and league management tools.',
        'brand': { '@type': 'Brand', 'name': 'FilmRoom' },
        'offers': [
          { '@type': 'Offer', 'name': 'Free', 'price': '0', 'priceCurrency': 'USD', 'description': 'Player rankings, game slate, news, 1 league sync, 3 trade analyses/day' },
          { '@type': 'Offer', 'name': 'Pro', 'price': '4.99', 'priceCurrency': 'USD', 'description': 'Unlimited league syncs, trending players, 5 trade analyses/day' },
          { '@type': 'Offer', 'name': 'Elite', 'price': '9.99', 'priceCurrency': 'USD', 'description': 'Deep player research, Vegas props, game logs, unlimited trade analyses' },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
          { '@type': 'ListItem', 'position': 2, 'name': 'Pricing', 'item': `${BASE_URL}/pricing` },
        ],
      },
    ],
  },
  // login & register removed: utility screens without publisher content (AdSense compliance)
  {
    path: '/articles',
    title: 'Fantasy Football Articles & Guides | FilmRoom',
    description: 'Expert fantasy football strategy guides, rankings analysis, waiver wire tips, and beginner resources.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'Articles', 'item': `${BASE_URL}/articles` },
      ],
    },
  },
  {
    path: '/playoff-predictor',
    title: 'Fantasy Football Playoff Predictor | FilmRoom',
    description: 'Simulate your fantasy football playoff scenarios with AI-powered predictions and strength of schedule analysis.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'Playoff Predictor', 'item': `${BASE_URL}/playoff-predictor` },
      ],
    },
  },
  // draft-rankings, league-analyzer, research removed: Coming Soon placeholder pages (AdSense compliance)
  {
    path: '/privacy',
    title: 'Privacy Policy | FilmRoom',
    description: 'FilmRoom Fantasy privacy policy. Learn how we collect, use, and protect your personal information and league data.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'Privacy Policy', 'item': `${BASE_URL}/privacy` },
      ],
    },
  },
  {
    path: '/terms',
    title: 'Terms of Service | FilmRoom',
    description: 'FilmRoom Fantasy terms of service. Read the terms and conditions governing your use of our fantasy football analysis platform.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'Terms of Service', 'item': `${BASE_URL}/terms` },
      ],
    },
  },
  {
    path: '/cookies',
    title: 'Cookie Policy | FilmRoom',
    description: 'Learn about the cookies FilmRoom Fantasy uses, how we use them, and how to control your preferences.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'Cookie Policy', 'item': `${BASE_URL}/cookies` },
      ],
    },
  },
  {
    path: '/dmca',
    title: 'DMCA & Copyright Policy | FilmRoom',
    description: 'How to report copyright infringement on FilmRoom Fantasy and our process for handling DMCA takedown notices.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'DMCA', 'item': `${BASE_URL}/dmca` },
      ],
    },
  },
  {
    path: '/refunds',
    title: 'Refund & Cancellation Policy | FilmRoom',
    description: 'How FilmRoom Fantasy subscription billing, cancellations, and refunds work.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'Refunds', 'item': `${BASE_URL}/refunds` },
      ],
    },
  },
  {
    path: '/do-not-sell',
    title: 'Do Not Sell or Share My Personal Information | FilmRoom',
    description: 'California and state privacy rights. Opt out of the sale or sharing of your personal information on FilmRoom Fantasy.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'Do Not Sell or Share', 'item': `${BASE_URL}/do-not-sell` },
      ],
    },
  },
  {
    path: '/disclaimer',
    title: 'Disclaimer | FilmRoom',
    description: 'FilmRoom Fantasy disclaimer. Our rankings, projections, and analysis are for informational purposes only.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'Disclaimer', 'item': `${BASE_URL}/disclaimer` },
      ],
    },
  },
  {
    path: '/accessibility',
    title: 'Accessibility Statement | FilmRoom',
    description: "FilmRoom Fantasy's commitment to accessibility and our progress toward WCAG 2.1 AA conformance.",
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'Accessibility', 'item': `${BASE_URL}/accessibility` },
      ],
    },
  },
  {
    path: '/acceptable-use',
    title: 'Acceptable Use Policy | FilmRoom',
    description: 'The rules for using FilmRoom Fantasy. Prohibited activities and enforcement.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'Acceptable Use', 'item': `${BASE_URL}/acceptable-use` },
      ],
    },
  },
];

// Individual article pages — hardcoded from src/data/articles.ts
const ARTICLES = [
  {
    slug: 'how-vegas-lines-predict-fantasy-football-points',
    title: 'How Vegas Lines Predict Fantasy Football Points Better Than Expert Rankings | FilmRoom',
    description: 'Learn why spread, over/under, and implied team totals are the most reliable foundation for fantasy football projections — and how FilmRoom uses them.',
  },
  {
    slug: 'fantasy-football-waiver-wire-strategy-guide',
    title: 'The Complete Fantasy Football Waiver Wire Strategy Guide | FilmRoom',
    description: 'Master the waiver wire with this comprehensive guide covering FAAB bidding, priority strategies, and how to identify breakout players before your leaguemates.',
  },
  {
    slug: 'ppr-vs-half-ppr-vs-standard-scoring-explained',
    title: 'PPR vs Half PPR vs Standard Scoring: Which Format Changes Player Values Most? | FilmRoom',
    description: 'A breakdown of how PPR, Half PPR, and Standard scoring formats affect player rankings, draft strategy, and weekly lineup decisions.',
  },
  {
    slug: 'fantasy-football-trade-analyzer-how-to-evaluate-trades',
    title: 'How to Evaluate Fantasy Football Trades: A Data-Driven Approach | FilmRoom',
    description: "Stop relying on gut feelings for trades. Learn how FilmRoom's AI Trade Analyzer evaluates deals using rest-of-season projections, schedule strength, and positional scarcity.",
  },
  {
    slug: 'start-sit-decision-making-framework',
    title: 'The Ultimate Start/Sit Decision Framework for Fantasy Football | FilmRoom',
    description: 'A systematic approach to making weekly start/sit decisions using matchup data, Vegas lines, and usage trends instead of gut feelings.',
  },
];

// Convert articles to route format
for (const article of ARTICLES) {
  ROUTES.push({
    path: `/articles/${article.slug}`,
    title: article.title,
    description: article.description,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        'headline': article.title.replace(' | FilmRoom', ''),
        'description': article.description,
        'url': `${BASE_URL}/articles/${article.slug}`,
        'publisher': { '@type': 'Organization', 'name': 'FilmRoom', 'url': BASE_URL },
        'mainEntityOfPage': `${BASE_URL}/articles/${article.slug}`,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
          { '@type': 'ListItem', 'position': 2, 'name': 'Articles', 'item': `${BASE_URL}/articles` },
          { '@type': 'ListItem', 'position': 3, 'name': article.title.replace(' | FilmRoom', ''), 'item': `${BASE_URL}/articles/${article.slug}` },
        ],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Per-player static pages
// ---------------------------------------------------------------------------

/**
 * EXACT copy of slugify() in src/utils/slug.ts — the SPA builds profile URLs
 * as /players/${slugify(name)}-${externalId ?? id} (see buildPlayerProfilePath
 * and PlayerProfileView). Keep these in lockstep or static and SPA canonical
 * URLs will diverge.
 */
function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Mirrors positionFull in src/components/SEO.tsx (getPlayerProfileSEOProps).
const POSITION_FULL = {
  QB: 'Quarterback',
  RB: 'Running Back',
  WR: 'Wide Receiver',
  TE: 'Tight End',
  K: 'Kicker',
  DEF: 'Defense',
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const escapeXml = escapeHtml;

/**
 * Sleeper CDN headshot fallback — same pattern the backend uses when syncing
 * players (server/src/services/sleeper.ts):
 *   https://sleepercdn.com/content/nfl/players/<externalId>.jpg
 */
function headshotFor(player) {
  if (player.headshotUrl) return player.headshotUrl;
  const ext = player.externalId != null ? String(player.externalId) : '';
  if (/^\d+$/.test(ext)) {
    return `https://sleepercdn.com/content/nfl/players/${ext}.jpg`;
  }
  return null;
}

/** Most recent season with stats: Jan–Jul → previous year (matches server fallback). */
function statsSeason(now = new Date()) {
  return now.getMonth() <= 6 ? now.getFullYear() - 1 : now.getFullYear();
}

async function fetchJson(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

/**
 * Fetch the top skill players per position from the live API, sorted by
 * average PPR points for the most recent completed season. Any position that
 * fails (network down, API hiccup, CI without egress) is skipped with a
 * warning — this must never fail the build.
 */
async function fetchTopPlayers() {
  const season = statsSeason();
  const seen = new Set();
  const players = [];

  for (const [position, quota] of POSITION_QUOTAS) {
    const url = `${API_BASE}/players?position=${position}&limit=${quota}&page=1&includeStats=true&sortBy=avgPointsPPR&sortOrder=desc&season=${season}`;
    let rows;
    try {
      const data = await fetchJson(url);
      rows = Array.isArray(data?.players) ? data.players : [];
    } catch (err) {
      console.warn(`WARN: player fetch failed for ${position}: ${err.message}`);
      continue;
    }

    for (const p of rows) {
      if (!p || typeof p.name !== 'string' || !p.name.trim()) continue;
      if (!p.team) continue; // skip free agents — thin pages, unstable URLs
      // Prefer the short, shareable Sleeper externalId in the canonical URL
      // when available; fall back to the internal id. Matches
      // PlayerProfileView's canonicalId logic so URLs are identical.
      const canonicalId = p.externalId ?? p.id;
      if (!canonicalId) continue;
      const key = String(canonicalId);
      if (seen.has(key)) continue;
      seen.add(key);
      players.push({
        name: p.name.trim(),
        team: p.team,
        position: p.position || position,
        externalId: p.externalId ?? null,
        headshotUrl: p.headshotUrl ?? null,
        canonicalId: key,
      });
      if (players.length >= MAX_PLAYER_PAGES) return players;
    }
  }

  return players;
}

/**
 * Build a ROUTES-shaped entry for one player. Title, description, and JSON-LD
 * intentionally mirror getPlayerProfileSEOProps in src/components/SEO.tsx so
 * the static shell and the hydrated SPA route emit identical SEO metadata.
 */
function buildPlayerRoute(player) {
  const { name, team, position } = player;
  const path = `/players/${slugify(name)}-${player.canonicalId}`;
  const posLabel = POSITION_FULL[position] ?? position ?? 'Player';
  const teamLabel = team ?? 'NFL';
  const title = `${name} Fantasy Stats, Projections & News (${teamLabel} ${position ?? ''}) | FilmRoom`
    .replace(/\s+/g, ' ')
    .trim();
  const description = `${name}, ${teamLabel} ${posLabel}. Weekly fantasy football stats, projections, matchup grade, Vegas props, and the latest news on FilmRoom.`;
  const headshot = headshotFor(player);

  return {
    path,
    title: escapeHtml(title),
    description: escapeHtml(description),
    ogType: 'profile',
    image: headshot ?? undefined,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        // schema.org has no Athlete type — Person with jobTitle/affiliation/
        // memberOf is the valid vocabulary for athletes.
        '@type': 'Person',
        'name': name,
        'jobTitle': posLabel,
        ...(team ? { 'affiliation': { '@type': 'SportsTeam', 'name': team } } : {}),
        'memberOf': { '@type': 'SportsOrganization', 'name': 'National Football League', 'url': 'https://www.nfl.com' },
        ...(headshot ? { 'image': headshot } : {}),
        'url': `${BASE_URL}${path}`,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
          { '@type': 'ListItem', 'position': 2, 'name': 'Player Rankings', 'item': `${BASE_URL}/player-rankings` },
          { '@type': 'ListItem', 'position': 3, 'name': name, 'item': `${BASE_URL}${path}` },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------

/**
 * Regenerate build/sitemap.xml: public/sitemap.xml stays the hand-maintained
 * base (the 16 static URLs, also the deploy fallback since Vite copies it into
 * build/), and one <url> per generated player page is appended before
 * </urlset>. If no player pages were generated the base is written unchanged.
 */
function generateSitemap(playerRoutes) {
  let base;
  try {
    base = readFileSync(join(PUBLIC_DIR, 'sitemap.xml'), 'utf-8');
  } catch (err) {
    console.warn(`WARN: could not read public/sitemap.xml (${err.message}); using empty urlset.`);
    base = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n';
  }

  const lastmod = new Date().toISOString().slice(0, 10);
  const entries = playerRoutes
    .map((route) => [
      '  <url>',
      `    <loc>${escapeXml(`${BASE_URL}${route.path}`)}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      '    <changefreq>weekly</changefreq>',
      '    <priority>0.6</priority>',
      '  </url>',
    ].join('\n'))
    .join('\n');

  const sitemap = entries
    ? base.replace(/<\/urlset>\s*$/, `${entries}\n</urlset>\n`)
    : base;

  writeFileSync(join(BUILD_DIR, 'sitemap.xml'), sitemap);
  return playerRoutes.length;
}

function generatePage(route, template) {
  let html = template;

  // Replace title
  html = html.replace(
    /<title>.*?<\/title>/,
    `<title>${route.title}</title>`
  );

  // Replace meta description
  html = html.replace(
    /<meta name="description" content=".*?" \/>/,
    `<meta name="description" content="${route.description}" />`
  );

  // Replace canonical URL
  html = html.replace(
    /<link rel="canonical" href=".*?" \/>/,
    `<link rel="canonical" href="${BASE_URL}${route.path}" />`
  );

  // Add OG, Twitter tags, and JSON-LD before </head>
  const ogImage = route.image || `${BASE_URL}/og-image.png`;
  const ogType = route.ogType
    || (route.path.startsWith('/articles/') && route.path !== '/articles' ? 'article' : 'website');
  const ogTags = `
    <meta property="og:type" content="${ogType}" />
    <meta property="og:url" content="${BASE_URL}${route.path}" />
    <meta property="og:title" content="${route.title}" />
    <meta property="og:description" content="${route.description}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${BASE_URL}${route.path}" />
    <meta property="twitter:title" content="${route.title}" />
    <meta property="twitter:description" content="${route.description}" />
    <meta property="twitter:image" content="${escapeHtml(ogImage)}" />`;

  let jsonLdTag = '';
  if (route.jsonLd) {
    // Escape "<" so player names (API-sourced data) can never break out of
    // the <script> block.
    const json = JSON.stringify(route.jsonLd).replace(/</g, '\\u003c');
    jsonLdTag = `\n    <script type="application/ld+json">${json}</script>`;
  }

  html = html.replace('</head>', `${ogTags}${jsonLdTag}\n  </head>`);

  return html;
}

async function main() {
  const templatePath = join(BUILD_DIR, 'index.html');

  if (!existsSync(templatePath)) {
    console.error('Build output not found. Run `npm run build` first.');
    process.exit(1);
  }

  const template = readFileSync(templatePath, 'utf-8');

  // Fetch top players from the live API. This is best-effort: CI or local
  // machines without network access to prod must still produce a valid build,
  // so any failure just skips player pages (exit 0 either way).
  let playerRoutes = [];
  if (process.env.SKIP_PLAYER_PAGES === '1') {
    console.log('SKIP_PLAYER_PAGES=1 — skipping per-player static pages.');
  } else {
    try {
      const players = await fetchTopPlayers();
      playerRoutes = players.map(buildPlayerRoute);
    } catch (err) {
      console.warn(`WARN: skipping player pages — API unavailable: ${err.message}`);
      playerRoutes = [];
    }
  }
  if (playerRoutes.length === 0 && process.env.SKIP_PLAYER_PAGES !== '1') {
    console.warn('WARN: no player pages generated (API unreachable or empty response). Static routes and base sitemap are unaffected.');
  }

  let count = 0;
  for (const route of [...ROUTES, ...playerRoutes]) {
    const dir = join(BUILD_DIR, route.path);
    mkdirSync(dir, { recursive: true });

    const html = generatePage(route, template);
    writeFileSync(join(dir, 'index.html'), html);
    count++;
  }

  // Regenerate build/sitemap.xml = hand-maintained base + player URLs.
  const sitemapPlayerCount = generateSitemap(playerRoutes);

  // Overwrite 404.html with the SPA shell so any path that misses both the
  // static-asset lookup and the _redirects catch-all still loads the React
  // app. Cloudflare Pages won't apply our `/* /index.html 200` rewrite when
  // the destination is /index.html — the canonical-URL redirect on
  // /index.html (308 → /) interferes — so without this, deep links like
  // /home, /signup, /login fall through to a bare Cloudflare 404 page.
  // This way the SPA renders correctly regardless of which fallback path
  // Pages picks (status code may be 200 or 404 depending; UX is the same).
  writeFileSync(join(BUILD_DIR, '404.html'), template);

  console.log(`Generated ${count} static pages for SEO (including ${ARTICLES.length} articles and ${playerRoutes.length} player profiles).`);
  console.log(`Wrote sitemap.xml with ${sitemapPlayerCount} player URLs appended to the static base.`);
  console.log('Wrote 404.html as SPA-shell fallback.');
}

main().catch((err) => {
  console.error('generate-static-pages failed:', err);
  process.exit(1);
});
