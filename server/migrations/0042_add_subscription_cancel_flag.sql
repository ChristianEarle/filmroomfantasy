-- Track whether a paid subscription is set to cancel at the end of the
-- current billing period. Without this, subscriptionExpiresAt alone can't
-- distinguish "will renew on this date" from "access ends on this date" —
-- ProfileView showed a misleading "Renews {date}" message after a page
-- reload even though the user had already cancelled.
ALTER TABLE users ADD COLUMN subscription_cancel_at_period_end INTEGER NOT NULL DEFAULT 0;
