-- AI power ranking (ordered team-id JSON array) alongside the existing pulse
-- narrative. Nullable — a malformed model response degrades to narrative-only.
ALTER TABLE league_ai_pulses ADD COLUMN ranking_json TEXT;
