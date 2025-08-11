-- Check referrals table structure
SELECT 
  'referrals table columns:' as table_info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'referrals' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check referral_events table structure
SELECT 
  'referral_events table columns:' as table_info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'referral_events' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check referral_rewards table structure
SELECT 
  'referral_rewards table columns:' as table_info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'referral_rewards' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Sample data from referrals table
SELECT 'referrals sample data:' as info, * FROM referrals LIMIT 1;
