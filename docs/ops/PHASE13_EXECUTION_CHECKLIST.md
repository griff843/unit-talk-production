# Phase 13 Execution Checklist

**Date:** 2025-01-25  
**Phase:** Performance and Reliability Hardening  
**Estimated Time:** 2-4 hours

---

## Pre-Execution Checklist

### Team Coordination

- [ ] **Notify team** in #platform-sre Slack channel
- [ ] **Schedule execution** during low-traffic period
- [ ] **Assign on-call engineer** for duration of tests
- [ ] **Inform stakeholders** of planned testing
- [ ] **Set up war room** (Slack channel or video call)

### Environment Preparation

- [ ] **Verify cluster health**
  ```bash
  kubectl get nodes
  kubectl get pods -n unit-talk
  kubectl top nodes
  ```

- [ ] **Check current metrics**
  - API latency baseline: _____ ms
  - Error rate baseline: _____ %
  - Pod count: _____
  - CPU usage: _____ %
  - Memory usage: _____ %

- [ ] **Backup current configuration**
  ```bash
  kubectl get deployment unit-talk-api -n unit-talk -o yaml > backup/deployment-$(date +%Y%m%d).yaml
  kubectl get hpa -n unit-talk -o yaml > backup/hpa-$(date +%Y%m%d).yaml
  ```

- [ ] **Open monitoring dashboards**
  - [ ] Grafana: https://grafana.unit-talk.com
  - [ ] Prometheus: http://prometheus:9090
  - [ ] Alertmanager: http://alertmanager:9093
  - [ ] Kubernetes Dashboard

### Tool Installation

- [ ] **Install k6**
  ```bash
  k6 version  # Should be v0.47.0+
  ```

- [ ] **Verify kubectl access**
  ```bash
  kubectl auth can-i delete pods -n unit-talk
  kubectl auth can-i create networkpolicies -n unit-talk
  ```

- [ ] **Set environment variables**
  ```bash
  export NAMESPACE="unit-talk"
  export DEPLOYMENT="unit-talk-api"
  export REDIS_DEPLOYMENT="redis"
  export BASE_URL="https://api.unit-talk.com"
  export API_KEY="your-api-key"
  export HEALTH_CHECK_URL="https://api.unit-talk.com/health"
  export SLACK_WEBHOOK="https://hooks.slack.com/..."
  ```

- [ ] **Create output directories**
  ```bash
  mkdir -p out/ops/perf
  mkdir -p out/ops/chaos
  ```

---

## Phase 1: Infrastructure Deployment (30 min)

### 1.1 Deploy HPA Configurations

- [ ] **Review changes**
  ```bash
  git diff infrastructure/kubernetes/hpa-configs.yaml
  ```

- [ ] **Apply HPA**
  ```bash
  kubectl apply -f infrastructure/kubernetes/hpa-configs.yaml
  ```

- [ ] **Verify HPA**
  ```bash
  kubectl get hpa -n unit-talk
  kubectl describe hpa unit-talk-api-hpa -n unit-talk
  ```

- [ ] **Record HPA status**
  - Min replicas: _____
  - Max replicas: _____
  - Current replicas: _____
  - CPU target: _____
  - Latency target: _____

### 1.2 Deploy Connection Pool Limits

- [ ] **Review configuration**
  ```bash
  cat infrastructure/kubernetes/connection-pool-limits.yaml
  ```

- [ ] **Apply configuration**
  ```bash
  kubectl apply -f infrastructure/kubernetes/connection-pool-limits.yaml
  ```

- [ ] **Verify ConfigMaps**
  ```bash
  kubectl get configmap redis-connection-pool-config -n unit-talk
  kubectl get configmap postgres-connection-pool-config -n unit-talk
  ```

- [ ] **Restart affected pods** (if needed)
  ```bash
  kubectl rollout restart deployment/unit-talk-api -n unit-talk
  kubectl rollout status deployment/unit-talk-api -n unit-talk
  ```

### 1.3 Deploy Alertmanager Configuration

- [ ] **Review Alertmanager config**
  ```bash
  cat infrastructure/monitoring/alertmanager-config.yaml
  ```

- [ ] **Apply configuration**
  ```bash
  kubectl apply -f infrastructure/monitoring/alertmanager-config.yaml
  ```

- [ ] **Verify Alertmanager**
  ```bash
  kubectl get pods -n monitoring | grep alertmanager
  kubectl logs -n monitoring -l app=alertmanager --tail=50
  ```

- [ ] **Test Slack webhook**
  ```bash
  curl -X POST $SLACK_WEBHOOK \
    -H 'Content-Type: application/json' \
    -d '{"text":"Phase 13 testing started"}'
  ```

### 1.4 Verify Prometheus Rules

- [ ] **Check rules loaded**
  ```bash
  kubectl exec -n monitoring prometheus-0 -- promtool check rules /etc/prometheus/rules/*.yaml
  ```

- [ ] **Reload Prometheus** (if needed)
  ```bash
  kubectl exec -n monitoring prometheus-0 -- kill -HUP 1
  ```

- [ ] **Verify rules in UI**
  - Open http://localhost:9090/rules
  - Confirm all SLO rules are loaded

---

## Phase 2: Load Testing (1-2 hours)

### 2.1 Ramp Test (13 min)

- [ ] **Start monitoring**
  ```bash
  # Terminal 1: Watch HPA
  watch kubectl get hpa -n unit-talk
  
  # Terminal 2: Watch pods
  watch kubectl get pods -n unit-talk
  
  # Terminal 3: Monitor logs
  kubectl logs -n unit-talk -l app=unit-talk-api -f
  ```

- [ ] **Run ramp test**
  ```bash
  k6 run --scenario ramp_test scripts/perf/k6-load-tests.js
  ```

- [ ] **Record results**
  - p95 latency: _____ ms (Target: <150ms)
  - p99 latency: _____ ms (Target: <500ms)
  - Error rate: _____ % (Target: <0.5%)
  - Peak RPS: _____
  - Max replicas reached: _____
  - Test status: [ ] PASS [ ] FAIL

- [ ] **Review HTML report**
  ```bash
  open out/ops/perf/k6-report-*.html
  ```

- [ ] **Take Grafana snapshot**
  - Dashboard: SLO Dashboard
  - Time range: Last 15 minutes
  - Snapshot URL: _____________________

### 2.2 Spike Test (2 min)

- [ ] **Run spike test**
  ```bash
  k6 run --scenario spike_test scripts/perf/k6-load-tests.js
  ```

- [ ] **Record results**
  - Peak RPS: _____ (Target: 10k)
  - p95 latency during spike: _____ ms
  - Error rate during spike: _____ %
  - HPA scale-up time: _____ seconds
  - Recovery time: _____ seconds
  - Test status: [ ] PASS [ ] FAIL

### 2.3 Soak Test (60 min) - Optional

- [ ] **Run soak test**
  ```bash
  k6 run --scenario soak_test scripts/perf/k6-load-tests.js
  ```

- [ ] **Monitor memory usage**
  ```bash
  watch kubectl top pods -n unit-talk
  ```

- [ ] **Record results**
  - Start memory: _____ MB
  - End memory: _____ MB
  - Memory growth: _____ %
  - Stable latency: [ ] YES [ ] NO
  - Memory leaks detected: [ ] YES [ ] NO
  - Test status: [ ] PASS [ ] FAIL

---

## Phase 3: Chaos Engineering (30 min)

### 3.1 Pod Failure Tests

- [ ] **Make script executable**
  ```bash
  chmod +x scripts/chaos/pod-failure.sh
  ```

- [ ] **Run pod failure tests**
  ```bash
  ./scripts/chaos/pod-failure.sh
  ```

- [ ] **Record results**
  - Single pod failure recovery: _____ seconds (Target: <60s)
  - Multiple pod failure recovery: _____ seconds (Target: <60s)
  - Rolling pod failures: [ ] PASS [ ] FAIL
  - API downtime: _____ seconds (Target: 0s)
  - Test status: [ ] PASS [ ] FAIL

- [ ] **Review logs**
  ```bash
  cat out/ops/chaos/pod-failure-*.log
  ```

### 3.2 Redis Outage Tests

- [ ] **Make script executable**
  ```bash
  chmod +x scripts/chaos/redis-outage.sh
  ```

- [ ] **Run Redis outage tests**
  ```bash
  ./scripts/chaos/redis-outage.sh
  ```

- [ ] **Record results**
  - Redis pod deletion recovery: _____ seconds (Target: <60s)
  - Circuit breaker activated: [ ] YES [ ] NO
  - Graceful degradation: [ ] YES [ ] NO
  - Network partition recovery: _____ seconds
  - Connection pool exhaustion handled: [ ] YES [ ] NO
  - Test status: [ ] PASS [ ] FAIL

- [ ] **Review logs**
  ```bash
  cat out/ops/chaos/redis-outage-*.log
  ```

---

## Phase 4: SLO Validation (15 min)

### 4.1 Check Prometheus Alerts

- [ ] **Open Prometheus alerts**
  ```bash
  open http://localhost:9090/alerts
  ```

- [ ] **Check for firing alerts**
  ```bash
  curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | select(.state=="firing")'
  ```

- [ ] **Record active alerts**
  - Number of firing alerts: _____
  - Critical alerts: _____
  - Warning alerts: _____

### 4.2 Check Alertmanager

- [ ] **Open Alertmanager UI**
  ```bash
  open http://localhost:9093
  ```

- [ ] **Verify alert routing**
  - Alerts sent to Slack: [ ] YES [ ] NO
  - PagerDuty integration working: [ ] YES [ ] NO
  - Alert grouping correct: [ ] YES [ ] NO

### 4.3 Verify SLO Metrics

- [ ] **API p95 latency**
  ```bash
  curl -s 'http://localhost:9090/api/v1/query?query=histogram_quantile(0.95,sum(rate(http_request_duration_seconds_bucket{job="unit-talk-api"}[5m]))by(le))*1000' | jq '.data.result[0].value[1]'
  ```
  - Result: _____ ms (Target: <150ms)
  - Status: [ ] PASS [ ] FAIL

- [ ] **Error rate**
  ```bash
  curl -s 'http://localhost:9090/api/v1/query?query=(sum(rate(http_requests_total{job="unit-talk-api",status=~"5.."}[5m]))/sum(rate(http_requests_total{job="unit-talk-api"}[5m])))*100' | jq '.data.result[0].value[1]'
  ```
  - Result: _____ % (Target: <0.5%)
  - Status: [ ] PASS [ ] FAIL

- [ ] **Database p95 latency**
  ```bash
  curl -s 'http://localhost:9090/api/v1/query?query=histogram_quantile(0.95,sum(rate(database_query_duration_seconds_bucket{job="unit-talk-api"}[5m]))by(le))*1000' | jq '.data.result[0].value[1]'
  ```
  - Result: _____ ms (Target: <50ms)
  - Status: [ ] PASS [ ] FAIL

---

## Phase 5: Documentation (15 min)

### 5.1 Update Results Document

- [ ] **Edit results document**
  ```bash
  vim out/ops/perf/PHASE13_RESULTS.md
  ```

- [ ] **Fill in all metrics**
  - Load test results
  - Chaos test results
  - SLO compliance data
  - Observations
  - Recommendations

### 5.2 Create Summary

- [ ] **Generate summary report**
  - Overall status: [ ] PASS [ ] FAIL
  - Key findings: _____________________
  - Issues identified: _____________________
  - Recommendations: _____________________

### 5.3 Archive Results

- [ ] **Create archive**
  ```bash
  tar -czf phase13-results-$(date +%Y%m%d).tar.gz out/ops/
  ```

- [ ] **Upload to shared storage**
  - Location: _____________________

---

## Phase 6: Cleanup and Notification (10 min)

### 6.1 Stop Monitoring

- [ ] **Kill port-forward processes**
  ```bash
  pkill -f "port-forward"
  ```

- [ ] **Close monitoring terminals**

### 6.2 Notify Team

- [ ] **Post results to Slack**
  ```bash
  curl -X POST $SLACK_WEBHOOK \
    -H 'Content-Type: application/json' \
    -d '{"text":"Phase 13 testing completed! Results: [PASS/FAIL]"}'
  ```

- [ ] **Send email summary** to stakeholders

- [ ] **Update project tracker**

### 6.3 Schedule Follow-up

- [ ] **Schedule 7-day SLO review**
  - Date: _____________________

- [ ] **Schedule optimization meeting**
  - Date: _____________________

- [ ] **Create action items** for any issues found

---

## Rollback Procedures (If Needed)

### Rollback HPA

- [ ] **Revert HPA configuration**
  ```bash
  kubectl apply -f backup/hpa-$(date +%Y%m%d).yaml
  ```

### Rollback Connection Pools

- [ ] **Remove ConfigMaps**
  ```bash
  kubectl delete configmap redis-connection-pool-config -n unit-talk
  kubectl delete configmap postgres-connection-pool-config -n unit-talk
  ```

- [ ] **Restart pods**
  ```bash
  kubectl rollout restart deployment/unit-talk-api -n unit-talk
  ```

### Rollback Alertmanager

- [ ] **Revert Alertmanager config**
  ```bash
  git checkout HEAD~1 infrastructure/monitoring/alertmanager-config.yaml
  kubectl apply -f infrastructure/monitoring/alertmanager-config.yaml
  ```

---

## Final Sign-Off

**Execution Completed By:** _____________________  
**Date:** _____________________  
**Time:** _____________________  
**Overall Status:** [ ] SUCCESS [ ] PARTIAL [ ] FAILED

**Approvals:**
- [ ] Platform SRE Lead
- [ ] On-Call Engineer
- [ ] DevOps Manager

**Next Steps:**
- [ ] Monitor SLO compliance for 7 days
- [ ] Implement recommendations
- [ ] Schedule regular chaos testing
- [ ] Integrate into CI/CD pipeline

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-25

