-- Fix promotion_queue.reason column to allow NULL or have default
ALTER TABLE public.promotion_queue
  ALTER COLUMN reason DROP NOT NULL;

-- Update submit_pick RPC to handle NULL reason
CREATE OR REPLACE FUNCTION public.submit_pick(
  p_unified_pick_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_org_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue_id UUID;
BEGIN
  -- Check if already pending
  SELECT id INTO v_queue_id
  FROM public.promotion_queue
  WHERE prop_ref = p_unified_pick_id
    AND status = 'pending'
  LIMIT 1;

  -- If found, return existing
  IF v_queue_id IS NOT NULL THEN
    RETURN v_queue_id;
  END IF;

  -- Insert new queue entry with reason
  INSERT INTO public.promotion_queue (prop_ref, status, reason, created_at)
  VALUES (p_unified_pick_id, 'pending', COALESCE(p_reason, 'Submitted for approval'), NOW())
  RETURNING id INTO v_queue_id;

  RETURN v_queue_id;
END;
$$;
