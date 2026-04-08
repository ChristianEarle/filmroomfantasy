-- Feature 1 follow-up: store full league settings from connected platforms
-- so the Trade Analyzer can auto-populate format + advanced settings instead
-- of forcing the user to re-enter them.

ALTER TABLE leagues ADD COLUMN league_type TEXT NOT NULL DEFAULT 'redraft';
ALTER TABLE leagues ADD COLUMN has_superflex INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leagues ADD COLUMN has_te_premium INTEGER NOT NULL DEFAULT 0;
