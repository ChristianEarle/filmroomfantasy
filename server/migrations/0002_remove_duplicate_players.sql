-- Remove duplicate NFL players (keep one per name+team+position)
-- Delete duplicates where we keep the row with the minimum id (first inserted)

DELETE FROM nfl_players
WHERE id NOT IN (
  SELECT MIN(id)
  FROM nfl_players
  GROUP BY name, team, position
);
