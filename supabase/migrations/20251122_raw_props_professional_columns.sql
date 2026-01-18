-- 2025-11-22: Phase 15 – raw_props professional processing columns (canonical)
-- Align Supabase schema with ProfessionalPropProcessor expectations
-- and v3.0.0 unified schema (processed_at/error_message gating).

-- Enhance raw_props for professional processing / idempotency
ALTER TABLE public.raw_props
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_by varchar(100),
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS error_at timestamptz,
  ADD COLUMN IF NOT EXISTS opening_line numeric(10,2),
  ADD COLUMN IF NOT EXISTS opening_over_odds integer,
  ADD COLUMN IF NOT EXISTS opening_under_odds integer,
  ADD COLUMN IF NOT EXISTS book varchar(100) DEFAULT 'aggregated',
  ADD COLUMN IF NOT EXISTS market_open_time timestamptz DEFAULT now();

-- Processing/index alignment (complements idx_raw_props_unprocessed_created_at)
CREATE INDEX IF NOT EXISTS idx_raw_props_processing
  ON public.raw_props(processed_at, processed_by);

-- Documentation
COMMENT ON COLUMN public.raw_props.processed_at IS 'When this prop was processed by professional system; NULL = unprocessed';
COMMENT ON COLUMN public.raw_props.processed_by IS 'Which system processed this prop (e.g., professional_system)';
COMMENT ON COLUMN public.raw_props.error_message IS 'Last professional processing error message, if any';
COMMENT ON COLUMN public.raw_props.opening_line IS 'Opening line used for CLV tracking';
COMMENT ON COLUMN public.raw_props.opening_over_odds IS 'Opening over odds used for CLV tracking';
COMMENT ON COLUMN public.raw_props.opening_under_odds IS 'Opening under odds used for CLV tracking';
COMMENT ON COLUMN public.raw_props.book IS 'Source book for this raw prop (aggregated or specific book)';
COMMENT ON COLUMN public.raw_props.market_open_time IS 'Approximate market open time for this prop';

-- Ensure PostgREST sees new columns immediately
NOTIFY pgrst, 'reload schema';

