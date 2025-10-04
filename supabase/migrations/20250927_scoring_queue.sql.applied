-- Real-time scoring queue for automatic pick scoring
-- Created: 2025-09-27

-- 1) Create scoring_queue table
CREATE TABLE IF NOT EXISTS public.scoring_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pick_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'DONE', 'ERROR')),
    error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Unique constraint to prevent duplicate queue entries
ALTER TABLE public.scoring_queue
ADD CONSTRAINT unique_pick_in_queue UNIQUE (pick_id);

-- 3) Index for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_scoring_queue_status_created
ON public.scoring_queue(status, created_at)
WHERE status IN ('PENDING', 'PROCESSING');

-- 3) Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.update_scoring_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_scoring_queue_updated_at
    BEFORE UPDATE ON public.scoring_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_scoring_queue_updated_at();

-- 4) RPC for atomic dequeue with SKIP LOCKED
CREATE OR REPLACE FUNCTION public.dequeue_scoring_job(batch_size int DEFAULT 50)
RETURNS TABLE (
    id uuid,
    pick_id uuid,
    created_at timestamptz
) AS $$
BEGIN
    RETURN QUERY
    UPDATE public.scoring_queue sq
    SET status = 'PROCESSING',
        updated_at = now()
    FROM (
        SELECT sq2.id
        FROM public.scoring_queue sq2
        WHERE sq2.status = 'PENDING'
        ORDER BY sq2.created_at ASC
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED
    ) sub
    WHERE sq.id = sub.id
    RETURNING sq.id, sq.pick_id, sq.created_at;
END;
$$ LANGUAGE plpgsql;

-- 5) RLS OFF (using service role for workers)
ALTER TABLE public.scoring_queue DISABLE ROW LEVEL SECURITY;

-- 6) Trigger function to auto-enqueue picks for scoring
CREATE OR REPLACE FUNCTION public.auto_enqueue_pick_for_scoring()
RETURNS TRIGGER AS $$
BEGIN
    -- Only enqueue if professional_score is null (unscored)
    IF NEW.professional_score IS NULL THEN
        INSERT INTO public.scoring_queue (pick_id, status)
        VALUES (NEW.id, 'PENDING')
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7) Trigger on unified_picks INSERT to auto-enqueue
CREATE TRIGGER trigger_auto_enqueue_scoring
    AFTER INSERT ON public.unified_picks
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_enqueue_pick_for_scoring();

-- 8) Comment for documentation
COMMENT ON TABLE public.scoring_queue IS 'Queue for real-time pick scoring - processes picks asynchronously after ingestion';
COMMENT ON FUNCTION public.dequeue_scoring_job IS 'Atomically dequeues pending scoring jobs using FOR UPDATE SKIP LOCKED to prevent race conditions';
COMMENT ON FUNCTION public.auto_enqueue_pick_for_scoring IS 'Auto-enqueues newly inserted picks to scoring_queue when professional_score is null';
COMMENT ON TRIGGER trigger_auto_enqueue_scoring ON public.unified_picks IS 'Automatically enqueues picks for scoring after insertion';