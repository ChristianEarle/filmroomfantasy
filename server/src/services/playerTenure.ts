/**
 * playerTenure — infer a player's NFL tenure (draft class + rookie status)
 * from the signals we already have: Sleeper's `yearsExp` counter and whether
 * the player shows up in our weekly-stats table for the current / previous
 * NFL season.
 *
 * The trade analyzer used to surface only raw `yearsExp` to the AI. That's
 * Sleeper's years-of-experience counter, which ticks over on the NFL
 * calendar (typically around camp). During the offseason window between
 * seasons, Sleeper may still have last year's rookies at `yearsExp = 0`
 * — identical to an incoming rookie who hasn't played yet. The AI had no
 * way to tell "drafted last April and played a full rookie year" apart
 * from "drafted this April and has never taken an NFL snap."
 *
 * Cross-referencing with our own weekly-stats table disambiguates them:
 * if the player has stats in the previous NFL season, they clearly aren't
 * an incoming rookie, regardless of what `yearsExp` says.
 */

export type RookieStatus =
  | 'incoming-rookie' // no NFL games in our data, yearsExp ≤ 0 — likely just drafted or not yet active
  | 'rookie-active'   // playing their rookie year right now (current-season stats, no prior)
  | 'sophomore'       // rookies from last year — played the previous season, at most one
  | 'veteran'         // 2+ NFL seasons of stats or yearsExp ≥ 2
  | 'unknown';        // insufficient signal

export interface PlayerTenureInfo {
  /** NFL season the player was drafted / first active, best-effort. null when unknown. */
  draftClass: number | null;
  rookieStatus: RookieStatus;
  /** Human-readable label safe to surface in the analyzer prompt. */
  tenureLabel: string;
}

export interface InferPlayerTenureArgs {
  yearsExp: number | null | undefined;
  /** True if the player has any usage/snaps in our current-season stats table. */
  playedInCurrentSeason: boolean;
  /** True if the player has any usage/snaps in our previous-season stats table. */
  playedInPreviousSeason: boolean;
  /** The NFL season year the trade context is anchored to (e.g., 2026). */
  seasonYear: number;
  /** 'offseason' | 'preseason' | 'regular' | 'playoffs' — governs interpretation. */
  seasonPhase: 'offseason' | 'preseason' | 'regular' | 'playoffs';
}

/**
 * Compute a tenure label from the available signals. Stats presence is
 * preferred over `yearsExp` because stats don't lie — if a player has
 * 2025 weekly stats, they played in 2025, regardless of how Sleeper
 * currently reports years_exp.
 */
export function inferPlayerTenure(args: InferPlayerTenureArgs): PlayerTenureInfo {
  const { yearsExp, playedInCurrentSeason, playedInPreviousSeason, seasonYear, seasonPhase } =
    args;
  const exp = typeof yearsExp === 'number' ? yearsExp : null;

  // The "anchor year" is the most recent season where stats would exist.
  // In offseason/preseason, that's the season that JUST finished
  // (seasonYear - 1 when seasonYear is the upcoming season). In regular
  // season/playoffs, it's the current season.
  const isOffseasonish = seasonPhase === 'offseason' || seasonPhase === 'preseason';
  const lastPlayedSeason = isOffseasonish ? seasonYear - 1 : seasonYear;

  // Played in the previous NFL season → not an incoming rookie, period.
  if (playedInPreviousSeason) {
    // If they ALSO played the current/most-recent season but not further back
    // AND yearsExp suggests only 1–2 years, call them a sophomore. Otherwise
    // default to veteran.
    if ((exp == null || exp <= 2) && playedInCurrentSeason) {
      // "Sophomore" — played their rookie year in (lastPlayedSeason - 1).
      const draftClass = lastPlayedSeason - 1;
      return {
        draftClass,
        rookieStatus: 'sophomore',
        tenureLabel: `Sophomore — NFL debut ${draftClass} (played rookie year last season, NOT an incoming rookie)`,
      };
    }
    // Otherwise we have prior-season presence but can't cleanly label.
    // Fall through to the yearsExp-based veteran label below.
  }

  // Has stats this season but NOT last season → likely rookie year in progress,
  // OR a practice-squad elevation / late-career callup. yearsExp disambiguates.
  if (playedInCurrentSeason && !playedInPreviousSeason) {
    if (exp != null && exp <= 0) {
      return {
        draftClass: lastPlayedSeason,
        rookieStatus: 'rookie-active',
        tenureLabel: `Rookie — NFL debut ${lastPlayedSeason} (currently in their first NFL season)`,
      };
    }
    // yearsExp ≥ 1 but no prior-season stats — veteran with a quiet prior year.
    // Fall through.
  }

  // No stats anywhere + yearsExp ≤ 0 → incoming rookie (or inactive).
  if (!playedInCurrentSeason && !playedInPreviousSeason) {
    if (exp == null || exp <= 0) {
      // In the offseason window, yearsExp = 0 most commonly means
      // "incoming draft class or undrafted rookie" — but we flag
      // the uncertainty honestly.
      return {
        draftClass: isOffseasonish ? seasonYear : lastPlayedSeason,
        rookieStatus: 'incoming-rookie',
        tenureLabel:
          `Incoming rookie — no NFL games in our data` +
          (isOffseasonish ? ` (likely ${seasonYear} draft class or undrafted rookie)` : ''),
      };
    }
    // yearsExp ≥ 1 but no stats in our DB → veteran we don't have data for.
    // Fall through.
  }

  // Fallback: use yearsExp for a coarse veteran label.
  if (exp == null) {
    return { draftClass: null, rookieStatus: 'unknown', tenureLabel: 'Tenure unknown' };
  }

  if (exp <= 0) {
    // yearsExp says rookie but we have no stats anywhere — still incoming-ish.
    return {
      draftClass: isOffseasonish ? seasonYear : lastPlayedSeason,
      rookieStatus: 'incoming-rookie',
      tenureLabel: `Incoming rookie — yearsExp 0, no NFL stats in our data`,
    };
  }

  if (exp === 1) {
    // yearsExp=1 means one NFL season in the books. That's a sophomore.
    const draftClass = lastPlayedSeason - (playedInPreviousSeason ? 1 : 0);
    return {
      draftClass,
      rookieStatus: 'sophomore',
      tenureLabel: `Sophomore — NFL debut ${draftClass} (2nd NFL season, NOT an incoming rookie)`,
    };
  }

  // Veteran path.
  const draftClass = lastPlayedSeason - exp;
  return {
    draftClass,
    rookieStatus: 'veteran',
    tenureLabel: `Veteran — NFL debut ${draftClass} (${exp + 1}${ordinalSuffix(exp + 1)} NFL season)`,
  };
}

function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}
