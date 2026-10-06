-- AI power-ranking tier grades (JSON array of letter grades aligned to
-- ranking_json: grades[i] belongs to ranking[i]). Teams the model sees as close
-- in strength share a grade. Nullable — rows cached before this column, or a
-- response that failed validation, fall back to the points-per-game grade.
ALTER TABLE league_ai_pulses ADD COLUMN grades_json TEXT;
