-- When this league's data was last refreshed from its platform (Sleeper
-- full sync or quick sync). Drives sync-on-open: a league opened in the app
-- with a stale or missing timestamp is re-synced automatically instead of
-- waiting for someone to press Sync or for the next cron pass. NULL for
-- leagues that have never synced since this column existed; they sort
-- first in the admin batch sync.
ALTER TABLE `leagues` ADD COLUMN `last_synced_at` integer;
