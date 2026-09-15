/**
 * Detect which players a free-text fantasy football question (plus recent
 * conversation history) is talking about, so Ask AI v2 can pre-fetch their
 * player cards into the user turn without waiting on a tool round-trip.
 *
 * `extractMentionedPlayers` is pure (no DB) so it's cheap to unit test;
 * `findPlayersByNameLoose` is the DB-backed counterpart used by the
 * `lookup_player` tool handler when the model asks about someone who isn't
 * one of the pre-fetched candidates.
 */
import { like } from 'drizzle-orm';
import * as schema from '../db/schema';

export interface MentionCandidate {
  id: string;
  name: string;
  position?: string;
  team?: string;
}

interface ConversationTurnLike {
  role: string;
  content: string;
}

/**
 * Common fantasy-football nicknames/initialisms mapped to the player's full
 * name (lowercase). Not exhaustive — just frequent enough that a board/
 * history-scoped candidate lookup resolves them without a tool call.
 */
export const PLAYER_ALIASES: Record<string, string> = {
  cmc: 'christian mccaffrey',
  cmac: 'christian mccaffrey',
  jsn: 'jaxon smith-njigba',
  arsb: 'amon-ra st. brown',
  amonra: 'amon-ra st. brown',
  bijan: 'bijan robinson',
  kelce: 'travis kelce',
  dak: 'dak prescott',
  ceedee: 'ceedee lamb',
  jt: 'jonathan taylor',
  puka: 'puka nacua',
  nico: 'nico collins',
  saquon: 'saquon barkley',
  lamar: 'lamar jackson',
  jefferson: 'justin jefferson',
  chase: "ja'marr chase",
  jamarr: "ja'marr chase",
  gibbs: 'jahmyr gibbs',
  jahmyr: 'jahmyr gibbs',
  breece: 'breece hall',
  ajb: 'a.j. brown',
  dk: 'dk metcalf',
  deebo: 'deebo samuel',
  waddle: 'jaylen waddle',
  jaylen: 'jaylen waddle',
  olave: 'chris olave',
  davante: 'davante adams',
  tyreek: 'tyreek hill',
  cook: 'dalvin cook',
  kamara: 'alvin kamara',
  zeke: 'ezekiel elliott',
  hop: 'deandre hopkins',
  mahomes: 'patrick mahomes',
  tua: 'tua tagovailoa',
  burrow: 'joe burrow',
  jacobs: 'josh jacobs',
  henry: 'derrick henry',
  amari: 'amari cooper',
  swift: "d'andre swift",
  pacheco: 'isiah pacheco',
  aj: 'a.j. brown',
};

const MAX_MENTIONS = 6;
const FUZZY_THRESHOLD = 0.8;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s'.-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(s: string): string[] {
  return normalize(s).split(/[\s'.-]+/).filter(Boolean);
}

/**
 * Token-overlap ratio in [0, 1] (Dice coefficient: 2x shared tokens over the
 * combined token count of both sides). Dice rather than a max-normalized
 * ratio so a short extra word — a suffix like "Jr", a stray title — doesn't
 * sink an otherwise-exact name below the threshold, while a single common
 * token (e.g. a shared surname) still isn't enough on its own to match.
 */
function tokenOverlapScore(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const setB = new Set(tb);
  const shared = ta.filter((t) => setB.has(t)).length;
  return (2 * shared) / (ta.length + tb.length);
}

/** Capitalized 1-3 word spans, e.g. "Christian McCaffrey", "A.J. Brown", "CeeDee". */
const CAPITALIZED_SPAN_RE = /\b([A-Z][a-zA-Z'.]*(?:\s+(?:[A-Z][a-zA-Z'.]*|[A-Z]{2,}))?(?:\s+(?:[A-Z][a-zA-Z'.]*|[A-Z]{2,}))?)\b/g;

/**
 * Find players mentioned in `question` (or, failing that, recent `history`)
 * among `candidates` (the current board + anyone already named in history).
 * Resolution order per span: alias table -> exact name match -> unique
 * last-name match -> fuzzy token overlap >= 0.8. Returns at most 6 matches,
 * deduped, question mentions ranked ahead of history mentions.
 */
export function extractMentionedPlayers(
  question: string,
  history: ConversationTurnLike[],
  candidates: MentionCandidate[],
): MentionCandidate[] {
  if (!question && (!history || history.length === 0)) return [];
  if (candidates.length === 0) return [];

  const byExactName = new Map<string, MentionCandidate>();
  const byLastName = new Map<string, MentionCandidate[]>();
  for (const c of candidates) {
    byExactName.set(normalize(c.name), c);
    const parts = tokenize(c.name);
    const last = parts[parts.length - 1];
    if (last) {
      const list = byLastName.get(last);
      if (list) list.push(c);
      else byLastName.set(last, [c]);
    }
  }

  function resolveSpan(span: string): MentionCandidate | null {
    const norm = normalize(span);
    if (!norm) return null;

    // Alias table (single-token nicknames like "cmc", "puka").
    const aliasTarget = PLAYER_ALIASES[norm.replace(/\s+/g, '')] ?? PLAYER_ALIASES[norm];
    if (aliasTarget) {
      const direct = byExactName.get(aliasTarget);
      if (direct) return direct;
      // Alias resolved to a full name not on the board — fuzzy-match it in.
      let best: { c: MentionCandidate; score: number } | null = null;
      for (const c of candidates) {
        const score = tokenOverlapScore(aliasTarget, c.name);
        if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) best = { c, score };
      }
      if (best) return best.c;
    }

    // Exact full-name match.
    const exact = byExactName.get(norm);
    if (exact) return exact;

    // Unique last-name match (single-word span only).
    const tokens = tokenize(span);
    if (tokens.length === 1) {
      const matches = byLastName.get(tokens[0]);
      if (matches && matches.length === 1) return matches[0];
    }

    // Fuzzy token-overlap fallback.
    let best: { c: MentionCandidate; score: number } | null = null;
    for (const c of candidates) {
      const score = tokenOverlapScore(span, c.name);
      if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) best = { c, score };
    }
    return best?.c ?? null;
  }

  function spansFrom(text: string): string[] {
    if (!text) return [];
    const spans: string[] = [];
    // Word-level scan so single-token aliases (lowercase, e.g. "cmc") match too.
    for (const word of text.split(/\s+/)) {
      const cleaned = word.replace(/^[^a-zA-Z]+|[^a-zA-Z.]+$/g, '');
      if (cleaned) spans.push(cleaned);
    }
    // Multi-word capitalized spans (proper names).
    const matches = text.match(CAPITALIZED_SPAN_RE);
    if (matches) spans.push(...matches);
    return spans;
  }

  const seen = new Set<string>();
  const result: MentionCandidate[] = [];

  function collect(text: string) {
    for (const span of spansFrom(text)) {
      if (result.length >= MAX_MENTIONS) return;
      const match = resolveSpan(span);
      if (match && !seen.has(match.id)) {
        seen.add(match.id);
        result.push(match);
      }
    }
  }

  collect(question || '');
  if (result.length < MAX_MENTIONS) {
    // Most recent turns first — they're more likely relevant to a follow-up.
    for (const turn of [...(history || [])].reverse()) {
      if (result.length >= MAX_MENTIONS) break;
      collect(turn.content || '');
    }
  }

  return result.slice(0, MAX_MENTIONS);
}

type DrizzleD1 = ReturnType<typeof import('drizzle-orm/d1').drizzle<typeof schema>>;

/**
 * DB-backed loose name lookup for the `lookup_player` tool handler — mirrors
 * the search-input sanitization used by GET /players (players.ts): strip
 * non-name characters, escape LIKE wildcards, require 2+ chars.
 */
export async function findPlayersByNameLoose(db: DrizzleD1, text: string, limit = 10) {
  const sanitized = (text || '').replace(/[^a-zA-Z\s\-'.]/g, '').trim();
  if (sanitized.length < 2) return [];
  const escaped = sanitized.replace(/%/g, '\\%').replace(/_/g, '\\_');
  const rows = await db.query.nflPlayers.findMany({
    where: like(schema.nflPlayers.name, `%${escaped}%`),
    limit,
  });
  return rows;
}
