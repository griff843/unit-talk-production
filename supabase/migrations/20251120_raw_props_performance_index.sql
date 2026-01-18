-- 2025-11-20: Optimize raw_props query performance for ProfessionalPropProcessor
-- Purpose: Add partial index to prevent statement timeouts when querying unprocessed props
-- Context: v3.0.0 unified schema, professional grading pipeline reads from raw_props

-- Partial index for unprocessed raw props used by ProfessionalPropProcessor.getUnprocessedRawProps()
CREATE INDEX IF NOT EXISTS idx_raw_props_unprocessed_created_at
ON public.raw_props (created_at)
WHERE processed_at IS NULL
  AND error_message IS NULL;

COMMENT ON INDEX idx_raw_props_unprocessed_created_at IS
  'Supports ProfessionalPropProcessor.getUnprocessedRawProps() for unprocessed props filtered by created_at, processed_at IS NULL, error_message IS NULL.';

-- Ensure PostgREST sees new index
SELECT pg_notify('pgrst', 'reload schema');

