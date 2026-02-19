-- ============================================================================
-- PR9: Update MV_REFRESH_LAG Playbook to EXECUTABLE
--
-- This migration runs AFTER 20260120_pr9_mv_refresh_infrastructure.sql
-- to update the MV_REFRESH_LAG playbook from RECOMMENDATION_ONLY to EXECUTABLE
-- now that the MV refresh infrastructure exists.
-- ============================================================================

-- Update the playbook to EXECUTABLE
UPDATE ops.remediation_playbooks
SET
  execution_type = 'EXECUTABLE',
  description = 'Handles stale materialized views causing data freshness issues. Uses ops.logged_refresh_mv() for safe, audited refresh.',
  action_template = '{
    "action": "refresh_materialized_view",
    "view_name": "mv_pipeline_lag_24h",
    "method": "CONCURRENTLY",
    "rpc_function": "refresh_pipeline_lag_materialized_view"
  }'::JSONB,
  updated_at = NOW()
WHERE playbook_id = 'MV_REFRESH_LAG';

-- Verify the update
DO $$
DECLARE
  v_execution_type TEXT;
BEGIN
  SELECT execution_type INTO v_execution_type
  FROM ops.remediation_playbooks
  WHERE playbook_id = 'MV_REFRESH_LAG';

  IF v_execution_type != 'EXECUTABLE' THEN
    RAISE WARNING 'MV_REFRESH_LAG playbook not updated to EXECUTABLE. Current: %', v_execution_type;
  ELSE
    RAISE NOTICE 'MV_REFRESH_LAG playbook updated to EXECUTABLE successfully';
  END IF;
END;
$$;
