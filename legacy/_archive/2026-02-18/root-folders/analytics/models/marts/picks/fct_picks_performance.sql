-- ===============================================================================
-- Fact Table: fct_picks_performance
-- Purpose: Core picks performance metrics for analytics dashboards
-- Materialization: Table (incremental)
-- Grain: One row per pick
-- ===============================================================================

{{
  config(
    materialized='incremental',
    unique_key='pick_id',
    schema='analytics',
    on_schema_change='sync_all_columns',
    incremental_strategy='merge'
  )
}}

WITH picks AS (
  SELECT * FROM {{ ref('stg_picks') }}
  {% if is_incremental() %}
  WHERE published_at > (SELECT MAX(published_at) FROM {{ this }})
  {% endif %}
),

internal_scores AS (
  SELECT * FROM {{ ref('stg_internal_scores') }}
),

users AS (
  SELECT
    id AS user_id,
    tenant_id,
    username,
    tier AS user_tier,
    total_picks,
    won_picks,
    lost_picks,
    win_rate
  FROM {{ source('public', 'users') }}
),

props AS (
  SELECT
    id AS prop_id,
    sport,
    league,
    player_name,
    team,
    stat_type,
    line,
    game_date
  FROM {{ source('public', 'props') }}
),

final AS (
  SELECT
    -- Primary Keys
    p.pick_id,
    p.tenant_id,
    p.user_id,
    p.prop_id,

    -- User Dimensions
    u.username AS capper_name,
    u.user_tier AS capper_tier,

    -- Pick Details
    p.selection,
    p.odds,
    p.stake,
    p.confidence,
    p.status,
    p.result,

    -- Prop Details
    pr.sport,
    pr.league,
    pr.player_name,
    pr.team,
    pr.stat_type,
    pr.line AS prop_line,
    pr.game_date,

    -- Performance Metrics
    p.profit_loss,
    p.professional_score,
    p.is_win,

    -- Internal Scoring Metrics
    i.clv_pct,
    i.clv_tier,
    i.kelly_fraction,
    i.sharp_money_alignment,
    i.steam_move_detected,
    i.market_efficiency_score,
    i.expected_value,
    i.model_confidence,
    i.win_probability_model_v1 AS predicted_win_prob,

    -- Derived Metrics
    p.implied_probability,
    p.score_tier,
    i.confidence_tier,

    -- Performance Indicators
    CASE
      WHEN p.professional_score >= 70 AND p.is_win = 1 THEN 'high_quality_win'
      WHEN p.professional_score >= 70 AND p.is_win = 0 THEN 'high_quality_loss'
      WHEN p.professional_score < 70 AND p.is_win = 1 THEN 'low_quality_win'
      WHEN p.professional_score < 70 AND p.is_win = 0 THEN 'low_quality_loss'
      ELSE 'pending'
    END AS performance_category,

    CASE
      WHEN i.clv_pct > 0 AND p.is_win = 1 THEN 'positive_clv_win'
      WHEN i.clv_pct > 0 AND p.is_win = 0 THEN 'positive_clv_loss'
      WHEN i.clv_pct <= 0 AND p.is_win = 1 THEN 'negative_clv_win'
      WHEN i.clv_pct <= 0 AND p.is_win = 0 THEN 'negative_clv_loss'
      ELSE 'pending'
    END AS clv_outcome_category,

    -- Edge Calculation
    (i.expected_value - p.stake) AS edge_amount,

    -- Timestamps
    p.published_at,
    p.settled_at,
    p.published_date,
    p.published_week,
    p.published_month,
    p.published_hour,
    p.day_of_week,

    -- Data Quality
    p.has_prop_link,
    p.is_graded,
    p.is_settled,
    i.data_quality_score_pct,

    -- Metadata
    CURRENT_TIMESTAMP AS dbt_updated_at

  FROM picks p
  LEFT JOIN internal_scores i ON p.pick_id = i.pick_id
  LEFT JOIN users u ON p.user_id = u.user_id
  LEFT JOIN props pr ON p.prop_id = pr.prop_id
)

SELECT * FROM final
