-- Tracks whether an in-app notification has been (or was attempted to be)
-- delivered by email, so the digest-email cron never reprocesses a row.
-- NULL = not yet attempted.
ALTER TABLE `notifications` ADD COLUMN `emailed_at` integer;

-- Backfill every pre-existing row as already-processed. Without this, the
-- entire historical notification backlog would read as "pending" on the
-- first cron tick after deploy, mass-emailing users about old injury news
-- instead of only ever emailing notifications created from here on.
UPDATE `notifications` SET `emailed_at` = `created_at` WHERE `emailed_at` IS NULL;

CREATE INDEX IF NOT EXISTS `idx_notifications_email_pending` ON `notifications` (`emailed_at`);
