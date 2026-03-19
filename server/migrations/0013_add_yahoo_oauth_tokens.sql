-- Add Yahoo OAuth token columns to users table
ALTER TABLE users ADD COLUMN yahoo_access_token TEXT;
ALTER TABLE users ADD COLUMN yahoo_refresh_token TEXT;
ALTER TABLE users ADD COLUMN yahoo_token_expires_at INTEGER;
