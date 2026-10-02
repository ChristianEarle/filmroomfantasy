/**
 * League identity for synced leagues: one platform league = one `leagues`
 * row, enforced by `leagues_platform_external_unique (platform, external_id)`
 * (migration 0050).
 *
 * Before 0050 two rows could end up pointing at the same platform league.
 * /connect only matched an exact external id, so connecting last season's
 * Sleeper id while another row already held this season's created a second
 * row, and the season rollover then moved it onto the same id. Skeetsters
 * existed twice this way, each copy with its own teams and ghost rows.
 *
 * `mergeLeagueInto` folds a duplicate into the surviving row. Only the
 * memberships carry over: everything else in the duplicate (teams, rosters,
 * matchups, trades, picks, AI caches) cascades away. Callers must make the
 * survivor the row carrying prior seasons' history: the survivor's next sync
 * re-imports only the current Sleeper league, so the loser's current-season
 * data comes back but its older trades and grades would not.
 */

import { and, eq } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { generateId } from '../utils/id';

type DB = ReturnType<typeof drizzle<typeof schema>>;

export async function mergeLeagueInto(db: DB, keeperLeagueId: string, loserLeagueId: string): Promise<{ membersMoved: number }> {
  if (keeperLeagueId === loserLeagueId) return { membersMoved: 0 };

  const [keeperMembers, loserMembers] = await Promise.all([
    db.query.leagueMembers.findMany({ where: eq(schema.leagueMembers.leagueId, keeperLeagueId) }),
    db.query.leagueMembers.findMany({ where: eq(schema.leagueMembers.leagueId, loserLeagueId) }),
  ]);
  const keeperByUser = new Map(keeperMembers.map((m) => [m.userId, m]));

  let membersMoved = 0;
  for (const m of loserMembers) {
    const existing = keeperByUser.get(m.userId);
    if (!existing) {
      await db.insert(schema.leagueMembers).values({
        id: generateId(),
        userId: m.userId,
        leagueId: keeperLeagueId,
        role: m.role,
        externalUsername: m.externalUsername,
        joinedAt: m.joinedAt,
      }).onConflictDoNothing();
      membersMoved++;
      continue;
    }
    // Never lose commissioner rights or a known platform identity in the merge.
    const patch: Partial<typeof schema.leagueMembers.$inferInsert> = {};
    if (m.role === 'commissioner' && existing.role !== 'commissioner') patch.role = 'commissioner';
    if (!existing.externalUsername && m.externalUsername) patch.externalUsername = m.externalUsername;
    if (Object.keys(patch).length > 0) {
      await db.update(schema.leagueMembers)
        .set(patch)
        .where(and(eq(schema.leagueMembers.leagueId, keeperLeagueId), eq(schema.leagueMembers.userId, m.userId)));
    }
  }

  await db.delete(schema.leagues).where(eq(schema.leagues.id, loserLeagueId));
  console.log(`[league identity] merged league ${loserLeagueId} into ${keeperLeagueId} (${membersMoved} member(s) moved)`);
  return { membersMoved };
}
