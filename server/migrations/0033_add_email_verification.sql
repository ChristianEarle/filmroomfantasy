-- Email verification: nullable timestamp on users + tokens table
-- (mirrors password_reset_tokens shape for the same lifecycle handling)

ALTER TABLE `users` ADD COLUMN `email_verified_at` integer;

CREATE TABLE IF NOT EXISTS `email_verification_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `token_hash` text NOT NULL,
  `expires_at` integer NOT NULL,
  `used_at` integer,
  `created_at` integer NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS `idx_email_verification_tokens_user_id`
  ON `email_verification_tokens`(`user_id`);
