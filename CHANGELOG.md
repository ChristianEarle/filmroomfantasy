# Changelog

All notable changes to FilmRoom Fantasy Football are documented here.

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
