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

// SEO metadata for each public route
const ROUTES = [
  {
    path: '/player-rankings',
    title: 'Fantasy Football Player Rankings | FilmRoom',
    description: 'Weekly fantasy football player rankings powered by Vegas lines. PPR, Half PPR, and Standard scoring projections updated every 4 hours.',
  },
  {
    path: '/waivers',
    title: 'Waiver Wire Picks | FilmRoom',
    description: 'Find the best waiver wire pickups and free agent adds for your fantasy football league, ranked by projected value.',
  },
  {
    path: '/trade-analyzer',
    title: 'AI Trade Analyzer | FilmRoom',
    description: 'Evaluate fantasy football trades with AI-powered analysis. Get instant trade values and fair deal recommendations.',
  },
  {
    path: '/game-slate',
    title: 'NFL Game Slate & Scores | FilmRoom',
    description: 'Live NFL game slate with scores, spreads, over/unders, and fantasy-relevant stats for every matchup.',
  },
  {
    path: '/trends',
    title: 'Fantasy Football Trends | FilmRoom',
    description: 'Track trending players, roster percentages, and add/drop activity across fantasy football leagues.',
  },
  {
    path: '/pricing',
    title: 'Pricing & Plans | FilmRoom',
    description: 'FilmRoom pricing plans. Free fantasy football rankings, Pro features for serious managers, and Elite tools for the competitive edge.',
  },
  {
    path: '/login',
    title: 'Sign In | FilmRoom',
    description: 'Sign in to your FilmRoom account to access your fantasy football leagues, rankings, and personalized projections.',
  },
  {
    path: '/register',
    title: 'Sign Up Free | FilmRoom',
    description: 'Create a free FilmRoom account. Get access to fantasy football rankings, projections, and league management tools.',
  },
  {
    path: '/articles',
    title: 'Fantasy Football Articles & Guides | FilmRoom',
    description: 'Expert fantasy football strategy guides, rankings analysis, waiver wire tips, and beginner resources.',
  },
  {
    path: '/playoff-predictor',
    title: 'Fantasy Football Playoff Predictor | FilmRoom',
    description: 'Simulate your fantasy football playoff scenarios with AI-powered predictions and strength of schedule analysis.',
  },
  {
    path: '/draft-rankings',
    title: 'Fantasy Football Draft Rankings | FilmRoom',
    description: 'AI-powered fantasy football draft rankings with ADP tracking, tier breakdowns, and custom scoring projections.',
  },
];

function generatePage(route, template) {
  const BASE_URL = 'https://filmroomfantasy.com';
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

  // Add OG and Twitter tags if not present (insert before </head>)
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

  html = html.replace('</head>', `${ogTags}\n  </head>`);

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

  console.log(`Generated ${count} static pages for SEO.`);
}

main();
