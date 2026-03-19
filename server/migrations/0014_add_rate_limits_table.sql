-- Distributed rate limiting table (D1-backed, works across Workers isolates)
CREATE TABLE IF NOT EXISTS `rate_limits` (
  `key` TEXT PRIMARY KEY,
  `count` INTEGER NOT NULL DEFAULT 1,
  `reset_at` INTEGER NOT NULL
);

-- Index for cleanup of expired entries
CREATE INDEX IF NOT EXISTS `idx_rate_limits_reset_at` ON `rate_limits` (`reset_at`);
