# Smart Form Production Deployment Runbook
**Date:** 2025-10-25  
**Version:** 1.0.0  
**Status:** Production Ready

## 🎯 Overview

This runbook provides step-by-step instructions for deploying Smart Form to production with zero downtime using Argo Rollouts canary deployment strategy.

## 📋 Pre-Deployment Checklist

### Environment Validation
- [ ] All secrets configured in `secrets.yaml`
- [ ] Database migrations applied
- [ ] Redis cluster healthy and accessible
- [ ] Discord bot token validated
- [ ] CDN endpoints configured
- [ ] Prometheus/Grafana monitoring active

### Code Validation
- [ ] All TypeScript compilation errors resolved
- [ ] Unit tests passing (>80% coverage)
- [ ] E2E tests passing
- [ ] Security scan completed
- [ ] Performance benchmarks met

### Infrastructure Validation
- [ ] Kubernetes cluster healthy
- [ ] Argo CD operational
- [ ] Argo Rollouts controller running
- [ ] Prometheus metrics collection active
- [ ] Alert manager configured

## 🚀 Deployment Steps

### Step 0: Environment Flags Setup

```bash
# Apply secrets and ConfigMaps
kubectl apply -f infrastructure/kubernetes/apps/smart-form/secrets.yaml

# Verify secrets
kubectl get secrets -n unit-talk smart-form-secrets
kubectl get configmap -n unit-talk smart-form-config

# Validate required environment variables
kubectl exec -n unit-talk deployment/smart-form -- env | grep -E "DISCORD_BOT_TOKEN|DATABASE_URL|REDIS_URL|CDN_BASE"
```

**Expected Environment Variables:**
- `PICK_DRIVER=unified` (stays until canonical ready)
- `PUBLISH_MODE=outbox` (prefer outbox over direct)
- `TENANT_ID=<UUID>`
- `CDN_BASE=https://cdn.unit-talk.app`
- `RATE_LIMIT_REDIS_PREFIX=smartform`
- `SMARTFORM_FEATURES=capperSelect,playerSearch,gameResolve,discordPreview,scoringSlider`

### Step 1: Redis + API Cache Setup

```bash
# Verify Redis connectivity
kubectl exec -n unit-talk deployment/smart-form -- redis-cli -h unit-talk-redis ping

# Deploy cache warmers
kubectl apply -f infrastructure/kubernetes/apps/smart-form/cache-warmers.yaml

# Verify CronJobs created
kubectl get cronjobs -n unit-talk | grep warm

# Trigger initial cache warming
kubectl create job -n unit-talk warm-players-manual --from=cronjob/warm-players-today
kubectl create job -n unit-talk warm-games-manual --from=cronjob/warm-games-today

# Monitor cache warming
kubectl logs -n unit-talk job/warm-players-manual -f
kubectl logs -n unit-talk job/warm-games-manual -f
```

**Expected Cache Headers:**
- `/players/search`: `Cache-Control: public, max-age=60, s-maxage=600, stale-while-revalidate=120`
- `/games/resolve`: `Cache-Control: public, max-age=60, s-maxage=600, stale-while-revalidate=120`
- `Surrogate-Control: 600` for CDN

**Performance Targets:**
- First-hit p95: <200ms (before warming)
- Warmed-hit p95: <50ms (after 1 hour)

### Step 2: Argo Rollout Deployment

```bash
# Apply Argo Rollout configuration
kubectl apply -f infrastructure/kubernetes/apps/smart-form/rollout.yaml

# Verify Rollout created
kubectl get rollout -n unit-talk smart-form

# Watch rollout progress
kubectl argo rollouts get rollout smart-form -n unit-talk --watch

# View rollout status
kubectl argo rollouts status smart-form -n unit-talk
```

**Canary Steps:**
1. **5% traffic** → Pause 10m → Analysis
2. **25% traffic** → Pause 20m → Analysis
3. **100% traffic** → Complete

**AnalysisTemplate Conditions (5-min windows):**
- `/players/search` p95 < 120ms
- `/games/resolve` p95 < 120ms
- `POST /api/picks` error rate < 0.5%
- `POST /api/picks` 5xx count == 0
- Database p95 < 50ms

**Auto-Rollback Triggers:**
- Any metric fails for 2 consecutive checks
- 5xx errors detected
- Database latency exceeds 50ms

### Step 3: Rate Limiting + WAF

```bash
# Verify rate limiting configuration
kubectl exec -n unit-talk deployment/smart-form -- env | grep RATE_LIMIT

# Test rate limiting
for i in {1..350}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    https://smart-form.unit-talk.com/api/players?q=test
done
# Expected: First 300 return 200, remaining return 429

# Verify 429 response format
curl -v https://smart-form.unit-talk.com/api/players?q=test
# Expected headers:
# X-RateLimit-Limit: 300
# X-RateLimit-Remaining: <count>
# Retry-After: <seconds>
```

**Rate Limits:**
- **Read endpoints** (GET `/players/search`, `/games/resolve`): 300 req/min per IP
- **Write endpoints** (POST `/api/picks`): 60 req/min per user
- **429 Response Format:**
  ```json
  {
    "code": "RATE_LIMITED",
    "error": "Too many requests",
    "message": "Rate limit exceeded. Try again in X seconds.",
    "retryAfter": <seconds>
  }
  ```

### Step 4: Logging/Tracing Setup

```bash
# Verify OpenTelemetry configuration
kubectl exec -n unit-talk deployment/smart-form -- env | grep OTEL

# Check trace sampling
kubectl logs -n unit-talk deployment/smart-form | grep "trace_id"

# Verify logs-based metric for Discord publish lag
kubectl exec -n unit-talk prometheus-0 -- promtool query instant \
  'smartform_discord_publish_lag_ms{quantile="0.95"}'
```

**OpenTelemetry Configuration:**
- Headers preserved end-to-end
- Sample rate: 10% for reads, 100% for POST `/api/picks`
- Logs-based metric: `smartform.discord.publish.lag` (ms)
- SLO: p95 < 60s

### Step 5: Secrets Validation

```bash
# Check init container logs
kubectl logs -n unit-talk deployment/smart-form -c validate-secrets

# Expected output:
# 🔍 Validating required secrets...
# ✅ DISCORD_BOT_TOKEN is set
# ✅ DISCORD_APP_ID is set
# ✅ DATABASE_URL is set
# ✅ REDIS_URL is set
# ✅ CDN_BASE is set
# ✅ All required secrets validated successfully
```

**Fail-Fast Behavior:**
- Pod exits non-zero if any secret missing
- Readiness gate prevents traffic until healthy
- Clear error logs for debugging

### Step 6: E2E Synthetic Monitoring

```bash
# Deploy synthetic monitor
kubectl apply -f infrastructure/kubernetes/apps/smart-form/synthetic-monitor.yaml

# Verify CronJob created
kubectl get cronjob -n unit-talk smart-form-synthetic-monitor

# Trigger manual run
kubectl create job -n unit-talk synthetic-manual --from=cronjob/smart-form-synthetic-monitor

# Monitor execution
kubectl logs -n unit-talk job/synthetic-manual -f

# Check Prometheus metrics
kubectl exec -n unit-talk prometheus-0 -- promtool query instant \
  'smart_form_synthetic_latency_p95_ms'
```

**Synthetic Tests (every 10 min):**
1. `GET /api/players?q=le&league=NBA`
2. `GET /api/games?sport=NBA&date=today`
3. `POST /api/submit-ticket` (dry-run with Idempotency-Key)

**Alert Conditions:**
- Any 5xx error for 2 consecutive periods
- p95 > 120ms for 2 consecutive periods

### Step 7: Canary Dry Run

```bash
# Set test environment variables
export TEST_CAPPER_ID="550e8400-e29b-41d4-a716-446655440000"
export TEST_DISCORD_THREAD="1234567890123456789"
export SMART_FORM_URL="https://smart-form.unit-talk.com"
export CANARY_WEIGHT="5"

# Run canary dry run
node infrastructure/monitoring/scripts/canary-dry-run.js

# Expected output:
# 🚀 Starting Smart Form Canary Dry Run
# 📍 Step 1: Search for player...
# ✅ player_search: 45ms
# 📍 Step 2: Resolve game for player...
# ✅ game_resolve: 67ms
# 📍 Step 3: Submit pick...
# ✅ pick_submit: 123ms
# 📍 Step 4: Verify Discord publish...
# ✅ discord_publish: 50ms
# 📍 Step 5: Capture Discord screenshot...
# ✅ screenshot_capture: 100ms
# ✅ Canary dry run complete!

# Check output files
ls -la out/ops/cutover/discord/
ls -la out/ops/cutover/metrics/5/

# Review metrics report
cat out/ops/cutover/metrics/5/canary-report-*.json
```

**Deliverables:**
- Screenshots in `out/ops/cutover/discord/`
- Timings in `out/ops/cutover/metrics/5/`
- End-to-end pick submission validated
- Discord thread posting confirmed

## 📊 Post-Deployment Validation

### Metrics Collection (After 60 Minutes)

```bash
# Query warmed endpoint p95 latency
kubectl exec -n unit-talk prometheus-0 -- promtool query instant \
  'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="smart-form",route="/api/players"}[5m])) by (le)) * 1000'

# Expected: <50ms for warmed endpoints

# Query cache hit rate
kubectl exec -n unit-talk prometheus-0 -- promtool query instant \
  'sum(rate(redis_cache_hits_total{job="smart-form"}[5m])) / sum(rate(redis_cache_requests_total{job="smart-form"}[5m]))'

# Expected: >80% cache hit rate after 1 hour
```

### Health Checks

```bash
# Check all pods healthy
kubectl get pods -n unit-talk -l app=smart-form

# Check rollout status
kubectl argo rollouts status smart-form -n unit-talk

# Check analysis results
kubectl get analysisrun -n unit-talk -l rollout=smart-form

# Verify no errors in logs
kubectl logs -n unit-talk deployment/smart-form --tail=100 | grep ERROR
```

## 🚨 Rollback Procedure

### Automatic Rollback
Argo Rollouts will automatically rollback if any AnalysisTemplate metric fails.

### Manual Rollback

```bash
# Abort current rollout
kubectl argo rollouts abort smart-form -n unit-talk

# Rollback to previous version
kubectl argo rollouts undo smart-form -n unit-talk

# Verify rollback
kubectl argo rollouts status smart-form -n unit-talk
```

## 📈 Monitoring Dashboard

Access Grafana dashboard:
```
https://grafana.unit-talk.com/d/smart-form-production
```

**Key Metrics:**
- API p95 latency (target: <120ms)
- Database p95 latency (target: <50ms)
- Error rate (target: <0.5%)
- Cache hit rate (target: >80%)
- Discord publish lag p95 (target: <60s)

## 🔔 Alert Channels

- **Critical Alerts:** `#ops-critical` Discord channel
- **Warning Alerts:** `#ops-warnings` Discord channel
- **Deployment Updates:** `#release` Discord channel

## 📝 Deployment Report Template

After each canary step, post to `#release`:

```
🚀 Smart Form Canary Deployment - [WEIGHT]% Traffic

✅ Metrics (5-min window):
- /players/search p95: [X]ms (target: <120ms)
- /games/resolve p95: [X]ms (target: <120ms)
- POST /api/picks error rate: [X]% (target: <0.5%)
- Database p95: [X]ms (target: <50ms)

📊 Analysis: [PASS/FAIL]
⏭️  Next step: [DESCRIPTION]
```

## ✅ Success Criteria

- [ ] All secrets applied and validated
- [ ] Redis warmers running and cache hit rate >80%
- [ ] Argo Rollout deployed successfully
- [ ] All AnalysisTemplate metrics passing
- [ ] Rate limiting functional with proper 429 responses
- [ ] OpenTelemetry tracing active
- [ ] Synthetic monitors passing
- [ ] Canary dry run successful with screenshots
- [ ] p95 latency <50ms for warmed endpoints after 60 minutes
- [ ] Zero 5xx errors in production traffic

---

**Deployment Owner:** Engineering Team  
**Last Updated:** 2025-10-25  
**Next Review:** After first production deployment

