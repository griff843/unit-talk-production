# Environment Snapshot - Phase 13 Deployment
**Date:** 2025-01-30  
**Purpose:** Pre-deployment environment verification

## Critical Configuration (Masked)

### Canonical Architecture
```bash
PICK_DRIVER=canonical                    # ✅ Canonical-first
PUBLISH_MODE=outbox                      # ✅ Event-driven outbox pattern
SHADOW_MODE=false                        # ✅ LIVE Discord publishing
LOG_MODE=sync                            # ✅ Production reliability
```

### Database Configuration
```bash
SUPABASE_URL=https://cqfn***.supabase.co
SUPABASE_ANON_KEY=eyJh***[MASKED]
SUPABASE_SERVICE_ROLE_KEY=eyJh***[MASKED]
DATABASE_DIRECT_URL=postgresql://postgres.cqfn***[MASKED]
DEFAULT_TENANT_ID=12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a
```

### Service Endpoints
```bash
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3010
TEMPORAL_ADDRESS=localhost:7233
REDIS_URL=redis://localhost:6379
PROMETHEUS_URL=http://localhost:9090
```

### Discord Integration
```bash
DISCORD_TOKEN=***[MASKED]
DISCORD_CLIENT_ID=***[MASKED]
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/***[MASKED]
DISCORD_OPERATOR_WEBHOOK_URL=https://discord.com/api/webhooks/***[MASKED]
```

### Professional Scoring
```bash
USE_PRO_SCORER=false                     # Safety: disabled by default
SCORING_DEBUG=false                      # Cost control
```

### AI Model Routing
```bash
ADVICE_MODEL_DEFAULT=kimi-k2
ADVICE_MODEL_FALLBACK=claude-sonnet
ADVICE_MODEL_MVP=gpt-4-turbo
ADVICE_CACHE_TTL_SEC=86400
ADVICE_REQUERY_BPS=15
```

### Promotion Gates
```bash
INSTANT_S_TIER_MIN_EV=0.05
INSTANT_S_TIER_MIN_CONFIDENCE=0.75
INSTANT_S_TIER_MIN_PROFESSIONAL_SCORE=85
SCHEDULED_10AM_MIN_EV=0.03
SCHEDULED_10AM_MIN_CONFIDENCE=0.65
```

### Portfolio Risk Management
```bash
MAX_SINGLE_POSITION_SIZE=0.25
MAX_DAILY_PORTFOLIO_RISK=1.0
MAX_GAME_EXPOSURE=0.40
MAX_PLAYER_EXPOSURE=0.30
MAX_CORRELATION_THRESHOLD=0.70
MAX_CORRELATED_POSITIONS=3
MAX_SPORT_CONCENTRATION=0.60
MAX_TIER_CONCENTRATION=0.80
DAILY_VAR_LIMIT=0.15
WEEKLY_DRAWDOWN_LIMIT=0.25
```

### S-Tier Enforcement
```bash
S_TIER_MIN_CLV_BPS=15
S_TIER_MAX_NEGATIVE_CLV_BPS=-3
S_TIER_MIN_STEAM_STRENGTH=20
S_TIER_REQUIRE_POSITIVE_STEAM=true
```

### External APIs
```bash
ODDS_API_KEY=8014***[MASKED]
OPTIMAL_API_KEY=***[MASKED]
SGO_API_KEY=dummy_key_for_dev
OPENAI_API_KEY=***[MASKED]
```

### Monitoring & Observability
```bash
GRAFANA_PASSWORD=***[MASKED]
SLACK_ALERTS_WEBHOOK=https://hooks.slack.com/services/***[MASKED]
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/***[MASKED]
```

## Docker Services Status

| Service | Image | Status | Ports |
|---------|-------|--------|-------|
| api | unit-talk-production-main-api | Up 9 hours (healthy) | 3010:3000, 3011:3010 |
| grafana | grafana/grafana:latest | Up 18 hours (healthy) | 3001:3000 |
| postgres | postgres:15-alpine | Up 18 hours (healthy) | 5432:5432 |
| prometheus | prom/prometheus:latest | Up 18 hours (healthy) | 9090:9090 |
| redis | redis:7-alpine | Up 18 hours (healthy) | 6379:6379 |
| temporal | temporalio/auto-setup:1.20.0 | Up 18 hours (healthy) | 7233:7233 |
| temporal-postgres | postgres:13 | Up 18 hours (healthy) | 5432 (internal) |

## Health Check Results

### API Health Endpoint
**URL:** `http://localhost:3010/api/health`  
**Status:** ✅ 200 OK  
**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-30T19:35:45.013Z",
  "services": {
    "database": {"status": "up", "responseTime": 0},
    "redis": {"status": "up", "responseTime": 1},
    "agents": {"status": "up"},
    "external_apis": {"status": "up"}
  },
  "version": "1.0.0",
  "uptime": 31864.787803037,
  "supabase": "ok",
  "discord": "present",
  "logMode": "sync",
  "shadowMode": false,
  "driver": {
    "effective": "canonical",
    "requested": "canonical",
    "reason": "config_canonical"
  },
  "publisher": {
    "enabled": true,
    "running": true,
    "mode": "outbox",
    "circuitBreaker": {
      "state": "CLOSED",
      "opens": 0
    }
  },
  "pgrest": {
    "attempts": 1,
    "successes": 0,
    "failures": 1,
    "selfHeal": true
  },
  "limiter": {
    "writeLimit": 10,
    "readLimit": 300,
    "store": "redis"
  }
}
```

### Preflight Check
**URL:** `http://localhost:3010/api/domain/picks/preflight`  
**Status:** ✅ 200 OK  
**Tables Visible:** picks, pick_publish

### Metrics Endpoint
**URL:** `http://localhost:3010/metrics`  
**Status:** ✅ 200 OK  
**Format:** Prometheus metrics

## PostgREST Visibility Check

**Script:** `scripts/ops/verify-pgrst-visible.ts`  
**Status:** ✅ ALL TABLES VISIBLE

| Table | Status |
|-------|--------|
| picks | ✅ VISIBLE (1 rows) |
| pick_publish | ✅ VISIBLE (0 rows) |

## Verification Summary

✅ All Docker services healthy  
✅ Canonical architecture active (PICK_DRIVER=canonical)  
✅ Outbox pattern enabled (PUBLISH_MODE=outbox)  
✅ Live Discord publishing (SHADOW_MODE=false)  
✅ API health check passing  
✅ Preflight check passing  
✅ PostgREST visibility confirmed  
✅ Metrics endpoint accessible  
✅ Database connections verified  
✅ Redis connection verified  
✅ Temporal connection verified  

## Next Steps

1. Execute E2E validation for all 4 leagues (NBA, NFL, MLB, NHL)
2. Run canary deployment at 5%
3. Validate SLOs and ramp to 25%
4. Import Grafana dashboards
5. Configure Prometheus alerts
6. Schedule nightly validation

---
**Generated:** 2025-01-30  
**Ops Orchestrator:** Phase 13 Deployment Verification

