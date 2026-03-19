-- Add user_feedback table for collecting user feedback
CREATE TABLE IF NOT EXISTS `user_feedback` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text REFERENCES users(id) ON DELETE SET NULL,
  `type` text NOT NULL,
  `message` text NOT NULL,
  `email` text,
  `page` text,
  `user_agent` text,
  `status` text NOT NULL DEFAULT 'new',
  `created_at` integer NOT NULL DEFAULT (unixepoch())
);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS `feedback_status_idx` ON `user_feedback` (`status`);
CREATE INDEX IF NOT EXISTS `feedback_created_idx` ON `user_feedback` (`created_at`);
