-- ===============================================================================
-- Staging Model: stg_picks
-- Purpose: Cleaned and typed picks data from canonical picks table
-- Materialization: View (lightweight transformation)
-- Reference: Charter v3.0 canonical schema (picks table)
-- ===============================================================================

{{
  config(
    materialized='view',
    schema='staging'
  )
}}

WITH source AS (
  SELECT *
  FROM {{ source('public', 'picks') }}
  WHERE workflow_stage = 'published' -- Only published picks for analytics
),

cleaned AS (
  SELECT
    -- Primary Keys
    id AS pick_id,
    tenant_id,
    user_id,
    prop_id,

    -- Pick Details
    selection,
    odds,
    stake,
    confidence,

    -- Workflow & Status
    workflow_stage,
    status,

    -- Results
    result,
    actual_value,
    profit_loss,
    settled_at,

    -- Professional Grading
    professional_score,
    grading_status,
    graded_at,

    -- Idempotency
    idempotency_key,
    bet_slip_id,

    -- Metadata Extraction
    metadata,
    (metadata->>'sport')::TEXT AS sport,
    (metadata->>'league')::TEXT AS league,
    (metadata->>'player_name')::TEXT AS player_name,
    (metadata->>'stat_type')::TEXT AS stat_type,
    (metadata->>'line')::DECIMAL(8,2) AS line,
    (metadata->>'bookmaker')::TEXT AS bookmaker,

    -- Timestamps
    created_at,
    updated_at,
    published_at,

    -- Derived Columns
    CASE
      WHEN status = 'won' THEN 1
      WHEN status = 'lost' THEN 0
      ELSE NULL
    END AS is_win,

    CASE
      WHEN professional_score >= 80 THEN 'elite'
      WHEN professional_score >= 70 THEN 'strong'
      WHEN professional_score >= 60 THEN 'good'
      WHEN professional_score >= 50 THEN 'average'
      ELSE 'below_average'
    END AS score_tier,

    DATE(published_at) AS published_date,
    DATE_TRUNC('week', published_at) AS published_week,
    DATE_TRUNC('month', published_at) AS published_month,
    EXTRACT(HOUR FROM published_at) AS published_hour,
    EXTRACT(DOW FROM published_at) AS day_of_week,

    -- Calculate implied probability from odds
    CASE
      WHEN odds > 0 THEN 100.0 / (odds + 100.0)
      WHEN odds < 0 THEN ABS(odds) / (ABS(odds) + 100.0)
      ELSE NULL
    END AS implied_probability,

    -- Data Quality Flags
    CASE WHEN prop_id IS NOT NULL THEN 1 ELSE 0 END AS has_prop_link,
    CASE WHEN graded_at IS NOT NULL THEN 1 ELSE 0 END AS is_graded,
    CASE WHEN settled_at IS NOT NULL THEN 1 ELSE 0 END AS is_settled

  FROM source
)

SELECT * FROM cleaned
