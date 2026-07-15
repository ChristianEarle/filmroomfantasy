-- Add AI-generated ceiling/floor overall ranks to draft rankings.
-- ceiling_rank = realistic best-case overall finish (lower number = better),
-- floor_rank = realistic worst-case overall finish. NULL until the next
-- ranking batch run emits them.
ALTER TABLE `draft_rankings` ADD COLUMN `ceiling_rank` integer;
ALTER TABLE `draft_rankings` ADD COLUMN `floor_rank` integer;
