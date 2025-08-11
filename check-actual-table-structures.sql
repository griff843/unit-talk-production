-- =============================================================================
-- CHECK ACTUAL TABLE STRUCTURES - NO ASSUMPTIONS
-- Get the real column names and structures before making fixes
-- =============================================================================

-- Check referral_events table structure
SELECT 
  'referral_events table structure:' as table_info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'referral_events' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check referral_rewards table structure
SELECT 
  'referral_rewards table structure:' as table_info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'referral_rewards' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check referrals table structure
SELECT 
  'referrals table structure:' as table_info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'referrals' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check rbi_backfill_queue table structure
SELECT 
  'rbi_backfill_queue table structure:' as table_info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'rbi_backfill_queue' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check raw_props table structure (key columns)
SELECT 
  'raw_props key columns:' as table_info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'raw_props' 
  AND table_schema = 'public'
  AND column_name IN ('id', 'game_id', 'matchup', 'game_date', 'stat_type', 'player_name')
ORDER BY ordinal_position;

-- Check what other tables might need foreign keys
SELECT 
  'Tables that might need foreign keys:' as info,
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND column_name LIKE '%_id') as id_columns_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE '%log%'
  AND table_name NOT LIKE '%backup%'
  AND table_name NOT IN (
    'unified_picks', 'raw_props', 'contest_participants', 
    'referral_events', 'referral_rewards', 'rbi_backfill_queue'
  )
ORDER BY id_columns_count DESC;

-- Sample data from referral tables to understand relationships
SELECT 'referrals sample:' as info, * FROM referrals LIMIT 2;
SELECT 'referral_events sample:' as info, * FROM referral_events LIMIT 2;
SELECT 'referral_rewards sample:' as info, * FROM referral_rewards LIMIT 2;
