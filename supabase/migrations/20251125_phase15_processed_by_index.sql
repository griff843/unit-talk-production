-- 2025-11-25: Phase 15 Production Readiness - Monitoring Query Optimization
-- Purpose: Add partial index to optimize monitoring queries for processed props
-- Context: Governance audit identified query timeout risk at scale (21→10k+ props)
-- Reference: PHASE15_PRODUCTION_DECISION.md - Priority #1 recommendation

-- Partial index for monitoring queries filtering by processed_by column
-- Complements existing idx_raw_props_processing (processed_at, processed_by) composite index
-- This dedicated index optimizes queries that filter ONLY by processed_by value
CREATE INDEX IF NOT EXISTS idx_raw_props_processed_by
ON public.raw_props (processed_by)
WHERE processed_by IS NOT NULL;

COMMENT ON INDEX idx_raw_props_processed_by IS
  'Optimizes monitoring queries filtering by processed_by value. Supports production-scale queries for processed props tracking and system health monitoring. Partial index includes only rows where processed_by IS NOT NULL for efficiency.';

-- Ensure PostgREST sees new index immediately
NOTIFY pgrst, 'reload schema';
