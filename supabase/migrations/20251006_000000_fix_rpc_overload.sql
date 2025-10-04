-- Fix RPC overloading issue - ensure single signature for approve_pick

-- Drop any existing versions
DROP FUNCTION IF EXISTS public.approve_pick(uuid, character varying, text);
DROP FUNCTION IF EXISTS public.approve_pick(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.approve_pick(uuid, text, text);

-- Create single canonical version
CREATE OR REPLACE FUNCTION public.approve_pick(
  p_queue_id UUID,
  p_approved_by UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.promotion_queue
  SET
    status = 'approved',
    approved_by = p_approved_by,
    publish_at = COALESCE(publish_at, NOW())
  WHERE id = p_queue_id
    AND status IN ('pending', 'approved'); -- Idempotent: allow re-approval

  IF NOT FOUND THEN
    RAISE NOTICE 'Queue entry % not found or already processed', p_queue_id;
  END IF;
END;
$$;

-- Also fix deny_pick for consistency
DROP FUNCTION IF EXISTS public.deny_pick(uuid, character varying, text);
DROP FUNCTION IF EXISTS public.deny_pick(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.deny_pick(uuid, text, text);

CREATE OR REPLACE FUNCTION public.deny_pick(
  p_queue_id UUID,
  p_denied_by UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.promotion_queue
  SET
    status = 'rejected',
    denied_by = p_denied_by
  WHERE id = p_queue_id
    AND status IN ('pending', 'rejected'); -- Idempotent: allow re-denial

  IF NOT FOUND THEN
    RAISE NOTICE 'Queue entry % not found or already processed', p_queue_id;
  END IF;
END;
$$;
