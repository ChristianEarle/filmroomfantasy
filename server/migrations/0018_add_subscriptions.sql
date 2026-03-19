-- Add subscription columns to users table
ALTER TABLE users ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN subscription_expires_at TEXT;
