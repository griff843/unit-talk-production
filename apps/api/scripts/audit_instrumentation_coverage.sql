-- ============================================================================
-- AUDIT: INTELLIGENCE INSTRUMENTATION COVERAGE
-- Sprint: PHASE_2B_INTELLIGENCE_SUPERIORITY_REAUDIT-003
-- Date: 2026-03-01
--
-- READ-ONLY audit queries to measure probability instrumentation coverage
-- ============================================================================

-- ============================================================================
-- QUERY 1: OVERALL INSTRUMENTATION COVERAGE
-- % of scored_legs with probability primitives populated
-- ============================================================================
SELECT
  'Instrumentation Coverage' AS metric_group,
  COUNT(*) AS total_scored_legs,
  COUNT(p_final) AS with_p_final,
  COUNT(uncertainty_final) AS with_uncertainty,
  COUNT(edge_final) AS with_edge,
  COUNT(clv_forecast) AS with_clv_forecast,
  COUNT(p_market_devig) AS with_p_market_devig,
  COUNT(devig_method) AS with_devig_method,
  COUNT(consensus_weights_json) AS with_consensus_weights,
  COUNT(probability_model_version) AS with_model_version,
  ROUND(COUNT(p_final)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS pct_p_final,
  ROUND(COUNT(uncertainty_final)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS pct_uncertainty,
  ROUND(COUNT(edge_final)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS pct_edge,
  ROUND(COUNT(p_market_devig)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS pct_p_market
FROM scored_legs;

-- ============================================================================
-- QUERY 2: RECENT COVERAGE (last 7 days)
-- ============================================================================
SELECT
  'Recent Coverage (7d)' AS metric_group,
  COUNT(*) AS total_scored_legs,
  COUNT(p_final) AS with_p_final,
  ROUND(COUNT(p_final)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS pct_p_final,
  COUNT(p_market_devig) AS with_p_market,
  ROUND(COUNT(p_market_devig)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS pct_p_market,
  COUNT(CASE WHEN p_final IS NOT NULL AND p_market_devig IS NOT NULL AND edge_final IS NOT NULL THEN 1 END) AS fully_instrumented,
  ROUND(COUNT(CASE WHEN p_final IS NOT NULL AND p_market_devig IS NOT NULL AND edge_final IS NOT NULL THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS pct_fully_instrumented
FROM scored_legs
WHERE scored_at_utc >= NOW() - INTERVAL '7 days';

-- ============================================================================
-- QUERY 3: BOOKS_USED DISTRIBUTION
-- Shows how many books are typically used for consensus
-- ============================================================================
SELECT
  jsonb_array_length(
    COALESCE(
      (SELECT jsonb_agg(key) FROM jsonb_object_keys(consensus_weights_json) AS key),
      '[]'::jsonb
    )
  ) AS books_used,
  COUNT(*) AS count,
  ROUND(COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER() * 100, 2) AS pct
FROM scored_legs
WHERE consensus_weights_json IS NOT NULL
GROUP BY 1
ORDER BY 1;

-- ============================================================================
-- QUERY 4: EDGE DISTRIBUTION STATISTICS
-- ============================================================================
SELECT
  'Edge Distribution' AS metric_group,
  COUNT(*) AS sample_size,
  ROUND(AVG(edge_final)::NUMERIC, 5) AS mean_edge,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY edge_final)::NUMERIC, 5) AS median_edge,
  ROUND(PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY edge_final)::NUMERIC, 5) AS p5_edge,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY edge_final)::NUMERIC, 5) AS p95_edge,
  ROUND(MIN(edge_final)::NUMERIC, 5) AS min_edge,
  ROUND(MAX(edge_final)::NUMERIC, 5) AS max_edge,
  ROUND(STDDEV(edge_final)::NUMERIC, 5) AS stddev_edge
FROM scored_legs
WHERE edge_final IS NOT NULL;

-- ============================================================================
-- QUERY 5: P_FINAL DISTRIBUTION (sanity check for realism)
-- ============================================================================
SELECT
  'P_final Distribution' AS metric_group,
  COUNT(*) AS sample_size,
  ROUND(AVG(p_final)::NUMERIC, 4) AS mean_p,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY p_final)::NUMERIC, 4) AS median_p,
  ROUND(PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY p_final)::NUMERIC, 4) AS p5,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY p_final)::NUMERIC, 4) AS p95,
  ROUND(MIN(p_final)::NUMERIC, 4) AS min_p,
  ROUND(MAX(p_final)::NUMERIC, 4) AS max_p,
  COUNT(CASE WHEN p_final < 0.4 OR p_final > 0.6 THEN 1 END) AS extreme_count,
  ROUND(COUNT(CASE WHEN p_final < 0.4 OR p_final > 0.6 THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS pct_extreme
FROM scored_legs
WHERE p_final IS NOT NULL;

-- ============================================================================
-- QUERY 6: DEVIG METHOD DISTRIBUTION
-- ============================================================================
SELECT
  devig_method,
  COUNT(*) AS count,
  ROUND(COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER() * 100, 2) AS pct
FROM scored_legs
WHERE devig_method IS NOT NULL
GROUP BY devig_method
ORDER BY count DESC;

-- ============================================================================
-- QUERY 7: MODEL VERSION DISTRIBUTION
-- ============================================================================
SELECT
  probability_model_version,
  COUNT(*) AS count,
  MIN(scored_at_utc) AS first_seen,
  MAX(scored_at_utc) AS last_seen
FROM scored_legs
WHERE probability_model_version IS NOT NULL
GROUP BY probability_model_version
ORDER BY last_seen DESC;

-- ============================================================================
-- QUERY 8: UNCERTAINTY DISTRIBUTION (for risk throttling)
-- ============================================================================
SELECT
  'Uncertainty Distribution' AS metric_group,
  COUNT(*) AS sample_size,
  ROUND(AVG(uncertainty_final)::NUMERIC, 4) AS mean_uncertainty,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY uncertainty_final)::NUMERIC, 4) AS median_uncertainty,
  ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY uncertainty_final)::NUMERIC, 4) AS p90_uncertainty,
  COUNT(CASE WHEN uncertainty_final > 0.15 THEN 1 END) AS high_uncertainty_count,
  ROUND(COUNT(CASE WHEN uncertainty_final > 0.15 THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS pct_high_uncertainty
FROM scored_legs
WHERE uncertainty_final IS NOT NULL;

-- ============================================================================
-- END OF AUDIT QUERIES
-- ============================================================================
