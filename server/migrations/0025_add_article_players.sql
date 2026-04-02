-- Join table linking articles to relevant players
CREATE TABLE IF NOT EXISTS article_players (
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_article_players_player ON article_players(player_id);
CREATE INDEX IF NOT EXISTS idx_article_players_article ON article_players(article_id);
