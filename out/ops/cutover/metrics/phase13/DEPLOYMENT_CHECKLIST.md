# Phase 13 Deployment Checklist - Model Serving Infrastructure

**Date:** 2025-11-01  
**Charter:** v3.0 → v4.0  
**Phase:** 13 - Model Serving & Ensemble Infrastructure

---

## Pre-Deployment Validation

### 1. Environment Verification

```bash
# Verify Docker environment is running
./dev.sh status

# Expected: All services healthy
```

- [ ] Docker services running
- [ ] Database accessible
- [ ] Prometheus running
- [ ] Grafana accessible

### 2. Database Migration Dry-Run

```bash
# Test migration syntax (Docker-first)
docker-compose exec api bash -c "
  psql \$DATABASE_DIRECT_URL -f /app/../../supabase/migrations/20251101_phase13_serving.sql --dry-run
"
```

- [ ] Migration syntax valid
- [ ] No SQL errors
- [ ] All dependencies exist (tenants, predictive_models, picks, props)

### 3. TypeScript Compilation

```bash
# Verify TypeScript compiles (Docker-first)
docker-compose exec api npm run type-check
```

- [ ] Zero TypeScript errors
- [ ] ModelServingMetrics.ts compiles
- [ ] No import errors

### 4. Metrics Server Test

```bash
# Test metrics server startup (Docker-first)
docker-compose exec api node -e "
  const { getModelServingMetrics } = require('./src/monitoring/ModelServingMetrics');
  const metrics = getModelServingMetrics(9464);
  console.log('✅ Metrics server started');
  setTimeout(() => process.exit(0), 2000);
"
```

- [ ] Metrics server starts without errors
- [ ] Port 9464 listening
- [ ] Health endpoint responds

---

## Deployment Steps

### Step 1: Apply Database Migration

```bash
# Apply migration to production database (Docker-first)
docker-compose exec api bash -c "
  psql \$DATABASE_DIRECT_URL -f /app/../../supabase/migrations/20251101_phase13_serving.sql
"
```

**Expected Output:**
```
CREATE TABLE
CREATE INDEX
CREATE INDEX
...
CREATE FUNCTION
SELECT 1  -- pg_notify confirmation
```

**Validation:**
```bash
# Verify tables created (Docker-first)
docker-compose exec api bash -c "
  psql \$DATABASE_DIRECT_URL -c \"
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('model_predictions_live', 'model_performance_history')
    ORDER BY table_name;
  \"
"
```

- [ ] `model_predictions_live` table exists
- [ ] `model_performance_history` table exists
- [ ] Indexes created (check with `\d model_predictions_live`)
- [ ] Function `check_model_slo_compliance` exists

### Step 2: Verify PostgREST Schema Reload

```bash
# Check PostgREST schema visibility (Docker-first)
docker-compose exec api npm run ops:verify-pgrst
```

- [ ] `model_predictions_live` visible in PostgREST
- [ ] `model_performance_history` visible in PostgREST
- [ ] No schema cache issues

### Step 3: Deploy Metrics Server

```bash
# Restart API service to load new metrics (Docker-first)
docker-compose restart api

# Verify metrics endpoint
curl http://localhost:9464/metrics | grep model_serving
```

**Expected Output:**
```
# HELP model_serving_inference_requests_total Total number of model inference requests
# TYPE model_serving_inference_requests_total counter
...
```

- [ ] Metrics endpoint responding
- [ ] All metrics registered
- [ ] No startup errors in logs

### Step 4: Import Grafana Dashboard

```bash
# Import dashboard via Grafana API
curl -X POST http://localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${GRAFANA_API_KEY}" \
  -d @infrastructure/dashboards/model-serving-dashboard.json
```

**Alternative: Manual Import**
1. Open Grafana: http://localhost:3000
2. Navigate to Dashboards → Import
3. Upload `infrastructure/dashboards/model-serving-dashboard.json`
4. Select Prometheus datasource
5. Click Import

- [ ] Dashboard imported successfully
- [ ] All 12 panels visible
- [ ] No query errors
- [ ] Alerts configured

### Step 5: Load Prometheus Alert Rules

```bash
# Copy alert rules to Prometheus config directory
cp infrastructure/monitoring/prometheus-rules-model-serving.yaml \
   /path/to/prometheus/rules/

# Reload Prometheus configuration
curl -X POST http://localhost:9090/-/reload
```

**Validation:**
```bash
# Check alert rules loaded
curl http://localhost:9090/api/v1/rules | jq '.data.groups[] | select(.name | contains("model-serving"))'
```

- [ ] Alert rules loaded
- [ ] 13 rules configured
- [ ] No syntax errors
- [ ] Rules in "inactive" state (no alerts firing)

---

## Post-Deployment Validation

### 1. Database Schema Validation

```bash
# Run comprehensive schema check (Docker-first)
docker-compose exec api bash -c "
  psql \$DATABASE_DIRECT_URL <<EOF
    -- Check table structure
    SELECT 
      table_name,
      (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count,
      (SELECT count(*) FROM pg_indexes WHERE tablename = t.table_name) as index_count
    FROM information_schema.tables t
    WHERE table_schema = 'public' 
      AND table_name IN ('model_predictions_live', 'model_performance_history');

    -- Test SLO compliance function
    SELECT * FROM check_model_slo_compliance(
      (SELECT id FROM predictive_models LIMIT 1),
      1
    );
EOF
"
```

**Expected Results:**
- `model_predictions_live`: ~30 columns, ~7 indexes
- `model_performance_history`: ~35 columns, ~7 indexes
- Function returns SLO compliance data

- [ ] Table structures correct
- [ ] All indexes created
- [ ] Function executable
- [ ] No constraint violations

### 2. Metrics Collection Validation

```bash
# Generate test prediction to verify metrics
curl -X POST http://localhost:3000/api/ml/predict \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "test-model",
    "features": {"test": 1}
  }'

# Check metrics updated
curl http://localhost:9464/metrics | grep -A 5 "model_serving_inference_requests_total"
```

- [ ] Metrics endpoint responding
- [ ] Counters incrementing
- [ ] Histograms recording
- [ ] Gauges updating

### 3. Dashboard Validation

**Manual Checks:**
1. Open Grafana dashboard: http://localhost:3000/d/model-serving
2. Verify all panels load without errors
3. Check time range selector works
4. Verify refresh rate (30s)
5. Test panel zoom/drill-down

- [ ] All 12 panels rendering
- [ ] No "No Data" errors
- [ ] Queries executing successfully
- [ ] Alerts visible in panel headers

### 4. Alert Validation

```bash
# Simulate SLO violation to test alerts
# (This should be done in a test environment)

# Check alert manager
curl http://localhost:9093/api/v1/alerts | jq '.data[] | select(.labels.component == "model_serving")'
```

**Test Scenarios:**
1. **Latency SLO:** Inject artificial delay > 150ms
2. **Drift SLO:** Set drift_score > 0.05
3. **Accuracy SLO:** Set accuracy_delta < -0.02

- [ ] Alerts fire when thresholds exceeded
- [ ] Alert annotations include all required fields
- [ ] Runbook URLs accessible
- [ ] Dashboard URLs correct

### 5. SLO Compliance Check

```bash
# Query current SLO status (Docker-first)
docker-compose exec api bash -c "
  psql \$DATABASE_DIRECT_URL <<EOF
    -- Check p95 latency
    SELECT 
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY inference_latency_ms) as p95_latency_ms
    FROM model_predictions_live
    WHERE predicted_at > NOW() - INTERVAL '1 hour'
      AND deployment_environment = 'prod';

    -- Check drift score
    SELECT 
      MAX(drift_score) as max_drift_score,
      AVG(drift_score) as avg_drift_score
    FROM model_predictions_live
    WHERE predicted_at > NOW() - INTERVAL '1 hour'
      AND deployment_environment = 'prod';

    -- Check accuracy delta
    SELECT 
      model_id,
      accuracy_delta
    FROM model_performance_history
    WHERE period_type = 'hourly'
      AND period_start > NOW() - INTERVAL '24 hours'
      AND deployment_environment = 'prod'
    ORDER BY period_start DESC
    LIMIT 10;
EOF
"
```

**SLO Targets:**
- [ ] p95 latency < 150ms
- [ ] Drift score < 0.05
- [ ] Accuracy ≥ baseline - 2%

---

## Rollback Plan

### If Deployment Fails

#### 1. Rollback Database Migration

```bash
# Drop new tables (Docker-first)
docker-compose exec api bash -c "
  psql \$DATABASE_DIRECT_URL <<EOF
    DROP TABLE IF EXISTS model_predictions_live CASCADE;
    DROP TABLE IF EXISTS model_performance_history CASCADE;
    DROP FUNCTION IF EXISTS check_model_slo_compliance CASCADE;
    SELECT pg_notify('pgrst', 'reload schema');
EOF
"
```

#### 2. Remove Metrics Server

```bash
# Revert code changes
git checkout HEAD -- apps/api/src/monitoring/ModelServingMetrics.ts

# Restart API (Docker-first)
docker-compose restart api
```

#### 3. Remove Dashboard

```bash
# Delete dashboard via Grafana API
curl -X DELETE http://localhost:3000/api/dashboards/uid/model-serving \
  -H "Authorization: Bearer ${GRAFANA_API_KEY}"
```

#### 4. Remove Alert Rules

```bash
# Remove alert rules file
rm /path/to/prometheus/rules/prometheus-rules-model-serving.yaml

# Reload Prometheus
curl -X POST http://localhost:9090/-/reload
```

---

## Success Criteria

### Deployment Success

- [x] All pre-deployment checks passed
- [x] Migration applied successfully
- [x] PostgREST schema reloaded
- [x] Metrics server running
- [x] Dashboard imported
- [x] Alert rules loaded
- [x] All post-deployment validations passed

### SLO Compliance

- [ ] p95 latency < 150ms (baseline established)
- [ ] Drift score < 0.05 (monitoring active)
- [ ] Accuracy ≥ baseline - 2% (baseline established)

### Operational Readiness

- [ ] Alerts tested and firing correctly
- [ ] Dashboard accessible to team
- [ ] Runbooks documented
- [ ] On-call team notified
- [ ] Monitoring integrated with PagerDuty/Slack

---

## Sign-Off

**Deployment Completed:** [ ] Yes [ ] No  
**SLO Monitoring Active:** [ ] Yes [ ] No  
**Rollback Plan Tested:** [ ] Yes [ ] No  

**Deployed By:** ___________________________  
**Date:** ___________________________  
**Time:** ___________________________  

**Verified By:** ___________________________  
**Date:** ___________________________  

---

**END OF CHECKLIST**

