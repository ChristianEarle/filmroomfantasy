-- Remove duplicate team defenses (keep one per team)
DELETE FROM nfl_players
WHERE position = 'DEF'
  AND id NOT IN (
    SELECT MIN(id)
    FROM nfl_players
    WHERE position = 'DEF'
    GROUP BY team
  );
