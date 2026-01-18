-- ===============================================================================
-- vw_recent_picks View
-- Date: 2025-11-02
-- Purpose: Optimized view for Command Center recent picks display
-- ===============================================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS vw_recent_picks;

-- Create optimized view for recent picks
CREATE OR REPLACE VIEW vw_recent_picks AS
SELECT
  p.id,
  p.tenant_id,
  p.user_id,
  u.username,
  p.metadata->>'player_name' AS player_name,
  p.metadata->>'league' AS sport,
  p.metadata->>'market_type' AS market_type,
  (p.metadata->>'line')::DECIMAL AS line,
  p.selection AS side,
  p.odds,
  p.stake,
  p.confidence,
  p.status,
  p.workflow_stage,
  p.created_at,
  p.published_at,
  p.metadata->>'bet_slip_id' AS bet_slip_id,

  -- Join with pick_publish for publishing status
  pp.status AS publish_status,
  pp.sent_at AS discord_sent_at,
  pp.external_message_id AS discord_message_id,

  -- Professional grading scores if available
  s.professional_score,
  s.devigged_edge,
  s.clv_pct

FROM picks p
LEFT JOIN users u ON p.user_id = u.id AND p.tenant_id = u.tenant_id
LEFT JOIN pick_publish pp ON p.id = pp.pick_id AND pp.channel = 'DISCORD'
LEFT JOIN scores s ON p.id = s.pick_id
WHERE p.workflow_stage IN ('approved', 'published')
ORDER BY p.created_at DESC;

-- Create index on the underlying table for better view performance
CREATE INDEX IF NOT EXISTS idx_picks_workflow_created
  ON picks(tenant_id, workflow_stage, created_at DESC)
  WHERE workflow_stage IN ('approved', 'published');

-- Comments
COMMENT ON VIEW vw_recent_picks IS 'Optimized view for Command Center recent picks display with user info, publish status, and professional scores';

-- ===============================================================================
-- Grant permissions (adjust based on your security model)
-- ===============================================================================

-- Grant select to authenticated users (adjust as needed)
GRANT SELECT ON vw_recent_picks TO authenticated;
GRANT SELECT ON vw_recent_picks TO service_role;

-- ===============================================================================
-- END OF MIGRATION
-- ===============================================================================
