-- GET /api/players/:id/props probes "does this season have any props at
-- all" to tell the offseason apart from "this week's lines aren't posted
-- yet". Without an index that probe is a full scan of player_props.
CREATE INDEX IF NOT EXISTS `idx_player_props_season_week` ON `player_props` (`season`, `week`);
