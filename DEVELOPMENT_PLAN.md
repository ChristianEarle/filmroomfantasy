# Fantasy Football Web App - 2-Week Development Plan

## Current State Summary
- **Frontend**: Fully built React/TypeScript UI with 25+ components, Tailwind/Radix UI
- **Backend**: Cloudflare Workers + Hono (set up)
- **Database**: Cloudflare D1 with Drizzle ORM (schema complete)
- **Authentication**: JWT-based auth (routes complete)

---

## Technology Stack

### Backend
- **Runtime**: Cloudflare Workers (edge computing)
- **Framework**: Hono (lightweight, fast, perfect for Workers)
- **Database**: Cloudflare D1 (SQLite at the edge)
- **ORM**: Drizzle ORM (type-safe, excellent D1 support)
- **Authentication**: JWT with jose library
- **Password Hashing**: bcryptjs

### Why Cloudflare?
- **Global edge deployment** - Low latency worldwide
- **D1 database** - SQLite at the edge, free tier generous
- **Integrated ecosystem** - Workers, D1, R2 (storage), KV all work together
- **Cost effective** - Generous free tier, pay-per-use pricing
- **Simple deployment** - `wrangler deploy` and you're live

---

## Database Schema (Complete ✅)

Located in `server/src/db/schema.ts`:

### Core Tables
- **users** - User accounts and authentication
- **sessions** - JWT session management
- **leagues** - Fantasy leagues configuration
- **leagueMembers** - User-league relationships
- **teams** - Fantasy teams within leagues
- **rosterSpots** - Player assignments to teams

### NFL Data Tables
- **nflPlayers** - All NFL players
- **playerWeeklyStats** - Weekly performance stats
- **playerProjections** - Weekly projections
- **playerNews** - Player news/updates
- **nflGames** - NFL game schedule and scores

### Transaction Tables
- **matchups** - Fantasy matchups
- **transactions** - Waiver/add/drop transactions
- **trades** - Trade proposals
- **tradeItems** - Individual items in trades

---

## API Routes (Complete ✅)

### Authentication (`/api/auth`)
```
POST   /register          - Create new user
POST   /login             - Login, return JWT
GET    /me                - Get current user + leagues
PUT    /profile           - Update profile
POST   /change-password   - Change password
POST   /forgot-password   - Request password reset
```

### Leagues (`/api/leagues`)
```
GET    /                  - User's leagues
POST   /                  - Create league
GET    /:id               - League details
PUT    /:id               - Update league (commissioner)
POST   /:id/join          - Join league
GET    /:id/standings     - League standings
```

### Teams (`/api/teams`)
```
GET    /:id               - Team details
PUT    /:id               - Update team name
GET    /:id/roster        - Team roster
PUT    /:id/roster        - Set lineup
POST   /:id/roster/add    - Add player
DELETE /:id/roster/:pid   - Drop player
```

### Players (`/api/players`)
```
GET    /                  - All players (paginated)
GET    /search            - Quick search
GET    /trending          - Trending players
GET    /:id               - Player details
GET    /:id/stats         - Player weekly stats
GET    /:id/projections   - Player projections
GET    /:id/news          - Player news
GET    /available/:lid    - Available players in league
```

### Matchups (`/api/matchups`)
```
GET    /:id               - Matchup details
GET    /:id/live          - Live scoring
GET    /league/:id/week/:w - Week's matchups
GET    /my/current        - User's current matchup
```

### Games (`/api/games`)
```
GET    /week/:week        - Games for a week
GET    /:id               - Game details
GET    /:id/props         - Player props for game
GET    /live/scores       - Live NFL scores
GET    /upcoming          - Upcoming games
GET    /team/:team        - Team schedule
```

### Waivers (`/api/waivers`)
```
GET    /league/:id        - Pending claims
POST   /league/:id/claim  - Submit waiver claim
DELETE /:claimId          - Cancel claim
PUT    /league/:id/reorder - Reorder priorities
GET    /league/:id/history - Transaction history
```

---

## Week 1: Backend Foundation (Days 1-7)

### Day 1-2: Project Setup ✅ COMPLETE
- [x] Initialize Cloudflare Workers project
- [x] Set up Hono framework
- [x] Configure Drizzle ORM with D1
- [x] Create complete database schema
- [x] Set up all API routes

### Day 3: Database Setup & Migrations
- [ ] Create D1 database: `wrangler d1 create filmroom-db`
- [ ] Generate migrations: `npm run db:generate`
- [ ] Apply migrations: `npm run db:migrate`
- [ ] Create seed data script with:
  - 150+ NFL players (all teams, positions)
  - Sample league with 12 teams
  - Sample matchups and stats

### Day 4: Frontend API Integration
- [ ] Install frontend dependencies: `axios`, `@tanstack/react-query`
- [ ] Create API service layer (`src/services/api.ts`)
- [ ] Create auth context and hooks
- [ ] Connect login/register pages to backend
- [ ] Add token storage and refresh logic

### Day 5-6: Connect Core Features
- [ ] Connect player board to real data
- [ ] Connect team roster management
- [ ] Connect matchup view
- [ ] Connect waiver wire

### Day 7: Testing & Polish
- [ ] Test all API endpoints
- [ ] Handle loading states
- [ ] Handle error states
- [ ] Fix any bugs

---

## Week 2: Advanced Features (Days 8-14)

### Day 8-9: Live Scoring & Real-time
- [ ] Implement polling for live scores
- [ ] Update matchup scores in real-time
- [ ] Add game slate live updates

### Day 10-11: Trades & Transactions
- [ ] Implement trade proposal system
- [ ] Add trade acceptance/rejection
- [ ] Transaction history display

### Day 12: Playoff Predictor
- [ ] Implement Monte Carlo simulation
- [ ] Calculate playoff probabilities
- [ ] Connect to Playoff Predictor view

### Day 13: External Data Integration
- [ ] Research NFL data APIs (ESPN, Sleeper)
- [ ] Create data sync jobs
- [ ] Import real player data

### Day 14: Deployment & Polish
- [ ] Deploy backend to Cloudflare Workers
- [ ] Deploy frontend to Cloudflare Pages
- [ ] Configure production environment
- [ ] Final testing and bug fixes

---

## Folder Structure

```
Fantasy Football Web App/
├── src/                          # Frontend (React)
│   ├── components/               # UI components
│   ├── services/                 # API service layer (NEW)
│   │   ├── api.ts               # Base API client
│   │   ├── auth.ts              # Auth services
│   │   ├── leagues.ts           # League services
│   │   └── players.ts           # Player services
│   ├── hooks/                    # React hooks (NEW)
│   │   ├── useAuth.ts
│   │   ├── useLeague.ts
│   │   └── usePlayers.ts
│   ├── context/                  # React contexts (NEW)
│   │   └── AuthContext.tsx
│   └── types/                    # TypeScript types
│
├── server/                       # Backend (Cloudflare Workers)
│   ├── src/
│   │   ├── db/
│   │   │   └── schema.ts        # Drizzle schema
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── leagues.ts
│   │   │   ├── teams.ts
│   │   │   ├── players.ts
│   │   │   ├── matchups.ts
│   │   │   ├── games.ts
│   │   │   └── waivers.ts
│   │   ├── middleware/
│   │   │   └── auth.ts
│   │   ├── services/
│   │   │   └── scoring.ts
│   │   └── index.ts             # Main entry point
│   ├── migrations/               # D1 migrations
│   ├── wrangler.toml            # Cloudflare config
│   ├── drizzle.config.ts
│   ├── package.json
│   └── tsconfig.json
│
├── package.json
└── DEVELOPMENT_PLAN.md
```

---

## Getting Started Commands

```bash
# Backend setup
cd server
npm install

# Create D1 database (first time only)
wrangler d1 create filmroom-db
# Copy the database_id to wrangler.toml

# Generate migrations
npm run db:generate

# Apply migrations locally
npm run db:migrate

# Seed database
npm run db:seed

# Start dev server
npm run dev

# Deploy to production
wrangler secret put JWT_SECRET  # Set JWT secret
npm run deploy
```

```bash
# Frontend additions
cd ..
npm install axios @tanstack/react-query
```

---

## Environment Variables

### Development (wrangler.toml)
```toml
[vars]
ENVIRONMENT = "development"
```

### Production (Cloudflare Dashboard or CLI)
```bash
wrangler secret put JWT_SECRET
# Enter a secure random string
```

---

## Success Criteria (End of Week 2)

### Must Have ✅
- [ ] User can register and login
- [ ] User can view their leagues and teams
- [ ] User can set their lineup
- [ ] User can view matchups with scores
- [ ] User can browse and filter players
- [ ] User can make waiver claims
- [ ] All data persists in D1 database

### Should Have
- [ ] Live score updates during games
- [ ] Trade proposal system
- [ ] Playoff probability calculations
- [ ] Player news feed

### Nice to Have
- [ ] External league import (Sleeper API)
- [ ] Push notifications
- [ ] Mobile-responsive polish

---

## Next Steps

1. ✅ Review this plan
2. ⏳ Set up D1 database and run migrations
3. ⏳ Create seed data
4. ⏳ Connect frontend to backend
