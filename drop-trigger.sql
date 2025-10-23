-- Drop the restrictive trigger that prevents scoring column updates
DROP TRIGGER IF EXISTS trg_enforce_processed_at_only ON public.raw_props;
