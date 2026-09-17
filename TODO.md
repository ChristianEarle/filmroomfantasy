# FilmRoom Fantasy — TODO

What's left to finish, re-verified against the codebase. Completed work and
historical context live in `BACKLOG.md`; the 2026-07 completion sprint is
documented in `docs/COMPLETION_PLAN.md` and PR #243.

Snapshot: 2026-07-16 (post completion sprint), updated 2026-09-07 for the
Market/Ask AI v2 wave.

---

## Shipped by the 2026-07 completion sprint (PR #243)

- Draft Rankings data infra: superflex variants + toggle, `rank_history` +
  daily snapshots, TREND sparklines, 1d/7d/30d movement, AI ceiling/floor
- Player Rankings board: real weekly-score sparklines, Full Season toggle,
  breadcrumb, Ask AI (`POST /players/ask`)
- Matchup page: FilmRoom Edge Analysis rebuilt on real data
- PlayerCard: projected stat breakdown, Watch/Share quick actions,
  FilmRoom AI Take (also on the player profile page)
- League Analyzer: real page (grades, surplus/deficit, ROS schedule,
  Monte Carlo odds, narratives)
- Notifications MVP: injury-news fan-out + real Header bell
- Trade Analyzer: Sleeper draft-pick inventory with click-to-add chips
- AI platform: Anthropic prompt caching, per-player analysis cache,
  shared `requireTier` middleware
- SEO: per-player static pages + generated sitemap
- Audits with fixes on all previously unaudited components (~90 issues),
  `useOdds`/`useGames` bug fixes, 14 baseline type errors cleared
- UI cohesion steps 2–4 (de-shadow, PlayerList palette, gradients)
- Mobile pass: bottom nav, touch targets, modal sizing
- CI now gates PRs on frontend type-check + tests

Deploy notes: migrations `0037`–`0041` auto-apply on merge; superflex +
ceiling/floor data appears after the next Monday ranking batch; rank
history accrues from the first daily cron.

## Shipped since the completion sprint

- PlayerCard Compare quick action: a client-only (localStorage) compare
  basket (`useCompareBasket`, up to 4 players) with a "Compare" toggle
  next to Watch/Share and a `PlayerCompareModal` showing season PPG /
  games / season total side by side. Independent from the Draft Rankings
  page's own compare feature (that one compares rank/tier/ADP within a
  single ranking variant; this compares season stats for any player from
  any context).

---

## Shipped since the completion sprint

- **Season projections + true Dynasty ranking type (#301)** — `GET /players`
  season mode returns genuine full-season `seasonProjectedPoints` sourced
  from `draft_rankings`; a veteran-inclusive `dynasty` ranking type ships
  alongside `redraft` and the existing rookie-only `dynasty_rookie`. That
  `ranking_type` value is unchanged in the database — the Draft Rankings UI
  just labels the rookie-only pill "Rookie". Migration `0045` is unrelated
  (it adds `player_season_props`, not a rename of any ranking type).
- **Market projection + VORP ranking layer (#309, #311, #313)** — a
  deterministic, sportsbook-implied season projection
  (`player_market_projections`) ranked by VORP, blending season-long prop
  lines with weekly-projection extrapolation once season lines run out; the
  Full Season board prefers Market over the AI total when a Market row
  exists, with a ROS number and confidence badge.
- **AI draft rankings anchored to Market (#312)** — redraft/dynasty AI
  prompts anchor on Market VORP rank (falling back to ADP-only wording
  before the first market sync); `DraftRankingsView` gained a
  `FilmRoom AI | Market` source toggle and a "vs Mkt" delta pill on the AI
  view.
- **Ask AI v2 (#310)** — `/players/ask` and `/draft-rankings/ask` moved
  from a single fire-and-forget call to a bounded tool-calling loop
  (`lookup_player`, `search_players`, `get_matchup`, `get_my_lineup`)
  instead of answering off a static top-50 snapshot; league-aware via an
  optional `leagueId`, lightweight markdown-lite answers, and a
  "Looked up: X" attribution line when tools were used.
- **Draft-rankings pipeline fixes (#306)** — FantasyFootballCalculator's
  public ADP endpoint replaces the dead, login-walled FantasyPros scrape;
  an ADP-coverage canary and `failed` `ranking_batch_jobs` rows surface
  silent regeneration failures instead of swallowing them; the rookie pool
  is now resolved via tenure inference instead of a bare `yearsExp === 0`
  check.

---

## P0 — Owner action required (not code)

- [ ] **Google OAuth client ID** — create in Google Cloud Console, set
  `GOOGLE_CLIENT_ID` (server `.dev.vars` + `wrangler secret put`) and
  `VITE_GOOGLE_CLIENT_ID` (`.env`), configure authorized origins. Code is
  fully wired; only the credential is missing.
- [ ] **Live Pro/Elite verification** — one authed round-trip each for
  `/draft-rankings/ask`, `/players/ask`, and `/players/:id/analysis` in
  prod (tests mock Anthropic). Still needs a Pro login to exercise the
  gated paths for real.
- [x] **Sign off on dropping `team_scouting_reports`** — dropped in
  migration `0044_drop_team_scouting_reports.sql` (2026-09-06).

## P1 — Remaining feature gaps

- [ ] **Push notifications** — in-app notifications shipped; web push /
  email delivery (and waiver/trade/lineup-lock event types) remain.
- [x] **Season projections** — `GET /players` in season mode now returns
  genuine full-season `seasonProjectedPoints` from `draft_rankings`
  (redraft, matching scoring format), with `seasonActualPoints` as a
  labeled fallback (#301).
- [ ] **PlayerCard Alert/Pin actions** — Compare shipped as a follow-up
  (see "Shipped since the completion sprint" above); Alert needs
  notification delivery (see push/email item below) and Pin needs its
  own persistence layer.
- [x] **Redraft / Dynasty / Rookie three-way split** — true veteran-inclusive
  `dynasty` ranking type added alongside `redraft` and the existing
  rookie-only `dynasty_rookie`; Draft Rankings now has Redraft/Dynasty/
  Rookie pills (#301).
- [x] **Research page decision** — removed from nav for launch; dead
  `ComingSoonView`/`ResearchView` deleted, old `/research` links redirect
  home (#303).

## P2 — Data feeds (see roadmap in docs/COMPLETION_PLAN.md)

- [ ] Practice reports / injury designations (nflverse or ESPN, free)
- [ ] Usage data: snap %, target share, red-zone touches (nflverse, free)
- [ ] Depth charts (Sleeper fields already synced upstream — store/expose)
- [ ] Weather for outdoor games (Open-Meteo/NWS, free)
- [x] **Redraft ADP** — via FantasyFootballCalculator's public JSON API
  (not Sleeper/Underdog as originally scoped), feeding both the AI
  draft-rankings prompts and `adpDelta` (#306).
- [ ] Feed projection-accuracy history back into AI prompts
- [ ] **Season-prop capture automation** — no API source for sportsbook
  season-long O/U lines; current path is a manual CSV/JSON paste via
  Admin → Import Season Props (`POST /api/admin/sync-season-props`, #305).
  Capture before Week 1 each year, before books pull the lines.

## P3 — Blocked on external data sources / platform sync

- [ ] **Odds Movement tab on Trends** — partially addressed: season-long
  O/U lines now land in `player_season_props` and every capture is kept
  (no overwrite-in-place), so a season-line history exists from the
  2026-09-06 import onward. Weekly prop-line movement history (the
  original ask) is still unaddressed — needs a paid odds API or scraping
  plus a `player_prop_lines`-style snapshot cron.
- [ ] **ECR + Best Ball ADP columns** — FantasyPros API key (paid) /
  Underdog ADP; `player_external_ranks` table.
- [ ] **MFL draft-pick parity** (`?TYPE=futureDraftPicks`) — verify
  against a real MFL league first. ESPN/Yahoo pick sync blocked on those
  platforms having league sync at all.

## P3 — Nice-to-haves / follow-ups

- [ ] **Global AI chat assistant** — persistent bubble reusing
  `AiChatModal` against a league-context endpoint; still not built, but
  Ask AI v2 (#310) shipped per-surface (board, draft rankings) with a real
  tool-calling loop (lookup_player/search_players/get_matchup/
  get_my_lineup) and league awareness via `leagueId`, which covers most of
  the value a global assistant would add.
- [ ] **AI post-game recaps** — cron on `gameStatus === 'final'`,
  cache per game; surface on GameDetailModal + matchup recap.
- [ ] **ROS rankings** — partially done: Market projections already carry
  a `rosProjectedPoints` number per player (#309), and `GET /market-rankings`
  exposes it. What's still missing is a dedicated ROS *ranking type* (sorted
  by remaining-season value rather than full-season value).
- [ ] **Expanded player row on the board** (inline stat breakdown) — the
  modal + AI take cover this; inline expand is a UX preference.
- [ ] **De-shadow vendored `src/components/ui/*` primitives** — left
  untouched by the cohesion sweep (unbounded blast radius).
- [x] **Server-side test harness** — Vitest harness added (`unit` +
  `@cloudflare/vitest-pool-workers` projects), 45 tests, wired into CI (#302).
- [ ] **Newsletter email capture**, **ad integration** (monetization
  experiments).

## P6 — Premium roadmap (unchanged)

Stripe/billing/gating infrastructure is DONE. Remaining premium features
as previously scoped: Start/Sit Optimizer, Waiver Wire Rankings, Advanced
Projections, Custom Alerts, Snap Count Analytics (Pro); Multi-League
Dashboard, DFS Optimizer, Live Draft Assistant, Opponent Scouting, Dynasty
Age Curves, Historical Splits (Elite); Draft Kit / Playoff Bundle /
Commissioner Toolkit (one-time).

---

## Notes

- Source of truth for new ideas + completed history remains `BACKLOG.md`.
- When something here ships, check it off here AND mirror to `BACKLOG.md`.
