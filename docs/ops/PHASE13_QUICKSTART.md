# Phase 13 Quick Start Guide

**Date:** 2025-01-25  
**Estimated Time:** 2-4 hours

## Overview

This quick start guide walks you through executing Phase 13 performance and reliability hardening tests in the correct order.

## Prerequisites

- [ ] Kubernetes cluster access (DOKS)
- [ ] kubectl configured
- [ ] k6 installed
- [ ] API access credentials
- [ ] Grafana dashboard access
- [ ] Slack webhook configured (optional)
- [ ] Team notified of testing

## Step 1: Environment Setup (15 minutes)

### 1.1 Install Tools

```bash
# Install k6 (macOS)
brew install k6

# Install k6 (Linux)
wget https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz
tar -xzf k6-v0.47.0-linux-amd64.tar.gz
sudo mv k6 /usr/local/bin/

# Verify installation
k6 version
kubectl version
```

### 1.2 Configure Environment

```bash
# Set environment variables
export NAMESPACE="unit-talk"
export DEPLOYMENT="unit-talk-api"
export REDIS_DEPLOYMENT="redis"
export BASE_URL="https://api.unit-talk.com"
export API_KEY="your-api-key-here"
export HEALTH_CHECK_URL="https://api.unit-talk.com/health"
export SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Verify cluster access
kubectl get pods -n unit-talk
kubectl get hpa -n unit-talk
```

### 1.3 Create Output Directories

```bash
mkdir -p out/ops/perf
mkdir -p out/ops/chaos
```

## Step 2: Deploy Infrastructure (30 minutes)

### 2.1 Apply HPA Configurations

```bash
# Review HPA changes
cat infrastructure/kubernetes/hpa-configs.yaml

# Apply HPA configurations
kubectl apply -f infrastructure/kubernetes/hpa-configs.yaml

# Verify HPA
kubectl get hpa -n unit-talk
kubectl describe hpa unit-talk-api-hpa -n unit-talk
```

### 2.2 Apply Connection Pool Limits

```bash
# Review connection pool settings
cat infrastructure/kubernetes/connection-pool-limits.yaml

# Apply connection pool configurations
kubectl apply -f infrastructure/kubernetes/connection-pool-limits.yaml

# Verify ConfigMaps
kubectl get configmap -n unit-talk | grep -E "(redis|postgres)-connection-pool"
```

### 2.3 Deploy Alertmanager Configuration

```bash
# Review Alertmanager config
cat infrastructure/monitoring/alertmanager-config.yaml

# Apply Alertmanager configuration
kubectl apply -f infrastructure/monitoring/alertmanager-config.yaml

# Verify Alertmanager
kubectl get pods -n monitoring | grep alertmanager
kubectl logs -n monitoring -l app=alertmanager --tail=50
```

### 2.4 Verify Prometheus Rules

```bash
# Check Prometheus rules
kubectl get configmap -n monitoring prometheus-slo-rules

# Verify rules loaded
kubectl exec -n monitoring prometheus-0 -- promtool check rules /etc/prometheus/rules/*.yaml
```

## Step 3: Baseline Metrics (15 minutes)

### 3.1 Open Monitoring Dashboards

```bash
# Port-forward Grafana
kubectl port-forward -n monitoring svc/grafana 3000:3000 &

# Port-forward Prometheus
kubectl port-forward -n monitoring svc/prometheus 9090:9090 &

# Port-forward Alertmanager
kubectl port-forward -n monitoring svc/alertmanager 9093:9093 &
```

Open in browser:
- Grafana: http://localhost:3000
- Prometheus: http://localhost:9090
- Alertmanager: http://localhost:9093

### 3.2 Record Baseline Metrics

```bash
# Current pod count
kubectl get pods -n unit-talk -l app=unit-talk-api

# Current HPA status
kubectl get hpa -n unit-talk

# Current resource usage
kubectl top pods -n unit-talk

# Current API latency (Prometheus query)
# histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="unit-talk-api"}[5m])) by (le)) * 1000
```

## Step 4: Load Testing (1-2 hours)

### 4.1 Run Ramp Test (13 minutes)

```bash
# Start monitoring in separate terminal
watch kubectl get hpa -n unit-talk

# Run ramp test
k6 run --scenario ramp_test scripts/perf/k6-load-tests.js

# Review results
open out/ops/perf/k6-report-*.html
```

**Expected Results:**
- p95 latency < 150ms
- Error rate < 0.5%
- HPA scales up to handle load

### 4.2 Run Soak Test (60 minutes) - Optional

```bash
# Run soak test (1 hour)
k6 run --scenario soak_test scripts/perf/k6-load-tests.js

# Monitor for memory leaks
watch kubectl top pods -n unit-talk
```

**Expected Results:**
- Stable memory usage
- No memory leaks
- Consistent performance

### 4.3 Run Spike Test (2 minutes)

```bash
# Run spike test
k6 run --scenario spike_test scripts/perf/k6-load-tests.js

# Watch HPA response
kubectl get hpa -n unit-talk --watch
```

**Expected Results:**
- HPA scales up quickly
- API remains responsive
- Recovery after spike

## Step 5: Chaos Engineering (30 minutes)

### 5.1 Run Pod Failure Tests

```bash
# Make scripts executable
chmod +x scripts/chaos/pod-failure.sh

# Run pod failure tests
./scripts/chaos/pod-failure.sh

# Review logs
cat out/ops/chaos/pod-failure-*.log
```

**Expected Results:**
- Recovery time < 60 seconds
- API remains healthy
- All tests pass

### 5.2 Run Redis Outage Tests

```bash
# Make script executable
chmod +x scripts/chaos/redis-outage.sh

# Run Redis outage tests
./scripts/chaos/redis-outage.sh

# Review logs
cat out/ops/chaos/redis-outage-*.log
```

**Expected Results:**
- Circuit breaker activates
- Graceful degradation
- Recovery time < 60 seconds

## Step 6: Validate SLO Compliance (15 minutes)

### 6.1 Check Prometheus Alerts

```bash
# Open Prometheus alerts
open http://localhost:9090/alerts

# Check for any firing alerts
curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | select(.state=="firing")'
```

### 6.2 Check Alertmanager

```bash
# Open Alertmanager
open http://localhost:9093

# Check for active alerts
curl -s http://localhost:9093/api/v2/alerts | jq '.'
```

### 6.3 Verify SLO Metrics

```bash
# API p95 latency
curl -s 'http://localhost:9090/api/v1/query?query=histogram_quantile(0.95,sum(rate(http_request_duration_seconds_bucket{job="unit-talk-api"}[5m]))by(le))*1000' | jq '.data.result[0].value[1]'

# Error rate
curl -s 'http://localhost:9090/api/v1/query?query=(sum(rate(http_requests_total{job="unit-talk-api",status=~"5.."}[5m]))/sum(rate(http_requests_total{job="unit-talk-api"}[5m])))*100' | jq '.data.result[0].value[1]'

# Database p95 latency
curl -s 'http://localhost:9090/api/v1/query?query=histogram_quantile(0.95,sum(rate(database_query_duration_seconds_bucket{job="unit-talk-api"}[5m]))by(le))*1000' | jq '.data.result[0].value[1]'
```

## Step 7: Generate Reports (15 minutes)

### 7.1 Collect Test Results

```bash
# Copy k6 reports
ls -lh out/ops/perf/

# Copy chaos logs
ls -lh out/ops/chaos/

# Export Grafana snapshots
# (Manual: Use Grafana UI to create snapshots)
```

### 7.2 Update Results Document

```bash
# Edit results document
vim out/ops/perf/PHASE13_RESULTS.md

# Fill in actual metrics from tests
# - Load test results
# - Chaos test results
# - SLO compliance data
# - Recommendations
```

### 7.3 Create Summary Report

```bash
# Generate summary
cat > out/ops/perf/PHASE13_SUMMARY.txt <<EOF
Phase 13 Performance and Reliability Hardening - Summary
Date: $(date)

Load Testing:
- Ramp Test: [PASS/FAIL]
- Soak Test: [PASS/FAIL]
- Spike Test: [PASS/FAIL]

Chaos Engineering:
- Pod Failure: [PASS/FAIL]
- Redis Outage: [PASS/FAIL]

SLO Compliance:
- API p95 Latency: [VALUE]ms (Target: <150ms)
- Error Rate: [VALUE]% (Target: <0.5%)
- DB p95 Latency: [VALUE]ms (Target: <50ms)

Recommendations:
- [Add recommendations based on results]
EOF

cat out/ops/perf/PHASE13_SUMMARY.txt
```

## Step 8: Cleanup (10 minutes)

### 8.1 Stop Port Forwards

```bash
# Kill port-forward processes
pkill -f "port-forward"
```

### 8.2 Archive Results

```bash
# Create archive
tar -czf phase13-results-$(date +%Y%m%d).tar.gz out/ops/

# Move to archive location
mv phase13-results-*.tar.gz ~/archives/
```

### 8.3 Notify Team

```bash
# Post results to Slack (if webhook configured)
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Phase 13 testing completed! Results available in out/ops/perf/PHASE13_RESULTS.md",
    "attachments": [{
      "color": "good",
      "text": "All tests passed ✅"
    }]
  }'
```

## Troubleshooting

### Issue: k6 test fails immediately

```bash
# Check API health
curl $HEALTH_CHECK_URL

# Verify API key
curl -H "Authorization: Bearer $API_KEY" $BASE_URL/api/picks?limit=1

# Check k6 script syntax
k6 inspect scripts/perf/k6-load-tests.js
```

### Issue: Pods don't scale

```bash
# Check HPA status
kubectl describe hpa unit-talk-api-hpa -n unit-talk

# Check metrics server
kubectl top pods -n unit-talk

# Check resource quotas
kubectl describe resourcequota -n unit-talk
```

### Issue: Chaos tests fail

```bash
# Check pod status
kubectl get pods -n unit-talk

# Check events
kubectl get events -n unit-talk --sort-by='.lastTimestamp'

# Check logs
kubectl logs -n unit-talk -l app=unit-talk-api --tail=100
```

## Success Criteria

✅ **Phase 13 is successful if:**

- [ ] All load tests pass with p95 < 150ms
- [ ] Error rate < 0.5% under all scenarios
- [ ] Chaos tests show recovery < 60s
- [ ] HPA scales appropriately
- [ ] Circuit breakers activate correctly
- [ ] No data loss or corruption
- [ ] SLO alerts configured and working
- [ ] Documentation complete

## Next Steps

After successful completion:

1. **Monitor for 7 days**: Track SLO compliance
2. **Tune thresholds**: Adjust based on real data
3. **Automate tests**: Integrate into CI/CD
4. **Schedule regular chaos**: Weekly/monthly tests
5. **Review and iterate**: Continuous improvement

## Support

- **Documentation**: `docs/ops/PHASE13_PERF_HARDENING.md`
- **Slack**: #platform-sre
- **Email**: sre@unit-talk.com

---

**Estimated Total Time:** 2-4 hours  
**Difficulty:** Intermediate  
**Prerequisites:** Kubernetes, k6, monitoring experience

