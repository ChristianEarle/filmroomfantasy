# Changelog

All notable changes to FilmRoom Fantasy Football are documented here.

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
