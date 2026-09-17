-- Opt-in email delivery for notifications (currently: injury alerts).
-- Defaults to false — existing users didn't sign up for email, only the
-- in-app bell (`notifications_enabled`, which stays default-true and
-- unaffected by this column).
ALTER TABLE `users` ADD COLUMN `email_notifications_enabled` integer DEFAULT false NOT NULL;
