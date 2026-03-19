#!/usr/bin/env node
/**
 * Prints a sample row from player_weekly_stats to the terminal.
 * Run: npm run db:stats-sample
 */

import { execSync } from 'child_process';

const cmd = `npx wrangler d1 execute filmroom-db --local --command "SELECT pws.id, pws.player_id, np.name, pws.week, pws.season_year, pws.opponent, pws.pass_yards, pws.rush_yards, pws.receptions, pws.receiving_yards, pws.fantasy_points_ppr FROM player_weekly_stats pws JOIN nfl_players np ON np.id = pws.player_id LIMIT 3"`;
console.log('Sample player_weekly_stats rows:\n');
execSync(cmd, { stdio: 'inherit' });
