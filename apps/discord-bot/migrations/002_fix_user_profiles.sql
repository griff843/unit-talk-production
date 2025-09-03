-- Migration: Fix user_profiles table schema
-- Date: 2025-07-21
-- Description: Updates user_profiles table to use correct column names and adds missing columns

-- First, check if we need to rename the tier column to membership_tier
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'tier'
    ) THEN
        ALTER TABLE user_profiles RENAME COLUMN tier TO membership_tier;
    END IF;
END $$;

-- Add membership_tier column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'membership_tier'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN membership_tier TEXT NOT NULL DEFAULT 'member';
    END IF;
END $$;

-- Add subscription_tier column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'subscription_tier'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'FREE';
    END IF;
END $$;

-- Add metadata column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
END $$;

-- Add last_active column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'last_active'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN last_active TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Add constraints
ALTER TABLE user_profiles 
    ALTER COLUMN discord_id SET NOT NULL,
    ALTER COLUMN membership_tier SET NOT NULL,
    ALTER COLUMN subscription_tier SET NOT NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_discord_id ON user_profiles(discord_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_membership_tier ON user_profiles(membership_tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_tier ON user_profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_metadata ON user_profiles USING gin(metadata);

-- Add check constraint for valid tiers
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'user_profiles' 
        AND constraint_name = 'user_profiles_membership_tier_check'
    ) THEN
        ALTER TABLE user_profiles 
        ADD CONSTRAINT user_profiles_membership_tier_check 
        CHECK (membership_tier IN ('member', 'vip', 'vip_plus', 'staff', 'admin', 'owner'));
    END IF;
END $$;

-- Add check constraint for valid subscription tiers
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'user_profiles' 
        AND constraint_name = 'user_profiles_subscription_tier_check'
    ) THEN
        ALTER TABLE user_profiles 
        ADD CONSTRAINT user_profiles_subscription_tier_check 
        CHECK (subscription_tier IN ('FREE', 'PREMIUM', 'VIP', 'VIP_PLUS'));
    END IF;
END $$;

-- Update any existing records with incorrect tiers
UPDATE user_profiles 
SET membership_tier = 'member' 
WHERE membership_tier IS NULL OR membership_tier NOT IN ('member', 'vip', 'vip_plus', 'staff', 'admin', 'owner');

UPDATE user_profiles 
SET subscription_tier = 'FREE' 
WHERE subscription_tier IS NULL OR subscription_tier NOT IN ('FREE', 'PREMIUM', 'VIP', 'VIP_PLUS'); 