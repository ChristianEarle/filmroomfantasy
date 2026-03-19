# Yahoo Fantasy Football Integration Plan

## Overview
Add real Yahoo Fantasy Football league integration using Yahoo's OAuth 2.0 API. Users will be able to connect their Yahoo leagues, sync rosters, matchups, stats, and projections — matching the existing Sleeper integration.

## OAuth Flow (Popup-based)
1. User clicks "Yahoo" in Connect League modal → Frontend calls `POST /api/yahoo/auth-url`
2. Backend generates a Yahoo OAuth authorization URL with a JWT-based state parameter (stateless, no KV needed)
3. Frontend opens the URL in a popup window
4. User authorizes on Yahoo → Yahoo redirects popup to `GET /api/yahoo/callback?code=...&state=...`
5. Backend verifies state JWT, exchanges code for access/refresh tokens, stores tokens on user in DB
6. Backend returns a small HTML page that posts a message to the opener window and closes the popup
7. Frontend receives the message, then calls `GET /api/yahoo/leagues` to fetch the user's Yahoo Fantasy leagues
8. User selects a league → existing `/api/leagues/connect` flow with `platform: 'yahoo'`

## Files to Create/Modify

### 1. Database Migration: `server/migrations/0013_add_yahoo_oauth_tokens.sql`
- Add `yahoo_access_token`, `yahoo_refresh_token`, `yahoo_token_expires_at` columns to `users` table
- Update `server/migrations/meta/_journal.json`

### 2. Schema Update: `server/src/db/schema.ts`
- Add `yahooAccessToken`, `yahooRefreshToken`, `yahooTokenExpiresAt` fields to `users` table

### 3. New Backend Route: `server/src/routes/yahoo.ts`
- `POST /api/yahoo/auth-url` — Returns Yahoo OAuth authorization URL (requires auth)
- `GET /api/yahoo/callback` — Handles OAuth redirect from Yahoo, exchanges code for tokens, stores on user, returns HTML that closes popup
- `GET /api/yahoo/leagues` — Fetches user's Yahoo Fantasy NFL leagues using stored tokens (requires auth)
- Token refresh helper — Auto-refreshes expired Yahoo tokens using refresh_token

### 4. Mount Routes: `server/src/index.ts`
- Import and mount `yahooRoutes` at `/api/yahoo`
- Add `YAHOO_CLIENT_ID` and `YAHOO_CLIENT_SECRET` to `Env` type

### 5. Yahoo Sync: `server/src/routes/leagues.ts`
- Add `else if (league.platform === 'yahoo')` block in the sync endpoint
- Fetch rosters, teams, matchups, stats from Yahoo Fantasy API
- Map Yahoo player IDs to our `nfl_players` table (via name+team matching since Yahoo uses different player IDs)

### 6. Frontend Service: `src/services/leagueConnect.ts`
- Add `'yahoo'` back to `Platform` type
- Add `yahooApi` object with `getAuthUrl()`, `getLeagues()` methods that call our backend

### 7. Frontend Exports: `src/services/index.ts`
- Re-export `yahooApi` from leagueConnect

### 8. Frontend UI: `src/components/SettingsView.tsx`
- Add Yahoo platform back to `platforms` array
- Add `'yahoo-connecting'` and `'yahoo-leagues'` connection steps
- Handle popup-based OAuth flow with `window.open()` + `message` event listener
- Show Yahoo leagues for selection after successful auth

### 9. Environment: `server/wrangler.toml`
- Add comments for `YAHOO_CLIENT_ID` and `YAHOO_CLIENT_SECRET` secrets

## Yahoo Fantasy API Endpoints Used
- Auth: `https://api.login.yahoo.com/oauth2/request_auth` + `https://api.login.yahoo.com/oauth2/get_token`
- User leagues: `GET /users;use_login=1/games;game_keys=nfl/leagues?format=json`
- League settings: `GET /league/{league_key}/settings?format=json`
- Teams: `GET /league/{league_key}/teams?format=json`
- Rosters: `GET /team/{team_key}/roster?format=json`
- Scoreboard: `GET /league/{league_key}/scoreboard?format=json`
- Base URL: `https://fantasysports.yahooapis.com/fantasy/v2`
