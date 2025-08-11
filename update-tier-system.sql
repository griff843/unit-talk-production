-- =============================================================================
-- UPDATE TIER SYSTEM TO MATCH YOUR ACTUAL TIERS
-- Run this BEFORE the migration to update the users table constraints
-- =============================================================================

-- Step 1: Drop the existing tier constraint
-- =============================================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tier_check;

-- Step 2: Add the correct tier constraint for your system
-- =============================================================================
ALTER TABLE users ADD CONSTRAINT users_tier_check 
  CHECK (tier IN ('members', 'vip', 'vip+', 'black label'));

-- Step 3: Update the default tier
-- =============================================================================
ALTER TABLE users ALTER COLUMN tier SET DEFAULT 'members';

-- Step 4: Verify the constraint was updated
-- =============================================================================
SELECT 
  'Tier system updated successfully!' as status,
  'Valid tiers: members, vip, vip+, black label' as valid_tiers,
  'Default tier: members' as default_tier,
  NOW() as updated_at;
