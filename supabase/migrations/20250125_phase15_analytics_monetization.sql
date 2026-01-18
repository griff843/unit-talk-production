-- ============================================================================
-- Phase 15: Multi-Tenant Analytics and Revenue Engine
-- Date: 2025-01-25
-- Description: Usage telemetry, billing infrastructure, and revenue analytics
-- ============================================================================

-- ============================================================================
-- 1. TENANT_USAGE TABLE - Usage telemetry tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant & User Context
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Event Classification
  event_type TEXT NOT NULL CHECK (event_type IN (
    'api_call',
    'pick_submission',
    'grading_operation',
    'alert_sent',
    'webhook_delivery',
    'ai_analysis',
    'data_export',
    'report_generation',
    'storage_usage',
    'bandwidth_usage'
  )),
  
  -- Resource Tracking
  resource_type TEXT NOT NULL, -- e.g., 'picks', 'users', 'storage_gb', 'api_requests'
  resource_id TEXT, -- Optional reference to specific resource
  quantity DECIMAL(12,4) NOT NULL DEFAULT 1.0, -- Amount consumed
  unit TEXT NOT NULL DEFAULT 'count', -- 'count', 'gb', 'mb', 'seconds', 'requests'
  
  -- Billing Context
  billable BOOLEAN NOT NULL DEFAULT true,
  cost_cents INTEGER DEFAULT 0, -- Cost in cents (USD)
  tier_at_time TEXT, -- User tier when event occurred
  
  -- Metadata
  metadata JSONB DEFAULT '{}', -- Additional context (endpoint, method, duration, etc.)
  
  -- Timestamps
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT tenant_usage_quantity_positive CHECK (quantity > 0)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_tenant_usage_tenant_timestamp ON tenant_usage(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_user_timestamp ON tenant_usage(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_event_type ON tenant_usage(event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_billable ON tenant_usage(billable, timestamp DESC) WHERE billable = true;
CREATE INDEX IF NOT EXISTS idx_tenant_usage_resource_type ON tenant_usage(resource_type, timestamp DESC);

COMMENT ON TABLE tenant_usage IS 'Usage telemetry for billing and analytics';
COMMENT ON COLUMN tenant_usage.event_type IS 'Type of billable event';
COMMENT ON COLUMN tenant_usage.quantity IS 'Amount of resource consumed';
COMMENT ON COLUMN tenant_usage.cost_cents IS 'Cost in cents (USD) for this usage event';

-- ============================================================================
-- 1B. TENANT_BILLING TABLE - Aggregated billing records
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant Context
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Billing Period
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL,
  billing_month DATE NOT NULL, -- YYYY-MM-01 for partitioning

  -- Usage Aggregates
  total_events INTEGER NOT NULL DEFAULT 0,
  api_calls INTEGER NOT NULL DEFAULT 0,
  pick_submissions INTEGER NOT NULL DEFAULT 0,
  grading_operations INTEGER NOT NULL DEFAULT 0,
  webhook_deliveries INTEGER NOT NULL DEFAULT 0,
  ai_analyses INTEGER NOT NULL DEFAULT 0,

  -- Cost Breakdown
  base_cost_cents INTEGER NOT NULL DEFAULT 0,
  usage_cost_cents INTEGER NOT NULL DEFAULT 0,
  overage_cost_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cost_cents INTEGER NOT NULL DEFAULT 0,

  -- Pricing Tier
  tier_at_billing TEXT,
  pricing_plan_id UUID REFERENCES subscription_plans(id),

  -- Invoice Status
  invoice_status TEXT NOT NULL DEFAULT 'pending' CHECK (invoice_status IN (
    'pending',
    'generated',
    'sent',
    'paid',
    'failed',
    'cancelled'
  )),
  stripe_invoice_id TEXT,
  invoice_generated_at TIMESTAMPTZ,
  invoice_sent_at TIMESTAMPTZ,
  invoice_paid_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint per tenant per month
  CONSTRAINT tenant_billing_unique_period UNIQUE (tenant_id, billing_month)
) PARTITION BY RANGE (billing_month);

-- Create partitions for current and next 12 months
CREATE TABLE IF NOT EXISTS tenant_billing_2025_01 PARTITION OF tenant_billing
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS tenant_billing_2025_02 PARTITION OF tenant_billing
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE IF NOT EXISTS tenant_billing_2025_03 PARTITION OF tenant_billing
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE IF NOT EXISTS tenant_billing_2025_04 PARTITION OF tenant_billing
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE IF NOT EXISTS tenant_billing_2025_05 PARTITION OF tenant_billing
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE IF NOT EXISTS tenant_billing_2025_06 PARTITION OF tenant_billing
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE IF NOT EXISTS tenant_billing_2025_07 PARTITION OF tenant_billing
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE IF NOT EXISTS tenant_billing_2025_08 PARTITION OF tenant_billing
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE IF NOT EXISTS tenant_billing_2025_09 PARTITION OF tenant_billing
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE IF NOT EXISTS tenant_billing_2025_10 PARTITION OF tenant_billing
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE IF NOT EXISTS tenant_billing_2025_11 PARTITION OF tenant_billing
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS tenant_billing_2025_12 PARTITION OF tenant_billing
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Indexes for tenant_billing
CREATE INDEX IF NOT EXISTS idx_tenant_billing_tenant_month ON tenant_billing(tenant_id, billing_month DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_billing_status ON tenant_billing(invoice_status, billing_month DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_billing_stripe_invoice ON tenant_billing(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

COMMENT ON TABLE tenant_billing IS 'Aggregated billing records per tenant per month';
COMMENT ON COLUMN tenant_billing.billing_month IS 'Partition key - first day of billing month';
COMMENT ON COLUMN tenant_billing.total_cost_cents IS 'Final billable amount after discounts';

-- ============================================================================
-- 1C. BILLING_JOBS TABLE - Track billing worker executions
-- ============================================================================
CREATE TABLE IF NOT EXISTS billing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job Metadata
  job_type TEXT NOT NULL CHECK (job_type IN (
    'monthly_aggregation',
    'invoice_generation',
    'stripe_sync',
    'manual_override'
  )),
  billing_month DATE NOT NULL,

  -- Execution Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'running',
    'completed',
    'failed',
    'cancelled'
  )),

  -- Metrics
  tenants_processed INTEGER DEFAULT 0,
  invoices_generated INTEGER DEFAULT 0,
  total_revenue_cents INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds DECIMAL(10,2),

  -- Error Handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_billing_jobs_month_status ON billing_jobs(billing_month DESC, status);
CREATE INDEX IF NOT EXISTS idx_billing_jobs_type_status ON billing_jobs(job_type, status);

COMMENT ON TABLE billing_jobs IS 'Audit log for billing worker executions';

-- ============================================================================
-- 2. SUBSCRIPTION_PLANS TABLE - Subscription tier definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Plan Identity
  name TEXT NOT NULL UNIQUE, -- 'Free', 'Premium', 'VIP', 'Enterprise'
  slug TEXT NOT NULL UNIQUE, -- 'free', 'premium', 'vip', 'enterprise'
  display_name TEXT NOT NULL,
  description TEXT,
  
  -- Pricing
  price_monthly_cents INTEGER NOT NULL DEFAULT 0, -- Monthly price in cents
  price_yearly_cents INTEGER DEFAULT 0, -- Yearly price in cents (discounted)
  stripe_price_id_monthly TEXT, -- Stripe Price ID for monthly billing
  stripe_price_id_yearly TEXT, -- Stripe Price ID for yearly billing
  
  -- Usage Limits
  limits JSONB NOT NULL DEFAULT '{
    "max_picks_per_day": 10,
    "max_users": 1,
    "max_storage_gb": 1,
    "max_api_calls_per_hour": 100,
    "max_ai_analyses_per_month": 10,
    "max_exports_per_month": 5
  }',
  
  -- Features
  features JSONB NOT NULL DEFAULT '{
    "advanced_analytics": false,
    "priority_support": false,
    "custom_branding": false,
    "api_access": false,
    "webhook_integrations": false,
    "dedicated_account_manager": false
  }',
  
  -- Overage Pricing (usage-based billing)
  overage_pricing JSONB DEFAULT '{
    "picks_per_unit_cents": 10,
    "storage_per_gb_cents": 50,
    "api_calls_per_1000_cents": 100,
    "ai_analysis_per_unit_cents": 25
  }',
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT true, -- Show on pricing page
  sort_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default plans
INSERT INTO subscription_plans (name, slug, display_name, price_monthly_cents, price_yearly_cents, limits, features, sort_order)
VALUES
  ('Free', 'free', 'Free Tier', 0, 0, 
   '{"max_picks_per_day": 5, "max_users": 1, "max_storage_gb": 1, "max_api_calls_per_hour": 50, "max_ai_analyses_per_month": 5, "max_exports_per_month": 2}'::jsonb,
   '{"advanced_analytics": false, "priority_support": false, "custom_branding": false, "api_access": false}'::jsonb,
   1),
  ('Premium', 'premium', 'Premium', 2999, 28800, -- $29.99/mo, $288/yr (20% discount)
   '{"max_picks_per_day": 50, "max_users": 5, "max_storage_gb": 10, "max_api_calls_per_hour": 500, "max_ai_analyses_per_month": 100, "max_exports_per_month": 50}'::jsonb,
   '{"advanced_analytics": true, "priority_support": true, "custom_branding": false, "api_access": true}'::jsonb,
   2),
  ('VIP', 'vip', 'VIP', 9999, 96000, -- $99.99/mo, $960/yr (20% discount)
   '{"max_picks_per_day": 200, "max_users": 20, "max_storage_gb": 50, "max_api_calls_per_hour": 2000, "max_ai_analyses_per_month": 500, "max_exports_per_month": 200}'::jsonb,
   '{"advanced_analytics": true, "priority_support": true, "custom_branding": true, "api_access": true, "webhook_integrations": true}'::jsonb,
   3),
  ('Enterprise', 'enterprise', 'Enterprise', 29999, 288000, -- $299.99/mo, $2880/yr (20% discount)
   '{"max_picks_per_day": -1, "max_users": -1, "max_storage_gb": 500, "max_api_calls_per_hour": -1, "max_ai_analyses_per_month": -1, "max_exports_per_month": -1}'::jsonb,
   '{"advanced_analytics": true, "priority_support": true, "custom_branding": true, "api_access": true, "webhook_integrations": true, "dedicated_account_manager": true}'::jsonb,
   4)
ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE subscription_plans IS 'Subscription tier definitions and pricing';

-- ============================================================================
-- 3. USER_SUBSCRIPTIONS TABLE - User subscription tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User & Plan
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  
  -- Stripe Integration
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_payment_method_id TEXT,
  
  -- Subscription Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',
    'trialing',
    'past_due',
    'canceled',
    'unpaid',
    'incomplete',
    'incomplete_expired',
    'paused'
  )),
  
  -- Billing Cycle
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 month',
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  
  -- Trial
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  
  -- Usage Tracking
  usage_this_period JSONB DEFAULT '{
    "picks_submitted": 0,
    "api_calls": 0,
    "storage_gb": 0,
    "ai_analyses": 0,
    "exports": 0
  }',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT user_subscriptions_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_period_end ON user_subscriptions(current_period_end);

COMMENT ON TABLE user_subscriptions IS 'User subscription management and Stripe integration';

-- ============================================================================
-- 4. INVOICES TABLE - Invoice tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User & Subscription
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  
  -- Stripe Integration
  stripe_invoice_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  
  -- Invoice Details
  invoice_number TEXT UNIQUE NOT NULL,
  amount_cents INTEGER NOT NULL,
  amount_paid_cents INTEGER DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'open',
    'paid',
    'void',
    'uncollectible'
  )),
  
  -- Line Items
  line_items JSONB NOT NULL DEFAULT '[]', -- Array of {description, quantity, unit_price_cents, total_cents}
  
  -- Dates
  invoice_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice ON invoices(stripe_invoice_id);

COMMENT ON TABLE invoices IS 'Invoice tracking and payment history';

-- ============================================================================
-- 5. PAYMENT_EVENTS TABLE - Stripe webhook event log
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Stripe Event
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL, -- e.g., 'invoice.paid', 'customer.subscription.updated'
  
  -- Related Entities
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  
  -- Event Data
  payload JSONB NOT NULL,
  
  -- Processing Status
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_stripe_event ON payment_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_type ON payment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_payment_events_processed ON payment_events(processed);
CREATE INDEX IF NOT EXISTS idx_payment_events_user ON payment_events(user_id);

COMMENT ON TABLE payment_events IS 'Stripe webhook event log for audit and debugging';

-- ============================================================================
-- 6. CHURN_RISK_SCORES TABLE - Churn prediction and prevention
-- ============================================================================
CREATE TABLE IF NOT EXISTS churn_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Risk Score (0-100, higher = more likely to churn)
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  
  -- Contributing Factors
  factors JSONB NOT NULL DEFAULT '{
    "low_engagement": false,
    "payment_failures": false,
    "support_tickets": false,
    "feature_usage_decline": false,
    "competitor_activity": false
  }',
  
  -- Recommendations
  recommended_actions JSONB DEFAULT '[]', -- Array of action items
  
  -- Status
  alert_sent BOOLEAN NOT NULL DEFAULT false,
  alert_sent_at TIMESTAMPTZ,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  
  -- Timestamps
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_churn_risk_user ON churn_risk_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_churn_risk_level ON churn_risk_scores(risk_level, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_churn_risk_unresolved ON churn_risk_scores(resolved) WHERE resolved = false;

COMMENT ON TABLE churn_risk_scores IS 'Churn risk prediction and prevention tracking';

-- ============================================================================
-- 7. REVENUE_ANALYTICS_CACHE TABLE - Pre-computed analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS revenue_analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Time Period
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'yearly')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Revenue Metrics
  mrr_cents INTEGER NOT NULL DEFAULT 0, -- Monthly Recurring Revenue
  arr_cents INTEGER NOT NULL DEFAULT 0, -- Annual Recurring Revenue
  total_revenue_cents INTEGER NOT NULL DEFAULT 0,
  new_revenue_cents INTEGER NOT NULL DEFAULT 0,
  expansion_revenue_cents INTEGER NOT NULL DEFAULT 0,
  contraction_revenue_cents INTEGER NOT NULL DEFAULT 0,
  churn_revenue_cents INTEGER NOT NULL DEFAULT 0,
  
  -- User Metrics
  total_users INTEGER NOT NULL DEFAULT 0,
  active_users INTEGER NOT NULL DEFAULT 0,
  new_users INTEGER NOT NULL DEFAULT 0,
  churned_users INTEGER NOT NULL DEFAULT 0,
  
  -- Subscription Metrics
  total_subscriptions INTEGER NOT NULL DEFAULT 0,
  new_subscriptions INTEGER NOT NULL DEFAULT 0,
  canceled_subscriptions INTEGER NOT NULL DEFAULT 0,
  
  -- Calculated Metrics
  arpu_cents INTEGER DEFAULT 0, -- Average Revenue Per User
  ltv_cents INTEGER DEFAULT 0, -- Lifetime Value
  churn_rate DECIMAL(5,2) DEFAULT 0.00,
  retention_rate DECIMAL(5,2) DEFAULT 0.00,
  
  -- Timestamps
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT revenue_analytics_cache_period_unique UNIQUE (period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_revenue_analytics_period ON revenue_analytics_cache(period_type, period_start DESC);

COMMENT ON TABLE revenue_analytics_cache IS 'Pre-computed revenue analytics for dashboard performance';

-- ============================================================================
-- 8. FUNCTIONS - Helper functions for analytics
-- ============================================================================

-- Function to calculate current MRR
CREATE OR REPLACE FUNCTION calculate_current_mrr()
RETURNS INTEGER AS $$
DECLARE
  total_mrr INTEGER;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN us.billing_cycle = 'monthly' THEN sp.price_monthly_cents
      WHEN us.billing_cycle = 'yearly' THEN sp.price_yearly_cents / 12
      ELSE 0
    END
  ), 0)::INTEGER INTO total_mrr
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.status IN ('active', 'trialing');
  
  RETURN total_mrr;
END;
$$ LANGUAGE plpgsql;

-- Function to check usage limits
CREATE OR REPLACE FUNCTION check_usage_limit(
  p_user_id UUID,
  p_resource_type TEXT,
  p_quantity DECIMAL DEFAULT 1.0
)
RETURNS BOOLEAN AS $$
DECLARE
  v_plan_limit INTEGER;
  v_current_usage DECIMAL;
  v_new_usage DECIMAL;
BEGIN
  -- Get plan limit for resource type
  SELECT (sp.limits->>p_resource_type)::INTEGER INTO v_plan_limit
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = p_user_id AND us.status IN ('active', 'trialing');
  
  -- -1 means unlimited
  IF v_plan_limit = -1 THEN
    RETURN true;
  END IF;
  
  -- Get current usage for this period
  SELECT COALESCE((usage_this_period->>p_resource_type)::DECIMAL, 0) INTO v_current_usage
  FROM user_subscriptions
  WHERE user_id = p_user_id;
  
  v_new_usage := v_current_usage + p_quantity;
  
  RETURN v_new_usage <= v_plan_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. TRIGGERS - Auto-update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_churn_risk_scores_updated_at BEFORE UPDATE ON churn_risk_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 10. GRANTS - RLS Policies (if needed)
-- ============================================================================

-- Enable RLS on sensitive tables
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

-- Users can only see their own subscription data
CREATE POLICY user_subscriptions_select_own ON user_subscriptions
  FOR SELECT USING (auth.uid()::uuid = user_id);

CREATE POLICY invoices_select_own ON invoices
  FOR SELECT USING (auth.uid()::uuid = user_id);

-- Service role can access all data
CREATE POLICY user_subscriptions_service_all ON user_subscriptions
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY invoices_service_all ON invoices
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY payment_events_service_all ON payment_events
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 11. MATERIALIZED VIEWS - Pre-aggregated analytics for performance
-- ============================================================================

-- Tenant usage summary by month
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tenant_usage_monthly AS
SELECT
  tenant_id,
  user_id,
  DATE_TRUNC('month', timestamp) AS billing_month,
  event_type,
  COUNT(*) AS event_count,
  SUM(quantity) AS total_quantity,
  SUM(cost_cents) AS total_cost_cents,
  AVG(cost_cents) AS avg_cost_cents,
  MIN(timestamp) AS first_event_at,
  MAX(timestamp) AS last_event_at
FROM tenant_usage
WHERE billable = true
GROUP BY tenant_id, user_id, DATE_TRUNC('month', timestamp), event_type;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_tenant_usage_monthly_unique
  ON mv_tenant_usage_monthly(tenant_id, user_id, billing_month, event_type);
CREATE INDEX IF NOT EXISTS idx_mv_tenant_usage_monthly_month
  ON mv_tenant_usage_monthly(billing_month DESC);

-- Tenant cost summary (all-time)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tenant_cost_summary AS
SELECT
  tenant_id,
  user_id,
  COUNT(DISTINCT DATE_TRUNC('month', timestamp)) AS active_months,
  COUNT(*) AS total_events,
  SUM(cost_cents) AS lifetime_cost_cents,
  AVG(cost_cents) AS avg_event_cost_cents,
  MIN(timestamp) AS first_event_at,
  MAX(timestamp) AS last_event_at,
  EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) / 86400 AS days_active
FROM tenant_usage
WHERE billable = true
GROUP BY tenant_id, user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_tenant_cost_summary_unique
  ON mv_tenant_cost_summary(tenant_id, user_id);

-- API latency and error rates
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_api_metrics_hourly AS
SELECT
  DATE_TRUNC('hour', timestamp) AS hour,
  metadata->>'endpoint' AS endpoint,
  metadata->>'method' AS method,
  COUNT(*) AS request_count,
  COUNT(*) FILTER (WHERE (metadata->>'statusCode')::int >= 400) AS error_count,
  AVG((metadata->>'durationMs')::numeric) AS avg_latency_ms,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY (metadata->>'durationMs')::numeric) AS p50_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (metadata->>'durationMs')::numeric) AS p95_latency_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY (metadata->>'durationMs')::numeric) AS p99_latency_ms
FROM tenant_usage
WHERE event_type = 'api_call'
  AND metadata ? 'endpoint'
  AND metadata ? 'durationMs'
GROUP BY DATE_TRUNC('hour', timestamp), metadata->>'endpoint', metadata->>'method';

CREATE INDEX IF NOT EXISTS idx_mv_api_metrics_hourly_hour
  ON mv_api_metrics_hourly(hour DESC);
CREATE INDEX IF NOT EXISTS idx_mv_api_metrics_hourly_endpoint
  ON mv_api_metrics_hourly(endpoint, hour DESC);

COMMENT ON MATERIALIZED VIEW mv_tenant_usage_monthly IS 'Pre-aggregated tenant usage by month for billing';
COMMENT ON MATERIALIZED VIEW mv_tenant_cost_summary IS 'Lifetime cost summary per tenant';
COMMENT ON MATERIALIZED VIEW mv_api_metrics_hourly IS 'API performance metrics aggregated hourly';

-- ============================================================================
-- 12. FUNCTIONS - Billing aggregation and helpers
-- ============================================================================

-- Function to aggregate usage for a tenant for a billing period
CREATE OR REPLACE FUNCTION aggregate_tenant_usage(
  p_tenant_id UUID,
  p_billing_month DATE
)
RETURNS TABLE (
  total_events BIGINT,
  api_calls BIGINT,
  pick_submissions BIGINT,
  grading_operations BIGINT,
  webhook_deliveries BIGINT,
  ai_analyses BIGINT,
  total_cost_cents BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_events,
    COUNT(*) FILTER (WHERE event_type = 'api_call')::BIGINT AS api_calls,
    COUNT(*) FILTER (WHERE event_type = 'pick_submission')::BIGINT AS pick_submissions,
    COUNT(*) FILTER (WHERE event_type = 'grading_operation')::BIGINT AS grading_operations,
    COUNT(*) FILTER (WHERE event_type = 'webhook_delivery')::BIGINT AS webhook_deliveries,
    COUNT(*) FILTER (WHERE event_type = 'ai_analysis')::BIGINT AS ai_analyses,
    COALESCE(SUM(cost_cents), 0)::BIGINT AS total_cost_cents
  FROM tenant_usage
  WHERE tenant_id = p_tenant_id
    AND billable = true
    AND timestamp >= p_billing_month
    AND timestamp < (p_billing_month + INTERVAL '1 month');
END;
$$ LANGUAGE plpgsql;

-- Function to calculate overage charges
CREATE OR REPLACE FUNCTION calculate_overage_charges(
  p_user_id UUID,
  p_billing_month DATE
)
RETURNS INTEGER AS $$
DECLARE
  v_plan_limits JSONB;
  v_overage_pricing JSONB;
  v_usage RECORD;
  v_overage_cost INTEGER := 0;
BEGIN
  -- Get user's plan limits and overage pricing
  SELECT sp.limits, sp.overage_pricing INTO v_plan_limits, v_overage_pricing
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = p_user_id
    AND us.status IN ('active', 'trialing');

  IF v_plan_limits IS NULL THEN
    RETURN 0; -- No active subscription
  END IF;

  -- Get usage for the month
  SELECT * INTO v_usage FROM aggregate_tenant_usage(
    (SELECT tenant_id FROM users WHERE id = p_user_id),
    p_billing_month
  );

  -- Calculate overage for picks
  IF (v_plan_limits->>'max_picks_per_day')::INTEGER > 0 THEN
    DECLARE
      v_max_picks INTEGER := (v_plan_limits->>'max_picks_per_day')::INTEGER * 30; -- Monthly limit
      v_overage INTEGER := GREATEST(0, v_usage.pick_submissions - v_max_picks);
    BEGIN
      v_overage_cost := v_overage_cost + (v_overage * COALESCE((v_overage_pricing->>'picks_per_unit_cents')::INTEGER, 10));
    END;
  END IF;

  -- Calculate overage for API calls
  IF (v_plan_limits->>'max_api_calls_per_hour')::INTEGER > 0 THEN
    DECLARE
      v_max_api_calls INTEGER := (v_plan_limits->>'max_api_calls_per_hour')::INTEGER * 24 * 30; -- Monthly limit
      v_overage INTEGER := GREATEST(0, v_usage.api_calls - v_max_api_calls);
    BEGIN
      v_overage_cost := v_overage_cost + ((v_overage / 1000) * COALESCE((v_overage_pricing->>'api_calls_per_1000_cents')::INTEGER, 100));
    END;
  END IF;

  -- Calculate overage for AI analyses
  IF (v_plan_limits->>'max_ai_analyses_per_month')::INTEGER > 0 THEN
    DECLARE
      v_max_ai INTEGER := (v_plan_limits->>'max_ai_analyses_per_month')::INTEGER;
      v_overage INTEGER := GREATEST(0, v_usage.ai_analyses - v_max_ai);
    BEGIN
      v_overage_cost := v_overage_cost + (v_overage * COALESCE((v_overage_pricing->>'ai_analysis_per_unit_cents')::INTEGER, 25));
    END;
  END IF;

  RETURN v_overage_cost;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_usage_monthly;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_cost_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_api_metrics_hourly;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION aggregate_tenant_usage IS 'Aggregate usage metrics for a tenant for a billing period';
COMMENT ON FUNCTION calculate_overage_charges IS 'Calculate overage charges based on plan limits';
COMMENT ON FUNCTION refresh_analytics_views IS 'Refresh all analytics materialized views';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

