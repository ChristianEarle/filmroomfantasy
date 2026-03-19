-- ============================================
-- NFL PLAYERS SEED DATA
-- ============================================

-- Quarterbacks
INSERT INTO nfl_players (id, name, first_name, last_name, team, position, status, bye_week, jersey_number, years_exp, created_at, updated_at) VALUES
('qb-001', 'Patrick Mahomes', 'Patrick', 'Mahomes', 'KC', 'QB', 'active', 6, 15, 7, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('qb-002', 'Josh Allen', 'Josh', 'Allen', 'BUF', 'QB', 'active', 12, 17, 6, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('qb-003', 'Jalen Hurts', 'Jalen', 'Hurts', 'PHI', 'QB', 'active', 5, 1, 4, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('qb-004', 'Lamar Jackson', 'Lamar', 'Jackson', 'BAL', 'QB', 'active', 13, 8, 6, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('qb-005', 'Joe Burrow', 'Joe', 'Burrow', 'CIN', 'QB', 'active', 12, 9, 4, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('qb-006', 'Justin Herbert', 'Justin', 'Herbert', 'LAC', 'QB', 'active', 5, 10, 4, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('qb-007', 'Dak Prescott', 'Dak', 'Prescott', 'DAL', 'QB', 'active', 7, 4, 8, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('qb-008', 'Trevor Lawrence', 'Trevor', 'Lawrence', 'JAX', 'QB', 'active', 9, 16, 3, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('qb-009', 'Tua Tagovailoa', 'Tua', 'Tagovailoa', 'MIA', 'QB', 'active', 6, 1, 4, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('qb-010', 'CJ Stroud', 'CJ', 'Stroud', 'HOU', 'QB', 'active', 14, 7, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('qb-011', 'Jordan Love', 'Jordan', 'Love', 'GB', 'QB', 'active', 10, 10, 4, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('qb-012', 'Brock Purdy', 'Brock', 'Purdy', 'SF', 'QB', 'active', 9, 13, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('qb-013', 'Kyler Murray', 'Kyler', 'Murray', 'ARI', 'QB', 'active', 11, 1, 5, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('qb-014', 'Jared Goff', 'Jared', 'Goff', 'DET', 'QB', 'active', 5, 16, 8, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('qb-015', 'Anthony Richardson', 'Anthony', 'Richardson', 'IND', 'QB', 'active', 14, 5, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Running Backs
INSERT INTO nfl_players (id, name, first_name, last_name, team, position, status, bye_week, jersey_number, years_exp, created_at, updated_at) VALUES
('rb-001', 'Christian McCaffrey', 'Christian', 'McCaffrey', 'SF', 'RB', 'active', 9, 23, 7, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('rb-002', 'Bijan Robinson', 'Bijan', 'Robinson', 'ATL', 'RB', 'active', 12, 7, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('rb-003', 'Breece Hall', 'Breece', 'Hall', 'NYJ', 'RB', 'active', 12, 20, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('rb-004', 'Jahmyr Gibbs', 'Jahmyr', 'Gibbs', 'DET', 'RB', 'active', 5, 26, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('rb-005', 'Travis Etienne', 'Travis', 'Etienne', 'JAX', 'RB', 'active', 9, 1, 3, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('rb-006', 'Jonathan Taylor', 'Jonathan', 'Taylor', 'IND', 'RB', 'active', 14, 28, 4, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('rb-007', 'Derrick Henry', 'Derrick', 'Henry', 'BAL', 'RB', 'active', 13, 22, 8, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('rb-008', 'Saquon Barkley', 'Saquon', 'Barkley', 'PHI', 'RB', 'active', 5, 26, 6, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('rb-009', 'Josh Jacobs', 'Josh', 'Jacobs', 'GB', 'RB', 'active', 10, 8, 5, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('rb-010', 'Rachaad White', 'Rachaad', 'White', 'TB', 'RB', 'active', 11, 1, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('rb-011', 'De''Von Achane', 'De''Von', 'Achane', 'MIA', 'RB', 'active', 6, 28, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('rb-012', 'Isiah Pacheco', 'Isiah', 'Pacheco', 'KC', 'RB', 'active', 6, 10, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('rb-013', 'James Cook', 'James', 'Cook', 'BUF', 'RB', 'active', 12, 4, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('rb-014', 'Tony Pollard', 'Tony', 'Pollard', 'TEN', 'RB', 'active', 5, 20, 5, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('rb-015', 'Joe Mixon', 'Joe', 'Mixon', 'HOU', 'RB', 'active', 14, 28, 7, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('rb-016', 'Aaron Jones', 'Aaron', 'Jones', 'MIN', 'RB', 'active', 6, 33, 7, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('rb-017', 'Kenneth Walker III', 'Kenneth', 'Walker III', 'SEA', 'RB', 'active', 10, 9, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('rb-018', 'Kyren Williams', 'Kyren', 'Williams', 'LAR', 'RB', 'active', 6, 23, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('rb-019', 'Rhamondre Stevenson', 'Rhamondre', 'Stevenson', 'NE', 'RB', 'active', 14, 38, 3, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('rb-020', 'Najee Harris', 'Najee', 'Harris', 'PIT', 'RB', 'active', 9, 22, 3, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Wide Receivers
INSERT INTO nfl_players (id, name, first_name, last_name, team, position, status, bye_week, jersey_number, years_exp, created_at, updated_at) VALUES
('wr-001', 'Tyreek Hill', 'Tyreek', 'Hill', 'MIA', 'WR', 'active', 6, 10, 8, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-002', 'CeeDee Lamb', 'CeeDee', 'Lamb', 'DAL', 'WR', 'active', 7, 88, 4, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-003', 'Ja''Marr Chase', 'Ja''Marr', 'Chase', 'CIN', 'WR', 'active', 12, 1, 3, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-004', 'Amon-Ra St. Brown', 'Amon-Ra', 'St. Brown', 'DET', 'WR', 'active', 5, 14, 3, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-005', 'A.J. Brown', 'A.J.', 'Brown', 'PHI', 'WR', 'active', 5, 11, 5, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-006', 'Davante Adams', 'Davante', 'Adams', 'NYJ', 'WR', 'active', 12, 17, 10, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-007', 'Garrett Wilson', 'Garrett', 'Wilson', 'NYJ', 'WR', 'active', 12, 5, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-008', 'Justin Jefferson', 'Justin', 'Jefferson', 'MIN', 'WR', 'active', 6, 18, 4, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-009', 'Puka Nacua', 'Puka', 'Nacua', 'LAR', 'WR', 'active', 6, 17, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-010', 'Nico Collins', 'Nico', 'Collins', 'HOU', 'WR', 'active', 14, 12, 3, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-011', 'Chris Olave', 'Chris', 'Olave', 'NO', 'WR', 'active', 12, 12, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-012', 'DeVonta Smith', 'DeVonta', 'Smith', 'PHI', 'WR', 'active', 5, 6, 3, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-013', 'Stefon Diggs', 'Stefon', 'Diggs', 'HOU', 'WR', 'active', 14, 1, 9, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-014', 'DK Metcalf', 'DK', 'Metcalf', 'SEA', 'WR', 'active', 10, 14, 5, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-015', 'Deebo Samuel', 'Deebo', 'Samuel', 'SF', 'WR', 'active', 9, 1, 5, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-016', 'Brandon Aiyuk', 'Brandon', 'Aiyuk', 'SF', 'WR', 'active', 9, 11, 4, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-017', 'Jaylen Waddle', 'Jaylen', 'Waddle', 'MIA', 'WR', 'active', 6, 17, 3, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-018', 'Amari Cooper', 'Amari', 'Cooper', 'CLE', 'WR', 'active', 10, 2, 9, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-019', 'Cooper Kupp', 'Cooper', 'Kupp', 'LAR', 'WR', 'active', 6, 10, 7, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-020', 'Mike Evans', 'Mike', 'Evans', 'TB', 'WR', 'active', 11, 13, 10, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-021', 'Drake London', 'Drake', 'London', 'ATL', 'WR', 'active', 12, 5, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-022', 'Keenan Allen', 'Keenan', 'Allen', 'CHI', 'WR', 'active', 7, 13, 11, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-023', 'DJ Moore', 'DJ', 'Moore', 'CHI', 'WR', 'active', 7, 2, 6, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-024', 'Michael Pittman Jr.', 'Michael', 'Pittman Jr.', 'IND', 'WR', 'active', 14, 11, 4, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('wr-025', 'Marvin Harrison Jr.', 'Marvin', 'Harrison Jr.', 'ARI', 'WR', 'active', 11, 18, 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Tight Ends
INSERT INTO nfl_players (id, name, first_name, last_name, team, position, status, bye_week, jersey_number, years_exp, created_at, updated_at) VALUES
('te-001', 'Travis Kelce', 'Travis', 'Kelce', 'KC', 'TE', 'active', 6, 87, 11, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('te-002', 'Sam LaPorta', 'Sam', 'LaPorta', 'DET', 'TE', 'active', 5, 87, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('te-003', 'George Kittle', 'George', 'Kittle', 'SF', 'TE', 'active', 9, 85, 7, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('te-004', 'Mark Andrews', 'Mark', 'Andrews', 'BAL', 'TE', 'active', 13, 89, 6, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('te-005', 'Dallas Goedert', 'Dallas', 'Goedert', 'PHI', 'TE', 'active', 5, 88, 6, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('te-006', 'T.J. Hockenson', 'T.J.', 'Hockenson', 'MIN', 'TE', 'questionable', 6, 87, 5, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('te-007', 'Evan Engram', 'Evan', 'Engram', 'JAX', 'TE', 'active', 9, 17, 7, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('te-008', 'Dalton Kincaid', 'Dalton', 'Kincaid', 'BUF', 'TE', 'active', 12, 86, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('te-009', 'Jake Ferguson', 'Jake', 'Ferguson', 'DAL', 'TE', 'active', 7, 87, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('te-010', 'Kyle Pitts', 'Kyle', 'Pitts', 'ATL', 'TE', 'active', 12, 8, 3, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('te-011', 'David Njoku', 'David', 'Njoku', 'CLE', 'TE', 'active', 10, 85, 7, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('te-012', 'Pat Freiermuth', 'Pat', 'Freiermuth', 'PIT', 'TE', 'active', 9, 88, 3, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Kickers
INSERT INTO nfl_players (id, name, first_name, last_name, team, position, status, bye_week, jersey_number, years_exp, created_at, updated_at) VALUES
('k-001', 'Justin Tucker', 'Justin', 'Tucker', 'BAL', 'K', 'active', 13, 9, 12, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('k-002', 'Harrison Butker', 'Harrison', 'Butker', 'KC', 'K', 'active', 6, 7, 7, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('k-003', 'Tyler Bass', 'Tyler', 'Bass', 'BUF', 'K', 'active', 12, 2, 4, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('k-004', 'Jake Elliott', 'Jake', 'Elliott', 'PHI', 'K', 'active', 5, 4, 7, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('k-005', 'Jake Moody', 'Jake', 'Moody', 'SF', 'K', 'active', 9, 4, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('k-006', 'Brandon Aubrey', 'Brandon', 'Aubrey', 'DAL', 'K', 'active', 7, 17, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Defense/Special Teams
INSERT INTO nfl_players (id, name, first_name, last_name, team, position, status, bye_week, created_at, updated_at) VALUES
('def-001', 'San Francisco 49ers', 'San Francisco', '49ers', 'SF', 'DEF', 'active', 9, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('def-002', 'Dallas Cowboys', 'Dallas', 'Cowboys', 'DAL', 'DEF', 'active', 7, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('def-003', 'Buffalo Bills', 'Buffalo', 'Bills', 'BUF', 'DEF', 'active', 12, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('def-004', 'Baltimore Ravens', 'Baltimore', 'Ravens', 'BAL', 'DEF', 'active', 13, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('def-005', 'Cleveland Browns', 'Cleveland', 'Browns', 'CLE', 'DEF', 'active', 10, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('def-006', 'New York Jets', 'New York', 'Jets', 'NYJ', 'DEF', 'active', 12, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('def-007', 'Miami Dolphins', 'Miami', 'Dolphins', 'MIA', 'DEF', 'active', 6, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('def-008', 'Pittsburgh Steelers', 'Pittsburgh', 'Steelers', 'PIT', 'DEF', 'active', 9, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('def-009', 'Kansas City Chiefs', 'Kansas City', 'Chiefs', 'KC', 'DEF', 'active', 6, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('def-010', 'Detroit Lions', 'Detroit', 'Lions', 'DET', 'DEF', 'active', 5, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- ============================================
-- SAMPLE NFL GAMES (Week 1-3)
-- ============================================

INSERT INTO nfl_games (id, week, season_year, home_team, away_team, game_time, spread, over_under, tv_network, is_complete) VALUES
-- Week 1
('game-w1-1', 1, 2024, 'KC', 'BAL', strftime('%s', '2024-09-05 20:20:00') * 1000, -3.5, 52.5, 'NBC', 1),
('game-w1-2', 1, 2024, 'PHI', 'GB', strftime('%s', '2024-09-06 20:15:00') * 1000, -2.5, 48.5, 'NBC', 1),
('game-w1-3', 1, 2024, 'BUF', 'ARI', strftime('%s', '2024-09-08 13:00:00') * 1000, -7.5, 47.5, 'CBS', 1),
('game-w1-4', 1, 2024, 'MIA', 'JAX', strftime('%s', '2024-09-08 13:00:00') * 1000, -3.5, 48.0, 'CBS', 1),
('game-w1-5', 1, 2024, 'DET', 'LAR', strftime('%s', '2024-09-08 20:20:00') * 1000, -5.0, 52.0, 'NBC', 1),
('game-w1-6', 1, 2024, 'SF', 'NYJ', strftime('%s', '2024-09-09 20:15:00') * 1000, -4.5, 43.5, 'ESPN', 1),

-- Week 2
('game-w2-1', 2, 2024, 'BUF', 'MIA', strftime('%s', '2024-09-12 20:15:00') * 1000, -2.5, 49.0, 'Prime', 1),
('game-w2-2', 2, 2024, 'DAL', 'NO', strftime('%s', '2024-09-15 13:00:00') * 1000, -6.0, 45.5, 'FOX', 1),
('game-w2-3', 2, 2024, 'KC', 'CIN', strftime('%s', '2024-09-15 16:25:00') * 1000, -5.5, 48.5, 'CBS', 1),
('game-w2-4', 2, 2024, 'PHI', 'ATL', strftime('%s', '2024-09-16 20:15:00') * 1000, -6.0, 47.0, 'ESPN', 1),

-- Week 3
('game-w3-1', 3, 2024, 'NYJ', 'NE', strftime('%s', '2024-09-19 20:15:00') * 1000, -7.0, 39.0, 'Prime', 1),
('game-w3-2', 3, 2024, 'BAL', 'DAL', strftime('%s', '2024-09-22 16:25:00') * 1000, -1.5, 51.5, 'FOX', 1),
('game-w3-3', 3, 2024, 'SF', 'LAR', strftime('%s', '2024-09-22 16:25:00') * 1000, -7.0, 46.0, 'FOX', 1),
('game-w3-4', 3, 2024, 'MIA', 'SEA', strftime('%s', '2024-09-22 20:20:00') * 1000, -3.5, 45.0, 'NBC', 1);

-- ============================================
-- SAMPLE PLAYER PROJECTIONS (Week 1)
-- ============================================

INSERT INTO player_projections (id, player_id, week, season_year, projected_points, projected_points_low, projected_points_high, scoring_format, week_rank, position_rank, updated_at) VALUES
-- QBs
('proj-qb-001-w1', 'qb-001', 1, 2024, 24.5, 18.0, 32.0, 'ppr', 1, 1, strftime('%s', 'now') * 1000),
('proj-qb-002-w1', 'qb-002', 1, 2024, 23.2, 17.5, 30.0, 'ppr', 2, 2, strftime('%s', 'now') * 1000),
('proj-qb-003-w1', 'qb-003', 1, 2024, 22.8, 16.0, 29.5, 'ppr', 3, 3, strftime('%s', 'now') * 1000),
('proj-qb-004-w1', 'qb-004', 1, 2024, 22.5, 15.5, 28.0, 'ppr', 4, 4, strftime('%s', 'now') * 1000),

-- RBs
('proj-rb-001-w1', 'rb-001', 1, 2024, 22.0, 15.0, 28.0, 'ppr', 1, 1, strftime('%s', 'now') * 1000),
('proj-rb-002-w1', 'rb-002', 1, 2024, 18.5, 12.0, 25.0, 'ppr', 3, 2, strftime('%s', 'now') * 1000),
('proj-rb-003-w1', 'rb-003', 1, 2024, 17.8, 11.5, 24.0, 'ppr', 4, 3, strftime('%s', 'now') * 1000),
('proj-rb-004-w1', 'rb-004', 1, 2024, 17.2, 11.0, 23.5, 'ppr', 5, 4, strftime('%s', 'now') * 1000),

-- WRs
('proj-wr-001-w1', 'wr-001', 1, 2024, 19.5, 12.0, 28.0, 'ppr', 2, 1, strftime('%s', 'now') * 1000),
('proj-wr-002-w1', 'wr-002', 1, 2024, 18.2, 11.0, 26.0, 'ppr', 6, 2, strftime('%s', 'now') * 1000),
('proj-wr-003-w1', 'wr-003', 1, 2024, 17.8, 10.5, 25.5, 'ppr', 7, 3, strftime('%s', 'now') * 1000),
('proj-wr-008-w1', 'wr-008', 1, 2024, 17.5, 10.0, 25.0, 'ppr', 8, 4, strftime('%s', 'now') * 1000),

-- TEs
('proj-te-001-w1', 'te-001', 1, 2024, 14.5, 8.0, 22.0, 'ppr', 9, 1, strftime('%s', 'now') * 1000),
('proj-te-002-w1', 'te-002', 1, 2024, 12.0, 6.5, 18.0, 'ppr', 12, 2, strftime('%s', 'now') * 1000),
('proj-te-003-w1', 'te-003', 1, 2024, 11.5, 6.0, 17.5, 'ppr', 14, 3, strftime('%s', 'now') * 1000);

-- ============================================
-- SAMPLE PLAYER WEEKLY STATS (Week 1)
-- ============================================

INSERT INTO player_weekly_stats (id, player_id, week, season_year, opponent, game_result, pass_yards, pass_tds, pass_interceptions, rush_yards, rush_tds, receptions, receiving_yards, receiving_tds, targets, fantasy_points_ppr, fantasy_points_half, fantasy_points_std) VALUES
-- QBs
('stats-qb-001-w1', 'qb-001', 1, 2024, 'BAL', 'W 27-20', 291, 2, 0, 18, 0, 0, 0, 0, 0, 21.44, 21.44, 21.44),
('stats-qb-002-w1', 'qb-002', 1, 2024, 'ARI', 'W 34-28', 262, 2, 1, 56, 1, 0, 0, 0, 0, 23.68, 23.68, 23.68),
('stats-qb-003-w1', 'qb-003', 1, 2024, 'GB', 'W 34-29', 278, 2, 1, 33, 1, 0, 0, 0, 0, 22.42, 22.42, 22.42),
('stats-qb-004-w1', 'qb-004', 1, 2024, 'KC', 'L 20-27', 273, 1, 0, 122, 1, 0, 0, 0, 0, 27.12, 27.12, 27.12),

-- RBs
('stats-rb-001-w1', 'rb-001', 1, 2024, 'NYJ', 'W 32-19', 74, 0, 0, 0, 0, 5, 43, 0, 7, 16.2, 13.7, 11.2),
('stats-rb-002-w1', 'rb-002', 1, 2024, 'PIT', 'L 10-18', 68, 0, 0, 0, 0, 4, 28, 0, 5, 13.6, 11.6, 9.6),
('stats-rb-003-w1', 'rb-003', 1, 2024, 'SF', 'L 19-32', 54, 1, 0, 0, 0, 6, 39, 0, 8, 19.3, 16.3, 13.3),
('stats-rb-004-w1', 'rb-004', 1, 2024, 'LAR', 'W 26-20', 82, 1, 0, 0, 0, 5, 52, 1, 7, 25.4, 22.9, 20.4),
('stats-rb-008-w1', 'rb-008', 1, 2024, 'GB', 'W 34-29', 109, 2, 0, 0, 0, 2, 23, 0, 3, 25.2, 24.2, 23.2),

-- WRs
('stats-wr-001-w1', 'wr-001', 1, 2024, 'JAX', 'W 20-17', 130, 1, 0, 0, 0, 7, 130, 1, 10, 26.0, 22.5, 19.0),
('stats-wr-002-w1', 'wr-002', 1, 2024, 'CLE', 'W 33-17', 98, 1, 0, 0, 0, 8, 98, 1, 12, 23.8, 19.8, 15.8),
('stats-wr-003-w1', 'wr-003', 1, 2024, 'NE', 'W 16-10', 84, 0, 0, 0, 0, 6, 84, 0, 9, 14.4, 11.4, 8.4),
('stats-wr-004-w1', 'wr-004', 1, 2024, 'LAR', 'W 26-20', 109, 1, 0, 0, 0, 8, 109, 1, 11, 24.9, 20.9, 16.9),
('stats-wr-005-w1', 'wr-005', 1, 2024, 'GB', 'W 34-29', 84, 1, 0, 0, 0, 5, 84, 1, 7, 19.4, 16.9, 14.4),
('stats-wr-008-w1', 'wr-008', 1, 2024, 'NYG', 'W 28-6', 117, 2, 0, 0, 0, 7, 117, 2, 9, 30.7, 27.2, 23.7),

-- TEs
('stats-te-001-w1', 'te-001', 1, 2024, 'BAL', 'W 27-20', 62, 1, 0, 0, 0, 6, 62, 1, 8, 18.2, 15.2, 12.2),
('stats-te-002-w1', 'te-002', 1, 2024, 'LAR', 'W 26-20', 67, 0, 0, 0, 0, 7, 67, 0, 9, 13.7, 10.2, 6.7),
('stats-te-003-w1', 'te-003', 1, 2024, 'NYJ', 'W 32-19', 54, 1, 0, 0, 0, 4, 54, 1, 5, 15.4, 13.4, 11.4);

-- ============================================
-- SAMPLE PLAYER NEWS
-- ============================================

INSERT INTO player_news (id, player_id, headline, content, source, impact_level, published_at, created_at) VALUES
('news-001', 'rb-001', 'McCaffrey expected to be limited in practice', 'Christian McCaffrey is dealing with calf tightness and is expected to be limited in Wednesday practice. The team is optimistic he will play Sunday.', 'Adam Schefter', 'medium', strftime('%s', 'now') * 1000 - 86400000, strftime('%s', 'now') * 1000),
('news-002', 'wr-008', 'Jefferson signs record-breaking extension', 'Justin Jefferson has signed a 4-year, $140 million extension with the Vikings, making him the highest-paid non-QB in NFL history.', 'Ian Rapoport', 'low', strftime('%s', 'now') * 1000 - 172800000, strftime('%s', 'now') * 1000),
('news-003', 'qb-005', 'Burrow full participant in practice', 'Joe Burrow was a full participant in Wednesday practice and is on track to start Week 1. His wrist appears to be fully healed.', 'NFL Network', 'high', strftime('%s', 'now') * 1000 - 259200000, strftime('%s', 'now') * 1000),
('news-004', 'rb-011', 'Achane impressing in camp', 'De''Von Achane has been the talk of Dolphins camp with his explosiveness. Offensive coordinator expects a breakout sophomore season.', 'Miami Herald', 'medium', strftime('%s', 'now') * 1000 - 345600000, strftime('%s', 'now') * 1000),
('news-005', 'te-006', 'Hockenson knee recovery on schedule', 'T.J. Hockenson is making good progress in his ACL recovery but is not expected to be ready for Week 1. Target return is Weeks 6-8.', 'ESPN', 'high', strftime('%s', 'now') * 1000 - 432000000, strftime('%s', 'now') * 1000);
