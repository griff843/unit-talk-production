-- ===============================================================================
-- Dimension Table: dim_cappers
-- Purpose: Capper dimension with aggregated performance metrics
-- Materialization: Table (full refresh daily)
-- Grain: One row per capper
-- ===============================================================================

{{
  config(
    materialized='table',
    schema='analytics'
  )
}}

WITH users AS (
  SELECT
    id AS user_id,
    tenant_id,
    username,
    tier AS user_tier,
    status,
    total_picks,
    won_picks,
    lost_picks,
    win_rate,
    created_at,
    last_active
  FROM {{ source('public', 'users') }}
  WHERE status = 'active'
),

picks_performance AS (
  SELECT * FROM {{ ref('fct_picks_performance') }}
  WHERE is_settled = 1
),

capper_metrics AS (
  SELECT
    user_id,
    COUNT(*) AS total_settled_picks,
    SUM(is_win) AS total_wins,
    SUM(CASE WHEN is_win = 0 THEN 1 ELSE 0 END) AS total_losses,
    ROUND(AVG(professional_score), 2) AS avg_professional_score,
    ROUND(AVG(clv_pct), 2) AS avg_clv_pct,
    ROUND(AVG(model_confidence), 4) AS avg_model_confidence,
    SUM(profit_loss) AS total_profit_loss,
    COUNT(CASE WHEN steam_move_detected THEN 1 END) AS steam_moves_captured,
    COUNT(CASE WHEN clv_tier IN ('elite', 'strong') THEN 1 END) AS high_clv_picks,
    COUNT(CASE WHEN score_tier IN ('elite', 'strong') THEN 1 END) AS high_score_picks,
    MAX(settled_at) AS last_settled_pick_at
  FROM picks_performance
  GROUP BY user_id
),

final AS (
  SELECT
    -- Primary Key
    u.user_id,
    u.tenant_id,

    -- Capper Details
    u.username AS capper_name,
    u.user_tier,
    u.status,

    -- Lifetime Metrics (from users table)
    u.total_picks AS lifetime_total_picks,
    u.won_picks AS lifetime_won_picks,
    u.lost_picks AS lifetime_lost_picks,
    u.win_rate AS lifetime_win_rate,

    -- Settled Picks Metrics (from analytics)
    COALESCE(m.total_settled_picks, 0) AS total_settled_picks,
    COALESCE(m.total_wins, 0) AS total_wins,
    COALESCE(m.total_losses, 0) AS total_losses,
    COALESCE(m.total_profit_loss, 0) AS total_profit_loss,

    -- Performance Metrics
    m.avg_professional_score,
    m.avg_clv_pct,
    m.avg_model_confidence,

    -- Advanced Metrics
    m.steam_moves_captured,
    m.high_clv_picks,
    m.high_score_picks,

    -- Derived Metrics
    CASE
      WHEN m.total_settled_picks > 0
      THEN ROUND(m.total_wins::NUMERIC / m.total_settled_picks::NUMERIC * 100, 2)
      ELSE 0
    END AS win_rate_pct,

    CASE
      WHEN m.total_settled_picks > 0
      THEN ROUND(m.high_score_picks::NUMERIC / m.total_settled_picks::NUMERIC * 100, 2)
      ELSE 0
    END AS high_score_picks_pct,

    CASE
      WHEN m.total_settled_picks > 0
      THEN ROUND(m.steam_moves_captured::NUMERIC / m.total_settled_picks::NUMERIC * 100, 2)
      ELSE 0
    END AS steam_capture_rate_pct,

    -- ROI Calculation
    CASE
      WHEN m.total_settled_picks > 0
      THEN ROUND((m.total_profit_loss / (m.total_settled_picks * 100.0)) * 100, 2)
      ELSE 0
    END AS roi_pct,

    -- Capper Rating (composite score)
    ROUND(
      (COALESCE(m.avg_professional_score, 50) * 0.4) +
      (COALESCE(m.avg_clv_pct, 0) * 10 * 0.3) +
      (COALESCE(m.avg_model_confidence, 0.5) * 100 * 0.3),
      2
    ) AS capper_rating,

    -- Tier Classification
    CASE
      WHEN m.avg_professional_score >= 75 AND m.avg_clv_pct >= 2.0 THEN 'elite'
      WHEN m.avg_professional_score >= 65 AND m.avg_clv_pct >= 1.0 THEN 'advanced'
      WHEN m.avg_professional_score >= 55 AND m.avg_clv_pct >= 0 THEN 'intermediate'
      ELSE 'beginner'
    END AS skill_tier,

    -- Timestamps
    u.created_at AS capper_since,
    u.last_active,
    m.last_settled_pick_at,

    -- Metadata
    CURRENT_TIMESTAMP AS dbt_updated_at

  FROM users u
  LEFT JOIN capper_metrics m ON u.user_id = m.user_id
)

SELECT * FROM final
