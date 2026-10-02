import { and, asc, eq, gt } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { syncGameOdds } from '../../services/gameOddsSync';
import { getNflState } from '../../services/nflState';
import type { IngestDb, JobHandler, JobResult } from '../types';

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

/** Time until the next sync, by how far off the nearest unstarted kickoff is (null: none left this season). */
export function oddsLinesCadence(untilKickoffMs: number | null): number {
  if (untilKickoffMs === null) return DAY;
  if (untilKickoffMs > 48 * HOUR) return 12 * HOUR;
  if (untilKickoffMs >= 6 * HOUR) return 4 * HOUR;
  return HOUR;
}

async function nextKickoffAt(db: IngestDb, season: number, now: number): Promise<number | null> {
  const game = await db.query.nflGames.findFirst({
    where: and(
      eq(schema.nflGames.seasonYear, season),
      eq(schema.nflGames.seasonType, 'regular'),
      gt(schema.nflGames.gameTime, new Date(now)),
    ),
    columns: { gameTime: true },
    orderBy: asc(schema.nflGames.gameTime),
  });
  return game ? game.gameTime.getTime() : null;
}

/** Featured lines (spreads, totals, moneyline) for every listed game: the ingest port of POST /api/admin/sync-odds. */
export const oddsLinesHandler: JobHandler = {
  kind: 'odds-lines',
  group: 'odds',
  resourceClass: 'light',
  softDeadlineMs: 60_000,

  async run(ctx): Promise<JobResult> {
    const state = await getNflState(ctx.db, new Date(ctx.now));
    // Events are matched to regular-season games, so outside the preseason
    // and regular season every Odds API call would be wasted.
    if (state.seasonType !== 'regular' && state.seasonType !== 'preseason') {
      return { status: 'skipped', nextRunAt: ctx.now + DAY, detail: { seasonType: state.seasonType } };
    }

    const apiKey = ctx.env.ODDS_API_KEY;
    if (!apiKey) throw new Error('ODDS_API_KEY not set');

    ctx.meter.countUpstream();
    const { inserted, unchanged, skipped, total, usage } = await syncGameOdds(ctx.db, {
      apiKey, season: state.season, week: state.week, now: ctx.now, signal: ctx.signal,
    });
    if (usage?.last != null) ctx.reportCredits(usage.last);

    const kickoff = await nextKickoffAt(ctx.db, state.season, ctx.now);
    return {
      status: 'ok',
      nextRunAt: ctx.now + oddsLinesCadence(kickoff === null ? null : kickoff - ctx.now),
      changed: inserted > 0,
      detail: { season: state.season, week: state.week, inserted, unchanged, skipped, total, nextKickoffAt: kickoff },
    };
  },
};
