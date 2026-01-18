# Picks Domain Blueprint
**Phase 11B: Core Domain Integration**  
**Date:** 2025-11-01  
**Status:** ✅ Production Ready

---

## 📋 Overview

The Picks domain is the core business logic layer for Unit Talk's betting picks platform, implementing a complete DOKS-compliant multi-tenant architecture with event-driven workflows, professional grading integration, and comprehensive SLO tracking.

### Key Features

- ✅ Multi-tenant isolation with RLS
- ✅ Idempotent operations
- ✅ Event-driven architecture
- ✅ Professional grading integration
- ✅ SLO instrumentation (p95 < 2s)
- ✅ Comprehensive audit trail

---

## 🗄️ Database Schema

### Core Tables

#### 1. `tenants`
Multi-tenant foundation for platform isolation.

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT UNIQUE,
  settings JSONB DEFAULT '{}',
  features JSONB DEFAULT '{}',
  limits JSONB DEFAULT '{"max_picks_per_day": 100}',
  status TEXT NOT NULL DEFAULT 'active',
  tier TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status) WHERE status = 'active';
```

#### 2. `users`
User management with tenant isolation.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  discord_id TEXT,
  username TEXT NOT NULL,
  email TEXT,
  tier TEXT NOT NULL DEFAULT 'Free',
  status TEXT NOT NULL DEFAULT 'active',
  total_picks INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT users_tenant_discord_unique UNIQUE (tenant_id, discord_id)
);

-- Indexes
CREATE INDEX idx_users_tenant_id ON users(tenant_id, created_at DESC);
CREATE INDEX idx_users_discord_id ON users(discord_id);
```

#### 3. `props`
Market propositions (betting opportunities).

```sql
CREATE TABLE props (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sport TEXT NOT NULL,
  player_name TEXT NOT NULL,
  stat_type TEXT NOT NULL,
  line DECIMAL(8,2),
  over_odds INTEGER,
  under_odds INTEGER,
  game_date DATE,
  bookmaker TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_props_tenant_id ON props(tenant_id, created_at DESC);
CREATE INDEX idx_props_game_date ON props(tenant_id, game_date DESC);
```

#### 4. `picks`
User picks with full workflow support.

```sql
CREATE TABLE picks (
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
  workflow_stage TEXT NOT NULL DEFAULT 'draft',
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Professional Grading
  professional_score DECIMAL(5,2),
  grading_status TEXT,
  graded_at TIMESTAMPTZ,
  
  -- Idempotency
  idempotency_key TEXT,
  bet_slip_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  
  CONSTRAINT picks_tenant_idempotency_unique UNIQUE (tenant_id, idempotency_key)
);

-- Indexes
CREATE INDEX idx_picks_tenant_id ON picks(tenant_id, created_at DESC);
CREATE INDEX idx_picks_user_id ON picks(tenant_id, user_id, created_at DESC);
CREATE INDEX idx_picks_workflow_stage ON picks(tenant_id, workflow_stage);
CREATE INDEX idx_picks_idempotency_key ON picks(idempotency_key);
```

#### 5. `pick_events`
Event sourcing for picks domain.

```sql
CREATE TABLE pick_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pick_id UUID NOT NULL REFERENCES picks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pick_events_pick_id ON pick_events(pick_id, created_at DESC);
CREATE INDEX idx_pick_events_correlation_id ON pick_events(correlation_id);
```

#### 6. `scores`
Professional grading results.

```sql
CREATE TABLE scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pick_id UUID NOT NULL REFERENCES picks(id) ON DELETE CASCADE,
  professional_score DECIMAL(5,2) NOT NULL,
  devigged_edge DECIMAL(5,4),
  clv_pct DECIMAL(5,2),
  grading_engine_version TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT scores_pick_unique UNIQUE (pick_id)
);
```

#### 7. `notifications`
User notifications.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  priority TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 8. `audit_events`
Comprehensive audit trail.

```sql
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  actor_id UUID REFERENCES users(id),
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔒 Row Level Security (RLS)

All tables implement tenant isolation via RLS policies:

```sql
-- Enable RLS
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY "Picks: Tenant isolation"
  ON picks FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- User-specific access
CREATE POLICY "Picks: Users can view own picks"
  ON picks FOR SELECT
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    AND user_id = current_setting('app.current_user_id', true)::uuid
  );

-- Service role bypass
CREATE POLICY "Picks: Service role full access"
  ON picks FOR ALL
  USING (current_setting('role', true) = 'service_role');
```

### Setting Tenant Context

```sql
-- Helper function
CREATE FUNCTION set_tenant_context(p_tenant_id UUID, p_user_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', p_tenant_id::text, false);
  PERFORM set_config('app.current_user_id', p_user_id::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🚀 API Specifications

### Base URL
```
https://api.unittalk.com/api/picks
```

### Authentication
All requests require:
- `x-tenant-id` header (optional, defaults to Unit Talk tenant)
- `x-user-id` header (required for user-specific operations)
- `x-correlation-id` header (optional, auto-generated if not provided)

### Response Format

All responses follow this structure:

```typescript
{
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  correlation_id: string;
  timestamp: string;
}
```

### Endpoints

#### 1. Create Pick
**POST** `/api/picks`

Creates a new pick with idempotency support.

**Request:**
```json
{
  "prop_id": "uuid",
  "selection": "LeBron James Over 25.5 Points",
  "odds": -110,
  "stake": 1.0,
  "confidence": 8,
  "workflow_stage": "draft",
  "idempotency_key": "optional-unique-key"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tenant_id": "uuid",
    "user_id": "uuid",
    "selection": "LeBron James Over 25.5 Points",
    "odds": -110,
    "workflow_stage": "draft",
    "created_at": "2025-11-01T12:00:00Z"
  },
  "correlation_id": "uuid",
  "timestamp": "2025-11-01T12:00:00Z"
}
```

**Idempotent Response (200):**
```json
{
  "success": true,
  "data": { /* existing pick */ },
  "idempotent": true,
  "correlation_id": "uuid",
  "timestamp": "2025-11-01T12:00:00Z"
}
```

#### 2. Get Pick
**GET** `/api/picks/:id`

Retrieves a pick by ID with related data.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "selection": "LeBron James Over 25.5 Points",
    "users": {
      "username": "griff843",
      "tier": "VIP"
    },
    "props": {
      "player_name": "LeBron James",
      "stat_type": "points",
      "line": 25.5
    },
    "scores": {
      "professional_score": 85.5,
      "devigged_edge": 0.0234,
      "clv_pct": 2.5
    }
  },
  "correlation_id": "uuid",
  "timestamp": "2025-11-01T12:00:00Z"
}
```

**Response (404):**
```json
{
  "success": false,
  "error": "PICK_NOT_FOUND",
  "message": "Pick not found",
  "correlation_id": "uuid",
  "timestamp": "2025-11-01T12:00:00Z"
}
```

#### 3. Score Pick
**POST** `/api/picks/:id/score`

Triggers professional grading for a pick.

**Request:**
```json
{
  "force_rescore": false
}
```

**Response (202):**
```json
{
  "success": true,
  "data": {
    "pick_id": "uuid",
    "status": "processing",
    "message": "Scoring request submitted. Check grading_status for updates."
  },
  "correlation_id": "uuid",
  "timestamp": "2025-11-01T12:00:00Z"
}
```

#### 4. Publish Pick
**POST** `/api/picks/:id/publish`

Publishes an approved pick to configured channels.

**Request:**
```json
{
  "channels": ["discord", "email"]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "pick_id": "uuid",
    "status": "published",
    "channels": ["discord", "email"],
    "published_at": "2025-11-01T12:00:00Z"
  },
  "correlation_id": "uuid",
  "timestamp": "2025-11-01T12:00:00Z"
}
```

**Response (400 - Not Approved):**
```json
{
  "success": false,
  "error": "PICK_NOT_APPROVED",
  "message": "Pick must be approved before publishing",
  "current_stage": "draft",
  "correlation_id": "uuid",
  "timestamp": "2025-11-01T12:00:00Z"
}
```

---

## 📊 Event Schemas

All events published to `pick_events` table follow this structure:

### Event: `pick.submitted`
```json
{
  "event_type": "pick.submitted",
  "pick_id": "uuid",
  "tenant_id": "uuid",
  "correlation_id": "uuid",
  "event_data": {
    "pick_id": "uuid",
    "user_id": "uuid",
    "selection": "LeBron James Over 25.5 Points",
    "timestamp": "2025-11-01T12:00:00Z"
  },
  "metadata": {
    "source": "picks_api",
    "version": "1.0.0"
  }
}
```

### Event: `pick.scored`
```json
{
  "event_type": "pick.scored",
  "pick_id": "uuid",
  "tenant_id": "uuid",
  "correlation_id": "uuid",
  "event_data": {
    "pick_id": "uuid",
    "professional_score": 85.5,
    "grading_engine_version": "v2.0.0",
    "timestamp": "2025-11-01T12:00:05Z"
  }
}
```

### Event: `pick.published`
```json
{
  "event_type": "pick.published",
  "pick_id": "uuid",
  "tenant_id": "uuid",
  "correlation_id": "uuid",
  "event_data": {
    "pick_id": "uuid",
    "channels": ["discord", "email"],
    "published_at": "2025-11-01T12:00:10Z"
  }
}
```

### Event: `pick.failed`
```json
{
  "event_type": "pick.failed",
  "pick_id": "uuid",
  "tenant_id": "uuid",
  "correlation_id": "uuid",
  "event_data": {
    "pick_id": "uuid",
    "operation": "score",
    "error_type": "grading_timeout",
    "error_message": "Grading service timeout",
    "timestamp": "2025-11-01T12:00:15Z"
  }
}
```

---

## 📈 SLO Definitions

### SLO 1: Submit to Score Latency
- **Metric:** `picks_submit_to_score_latency_seconds`
- **Target:** p95 < 2 seconds
- **Window:** 30 days
- **Error Budget:** 5%

### SLO 2: Error Rate
- **Metric:** `picks_error_rate`
- **Target:** < 1%
- **Window:** 24 hours
- **Error Budget:** 1%

### SLO 3: API Response Time
- **Metric:** `picks_latency_seconds`
- **Target:** p95 < 500ms
- **Window:** 5 minutes
- **Error Budget:** 5%

### Prometheus Metrics

```prometheus
# Counters
picks_submitted_total{tenant_id, workflow_stage}
picks_scored_total{tenant_id, grading_engine_version}
picks_published_total{tenant_id, channels}
picks_failed_total{tenant_id, operation, error_type}

# Histograms
picks_latency_seconds{operation}
picks_submit_to_score_latency_seconds{tenant_id}
picks_score_to_publish_latency_seconds{tenant_id}
picks_e2e_latency_seconds{tenant_id}

# Gauges
picks_active_by_stage{tenant_id, workflow_stage}
picks_pending_scoring_queue{tenant_id}
picks_error_rate{tenant_id, operation}
```

### Metrics Endpoint

```bash
GET /metrics

# Response (Prometheus format)
# HELP picks_submitted_total Total number of picks submitted
# TYPE picks_submitted_total counter
picks_submitted_total{tenant_id="00000000-0000-0000-0000-000000000001",workflow_stage="draft"} 1234

# HELP picks_latency_seconds Latency of pick operations in seconds
# TYPE picks_latency_seconds histogram
picks_latency_seconds_bucket{operation="create",le="0.1"} 850
picks_latency_seconds_bucket{operation="create",le="0.5"} 1200
picks_latency_seconds_bucket{operation="create",le="2"} 1234
picks_latency_seconds_sum{operation="create"} 245.6
picks_latency_seconds_count{operation="create"} 1234
```

---

## 🧪 Testing

### Unit Tests
```bash
cd apps/api
npm test -- src/routes/domain/__tests__/picks.test.ts
```

### Integration Tests
```bash
# Run full integration test suite
npm run test:integration

# Test specific endpoint
curl -X POST http://localhost:3000/api/picks \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "x-user-id: $(uuidgen)" \
  -d '{
    "selection": "Test Pick",
    "odds": -110,
    "stake": 1.0
  }'
```

### SLO Validation
```bash
# Check SLO compliance
curl http://localhost:3000/api/picks/slo-status

# Response
{
  "slos": [
    {
      "name": "Submit to Score Latency (p95)",
      "target": 2.0,
      "current": 1.45,
      "passing": true,
      "unit": "seconds"
    },
    {
      "name": "Error Rate",
      "target": 1.0,
      "current": 0.23,
      "passing": true,
      "unit": "percent"
    }
  ]
}
```

---

## 🚀 Deployment

### Migration
```bash
# Apply database migration
docker-compose exec api npm run db:migrate

# Verify migration
docker-compose exec database psql -U postgres -c "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('tenants', 'picks', 'pick_events', 'scores');
"
```

### API Integration
```typescript
// apps/api/src/api-server.ts
import picksRouter from './routes/domain/picks';

app.use('/api/picks', picksRouter);
```

### Monitoring Setup
```typescript
// apps/api/src/monitoring/index.ts
import { getPicksMetrics } from './picks-metrics';

app.get('/metrics', async (req, res) => {
  const picksMetrics = await getPicksMetrics();
  res.set('Content-Type', 'text/plain');
  res.send(picksMetrics);
});
```

---

## 📝 Acceptance Criteria

- [x] Database migration runs successfully on staging
- [x] 100% test coverage for CRUD operations
- [x] Prometheus metrics exposed at `/metrics`
- [x] Picks CRUD validated end-to-end
- [x] Event flow validated (submit → score → publish)
- [x] RLS policies enforce tenant isolation
- [x] Idempotency keys prevent duplicate picks
- [x] SLO targets met (p95 < 2s, error rate < 1%)

---

## 🔗 Related Documentation

- [DOKS Bootstrap](../DOKS_BOOTSTRAP.md)
- [Event-Driven Architecture](../architecture/diagrams/04-event-backbone.md)
- [SLO Monitoring](../../migrations/006_fortune100_slo_monitoring.sql)
- [Multi-Tenant Patterns](../architecture/diagrams/03-multi-tenant-patterns.md)

---

**Last Updated:** 2025-11-01
**Version:** 1.0.0
**Status:** ✅ Production Ready


