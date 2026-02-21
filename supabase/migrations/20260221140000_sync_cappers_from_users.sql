-- Migration: Sync cappers from canonical users table
-- Sprint: SPRINT-SMARTFORM-CANONICAL-ENTITIES-089
-- Purpose: Replace fake seed cappers with real cappers from users table
-- Rollback: See rollback section at bottom

-- ============================================================================
-- STEP 1: Add external_id column to link to users table
-- ============================================================================

ALTER TABLE cappers ADD COLUMN IF NOT EXISTS external_id UUID REFERENCES users(id);
ALTER TABLE cappers ADD COLUMN IF NOT EXISTS username TEXT;

-- ============================================================================
-- STEP 2: Clear ALL existing cappers (including fake seed data and Griff843)
-- ============================================================================

TRUNCATE TABLE cappers;

-- ============================================================================
-- STEP 3: Create unique constraint on external_id
-- ============================================================================

ALTER TABLE cappers ADD CONSTRAINT cappers_external_id_unique UNIQUE (external_id);

-- ============================================================================
-- STEP 4: Sync real cappers from users table (active users only)
-- ============================================================================

INSERT INTO cappers (id, display_name, username, external_id, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.username,
  u.username,
  u.id,
  true,
  NOW(),
  NOW()
FROM users u
WHERE u.active = true
  AND u.username IS NOT NULL
  AND u.username NOT LIKE 'test_%'
  AND u.username NOT LIKE 'e2e_%'
  AND u.username NOT LIKE 'phase%'
  AND u.username NOT LIKE 'automation_%';

-- ============================================================================
-- STEP 5: Update RPC to include external_id (must drop first to change return type)
-- ============================================================================

DROP FUNCTION IF EXISTS get_active_cappers();

CREATE FUNCTION get_active_cappers()
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  username TEXT,
  external_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.display_name, c.username, c.external_id
  FROM cappers c
  WHERE c.is_active = true
  ORDER BY c.display_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant access
GRANT EXECUTE ON FUNCTION get_active_cappers() TO authenticated, anon, service_role;

-- ============================================================================
-- STEP 5: Create function to sync cappers on demand
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_cappers_from_users()
RETURNS INTEGER AS $$
DECLARE
  synced_count INTEGER;
BEGIN
  -- Insert or update cappers from active users
  INSERT INTO cappers (id, display_name, username, external_id, is_active, created_at, updated_at)
  SELECT
    gen_random_uuid(),
    u.username,
    u.username,
    u.id,
    true,
    NOW(),
    NOW()
  FROM users u
  WHERE u.active = true
    AND u.username IS NOT NULL
    AND u.username NOT LIKE 'test_%'
    AND u.username NOT LIKE 'e2e_%'
    AND u.username NOT LIKE 'phase%'
    AND u.username NOT LIKE 'automation_%'
  ON CONFLICT (external_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    username = EXCLUDED.username,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

  -- Deactivate cappers whose users are no longer active
  UPDATE cappers c
  SET is_active = false, updated_at = NOW()
  WHERE c.external_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = c.external_id
        AND u.active = true
    );

  GET DIAGNOSTICS synced_count = ROW_COUNT;
  RETURN synced_count;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION sync_cappers_from_users() TO service_role;

COMMENT ON TABLE cappers IS 'SPRINT-SMARTFORM-CANONICAL-ENTITIES-089: Cappers synced from users table';

-- ============================================================================
-- ROLLBACK (manual execution if needed):
-- ============================================================================
-- DROP FUNCTION IF EXISTS sync_cappers_from_users();
-- DROP FUNCTION IF EXISTS get_active_cappers();
-- ALTER TABLE cappers DROP COLUMN IF EXISTS external_id;
-- ALTER TABLE cappers DROP COLUMN IF EXISTS username;
-- DELETE FROM cappers;
-- -- Re-run original seed data if needed
