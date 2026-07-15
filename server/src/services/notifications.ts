import { drizzle } from 'drizzle-orm/d1';
import { desc, eq, gte, inArray } from 'drizzle-orm';
import * as schema from '../db/schema';
import { generateId } from '../utils/id';

type DB = ReturnType<typeof drizzle<typeof schema>>;

/** How far back to scan player_news on each run. */
const NEWS_LOOKBACK_MS = 24 * 60 * 60 * 1000;
/** Upper bound on news rows scanned per run. */
const MAX_NEWS_ITEMS = 400;
/** Safety valve: never insert more than this many notification rows per run. */
const MAX_NOTIFICATION_ROWS = 5000;
/** D1 caps bound parameters per statement (~100); notifications have 10 columns. */
const INSERT_CHUNK_ROWS = 9;
/** Statements per db.batch() call. */
const BATCH_SIZE = 20;
/** Chunk size for IN (...) lookups. */
const IN_CHUNK = 50;

/**
 * Keyword screen for RSS/ESPN/Rotowire headlines (those all land with
 * impactLevel 'medium', so the level alone carries no injury signal).
 * Sleeper-sourced news is injury-derived by construction and is instead
 * filtered on impactLevel below.
 */
const INJURY_RE =
  /injur|ruled out|questionable|doubtful|hamstring|ankle|knee|concussion|achilles|surgery|groin|shoulder|\bcalf\b|\bquad\b|carted|injured reserve|\bIR\b|\bACL\b|\bMCL\b|\bPUP\b|placed on reserve|limited practice|did not practice|\bDNP\b|out for the season|out indefinitely|week-to-week|day-to-day/i;

type NewsRow = {
  id: string;
  playerId: string;
  headline: string;
  content: string;
  aiSummary: string | null;
  impactLevel: string | null;
  source: string | null;
  publishedAt: Date;
};

function isInjuryRelevant(item: NewsRow): boolean {
  if (item.source === 'Sleeper') {
    // Sleeper rows are always injury/status-derived; drop the low-signal ones.
    return item.impactLevel === 'high' || item.impactLevel === 'medium';
  }
  if (item.impactLevel === 'high') return true;
  return INJURY_RE.test(item.headline) || INJURY_RE.test(item.content);
}

/** Mirrors src/utils/slug.ts so server-built links match frontend routes. */
function slugifyName(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export interface InjuryNotificationResult {
  scannedNews: number;
  relevantNews: number;
  recipients: number;
  attempted: number;
}

/**
 * Fan recent injury-relevant player news out to in-app notifications for every
 * user who either rosters the player (their own team, resolved the same way as
 * /rosters/:leagueId/mine) or has the player on their watchlist.
 *
 * Idempotent: each row carries a deterministic dedupeKey and inserts use
 * ON CONFLICT DO NOTHING against the (user_id, dedupe_key) unique index, so
 * re-running after a partial failure (or overlapping cron runs) never
 * duplicates notifications. RSS-sourced news has stable row ids, so those use
 * `news:<newsItemId>`. Sleeper-derived injury rows are deleted + re-inserted
 * with fresh ids on every sync, so those key on the stable
 * (playerId, publishedAt) pair instead.
 *
 * All lookups are batched (chunked IN queries) — no per-item or per-user
 * round trips.
 */
export async function generateInjuryNewsNotifications(db: DB): Promise<InjuryNotificationResult> {
  const cutoff = new Date(Date.now() - NEWS_LOOKBACK_MS);

  const recentNews: NewsRow[] = await db
    .select({
      id: schema.playerNews.id,
      playerId: schema.playerNews.playerId,
      headline: schema.playerNews.headline,
      content: schema.playerNews.content,
      aiSummary: schema.playerNews.aiSummary,
      impactLevel: schema.playerNews.impactLevel,
      source: schema.playerNews.source,
      publishedAt: schema.playerNews.publishedAt,
    })
    .from(schema.playerNews)
    .where(gte(schema.playerNews.publishedAt, cutoff))
    .orderBy(desc(schema.playerNews.publishedAt))
    .limit(MAX_NEWS_ITEMS);

  const relevant = recentNews.filter(isInjuryRelevant);
  if (relevant.length === 0) {
    return { scannedNews: recentNews.length, relevantNews: 0, recipients: 0, attempted: 0 };
  }

  // Keep only the freshest relevant item per player per run to avoid stacking
  // near-duplicate alerts from multiple sources in the same window.
  const byPlayer = new Map<string, NewsRow>();
  for (const item of relevant) {
    if (!byPlayer.has(item.playerId)) byPlayer.set(item.playerId, item);
  }
  const items = [...byPlayer.values()];
  const playerIds = [...byPlayer.keys()];

  // --- Recipients, batched ---

  // (a) Watchlisters of the affected players.
  const watchRows: { userId: string; playerId: string }[] = [];
  for (const ids of chunk(playerIds, IN_CHUNK)) {
    const rows = await db
      .select({
        userId: schema.userPlayerWatchlist.userId,
        playerId: schema.userPlayerWatchlist.playerId,
      })
      .from(schema.userPlayerWatchlist)
      .where(inArray(schema.userPlayerWatchlist.playerId, ids));
    watchRows.push(...rows);
  }

  // (b) Users who roster the affected players on their own team. Team → user
  // resolution mirrors routes/rosters.ts: prefer the platform identity match
  // (league_members.externalUsername === teams.externalOwnerId); for custom
  // leagues without external sync, fall back to teams.ownerId. Never use the
  // ownerId fallback for synced teams — the league importer owns every team
  // row there, which would notify them for the whole league.
  const rosterRows: {
    playerId: string;
    leagueId: string;
    externalOwnerId: string | null;
    ownerId: string;
  }[] = [];
  for (const ids of chunk(playerIds, IN_CHUNK)) {
    const rows = await db
      .select({
        playerId: schema.rosterSpots.playerId,
        leagueId: schema.teams.leagueId,
        externalOwnerId: schema.teams.externalOwnerId,
        ownerId: schema.teams.ownerId,
      })
      .from(schema.rosterSpots)
      .innerJoin(schema.teams, eq(schema.rosterSpots.teamId, schema.teams.id))
      .where(inArray(schema.rosterSpots.playerId, ids));
    rosterRows.push(...rows);
  }

  const leagueIds = [...new Set(rosterRows.map((r) => r.leagueId))];
  const memberships: { userId: string; leagueId: string; externalUsername: string | null }[] = [];
  for (const ids of chunk(leagueIds, IN_CHUNK)) {
    const rows = await db
      .select({
        userId: schema.leagueMembers.userId,
        leagueId: schema.leagueMembers.leagueId,
        externalUsername: schema.leagueMembers.externalUsername,
      })
      .from(schema.leagueMembers)
      .where(inArray(schema.leagueMembers.leagueId, ids));
    memberships.push(...rows);
  }

  const membersByLeague = new Map<string, typeof memberships>();
  for (const m of memberships) {
    const list = membersByLeague.get(m.leagueId);
    if (list) list.push(m);
    else membersByLeague.set(m.leagueId, [m]);
  }

  // playerId → set of userIds to notify
  const recipientsByPlayer = new Map<string, Set<string>>();
  const addRecipient = (playerId: string, userId: string) => {
    let set = recipientsByPlayer.get(playerId);
    if (!set) {
      set = new Set();
      recipientsByPlayer.set(playerId, set);
    }
    set.add(userId);
  };

  for (const w of watchRows) addRecipient(w.playerId, w.userId);
  for (const r of rosterRows) {
    const members = membersByLeague.get(r.leagueId);
    if (!members) continue;
    if (r.externalOwnerId) {
      for (const m of members) {
        if (m.externalUsername && m.externalUsername === r.externalOwnerId) {
          addRecipient(r.playerId, m.userId);
        }
      }
    } else {
      for (const m of members) {
        if (m.userId === r.ownerId) addRecipient(r.playerId, m.userId);
      }
    }
  }

  // Player names for profile links (/players/{slug}-{id}).
  const nameById = new Map<string, string>();
  for (const ids of chunk(playerIds, IN_CHUNK)) {
    const rows = await db
      .select({ id: schema.nflPlayers.id, name: schema.nflPlayers.name })
      .from(schema.nflPlayers)
      .where(inArray(schema.nflPlayers.id, ids));
    for (const row of rows) nameById.set(row.id, row.name);
  }

  // --- Build rows ---
  const seen = new Set<string>(); // in-memory (userId, dedupeKey) dedupe
  const rows: schema.NewNotification[] = [];
  let recipients = 0;

  for (const item of items) {
    const users = recipientsByPlayer.get(item.playerId);
    if (!users || users.size === 0) continue;

    const dedupeKey =
      item.source === 'Sleeper'
        ? `news:sleeper:${item.playerId}:${item.publishedAt.getTime()}`
        : `news:${item.id}`;
    const name = nameById.get(item.playerId);
    const link = name ? `/players/${slugifyName(name)}-${item.playerId}` : null;
    const body = truncate(item.aiSummary || item.content, 240);

    for (const userId of users) {
      const key = `${userId}|${dedupeKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      recipients++;
      rows.push({
        id: generateId(),
        userId,
        type: 'injury',
        title: truncate(item.headline, 140),
        body,
        playerId: item.playerId,
        link,
        dedupeKey,
        isRead: false,
        createdAt: new Date(),
      });
      if (rows.length >= MAX_NOTIFICATION_ROWS) break;
    }
    if (rows.length >= MAX_NOTIFICATION_ROWS) break;
  }

  if (rows.length === 0) {
    return { scannedNews: recentNews.length, relevantNews: items.length, recipients: 0, attempted: 0 };
  }

  // Insert in chunks; the unique (user_id, dedupe_key) index + DO NOTHING makes
  // this idempotent across runs.
  const statements = chunk(rows, INSERT_CHUNK_ROWS).map((group) =>
    db.insert(schema.notifications).values(group).onConflictDoNothing(),
  );
  for (const group of chunk(statements, BATCH_SIZE)) {
    // Same cast convention as routes/admin.ts — drizzle's batch() wants a
    // non-empty tuple type that a runtime-built array can't express.
    await db.batch(group as any);
  }

  return {
    scannedNews: recentNews.length,
    relevantNews: items.length,
    recipients,
    attempted: rows.length,
  };
}
