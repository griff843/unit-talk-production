# Environment Snapshot - Phase 13 Cutover
**Date**: 2025-10-31  
**Phase**: 13 - Model Serving & Ensemble Layer  
**Operator**: Ops Orchestrator (Augment Agent)

## Environment Configuration (Masked)

### Core Application
```
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
LOG_MODE=sync
```

### Database (Supabase)
```
SUPABASE_URL=https://cqfnsozknjzvyiziwicl.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUPA***masked***
SUPABASE_ANON_KEY=SUPA***masked***
DATABASE_DIRECT_URL=postgresql://postgres.***masked***@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

### Multi-Tenancy
```
DEFAULT_TENANT_ID=12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a
```

### Canonical Convergence (Production Ready)
```
PICK_DRIVER=canonical
PUBLISH_MODE=outbox
SHADOW_MODE=false
LOG_MODE=sync
```

### Phase 13: Model Serving & Ensemble
```
INFERENCE_P95_LATENCY_TARGET=150
INFERENCE_P99_LATENCY_TARGET=300
INFERENCE_MAX_BATCH_SIZE=100
INFERENCE_DEFAULT_TIMEOUT=5000
INFERENCE_ENABLE_CACHE=true
INFERENCE_CACHE_TTL=300000

RATE_LIMIT_QPS=1000
CIRCUIT_BREAKER_OPEN_AFTER_ERRORS=5
CIRCUIT_BREAKER_RESET_TIMEOUT=60000

ENSEMBLE_METHOD=confidence_weighted
ENSEMBLE_MIN_MODELS=3
ENSEMBLE_MAX_MODELS=8
ENSEMBLE_DIVERSITY_THRESHOLD=0.3
ENSEMBLE_CONFIDENCE_THRESHOLD=0.5
ENSEMBLE_ENABLE_META_LEARNER=true
ENSEMBLE_WEIGHT_DECAY_RATE=0.1
ENSEMBLE_PERFORMANCE_LOOKBACK_DAYS=7

EVALUATOR_INTERVAL=3600000
EVALUATOR_PERFORMANCE_WINDOW=1000
EVALUATOR_DRIFT_THRESHOLD=0.15
EVALUATOR_CALIBRATION_THRESHOLD=0.1
EVALUATOR_ENABLE_AUTO_RETRAIN=true
EVALUATOR_ACCURACY_DEGRADATION_THRESHOLD=0.05
EVALUATOR_MIN_SAMPLES=100

CANARY_MODE=canary
CANARY_PERCENT=5
CANARY_RAMPUP_INTERVAL_MS=300000
CANARY_AUTO_ROLLBACK=true
CANARY_ROLLBACK_ON_SLO_VIOLATION=true
```

### Discord Integration
```
DISCORD_TOKEN=DISCO***masked***
DISCORD_CLIENT_ID=DISCO***masked***
DISCORD_WEBHOOK_URL=DISCO***masked***
DISCORD_OPERATOR_WEBHOOK_URL=DISCO***masked***
```

## Verification Status
- ✅ Environment file loaded
- ✅ Secrets masked in output
- ✅ Canonical driver configured
- ✅ Outbox publish mode enabled
- ✅ Shadow mode disabled (LIVE)
- ✅ Phase 13 inference parameters configured
- ✅ Canary deployment parameters set

## Next Steps
1. Health check endpoints
2. PostgREST visibility verification
3. Multi-league E2E validation
4. Canary deployment execution
5. Monitoring dashboard import

