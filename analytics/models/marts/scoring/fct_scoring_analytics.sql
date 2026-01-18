-- ===============================================================================
-- Fact Table: fct_scoring_analytics
-- Purpose: ML model ingestion and scoring analytics
-- Materialization: Table (incremental)
-- Grain: One row per internal_score (one per pick)
-- ===============================================================================

{{
  config(
    materialized='incremental',
    unique_key='internal_score_id',
    schema='analytics',
    on_schema_change='sync_all_columns',
    incremental_strategy='merge'
  )
}}

WITH internal_scores AS (
  SELECT * FROM {{ ref('stg_internal_scores') }}
  {% if is_incremental() %}
  WHERE scored_at > (SELECT MAX(scored_at) FROM {{ this }})
  {% endif %}
),

picks AS (
  SELECT * FROM {{ ref('stg_picks') }}
),

final AS (
  SELECT
    -- Primary Keys
    i.internal_score_id,
    i.tenant_id,
    i.pick_id,

    -- Pick Context
    p.user_id,
    p.sport,
    p.league,
    p.player_name,
    p.stat_type,
    p.selection,
    p.odds,
    p.status AS pick_status,
    p.is_win,

    -- Core Score Components
    i.professional_score,
    i.score_tier,

    -- Probability & Edge
    i.devigged_win_prob,
    i.devigged_edge,
    i.true_odds,
    i.implied_prob,

    -- Advanced Metrics
    i.clv_pct,
    i.clv_tier,
    i.kelly_fraction,
    i.sharp_money_alignment,
    i.steam_move_detected,

    -- Market Intelligence
    i.market_efficiency_score,
    i.reverse_line_movement,
    i.public_betting_pct,
    i.sharp_betting_pct,

    -- Model Features (for ML training)
    i.timing_score,
    i.line_shopping_score,
    i.correlation_risk,
    i.recency_bias_adj,

    -- ML Model Predictions
    i.win_probability_model_v1,
    i.win_probability_model_v2,
    i.expected_value,
    i.variance,

    -- Historical Context Features
    i.player_form_score,
    i.matchup_score,
    i.venue_impact_score,
    i.weather_impact_score,

    -- Grading Metadata
    i.grading_engine_version,
    i.features_used,
    i.model_confidence,
    i.confidence_tier,
    i.processing_time_ms,

    -- Data Quality
    i.data_completeness_score,
    i.data_quality_score_pct,
    i.feature_quality_flags,

    -- Derived Analytics Metrics
    CASE
      WHEN i.steam_move_detected AND p.is_win = 1 THEN 'steam_win'
      WHEN i.steam_move_detected AND p.is_win = 0 THEN 'steam_loss'
      WHEN NOT i.steam_move_detected AND p.is_win = 1 THEN 'non_steam_win'
      WHEN NOT i.steam_move_detected AND p.is_win = 0 THEN 'non_steam_loss'
      ELSE 'pending'
    END AS steam_outcome_category,

    CASE
      WHEN i.sharp_money_alignment > 0.7 THEN 'high_sharp_alignment'
      WHEN i.sharp_money_alignment > 0.5 THEN 'medium_sharp_alignment'
      WHEN i.sharp_money_alignment > 0.3 THEN 'low_sharp_alignment'
      ELSE 'no_sharp_alignment'
    END AS sharp_alignment_category,

    -- Model Performance Tracking
    ABS(i.win_probability_model_v1 - p.is_win) AS model_v1_error,
    ABS(i.win_probability_model_v2 - p.is_win) AS model_v2_error,

    -- Timestamps
    i.scored_at,
    i.scored_date,
    i.scored_week,
    i.scored_month,
    p.published_at,
    p.settled_at,

    -- Metadata
    CURRENT_TIMESTAMP AS dbt_updated_at

  FROM internal_scores i
  LEFT JOIN picks p ON i.pick_id = p.pick_id
)

SELECT * FROM final
