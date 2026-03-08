-- SPRINT-044F: Seed SGO into provider_registry
-- Without this row, upsert_provider_offers_bootstrap resolves v_provider_id = NULL
-- and returns (0,0,0) for all SGO ingestion calls.
--
-- Rollback: DELETE FROM provider_registry WHERE code = 'sgo';

INSERT INTO provider_registry (code, display_name, api_source, priority, has_player_props, has_live_odds)
VALUES ('sgo', 'SGO (Sports Game Odds)', 'sgo', 11, TRUE, FALSE)
ON CONFLICT (code) DO NOTHING;
