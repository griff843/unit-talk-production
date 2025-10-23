BEGIN;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Create scored_props if not exists
CREATE TABLE IF NOT EXISTS public.scored_props (
  prop_ref UUID PRIMARY KEY,
  edge NUMERIC,
  prob_win NUMERIC,
  professional_score NUMERIC,
  tier TEXT,
  confidence NUMERIC,
  kelly_fraction NUMERIC,
  clv_pct NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to scored_props (idempotent)
ALTER TABLE public.scored_props
  ADD COLUMN IF NOT EXISTS edge NUMERIC,
  ADD COLUMN IF NOT EXISTS prob_win NUMERIC,
  ADD COLUMN IF NOT EXISTS professional_score NUMERIC,
  ADD COLUMN IF NOT EXISTS tier TEXT,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC,
  ADD COLUMN IF NOT EXISTS kelly_fraction NUMERIC,
  ADD COLUMN IF NOT EXISTS clv_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Create promotion_queue if not exists
CREATE TABLE IF NOT EXISTS public.promotion_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prop_ref UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','published')) DEFAULT 'pending',
  publish_at TIMESTAMPTZ,
  approved_by UUID,
  denied_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to promotion_queue (idempotent)
ALTER TABLE public.promotion_queue
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS denied_by UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add constraint if missing (non-blocking)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pq_status_check'
    AND conrelid = 'public.promotion_queue'::regclass
  ) THEN
    ALTER TABLE public.promotion_queue
    ADD CONSTRAINT pq_status_check
    CHECK (status IN ('pending','approved','rejected','published'));
  END IF;
END $$;

-- ============================================================================
-- INDEXES (non-concurrent to work inside transaction)
-- ============================================================================

-- Scored props tier+edge index
CREATE INDEX IF NOT EXISTS idx_scored_props_tier_edge
  ON public.scored_props(tier, edge DESC NULLS LAST)
  WHERE tier IN ('S','A','B');

-- Promotion queue status+created index
CREATE INDEX IF NOT EXISTS idx_pq_status_created
  ON public.promotion_queue(status, created_at DESC);

-- FK constraint (NOT VALID to avoid lock)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_pq_unified_picks'
    AND conrelid = 'public.promotion_queue'::regclass
  ) THEN
    ALTER TABLE public.promotion_queue
    ADD CONSTRAINT fk_pq_unified_picks
    FOREIGN KEY (prop_ref) REFERENCES public.unified_picks(id)
    NOT VALID;
  END IF;
END $$;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- v_daily_board: Today's picks with scoring and queue status
CREATE OR REPLACE VIEW public.v_daily_board AS
SELECT
  u.id                               AS prop_id,
  u.sport,
  u.market,
  u.selection,
  u.line,
  u.odds,
  u.book                             AS bookmaker_key,
  u.best_book,
  u.best_available_line,
  u.game_date,
  u.game_time,
  u.player_name,
  u.team,
  u.opponent,
  s.edge,
  s.prob_win,
  s.professional_score,
  s.tier,
  s.confidence,
  s.kelly_fraction,
  s.clv_pct,
  pq.status                          AS queue_status,
  pq.publish_at,
  pq.approved_by,
  pq.denied_by
FROM public.unified_picks u
LEFT JOIN public.scored_props     s  ON s.prop_ref = u.id
LEFT JOIN public.promotion_queue  pq ON pq.prop_ref = u.id
WHERE u.game_date >= (NOW()::DATE)
ORDER BY
  CASE COALESCE(s.tier,'C')
    WHEN 'S' THEN 0
    WHEN 'A' THEN 1
    WHEN 'B' THEN 2
    WHEN 'C' THEN 3
    ELSE 9
  END,
  s.edge DESC NULLS LAST,
  u.game_date,
  u.game_time NULLS LAST;

-- v_prop_read_model: All picks with scoring data
CREATE OR REPLACE VIEW public.v_prop_read_model AS
SELECT
  u.id AS prop_ref,
  u.sport,
  u.market,
  u.selection,
  u.line,
  u.odds,
  u.over_odds,
  u.under_odds,
  u.book AS bookmaker,
  u.best_available_line,
  u.best_book,
  u.player_name,
  u.team,
  u.opponent,
  u.game_date,
  u.game_time,
  s.edge,
  s.prob_win,
  s.professional_score,
  s.tier,
  s.confidence,
  s.kelly_fraction,
  s.clv_pct
FROM public.unified_picks u
LEFT JOIN public.scored_props s ON s.prop_ref = u.id;

-- v_open_promotions: Pending picks in promotion queue
CREATE OR REPLACE VIEW public.v_open_promotions AS
SELECT
  pq.id AS queue_id,
  pq.prop_ref,
  pq.status,
  pq.publish_at,
  u.sport,
  u.market,
  u.selection,
  u.line,
  u.odds,
  u.player_name,
  u.team,
  u.opponent,
  u.game_date,
  u.game_time,
  s.edge,
  s.prob_win,
  s.tier
FROM public.promotion_queue pq
JOIN public.unified_picks u ON u.id = pq.prop_ref
LEFT JOIN public.scored_props s ON s.prop_ref = pq.prop_ref
WHERE pq.status = 'pending'
ORDER BY pq.created_at DESC, s.edge DESC NULLS LAST;

-- ============================================================================
-- RPCs
-- ============================================================================

-- submit_pick: Add pick to promotion queue
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

  -- Insert new queue entry
  INSERT INTO public.promotion_queue (prop_ref, status, created_at)
  VALUES (p_unified_pick_id, 'pending', NOW())
  RETURNING id INTO v_queue_id;

  RETURN v_queue_id;
END;
$$;

-- approve_pick: Approve a queued pick
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

-- deny_pick: Deny a queued pick
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

COMMIT;
