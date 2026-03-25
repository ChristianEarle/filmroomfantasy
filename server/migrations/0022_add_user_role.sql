-- Add role column to users table (non-destructive)
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
