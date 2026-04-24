/**
 * NFL calendar helpers — give the trade analyzer explicit directional
 * awareness of where we sit on the NFL calendar.
 *
 * The season direction (most-recently-completed vs. upcoming) is
 * derived from the CURRENT DATE rather than the TradeContext's
 * `seasonYear`, because `seasonYear` is a league-configuration anchor
 * that can go stale. The NFL calendar itself is absolute.
 */

export type SeasonPhase = 'offseason' | 'preseason' | 'regular' | 'playoffs';

export interface NflCalendarContext {
  today: string; // YYYY-MM-DD, UTC
  mostRecentCompletedSeason: number;
  upcomingSeason: number;
  /** The season currently being played, if any. null outside of regular/playoffs. */
  currentSeason: number | null;
  /** Short human phrase describing where we are on the NFL calendar. */
  phaseDescription: string;
  /** Where we sit relative to the upcoming NFL Draft. */
  draftPosition:
    | 'pre-draft' // before the late-April draft window
    | 'draft-window' // the late-April draft window itself
    | 'post-draft' // after the draft, still offseason
    | 'in-season'; // regular season or playoffs
}

/**
 * Resolve the NFL calendar's view of seasons from a given date alone.
 * Convention: the "2025 NFL season" spans Sept 2025 through the Super
 * Bowl in Feb 2026. Super Bowl falls on the first or second Sunday of
 * Feb; we use Feb 15 as a coarse cutoff so every check is deterministic.
 */
export function resolveSeasonDirectionFromDate(now: Date): {
  mostRecentCompletedSeason: number;
  upcomingSeason: number;
  currentSeason: number | null;
} {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0 = Jan
  const d = now.getUTCDate();

  // Sep–Dec: regular season of year Y.
  if (m >= 8 && m <= 11) {
    return {
      currentSeason: y,
      mostRecentCompletedSeason: y - 1,
      upcomingSeason: y + 1,
    };
  }

  // Jan through ~Feb 15: playoffs of the season that started last September.
  if (m === 0 || (m === 1 && d <= 15)) {
    return {
      currentSeason: y - 1,
      mostRecentCompletedSeason: y - 2,
      upcomingSeason: y,
    };
  }

  // Feb 16 – Aug 31: offseason between the just-completed season (y-1)
  // and the upcoming one (y).
  return {
    currentSeason: null,
    mostRecentCompletedSeason: y - 1,
    upcomingSeason: y,
  };
}

/**
 * Compute the NFL calendar position from `now`. `now` is injected so
 * deterministic callers can control it.
 */
export function getNflCalendarContext(now: Date): NflCalendarContext {
  const month = now.getUTCMonth(); // 0 = Jan
  const day = now.getUTCDate();
  const { mostRecentCompletedSeason, upcomingSeason, currentSeason } =
    resolveSeasonDirectionFromDate(now);

  let draftPosition: NflCalendarContext['draftPosition'];
  if (currentSeason !== null) {
    draftPosition = 'in-season';
  } else if (month < 3 || (month === 3 && day < 20)) {
    // Feb 16 through ~April 20: pre-draft offseason.
    draftPosition = 'pre-draft';
  } else if (month === 3 || (month === 4 && day < 5)) {
    // Late April into early May: the draft window itself.
    draftPosition = 'draft-window';
  } else {
    // May through August: post-draft offseason / preseason.
    draftPosition = 'post-draft';
  }

  let phaseDescription: string;
  switch (draftPosition) {
    case 'pre-draft':
      phaseDescription =
        `Offseason between the ${mostRecentCompletedSeason} season (complete) ` +
        `and the ${upcomingSeason} season (upcoming). The ${upcomingSeason} NFL ` +
        `Draft is upcoming (late April).`;
      break;
    case 'draft-window':
      phaseDescription =
        `${upcomingSeason} NFL Draft window — the draft is happening right ` +
        `now or just concluded. Incoming ${upcomingSeason} rookies are being ` +
        `identified but may not yet appear in our player catalog.`;
      break;
    case 'post-draft':
      phaseDescription =
        `Post-draft offseason. The ${upcomingSeason} NFL Draft has concluded; ` +
        `rookies from that class are now in the league. The ${upcomingSeason} ` +
        `regular season kicks off in September.`;
      break;
    case 'in-season':
      phaseDescription =
        `In-season for the ${currentSeason} NFL year. The most recent completed ` +
        `season is ${mostRecentCompletedSeason}.`;
      break;
  }

  return {
    today: now.toISOString().slice(0, 10),
    mostRecentCompletedSeason,
    upcomingSeason,
    currentSeason,
    phaseDescription,
    draftPosition,
  };
}

/**
 * Render the calendar context as a prompt block. Spells out directional
 * reading of "YYYY pick" labels so the AI never has to guess whether a
 * pick refers to the upcoming draft or a future unknown.
 */
export function formatNflCalendarBlock(ctx: NflCalendarContext): string {
  const lines: string[] = [];
  lines.push('--- NFL CALENDAR (directional context) ---');
  lines.push(`Today: ${ctx.today}`);
  lines.push(`Most recently completed NFL season: ${ctx.mostRecentCompletedSeason}`);
  lines.push(`Upcoming NFL season: ${ctx.upcomingSeason}`);
  if (ctx.currentSeason !== null) {
    lines.push(`Active NFL season: ${ctx.currentSeason}`);
  }
  lines.push(`Phase: ${ctx.phaseDescription}`);
  lines.push('');
  lines.push('Reading draft-pick labels in this trade:');
  lines.push(
    `  - "${ctx.upcomingSeason} pick" = the ${ctx.upcomingSeason} NFL Draft ` +
      (ctx.draftPosition === 'pre-draft' || ctx.draftPosition === 'draft-window'
        ? `(imminent — incoming rookie class).`
        : ctx.draftPosition === 'post-draft'
          ? `(already happened — those rookies are in the league now).`
          : `(the next NFL Draft, April ${ctx.upcomingSeason}).`),
  );
  lines.push(
    `  - "${ctx.upcomingSeason + 1} pick" = future draft asset, ` +
      `${ctx.upcomingSeason + 1} NFL Draft; no players attached yet, higher uncertainty.`,
  );
  lines.push(
    `  - "${ctx.mostRecentCompletedSeason} pick" = would have already been used ` +
      `in the ${ctx.mostRecentCompletedSeason} NFL Draft; treat as already-spent ` +
      `unless the trade context says otherwise.`,
  );
  return lines.join('\n');
}
