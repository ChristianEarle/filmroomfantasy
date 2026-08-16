import { normalizePlayerName } from '../utils/playerNames';

// Weekly NFL practice-participation reports, sourced from nflverse's free
// public injuries dataset (https://github.com/nflverse/nflverse-data). The
// file accumulates one row per player per team per week for the season;
// each row's `practice_status` reflects that week's rolled-up Wed–Fri
// participation (Did Not Participate / Limited / Full).
const nflverseInjuriesUrl = (season: number) =>
  `https://github.com/nflverse/nflverse-data/releases/download/injuries/injuries_${season}.csv`;

// nflverse team abbreviations that differ from the ones used elsewhere in this app.
const TEAM_ALIASES: Record<string, string> = { LA: 'LAR' };

function normalizeTeamAbbrev(team: string): string {
  return TEAM_ALIASES[team] ?? team;
}

const PRACTICE_STATUS_MAP: Record<string, 'DNP' | 'Limited' | 'Full'> = {
  'did not participate in practice': 'DNP',
  'limited participation in practice': 'Limited',
  'full participation in practice': 'Full',
};

function normalizePracticeStatus(raw: string): 'DNP' | 'Limited' | 'Full' | null {
  return PRACTICE_STATUS_MAP[raw.trim().toLowerCase()] ?? null;
}

/** Minimal CSV parser handling quoted fields with embedded commas/quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || r[0] !== '');
}

export interface PracticeReportRow {
  /** Normalized-name + team key, ready to look up against our players table. */
  matchKey: string;
  team: string;
  week: number;
  fullName: string;
  practiceStatus: 'DNP' | 'Limited' | 'Full' | null;
}

/**
 * Fetch nflverse's injuries CSV for a season and reduce it to each player's
 * most recent week's practice-participation status. Returns null when the
 * season's file doesn't exist yet (e.g. before the first injury report of
 * a new season is published) so callers can treat that as "nothing to sync"
 * rather than an error.
 */
export async function fetchLatestPracticeReports(season: number): Promise<PracticeReportRow[] | null> {
  const res = await fetch(nflverseInjuriesUrl(season));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`nflverse injuries fetch failed: ${res.status}`);

  const text = await res.text();
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const teamCol = header.indexOf('team');
  const weekCol = header.indexOf('week');
  const nameCol = header.indexOf('full_name');
  const practiceCol = header.indexOf('practice_status');
  if (teamCol < 0 || weekCol < 0 || nameCol < 0 || practiceCol < 0) {
    throw new Error('nflverse injuries CSV: unexpected column layout');
  }

  // Keep only each player's latest week — the file accumulates one row per week.
  const latestByKey = new Map<string, PracticeReportRow>();
  for (const r of rows) {
    if (r.length <= Math.max(teamCol, weekCol, nameCol, practiceCol)) continue;
    const week = parseInt(r[weekCol], 10);
    const fullName = r[nameCol];
    const team = normalizeTeamAbbrev(r[teamCol]);
    if (!fullName || !team || isNaN(week)) continue;

    const matchKey = `${normalizePlayerName(fullName)}|${team}`;
    const existing = latestByKey.get(matchKey);
    if (!existing || week > existing.week) {
      latestByKey.set(matchKey, {
        matchKey,
        team,
        week,
        fullName,
        practiceStatus: normalizePracticeStatus(r[practiceCol] || ''),
      });
    }
  }
  return [...latestByKey.values()];
}
