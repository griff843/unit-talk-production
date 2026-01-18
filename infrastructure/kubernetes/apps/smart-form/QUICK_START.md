# Smart Form Production Deployment - Quick Start Guide
**Date:** 2025-10-25

## 🚀 Quick Deployment (5 Minutes)

### Prerequisites
- Kubernetes cluster access
- `kubectl` configured
- Argo CD and Argo Rollouts installed
- Secrets prepared (see `secrets.yaml`)

### Step 1: Apply Secrets (1 min)
```bash
# Update secrets with actual values
vim infrastructure/kubernetes/apps/smart-form/secrets.yaml

# Apply secrets
kubectl apply -f infrastructure/kubernetes/apps/smart-form/secrets.yaml

# Verify
kubectl get secret -n unit-talk smart-form-secrets
```

### Step 2: Deploy Infrastructure (2 min)
```bash
# Deploy cache warmers
kubectl apply -f infrastructure/kubernetes/apps/smart-form/cache-warmers.yaml

# Deploy synthetic monitor
kubectl apply -f infrastructure/kubernetes/apps/smart-form/synthetic-monitor.yaml

# Verify CronJobs
kubectl get cronjobs -n unit-talk
```

### Step 3: Deploy Smart Form (2 min)
```bash
# Deploy Argo Rollout
kubectl apply -f infrastructure/kubernetes/apps/smart-form/rollout.yaml

# Watch rollout progress
kubectl argo rollouts get rollout smart-form -n unit-talk --watch
```

## 📊 Monitoring Commands

### Check Rollout Status
```bash
# Current status
kubectl argo rollouts status smart-form -n unit-talk

# Detailed view
kubectl argo rollouts get rollout smart-form -n unit-talk

# Analysis results
kubectl get analysisrun -n unit-talk -l rollout=smart-form
```

### Check Metrics
```bash
# Players search p95 latency
kubectl exec -n unit-talk prometheus-0 -- promtool query instant \
  'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="smart-form",route="/api/players"}[5m])) by (le)) * 1000'

# Games resolve p95 latency
kubectl exec -n unit-talk prometheus-0 -- promtool query instant \
  'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="smart-form",route="/api/games"}[5m])) by (le)) * 1000'

# Error rate
kubectl exec -n unit-talk prometheus-0 -- promtool query instant \
  '(sum(rate(http_requests_total{job="smart-form",status=~"5.."}[5m])) / sum(rate(http_requests_total{job="smart-form"}[5m]))) * 100'
```

### Check Logs
```bash
# Smart Form logs
kubectl logs -n unit-talk deployment/smart-form --tail=100 -f

# Cache warmer logs
kubectl logs -n unit-talk job/warm-players-manual -f

# Synthetic monitor logs
kubectl logs -n unit-talk job/synthetic-manual -f
```

## 🔄 Canary Control

### Promote Canary
```bash
# Promote to next step
kubectl argo rollouts promote smart-form -n unit-talk
```

### Abort Rollout
```bash
# Abort and rollback
kubectl argo rollouts abort smart-form -n unit-talk
```

### Manual Rollback
```bash
# Rollback to previous version
kubectl argo rollouts undo smart-form -n unit-talk
```

## 🧪 Testing

### Run Canary Dry Run
```bash
export TEST_CAPPER_ID="550e8400-e29b-41d4-a716-446655440000"
export TEST_DISCORD_THREAD="1234567890123456789"
export SMART_FORM_URL="https://smart-form.unit-talk.com"
export CANARY_WEIGHT="5"

node infrastructure/monitoring/scripts/canary-dry-run.js
```

### Run Synthetic Monitor
```bash
# Manual run
kubectl create job -n unit-talk synthetic-manual --from=cronjob/smart-form-synthetic-monitor

# Check results
kubectl logs -n unit-talk job/synthetic-manual -f
```

### Test Rate Limiting
```bash
# Test read endpoint (should get 429 after 300 requests)
for i in {1..350}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    https://smart-form.unit-talk.com/api/players?q=test
done
```

## 🚨 Troubleshooting

### Rollout Stuck
```bash
# Check analysis
kubectl get analysisrun -n unit-talk -l rollout=smart-form

# Check pod status
kubectl get pods -n unit-talk -l app=smart-form

# Check events
kubectl get events -n unit-talk --sort-by='.lastTimestamp'
```

### Secrets Missing
```bash
# Check init container logs
kubectl logs -n unit-talk deployment/smart-form -c validate-secrets

# Verify secrets exist
kubectl get secret -n unit-talk smart-form-secrets -o yaml
```

### Cache Not Working
```bash
# Check Redis connectivity
kubectl exec -n unit-talk deployment/smart-form -- redis-cli -h unit-talk-redis ping

# Check cache warmer logs
kubectl logs -n unit-talk cronjob/warm-players-today

# Trigger manual warming
kubectl create job -n unit-talk warm-manual --from=cronjob/warm-players-today
```

## 📈 Success Validation

After deployment, verify:

1. **Rollout Complete:**
   ```bash
   kubectl argo rollouts status smart-form -n unit-talk
   # Expected: "Healthy. Rollout completed successfully"
   ```

2. **All Pods Healthy:**
   ```bash
   kubectl get pods -n unit-talk -l app=smart-form
   # Expected: All pods Running and Ready
   ```

3. **Metrics Within SLO:**
   - API p95 < 120ms ✅
   - Database p95 < 50ms ✅
   - Error rate < 0.5% ✅
   - Cache hit rate > 80% ✅

4. **No Errors in Logs:**
   ```bash
   kubectl logs -n unit-talk deployment/smart-form --tail=100 | grep ERROR
   # Expected: No critical errors
   ```

## 📞 Support

- **Runbook:** `infrastructure/kubernetes/apps/smart-form/DEPLOYMENT_RUNBOOK.md`
- **Summary:** `infrastructure/kubernetes/apps/smart-form/PRODUCTION_OPS_SUMMARY.md`
- **Critical Alerts:** `#ops-critical` Discord
- **Warnings:** `#ops-warnings` Discord
- **Updates:** `#release` Discord

---

**For detailed instructions, see:** `DEPLOYMENT_RUNBOOK.md`

