/**
 * Inputs, fingerprint and prompt for the per-player AI take
 * (GET /players/:id/analysis).
 *
 * A take is cached per (player, season, week) but is no longer frozen: the
 * route fingerprints everything the prompt is built from and regenerates
 * when the fingerprint changes (a projection that moved, a new prop line,
 * a Friday practice designation, a finalized week of stats, fresh news),
 * subject to a 30-minute floor so a busy player does not re-bill on every
 * open. `describeBasis` is what the card shows under the take so the reader
 * knows which week's projection and which practice report it reflects.
 */

export interface AiTakePlayer {
  name: string;
  position: string;
  team: string;
  status: string;
  injuryNote: string | null;
  age: number | null;
  yearsExp: number | null;
  depthChartOrder: number | null;
  byeWeek: number | null;
}

export interface AiTakeProjection {
  points: number;
  low: number | null;
  high: number | null;
  /** 'props' (built from sportsbook lines) | 'sleeper' | other source tag. */
  source: string;
  scoringFormat: string;
}

export interface AiTakeProp {
  /** Market without the player_ prefix, e.g. rec_yds, anytime_td. */
  market: string;
  line: number | null;
  /** American odds on the over (or the yes for anytime TD). */
  price: number | null;
}

export interface AiTakeUsageWeek {
  week: number;
  opponent: string | null;
  targets: number | null;
  targetShare: number | null;
  airYardsShare: number | null;
  wopr: number | null;
  carries: number | null;
  recEpa: number | null;
  rushEpa: number | null;
  passEpa: number | null;
  /** Offensive snap share from the Sleeper box score, when available. */
  snapPct: number | null;
}

export interface AiTakePractice {
  reportStatus: string | null;
  practiceStatus: string | null;
  primaryInjury: string | null;
}

export interface AiTakeMatchup {
  opponent: string | null;
  home: boolean | null;
  spread: number | null;
  total: number | null;
  impliedTotal: number | null;
  kickoff: string | null;
  homeMoneyline: number | null;
  awayMoneyline: number | null;
}

export interface AiTakeEnvironment {
  roof: string | null;
  surface: string | null;
  temp: number | null;
  wind: number | null;
}

export interface AiTakeDvp {
  grade: string | null;
  label: string;
  avgAllowed: number | null;
  leagueAvg: number | null;
  ratio: number | null;
  gamesAnalyzed: number | null;
}

export interface AiTakeInputs {
  season: number;
  week: number;
  player: AiTakePlayer;
  seasonLine: string;
  lastWeeks: { week: number; opp: string | null; pts: number }[];
  latestStatsWeek: number | null;
  projection: AiTakeProjection | null;
  props: AiTakeProp[];
  usage: AiTakeUsageWeek[];
  practice: AiTakePractice | null;
  matchup: AiTakeMatchup | null;
  environment: AiTakeEnvironment | null;
  dvp: AiTakeDvp | null;
  news: string[];
}

/** Minimum age of a take before a changed fingerprint regenerates it (unless the viewer asks). */
export const REGENERATE_FLOOR_MS = 30 * 60 * 1000;

/** Stable JSON: keys sorted at every level so the same inputs always hash the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** SHA-256 hex of the canonical inputs. */
export async function fingerprintInputs(inputs: AiTakeInputs): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(inputs));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface RegenerateDecision {
  regenerate: boolean;
  reason: 'no_cached_take' | 'inputs_unchanged' | 'requested' | 'inputs_changed' | 'inputs_changed_recently';
}

/**
 * Decide whether to call the model again.
 *  - nothing cached: generate.
 *  - same fingerprint: serve the cache, even when the viewer asks (nothing new to say).
 *  - changed fingerprint: regenerate when the viewer asks or the take is
 *    older than the floor; otherwise serve the cache and flag it stale.
 * Rows from before fingerprints existed (null hash) count as changed.
 */
export function shouldRegenerate(args: {
  cached: { inputsHash: string | null; updatedAt: Date | null; createdAt: Date } | null;
  hash: string;
  now: Date;
  refresh: boolean;
}): RegenerateDecision {
  const { cached, hash, now, refresh } = args;
  if (!cached) return { regenerate: true, reason: 'no_cached_take' };
  if (cached.inputsHash === hash) return { regenerate: false, reason: 'inputs_unchanged' };
  if (refresh) return { regenerate: true, reason: 'requested' };
  const generatedAt = cached.updatedAt ?? cached.createdAt;
  if (now.getTime() - generatedAt.getTime() >= REGENERATE_FLOOR_MS) {
    return { regenerate: true, reason: 'inputs_changed' };
  }
  return { regenerate: false, reason: 'inputs_changed_recently' };
}

const PRACTICE_SHORT: Record<string, string> = {
  'Full Participation in Practice': 'full practice',
  'Limited Participation in Practice': 'limited practice',
  'Did Not Participate In Practice': 'DNP',
};

function shortPractice(status: string | null): string | null {
  if (!status) return null;
  return PRACTICE_SHORT[status] ?? status;
}

/** One line for the card: which inputs this take reflects. */
export function describeBasis(inputs: AiTakeInputs): string {
  const parts: string[] = [];
  if (inputs.projection) {
    parts.push(`Week ${inputs.week} projection ${inputs.projection.points.toFixed(1)} (${inputs.projection.source === 'props' ? 'from prop lines' : inputs.projection.source})`);
  } else {
    parts.push(`no Week ${inputs.week} projection yet`);
  }
  if (inputs.props.length > 0) parts.push(`${inputs.props.length} prop line${inputs.props.length === 1 ? '' : 's'}`);
  parts.push(inputs.latestStatsWeek != null ? `stats through Week ${inputs.latestStatsWeek}` : 'no games played yet');
  if (inputs.practice) {
    const bits = [inputs.practice.reportStatus, shortPractice(inputs.practice.practiceStatus)].filter(Boolean);
    if (bits.length > 0) parts.push(`practice report: ${bits.join(', ')}`);
  }
  if (inputs.dvp?.grade && inputs.matchup?.opponent) parts.push(`${inputs.matchup.opponent} matchup ${inputs.dvp.grade}`);
  return parts.join(' · ');
}

const MARKET_LABELS: Record<string, string> = {
  pass_yds: 'pass yds', pass_tds: 'pass TDs', pass_attempts: 'pass att', pass_completions: 'completions',
  pass_interceptions: 'INT', rush_yds: 'rush yds', rush_tds: 'rush TDs', rush_attempts: 'carries',
  reception_yds: 'rec yds', receptions: 'receptions', reception_tds: 'rec TDs', anytime_td: 'anytime TD',
};

function fmtSigned(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`;
}

function fmtOdds(price: number | null): string {
  if (price == null) return '';
  return ` (${price > 0 ? '+' : ''}${price})`;
}

function pct(value: number | null): string {
  return value == null ? '—' : `${Math.round(value * 100)}%`;
}

function num(value: number | null, digits = 1): string {
  return value == null ? '—' : value.toFixed(digits);
}

/**
 * The user turn of the prompt. Free text ingested from news is sanitized by
 * the caller; everything else here is our own numbers.
 */
export function buildDataBlock(inputs: AiTakeInputs): string {
  const p = inputs.player;
  const bio = [
    `${p.position} | Team: ${p.team}`,
    p.age != null ? `Age: ${p.age}` : null,
    p.yearsExp != null ? `Exp: ${p.yearsExp}y` : null,
    p.depthChartOrder != null ? `Depth chart: ${p.position}${p.depthChartOrder}` : null,
    p.byeWeek != null ? `Bye: Week ${p.byeWeek}` : null,
  ].filter(Boolean).join(' | ');

  const lastWeeks = inputs.lastWeeks.length > 0
    ? inputs.lastWeeks.map((w) => `Wk${w.week}${w.opp ? ` ${w.opp}` : ''}: ${w.pts.toFixed(1)} PPR`).join(' | ')
    : '(no finalized weeks yet)';

  const projection = inputs.projection
    ? `${inputs.projection.points.toFixed(1)} PPR pts (${inputs.projection.source === 'props' ? 'derived from sportsbook prop lines' : `source: ${inputs.projection.source}`}${inputs.projection.low != null && inputs.projection.high != null ? `, range ${inputs.projection.low.toFixed(1)}-${inputs.projection.high.toFixed(1)}` : ''})`
    : '(none available)';

  const props = inputs.props.length > 0
    ? inputs.props.map((pr) => {
        const label = MARKET_LABELS[pr.market] ?? pr.market.replace(/_/g, ' ');
        return pr.market === 'anytime_td' ? `anytime TD${fmtOdds(pr.price)}` : `${label} O/U ${pr.line ?? '—'}${fmtOdds(pr.price)}`;
      }).join(', ')
    : '(no prop lines posted yet)';

  const usage = inputs.usage.length > 0
    ? inputs.usage.map((u) => {
        const bits: string[] = [];
        if (p.position === 'QB') {
          bits.push(`pass EPA ${num(u.passEpa)}`);
          if (u.carries != null) bits.push(`${u.carries} carries`);
        } else if (p.position === 'RB') {
          bits.push(`${u.carries ?? 0} carries`, `${u.targets ?? 0} tgt (${pct(u.targetShare)} share)`, `rush EPA ${num(u.rushEpa)}`);
        } else {
          bits.push(`${u.targets ?? 0} tgt (${pct(u.targetShare)} share)`, `air-yards share ${pct(u.airYardsShare)}`, `WOPR ${num(u.wopr, 2)}`, `rec EPA ${num(u.recEpa)}`);
        }
        if (u.snapPct != null) bits.push(`${Math.round(u.snapPct)}% snaps`);
        return `Wk${u.week}${u.opponent ? ` ${u.opponent}` : ''}: ${bits.join(', ')}`;
      }).join('\n')
    : '(no usage data yet)';

  const practice = inputs.practice
    ? [
        inputs.practice.reportStatus ? `game status ${inputs.practice.reportStatus}` : 'no game-status designation',
        inputs.practice.practiceStatus ? shortPractice(inputs.practice.practiceStatus) : null,
        inputs.practice.primaryInjury ? `(${inputs.practice.primaryInjury})` : null,
      ].filter(Boolean).join(', ')
    : '(not on this week\'s report)';

  const m = inputs.matchup;
  const matchupLine = m?.opponent
    ? `Week ${inputs.week} ${m.home ? 'vs' : 'at'} ${m.opponent}${m.kickoff ? ` (${m.kickoff})` : ''}`
    : 'No game found for this week.';

  let vegas = 'No Vegas line available.';
  if (m && (m.spread != null || m.total != null || m.homeMoneyline != null)) {
    vegas = [
      m.spread != null ? `${p.team} spread ${m.spread > 0 ? '+' : ''}${m.spread}` : null,
      m.total != null ? `game total ${m.total}` : null,
      m.impliedTotal != null ? `implied ${p.team} team total ${m.impliedTotal}` : null,
      m.homeMoneyline != null && m.awayMoneyline != null
        ? `moneyline ${fmtSigned(m.home ? m.homeMoneyline : m.awayMoneyline)}`
        : null,
    ].filter(Boolean).join(', ');
  }

  const env = inputs.environment;
  const environment = env && (env.roof || env.surface || env.temp != null || env.wind != null)
    ? [
        env.roof ? (env.roof === 'outdoors' ? 'outdoors' : `${env.roof} roof`) : null,
        env.surface ?? null,
        env.temp != null ? `${env.temp}°F` : null,
        env.wind != null ? `wind ${env.wind} mph` : null,
      ].filter(Boolean).join(', ')
    : '(unknown)';

  const dvp = inputs.dvp?.grade
    ? `${inputs.dvp.grade} (${inputs.dvp.label}) — ${m?.opponent ?? 'opponent'} allows ${num(inputs.dvp.avgAllowed)} PPR pts/game to ${p.position}s over its last ${inputs.dvp.gamesAnalyzed ?? '?'} games vs league avg ${num(inputs.dvp.leagueAvg)}`
    : '(no defense-vs-position sample yet)';

  const news = inputs.news.length > 0 ? inputs.news.map((h) => `- ${h}`).join('\n') : '(no recent news)';

  return `PLAYER DATA (season ${inputs.season}, week ${inputs.week}):
Name: ${p.name}
${bio}
Status: ${p.status || 'active'}${p.injuryNote ? ` — ${p.injuryNote}` : ''}
Practice report this week: ${practice}

Season to date: ${inputs.seasonLine}
Last weeks: ${lastWeeks}
Recent usage:
${usage}

This week's projection: ${projection}
Prop lines: ${props}
Matchup: ${matchupLine}
Defense vs ${p.position}: ${dvp}
Vegas: ${vegas}
Game environment: ${environment}

Recent news headlines:
${news}`;
}
