-- SPRINT-044G: Fix ON CONFLICT clause for participants in upsert_provider_offers_bootstrap
-- The participant auto-create used ON CONFLICT (external_id) but the actual constraint
-- is a composite: participants_external_id_sport_unique (external_id, sport).
-- This re-applies the CREATE OR REPLACE with the correct named constraint.
--
-- Rollback: Re-run original from 20260308100001

-- NOTE: This migration is idempotent — the function from 20260308100001 was also
-- fixed in-place, so both apply the same corrected version.
-- Applied remotely 2026-03-08; local file recreated for migration sync.

-- (Function body identical to corrected 20260308100001 — CREATE OR REPLACE is idempotent)
SELECT 1; -- no-op: function already applied via 20260308100001 fix
