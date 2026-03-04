-- Migration: Posting guardrails for unified_picks
-- Sprint: SPRINT-SCORING-PIPELINE-ACTIVATION-018 (P0)
-- Description: Fail-closed constraints preventing F-tier / non-HARD / NULL band from being posted
-- Rollback:
--   ALTER TABLE unified_picks DROP CONSTRAINT IF EXISTS chk_posting_requires_hard_band;
--   ALTER TABLE unified_picks DROP CONSTRAINT IF EXISTS chk_promotion_band_enum;

-- 1) posted_to_discord guardrail:
--    If posted_to_discord = true then:
--      - promotion_band must be NOT NULL
--      - promotion_band must be 'HARD'
--      - tier must be IN ('S', 'A', 'B')
ALTER TABLE unified_picks
  ADD CONSTRAINT chk_posting_requires_hard_band
  CHECK (
    posted_to_discord IS NOT TRUE
    OR (
      promotion_band IS NOT NULL
      AND promotion_band = 'HARD'
      AND tier IN ('S', 'A', 'B')
    )
  );

-- 2) promotion_band enum constraint:
--    promotion_band must be NULL OR one of the valid bands
ALTER TABLE unified_picks
  ADD CONSTRAINT chk_promotion_band_enum
  CHECK (
    promotion_band IS NULL
    OR promotion_band IN ('HARD', 'SOFT', 'NO_POST')
  );
