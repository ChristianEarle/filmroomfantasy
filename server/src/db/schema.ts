import { sqliteTable, text, integer, real, primaryKey, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ============================================
// USER & AUTHENTICATION
// ============================================

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  username: text('username').notNull().unique(),
  googleId: text('google_id'),
  yahooAccessToken: text('yahoo_access_token'),
  yahooRefreshToken: text('yahoo_refresh_token'),
  yahooTokenExpiresAt: integer('yahoo_token_expires_at', { mode: 'timestamp' }),
  avatarUrl: text('avatar_url'),
  preferredScoring: text('preferred_scoring').default('ppr'),
  darkMode: integer('dark_mode', { mode: 'boolean' }).default(true),
  notificationsEnabled: integer('notifications_enabled', { mode: 'boolean' }).default(true),
  subscriptionTier: text('subscription_tier').notNull().default('free'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  subscriptionExpiresAt: text('subscription_expires_at'),
  role: text('role').notNull().default('user'), // 'user' | 'admin'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const tradeAnalysisUsage = sqliteTable('trade_analysis_usage', {
  id: text('id').primaryKey(),
  // No FK to users(id): rows may use synthetic ids like `anon_<ip>` for
  // anonymous rate limiting, which would otherwise violate the constraint.
  userId: text('user_id').notNull(),
  usedAt: text('used_at').notNull(),
  dateKey: text('date_key').notNull(), // YYYY-MM-DD
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ============================================
// LEAGUE STRUCTURE
// ============================================

export const leagues = sqliteTable('leagues', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  platform: text('platform'), // 'sleeper' | 'espn' | 'yahoo' | 'custom'
  externalId: text('external_id'),
  scoringFormat: text('scoring_format').notNull().default('ppr'), // 'ppr' | 'half-ppr' | 'standard'
  teamCount: integer('team_count').notNull().default(12),
  currentWeek: integer('current_week').notNull().default(1),
  seasonYear: integer('season_year').notNull(),
  draftDate: integer('draft_date', { mode: 'timestamp' }),
  tradeDeadline: integer('trade_deadline', { mode: 'timestamp' }),
  playoffWeeks: integer('playoff_weeks').notNull().default(3),
  playoffTeams: integer('playoff_teams').notNull().default(6),
  waiverType: text('waiver_type').notNull().default('faab'), // 'faab' | 'rolling' | 'reverse'
  waiverBudget: integer('waiver_budget').default(100),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const leagueMembers = sqliteTable('league_members', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  leagueId: text('league_id').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'), // 'commissioner' | 'member'
  externalUsername: text('external_username'), // Sleeper/ESPN/Yahoo username to identify user's team
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  userLeagueUnique: uniqueIndex('user_league_unique').on(table.userId, table.leagueId),
}));

// ============================================
// TEAMS & ROSTERS
// ============================================

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  leagueId: text('league_id').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id').notNull().references(() => users.id),
  externalOwnerId: text('external_owner_id'), // Sleeper/ESPN user ID - identifies which platform user owns this team
  ownerDisplayName: text('owner_display_name'), // Display name from Sleeper/ESPN/Yahoo (so we don't show the app user for every team)
  name: text('name').notNull(),
  wins: integer('wins').notNull().default(0),
  losses: integer('losses').notNull().default(0),
  ties: integer('ties').notNull().default(0),
  pointsFor: real('points_for').notNull().default(0),
  pointsAgainst: real('points_against').notNull().default(0),
  playoffSeed: integer('playoff_seed'),
  waiverPriority: integer('waiver_priority').default(1),
  faabBudget: integer('faab_budget').default(100),
  streak: text('streak'), // 'W3', 'L2', etc.
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const rosterSpots = sqliteTable('roster_spots', {
  id: text('id').primaryKey(),
  teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull().references(() => nflPlayers.id),
  slot: text('slot').notNull(), // 'QB' | 'RB1' | 'RB2' | 'WR1' | 'WR2' | 'TE' | 'FLEX' | 'K' | 'DEF' | 'BN1'-'BN6' | 'IR'
  isStarter: integer('is_starter', { mode: 'boolean' }).notNull().default(false),
  acquiredAt: integer('acquired_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  acquiredType: text('acquired_type').default('draft'), // 'draft' | 'trade' | 'waiver' | 'free_agent'
}, (table) => ({
  teamPlayerUnique: uniqueIndex('team_player_unique').on(table.teamId, table.playerId),
}));

// ============================================
// NFL PLAYERS & STATS
// ============================================

export const nflPlayers = sqliteTable('nfl_players', {
  id: text('id').primaryKey(),
  externalId: text('external_id').unique(),
  name: text('name').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  team: text('team').notNull(), // NFL team abbreviation
  position: text('position').notNull(), // 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF'
  depthChartOrder: integer('depth_chart_order'),
  jerseyNumber: integer('jersey_number'),
  byeWeek: integer('bye_week'),
  status: text('status').notNull().default('active'), // 'active' | 'injured_reserve' | 'out' | 'questionable' | 'doubtful'
  injuryNote: text('injury_note'),
  injuryBodyPart: text('injury_body_part'),
  headshotUrl: text('headshot_url'),
  age: integer('age'),
  height: text('height'),
  weight: integer('weight'),
  college: text('college'),
  yearsExp: integer('years_exp'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const playerWeeklyStats = sqliteTable('player_weekly_stats', {
  id: text('id').primaryKey(),
  playerId: text('player_id').notNull().references(() => nflPlayers.id, { onDelete: 'cascade' }),
  week: integer('week').notNull(),
  seasonYear: integer('season_year').notNull(),
  opponent: text('opponent'),
  gameResult: text('game_result'), // 'W 24-17' or 'L 17-24'

  // Passing
  passAttempts: integer('pass_attempts').default(0),
  passCompletions: integer('pass_completions').default(0),
  passYards: real('pass_yards').default(0),
  passTDs: integer('pass_tds').default(0),
  passInterceptions: integer('pass_interceptions').default(0),

  // Rushing
  rushAttempts: integer('rush_attempts').default(0),
  rushYards: real('rush_yards').default(0),
  rushTDs: integer('rush_tds').default(0),

  // Receiving
  targets: integer('targets').default(0),
  receptions: integer('receptions').default(0),
  receivingYards: real('receiving_yards').default(0),
  receivingTDs: integer('receiving_tds').default(0),

  // Misc
  fumbles: integer('fumbles').default(0),
  fumblesLost: integer('fumbles_lost').default(0),
  twoPointConversions: integer('two_point_conversions').default(0),

  // Kicking
  fgMade: integer('fg_made').default(0),
  fgAttempts: integer('fg_attempts').default(0),
  fg40PlusMade: integer('fg_40_plus_made').default(0),
  fg50PlusMade: integer('fg_50_plus_made').default(0),
  xpMade: integer('xp_made').default(0),
  xpAttempts: integer('xp_attempts').default(0),

  // Snap counts (from Sleeper - for played detection and snap %)
  offSnaps: integer('off_snaps').default(0),
  defSnaps: integer('def_snaps').default(0),
  stSnaps: integer('st_snaps').default(0),
  tmOffSnaps: integer('tm_off_snaps').default(0),
  tmDefSnaps: integer('tm_def_snaps').default(0),
  tmStSnaps: integer('tm_st_snaps').default(0),

  // Defense
  sacks: real('sacks').default(0),
  defInterceptions: integer('def_interceptions').default(0),
  fumblesRecovered: integer('fumbles_recovered').default(0),
  defenseTDs: integer('defense_tds').default(0),
  safeties: integer('safeties').default(0),
  pointsAllowed: integer('points_allowed').default(0),

  // Calculated Fantasy Points
  fantasyPointsPPR: real('fantasy_points_ppr').default(0),
  fantasyPointsHalf: real('fantasy_points_half').default(0),
  fantasyPointsStd: real('fantasy_points_std').default(0),
}, (table) => ({
  playerWeekUnique: uniqueIndex('player_week_unique').on(table.playerId, table.week, table.seasonYear),
}));

export const playerProjections = sqliteTable('player_projections', {
  id: text('id').primaryKey(),
  playerId: text('player_id').notNull().references(() => nflPlayers.id, { onDelete: 'cascade' }),
  week: integer('week').notNull(),
  seasonYear: integer('season_year').notNull(),

  projectedPoints: real('projected_points').notNull(),
  projectedPointsLow: real('projected_points_low'),
  projectedPointsHigh: real('projected_points_high'),
  scoringFormat: text('scoring_format').notNull(), // 'ppr' | 'half-ppr' | 'standard'

  weekRank: integer('week_rank'),
  positionRank: integer('position_rank'),

  // Projected Stats
  projPassYards: real('proj_pass_yards'),
  projPassTDs: real('proj_pass_tds'),
  projRushYards: real('proj_rush_yards'),
  projRushTDs: real('proj_rush_tds'),
  projReceptions: real('proj_receptions'),
  projRecYards: real('proj_rec_yards'),
  projRecTDs: real('proj_rec_tds'),

  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  playerProjectionUnique: uniqueIndex('player_projection_unique').on(table.playerId, table.week, table.seasonYear, table.scoringFormat),
}));

// Historical projection snapshots for trends (biggest movers, etc.)
export const projectionLineSnapshots = sqliteTable('projection_line_snapshots', {
  id: text('id').primaryKey(),
  playerId: text('player_id').notNull().references(() => nflPlayers.id, { onDelete: 'cascade' }),
  week: integer('week').notNull(),
  seasonYear: integer('season_year').notNull(),
  scoringFormat: text('scoring_format').notNull(),
  snapshotAt: integer('snapshot_at', { mode: 'timestamp' }).notNull(),
  projectedPoints: real('projected_points').notNull(),
  projPassYards: real('proj_pass_yards'),
  projPassTDs: real('proj_pass_tds'),
  projRushYards: real('proj_rush_yards'),
  projRushTDs: real('proj_rush_tds'),
  projReceptions: real('proj_receptions'),
  projRecYards: real('proj_rec_yards'),
  projRecTDs: real('proj_rec_tds'),
}, (table) => ({
  snapPlayerWeekIdx: uniqueIndex('proj_snap_player_week').on(table.playerId, table.week, table.seasonYear, table.scoringFormat, table.snapshotAt),
}));

// Historical game line snapshots for betting trends
export const gameLineSnapshots = sqliteTable('game_line_snapshots', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => nflGames.id, { onDelete: 'cascade' }),
  snapshotAt: integer('snapshot_at', { mode: 'timestamp' }).notNull(),
  spread: real('spread'),
  overUnder: real('over_under'),
}, (table) => ({
  snapGameIdx: uniqueIndex('game_snap_game').on(table.gameId, table.snapshotAt),
}));

// Game odds from The Odds API
export const gameOdds = sqliteTable('game_odds', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => nflGames.id, { onDelete: 'cascade' }),
  sportKey: text('sport_key').notNull().default('americanfootball_nfl'),
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  commenceTime: text('commence_time').notNull(),
  bookmaker: text('bookmaker').notNull(),
  market: text('market').notNull(),
  homePoint: real('home_point'),
  awayPoint: real('away_point'),
  homePrice: integer('home_price'),
  awayPrice: integer('away_price'),
  overPoint: real('over_point'),
  underPoint: real('under_point'),
  overPrice: integer('over_price'),
  underPrice: integer('under_price'),
  snapshotTime: text('snapshot_time').notNull(),
  season: integer('season').notNull().default(2025),
  week: integer('week'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  gameOddsUnique: uniqueIndex('game_odds_unique').on(table.gameId, table.bookmaker, table.market, table.snapshotTime),
  gameOddsGameIdx: index('idx_game_odds_game_id').on(table.gameId),
  gameOddsWeekIdx: index('idx_game_odds_week').on(table.week),
  gameOddsCommenceIdx: index('idx_game_odds_commence').on(table.commenceTime),
}));

// ============================================
// MATCHUPS
// ============================================

export const matchups = sqliteTable('matchups', {
  id: text('id').primaryKey(),
  leagueId: text('league_id').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  week: integer('week').notNull(),
  homeTeamId: text('home_team_id').notNull().references(() => teams.id),
  awayTeamId: text('away_team_id').notNull().references(() => teams.id),
  homeScore: real('home_score'),
  awayScore: real('away_score'),
  homeProjectedScore: real('home_projected_score'),
  awayProjectedScore: real('away_projected_score'),
  isPlayoff: integer('is_playoff', { mode: 'boolean' }).notNull().default(false),
  isChampionship: integer('is_championship', { mode: 'boolean' }).notNull().default(false),
  isComplete: integer('is_complete', { mode: 'boolean' }).notNull().default(false),
}, (table) => ({
  matchupUnique: uniqueIndex('matchup_unique').on(table.leagueId, table.week, table.homeTeamId),
}));

// ============================================
// TRANSACTIONS
// ============================================

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  leagueId: text('league_id').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'trade' | 'waiver' | 'add' | 'drop'
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected' | 'processed'
  playerId: text('player_id').references(() => nflPlayers.id),
  addTeamId: text('add_team_id').references(() => teams.id),
  dropTeamId: text('drop_team_id').references(() => teams.id),
  dropPlayerId: text('drop_player_id').references(() => nflPlayers.id),
  faabBid: integer('faab_bid'),
  waiverPriority: integer('waiver_priority'),
  processAt: integer('process_at', { mode: 'timestamp' }),
  processedAt: integer('processed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const trades = sqliteTable('trades', {
  id: text('id').primaryKey(),
  leagueId: text('league_id').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  proposingTeamId: text('proposing_team_id').notNull().references(() => teams.id),
  receivingTeamId: text('receiving_team_id').notNull().references(() => teams.id),
  status: text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'vetoed'
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  respondedAt: integer('responded_at', { mode: 'timestamp' }),
});

export const tradeItems = sqliteTable('trade_items', {
  id: text('id').primaryKey(),
  tradeId: text('trade_id').notNull().references(() => trades.id, { onDelete: 'cascade' }),
  fromTeamId: text('from_team_id').notNull().references(() => teams.id),
  toTeamId: text('to_team_id').notNull().references(() => teams.id),
  playerId: text('player_id').references(() => nflPlayers.id),
  draftPickYear: integer('draft_pick_year'),
  draftPickRound: integer('draft_pick_round'),
});

// ============================================
// NFL GAMES & SCHEDULE
// ============================================

export const nflGames = sqliteTable('nfl_games', {
  id: text('id').primaryKey(),
  externalId: text('external_id').unique(),
  week: integer('week').notNull(),
  seasonYear: integer('season_year').notNull(),
  seasonType: text('season_type').default('regular'), // 'preseason' | 'regular' | 'postseason'
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  gameTime: integer('game_time', { mode: 'timestamp' }).notNull(),
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),
  spread: real('spread'),
  overUnder: real('over_under'),
  homeMoneyline: integer('home_moneyline'),
  awayMoneyline: integer('away_moneyline'),
  tvNetwork: text('tv_network'),
  stadium: text('stadium'),
  weather: text('weather'),
  isComplete: integer('is_complete', { mode: 'boolean' }).notNull().default(false),
  quarter: text('quarter'), // '1' | '2' | '3' | '4' | 'OT' | 'Final'
  timeRemaining: text('time_remaining'),
}, (table) => ({
  nflGameUnique: uniqueIndex('nfl_game_unique').on(table.week, table.seasonYear, table.homeTeam, table.awayTeam),
}));

// ============================================
// PLAYER NEWS
// ============================================

export const playerNews = sqliteTable('player_news', {
  id: text('id').primaryKey(),
  playerId: text('player_id').notNull().references(() => nflPlayers.id, { onDelete: 'cascade' }),
  headline: text('headline').notNull(),
  content: text('content').notNull(),
  source: text('source'),
  sourceUrl: text('source_url'),
  aiSummary: text('ai_summary'),
  impactLevel: text('impact_level'), // 'high' | 'medium' | 'low'
  publishedAt: integer('published_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ============================================
// RELATIONS
// ============================================

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  leagueMemberships: many(leagueMembers),
  teams: many(teams),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const leaguesRelations = relations(leagues, ({ many }) => ({
  members: many(leagueMembers),
  teams: many(teams),
  matchups: many(matchups),
  transactions: many(transactions),
  trades: many(trades),
}));

export const leagueMembersRelations = relations(leagueMembers, ({ one }) => ({
  user: one(users, { fields: [leagueMembers.userId], references: [users.id] }),
  league: one(leagues, { fields: [leagueMembers.leagueId], references: [leagues.id] }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  league: one(leagues, { fields: [teams.leagueId], references: [leagues.id] }),
  owner: one(users, { fields: [teams.ownerId], references: [users.id] }),
  roster: many(rosterSpots),
  homeMatchups: many(matchups, { relationName: 'homeTeam' }),
  awayMatchups: many(matchups, { relationName: 'awayTeam' }),
}));

export const rosterSpotsRelations = relations(rosterSpots, ({ one }) => ({
  team: one(teams, { fields: [rosterSpots.teamId], references: [teams.id] }),
  player: one(nflPlayers, { fields: [rosterSpots.playerId], references: [nflPlayers.id] }),
}));

export const nflPlayersRelations = relations(nflPlayers, ({ many }) => ({
  weeklyStats: many(playerWeeklyStats),
  projections: many(playerProjections),
  news: many(playerNews),
  rosterSpots: many(rosterSpots),
  articleLinks: many(articlePlayers),
}));

export const playerWeeklyStatsRelations = relations(playerWeeklyStats, ({ one }) => ({
  player: one(nflPlayers, { fields: [playerWeeklyStats.playerId], references: [nflPlayers.id] }),
}));

export const playerProjectionsRelations = relations(playerProjections, ({ one }) => ({
  player: one(nflPlayers, { fields: [playerProjections.playerId], references: [nflPlayers.id] }),
}));

export const matchupsRelations = relations(matchups, ({ one }) => ({
  league: one(leagues, { fields: [matchups.leagueId], references: [leagues.id] }),
  homeTeam: one(teams, { fields: [matchups.homeTeamId], references: [teams.id], relationName: 'homeTeam' }),
  awayTeam: one(teams, { fields: [matchups.awayTeamId], references: [teams.id], relationName: 'awayTeam' }),
}));

export const playerNewsRelations = relations(playerNews, ({ one }) => ({
  player: one(nflPlayers, { fields: [playerNews.playerId], references: [nflPlayers.id] }),
}));

export const gameOddsRelations = relations(gameOdds, ({ one }) => ({
  game: one(nflGames, { fields: [gameOdds.gameId], references: [nflGames.id] }),
}));

// Player props from The Odds API
export const playerProps = sqliteTable('player_props', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull(),
  playerName: text('player_name').notNull(),
  playerExternalId: text('player_external_id'),
  market: text('market').notNull(), // 'player_pass_yds', 'player_rush_yds', etc.
  bookmaker: text('bookmaker').notNull(),
  overPoint: real('over_point'),
  overPrice: integer('over_price'),
  underPoint: real('under_point'),
  underPrice: integer('under_price'),
  yesPrice: integer('yes_price'),
  noPrice: integer('no_price'),
  snapshotTime: text('snapshot_time').notNull(),
  season: integer('season').notNull().default(2025),
  week: integer('week').notNull(),
  homeTeam: text('home_team'),
  awayTeam: text('away_team'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  playerPropsUnique: uniqueIndex('player_props_unique').on(table.eventId, table.playerName, table.market, table.bookmaker, table.snapshotTime),
  playerPropsNameIdx: index('idx_player_props_name').on(table.playerName),
  playerPropsWeekIdx: index('idx_player_props_week').on(table.week),
  playerPropsMarketIdx: index('idx_player_props_market').on(table.market),
  playerPropsExternalIdIdx: index('idx_player_props_external_id').on(table.playerExternalId),
}));

// ============================================
// ARTICLES / BLOG
// ============================================

export const articles = sqliteTable('articles', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(), // Meta description / excerpt
  content: text('content').notNull(), // HTML or Markdown content
  category: text('category').notNull(), // 'strategy' | 'rankings' | 'news' | 'tools' | 'beginners'
  tags: text('tags').notNull().default('[]'), // JSON array of strings
  author: text('author').notNull().default('FilmRoom'),
  status: text('status').notNull().default('draft'), // 'draft' | 'published'
  readingTime: integer('reading_time').notNull().default(5), // minutes
  imageUrl: text('image_url'), // Optional hero image
  publishedAt: text('published_at'), // ISO date string, null if draft
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  articlesSlugIdx: uniqueIndex('idx_articles_slug').on(table.slug),
  articlesStatusIdx: index('idx_articles_status').on(table.status),
  articlesCategoryIdx: index('idx_articles_category').on(table.category),
}));

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;

// ============================================
// ARTICLE ↔ PLAYER (many-to-many)
// ============================================

export const articlePlayers = sqliteTable('article_players', {
  articleId: text('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull().references(() => nflPlayers.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.articleId, table.playerId] }),
  articlePlayersPlayerIdx: index('idx_article_players_player').on(table.playerId),
  articlePlayersArticleIdx: index('idx_article_players_article').on(table.articleId),
}));

export const articlesRelations = relations(articles, ({ many }) => ({
  playerLinks: many(articlePlayers),
}));

export const articlePlayersRelations = relations(articlePlayers, ({ one }) => ({
  article: one(articles, { fields: [articlePlayers.articleId], references: [articles.id] }),
  player: one(nflPlayers, { fields: [articlePlayers.playerId], references: [nflPlayers.id] }),
}));

// ============================================
// PASSWORD RESET TOKENS
// ============================================

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(), // SHA-256 hash of the token (never store raw)
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp' }), // null until used
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ============================================
// USER FEEDBACK
// ============================================

export const userFeedback = sqliteTable('user_feedback', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }), // Optional - allow anonymous
  type: text('type').notNull(), // 'bug' | 'feature' | 'general'
  message: text('message').notNull(),
  email: text('email'), // Optional contact email
  page: text('page'), // Which page they were on
  userAgent: text('user_agent'),
  status: text('status').notNull().default('new'), // 'new' | 'reviewed' | 'resolved'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ============================================
// PAGE VIEWS & ANALYTICS
// ============================================

export const pageViews = sqliteTable('page_views', {
  id: text('id').primaryKey(),
  path: text('path').notNull(),
  referrer: text('referrer'),
  userId: text('user_id'),
  sessionId: text('session_id').notNull(), // anonymous fingerprint
  userAgent: text('user_agent'),
  country: text('country'),
  device: text('device'), // 'mobile' | 'tablet' | 'desktop'
  browser: text('browser'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  pageViewsPathIdx: index('idx_page_views_path').on(table.path),
  pageViewsCreatedIdx: index('idx_page_views_created').on(table.createdAt),
  pageViewsSessionIdx: index('idx_page_views_session').on(table.sessionId),
}));

export type PageView = typeof pageViews.$inferSelect;
export type NewPageView = typeof pageViews.$inferInsert;

// ============================================
// TYPE EXPORTS
// ============================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type League = typeof leagues.$inferSelect;
export type NewLeague = typeof leagues.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type NFLPlayer = typeof nflPlayers.$inferSelect;
export type NewNFLPlayer = typeof nflPlayers.$inferInsert;
export type PlayerWeeklyStats = typeof playerWeeklyStats.$inferSelect;
export type PlayerProjection = typeof playerProjections.$inferSelect;
export type Matchup = typeof matchups.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Trade = typeof trades.$inferSelect;
export type NFLGame = typeof nflGames.$inferSelect;
export type PlayerNews = typeof playerNews.$inferSelect;
export type UserFeedback = typeof userFeedback.$inferSelect;
export type NewUserFeedback = typeof userFeedback.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type GameOdds = typeof gameOdds.$inferSelect;
export type NewGameOdds = typeof gameOdds.$inferInsert;
export type PlayerProps = typeof playerProps.$inferSelect;
export type NewPlayerProps = typeof playerProps.$inferInsert;