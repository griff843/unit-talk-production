-- ============================================================================
-- OPS-GAUNTLET-SCHEMA-ALIGNMENT-047: Add Missing Lifecycle Columns
-- Date: 2026-02-19
-- Purpose: Add lifecycle columns required by lifecycle adapters and gauntlet.
-- Safe: All changes are additive (ADD COLUMN IF NOT EXISTS).
-- ============================================================================

-- ========================================================================
-- 1. PROMOTION LIFECYCLE COLUMNS
-- ========================================================================

-- promotion_status: tracks Discord promotion workflow state
ALTER TABLE unified_picks
ADD COLUMN IF NOT EXISTS promotion_status TEXT DEFAULT 'not_promoted';

-- promotion_queued_at: timestamp when pick entered promotion queue
ALTER TABLE unified_picks
ADD COLUMN IF NOT EXISTS promotion_queued_at TIMESTAMPTZ;

-- promotion_posted_at: timestamp when pick was posted to Discord
ALTER TABLE unified_picks
ADD COLUMN IF NOT EXISTS promotion_posted_at TIMESTAMPTZ;

-- ========================================================================
-- 2. DISCORD POSTING COLUMNS
-- ========================================================================

-- posted_to_discord: boolean flag for idempotent posting
ALTER TABLE unified_picks
ADD COLUMN IF NOT EXISTS posted_to_discord BOOLEAN DEFAULT FALSE;

-- discord_message_id: receipt of successful Discord post
ALTER TABLE unified_picks
ADD COLUMN IF NOT EXISTS discord_message_id TEXT;

-- discord_thread_id: optional thread ID for follow-up comments
ALTER TABLE unified_picks
ADD COLUMN IF NOT EXISTS discord_thread_id TEXT;

-- ========================================================================
-- 3. STATUS AND SOURCE COLUMNS
-- ========================================================================

-- status: pick outcome status (pending, won, lost, push, void, cancelled)
ALTER TABLE unified_picks
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- source: origin of the pick (smart_form, backfill, GAUNTLET_TEST, etc.)
ALTER TABLE unified_picks
ADD COLUMN IF NOT EXISTS source TEXT;

-- ========================================================================
-- 4. SETTLEMENT SOURCE COLUMN
-- ========================================================================

-- settlement_source: where the settlement data came from
ALTER TABLE unified_picks
ADD COLUMN IF NOT EXISTS settlement_source TEXT;

-- ========================================================================
-- 5. PARLAY SUPPORT COLUMNS
-- ========================================================================

-- ticket_type: 'single' or 'parlay'
ALTER TABLE unified_picks
ADD COLUMN IF NOT EXISTS ticket_type TEXT DEFAULT 'single';

-- parlay_id: groups legs of the same parlay
ALTER TABLE unified_picks
ADD COLUMN IF NOT EXISTS parlay_id TEXT;

-- ========================================================================
-- 6. BLOCKING/FAILURE TRACKING COLUMNS
-- ========================================================================

-- blocked_reason: why a pick was blocked from promotion
ALTER TABLE unified_picks
ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- failed_reason: why a pick failed processing
ALTER TABLE unified_picks
ADD COLUMN IF NOT EXISTS failed_reason TEXT;

-- blocked_at: when pick was blocked
ALTER TABLE unified_picks
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

-- failed_at: when pick failed
ALTER TABLE unified_picks
ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;

-- ========================================================================
-- 7. TIMESTAMP COLUMNS
-- ========================================================================

-- created_at: when pick was created (if not already present)
ALTER TABLE unified_picks
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- placed_at: when the bet was placed (optional)
ALTER TABLE unified_picks
ADD COLUMN IF NOT EXISTS placed_at TIMESTAMPTZ;

-- ========================================================================
-- 8. INDEXES FOR GAUNTLET QUERIES
-- ========================================================================

-- Index for source filtering (gauntlet cleanup)
CREATE INDEX IF NOT EXISTS idx_unified_picks_source
ON unified_picks (source)
WHERE source IS NOT NULL;

-- Index for posted_to_discord filtering
CREATE INDEX IF NOT EXISTS idx_unified_picks_posted
ON unified_picks (posted_to_discord);

-- Index for promotion_status filtering
CREATE INDEX IF NOT EXISTS idx_unified_picks_promotion_status
ON unified_picks (promotion_status)
WHERE promotion_status IS NOT NULL;

-- ========================================================================
-- 9. COMMENTS
-- ========================================================================

COMMENT ON COLUMN unified_picks.promotion_status IS
'OPS-GAUNTLET-SCHEMA-ALIGNMENT-047: Discord promotion workflow state';

COMMENT ON COLUMN unified_picks.posted_to_discord IS
'OPS-GAUNTLET-SCHEMA-ALIGNMENT-047: Idempotency flag for Discord posting';

COMMENT ON COLUMN unified_picks.settlement_source IS
'OPS-GAUNTLET-SCHEMA-ALIGNMENT-047: Source of settlement data';

-- ========================================================================
-- Complete
-- ========================================================================

COMMENT ON SCHEMA public IS
'OPS-GAUNTLET-SCHEMA-ALIGNMENT-047: Lifecycle columns added for gauntlet compliance';
