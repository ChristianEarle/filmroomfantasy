-- Add Google OAuth support
-- Adds google_id column and makes password_hash nullable for Google-only users

PRAGMA foreign_keys=OFF;
--> statement-breakpoint

-- Step 1: Create new table with nullable password_hash and google_id
CREATE TABLE users_new (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT,
  username TEXT NOT NULL,
  google_id TEXT,
  avatar_url TEXT,
  preferred_scoring TEXT DEFAULT 'ppr',
  dark_mode INTEGER DEFAULT 1,
  notifications_enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint

-- Step 2: Copy existing data
INSERT INTO users_new (id, email, password_hash, username, avatar_url, preferred_scoring, dark_mode, notifications_enabled, created_at, updated_at)
SELECT id, email, password_hash, username, avatar_url, preferred_scoring, dark_mode, notifications_enabled, created_at, updated_at FROM users;
--> statement-breakpoint

-- Step 3: Drop old table
DROP TABLE users;
--> statement-breakpoint

-- Step 4: Rename new table
ALTER TABLE users_new RENAME TO users;
--> statement-breakpoint

-- Step 5: Recreate indexes
CREATE UNIQUE INDEX users_email_unique ON users (email);
--> statement-breakpoint
CREATE UNIQUE INDEX users_username_unique ON users (username);
--> statement-breakpoint
CREATE UNIQUE INDEX users_google_id_unique ON users (google_id);
--> statement-breakpoint

PRAGMA foreign_keys=ON;
