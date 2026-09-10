# Changelog

All notable changes to FilmRoom Fantasy Football are documented here.

## [Unreleased] - 2026-09-07

### League matchups & sync
- Leagues now re-sync automatically: new `POST /api/admin/sync-leagues` (Sleeper) runs on the cron every 4h in season and daily otherwise, and an Admin "Sync Leagues" card triggers it on demand (#320)
- Fixed the league sync failing with `too many SQL variables` on any roster deeper than ~16 spots (roster-spot inserts chunked at 50 rows since May) — the reason 2026 leagues never received matchups (#321)
- "My team" is now resolved by the member's Sleeper id (`externalOwnerId`) before falling back to `ownerId`, so opponent teams stored under the syncing user no longer surface as your matchup; the sync no longer assigns every opponent to the syncing user going forward (#320)
- Matchup page gained a week picker (‹ Week N ›, select on mobile) with explicit "not synced yet" / bye states and a "Re-sync now" button; `GET /api/matchups/my/current` accepts `?week=` and returns `availableWeeks` + `currentWeek` (#320)

### Bug sweep of the day's merges
- Production worker was deployed with `ENVIRONMENT="development"` (CI uses the top-level wrangler config): HSTS was never sent, raw error messages leaked on 500s, and the local-only dev bypasses' "not production" guard was inert. Top-level `ENVIRONMENT` is now `production`; local dev sets `development` via `.dev.vars`. Dev bypasses additionally require the request URL hostname to be local (#319)
- Market sync cron passed the in-progress week as `asOfWeek` (remaining games off by one, Tier B reading next week's props); rookie ADP total outage now skips submission like redraft; player cards use the requested scoring format for draft rank/ADP; Elite Ask AI capped at 200/day (#319)
- Ask AI modal resets its conversation when the surrounding context changes (Redraft→Dynasty, Week→Full Season) instead of replaying stale history; Market rankings cached per scoring/season on the Draft Rankings toggle (#318)
- Local dev: `DEV_TIER_OVERRIDE` (#315) and `DEV_AUTO_LOGIN_EMAIL` (#316) in `server/.dev.vars` unlock Pro features and skip the login form on localhost only
- Sidebar bottom-nav key warning (#317)

### Market projections & rankings
- New deterministic "Market" projection layer (`player_market_projections`, `marketRankings.ts`): sportsbook-implied season totals ranked by VORP, built from season-long prop lines where available and blended with weekly-projection extrapolation otherwise; `GET /players` (season mode) and the Full Season board now prefer Market over the AI total when a Market row exists, with a ROS number and confidence badge (`season_props` / `blended` / `weekly_extrapolation`) (#309, #311, #313)
- Manual season-long prop import pipeline: `player_season_props` table, CSV/JSON paste via a new Admin → Import Season Props card, `POST /api/admin/sync-season-props`, `GET /api/admin/season-props/summary` (#305, #307, #308)
- AI draft rankings (redraft/dynasty) now anchor on Market VORP rank instead of ADP alone, with ADP as a fallback before the first market sync; `DraftRankingsView` gained a `FilmRoom AI | Market` source toggle and a "vs Mkt" delta pill on the AI view (#312)
- Market sync now includes injury-designated players (previously dropped questionable/doubtful/probable players from the rankings) and rounds stored point values (#313)

### Ask AI v2
- `/players/ask` and `/draft-rankings/ask` moved from a single fire-and-forget Anthropic call to a bounded tool-calling loop (`lookup_player`, `search_players`, `get_matchup`, `get_my_lineup`) backed by a compact per-player card, so answers pull live data instead of a static top-50 snapshot and priors
- Both endpoints take an optional `leagueId` (validated against league membership) for league-aware answers; player mentions in a question are pre-fetched into context
- Frontend markdown-lite rendering (bold, lists) and a "Looked up: X" attribution line when the model made tool calls (#310)

### Draft rankings pipeline fixes
- FantasyFootballCalculator's public ADP API replaces the FantasyPros scrape, which had gone silently near-empty behind a login wall — every stored redraft row had `adp: null`
- An ADP-coverage canary and explicit `failed` `ranking_batch_jobs` rows surface pipeline problems (sparse ADP, zero eligible players for a variant) that previously failed silently, including a `dynasty_rookie` regeneration outage
- Rookie-pool eligibility now resolved via tenure inference instead of a bare `yearsExp === 0` check, and ended-batch draining is bounded by count and wall-clock budget instead of one batch per hourly tick (#306)

## [Unreleased] - 2026-09-06

### Rankings
- Genuine full-season projected points (`seasonProjectedPoints`, sourced from `draft_rankings`) on Player Rankings' Full Season view, with an honest `Actual`/`Proj` badge and a labeled actual-points fallback before projections exist
- True veteran-inclusive "Dynasty" ranking type, split out from the rookie-only `dynasty_rookie`; Draft Rankings now shows Redraft / Dynasty / Rookie pills, plus 4 additional dynasty batch variants in the weekly ranking cron
- Fixed Player Rankings excluding real top-projected players past row 500 (was sorting a 500-row alphabetical page instead of the full pool); tightened the offseason-fallback calendar window (Feb–Jul, not Feb–Aug)

### League Analyzer
- AI-generated per-team scouting narratives and a league-wide AI "pulse" power ranking, cached per (team/league, season, week)
- `GET /yahoo/status` endpoint and a disabled Yahoo tile in Settings when OAuth isn't configured; league sync now invalidates the AI narrative cache so it regenerates against fresh rosters

### Mobile & Accessibility
- Ask AI chat modal, bottom nav sizing, and landing header overflow fixed at phone widths
- Sidebar mobile drawer: auto-closes on resize past the desktop breakpoint, Escape-to-close, Tab focus trap, `aria-current`/`aria-expanded`/`aria-controls` on nav
- Removed the "Research" nav item and its dead placeholder view; fixed modals rendering off-screen due to a `transform` on the page-transition wrapper, and a Waivers filter row overflowing at 375px

### Infrastructure
- Restored a real Tailwind v4 build (`src/index.css` is source again, `@tailwindcss/vite` wired into `vite.config.mts`) after ~515 utility classes silently no-op'd under the old precompiled bundle
- Added a backend Vitest harness (unit + `@cloudflare/vitest-pool-workers` projects, 45 tests) and a CI test step; updated Wrangler to `^4.124`
- Dropped the orphaned `team_scouting_reports` table (migration `0044`)

## [1.0.0] - 2026-03-05

### Core Features
- Fantasy football league management with Sleeper and Yahoo integration
- Player search, stats, projections, and injury news
- Live NFL game slate with spreads, over/unders, and weather
- Weekly matchup scoring with live stat calculation
- League standings, schedules, and playoff predictor
- Player trends and waiver wire analysis
- Team roster management with lineup setting

### Authentication & Security
- Email/password registration with validation (username 3-30 chars, password 8+ chars)
- JWT-based auth with 24-hour token expiration
- Google OAuth backend support (frontend integration ready for activation)
- Yahoo Fantasy OAuth integration for league importing
- Session-based token revocation with `POST /auth/logout`
- Content Security Policy (CSP) headers
- Security headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, HSTS
- Distributed rate limiting via D1 (10 req/15min on auth endpoints)
- Frontend progressive cooldown on login/register forms (2s/5s/15s after repeated failures)
- Input validation on all auth endpoints with anti-enumeration responses
- Admin endpoint protection via shared secret (`X-Admin-Key` header)
- Route parameter validation with NaN and range checks
- News URL protocol validation (prevents `javascript:` injection)

### Data Pipeline
- Automated Cloudflare Cron Triggers for data sync (daily/4h/6h schedules)
- Player sync from Sleeper API with headshot URLs
- Weekly stats sync with all stat categories and snap counts
- Projection sync for PPR, Half-PPR, and Standard scoring formats
- NFL game sync from ESPN with spreads, O/U, weather, and live scores
- RSS news aggregation from ESPN, CBS, Yahoo, RotoWire, PFF
- AI-powered news relevance filtering via OpenAI (optional)
- Sleeper API rate limit handling with throttled concurrent fetches
- Runtime validation of all Sleeper API responses

### Frontend
- Dark mode and light mode support
- Responsive design with mobile sidebar (hamburger menu with overlay)
- Player card with detailed stats, game log, and projections
- Interactive playoff predictor with Monte Carlo simulation
- Settings page with Yahoo Fantasy OAuth connection
- Profile management with preference controls
- Feedback submission form
- 404 page with navigation
- PWA support with service worker and web manifest

### Infrastructure
- Cloudflare Workers (Hono) backend with D1 (SQLite) database
- Drizzle ORM with 14 migrations
- React 18 + Vite 6 + TypeScript frontend
- Database indexes on all foreign keys (21 indexes)
- Request ID logging middleware
- OpenAPI 3.1 documentation
- GitHub Actions CI/CD pipeline
- Production secrets management via `wrangler secret put`

### Assets
- Custom SVG favicon with FilmRoom branding
- Apple touch icon (180x180)
- Open Graph image (1200x630)
- robots.txt and sitemap.xml
- MIT license
