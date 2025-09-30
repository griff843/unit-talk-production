-- Add auto-enqueue trigger to existing scoring_queue system
-- Run this after 20250927_scoring_queue.sql

-- 1) Add unique constraint to prevent duplicate queue entries
ALTER TABLE public.scoring_queue
ADD CONSTRAINT IF NOT EXISTS unique_pick_in_queue UNIQUE (pick_id);

-- 2) Trigger function to auto-enqueue picks for scoring
CREATE OR REPLACE FUNCTION public.auto_enqueue_pick_for_scoring()
RETURNS TRIGGER AS $$
BEGIN
    -- Only enqueue if professional_score is null (unscored)
    IF NEW.professional_score IS NULL THEN
        INSERT INTO public.scoring_queue (pick_id, status)
        VALUES (NEW.id, 'PENDING')
        ON CONFLICT (pick_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_enqueue_scoring ON public.unified_picks;

-- 4) Create trigger on unified_picks INSERT to auto-enqueue
CREATE TRIGGER trigger_auto_enqueue_scoring
    AFTER INSERT ON public.unified_picks
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_enqueue_pick_for_scoring();

-- 5) Comments for documentation
COMMENT ON FUNCTION public.auto_enqueue_pick_for_scoring IS 'Auto-enqueues newly inserted picks to scoring_queue when professional_score is null';
COMMENT ON TRIGGER trigger_auto_enqueue_scoring ON public.unified_picks IS 'Automatically enqueues picks for scoring after insertion';