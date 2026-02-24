-- SPRINT-CATALOG-PARTICIPANTS-MIGRATION-091
-- Migrate catalog_players_v1 from legacy players/teams to canonical participants
-- Rollback: Restore previous view definition from 20260219150000_smartform_data_contracts_v1.sql

-- Replace the existing view to read from canonical participants + participant_memberships
CREATE OR REPLACE VIEW catalog_players_v1 AS
SELECT
  p.id AS player_id,
  COALESCE(p.meta->'names'->>'display', p.name) AS player_name,
  p.sport,
  t.id AS team_id,
  t.name AS team_name,
  t.display_name AS team_abbr,
  COALESCE(pm.meta->>'position', p.meta->>'position') AS position,
  p.meta->>'photoURL' AS headshot_url,
  COALESCE(p.external_id, p.id::text) AS external_player_id,
  -- Search optimization: lowercase concatenation for ILIKE searches
  LOWER(COALESCE(p.meta->'names'->>'display', p.name)) || ' ' ||
    COALESCE(LOWER(t.name), '') || ' ' ||
    COALESCE(LOWER(t.display_name), '') AS search_text,
  '2.0.0'::TEXT AS contract_version,
  p.updated_at AS last_updated
FROM participants p
INNER JOIN participant_memberships pm
  ON pm.participant_id = p.id
  AND pm.valid_to IS NULL  -- Current membership only
INNER JOIN participants t
  ON t.id = pm.team_id
  AND t.type = 'team'
WHERE p.type = 'player'
  AND p.active = true;

-- Document the view source
COMMENT ON VIEW catalog_players_v1 IS
  'Smart Form player catalog - sourced from participants + participant_memberships. Sprint: SPRINT-CATALOG-PARTICIPANTS-MIGRATION-091. Breaking: team_id is now UUID.';
