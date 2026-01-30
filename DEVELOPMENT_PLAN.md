# Fantasy Football Web App - 2-Week Development Plan

## Current State Summary
- **Frontend**: Fully built React/TypeScript UI with 9 views, 40+ components, Tailwind/Radix UI
- **Backend**: None (mock data only)
- **Database**: None
- **Authentication**: None
- **External APIs**: None integrated

---

## Technology Decisions

### Backend Stack
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (consistency with frontend)
- **Database**: PostgreSQL (robust relational DB for league/team/player data)
- **ORM**: Prisma (type-safe, excellent TypeScript support)
- **Authentication**: JWT + bcrypt (simple, stateless auth)
- **Real-time**: Socket.io (for live updates)

### Why These Choices?
- PostgreSQL handles complex relationships (leagues → teams → players → matchups)
- Prisma generates TypeScript types automatically
- JWT works well for API authentication without session storage
- Socket.io provides real-time score updates during games

---

## Week 1: Backend Foundation & Core Features

### Day 1-2: Project Setup & Database Schema

#### Tasks
- [ ] Initialize Express.js backend with TypeScript
- [ ] Set up Prisma with PostgreSQL
- [ ] Design and implement database schema
- [ ] Create seed data scripts
- [ ] Set up environment configuration

#### Database Schema

```prisma
// User & Authentication
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String
  username      String    @unique
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  leagues       LeagueMember[]
  teams         Team[]
}

// League Structure
model League {
  id              String    @id @default(uuid())
  name            String
  platform        String?   // 'sleeper' | 'espn' | 'yahoo' | 'custom'
  externalId      String?   // ID from external platform
  scoringFormat   String    @default("ppr") // 'ppr' | 'half-ppr' | 'standard'
  teamCount       Int       @default(12)
  currentWeek     Int       @default(1)
  seasonYear      Int
  draftDate       DateTime?
  tradeDeadline   DateTime?
  playoffWeeks    Int       @default(3)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  members         LeagueMember[]
  teams           Team[]
  matchups        Matchup[]
  transactions    Transaction[]
}

model LeagueMember {
  id        String   @id @default(uuid())
  userId    String
  leagueId  String
  role      String   @default("member") // 'commissioner' | 'member'
  joinedAt  DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id])
  league    League   @relation(fields: [leagueId], references: [id])

  @@unique([userId, leagueId])
}

// Teams & Rosters
model Team {
  id              String    @id @default(uuid())
  leagueId        String
  ownerId         String
  name            String
  wins            Int       @default(0)
  losses          Int       @default(0)
  ties            Int       @default(0)
  pointsFor       Float     @default(0)
  pointsAgainst   Float     @default(0)
  playoffSeed     Int?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  league          League    @relation(fields: [leagueId], references: [id])
  owner           User      @relation(fields: [ownerId], references: [id])
  roster          RosterSpot[]
  homeMatchups    Matchup[] @relation("HomeTeam")
  awayMatchups    Matchup[] @relation("AwayTeam")
  transactionsAdd Transaction[] @relation("AddTeam")
  transactionsDrop Transaction[] @relation("DropTeam")
}

model RosterSpot {
  id          String    @id @default(uuid())
  teamId      String
  playerId    String
  slot        String    // 'QB' | 'RB1' | 'RB2' | 'WR1' | 'WR2' | 'TE' | 'FLEX' | 'K' | 'DEF' | 'BN1'-'BN6' | 'IR'
  isStarter   Boolean   @default(false)
  acquiredAt  DateTime  @default(now())

  team        Team      @relation(fields: [teamId], references: [id])
  player      NFLPlayer @relation(fields: [playerId], references: [id])

  @@unique([teamId, playerId])
}

// NFL Players & Stats
model NFLPlayer {
  id              String    @id @default(uuid())
  externalId      String?   @unique // ESPN/Sleeper player ID
  name            String
  team            String    // NFL team abbreviation
  position        String    // 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF'
  byeWeek         Int?
  status          String    @default("active") // 'active' | 'injured' | 'out' | 'questionable' | 'doubtful'
  injuryNote      String?
  headshotUrl     String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  rosters         RosterSpot[]
  weeklyStats     PlayerWeeklyStats[]
  projections     PlayerProjection[]
  news            PlayerNews[]
  transactions    Transaction[]
}

model PlayerWeeklyStats {
  id              String    @id @default(uuid())
  playerId        String
  week            Int
  seasonYear      Int

  // Passing
  passYards       Float     @default(0)
  passTDs         Float     @default(0)
  passInterceptions Float   @default(0)

  // Rushing
  rushYards       Float     @default(0)
  rushTDs         Float     @default(0)

  // Receiving
  receptions      Float     @default(0)
  receivingYards  Float     @default(0)
  receivingTDs    Float     @default(0)
  targets         Float     @default(0)

  // Misc
  fumbles         Float     @default(0)
  twoPointConversions Float @default(0)

  // Kicking
  fgMade          Float     @default(0)
  fgAttempts      Float     @default(0)
  xpMade          Float     @default(0)

  // Defense
  sacks           Float     @default(0)
  interceptions   Float     @default(0)
  defenseTDs      Float     @default(0)
  pointsAllowed   Float     @default(0)

  // Calculated
  fantasyPointsPPR    Float @default(0)
  fantasyPointsHalf   Float @default(0)
  fantasyPointsStd    Float @default(0)

  player          NFLPlayer @relation(fields: [playerId], references: [id])

  @@unique([playerId, week, seasonYear])
}

model PlayerProjection {
  id              String    @id @default(uuid())
  playerId        String
  week            Int
  seasonYear      Int

  projectedPoints Float
  scoringFormat   String    // 'ppr' | 'half-ppr' | 'standard'
  weekRank        Int?
  positionRank    Int?

  // Vegas props
  propLine        String?
  propOdds        String?

  updatedAt       DateTime  @updatedAt

  player          NFLPlayer @relation(fields: [playerId], references: [id])

  @@unique([playerId, week, seasonYear, scoringFormat])
}

// Matchups
model Matchup {
  id              String    @id @default(uuid())
  leagueId        String
  week            Int
  homeTeamId      String
  awayTeamId      String
  homeScore       Float?
  awayScore       Float?
  isPlayoff       Boolean   @default(false)
  isComplete      Boolean   @default(false)

  league          League    @relation(fields: [leagueId], references: [id])
  homeTeam        Team      @relation("HomeTeam", fields: [homeTeamId], references: [id])
  awayTeam        Team      @relation("AwayTeam", fields: [awayTeamId], references: [id])

  @@unique([leagueId, week, homeTeamId])
}

// Transactions (Trades, Waivers, Free Agent Pickups)
model Transaction {
  id              String    @id @default(uuid())
  leagueId        String
  type            String    // 'trade' | 'waiver' | 'add' | 'drop'
  status          String    @default("pending") // 'pending' | 'approved' | 'rejected' | 'processed'
  playerId        String?
  addTeamId       String?
  dropTeamId      String?
  waiverPriority  Int?
  processAt       DateTime?
  createdAt       DateTime  @default(now())

  league          League    @relation(fields: [leagueId], references: [id])
  player          NFLPlayer? @relation(fields: [playerId], references: [id])
  addTeam         Team?     @relation("AddTeam", fields: [addTeamId], references: [id])
  dropTeam        Team?     @relation("DropTeam", fields: [dropTeamId], references: [id])
}

// NFL Games & Schedule
model NFLGame {
  id              String    @id @default(uuid())
  externalId      String?   @unique
  week            Int
  seasonYear      Int
  homeTeam        String
  awayTeam        String
  gameTime        DateTime
  homeScore       Int?
  awayScore       Int?
  spread          Float?
  overUnder       Float?
  tvNetwork       String?
  weather         String?
  isComplete      Boolean   @default(false)

  @@unique([week, seasonYear, homeTeam, awayTeam])
}

// Player News
model PlayerNews {
  id              String    @id @default(uuid())
  playerId        String
  headline        String
  content         String
  source          String?
  publishedAt     DateTime
  createdAt       DateTime  @default(now())

  player          NFLPlayer @relation(fields: [playerId], references: [id])
}
```

#### Deliverables
- `/server` folder with Express + TypeScript setup
- Prisma schema file with all models
- Database migrations
- Seed script with 150+ NFL players, sample league, sample teams

---

### Day 3-4: Authentication & User Management

#### Tasks
- [ ] Implement user registration endpoint
- [ ] Implement login endpoint with JWT
- [ ] Create auth middleware
- [ ] Add password reset flow
- [ ] Connect frontend to auth endpoints

#### API Endpoints
```
POST   /api/auth/register     - Create new user
POST   /api/auth/login        - Login, return JWT
POST   /api/auth/refresh      - Refresh JWT token
POST   /api/auth/forgot       - Request password reset
POST   /api/auth/reset        - Reset password with token
GET    /api/auth/me           - Get current user
```

#### Frontend Updates
- Create login/register pages
- Add auth context/provider
- Protected route wrapper
- Token storage & refresh logic

---

### Day 5-6: League & Team Management

#### Tasks
- [ ] League CRUD endpoints
- [ ] Team management endpoints
- [ ] Roster management endpoints
- [ ] Connect Settings page to real league data

#### API Endpoints
```
# Leagues
GET    /api/leagues                    - User's leagues
POST   /api/leagues                    - Create league
GET    /api/leagues/:id                - League details
PUT    /api/leagues/:id                - Update league
DELETE /api/leagues/:id                - Delete league
POST   /api/leagues/:id/join           - Join league
POST   /api/leagues/:id/leave          - Leave league

# Teams
GET    /api/leagues/:id/teams          - All teams in league
GET    /api/teams/:id                  - Team details
PUT    /api/teams/:id                  - Update team (name, etc)
GET    /api/teams/:id/roster           - Team roster

# Roster Management
PUT    /api/teams/:id/roster           - Set lineup (move players)
POST   /api/teams/:id/roster/add       - Add player
DELETE /api/teams/:id/roster/:playerId - Drop player
```

#### Frontend Updates
- Settings page: Real league connections
- Team page: Live roster data
- Add/drop player functionality

---

### Day 7: Player Data & Projections

#### Tasks
- [ ] Player search & filtering endpoints
- [ ] Projection calculations
- [ ] Trending players logic
- [ ] Connect Board view to real data

#### API Endpoints
```
GET    /api/players                    - All players (paginated, filterable)
GET    /api/players/:id                - Player details
GET    /api/players/:id/stats          - Player weekly stats
GET    /api/players/:id/projections    - Player projections
GET    /api/players/trending           - Trending up/down players
GET    /api/players/search?q=          - Search players
```

#### Scoring Calculations
```typescript
// PPR Scoring
const calculatePPRPoints = (stats: PlayerWeeklyStats): number => {
  return (
    (stats.passYards * 0.04) +
    (stats.passTDs * 4) +
    (stats.passInterceptions * -1) +
    (stats.rushYards * 0.1) +
    (stats.rushTDs * 6) +
    (stats.receptions * 1) +        // PPR bonus
    (stats.receivingYards * 0.1) +
    (stats.receivingTDs * 6) +
    (stats.fumbles * -2) +
    (stats.twoPointConversions * 2)
  );
};
```

---

## Week 2: Advanced Features & Polish

### Day 8-9: Matchups & Scoring

#### Tasks
- [ ] Matchup endpoints
- [ ] Live scoring calculations
- [ ] Weekly schedule generation
- [ ] Connect Matchup view to real data

#### API Endpoints
```
GET    /api/leagues/:id/matchups              - All matchups
GET    /api/leagues/:id/matchups/week/:week   - Week's matchups
GET    /api/matchups/:id                      - Matchup details with rosters
GET    /api/matchups/:id/live                 - Live scoring data
```

#### Frontend Updates
- Matchup page: Real opponent data
- Live score updates
- Week navigation

---

### Day 10-11: Waivers & Transactions

#### Tasks
- [ ] Waiver wire endpoints
- [ ] Waiver claim processing
- [ ] Trade proposal system
- [ ] Transaction history

#### API Endpoints
```
# Waivers
GET    /api/leagues/:id/waivers        - Available players
POST   /api/leagues/:id/waivers/claim  - Submit waiver claim
DELETE /api/waivers/:id                - Cancel waiver claim
GET    /api/leagues/:id/waivers/claims - Pending claims

# Trades
POST   /api/trades                     - Propose trade
GET    /api/trades/:id                 - Trade details
PUT    /api/trades/:id/accept          - Accept trade
PUT    /api/trades/:id/reject          - Reject trade
DELETE /api/trades/:id                 - Cancel trade

# Transactions
GET    /api/leagues/:id/transactions   - Transaction history
```

#### Waiver Processing Logic
```typescript
// Run nightly at configured time (e.g., 3 AM Wednesday)
const processWaivers = async (leagueId: string) => {
  const claims = await getWaiverClaims(leagueId);
  const sortedByPriority = claims.sort((a, b) => a.waiverPriority - b.waiverPriority);

  for (const claim of sortedByPriority) {
    if (await isPlayerAvailable(claim.playerId)) {
      await processWaiverClaim(claim);
      await rotateWaiverPriority(leagueId, claim.teamId);
    }
  }
};
```

---

### Day 12: NFL Games & Real-time Updates

#### Tasks
- [ ] NFL game schedule endpoints
- [ ] Socket.io integration for live scores
- [ ] Game detail modal with real data
- [ ] Connect Game Slate view

#### API Endpoints
```
GET    /api/games                      - All games
GET    /api/games/week/:week           - Week's games
GET    /api/games/:id                  - Game details
GET    /api/games/:id/props            - Player props for game
```

#### Socket.io Events
```typescript
// Server
io.on('connection', (socket) => {
  socket.on('subscribe:game', (gameId) => {
    socket.join(`game:${gameId}`);
  });

  socket.on('subscribe:matchup', (matchupId) => {
    socket.join(`matchup:${matchupId}`);
  });
});

// Emit score updates
io.to(`game:${gameId}`).emit('score:update', { gameId, homeScore, awayScore });
io.to(`matchup:${matchupId}`).emit('matchup:update', { matchupId, homeScore, awayScore });
```

---

### Day 13: Playoff Predictor & Analytics

#### Tasks
- [ ] Playoff probability calculations
- [ ] Monte Carlo simulation endpoint
- [ ] Standings calculations
- [ ] Connect Playoff Predictor view

#### API Endpoints
```
GET    /api/leagues/:id/standings              - Current standings
GET    /api/leagues/:id/playoff-odds           - Playoff probabilities
POST   /api/leagues/:id/simulate               - Run simulation with inputs
```

#### Monte Carlo Simulation
```typescript
const simulatePlayoffs = (league: League, simulations: number = 10000) => {
  const results = new Map<string, number>(); // teamId -> playoff count

  for (let i = 0; i < simulations; i++) {
    const simulatedStandings = simulateRemainingSeason(league);
    const playoffTeams = getPlayoffTeams(simulatedStandings);
    playoffTeams.forEach(teamId => {
      results.set(teamId, (results.get(teamId) || 0) + 1);
    });
  }

  return Array.from(results.entries()).map(([teamId, count]) => ({
    teamId,
    playoffProbability: count / simulations
  }));
};
```

---

### Day 14: Testing, Polish & Deployment Prep

#### Tasks
- [ ] API error handling improvements
- [ ] Input validation (Zod schemas)
- [ ] Rate limiting
- [ ] API documentation
- [ ] Frontend error states
- [ ] Loading skeletons
- [ ] Final UI polish
- [ ] Environment configuration for production

#### Testing Coverage
- Unit tests for scoring calculations
- Integration tests for API endpoints
- E2E tests for critical flows (login, set lineup, make waiver claim)

---

## Folder Structure (Final)

```
Fantasy Football Web App/
├── src/                          # Frontend (existing)
│   ├── components/
│   ├── data/
│   ├── hooks/                    # NEW: Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useLeague.ts
│   │   ├── usePlayers.ts
│   │   └── useSocket.ts
│   ├── services/                 # NEW: API service layer
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   ├── leagues.ts
│   │   ├── players.ts
│   │   └── socket.ts
│   ├── context/                  # NEW: React contexts
│   │   ├── AuthContext.tsx
│   │   └── SocketContext.tsx
│   ├── pages/                    # NEW: Page components
│   │   ├── Login.tsx
│   │   └── Register.tsx
│   └── types/                    # NEW: TypeScript types
│       └── index.ts
│
├── server/                       # NEW: Backend
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── auth.ts
│   │   │   ├── leagues.ts
│   │   │   ├── teams.ts
│   │   │   ├── players.ts
│   │   │   ├── matchups.ts
│   │   │   ├── waivers.ts
│   │   │   └── games.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── errorHandler.ts
│   │   │   └── validation.ts
│   │   ├── services/
│   │   │   ├── scoring.ts
│   │   │   ├── simulation.ts
│   │   │   └── waiverProcessor.ts
│   │   ├── routes/
│   │   │   └── index.ts
│   │   ├── socket/
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   └── helpers.ts
│   │   └── index.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── package.json
│   └── tsconfig.json
│
├── package.json
└── README.md
```

---

## Daily Checklist Format

Each day, track progress with:

```markdown
## Day X - [Date]

### Planned
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

### Completed
- [x] Task 1
- [x] Task 2

### Blockers
- Issue description

### Notes
- Any important observations
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Database complexity | Start with core tables, add features incrementally |
| External API rate limits | Cache responses, implement retry logic |
| Real-time scaling | Use Redis for Socket.io adapter if needed |
| Auth security | Use established libraries (bcrypt, jsonwebtoken) |
| Data migration | Keep seed scripts updated, version migrations |

---

## Success Criteria (End of Week 2)

### Must Have
- [ ] User can register and login
- [ ] User can view their leagues and teams
- [ ] User can set their lineup
- [ ] User can view matchups with real scores
- [ ] User can browse and filter players
- [ ] User can make waiver claims
- [ ] All data persists in PostgreSQL

### Should Have
- [ ] Real-time score updates during games
- [ ] Trade proposal system
- [ ] Playoff probability calculations
- [ ] Player news feed

### Nice to Have
- [ ] External league import (Sleeper API)
- [ ] Advanced analytics
- [ ] Mobile-responsive polish

---

## Getting Started Commands

```bash
# Backend setup
cd server
npm init -y
npm install express typescript ts-node @types/node @types/express
npm install prisma @prisma/client
npm install jsonwebtoken bcryptjs cors helmet
npm install socket.io
npm install zod
npx prisma init

# Frontend additions
cd ..
npm install axios socket.io-client
npm install @tanstack/react-query  # For data fetching
```

---

## Next Steps

1. Review this plan and confirm technology choices
2. Set up PostgreSQL database (local or cloud - Supabase/Railway/Neon)
3. Begin Day 1 tasks: Initialize backend project structure
