-- Per-league invite code used to gate POST /api/leagues/:id/join. Without a
-- matching code, knowing a league id is no longer enough to join (and thereby
-- read) another league's data. Nullable so existing rows migrate cleanly;
-- joins against a NULL code are rejected in application code (fail closed).
ALTER TABLE leagues ADD COLUMN invite_code TEXT;
