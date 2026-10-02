#!/usr/bin/env node
/**
 * Local-only dev fixture: creates a fantasy league with 6 teams, rosters,
 * 9 completed weeks of stats, and a remaining schedule against your local D1
 * (wrangler dev --local). Uses the real /auth/register + /auth/login
 * endpoints for the test user — no auth code changes, no bypass.
 *
 * Prereqs: `npm run db:migrate && npm run db:seed` (for player fixtures),
 * then `npm run dev` running in another terminal.
 *
 * Usage: node scripts/seed-dev-league.mjs
 */

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const API_BASE = process.env.DEV_API_BASE || 'http://localhost:8787/api';
const TEST_EMAIL = 'devtest@filmroom.local';
const TEST_PASSWORD = 'DevTest1234!';
const TEST_USERNAME = 'devtestuser';
const SEASON_YEAR = 2025;
const REGULAR_SEASON_WEEKS = 14;
const CURRENT_WEEK = 10; // weeks 1-9 complete, 10-14 remaining
const PLAYOFF_TEAMS = 4;

async function registerOrLogin() {
  const register = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, username: TEST_USERNAME }),
  });
  if (register.ok) {
    const data = await register.json();
    return data.user.id;
  }
  // Already exists — log in to get the user id instead.
  const login = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  if (!login.ok) throw new Error(`Could not register or log in test user: ${await login.text()}`);
  const data = await login.json();
  return data.user.id;
}

const TEAM_DEFS = [
  { name: 'Gridiron Gurus', owner: 'sleeper_gurus', wins: 7, losses: 2, pf: 1250.5, pa: 1080.2, weak: 'WR', isUser: true },
  { name: 'Blitz Kings', owner: 'sleeper_blitz', wins: 6, losses: 3, pf: 1190.3, pa: 1120.7, weak: 'TE' },
  { name: 'End Zone Elites', owner: 'sleeper_endzone', wins: 5, losses: 4, pf: 1140.8, pa: 1130.4, weak: 'RB' },
  { name: 'Fumble Farmers', owner: 'sleeper_fumble', wins: 4, losses: 5, pf: 1095.6, pa: 1150.9, weak: 'QB' },
  { name: 'Sack Attack', owner: 'sleeper_sack', wins: 3, losses: 6, pf: 1040.2, pa: 1200.3, weak: 'WR' },
  { name: 'Hail Mary Heroes', owner: 'sleeper_hailmary', wins: 2, losses: 7, pf: 980.7, pa: 1230.6, weak: 'DEF' },
];

// One starter per graded position, drawn from the real seed.sql player fixtures.
const ROSTER_SLOTS = [
  { pos: 'QB', ids: ['qb-001', 'qb-002', 'qb-003', 'qb-004', 'qb-005', 'qb-006'] },
  { pos: 'RB', ids: ['rb-001', 'rb-002', 'rb-003', 'rb-004', 'rb-005', 'rb-006'] },
  { pos: 'RB2', ids: ['rb-007', 'rb-008', 'rb-009', 'rb-010', 'rb-011', 'rb-012'] },
  { pos: 'WR', ids: ['wr-001', 'wr-002', 'wr-003', 'wr-004', 'wr-005', 'wr-006'] },
  { pos: 'WR2', ids: ['wr-007', 'wr-008', 'wr-009', 'wr-010', 'wr-011', 'wr-012'] },
  { pos: 'TE', ids: ['te-001', 'te-002', 'te-003', 'te-004', 'te-005', 'te-006'] },
  { pos: 'K', ids: ['k-001', 'k-002', 'k-003', 'k-004', 'k-005', 'k-006'] },
  { pos: 'DEF', ids: ['def-001', 'def-002', 'def-003', 'def-004', 'def-005', 'def-006'] },
];

// Baseline per-position weekly PPR average; teams get a bonus/penalty per position.
const POSITION_BASE = { QB: 20, RB: 14, WR: 12, TE: 9, K: 7, DEF: 6 };

// Round-robin pairings for 6 teams (circle method), cycled across 14 weeks.
const ROUNDS = [
  [[0, 1], [2, 5], [3, 4]],
  [[0, 2], [3, 1], [4, 5]],
  [[0, 3], [4, 2], [5, 1]],
  [[0, 4], [5, 3], [1, 2]],
  [[0, 5], [1, 4], [2, 3]],
];

function sqlStr(v) {
  return `'${String(v).replace(/'/g, "''")}'`;
}

function main(userId) {
  const now = Date.now();
  const leagueId = randomUUID();
  const statements = [];

  statements.push(`INSERT INTO leagues (id, name, platform, scoring_format, team_count, current_week, season_year, playoff_weeks, playoff_teams, league_type, created_at, updated_at) VALUES (${sqlStr(leagueId)}, ${sqlStr('Dev Test League')}, ${sqlStr('custom')}, ${sqlStr('ppr')}, ${TEAM_DEFS.length}, ${CURRENT_WEEK}, ${SEASON_YEAR}, 3, ${PLAYOFF_TEAMS}, ${sqlStr('redraft')}, ${now}, ${now});`);

  const userTeam = TEAM_DEFS.find((t) => t.isUser);
  statements.push(`INSERT INTO league_members (id, user_id, league_id, role, external_username, joined_at) VALUES (${sqlStr(randomUUID())}, ${sqlStr(userId)}, ${sqlStr(leagueId)}, ${sqlStr('commissioner')}, ${sqlStr(userTeam.owner)}, ${now});`);

  const teamIds = TEAM_DEFS.map(() => randomUUID());

  TEAM_DEFS.forEach((team, i) => {
    statements.push(`INSERT INTO teams (id, league_id, owner_id, external_owner_id, owner_display_name, name, wins, losses, ties, points_for, points_against, created_at, updated_at) VALUES (${sqlStr(teamIds[i])}, ${sqlStr(leagueId)}, ${sqlStr(userId)}, ${sqlStr(team.owner)}, ${sqlStr(team.name)}, ${sqlStr(team.name)}, ${team.wins}, ${team.losses}, 0, ${team.pf}, ${team.pa}, ${now}, ${now});`);
  });

  // Roster spots + weekly stats + this-week projections.
  TEAM_DEFS.forEach((team, teamIdx) => {
    ROSTER_SLOTS.forEach((slot) => {
      const playerId = slot.ids[teamIdx];
      const basePos = slot.pos.replace(/2$/, '');
      const base = POSITION_BASE[basePos];
      const weak = team.weak === basePos ? 0.65 : 1;
      const skillTier = 1 + (TEAM_DEFS.length - 1 - teamIdx) * 0.04; // best team's roster trends a bit stronger

      statements.push(`INSERT INTO roster_spots (id, team_id, player_id, slot, is_starter, acquired_at, acquired_type) VALUES (${sqlStr(randomUUID())}, ${sqlStr(teamIds[teamIdx])}, ${sqlStr(playerId)}, ${sqlStr(slot.pos)}, 1, ${now}, ${sqlStr('draft')});`);

      for (let week = 1; week < CURRENT_WEEK; week++) {
        const variance = 0.8 + Math.random() * 0.4;
        const points = Math.max(0, Math.round(base * weak * skillTier * variance * 10) / 10);
        statements.push(`INSERT INTO player_weekly_stats (id, player_id, season_year, week, opponent, off_snaps, fantasy_points_ppr, fantasy_points_half, fantasy_points_std) VALUES (${sqlStr(randomUUID())}, ${sqlStr(playerId)}, ${SEASON_YEAR}, ${week}, ${sqlStr('OPP')}, 40, ${points}, ${points}, ${points});`);
      }

      const projPoints = Math.round(base * weak * skillTier * 10) / 10;
      statements.push(`INSERT INTO player_projections (id, player_id, season_year, week, scoring_format, projected_points, updated_at) VALUES (${sqlStr(randomUUID())}, ${sqlStr(playerId)}, ${SEASON_YEAR}, ${CURRENT_WEEK}, ${sqlStr('ppr')}, ${projPoints}, ${now});`);
    });
  });

  // Matchups: weeks 1..(CURRENT_WEEK-1) complete, CURRENT_WEEK..REGULAR_SEASON_WEEKS remaining.
  for (let week = 1; week <= REGULAR_SEASON_WEEKS; week++) {
    const round = ROUNDS[(week - 1) % ROUNDS.length];
    const isComplete = week < CURRENT_WEEK;
    round.forEach(([homeIdx, awayIdx]) => {
      const homeScore = isComplete ? Math.round((TEAM_DEFS[homeIdx].pf / (CURRENT_WEEK - 1)) * 10) / 10 : null;
      const awayScore = isComplete ? Math.round((TEAM_DEFS[awayIdx].pf / (CURRENT_WEEK - 1)) * 10) / 10 : null;
      statements.push(`INSERT INTO matchups (id, league_id, week, home_team_id, away_team_id, home_score, away_score, is_playoff, is_championship, is_complete) VALUES (${sqlStr(randomUUID())}, ${sqlStr(leagueId)}, ${week}, ${sqlStr(teamIds[homeIdx])}, ${sqlStr(teamIds[awayIdx])}, ${homeScore ?? 'NULL'}, ${awayScore ?? 'NULL'}, 0, 0, ${isComplete ? 1 : 0});`);
    });
  }

  const sqlPath = 'scripts/.seed-dev-league.tmp.sql';
  writeFileSync(sqlPath, statements.join('\n'), 'utf-8');
  try {
    execSync(`npx wrangler d1 execute filmroom-db --local --file=${sqlPath}`, { stdio: 'inherit' });
  } finally {
    unlinkSync(sqlPath);
  }

  console.log('\nDone. League id:', leagueId);
  console.log('Your team:', userTeam.name, '(external_owner_id:', userTeam.owner + ')');
  console.log('Login: devtest@filmroom.local / DevTest1234!');
}

registerOrLogin().then((userId) => {
  console.log('Test user id:', userId);
  main(userId);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
