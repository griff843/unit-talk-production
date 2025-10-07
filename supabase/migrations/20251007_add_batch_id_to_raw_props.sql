-- Migration: Add batch_id column to raw_props
-- Date: 2025-10-07
-- Purpose: Fix FeedAgent ingestion failure due to missing batch_id column

-- Add batch_id column to raw_props table
ALTER TABLE public.raw_props
ADD COLUMN IF NOT EXISTS batch_id TEXT;

-- Add index on batch_id for query performance
CREATE INDEX IF NOT EXISTS idx_raw_props_batch_id
ON public.raw_props(batch_id);

-- Add comment
COMMENT ON COLUMN public.raw_props.batch_id IS 'Batch identifier for grouping props from the same ingestion cycle';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
