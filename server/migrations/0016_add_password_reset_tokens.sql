-- Password reset tokens table
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `token_hash` text NOT NULL,
  `expires_at` integer NOT NULL,
  `used_at` integer,
  `created_at` integer NOT NULL DEFAULT (unixepoch())
);
