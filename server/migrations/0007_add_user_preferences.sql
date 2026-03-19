-- Add user preferences for settings persistence
ALTER TABLE users ADD COLUMN preferred_scoring TEXT DEFAULT 'ppr';
ALTER TABLE users ADD COLUMN dark_mode INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN notifications_enabled INTEGER DEFAULT 1;
