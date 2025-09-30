-- ROLLBACK SCRIPT: HOT/WARM/COLD Data Architecture
-- WARNING: This will permanently delete data and cannot be undone
-- Only run this script if you need to completely remove the HOT/WARM/COLD architecture

-- =============================================
-- SAFETY CHECKS
-- =============================================

-- Check if rollback should proceed
DO $$
DECLARE
    hot_record_count BIGINT;
    warm_file_count BIGINT;
    proceed_rollback BOOLEAN := FALSE;
BEGIN
    -- Check how much data would be lost
    SELECT COUNT(*) INTO hot_record_count FROM prop_ticks_hot WHERE archived_at IS NULL;
    SELECT COUNT(*) INTO warm_file_count FROM prop_ticks_warm_metadata;
    
    RAISE NOTICE 'ROLLBACK IMPACT ASSESSMENT:';
    RAISE NOTICE '  - Active HOT records that will be lost: %', hot_record_count;
    RAISE NOTICE '  - WARM metadata records: %', warm_file_count;
    
    -- Require explicit confirmation (set to TRUE to proceed)
    IF proceed_rollback THEN
        RAISE NOTICE '✅ ROLLBACK CONFIRMED - Proceeding with data architecture removal';
    ELSE
        RAISE EXCEPTION '❌ ROLLBACK HALTED - Set proceed_rollback to TRUE to confirm data destruction';
    END IF;
END $$;

-- =============================================
-- BACKUP CRITICAL DATA BEFORE ROLLBACK
-- =============================================

-- Create backup of active HOT data in raw_props format
DO $$
DECLARE
    backup_count BIGINT;
BEGIN
    -- Insert active HOT data into raw_props as backup
    INSERT INTO raw_props (
        id, prop_id, player_name, sport, stat_type, line, 
        over_odds, under_odds, game_date, game_time,
        team, opponent, matchup, source, provider,
        created_at, updated_at
    )
    SELECT 
        gen_random_uuid(),
        prop_id,
        player_name,
        sport,
        stat_type,
        line,
        over_odds,
        under_odds,
        game_date,
        game_time,
        team,
        opponent,
        matchup,
        'HOT_BACKUP_' || source,
        provider,
        tick_timestamp,
        NOW()
    FROM prop_ticks_hot 
    WHERE archived_at IS NULL
      AND NOT EXISTS (
          SELECT 1 FROM raw_props rp 
          WHERE rp.prop_id = prop_ticks_hot.prop_id
      );
    
    GET DIAGNOSTICS backup_count = ROW_COUNT;
    
    RAISE NOTICE '💾 BACKUP CREATED: % records backed up to raw_props', backup_count;
END $$;

-- Create backup table for feature computation metadata
CREATE TABLE IF NOT EXISTS feature_computation_backup AS
SELECT 
    prop_id,
    rolling_avg_7d,
    rolling_avg_30d,
    volatility_score,
    trend_direction,
    market_efficiency_score,
    tick_timestamp,
    NOW() as backed_up_at
FROM prop_ticks_hot 
WHERE rolling_avg_7d IS NOT NULL 
   OR rolling_avg_30d IS NOT NULL
   OR volatility_score IS NOT NULL;

-- Create backup of WARM metadata for recovery
CREATE TABLE IF NOT EXISTS warm_metadata_backup AS
SELECT *, NOW() as backed_up_at FROM prop_ticks_warm_metadata;

RAISE NOTICE '💾 Feature and metadata backups created';

-- =============================================
-- STEP 1: DISABLE WORKFLOWS AND SERVICES
-- =============================================

-- Update lifecycle config to disable all processes
UPDATE data_lifecycle_config 
SET 
    hot_retention_days = 0,  -- Disable HOT data archival
    is_active = FALSE,       -- Disable lifecycle management
    updated_at = NOW()
WHERE is_active = TRUE;

RAISE NOTICE '🛑 Data lifecycle processes disabled';

-- =============================================
-- STEP 2: REMOVE TEMPORAL WORKFLOWS
-- =============================================

-- Note: Temporal workflows need to be cancelled via Temporal CLI or UI
-- This cannot be done directly from SQL

RAISE NOTICE '⚠️ MANUAL STEP REQUIRED: Cancel the following Temporal workflows:';
RAISE NOTICE '  - ArchiverWorkflow (scheduled daily)';
RAISE NOTICE '  - FeatureBuilderWorkflow (scheduled hourly)';
RAISE NOTICE '  - EnhancedGradingWorkflow (scheduled every 15 minutes)';

-- =============================================
-- STEP 3: REMOVE MONITORING INTEGRATION
-- =============================================

-- Drop views and functions related to lifecycle monitoring
DROP FUNCTION IF EXISTS get_data_lifecycle_metrics();
DROP FUNCTION IF EXISTS cleanup_expired_hot_data();

RAISE NOTICE '📊 Monitoring functions removed';

-- =============================================
-- STEP 4: REMOVE WARM STORAGE FILES
-- =============================================

-- Note: Supabase Storage files need to be removed via API or dashboard
-- This cannot be done directly from SQL

RAISE NOTICE '⚠️ MANUAL STEP REQUIRED: Remove Supabase Storage bucket "prop-data-warm"';
RAISE NOTICE '   - Go to Supabase Dashboard > Storage';
RAISE NOTICE '   - Delete bucket "prop-data-warm" and all contents';
RAISE NOTICE '   - Alternatively use Supabase CLI: supabase storage rm prop-data-warm --recursive';

-- =============================================
-- STEP 5: REMOVE HOT DATA TABLES
-- =============================================

-- Drop partitions first
DO $$
DECLARE
    partition_name TEXT;
BEGIN
    -- Drop all partitions
    FOR partition_name IN 
        SELECT schemaname||'.'||tablename 
        FROM pg_tables 
        WHERE tablename LIKE 'prop_ticks_hot_%'
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || partition_name || ' CASCADE';
        RAISE NOTICE '🗑️ Dropped partition: %', partition_name;
    END LOOP;
END $$;

-- Drop main HOT table
DROP TABLE IF EXISTS prop_ticks_hot CASCADE;
RAISE NOTICE '🗑️ HOT data table (prop_ticks_hot) removed';

-- =============================================
-- STEP 6: REMOVE WARM AND COLD METADATA TABLES
-- =============================================

DROP TABLE IF EXISTS prop_ticks_warm_metadata CASCADE;
RAISE NOTICE '🗑️ WARM metadata table removed';

DROP TABLE IF EXISTS prop_ticks_cold_metadata CASCADE;
RAISE NOTICE '🗑️ COLD metadata table removed';

-- =============================================
-- STEP 7: REMOVE LIFECYCLE CONFIGURATION
-- =============================================

DROP TABLE IF EXISTS data_lifecycle_config CASCADE;
RAISE NOTICE '🗑️ Lifecycle configuration table removed';

-- =============================================
-- STEP 8: RESTORE FEEDAGENT TO LEGACY MODE
-- =============================================

-- Note: This requires code changes to disable HOT data integration
RAISE NOTICE '⚠️ MANUAL STEP REQUIRED: Restore FeedAgent to legacy mode:';
RAISE NOTICE '   1. Remove HotDataIntegration import from FeedAgent/index.ts';
RAISE NOTICE '   2. Restore processPropsLegacy as the default processProps method';
RAISE NOTICE '   3. Remove HOT/WARM/COLD architecture references';
RAISE NOTICE '   4. Deploy updated code';

-- =============================================
-- STEP 9: CLEANUP ENHANCED GRADING FEATURES
-- =============================================

-- Remove professional scoring columns that depend on features
ALTER TABLE raw_props DROP COLUMN IF EXISTS professional_score;
ALTER TABLE raw_props DROP COLUMN IF EXISTS confidence_score;
ALTER TABLE raw_props DROP COLUMN IF EXISTS contributing_factors;
ALTER TABLE raw_props DROP COLUMN IF EXISTS risk_flags;
ALTER TABLE raw_props DROP COLUMN IF EXISTS recommendation;

RAISE NOTICE '🗑️ Enhanced grading columns removed from raw_props';

-- =============================================
-- STEP 10: REMOVE FEATURE STORE REFERENCES
-- =============================================

-- Drop any feature-related indexes
DROP INDEX IF EXISTS idx_raw_props_feature_quality;
DROP INDEX IF EXISTS idx_raw_props_professional_score;

-- Remove feature computation triggers
DROP TRIGGER IF EXISTS feature_computation_trigger ON raw_props;
DROP FUNCTION IF EXISTS compute_basic_features();

RAISE NOTICE '🗑️ Feature store references removed';

-- =============================================
-- STEP 11: VERIFICATION AND CLEANUP
-- =============================================

-- Verify tables are removed
DO $$
DECLARE
    remaining_tables TEXT[];
BEGIN
    SELECT ARRAY_AGG(tablename) 
    INTO remaining_tables
    FROM pg_tables 
    WHERE tablename LIKE ANY(ARRAY['prop_ticks_hot%', '%lifecycle%', '%warm%', '%cold%']);
    
    IF array_length(remaining_tables, 1) > 0 THEN
        RAISE WARNING 'Some tables may still exist: %', remaining_tables;
    ELSE
        RAISE NOTICE '✅ All HOT/WARM/COLD tables successfully removed';
    END IF;
END $$;

-- Cleanup any remaining functions
DROP FUNCTION IF EXISTS calculate_market_intelligence(JSONB);
DROP FUNCTION IF EXISTS detect_steam_moves(NUMERIC[], TIMESTAMPTZ[]);
DROP FUNCTION IF EXISTS compute_rolling_features(NUMERIC[], INTEGER);

-- Remove RLS policies related to lifecycle tables
-- (This will error if tables don't exist, which is expected)
DROP POLICY IF EXISTS "Users can read hot prop ticks" ON prop_ticks_hot;
DROP POLICY IF EXISTS "Admins can manage hot prop ticks" ON prop_ticks_hot;
DROP POLICY IF EXISTS "Users can read warm metadata" ON prop_ticks_warm_metadata;
DROP POLICY IF EXISTS "Admins can manage warm metadata" ON prop_ticks_warm_metadata;

-- =============================================
-- STEP 12: RESTORE ORIGINAL FUNCTIONALITY
-- =============================================

-- Ensure raw_props table has all necessary indexes
CREATE INDEX IF NOT EXISTS idx_raw_props_created_at ON raw_props(created_at);
CREATE INDEX IF NOT EXISTS idx_raw_props_sport_player ON raw_props(sport, player_name);
CREATE INDEX IF NOT EXISTS idx_raw_props_game_time ON raw_props(game_time) WHERE game_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_raw_props_processing ON raw_props(processed_at, processed_by);

-- Restore original raw_props RLS policies
ALTER TABLE raw_props ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_raw_props" ON raw_props;
CREATE POLICY "anon_read_raw_props" ON raw_props FOR SELECT USING (true);

-- =============================================
-- ROLLBACK COMPLETION SUMMARY
-- =============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '==============================================';
    RAISE NOTICE '✅ HOT/WARM/COLD ARCHITECTURE ROLLBACK COMPLETE';
    RAISE NOTICE '==============================================';
    RAISE NOTICE '';
    RAISE NOTICE 'COMPLETED STEPS:';
    RAISE NOTICE '  ✅ Active HOT data backed up to raw_props';
    RAISE NOTICE '  ✅ Feature computation metadata backed up';
    RAISE NOTICE '  ✅ HOT data table and partitions removed';
    RAISE NOTICE '  ✅ WARM and COLD metadata tables removed';
    RAISE NOTICE '  ✅ Lifecycle configuration removed';
    RAISE NOTICE '  ✅ Enhanced grading features removed';
    RAISE NOTICE '  ✅ Original raw_props functionality restored';
    RAISE NOTICE '';
    RAISE NOTICE 'MANUAL STEPS STILL REQUIRED:';
    RAISE NOTICE '  ⚠️  Cancel Temporal workflows (ArchiverWorkflow, FeatureBuilderWorkflow, etc.)';
    RAISE NOTICE '  ⚠️  Delete Supabase Storage bucket "prop-data-warm"';
    RAISE NOTICE '  ⚠️  Update and deploy FeedAgent code to remove HOT integration';
    RAISE NOTICE '  ⚠️  Remove workflow definitions from deployment';
    RAISE NOTICE '  ⚠️  Update monitoring dashboards to remove lifecycle metrics';
    RAISE NOTICE '';
    RAISE NOTICE 'BACKUP TABLES CREATED:';
    RAISE NOTICE '  📦 feature_computation_backup - Feature data backup';
    RAISE NOTICE '  📦 warm_metadata_backup - WARM storage metadata backup';
    RAISE NOTICE '  📦 HOT data backed up in raw_props (source prefixed with HOT_BACKUP_)';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT: Review backup tables and remove when no longer needed';
    RAISE NOTICE '⚠️  IMPORTANT: Test system functionality before considering rollback complete';
    RAISE NOTICE '';
END $$;

-- =============================================
-- POST-ROLLBACK VALIDATION QUERIES
-- =============================================

-- Run these queries to validate rollback success:

-- 1. Verify no HOT/WARM/COLD tables remain
SELECT 'HOT/WARM/COLD Tables Check' as check_type, 
       COUNT(*) as remaining_tables
FROM pg_tables 
WHERE tablename LIKE ANY(ARRAY['prop_ticks_hot%', '%lifecycle%', '%warm%', '%cold%']);

-- 2. Verify raw_props is functioning
SELECT 'raw_props Functionality' as check_type,
       COUNT(*) as total_records,
       COUNT(*) FILTER (WHERE source LIKE 'HOT_BACKUP_%') as backup_records,
       MAX(created_at) as latest_record
FROM raw_props;

-- 3. Check for backup tables
SELECT 'Backup Tables' as check_type,
       tablename,
       (SELECT COUNT(*) FROM information_schema.tables t2 WHERE t2.table_name = t1.tablename) as record_count
FROM pg_tables t1
WHERE tablename LIKE '%backup%';

-- 4. Verify no orphaned functions
SELECT 'Orphaned Functions' as check_type,
       COUNT(*) as function_count
FROM pg_proc 
WHERE proname LIKE ANY(ARRAY['%lifecycle%', '%hot_data%', '%warm_data%', '%feature_computation%']);

RAISE NOTICE '';
RAISE NOTICE 'Run the above validation queries to confirm rollback success';
RAISE NOTICE 'Monitor system logs after code deployment to ensure stable operation';