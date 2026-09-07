# FilmRoom Fantasy Football — Deployment Guide

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) v4+
- Cloudflare account with Workers and D1 access

## Local Development

### 1. Install dependencies

```bash
# Frontend
npm install

# Backend
cd server && npm install
```

### 2. Set up local environment

Create `server/.dev.vars` with your secrets:

```
JWT_SECRET=dev-secret-key-change-in-production
SYNC_SECRET=dev-sync-key
OPENAI_API_KEY=sk-...     # Optional: for AI news filtering
GOOGLE_CLIENT_ID=...       # Optional: for Google OAuth
YAHOO_CLIENT_ID=...        # Optional: for Yahoo integration
YAHOO_CLIENT_SECRET=...    # Optional: for Yahoo integration
```

### 3. Initialize the database

```bash
cd server
npm run db:migrate        # Apply all migrations
npm run db:seed           # Load sample data (optional)
```

### 4. Start development servers

```bash
# Terminal 1: Backend (port 8787)
cd server && npm run dev

# Terminal 2: Frontend (port 5173)
npm run dev
```

Visit `http://localhost:5173`

## Production Deployment

### 1. Set production secrets

Run each command and paste the secret value when prompted:

```bash
cd server

wrangler secret put JWT_SECRET --env production
# Use: openssl rand -hex 32

wrangler secret put SYNC_SECRET --env production
# Use: openssl rand -hex 32

wrangler secret put OPENAI_API_KEY --env production
# From: https://platform.openai.com/api-keys

wrangler secret put GOOGLE_CLIENT_ID --env production
# From: https://console.cloud.google.com/apis/credentials

wrangler secret put YAHOO_CLIENT_ID --env production
wrangler secret put YAHOO_CLIENT_SECRET --env production
# From: https://developer.yahoo.com/apps/
```

### 2. Apply database migrations

```bash
cd server
npm run db:migrate:prod
```

### 3. Deploy the Worker

```bash
cd server
npm run deploy:prod
```

### 4. Build & deploy frontend

The frontend is a static Vite build. Deploy to Cloudflare Pages or any static host:

```bash
npm run build
# Output is in ./build/
```

For Cloudflare Pages, connect your GitHub repo and set:
- **Build command:** `npm run build`
- **Build output directory:** `build`
- **Root directory:** `/` (project root)

### 5. Seed production data

After deploying, sync real NFL data instead of seed data:

```bash
# Sync players from Sleeper (run once, then cron handles it)
curl -X POST https://your-api.workers.dev/api/admin/sync-players \
  -H "X-Admin-Key: YOUR_SYNC_SECRET"

# Sync games from ESPN
curl -X POST https://your-api.workers.dev/api/admin/sync-games \
  -H "X-Admin-Key: YOUR_SYNC_SECRET"

# Sync stats
curl -X POST https://your-api.workers.dev/api/admin/sync-stats \
  -H "X-Admin-Key: YOUR_SYNC_SECRET"

# Sync projections
curl -X POST https://your-api.workers.dev/api/admin/sync-projections \
  -H "X-Admin-Key: YOUR_SYNC_SECRET"

# Sync news
curl -X POST https://your-api.workers.dev/api/admin/sync-news \
  -H "X-Admin-Key: YOUR_SYNC_SECRET"

# Sync deterministic Market (VORP) projections — runs on the projections cron,
# but can be triggered manually too
curl -X POST https://your-api.workers.dev/api/admin/sync-market-projections \
  -H "X-Admin-Key: YOUR_SYNC_SECRET"

# Import season-long sportsbook prop lines (season totals) — no automated
# source exists, so this is a manual paste of CSV/JSON exported from a
# sportsbook (also available as an "Import Season Props" card in AdminView)
curl -X POST https://your-api.workers.dev/api/admin/sync-season-props \
  -H "X-Admin-Key: YOUR_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"season": 2026, "input": "playerName,team,position,market,line,overOdds,underOdds,book,sourceUrl,capturedAt\n..."}'

# Check season-prop import coverage (counts by position/book, top 10 by PPR total)
curl https://your-api.workers.dev/api/admin/season-props/summary?season=2026 \
  -H "X-Admin-Key: YOUR_SYNC_SECRET"
```

After initial sync, Cloudflare Cron Triggers handle automated updates:
- Daily 6 AM UTC: players, news, games
- Every 4 hours: stats, projections, market projections (runs right after
  the projections sync)
- Every 6 hours: RSS news

The AI draft-rankings prompts (redraft/dynasty) depend on
FantasyFootballCalculator's public ADP endpoint (`api.fantasyfootballcalculator.com`)
as a fallback/secondary signal (Market VORP rank is now the primary anchor
once a market sync has run) — no API key required, but there's no fallback
if FFC goes down or changes shape; an ADP-coverage canary fails loudly (a
`failed` `ranking_batch_jobs` row) rather than proceeding on sparse data.
Season-long prop lines have no automated source at all — re-run
`sync-season-props` with a fresh export before each new season (ideally
before Week 1, before books pull the lines) since coverage decays as the
season progresses and books stop offering season totals.

## CI/CD (GitHub Actions)

The `.github/workflows/ci.yml` pipeline:
1. **On PR:** Runs frontend build and backend type-check
2. **On push to main:** Builds, applies migrations, and deploys to Cloudflare

Required GitHub repository secret:
- `CLOUDFLARE_API_TOKEN` — Create at Cloudflare Dashboard > My Profile > API Tokens with "Edit Cloudflare Workers" template

## Environment Configuration

| Variable | Required | Where | Description |
|----------|----------|-------|-------------|
| `JWT_SECRET` | Yes | `wrangler secret` | JWT signing key |
| `SYNC_SECRET` | Yes | `wrangler secret` | Admin endpoint auth key |
| `OPENAI_API_KEY` | No | `wrangler secret` | AI news relevance filtering |
| `GOOGLE_CLIENT_ID` | No | `wrangler secret` | Google OAuth (public, safe in vars) |
| `YAHOO_CLIENT_ID` | No | `wrangler secret` | Yahoo Fantasy integration (see note) |
| `YAHOO_CLIENT_SECRET` | No | `wrangler secret` | Yahoo Fantasy integration (see note) |
| `ENVIRONMENT` | Yes | `wrangler.toml [vars]` | `development` or `production` |
| `CLOUDFLARE_API_TOKEN` | Yes | GitHub Secrets | For CI/CD deployment |

> **Note on Yahoo:** the two `YAHOO_*` secrets are optional only in the sense
> that the worker boots without them. The **Yahoo tile is always shown in the
> Connect League modal**, so on a deploy that lacks them every user who clicks
> Yahoo gets `503 Yahoo OAuth is not configured` from
> `POST /api/yahoo/auth-url`. Set both secrets, or expect that error:
>
> ```bash
> wrangler secret put YAHOO_CLIENT_ID --env production
> wrangler secret put YAHOO_CLIENT_SECRET --env production
> ```
>
> Also set `YAHOO_REDIRECT_URI` if the worker answers on more than one
> hostname — Yahoo only whitelists the single callback URL registered on the
> app at https://developer.yahoo.com/apps/, and the token exchange fails if
> the callback sent at authorize time differs from the one sent at exchange time.
