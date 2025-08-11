-- =============================================================================
-- FIX ALL USER CONSTRAINTS
-- =============================================================================

-- Step 1: Check what values exist in both tier columns
SELECT 
  'Current values in users table:' as info,
  tier,
  subscription_tier,
  COUNT(*) as count
FROM users 
GROUP BY tier, subscription_tier
ORDER BY count DESC;

-- Step 2: Drop ALL existing constraints on users table
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tier_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subscription_status_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subscription_tier_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_capper_status_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_streak_type_check;

-- Step 3: Update any invalid tier values to 'members'
UPDATE users 
SET tier = 'members' 
WHERE tier NOT IN ('members', 'vip', 'vip+', 'black label') OR tier IS NULL;

-- Step 4: Update any invalid subscription_tier values to 'free'
UPDATE users 
SET subscription_tier = 'free' 
WHERE subscription_tier NOT IN ('free', 'premium', 'vip', 'enterprise') OR subscription_tier IS NULL;

-- Step 5: Update any invalid subscription_status values
UPDATE users 
SET subscription_status = 'active' 
WHERE subscription_status NOT IN ('active', 'inactive', 'cancelled', 'trial', 'suspended') OR subscription_status IS NULL;

-- Step 6: Update any invalid capper_status values
UPDATE users 
SET capper_status = 'inactive' 
WHERE capper_status NOT IN ('active', 'inactive', 'suspended', 'pending') OR capper_status IS NULL;

-- Step 7: Update any invalid streak_type values
UPDATE users 
SET streak_type = 'none' 
WHERE streak_type NOT IN ('win', 'loss', 'none') OR streak_type IS NULL;

-- Step 8: Now add back the correct constraints
ALTER TABLE users ADD CONSTRAINT users_tier_check 
  CHECK (tier IN ('members', 'vip', 'vip+', 'black label'));

ALTER TABLE users ADD CONSTRAINT users_subscription_status_check 
  CHECK (subscription_status IN ('active', 'inactive', 'cancelled', 'trial', 'suspended'));

ALTER TABLE users ADD CONSTRAINT users_subscription_tier_check 
  CHECK (subscription_tier IN ('free', 'premium', 'vip', 'enterprise'));

ALTER TABLE users ADD CONSTRAINT users_capper_status_check 
  CHECK (capper_status IN ('active', 'inactive', 'suspended', 'pending'));

ALTER TABLE users ADD CONSTRAINT users_streak_type_check 
  CHECK (streak_type IN ('win', 'loss', 'none'));

-- Step 9: Update defaults
ALTER TABLE users ALTER COLUMN tier SET DEFAULT 'members';
ALTER TABLE users ALTER COLUMN subscription_tier SET DEFAULT 'free';
ALTER TABLE users ALTER COLUMN subscription_status SET DEFAULT 'active';
ALTER TABLE users ALTER COLUMN capper_status SET DEFAULT 'inactive';
ALTER TABLE users ALTER COLUMN streak_type SET DEFAULT 'none';

-- Step 10: Final check
SELECT 
  'All constraints fixed!' as status,
  'Users table ready for migration' as ready,
  COUNT(*) as total_users
FROM users;

-- Show final values
SELECT 
  'Final values in users table:' as info,
  tier,
  subscription_tier,
  subscription_status,
  capper_status,
  streak_type,
  COUNT(*) as count
FROM users 
GROUP BY tier, subscription_tier, subscription_status, capper_status, streak_type
ORDER BY count DESC;
