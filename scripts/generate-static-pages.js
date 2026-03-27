/**
 * Post-build script to generate static HTML pages for SEO-critical routes.
 *
 * This creates individual index.html files for each public route so that
 * search engine crawlers see proper meta tags and content even without
 * JavaScript execution.
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
const BASE_URL = 'https://filmroomfantasy.com';

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
  {
    path: '/login',
    title: 'Sign In | FilmRoom',
    description: 'Sign in to your FilmRoom account to access your fantasy football leagues, rankings, and personalized projections.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'Sign In', 'item': `${BASE_URL}/login` },
      ],
    },
  },
  {
    path: '/register',
    title: 'Sign Up Free | FilmRoom',
    description: 'Create a free FilmRoom account. Get access to fantasy football rankings, projections, and league management tools.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'Sign Up', 'item': `${BASE_URL}/register` },
      ],
    },
  },
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
  {
    path: '/draft-rankings',
    title: 'Fantasy Football Draft Rankings | FilmRoom',
    description: 'AI-powered fantasy football draft rankings with ADP tracking, tier breakdowns, and custom scoring projections.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'Draft Rankings', 'item': `${BASE_URL}/draft-rankings` },
      ],
    },
  },
  {
    path: '/league-analyzer',
    title: 'League Analyzer | FilmRoom',
    description: 'Deep dive into your fantasy football league with power rankings, strength of schedule analysis, and roster composition breakdowns.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'League Analyzer', 'item': `${BASE_URL}/league-analyzer` },
      ],
    },
  },
  {
    path: '/research',
    title: 'Player Research & Analysis | FilmRoom',
    description: 'In-depth fantasy football player analysis with Vegas props, game logs, projection accuracy tracking, and advanced metrics.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'Research', 'item': `${BASE_URL}/research` },
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
  const ogTags = `
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${BASE_URL}${route.path}" />
    <meta property="og:title" content="${route.title}" />
    <meta property="og:description" content="${route.description}" />
    <meta property="og:image" content="${BASE_URL}/og-image.png" />
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${BASE_URL}${route.path}" />
    <meta property="twitter:title" content="${route.title}" />
    <meta property="twitter:description" content="${route.description}" />
    <meta property="twitter:image" content="${BASE_URL}/og-image.png" />`;

  let jsonLdTag = '';
  if (route.jsonLd) {
    jsonLdTag = `\n    <script type="application/ld+json">${JSON.stringify(route.jsonLd)}</script>`;
  }

  html = html.replace('</head>', `${ogTags}${jsonLdTag}\n  </head>`);

  return html;
}

function main() {
  const templatePath = join(BUILD_DIR, 'index.html');

  if (!existsSync(templatePath)) {
    console.error('Build output not found. Run `npm run build` first.');
    process.exit(1);
  }

  const template = readFileSync(templatePath, 'utf-8');
  let count = 0;

  for (const route of ROUTES) {
    const dir = join(BUILD_DIR, route.path);
    mkdirSync(dir, { recursive: true });

    const html = generatePage(route, template);
    writeFileSync(join(dir, 'index.html'), html);
    count++;
  }

  console.log(`Generated ${count} static pages for SEO (including ${ARTICLES.length} articles).`);
}

main();
