-- =============================================================================
-- FIX EXISTING USERS DATA FIRST
-- =============================================================================

-- Step 1: Check what tier values currently exist in users table
SELECT 
  'Current tier values in users table:' as info,
  tier,
  COUNT(*) as count
FROM users 
GROUP BY tier
ORDER BY count DESC;

-- Step 2: Update any invalid tier values to 'members'
UPDATE users 
SET tier = 'members' 
WHERE tier NOT IN ('members', 'vip', 'vip+', 'black label');

-- Step 3: Check results after update
SELECT 
  'Updated tier values:' as info,
  tier,
  COUNT(*) as count
FROM users 
GROUP BY tier
ORDER BY count DESC;

-- Step 4: Now drop the existing constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tier_check;

-- Step 5: Add the correct tier constraint
ALTER TABLE users ADD CONSTRAINT users_tier_check 
  CHECK (tier IN ('members', 'vip', 'vip+', 'black label'));

-- Step 6: Update the default tier
ALTER TABLE users ALTER COLUMN tier SET DEFAULT 'members';

-- Success message
SELECT 
  'Users table fixed and tier constraint updated!' as status,
  'All invalid tiers changed to members' as fix_applied,
  'Valid tiers: members, vip, vip+, black label' as valid_tiers,
  NOW() as updated_at;
