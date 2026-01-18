-- ===============================================================================
-- Phase 11B: Core Domain Integration (Picks Flow)
-- Date: 2025-11-01
-- Purpose: DOKS foundation for multi-tenant picks domain with RLS and SLO tracking
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
  
  -- Indexes
  CONSTRAINT tenants_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at DESC);

-- ===============================================================================
-- 2. USERS TABLE - Enhanced with tenant support
-- ===============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identity
  discord_id TEXT,
  username TEXT NOT NULL,
  email TEXT,
  display_name TEXT,
  
  -- Tier & Status
  tier TEXT NOT NULL DEFAULT 'Free' CHECK (tier IN ('Free', 'Premium', 'VIP', 'VIP+', 'Black Label')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'banned')),
  
  -- Performance Metrics
  total_picks INTEGER DEFAULT 0,
  won_picks INTEGER DEFAULT 0,
  lost_picks INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2) DEFAULT 0.00,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT users_tenant_discord_unique UNIQUE (tenant_id, discord_id),
  CONSTRAINT users_tenant_email_unique UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(tenant_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_users_metadata ON users USING GIN (metadata);

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
-- 4. PICKS TABLE - User picks with full workflow
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

CREATE INDEX IF NOT EXISTS idx_picks_tenant_id ON picks(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_picks_user_id ON picks(tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_picks_workflow_stage ON picks(tenant_id, workflow_stage) WHERE workflow_stage IN ('pending_review', 'approved');
CREATE INDEX IF NOT EXISTS idx_picks_status ON picks(tenant_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_picks_grading_status ON picks(tenant_id, grading_status) WHERE grading_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_picks_idempotency_key ON picks(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_picks_metadata ON picks USING GIN (metadata);

-- ===============================================================================
-- 5. PICK_EVENTS TABLE - Event sourcing for picks
-- ===============================================================================
CREATE TABLE IF NOT EXISTS pick_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pick_id UUID NOT NULL REFERENCES picks(id) ON DELETE CASCADE,
  
  -- Event Details
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  
  -- Correlation
  correlation_id TEXT NOT NULL,
  causation_id TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_pick_events_tenant_id ON pick_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pick_events_pick_id ON pick_events(pick_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pick_events_event_type ON pick_events(tenant_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pick_events_correlation_id ON pick_events(correlation_id);

-- ===============================================================================
-- 6. SCORES TABLE - Professional grading results
-- ===============================================================================
CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pick_id UUID NOT NULL REFERENCES picks(id) ON DELETE CASCADE,
  
  -- Score Components
  professional_score DECIMAL(5,2) NOT NULL,
  devigged_win_prob DECIMAL(5,4),
  devigged_edge DECIMAL(5,4),
  clv_pct DECIMAL(5,2),
  kelly_fraction DECIMAL(5,4),
  
  -- Grading Details
  grading_engine_version TEXT NOT NULL,
  features_used TEXT[],
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT scores_pick_unique UNIQUE (pick_id)
);

CREATE INDEX IF NOT EXISTS idx_scores_tenant_id ON scores(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_pick_id ON scores(pick_id);
CREATE INDEX IF NOT EXISTS idx_scores_professional_score ON scores(tenant_id, professional_score DESC);

-- ===============================================================================
-- 7. NOTIFICATIONS TABLE - User notifications
-- ===============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification Details
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Related Entity
  related_entity_type TEXT,
  related_entity_id UUID,
  
  -- Delivery
  channels TEXT[] DEFAULT ARRAY['in_app'],
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON notifications(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(tenant_id, status) WHERE status = 'unread';

-- ===============================================================================
-- 8. AUDIT_EVENTS TABLE - Comprehensive audit trail
-- ===============================================================================
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Event Details
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,

  -- Actor
  actor_id UUID REFERENCES users(id),
  actor_type TEXT NOT NULL DEFAULT 'user',

  -- Changes
  old_values JSONB,
  new_values JSONB,

  -- Context
  ip_address INET,
  user_agent TEXT,
  correlation_id TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_id ON audit_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(tenant_id, entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit_events(tenant_id, event_type, created_at DESC);

-- ===============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ===============================================================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE props ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pick_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Tenants policies
CREATE POLICY "Tenants: Users can view own tenant"
  ON tenants FOR SELECT
  USING (id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY "Tenants: Service role full access"
  ON tenants FOR ALL
  USING (current_setting('role', true) = 'service_role');

-- Users policies
CREATE POLICY "Users: Tenant isolation"
  ON users FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY "Users: Service role full access"
  ON users FOR ALL
  USING (current_setting('role', true) = 'service_role');

-- Props policies
CREATE POLICY "Props: Tenant isolation"
  ON props FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY "Props: Service role full access"
  ON props FOR ALL
  USING (current_setting('role', true) = 'service_role');

-- Picks policies
CREATE POLICY "Picks: Tenant isolation"
  ON picks FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY "Picks: Users can view own picks"
  ON picks FOR SELECT
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    AND user_id = current_setting('app.current_user_id', true)::uuid
  );

CREATE POLICY "Picks: Service role full access"
  ON picks FOR ALL
  USING (current_setting('role', true) = 'service_role');

-- Pick Events policies
CREATE POLICY "Pick Events: Tenant isolation"
  ON pick_events FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY "Pick Events: Service role full access"
  ON pick_events FOR ALL
  USING (current_setting('role', true) = 'service_role');

-- Scores policies
CREATE POLICY "Scores: Tenant isolation"
  ON scores FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY "Scores: Service role full access"
  ON scores FOR ALL
  USING (current_setting('role', true) = 'service_role');

-- Notifications policies
CREATE POLICY "Notifications: Users can view own notifications"
  ON notifications FOR SELECT
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    AND user_id = current_setting('app.current_user_id', true)::uuid
  );

CREATE POLICY "Notifications: Users can update own notifications"
  ON notifications FOR UPDATE
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    AND user_id = current_setting('app.current_user_id', true)::uuid
  );

CREATE POLICY "Notifications: Service role full access"
  ON notifications FOR ALL
  USING (current_setting('role', true) = 'service_role');

-- Audit Events policies (read-only for users)
CREATE POLICY "Audit Events: Tenant isolation"
  ON audit_events FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY "Audit Events: Service role full access"
  ON audit_events FOR ALL
  USING (current_setting('role', true) = 'service_role');

-- ===============================================================================
-- 10. HELPER FUNCTIONS
-- ===============================================================================

-- Function to set tenant context
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', p_tenant_id::text, false);
  IF p_user_id IS NOT NULL THEN
    PERFORM set_config('app.current_user_id', p_user_id::text, false);
  END IF;
END;
$$;

-- Function to create pick with event
CREATE OR REPLACE FUNCTION create_pick_with_event(
  p_tenant_id UUID,
  p_user_id UUID,
  p_pick_data JSONB,
  p_correlation_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pick_id UUID;
BEGIN
  -- Insert pick
  INSERT INTO picks (
    tenant_id,
    user_id,
    prop_id,
    selection,
    odds,
    stake,
    confidence,
    workflow_stage,
    idempotency_key,
    metadata
  ) VALUES (
    p_tenant_id,
    p_user_id,
    (p_pick_data->>'prop_id')::UUID,
    p_pick_data->>'selection',
    (p_pick_data->>'odds')::INTEGER,
    (p_pick_data->>'stake')::DECIMAL,
    (p_pick_data->>'confidence')::INTEGER,
    COALESCE(p_pick_data->>'workflow_stage', 'draft'),
    p_pick_data->>'idempotency_key',
    COALESCE(p_pick_data->'metadata', '{}'::JSONB)
  )
  RETURNING id INTO v_pick_id;

  -- Insert event
  INSERT INTO pick_events (
    tenant_id,
    pick_id,
    event_type,
    event_data,
    correlation_id,
    created_by
  ) VALUES (
    p_tenant_id,
    v_pick_id,
    'pick.submitted',
    jsonb_build_object(
      'pick_id', v_pick_id,
      'user_id', p_user_id,
      'selection', p_pick_data->>'selection',
      'timestamp', NOW()
    ),
    p_correlation_id,
    p_user_id
  );

  RETURN v_pick_id;
END;
$$;

-- ===============================================================================
-- 11. SEED DATA (Default tenant for existing system)
-- ===============================================================================

-- Insert default tenant for Unit Talk platform
INSERT INTO tenants (id, name, slug, domain, tier, status, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
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
-- 12. COMMENTS
-- ===============================================================================

COMMENT ON TABLE tenants IS 'Multi-tenant foundation for DOKS architecture';
COMMENT ON TABLE users IS 'User management with tenant isolation';
COMMENT ON TABLE props IS 'Market propositions (betting opportunities)';
COMMENT ON TABLE picks IS 'User picks with full workflow and professional grading';
COMMENT ON TABLE pick_events IS 'Event sourcing for picks domain';
COMMENT ON TABLE scores IS 'Professional grading results';
COMMENT ON TABLE notifications IS 'User notifications across channels';
COMMENT ON TABLE audit_events IS 'Comprehensive audit trail for compliance';

COMMENT ON FUNCTION set_tenant_context IS 'Set tenant context for RLS policies';
COMMENT ON FUNCTION create_pick_with_event IS 'Create pick with automatic event generation';

-- ===============================================================================
-- END OF MIGRATION
-- ===============================================================================

-- ============================================================================
-- FORCE POSTGREST SCHEMA RELOAD (Charter-mandated)
-- ============================================================================
-- Trigger PostgREST to reload its schema cache
-- This ensures canonical tables are immediately visible via REST API
SELECT pg_notify('pgrst', 'reload schema');
