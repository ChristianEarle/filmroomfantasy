/**
 * Build-time prerendering script.
 *
 * Spins up a local Vite preview server, visits each public route with
 * Puppeteer, waits for React to render, then saves the fully-rendered HTML
 * back into the build directory. This gives search engine crawlers real
 * page content without needing to execute JavaScript.
 *
 * Run after `vite build` and `generate-static-pages.js`:
 *   node scripts/prerender.js
 *
 * Requires: puppeteer (devDependency)
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = join(__dirname, '..', 'build');
const PORT = 4173; // Vite preview default port
const ORIGIN = `http://localhost:${PORT}`;

// Public routes that crawlers should see with full content.
// Authenticated routes (home, team, matchup, settings, etc.) are excluded
// because they require login and are noindex'd anyway.
const ROUTES = [
  '/',
  '/player-rankings',
  '/waivers',
  '/trade-analyzer',
  '/game-slate',
  '/trends',
  '/pricing',
  '/login',
  '/articles',
  '/playoff-predictor',
  '/draft-rankings',
  '/league-analyzer',
  '/research',
  // Individual articles
  '/articles/how-vegas-lines-predict-fantasy-football-points',
  '/articles/fantasy-football-waiver-wire-strategy-guide',
  '/articles/ppr-vs-half-ppr-vs-standard-scoring-explained',
  '/articles/fantasy-football-trade-analyzer-how-to-evaluate-trades',
  '/articles/start-sit-decision-making-framework',
];

/**
 * Start `vite preview` and wait for it to be ready.
 * Returns the child process so we can kill it when done.
 */
function startPreviewServer() {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['vite', 'preview', '--port', String(PORT)], {
      cwd: join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let started = false;
    const timeout = setTimeout(() => {
      if (!started) {
        child.kill();
        reject(new Error('Preview server failed to start within 15s'));
      }
    }, 15_000);

    child.stdout.on('data', (data) => {
      const text = data.toString();
      if (text.includes('Local:') || text.includes(String(PORT))) {
        started = true;
        clearTimeout(timeout);
        // Give the server a moment to fully bind
        setTimeout(() => resolve(child), 500);
      }
    });

    child.stderr.on('data', (data) => {
      // Vite sometimes logs to stderr, not always an error
      const text = data.toString();
      if (text.includes('Error') && !started) {
        clearTimeout(timeout);
        child.kill();
        reject(new Error(`Preview server error: ${text}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Visit a route with Puppeteer, wait for the page to render,
 * and return the full HTML.
 */
async function renderRoute(page, route) {
  const url = `${ORIGIN}${route}`;
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });

  // Wait for React to mount — the #root div should have children
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    },
    { timeout: 10_000 }
  );

  // Small extra wait for any post-render effects (animations, lazy loads)
  await new Promise((r) => setTimeout(r, 500));

  return page.content();
}

/**
 * Clean the rendered HTML for static serving:
 * - Remove inline scripts that would re-hydrate (optional, keeps them for SPA fallback)
 * - Ensure we have the full <html> document
 */
function cleanHtml(html) {
  // Remove Vite's module preload polyfill error handler to avoid console noise
  // but keep the main app script so the page becomes interactive after load
  return html;
}

async function main() {
  console.log('Starting prerender...');

  // 1. Start preview server
  console.log('Starting Vite preview server...');
  let server;
  try {
    server = await startPreviewServer();
  } catch (err) {
    console.error('Failed to start preview server:', err.message);
    console.error('Make sure you ran `vite build` first.');
    process.exit(1);
  }
  console.log(`Preview server running on port ${PORT}`);

  // 2. Launch Puppeteer
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  // Set a realistic viewport for proper responsive rendering
  await page.setViewport({ width: 1280, height: 800 });

  let rendered = 0;
  let failed = 0;

  for (const route of ROUTES) {
    try {
      console.log(`  Rendering ${route} ...`);
      const html = await renderRoute(page, route);
      const cleaned = cleanHtml(html);

      // Write to build directory
      const filePath = route === '/'
        ? join(BUILD_DIR, 'index.html')
        : join(BUILD_DIR, route, 'index.html');

      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, cleaned);
      rendered++;
    } catch (err) {
      console.error(`  FAILED ${route}: ${err.message}`);
      failed++;
    }
  }

  // 3. Cleanup
  await browser.close();
  server.kill();

  console.log(`\nPrerender complete: ${rendered} pages rendered, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main();
