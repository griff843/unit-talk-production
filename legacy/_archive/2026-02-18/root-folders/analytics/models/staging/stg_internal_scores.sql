-- ===============================================================================
-- Staging Model: stg_internal_scores
-- Purpose: Cleaned and typed internal scoring data for ML model ingestion
-- Materialization: View
-- Reference: Phase 11 internal_scores table
-- ===============================================================================

{{
  config(
    materialized='view',
    schema='staging'
  )
}}

WITH source AS (
  SELECT *
  FROM {{ source('public', 'internal_scores') }}
),

cleaned AS (
  SELECT
    -- Primary Keys
    id AS internal_score_id,
    tenant_id,
    pick_id,

    -- Core Score Components
    professional_score,

    -- Probability & Edge
    devigged_win_prob,
    devigged_edge,
    true_odds,
    implied_prob,

    -- Advanced Metrics
    clv_pct,
    kelly_fraction,
    sharp_money_alignment,
    steam_move_detected,

    -- Market Intelligence
    market_efficiency_score,
    reverse_line_movement,
    public_betting_pct,
    sharp_betting_pct,

    -- Model Features
    timing_score,
    line_shopping_score,
    correlation_risk,
    recency_bias_adj,

    -- ML Model Predictions
    win_probability_model_v1,
    win_probability_model_v2,
    expected_value,
    variance,

    -- Historical Context
    player_form_score,
    matchup_score,
    venue_impact_score,
    weather_impact_score,

    -- Grading Metadata
    grading_engine_version,
    features_used,
    model_confidence,
    processing_time_ms,

    -- Data Quality
    data_completeness_score,
    feature_quality_flags,

    -- Timestamps
    scored_at,
    created_at,
    updated_at,

    -- Metadata
    metadata,

    -- Derived Columns
    CASE
      WHEN clv_pct >= 5.0 THEN 'elite'
      WHEN clv_pct >= 2.0 THEN 'strong'
      WHEN clv_pct >= 0.5 THEN 'good'
      WHEN clv_pct >= -0.5 THEN 'neutral'
      ELSE 'poor'
    END AS clv_tier,

    CASE
      WHEN professional_score >= 80 THEN 'elite'
      WHEN professional_score >= 70 THEN 'strong'
      WHEN professional_score >= 60 THEN 'good'
      WHEN professional_score >= 50 THEN 'average'
      ELSE 'below_average'
    END AS score_tier,

    CASE
      WHEN model_confidence >= 0.90 THEN 'very_high'
      WHEN model_confidence >= 0.75 THEN 'high'
      WHEN model_confidence >= 0.60 THEN 'medium'
      WHEN model_confidence >= 0.40 THEN 'low'
      ELSE 'very_low'
    END AS confidence_tier,

    DATE(scored_at) AS scored_date,
    DATE_TRUNC('week', scored_at) AS scored_week,
    DATE_TRUNC('month', scored_at) AS scored_month,

    -- Data Quality Score (0-100)
    ROUND(
      COALESCE(data_completeness_score, 0) * 100,
      2
    ) AS data_quality_score_pct

  FROM source
)

SELECT * FROM cleaned
