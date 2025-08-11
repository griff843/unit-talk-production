-- =============================================================================
-- PHASE 1: STEP-BY-STEP SAAS FOUNDATION
-- Run each step separately to avoid conflicts
-- =============================================================================

-- STEP 1: Create users table first (run this first)
-- =============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  discord_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  email TEXT,
  
  -- Subscription & Tier
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'vip', 'vip_plus')),
  subscription_status TEXT NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'inactive', 'cancelled', 'trial', 'suspended')),
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium', 'vip', 'enterprise')),
  subscription_expires_at TIMESTAMPTZ,
  
  -- Capper-specific fields
  is_capper BOOLEAN DEFAULT FALSE,
  capper_status TEXT DEFAULT 'inactive' CHECK (capper_status IN ('active', 'inactive', 'suspended', 'pending')),
  capper_tier TEXT,
  roles JSONB DEFAULT '["user"]',
  
  -- Performance Metrics
  total_picks INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  pushes INTEGER DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  roi NUMERIC DEFAULT 0,
  units_won NUMERIC DEFAULT 0,
  
  -- Streaks
  streak_current INTEGER DEFAULT 0,
  streak_type TEXT CHECK (streak_type IN ('win', 'loss', 'none')) DEFAULT 'none',
  streak_best INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  
  -- Preferences & Settings
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'en',
  notification_preferences JSONB DEFAULT '{}',
  privacy_settings JSONB DEFAULT '{}',
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

-- Add indexes for users table
CREATE INDEX idx_users_discord_id ON users(discord_id);
CREATE INDEX idx_users_tier_status ON users(tier, subscription_status);
CREATE INDEX idx_users_capper ON users(is_capper) WHERE is_capper = TRUE;
CREATE INDEX idx_users_performance ON users(win_rate DESC, roi DESC);

-- Insert test system user
INSERT INTO users (discord_id, username, display_name, is_capper, capper_status, tier)
VALUES ('system_user', 'System', 'Unit Talk System', TRUE, 'active', 'platinum');

-- Verify users table was created
SELECT 'Step 1 Complete: Users table created' as status, COUNT(*) as user_count FROM users;
