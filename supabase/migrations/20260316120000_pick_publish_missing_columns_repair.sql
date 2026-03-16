-- Migration: Repair pick_publish missing columns (schema drift fix)
-- Sprint: SPRINT-062-FULL-LIFECYCLE-E2E-TRUTH-AUDIT
-- Context: Migration 20260304210000 was tracked as applied but DDL never executed.
--          These columns are required by publishOutbox.ts (SPRINT-023).
-- Rollback:
--   ALTER TABLE pick_publish DROP COLUMN IF EXISTS payload_hash;
--   ALTER TABLE pick_publish DROP COLUMN IF EXISTS error_code;

-- Add payload_hash for drift detection and deduplication
ALTER TABLE pick_publish ADD COLUMN IF NOT EXISTS payload_hash text;

-- Add structured error classification for failed publish jobs
ALTER TABLE pick_publish ADD COLUMN IF NOT EXISTS error_code text;

-- Add promotion metadata columns needed by publishOutbox.ts enqueue
ALTER TABLE pick_publish ADD COLUMN IF NOT EXISTS promotion_band text;
ALTER TABLE pick_publish ADD COLUMN IF NOT EXISTS tier text;

-- Make tenant_id nullable (publishOutbox.ts passes null when no tenantId provided)
ALTER TABLE pick_publish ALTER COLUMN tenant_id DROP NOT NULL;
