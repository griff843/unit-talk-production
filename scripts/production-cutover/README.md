# Production Cutover Orchestration
**Date:** 2025-10-25  
**Phase:** Smart Form + API Rollout  
**Strategy:** Canary 5% → 25% → 100% with Automated SLO Validation

## 🎯 Overview

This directory contains the complete production cutover orchestration for Unit Talk's Smart Form and API services. The rollout uses Argo Rollouts with automated SLO validation to ensure zero-downtime deployment.

## 📋 Prerequisites

### Required Tools
- `kubectl` (Kubernetes CLI)
- `kubectl argo rollouts` plugin
- `jq` (JSON processor)
- `curl`

### Required Access
- Kubernetes cluster access (unit-talk namespace)
- Prometheus access (monitoring namespace)
- Supabase credentials (for validation)

### Environment Variables
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export SMART_FORM_URL="http://smart-form.unit-talk.svc.cluster.local:3021"
export COMMAND_CENTER_URL="http://command-center.unit-talk.svc.cluster.local:3000"
```

## 🚀 Quick Start

### Option 1: Full Automated Rollout
```bash
# Execute complete rollout orchestration
bash scripts/production-cutover/rollout-orchestrator.sh
```

This will:
1. Deploy AnalysisTemplates for SLO validation
2. Deploy Argo Rollouts for Smart Form and API
3. Monitor rollout progress (5% → 25% → 100%)
4. Deploy Redis cache warmers
5. Execute end-to-end validation
6. Collect SLO metrics
7. Generate rollout report

**Duration:** ~30-40 minutes

### Option 2: Manual Step-by-Step

#### Step 1: Update Environment Variables
```bash
# Already configured in .env:
# PICK_DRIVER=canonical
# PUBLISH_MODE=outbox
# DEFAULT_TENANT_ID=12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a
# SMARTFORM_FEATURES=capperSelect,playerSearch,gameResolve,discordPreview,scoringSlider,aiAssist
```

#### Step 2: Deploy AnalysisTemplates
```bash
kubectl apply -f infrastructure/kubernetes/apps/smart-form/analysis-template.yaml
```

#### Step 3: Deploy Rollouts
```bash
# Smart Form
kubectl apply -f infrastructure/kubernetes/apps/smart-form/rollout.yaml

# API
kubectl apply -f infrastructure/kubernetes/apps/api/rollout.yaml
```

#### Step 4: Monitor Rollout
```bash
# Watch Smart Form rollout
kubectl argo rollouts get rollout smart-form -n unit-talk --watch

# Watch API rollout
kubectl argo rollouts get rollout unit-talk-api -n unit-talk --watch
```

#### Step 5: Deploy Cache Warmers
```bash
bash infrastructure/kubernetes/apps/smart-form/deploy-cache-warmers.sh
```

#### Step 6: Execute Validation
```bash
bash scripts/production-cutover/end-to-end-validation.sh
```

## 📊 SLO Targets

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| API Latency (p95) | <150ms | >150ms for 5min |
| Database Latency (p95) | <50ms | >50ms for 5min |
| Error Rate | <0.5% | >0.5% for 2min |
| Outbox Lag | <60s | >60s for 3min |
| Pick Insert Success | >99.5% | <99.5% for 2min |
| Discord Publish Success | >99% | <99% for 2min |

## 🔄 Rollout Strategy

### Canary Progression

**Phase 1: 5% Traffic (10 minutes)**
- Initial canary deployment
- 5% of traffic routed to new version
- Automated SLO validation every 1 minute
- Automatic rollback if 2+ failures

**Phase 2: 25% Traffic (20 minutes)**
- Extended validation phase
- 25% of traffic routed to new version
- Continued SLO monitoring
- Automatic rollback if 2+ failures

**Phase 3: 100% Traffic**
- Full rollout
- All traffic routed to new version
- Continued monitoring

### Automatic Rollback Triggers
- API latency p95 > 150ms (2 consecutive failures)
- Database latency p95 > 50ms (2 consecutive failures)
- Error rate > 0.5% (2 consecutive failures)
- Outbox lag > 60s (2 consecutive failures)
- Any 5xx errors on pick insert endpoint

## 📁 Output Files

All validation and metrics are saved to `out/ops/cutover/metrics/100/`:

```
out/ops/cutover/metrics/100/
├── rollout_report_YYYYMMDD_HHMMSS.json
├── timings_YYYYMMDD_HHMMSS.json
├── pick_insert_response_YYYYMMDD_HHMMSS.json
├── picks_row_YYYYMMDD_HHMMSS.json
├── pick_publish_row_YYYYMMDD_HHMMSS.json
├── audit_log_rows_YYYYMMDD_HHMMSS.json
├── bridge_outbox_row_YYYYMMDD_HHMMSS.json
└── command_center_pick_YYYYMMDD_HHMMSS.json
```

## 🎛️ Monitoring

### Grafana Dashboards
```bash
# Import Smart Form dashboard
kubectl apply -f infrastructure/dashboards/smart-form-dashboard.json
```

Access: https://grafana.unit-talk.com/d/smart-form-dashboard

**Panels:**
- Smart Form API Latency (p95 < 150ms SLO)
- Smart Form Discord Lag (< 60s SLO)
- Smart Form Submit Rate (picks/min)
- Audit Events Count (events/min)
- Error Rate (< 0.5% SLO)
- Database Query Latency (p95 < 50ms SLO)

### Prometheus Alerts
```bash
# Deploy alert rules
kubectl apply -f infrastructure/monitoring/smart-form-alerts.yaml
```

**Critical Alerts:**
- SmartFormAPILatencySLOViolation
- SmartFormErrorRateSLOViolation
- SmartFormPickInsertFailures
- SmartFormPodRestartLoop

**Warning Alerts:**
- SmartFormDiscordLagSLOViolation
- SmartFormDatabaseLatencySLOViolation
- SmartFormHighMemoryUsage
- SmartFormHighCacheMissRate

## 🔧 Troubleshooting

### Rollout Stuck at 5%
```bash
# Check analysis status
kubectl get analysisrun -n unit-talk

# View analysis logs
kubectl describe analysisrun <name> -n unit-talk

# Check Prometheus metrics
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Visit http://localhost:9090
```

### Automatic Rollback Occurred
```bash
# Check rollout status
kubectl argo rollouts status smart-form -n unit-talk

# View rollout events
kubectl describe rollout smart-form -n unit-talk

# Check pod logs
kubectl logs -n unit-talk -l app=smart-form --tail=100

# Review analysis failure
kubectl get analysisrun -n unit-talk -o yaml
```

### Manual Rollback
```bash
# Abort current rollout
kubectl argo rollouts abort smart-form -n unit-talk

# Rollback to previous version
kubectl argo rollouts undo smart-form -n unit-talk
```

### Validation Failures
```bash
# Re-run end-to-end validation
bash scripts/production-cutover/end-to-end-validation.sh

# Check database connectivity
kubectl run -n unit-talk psql-test --rm -i --restart=Never --image=postgres:15 -- \
  psql "$SUPABASE_URL" -c "SELECT COUNT(*) FROM picks;"

# Check Discord webhook
curl -X POST "$DISCORD_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message from cutover validation"}'
```

## 📸 Documentation Requirements

After successful rollout, capture:

1. **Grafana Dashboard Screenshots**
   - Smart Form dashboard showing all green SLOs
   - API latency panel
   - Error rate panel
   - Discord lag panel

2. **Rollout Status**
   ```bash
   kubectl argo rollouts get rollout smart-form -n unit-talk > rollout-status.txt
   ```

3. **SLO Compliance Report**
   ```bash
   cat out/ops/cutover/metrics/100/rollout_report_*.json | jq '.slo_compliance'
   ```

4. **Discord Post Screenshot**
   - Verify pick appears in correct capper thread
   - Verify formatting and timing

5. **Command Center Screenshot**
   - Verify pick appears in recent picks
   - Verify real-time updates working

## 🎯 Success Criteria

- [ ] All SLOs met during rollout
- [ ] Zero automatic rollbacks
- [ ] End-to-end validation passes
- [ ] Pick insert latency < 150ms
- [ ] Database query latency < 50ms
- [ ] Error rate < 0.5%
- [ ] Discord publish lag < 60s
- [ ] Cache warmers running successfully
- [ ] All monitoring dashboards operational
- [ ] All alerts configured and firing correctly

## 📞 Support

**Rollout Issues:**
- Check `#ops-alerts` Discord channel
- Review Grafana dashboards
- Check Prometheus alerts

**Emergency Rollback:**
```bash
bash scripts/production-cutover/emergency-rollback.sh
```

---

**Last Updated:** 2025-10-25  
**Owner:** Platform Engineering Team  
**Status:** Ready for Production Deployment

