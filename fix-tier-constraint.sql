-- =============================================================================
-- FIX TIER CONSTRAINT - RUN THIS FIRST
-- =============================================================================

-- Step 1: Drop the existing tier constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tier_check;

-- Step 2: Add the correct tier constraint for your system
ALTER TABLE users ADD CONSTRAINT users_tier_check 
  CHECK (tier IN ('members', 'vip', 'vip+', 'black label'));

-- Step 3: Update the default tier
ALTER TABLE users ALTER COLUMN tier SET DEFAULT 'members';

-- Step 4: Check what tiers exist in your cappers table
SELECT
  'Current roles in cappers table:' as info,
  role,
  COUNT(*) as count
FROM cappers
GROUP BY role
ORDER BY count DESC;

-- Step 5: Since all cappers have role 'Capper', we'll default them to 'members' tier
-- You can manually update specific cappers to vip, vip+, or black label later

-- Success message
SELECT 
  'Tier constraint updated!' as status,
  'Valid tiers: members, vip, vip+, black label' as valid_tiers,
  NOW() as updated_at;
