-- ===============================================================================
-- Canonical Schema: Adapted for Existing Database
-- Date: 2025-10-29
-- Purpose: Create canonical picks/pick_publish tables with existing users table
-- Version: 1.1.0 (Adapted)
-- ===============================================================================

-- ===============================================================================
-- 1. TENANTS TABLE - Multi-tenant foundation
-- ===============================================================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant Identity
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT UNIQUE,
  
  -- Configuration
  settings JSONB DEFAULT '{}',
  features JSONB DEFAULT '{}',
  limits JSONB DEFAULT '{
    "max_picks_per_day": 100,
    "max_users": 1000,
    "max_storage_gb": 10
  }',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial', 'cancelled')),
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'starter', 'professional', 'enterprise')),
  
  -- Billing
  subscription_expires_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  
  -- Constraints
  CONSTRAINT tenants_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at DESC);

-- Insert default tenant for Unit Talk platform
INSERT INTO tenants (id, name, slug, domain, tier, status, settings)
VALUES (
  '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a',  -- DEFAULT_TENANT_ID from .env
  'Unit Talk',
  'unit-talk',
  'unittalk.com',
  'enterprise',
  'active',
  '{
    "branding": {
      "primary_color": "#3B82F6",
      "logo_url": "/logo.png"
    },
    "features": {
      "professional_grading": true,
      "discord_integration": true,
      "temporal_workflows": true
    }
  }'::JSONB
)
ON CONFLICT (id) DO NOTHING;

-- ===============================================================================
-- 2. ENHANCE EXISTING USERS TABLE - Add tenant_id if missing
-- ===============================================================================

-- Add tenant_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE users ADD COLUMN tenant_id UUID;
    
    -- Set default tenant for all existing users
    UPDATE users SET tenant_id = '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a' WHERE tenant_id IS NULL;
    
    -- Make tenant_id NOT NULL after setting defaults
    ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;
    
    -- Add foreign key constraint
    ALTER TABLE users ADD CONSTRAINT users_tenant_id_fkey 
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    
    -- Add index
    CREATE INDEX idx_users_tenant_id ON users(tenant_id, created_at DESC);
  END IF;
END $$;

-- ===============================================================================
-- 3. PROPS TABLE - Market propositions
-- ===============================================================================
CREATE TABLE IF NOT EXISTS props (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Prop Details
  sport TEXT NOT NULL,
  league TEXT,
  player_name TEXT NOT NULL,
  team TEXT,
  opponent TEXT,
  stat_type TEXT NOT NULL,
  line DECIMAL(8,2),
  over_odds INTEGER,
  under_odds INTEGER,
  
  -- Game Context
  game_id UUID,
  game_date DATE,
  game_time TIMESTAMPTZ,
  
  -- Market Data
  bookmaker TEXT,
  external_prop_id TEXT,
  external_game_id TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'settled', 'cancelled')),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT props_tenant_external_unique UNIQUE (tenant_id, bookmaker, external_prop_id)
);

CREATE INDEX IF NOT EXISTS idx_props_tenant_id ON props(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_props_game_date ON props(tenant_id, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_props_sport ON props(tenant_id, sport, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_props_metadata ON props USING GIN (metadata);

-- ===============================================================================
-- 4. PICKS TABLE - Core picks with professional grading
-- ===============================================================================
CREATE TABLE IF NOT EXISTS picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prop_id UUID REFERENCES props(id) ON DELETE SET NULL,

  -- Pick Details
  selection TEXT NOT NULL,
  odds INTEGER NOT NULL,
  stake DECIMAL(8,2) NOT NULL DEFAULT 1.0,
  confidence INTEGER CHECK (confidence BETWEEN 1 AND 10),

  -- Workflow
  workflow_stage TEXT NOT NULL DEFAULT 'draft' CHECK (workflow_stage IN ('draft', 'pending_review', 'approved', 'rejected', 'published')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'push', 'void', 'cancelled')),

  -- Results
  result TEXT,
  actual_value DECIMAL(8,2),
  profit_loss DECIMAL(10,2),
  settled_at TIMESTAMPTZ,

  -- Professional Grading
  professional_score DECIMAL(5,2),
  grading_status TEXT CHECK (grading_status IN ('pending', 'processing', 'completed', 'failed')),
  graded_at TIMESTAMPTZ,

  -- Idempotency
  idempotency_key TEXT,
  bet_slip_id TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT picks_tenant_idempotency_unique UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT picks_tenant_bet_slip_unique UNIQUE (tenant_id, bet_slip_id)
);

-- Indexes for picks table
CREATE INDEX IF NOT EXISTS idx_picks_tenant_id ON picks(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_picks_user_id ON picks(tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_picks_workflow_stage ON picks(tenant_id, workflow_stage) WHERE workflow_stage IN ('pending_review', 'approved');
CREATE INDEX IF NOT EXISTS idx_picks_status ON picks(tenant_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_picks_grading_status ON picks(tenant_id, grading_status) WHERE grading_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_picks_idempotency_key ON picks(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_picks_metadata ON picks USING GIN (metadata);

-- ===============================================================================
-- 5. PICK_PUBLISH TABLE - Outbox pattern for reliable publishing
-- ===============================================================================
CREATE TABLE IF NOT EXISTS pick_publish (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID NOT NULL REFERENCES picks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Publishing Details
  channel TEXT NOT NULL DEFAULT 'DISCORD' CHECK (channel IN ('DISCORD', 'WEBHOOK', 'EMAIL')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),

  -- Discord Integration
  thread_id TEXT,
  external_message_id TEXT,
  discord_channel_id TEXT,

  -- Retry Logic
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,

  -- Scheduling
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT pick_publish_pick_unique UNIQUE (pick_id, channel)
);

-- Indexes for pick_publish table
CREATE INDEX IF NOT EXISTS idx_pick_publish_pick_id ON pick_publish(pick_id);
CREATE INDEX IF NOT EXISTS idx_pick_publish_status ON pick_publish(tenant_id, status, next_retry_at) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_pick_publish_next_retry ON pick_publish(next_retry_at) WHERE status = 'failed' AND next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pick_publish_metadata ON pick_publish USING GIN (metadata);

-- ===============================================================================
-- 6. TRIGGER POSTGREST RELOAD
-- ===============================================================================

-- Notify PostgREST to reload schema cache
SELECT pg_notify('pgrst', 'reload schema');

-- Log the reload via RPC (if available)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'pgrst_reload' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    PERFORM pgrst_reload('canonical-schema-migration', 'Post-migration schema reload');
  END IF;
END $$;

-- ===============================================================================
-- 7. COMMENTS
-- ===============================================================================

COMMENT ON TABLE tenants IS 'Multi-tenant foundation for canonical architecture';
COMMENT ON TABLE props IS 'Market propositions (betting opportunities)';
COMMENT ON TABLE picks IS 'Canonical picks table with workflow and professional grading';
COMMENT ON TABLE pick_publish IS 'Outbox pattern for reliable Discord publishing';

-- ===============================================================================
-- END OF MIGRATION
-- ===============================================================================

