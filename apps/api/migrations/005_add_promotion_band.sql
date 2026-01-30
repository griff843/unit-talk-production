-- Migration 005: Add promotion_band column to unified_picks
-- Tranche 10 — Posting Governance (POSTING-GOVERNANCE-001)
--
-- The promotion policy (promotionPolicy.ts) classifies picks into HARD / SOFT / NONE bands.
-- This column persists that band at scoring time so the DiscordPromotionAgent can query on it
-- instead of using the independent auto_approved + tier filter.
--
-- HARD  = auto-promote eligible (S/A tier, EV >= 1%, confidence >= 7.0, no data gaps)
-- SOFT  = requires review (moderate signals)
-- NONE  = not eligible for promotion
-- NULL  = scored before this migration (V1 scoring or policy disabled)

ALTER TABLE unified_picks
  ADD COLUMN IF NOT EXISTS promotion_band TEXT DEFAULT NULL;

-- Index for DiscordPromotionAgent query:
--   SELECT * FROM unified_picks WHERE posted_to_discord = false AND promotion_band = 'HARD'
CREATE INDEX IF NOT EXISTS idx_unified_picks_promotion_band
  ON unified_picks (promotion_band)
  WHERE promotion_band IS NOT NULL;

COMMENT ON COLUMN unified_picks.promotion_band IS
  'HARD/SOFT/NONE band from evaluatePromotion() — gates Discord posting (Tranche 10)';
