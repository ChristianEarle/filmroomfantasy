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
1. **On PR:** Runs frontend build and backend type-check, plus a dry-run build of the ingest Worker
2. **On push to main:** Builds, then deploys in this order:
   1. D1 migrations
   2. the ingest Worker, `filmroom-ingest` (see [Ingest Worker](#ingest-worker-filmroom-ingest))
   3. the API Worker, `filmroom-api`
   4. Pages

   Deploys run one at a time (the `prod-deploy` concurrency group queues a
   later push behind an earlier one). A failed or stalled ingest deploy (the
   step times out after 5 minutes) does not hold back the API or Pages, but
   the job still ends red. On main the ingest dry run is allowed to fail for
   the same reason; on a PR it fails the backend job.

Required GitHub repository secret:
- `CLOUDFLARE_API_TOKEN` — Create at Cloudflare Dashboard > My Profile > API Tokens with "Edit Cloudflare Workers" template.
  It also needs D1 edit (migrations) and Queues edit (deploying `filmroom-ingest`
  registers its queue consumers); without Queues edit only the ingest step fails.

## Ingest Worker (filmroom-ingest)

`filmroom-ingest` (`server/src/ingest/`, configured by `server/wrangler.ingest.toml`)
runs data syncs as jobs scheduled from a ledger in `filmroom-db`. It serves no
HTTP. A `*/5` cron runs the dispatcher, which leases due jobs and sends them to
the `ingest` queue; the queue consumer runs each job and records the run in
`ingest_runs`.

Each job group (`odds`, `props`, `stats`, …) is written by exactly one
scheduler, named by its row in `ingest_owner`: `legacy` (the filmroom-api
cron) or `ingest`. Every group starts as `legacy`, and the ingest Worker leases
nothing in a `legacy` group, so deploying it changes no data until a group is
cut over.

Ported so far: `odds:lines` (group `odds`), the job behind
`POST /api/admin/sync-odds`. It schedules its next run by the nearest
unstarted kickoff: 12 h when that is more than 48 h away, 4 h within 48 h, 1 h
within 6 h, and 24 h when no game is left. Outside the preseason and regular
season it skips, without calling The Odds API, and checks again in 24 h.

### One-time setup

Create the queues **before the first push to `main` that includes
`wrangler.ingest.toml`**; until they exist the ingest deploy step fails:

```bash
cd server
npx wrangler queues create ingest --message-retention-period-secs 86400
npx wrangler queues create ingest-interactive --message-retention-period-secs 86400
npx wrangler queues create ingest-dlq --message-retention-period-secs 86400
```

A day of retention is plenty: a message not claimed within 30 minutes is stale
anyway (the dispatcher releases its lease and leases the job again), and a run
whose dead letter is lost is still reaped by the dispatcher once its 16-minute
run lease expires.

After the first deploy has created the Worker, give it its own secrets (it
does not see filmroom-api's):

```bash
npx wrangler secret put ODDS_API_KEY -c wrangler.ingest.toml
```

Later phases add `ANTHROPIC_API_KEY`, `SYNC_SECRET`, `RESEND_API_KEY` and
`ALERT_EMAIL` the same way, as they port the jobs that need them. Until a
required secret is set the Worker logs `[ingest] CRITICAL: ODDS_API_KEY not set`
once per isolate, which is harmless while every group is `legacy`.

### What a deploy does

- **Migrations** (`0049_ingest_framework.sql`) create the ledger tables, seed
  every group as `legacy`, and seed the `odds:lines` job as already due.
- **filmroom-ingest** (`npx wrangler deploy -c wrangler.ingest.toml`, from
  `server/`) uploads the Worker, registers its consumers on `ingest`,
  `ingest-interactive` and `ingest-dlq`, and sets its `*/5` cron. While no
  group is owned by `ingest`, each tick only writes the dispatcher heartbeat.
- **filmroom-api** serves `/api/admin/ingest/*` and `/api/status/freshness`,
  and its 4-hour cron checks the `odds` owner before calling `sync-odds`.

### Cutting a group over

1. Check the dispatcher is ticking: `dispatcher.ageSeconds` in
   `GET /api/status/freshness` should be under about 600.
2. Check the Worker has the secrets the group's jobs need:
   `npx wrangler secret list -c wrangler.ingest.toml`.
3. Flip the owner, a few minutes clear of the 4-hour cron (00:00, 04:00, …
   UTC), so a `sync-odds` call the cron already started can't overlap the
   first ingest run:

```bash
curl -X POST https://your-api.workers.dev/api/admin/ingest/owner \
  -H "X-Admin-Key: YOUR_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"group": "odds", "owner": "ingest"}'
```

Both schedulers read the owner at run time. The filmroom-api cron skips
`sync-odds` from its next run (logging `sync-odds skipped: the odds group is
owned by the ingest Worker`), and the dispatcher leases `odds:lines` on its
next tick, within 5 minutes. To run a job ahead of its schedule:

```bash
curl -X POST https://your-api.workers.dev/api/admin/ingest/jobs/odds:lines/due \
  -H "X-Admin-Key: YOUR_SYNC_SECRET"
```

### Verifying

```bash
# Runs, newest first: status (ok | partial | skipped | failed | killed |
# superseded), D1 calls, Odds API credits, and the sync's counts in `detail`
curl "https://your-api.workers.dev/api/admin/ingest/runs?job=odds:lines" \
  -H "X-Admin-Key: YOUR_SYNC_SECRET"

# Every job: next run, attempts, quarantine, leases, and its group's owner
curl https://your-api.workers.dev/api/admin/ingest/jobs \
  -H "X-Admin-Key: YOUR_SYNC_SECRET"

# Public: age of each job's last success and of the dispatcher's last tick
curl https://your-api.workers.dev/api/status/freshness
```

Logs: `npx wrangler tail filmroom-ingest`, or Workers Logs in the dashboard.

A failed run backs off (2 minutes, doubling, capped at 6 h); after 5
consecutive failures the job is quarantined for 6 h. Once the cause is fixed:

```bash
curl -X POST https://your-api.workers.dev/api/admin/ingest/jobs/odds:lines/unquarantine \
  -H "X-Admin-Key: YOUR_SYNC_SECRET"
```

### Rollback

Flip the group back. No redeploy is needed:

```bash
curl -X POST https://your-api.workers.dev/api/admin/ingest/owner \
  -H "X-Admin-Key: YOUR_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"group": "odds", "owner": "legacy"}'
```

The dispatcher stops leasing the group's jobs at once, and the filmroom-api
cron calls `sync-odds` again from its next 4-hour run. A run already in
progress finishes. A message the dispatcher had queued but no consumer had
claimed is dropped when it arrives, because the claim checks the owner too.
The group has settled when `GET /api/admin/ingest/jobs` shows `currentRunId`
as null for each of its jobs.

Rolling back filmroom-api itself (`wrangler rollback`, or redeploying a
commit from before the ingest framework) needs one more step. Those versions
call `sync-odds` from the cron without checking the owner, so flip every
group owned by `ingest` back to `legacy` first, or roll back only to a
version that has the check.

### Kill detection (verify before later phases rely on it)

The consumers run with `max_retries = 0`, so a message whose invocation is
killed (CPU or memory limit, crash) goes straight to `ingest-dlq`, and the
DLQ consumer marks its run `killed` and backs the job off. Before a later
phase depends on this, verify it once in production (only the deployed
filmroom-ingest has the queues):

1. Register a throwaway handler, kind `kill-test` in group `maintenance`,
   whose run allocates past the isolate's memory limit, and deploy it through
   `main`.
2. Add its job. `maintenance` is safe to use because no legacy cron step
   checks its owner, so flipping it changes nothing else:

   ```bash
   cd server
   npx wrangler d1 execute filmroom-db --remote --command "INSERT INTO ingest_jobs (key, kind, group_name, next_run_at, created_at, updated_at) VALUES ('maint:kill-test', 'kill-test', 'maintenance', 0, 0, 0)"
   ```

3. Flip `maintenance` to `ingest` (`POST /api/admin/ingest/owner` with
   `{"group": "maintenance", "owner": "ingest"}`). The dispatcher leases only
   jobs in groups owned by `ingest`, so without this nothing runs.
4. Within one dispatcher tick and a minute or two,
   `GET /api/admin/ingest/runs?job=maint:kill-test` should show the run
   `killed` with error `invocation killed (dead-lettered)`, not only, 16
   minutes later, `run lease expired (killed or timed out)` from the
   dispatcher's reap.
5. As soon as it has, flip `maintenance` back to `legacy` (the job is retried
   and killed again on each backoff until then), delete the job with
   `DELETE FROM ingest_jobs WHERE key = 'maint:kill-test'`, and remove the
   handler.

Phase 1a does not depend on it: for `odds:lines` the reap is enough.

## Environment Configuration

| Variable | Required | Where | Description |
|----------|----------|-------|-------------|
| `JWT_SECRET` | Yes | `wrangler secret` | JWT signing key |
| `SYNC_SECRET` | Yes | `wrangler secret` | Admin endpoint auth key |
| `OPENAI_API_KEY` | No | `wrangler secret` | AI news relevance filtering |
| `GOOGLE_CLIENT_ID` | No | `wrangler secret` | Google OAuth (public, safe in vars) |
| `YAHOO_CLIENT_ID` | No | `wrangler secret` | Yahoo Fantasy integration (see note) |
| `YAHOO_CLIENT_SECRET` | No | `wrangler secret` | Yahoo Fantasy integration (see note) |
| `ODDS_API_KEY` | For odds | `wrangler secret`, on filmroom-api and separately on filmroom-ingest (`-c wrangler.ingest.toml`) | The Odds API: game lines and player props |
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
