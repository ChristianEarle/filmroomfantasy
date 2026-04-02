#!/usr/bin/env node
/**
 * Generates og-image.png with the actual logo and landing-page-style branding.
 * Run: node scripts/generate-og-image.js
 */
const sharp = require('sharp');
const path = require('path');

const WIDTH = 1200;
const HEIGHT = 630;
const BG = '#0a0a0a';
const ACCENT = '#3b82f6';
const WHITE = '#ffffff';
const MUTED = '#737373';

async function generate() {
  const logoPath = path.join(__dirname, '..', 'public', 'logo.png');
  const outPath = path.join(__dirname, '..', 'public', 'og-image.png');

  // Resize logo to fit nicely (about 180px tall)
  const logo = await sharp(logoPath)
    .resize({ height: 180, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const logoMeta = await sharp(logo).metadata();
  const logoW = logoMeta.width;
  const logoH = logoMeta.height;

  // Center logo horizontally, place it in upper-center area
  const logoX = Math.round((WIDTH - logoW) / 2);
  const logoY = 120;

  // Text positioning below logo
  const textY = logoY + logoH + 32;
  const subY = textY + 52;

  const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@600;800');
    .title { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 800; font-size: 48px; letter-spacing: -1px; }
    .subtitle { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 600; font-size: 20px; }
  </style>
  <text x="${WIDTH / 2}" y="${textY}" text-anchor="middle" class="title">
    <tspan fill="${WHITE}">Film</tspan><tspan fill="${ACCENT}">Room</tspan>
  </text>
  <text x="${WIDTH / 2}" y="${subY}" text-anchor="middle" class="subtitle" fill="${MUTED}">
    Fantasy Football Analysis &amp; Management
  </text>
</svg>`;

  await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: BG,
    },
  })
    .composite([
      { input: logo, left: logoX, top: logoY },
      { input: Buffer.from(svg), left: 0, top: 0 },
    ])
    .png()
    .toFile(outPath);

  console.log(`Generated ${outPath} (${WIDTH}x${HEIGHT})`);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
