-- Migration: Create cappers table
-- Sprint: SPRINT-SMARTFORM-ENTITY-AUTOFILL-088
-- Purpose: Store capper entities for ticket attribution
-- Rollback: DROP TABLE IF EXISTS cappers;

-- ============================================================================
-- CAPPERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS cappers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for active cappers lookup
CREATE INDEX IF NOT EXISTS idx_cappers_active ON cappers(is_active) WHERE is_active = true;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_cappers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cappers_updated_at ON cappers;
CREATE TRIGGER trigger_cappers_updated_at
  BEFORE UPDATE ON cappers
  FOR EACH ROW
  EXECUTE FUNCTION update_cappers_updated_at();

-- ============================================================================
-- SEED DATA - At least 2 active cappers for testing
-- ============================================================================

INSERT INTO cappers (id, display_name, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Main Capper', true),
  ('00000000-0000-0000-0000-000000000002', 'Alt Capper', true),
  ('00000000-0000-0000-0000-000000000003', 'Guest Capper', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- RPC: Get active cappers for dropdown
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_cappers()
RETURNS TABLE (
  id UUID,
  display_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.display_name
  FROM cappers c
  WHERE c.is_active = true
  ORDER BY c.display_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant access
GRANT EXECUTE ON FUNCTION get_active_cappers() TO authenticated, anon, service_role;

COMMENT ON TABLE cappers IS 'SPRINT-SMARTFORM-ENTITY-AUTOFILL-088: Capper entities for ticket attribution';
