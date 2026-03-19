import { Hono } from 'hono';
import { eq, and, or, inArray } from 'drizzle-orm';
import * as schema from '../db/schema';
import { getMappedPlayers, fetchSleeperPlayers, buildHeadshotUrl, sleep } from '../services/sleeper';
import { fetchTwitterTweets } from '../services/twitter';
import { checkNewsRelevance } from '../services/ai';
import { generateId } from '../utils/id';
import type { Env, Variables } from '../index';

export const adminRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Admin auth middleware — always requires SYNC_SECRET
adminRoutes.use('*', async (c, next) => {
  const syncSecret = c.env.SYNC_SECRET;
  if (!syncSecret) {
    return c.json({ error: 'SYNC_SECRET not configured' }, 500);
  }
  const adminKey = c.req.header('X-Admin-Key');
  if (adminKey !== syncSecret) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

/**
 * POST /api/admin/sync-players
 * Fetches all NFL players from Sleeper API and upserts into the database.
 * Uses db.batch() to perform inserts/updates in groups of 50 to stay under subrequest limits.
 * Requires X-Admin-Key header matching SYNC_SECRET env var.
 */
adminRoutes.post('/sync-players', async (c) => {
  const db = c.get('db');


  try {
    c.header('Content-Type', 'application/json');

    const mapped = await getMappedPlayers();
    let inserted = 0;
    let updated = 0;

    const now = new Date();

    // Fetch all existing players from DB once (1 subrequest)
    const existing = await db.query.nflPlayers.findMany({
      columns: { id: true, externalId: true },
    });
    const existingMap = new Map(existing.map(p => [p.externalId, p.id]));

    // Split into batches of 50 to stay under subrequest limits
    const BATCH_SIZE = 50;
    for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
      const batch = mapped.slice(i, i + BATCH_SIZE);
      const statements: any[] = [];

      for (const player of batch) {
        const existingId = existingMap.get(player.externalId);
        if (existingId) {
          // Build UPDATE statement
          statements.push(
            db
              .update(schema.nflPlayers)
              .set({
                name: player.name,
                firstName: player.firstName,
                lastName: player.lastName,
                team: player.team,
                position: player.position,
                status: player.status,
                injuryNote: player.injuryNote,
                injuryBodyPart: player.injuryBodyPart,
                headshotUrl: player.headshotUrl,
                age: player.age,
                height: player.height,
                weight: player.weight,
                college: player.college,
                yearsExp: player.yearsExp,
                jerseyNumber: player.jerseyNumber,
                depthChartOrder: player.depthChartOrder,
                updatedAt: now,
              })
              .where(eq(schema.nflPlayers.id, existingId))
          );
          updated++;
        } else {
          // Build INSERT statement
          statements.push(
            db.insert(schema.nflPlayers).values({
              id: player.id,
              externalId: player.externalId,
              name: player.name,
              firstName: player.firstName,
              lastName: player.lastName,
              team: player.team,
              position: player.position,
              status: player.status,
              injuryNote: player.injuryNote,
              injuryBodyPart: player.injuryBodyPart,
              headshotUrl: player.headshotUrl,
              age: player.age,
              height: player.height,
              weight: player.weight,
              college: player.college,
              yearsExp: player.yearsExp,
              jerseyNumber: player.jerseyNumber,
              depthChartOrder: player.depthChartOrder,
              createdAt: now,
              updatedAt: now,
            })
          );
          inserted++;
        }
      }

      // Execute all statements in this batch as one subrequest
      if (statements.length > 0) {
        await db.batch(statements as any);
      }
    }

    // Clean up placeholder players (Sleeper uses "Invalid"/"0" for empty roster slots)
    const invalidPlayers = await db.query.nflPlayers.findMany({
      where: or(
        inArray(schema.nflPlayers.externalId, ['Invalid', '0']),
        eq(schema.nflPlayers.name, 'Player Invalid')
      ),
      columns: { id: true },
    });
    let cleaned = 0;
    if (invalidPlayers.length > 0) {
      // Batch cleanup operations (50 at a time)
      for (let i = 0; i < invalidPlayers.length; i += BATCH_SIZE) {
        const cleanBatch = invalidPlayers.slice(i, i + BATCH_SIZE);
        const cleanStatements: any[] = [];

        for (const p of cleanBatch) {
          cleanStatements.push(db.delete(schema.rosterSpots).where(eq(schema.rosterSpots.playerId, p.id)));
          cleanStatements.push(db.update(schema.transactions).set({ playerId: null })
            .where(eq(schema.transactions.playerId, p.id)));
          cleanStatements.push(db.update(schema.transactions).set({ dropPlayerId: null })
            .where(eq(schema.transactions.dropPlayerId, p.id)));
          cleanStatements.push(db.update(schema.tradeItems).set({ playerId: null })
            .where(eq(schema.tradeItems.playerId, p.id)));
          cleanStatements.push(db.delete(schema.nflPlayers).where(eq(schema.nflPlayers.id, p.id)));
          cleaned++;
        }

        if (cleanStatements.length > 0) {
          await db.batch(cleanStatements as any);
        }
      }
    }

    return c.json({
      success: true,
      message: 'Player sync completed',
      inserted,
      updated,
      cleaned,
      total: mapped.length,
    });
  } catch (err) {
    console.error('Sync players error:', err);
    return c.json(
      {
        error: 'Sync failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/admin/sync-headshots
 * Fetches Sleeper player data and updates headshotUrl for existing players in the database.
 * Uses db.batch() to perform updates in groups of 50 to stay under subrequest limits.
 */
adminRoutes.post('/sync-headshots', async (c) => {
  const db = c.get('db');


  try {
    const raw = await fetchSleeperPlayers();

    // Fetch all existing players once (1 subrequest)
    const existing = await db.query.nflPlayers.findMany({
      columns: { id: true, externalId: true, headshotUrl: true },
    });
    const existingMap = new Map(existing.map(p => [p.externalId, { id: p.id, headshotUrl: p.headshotUrl }]));

    let updated = 0;
    const updateStatements: any[] = [];
    const BATCH_SIZE = 50;

    for (const [sleeperId, player] of Object.entries(raw)) {
      const headshotUrl = buildHeadshotUrl(player, sleeperId);
      if (headshotUrl == null) continue;

      const existingPlayer = existingMap.get(sleeperId);
      if (existingPlayer && existingPlayer.headshotUrl !== headshotUrl) {
        updateStatements.push(
          db
            .update(schema.nflPlayers)
            .set({ headshotUrl, updatedAt: new Date() })
            .where(eq(schema.nflPlayers.id, existingPlayer.id))
        );
        updated++;

        // Flush batch when reaching size
        if (updateStatements.length >= BATCH_SIZE) {
          await db.batch(updateStatements as any);
          updateStatements.length = 0;
        }
      }
    }

    // Flush remaining statements
    if (updateStatements.length > 0) {
      await db.batch(updateStatements as any);
    }

    return c.json({
      success: true,
      message: 'Headshot sync completed',
      updated,
    });
  } catch (err) {
    console.error('Sync headshots error:', err);
    return c.json(
      {
        error: 'Sync failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/admin/sync-news
 * Derives player news from Sleeper injury/status data and upserts into player_news.
 * Creates news for players with injury_status (Out, Doubtful, Questionable, IR) or injury_notes.
 * Uses db.batch() to perform deletes and inserts in groups.
 */
adminRoutes.post('/sync-news', async (c) => {
  const db = c.get('db');


  try {
    const raw = await fetchSleeperPlayers();
    const INJURY_STATUSES = new Set(['out', 'doubtful', 'questionable', 'ir', 'injured_reserve', 'inactive', 'probable']);
    const EXCLUDED_STATUSES = new Set(['invalid']);
    let inserted = 0;

    // Fetch all players once (1 subrequest)
    const allPlayers = await db.query.nflPlayers.findMany({
      columns: { id: true, externalId: true },
    });
    const playerMap = new Map(allPlayers.map(p => [p.externalId, p.id]));

    const newsStatements: any[] = [];
    const BATCH_SIZE = 50;

    for (const [sleeperId, p] of Object.entries(raw)) {
      if (!p) continue;

      const injuryStatus = (p.injury_status || '').toLowerCase();
      const injuryNotes = (p.injury_notes || '').trim();
      const injuryBodyPart = (p.injury_body_part || '').trim();
      const status = (p.status || '').toLowerCase();

      // Skip invalid - Sleeper often returns this for non-injury cases
      if (EXCLUDED_STATUSES.has(injuryStatus) || EXCLUDED_STATUSES.has(status)) continue;

      // Include: injury status, notes, body part (e.g. "Knee" = managing something), or inactive
      const hasMeaningfulStatus =
        INJURY_STATUSES.has(injuryStatus) ||
        INJURY_STATUSES.has(status) ||
        injuryNotes.length > 0 ||
        injuryBodyPart.length > 0;

      if (!hasMeaningfulStatus) continue;

      const existingPlayerId = playerMap.get(sleeperId);
      if (!existingPlayerId) continue;

      // Skip inactive-only (no notes, no body part) - not relevant for Important Updates
      const isInactiveOnly =
        (injuryStatus === 'inactive' || status === 'inactive') &&
        injuryNotes.length === 0 &&
        injuryBodyPart.length === 0;
      if (isInactiveOnly) {
        newsStatements.push(
          db
            .delete(schema.playerNews)
            .where(
              and(
                eq(schema.playerNews.playerId, existingPlayerId),
                eq(schema.playerNews.source, 'Sleeper')
              )
            )
        );
      } else {
        const name = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Player';
        const statusLabel = injuryStatus || status || 'Update';
        const headline =
          injuryNotes.length > 0
            ? `${name} - ${statusLabel}: ${injuryNotes}`
            : injuryBodyPart.length > 0
              ? `${name} - ${statusLabel} (${injuryBodyPart})`
              : `${name} - ${statusLabel}`;
        const content =
          injuryNotes.length > 0
            ? injuryNotes
            : injuryBodyPart.length > 0
              ? `${name} is listed as ${statusLabel}, ${injuryBodyPart}.`
              : `${name} is listed as ${statusLabel}.`;

        const impactLevel =
          injuryStatus === 'out' || injuryStatus === 'ir' || status === 'injured_reserve' || status === 'ir'
            ? 'high'
            : injuryStatus === 'doubtful' || injuryStatus === 'questionable'
              ? 'medium'
              : 'low';

        const newsUpdated = (p as any).news_updated;
        const publishedAt = newsUpdated
          ? new Date(typeof newsUpdated === 'number' ? newsUpdated : parseInt(String(newsUpdated), 10) || Date.now())
          : new Date();

        newsStatements.push(
          db
            .delete(schema.playerNews)
            .where(
              and(
                eq(schema.playerNews.playerId, existingPlayerId),
                eq(schema.playerNews.source, 'Sleeper')
              )
            )
        );

        newsStatements.push(
          db.insert(schema.playerNews).values({
            id: generateId(),
            playerId: existingPlayerId,
            headline,
            content,
            source: 'Sleeper',
            sourceUrl: null,
            impactLevel,
            publishedAt,
          })
        );
        inserted++;
      }

      // Flush batch when reaching size
      if (newsStatements.length >= BATCH_SIZE) {
        await db.batch(newsStatements as any);
        newsStatements.length = 0;
      }
    }

    // Flush remaining statements
    if (newsStatements.length > 0) {
      await db.batch(newsStatements as any);
    }

    return c.json({
      success: true,
      message: 'News sync completed',
      inserted,
    });
  } catch (err) {
    console.error('Sync news error:', err);
    return c.json(
      {
        error: 'Sync failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/admin/sync-twitter-news
 * Fetches tweets from configured RSS URLs and matches to players.
 * Requires TWITTER_RSS_URLS env var (comma-separated, e.g. https://nitter.net/AdamSchefter/rss).
 */
adminRoutes.post('/sync-twitter-news', async (c) => {
  const db = c.get('db');
  const rssUrls = c.env.TWITTER_RSS_URLS;

  if (!rssUrls || !rssUrls.trim()) {
    return c.json({
      error: 'TWITTER_RSS_URLS not configured',
      message: 'Set TWITTER_RSS_URLS in wrangler.toml or secrets (comma-separated RSS URLs, e.g. https://nitter.net/AdamSchefter/rss)',
    }, 400);
  }

  try {
    const { items: tweets, diagnostics } = await fetchTwitterTweets(rssUrls);
    const allPlayers = await db.query.nflPlayers.findMany({ columns: { id: true, name: true, position: true } });
    const playersByNameLength = [...allPlayers]
      .filter((p) => p.position && p.position !== 'DEF')
      .sort((a, b) => (b.name?.length ?? 0) - (a.name?.length ?? 0));

    let inserted = 0;
    let skipped = 0;
    const seen = new Set<string>();
    const openaiKey = c.env.OPENAI_API_KEY;
    const useAi = !!openaiKey?.trim();

    // Allow longer RSS article snippets (RotoWire, PFF, etc.) - 800 chars
    const MAX_ITEM_LENGTH = 800;

    for (const tweet of tweets) {
      if (tweet.text.length > MAX_ITEM_LENGTH) continue;
      if (!tweet.url || !tweet.url.trim()) continue;

      const text = tweet.text.toLowerCase();
      const textStart = text.slice(0, 400);

      // Collect all players mentioned in this tweet
      const mentionedPlayers: { id: string; name: string }[] = [];
      for (const player of playersByNameLength) {
        const name = player.name?.trim();
        if (!name || name.length < 4) continue;
        if (!text.includes(name.toLowerCase())) continue;
        if (!textStart.includes(name.toLowerCase())) continue;
        const key = `${player.id}:${tweet.text.slice(0, 80)}`;
        if (seen.has(key)) continue;
        mentionedPlayers.push({ id: player.id, name });
      }

      if (mentionedPlayers.length === 0) continue;

      // AI filter: determine which players this news is actually relevant to
      let playersToInsert = mentionedPlayers;
      let aiSummary: string | null = null;
      let playerSummaries: Record<string, string> = {};

      if (useAi) {
        const result = await checkNewsRelevance(
          tweet.text,
          mentionedPlayers.map((p) => p.name),
          openaiKey
        );
        if (result) {
          const relevantSet = new Set(result.relevantPlayerNames.map((n) => n.trim().toLowerCase()));
          playersToInsert = mentionedPlayers.filter((p) =>
            relevantSet.has(p.name.trim().toLowerCase())
          );
          aiSummary = result.summary || null;
          playerSummaries = result.playerSummaries || {};
        }
      }

      for (const player of playersToInsert) {
        const key = `${player.id}:${tweet.text.slice(0, 80)}`;
        seen.add(key);

        // Skip if this sourceUrl + player combo already exists in the database
        const existingEntry = await db.query.playerNews.findFirst({
          where: and(
            eq(schema.playerNews.sourceUrl, tweet.url),
            eq(schema.playerNews.playerId, player.id)
          ),
          columns: { id: true },
        });
        if (existingEntry) {
          skipped++;
          continue;
        }

        // BUG-004 FIX: Use player-specific headline and AI summary so multi-player
        // tweets don't show identical text for every tagged player.
        const playerNameLower = player.name.trim().toLowerCase();
        const perPlayerSummary = playerSummaries[playerNameLower] || aiSummary;

        // Prefix headline with player name when multiple players share the same tweet,
        // so each entry is visually distinguishable in the News & Notes panel.
        const rawHeadline = playersToInsert.length > 1
          ? `${player.name}: ${tweet.text}`
          : tweet.text;
        const headline = rawHeadline.length > 150 ? rawHeadline.slice(0, 147) + '...' : rawHeadline;

        await db.insert(schema.playerNews).values({
          id: generateId(),
          playerId: player.id,
          headline,
          content: tweet.text,
          source: tweet.author || 'Twitter',
          sourceUrl: tweet.url,
          aiSummary: perPlayerSummary,
          impactLevel: 'medium',
          publishedAt: tweet.publishedAt,
        });
        inserted++;
      }
    }

    return c.json({
      success: true,
      message: 'Sports news sync completed',
      itemsFetched: tweets.length,
      inserted,
      skipped,
      diagnostics,
      aiFiltering: useAi,
    });
  } catch (err) {
    console.error('Sync twitter news error:', err);
    return c.json(
      {
        error: 'Sync failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/admin/sync-games
 * Fetches NFL games from ESPN for specified weeks and upserts into nfl_games (with weather).
 * Body: { seasonYear?: number, weeks?: number[] } - defaults to current season, weeks 1-18
 */
adminRoutes.post('/sync-games', async (c) => {
  const db = c.get('db');


  try {
    let body: { seasonYear?: number; weeks?: number[] } = {};
    try {
      const raw = await c.req.json();
      body = raw && typeof raw === 'object' ? raw : {};
    } catch {
      // No body - use defaults
    }
    const { getNflSeasonContext, fetchEspnScoreboard } = await import('../services/espn');
    const ctx = getNflSeasonContext();
    const seasonYear = body.seasonYear ?? ctx.season;
    if (seasonYear < 2000 || seasonYear > 2100) {
      return c.json({ error: 'Invalid season year' }, 400);
    }
    const weeks = body.weeks ?? Array.from({ length: 18 }, (_, i) => i + 1);
    if (!Array.isArray(weeks) || weeks.length > 22 || weeks.some(w => typeof w !== 'number' || w < 1 || w > 22)) {
      return c.json({ error: 'Invalid weeks array' }, 400);
    }
    const seasontype = body.weeks ? '2' : ctx.seasontype; // default to regular for explicit weeks

    let inserted = 0;
    let updated = 0;

    for (const week of weeks) {
      try {
        const { dbRows } = await fetchEspnScoreboard(week, seasonYear, seasontype);

        for (const row of dbRows) {
          const existing = await db.query.nflGames.findFirst({
            where: eq(schema.nflGames.id, row.id),
          });
          const hasScores = row.homeScore != null && row.awayScore != null;
          const values = {
            id: row.id,
            externalId: row.id,
            week: row.week,
            seasonYear: row.seasonYear,
            seasonType: row.seasonType,
            homeTeam: row.homeTeam,
            awayTeam: row.awayTeam,
            gameTime: row.gameTime,
            spread: row.spread,
            overUnder: row.overUnder,
            tvNetwork: row.tvNetwork,
            stadium: row.stadium,
            weather: row.weather,
            homeScore: row.homeScore ?? null,
            awayScore: row.awayScore ?? null,
            isComplete: hasScores,
          };
          if (existing) {
            if (!existing.isComplete && (existing.spread != null || existing.overUnder != null)) {
              await db.insert(schema.gameLineSnapshots).values({
                id: crypto.randomUUID(),
                gameId: row.id,
                snapshotAt: new Date(),
                spread: existing.spread ?? null,
                overUnder: existing.overUnder ?? null,
              });
            }
            await db.update(schema.nflGames).set(values).where(eq(schema.nflGames.id, row.id));
            updated++;
          } else {
            await db.insert(schema.nflGames).values(values);
            inserted++;
          }
        }
      } catch (e) {
        console.error(`Failed to sync week ${week}:`, e);
      }
    }

    return c.json({
      success: true,
      message: 'Games sync completed',
      seasonYear,
      weeks: weeks.length,
      inserted,
      updated,
    });
  } catch (err) {
    console.error('Sync games error:', err);
    return c.json(
      {
        error: 'Sync failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/admin/sync-stats
 * Fetches weekly NFL stats from Sleeper for ALL players in the database.
 * Requires X-Admin-Key header matching SYNC_SECRET env var.
 * Body: { seasonYear?: number, week?: number, weeks?: number[] }
 * - seasonYear defaults to current NFL season
 * - week: sync a single specific week
 * - weeks: sync multiple specific weeks
 * - if neither specified, defaults to week 1
 */
adminRoutes.post('/sync-stats', async (c) => {
  const db = c.get('db');


  try {
    let body: { seasonYear?: number; week?: number; weeks?: number[] } = {};
    try {
      const raw = await c.req.json();
      body = raw && typeof raw === 'object' ? raw : {};
    } catch {
      // No body or invalid JSON - use defaults
    }
    // Dynamic default: NFL season spans Sep–Feb, so Jan–Jul = previous year
    const now = new Date();
    const defaultSeason = now.getMonth() <= 6 ? now.getFullYear() - 1 : now.getFullYear();
    const seasonYear = body.seasonYear ?? defaultSeason;
    if (seasonYear < 2000 || seasonYear > 2100) {
      return c.json({ error: 'Invalid season year' }, 400);
    }

    // Determine which weeks to sync
    let weeksToSync: number[] = [];
    if (body.weeks && Array.isArray(body.weeks)) {
      weeksToSync = body.weeks.filter(w => typeof w === 'number' && w >= 1 && w <= 22);
    } else if (typeof body.week === 'number' && body.week >= 1 && body.week <= 22) {
      weeksToSync = [body.week];
    } else {
      // Default to week 1 (not all 18)
      weeksToSync = [1];
    }

    if (weeksToSync.length === 0) {
      return c.json({ error: 'No valid weeks specified' }, 400);
    }

    let statsImported = 0;
    let statsUpdated = 0;

    // Fetch all players once (1 subrequest)
    const allPlayers = await db.query.nflPlayers.findMany({
      columns: { id: true, externalId: true },
    });
    const playerMap = new Map(allPlayers.map(p => [p.externalId, p.id]));

    const statsStatements: any[] = [];
    const BATCH_SIZE = 50;

    for (const week of weeksToSync) {
      try {
        // Throttle: 150ms delay between sequential stats fetches
        if (week > weeksToSync[0]) await sleep(150);

        const statsResponse = await fetch(
          `https://api.sleeper.com/stats/nfl/${seasonYear}/${week}?season_type=regular`
        );

        if (!statsResponse.ok) {
          console.log(`No stats available for week ${week} (HTTP ${statsResponse.status})`);
          continue;
        }

        const raw = await statsResponse.json();
        const weekEntries: { sleeperPlayerId: string; playerStats: any }[] = [];

        if (Array.isArray(raw)) {
          for (const item of raw) {
            const pid = item?.player_id;
            if (!pid) continue;
            const s = item.stats || {};
            weekEntries.push({
              sleeperPlayerId: String(pid),
              playerStats: { ...s, opponent: item.opponent },
            });
          }
        } else if (raw && typeof raw === 'object') {
          for (const sleeperPlayerId of Object.keys(raw)) {
            const playerStats = (raw as Record<string, any>)[sleeperPlayerId];
            if (playerStats) weekEntries.push({ sleeperPlayerId, playerStats });
          }
        }

        for (const { sleeperPlayerId, playerStats } of weekEntries) {
          const playerId = playerMap.get(sleeperPlayerId);
          if (!playerId) continue;

          // Check if stats already exist for this week
          const existingStats = await db.query.playerWeeklyStats.findFirst({
            where: and(
              eq(schema.playerWeeklyStats.playerId, playerId),
              eq(schema.playerWeeklyStats.week, week),
              eq(schema.playerWeeklyStats.seasonYear, seasonYear)
            ),
          });

          const statsData = {
            playerId,
            week,
            seasonYear,
            opponent: playerStats.opponent || null,
            passAttempts: playerStats.pass_att || 0,
            passCompletions: playerStats.pass_cmp || 0,
            passYards: playerStats.pass_yd || 0,
            passTDs: playerStats.pass_td || 0,
            passInterceptions: playerStats.pass_int || 0,
            rushAttempts: playerStats.rush_att || 0,
            rushYards: playerStats.rush_yd || 0,
            rushTDs: playerStats.rush_td || 0,
            targets: playerStats.rec_tgt || 0,
            receptions: playerStats.rec || 0,
            receivingYards: playerStats.rec_yd || 0,
            receivingTDs: playerStats.rec_td || 0,
            fumbles: playerStats.fum || 0,
            fumblesLost: playerStats.fum_lost || 0,
            twoPointConversions: (playerStats.pass_2pt || 0) + (playerStats.rush_2pt || 0) + (playerStats.rec_2pt || 0),
            fgMade: playerStats.fgm || 0,
            fgAttempts: playerStats.fga || 0,
            fg40PlusMade: (playerStats.fgm_40_49 || 0) + (playerStats.fgm_50p || 0),
            fg50PlusMade: playerStats.fgm_50p || 0,
            xpMade: playerStats.xpm || 0,
            xpAttempts: playerStats.xpa || 0,
            offSnaps: Math.round(playerStats.off_snp || 0),
            defSnaps: Math.round(playerStats.def_snp || 0),
            stSnaps: Math.round(playerStats.st_snp || 0),
            tmOffSnaps: Math.round(playerStats.tm_off_snp || 0),
            tmDefSnaps: Math.round(playerStats.tm_def_snp || 0),
            tmStSnaps: Math.round(playerStats.tm_st_snp || 0),
            sacks: playerStats.sack || 0,
            defInterceptions: playerStats.int || 0,
            fumblesRecovered: playerStats.fum_rec || 0,
            defenseTDs: (playerStats.def_td || 0) + (playerStats.st_td || 0),
            safeties: playerStats.safe || 0,
            pointsAllowed: playerStats.pts_allow || 0,
            fantasyPointsPPR: playerStats.pts_ppr || 0,
            fantasyPointsHalf: playerStats.pts_half_ppr || 0,
            fantasyPointsStd: playerStats.pts_std || 0,
          };

          if (existingStats) {
            statsStatements.push(
              db
                .update(schema.playerWeeklyStats)
                .set(statsData)
                .where(eq(schema.playerWeeklyStats.id, existingStats.id))
            );
            statsUpdated++;
          } else {
            statsStatements.push(
              db.insert(schema.playerWeeklyStats).values({
                id: generateId(),
                ...statsData,
              })
            );
            statsImported++;
          }

          // Flush batch when reaching size
          if (statsStatements.length >= BATCH_SIZE) {
            await db.batch(statsStatements as any);
            statsStatements.length = 0;
          }
        }
      } catch (e) {
        console.error(`Failed to fetch stats for week ${week}:`, e);
      }
    }

    // Flush remaining statements
    if (statsStatements.length > 0) {
      await db.batch(statsStatements as any);
    }

    return c.json({
      success: true,
      message: 'Stats sync completed',
      seasonYear,
      weeks: weeksToSync,
      inserted: statsImported,
      updated: statsUpdated,
      total: statsImported + statsUpdated,
    });
  } catch (err) {
    console.error('Sync stats error:', err);
    return c.json(
      {
        error: 'Sync failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/admin/sync-projections
 * Fetches weekly player projections from Sleeper and upserts into player_projections.
 * Body: { seasonYear?: number, week?: number, weeks?: number[], allWeeks?: boolean, scoringFormats?: string[] }
 * Defaults to current NFL week, all 3 scoring formats.
 * Set allWeeks: true to sync all 18 regular-season weeks (used for initial data population).
 */
adminRoutes.post('/sync-projections', async (c) => {
  const db = c.get('db');


  try {
    let body: { seasonYear?: number; week?: number; weeks?: number[]; allWeeks?: boolean; scoringFormats?: string[] } = {};
    try {
      const raw = await c.req.json();
      body = raw && typeof raw === 'object' ? raw : {};
    } catch {
      // No body - use defaults
    }

    const seasonYear = body.seasonYear ?? new Date().getFullYear();
    const scoringFormats = body.scoringFormats ?? ['ppr', 'half_ppr', 'standard'];

    // Determine which weeks to sync
    let weeksToSync: number[] = [];
    if (body.allWeeks) {
      weeksToSync = Array.from({ length: 18 }, (_, i) => i + 1);
    } else if (body.weeks && Array.isArray(body.weeks)) {
      weeksToSync = body.weeks.filter(w => typeof w === 'number' && w >= 1 && w <= 22);
    } else if (body.week) {
      weeksToSync = [body.week];
    } else {
      const anyLeague = await db.query.leagues.findFirst({
        columns: { currentWeek: true },
        orderBy: (leagues, { desc }) => [desc(leagues.updatedAt)],
      });
      const currentWeek = anyLeague?.currentWeek || 1;
      weeksToSync = [currentWeek];
    }

    if (weeksToSync.length === 0) {
      return c.json({ error: 'No valid weeks specified' }, 400);
    }

    let inserted = 0;
    let updated = 0;
    const weekResults: { week: number; inserted: number; updated: number; error?: string }[] = [];

    // Pre-fetch all players with external IDs for batch lookup (shared across all weeks)
    const allPlayers = await db.query.nflPlayers.findMany({
      columns: { id: true, externalId: true },
    });
    const playerByExtId = new Map(
      allPlayers.filter(p => p.externalId).map(p => [p.externalId!, p.id])
    );

    const BATCH_SIZE = 50;

    for (const weekNum of weeksToSync) {
      let weekInserted = 0;
      let weekUpdated = 0;
      const projStatements: any[] = [];

      try {
        // Fetch projections from Sleeper for this week
        const projResponse = await fetch(
          `https://api.sleeper.com/projections/nfl/${seasonYear}/${weekNum}?season_type=regular`
        );

        if (!projResponse.ok) {
          console.error(`[sync-projections] Sleeper API returned ${projResponse.status} for week ${weekNum}`);
          weekResults.push({ week: weekNum, inserted: 0, updated: 0, error: `API returned ${projResponse.status}` });
          continue;
        }

        const projections = await projResponse.json() as Record<string, any>;

        for (const [sleeperPlayerId, playerProj] of Object.entries(projections)) {
          if (!playerProj) continue;

          const playerId = playerByExtId.get(sleeperPlayerId);
          if (!playerId) continue;

          for (const scoringFormat of scoringFormats) {
            const projectedPoints = scoringFormat === 'ppr'
              ? (playerProj.pts_ppr || 0)
              : scoringFormat === 'half_ppr'
                ? (playerProj.pts_half_ppr || 0)
                : (playerProj.pts_std || 0);

            // Skip zero-point projections (player not playing)
            if (projectedPoints === 0 && !playerProj.pass_yd && !playerProj.rush_yd && !playerProj.rec_yd) continue;

            const dbFormat = scoringFormat === 'half_ppr' ? 'half-ppr' : scoringFormat;

            const existingProj = await db.query.playerProjections.findFirst({
              where: and(
                eq(schema.playerProjections.playerId, playerId),
                eq(schema.playerProjections.week, weekNum),
                eq(schema.playerProjections.seasonYear, seasonYear),
                eq(schema.playerProjections.scoringFormat, dbFormat)
              ),
            });

            const projData = {
              playerId,
              week: weekNum,
              seasonYear,
              scoringFormat: dbFormat,
              projectedPoints,
              projPassYards: playerProj.pass_yd || null,
              projPassTDs: playerProj.pass_td || null,
              projRushYards: playerProj.rush_yd || null,
              projRushTDs: playerProj.rush_td || null,
              projReceptions: playerProj.rec || null,
              projRecYards: playerProj.rec_yd || null,
              projRecTDs: playerProj.rec_td || null,
              updatedAt: new Date(),
            };

            if (existingProj) {
              projStatements.push(
                db.update(schema.playerProjections)
                  .set(projData)
                  .where(eq(schema.playerProjections.id, existingProj.id))
              );
              weekUpdated++;
            } else {
              projStatements.push(
                db.insert(schema.playerProjections).values({
                  id: generateId(),
                  ...projData,
                })
              );
              weekInserted++;
            }

            // Flush batch when reaching size
            if (projStatements.length >= BATCH_SIZE) {
              await db.batch(projStatements as any);
              projStatements.length = 0;
            }
          }
        }

        // Flush remaining statements for this week
        if (projStatements.length > 0) {
          await db.batch(projStatements as any);
        }
      } catch (weekErr) {
        console.error(`[sync-projections] Error syncing week ${weekNum}:`, weekErr);
        weekResults.push({ week: weekNum, inserted: weekInserted, updated: weekUpdated, error: weekErr instanceof Error ? weekErr.message : 'Unknown error' });
        continue;
      }

      inserted += weekInserted;
      updated += weekUpdated;
      weekResults.push({ week: weekNum, inserted: weekInserted, updated: weekUpdated });
    }

    return c.json({
      success: true,
      message: 'Projections sync completed',
      seasonYear,
      weeks: weeksToSync,
      scoringFormats,
      inserted,
      updated,
      total: inserted + updated,
      weekResults,
    });
  } catch (err) {
    console.error('Sync projections error:', err);
    return c.json(
      {
        error: 'Sync failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      500
    );
  }
});
