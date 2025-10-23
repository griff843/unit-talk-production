-- Create function to update prop scores (bypasses RLS with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION update_prop_scores(
  p_prop_id UUID,
  p_professional_score NUMERIC,
  p_tier TEXT,
  p_edge_score INTEGER,
  p_confidence_score INTEGER,
  p_kelly_fraction NUMERIC
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE raw_props
  SET
    professional_score = p_professional_score,
    tier = p_tier,
    edge_score = p_edge_score,
    confidence_score = p_confidence_score,
    kelly_fraction = p_kelly_fraction,
    pro_attempts = COALESCE(pro_attempts, 0) + 1,
    processed_at = NOW()
  WHERE id = p_prop_id;
END;
$$;

-- Grant execute to authenticated users and service role
GRANT EXECUTE ON FUNCTION update_prop_scores TO authenticated;
GRANT EXECUTE ON FUNCTION update_prop_scores TO service_role;
