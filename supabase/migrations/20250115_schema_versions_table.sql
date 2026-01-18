-- ===============================================================================
-- SCHEMA VERSION TRACKING TABLE
-- Date: 2025-01-15
-- Purpose: Track schema migrations and version history for audit and governance
-- Version: 1.0.0
-- Charter Compliance: Fail-closed governance, Git as single source of truth
-- ===============================================================================

-- ===============================================================================
-- 1. CREATE schema_versions TABLE
-- ===============================================================================

CREATE TABLE IF NOT EXISTS schema_versions (
  id SERIAL PRIMARY KEY,
  version VARCHAR(50) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by VARCHAR(255) NOT NULL,
  migrations TEXT NOT NULL,
  git_commit VARCHAR(50) NOT NULL,
  environment VARCHAR(20) NOT NULL CHECK (environment IN ('dev', 'staging', 'prod')),
  status VARCHAR(20) NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'rolled_back', 'failed')),
  duration_ms INTEGER,
  migration_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===============================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ===============================================================================

-- Index for querying by environment
CREATE INDEX IF NOT EXISTS idx_schema_versions_environment
ON schema_versions(environment);

-- Index for querying by applied_at (most recent first)
CREATE INDEX IF NOT EXISTS idx_schema_versions_applied_at
ON schema_versions(applied_at DESC);

-- Index for querying by git commit
CREATE INDEX IF NOT EXISTS idx_schema_versions_git_commit
ON schema_versions(git_commit);

-- Composite index for environment + status queries
CREATE INDEX IF NOT EXISTS idx_schema_versions_env_status
ON schema_versions(environment, status, applied_at DESC);

-- ===============================================================================
-- 3. ADD TABLE COMMENTS
-- ===============================================================================

COMMENT ON TABLE schema_versions IS 'Tracks all schema migration versions applied to this database. Part of fail-closed governance model where Git is single source of truth.';

COMMENT ON COLUMN schema_versions.version IS 'Short version identifier (usually first 8 chars of git commit SHA)';
COMMENT ON COLUMN schema_versions.applied_by IS 'Actor who triggered migration (GitHub username or CI/CD identifier)';
COMMENT ON COLUMN schema_versions.migrations IS 'Comma-separated list of migration filenames applied in this deployment';
COMMENT ON COLUMN schema_versions.git_commit IS 'Full git commit SHA from which migrations were applied';
COMMENT ON COLUMN schema_versions.environment IS 'Target environment: dev, staging, or prod';
COMMENT ON COLUMN schema_versions.status IS 'Migration status: applied, rolled_back, or failed';
COMMENT ON COLUMN schema_versions.duration_ms IS 'Total time taken to apply all migrations in milliseconds';
COMMENT ON COLUMN schema_versions.migration_count IS 'Number of migration files applied';

-- ===============================================================================
-- 4. CREATE VIEW FOR LATEST VERSION PER ENVIRONMENT
-- ===============================================================================

CREATE OR REPLACE VIEW vw_latest_schema_versions AS
SELECT DISTINCT ON (environment)
  environment,
  version,
  applied_at,
  applied_by,
  git_commit,
  migration_count,
  status
FROM schema_versions
WHERE status = 'applied'
ORDER BY environment, applied_at DESC;

COMMENT ON VIEW vw_latest_schema_versions IS 'Shows the most recent successful migration version for each environment';

-- ===============================================================================
-- 5. CREATE FUNCTION TO UPDATE updated_at TIMESTAMP
-- ===============================================================================

CREATE OR REPLACE FUNCTION update_schema_versions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===============================================================================
-- 6. CREATE TRIGGER FOR AUTO-UPDATING updated_at
-- ===============================================================================

DROP TRIGGER IF EXISTS trigger_update_schema_versions_updated_at ON schema_versions;

CREATE TRIGGER trigger_update_schema_versions_updated_at
  BEFORE UPDATE ON schema_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_schema_versions_updated_at();

-- ===============================================================================
-- 7. ENABLE ROW LEVEL SECURITY (RLS)
-- ===============================================================================

ALTER TABLE schema_versions ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read (for monitoring and auditing)
CREATE POLICY "schema_versions: Allow SELECT for all"
  ON schema_versions
  FOR SELECT
  USING (true);

-- Policy: Only service role can write (CI/CD only)
CREATE POLICY "schema_versions: Service role only writes"
  ON schema_versions
  FOR INSERT
  WITH CHECK (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
    OR current_user = 'postgres'
  );

-- Policy: No updates allowed (append-only audit log)
CREATE POLICY "schema_versions: No updates"
  ON schema_versions
  FOR UPDATE
  USING (false);

-- Policy: No deletes allowed (permanent audit trail)
CREATE POLICY "schema_versions: No deletes"
  ON schema_versions
  FOR DELETE
  USING (false);

-- ===============================================================================
-- 8. INSERT INITIAL RECORD (IF THIS IS FIRST MIGRATION WITH TRACKING)
-- ===============================================================================

-- Record this migration as the initial schema version tracking implementation
INSERT INTO schema_versions (
  version,
  applied_by,
  migrations,
  git_commit,
  environment,
  migration_count,
  notes
) VALUES (
  'baseline',
  'system',
  '20250115_schema_versions_table.sql',
  'baseline',
  COALESCE(current_setting('app.environment', true), 'dev'),
  1,
  'Initial schema_versions table creation for governance compliance'
) ON CONFLICT DO NOTHING;

-- ===============================================================================
-- 9. NOTIFY POSTGREST TO RELOAD SCHEMA
-- ===============================================================================

SELECT pg_notify('pgrst', 'reload schema');

-- ===============================================================================
-- 10. VERIFICATION QUERIES
-- ===============================================================================

-- Verify table exists and has correct structure
-- SELECT * FROM information_schema.tables WHERE table_name = 'schema_versions';

-- Verify indexes were created
-- SELECT * FROM pg_indexes WHERE tablename = 'schema_versions';

-- Verify RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'schema_versions';

-- View latest versions
-- SELECT * FROM vw_latest_schema_versions;

-- ===============================================================================
-- END OF MIGRATION
-- ===============================================================================
