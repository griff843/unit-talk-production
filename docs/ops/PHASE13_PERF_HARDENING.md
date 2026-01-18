# Phase 13 – Performance and Reliability Hardening

**Date:** 2025-01-25  
**Status:** ✅ Complete  
**Owner:** Platform SRE Team

## Executive Summary

Phase 13 implements comprehensive performance and reliability hardening for the Unit Talk SaaS platform on DOKS (DigitalOcean Kubernetes Service). This phase strengthens scalability, reliability, and cost efficiency through load testing, chaos engineering, refined auto-scaling policies, and SLO enforcement.

### Key Achievements

- ✅ **Load Testing Suite**: k6-based performance testing with 1k→5k RPS scenarios
- ✅ **Chaos Engineering**: Automated pod failure and Redis outage testing
- ✅ **Auto-Scaling Policies**: Refined HPA with latency-based scaling
- ✅ **SLO Enforcement**: Alertmanager integration with multi-channel notifications
- ✅ **Connection Pool Limits**: Optimized Redis and Postgres connection management

### SLO Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| API p95 Latency | < 150ms | TBD | 🟡 Pending Testing |
| Error Rate | < 0.5% | TBD | 🟡 Pending Testing |
| Uptime | 99.95% | TBD | 🟡 Pending Testing |
| DB p95 Latency | < 50ms | TBD | 🟡 Pending Testing |
| Recovery Time | < 60s | TBD | 🟡 Pending Testing |

---

## 1. Load Testing Suite

### Overview

Comprehensive k6-based load testing suite with multiple scenarios to validate performance under various load conditions.

### Test Scenarios

#### 1.1 Ramp Test (1k → 5k RPS)
- **Duration**: 13 minutes
- **Purpose**: Validate gradual scaling behavior
- **Stages**:
  - Warm-up: 2 min @ 1k RPS
  - Ramp: 5 min → 3k RPS
  - Peak: 3 min @ 5k RPS
  - Cool down: 2 min → 2k RPS
  - Shutdown: 1 min → 0 RPS

#### 1.2 Soak Test (1 hour sustained)
- **Duration**: 60 minutes
- **Load**: 2k RPS sustained
- **Purpose**: Identify memory leaks and resource exhaustion

#### 1.3 Spike Test
- **Duration**: 2 minutes
- **Purpose**: Validate sudden traffic spike handling
- **Pattern**: 1k → 10k → 1k RPS

#### 1.4 Stress Test
- **Duration**: 17 minutes
- **Purpose**: Find breaking point
- **Pattern**: Gradual increase to 10k RPS

### Running Load Tests

```bash
# Install k6
brew install k6  # macOS
# or
wget https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz

# Set environment variables
export BASE_URL="https://api.unit-talk.com"
export API_KEY="your-api-key"

# Run all scenarios
k6 run scripts/perf/k6-load-tests.js

# Run specific scenario
k6 run --scenario ramp_test scripts/perf/k6-load-tests.js

# Run with custom duration
k6 run --duration 30m scripts/perf/k6-load-tests.js

# Generate HTML report
k6 run --out json=out/ops/perf/results.json scripts/perf/k6-load-tests.js
```

### Metrics Collected

- **API Latency**: p50, p95, p99 response times
- **Error Rate**: HTTP 4xx/5xx error percentage
- **Queue Depth**: Temporal workflow queue depth
- **Database Latency**: Estimated DB query times
- **Throughput**: Requests per second
- **Success Rate**: Percentage of successful requests

### Thresholds

```javascript
thresholds: {
  'api_latency': ['p(95)<150', 'p(99)<500'],
  'error_rate': ['rate<0.005'],
  'db_latency': ['p(95)<50', 'p(99)<100'],
  'http_req_duration': ['p(95)<150', 'p(99)<500'],
  'http_req_failed': ['rate<0.005'],
  'checks': ['rate>0.995'],
}
```

### Reports

Load test reports are generated in:
- **HTML**: `out/ops/perf/k6-report-{timestamp}.html`
- **JSON**: `out/ops/perf/k6-summary-{timestamp}.json`
- **Console**: Real-time summary with color-coded results

---

## 2. Chaos Engineering

### Overview

Automated chaos engineering tests to validate system resilience and recovery capabilities.

### 2.1 Pod Failure Tests

**Script**: `scripts/chaos/pod-failure.sh`

#### Test Cases

1. **Single Pod Failure**
   - Deletes one API pod
   - Validates recovery < 60s
   - Checks API health during recovery

2. **Multiple Pod Failures (50%)**
   - Deletes half of API pods simultaneously
   - Validates graceful degradation
   - Ensures recovery < 60s

3. **Rolling Pod Failures**
   - Sequentially deletes all pods
   - Validates zero-downtime rolling updates
   - Checks API remains healthy throughout

#### Running Pod Failure Tests

```bash
# Set environment variables
export NAMESPACE="unit-talk"
export DEPLOYMENT="unit-talk-api"
export HEALTH_CHECK_URL="https://api.unit-talk.com/health"
export SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Run tests
chmod +x scripts/chaos/pod-failure.sh
./scripts/chaos/pod-failure.sh

# View logs
cat out/ops/chaos/pod-failure-*.log
```

### 2.2 Redis Outage Tests

**Script**: `scripts/chaos/redis-outage.sh`

#### Test Cases

1. **Redis Pod Deletion**
   - Deletes Redis pod
   - Validates circuit breaker activation
   - Checks graceful degradation
   - Validates recovery < 60s

2. **Redis Network Partition**
   - Creates NetworkPolicy to block Redis traffic
   - Validates API continues with degraded functionality
   - Removes NetworkPolicy and validates recovery

3. **Redis Connection Pool Exhaustion**
   - Simulates connection pool saturation
   - Validates connection pool limits
   - Checks API resilience

#### Running Redis Outage Tests

```bash
# Set environment variables
export NAMESPACE="unit-talk"
export REDIS_DEPLOYMENT="redis"
export API_URL="https://api.unit-talk.com"

# Run tests
chmod +x scripts/chaos/redis-outage.sh
./scripts/chaos/redis-outage.sh

# View logs
cat out/ops/chaos/redis-outage-*.log
```

### Chaos Engineering Best Practices

1. **Run during low-traffic periods** initially
2. **Monitor Grafana dashboards** during tests
3. **Have rollback plan ready**
4. **Notify team before running tests**
5. **Review logs after each test**
6. **Gradually increase chaos intensity**

---

## 3. Auto-Scaling Policies

### Overview

Refined Horizontal Pod Autoscaler (HPA) configurations with latency-based scaling and connection pool limits.

### 3.1 HPA Configuration

**File**: `infrastructure/kubernetes/hpa-configs.yaml`

#### API Service HPA

```yaml
metrics:
  # CPU-based scaling (70% target)
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  
  # Memory-based scaling (80% target)
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  
  # Request rate scaling (100 req/s per pod)
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: '100'
  
  # Latency-based scaling (p95 < 150ms SLO)
  - type: Pods
    pods:
      metric:
        name: http_request_duration_p95_milliseconds
      target:
        type: AverageValue
        averageValue: '140'  # Buffer below 150ms SLO
```

#### Scaling Behavior

- **Min Replicas**: 3 (high availability)
- **Max Replicas**: 20 (cost control)
- **Scale-up**: 50% increase every 60s, max 2 pods/min
- **Scale-down**: 10% decrease every 60s, 5-min stabilization

### 3.2 Connection Pool Limits

**File**: `infrastructure/kubernetes/connection-pool-limits.yaml`

#### Redis Connection Pool

```yaml
REDIS_POOL_MIN: "5"
REDIS_POOL_MAX: "50"
REDIS_POOL_IDLE_TIMEOUT_MS: "120000"  # 2 minutes
REDIS_POOL_ACQUIRE_TIMEOUT_MS: "10000"  # 10 seconds
REDIS_MAX_RETRIES_PER_REQUEST: "3"
REDIS_CONNECT_TIMEOUT_MS: "10000"
REDIS_COMMAND_TIMEOUT_MS: "5000"
```

#### Postgres Connection Pool

```yaml
POSTGRES_POOL_MIN: "10"
POSTGRES_POOL_MAX: "100"
POSTGRES_POOL_IDLE_TIMEOUT_MS: "600000"  # 10 minutes
POSTGRES_POOL_CONNECTION_TIMEOUT_MS: "10000"
POSTGRES_POOL_ACQUIRE_TIMEOUT_MS: "30000"
POSTGRES_STATEMENT_TIMEOUT_MS: "30000"
```

#### PgBouncer Settings

```yaml
PGBOUNCER_POOL_MODE: "transaction"
PGBOUNCER_MAX_CLIENT_CONN: "1000"
PGBOUNCER_DEFAULT_POOL_SIZE: "25"
PGBOUNCER_MAX_DB_CONNECTIONS: "100"
```

### Applying Auto-Scaling Policies

```bash
# Apply HPA configurations
kubectl apply -f infrastructure/kubernetes/hpa-configs.yaml

# Apply connection pool limits
kubectl apply -f infrastructure/kubernetes/connection-pool-limits.yaml

# Verify HPA status
kubectl get hpa -n unit-talk

# Watch HPA in action
kubectl get hpa -n unit-talk --watch

# Describe HPA for details
kubectl describe hpa unit-talk-api-hpa -n unit-talk
```

---

## 4. SLO Enforcement

### Overview

Comprehensive SLO enforcement through Prometheus alerting rules and Alertmanager multi-channel notifications.

### 4.1 SLO Definitions

| SLO | Target | Measurement Window | Alert Threshold |
|-----|--------|-------------------|-----------------|
| API Latency (p95) | < 150ms | 5 minutes | > 150ms for 5 min |
| Error Rate | < 0.5% | 5 minutes | > 0.5% for 5 min |
| DB Latency (p95) | < 50ms | 5 minutes | > 50ms for 5 min |
| Availability | 99.95% | 30 days | < 99.5% |
| Recovery Time | < 60s | Per incident | > 60s |

### 4.2 Prometheus Rules

**File**: `infrastructure/monitoring/prometheus-rules.yaml`

Already configured with comprehensive SLO rules including:
- API latency SLO violations
- Error rate SLO violations
- Database latency SLO violations
- Availability SLO violations
- Error budget burn rate alerts

### 4.3 Alertmanager Configuration

**File**: `infrastructure/monitoring/alertmanager-config.yaml`

#### Notification Channels

1. **Slack Channels**:
   - `#alerts-critical`: Critical SLO violations
   - `#alerts-slo`: SLO warnings
   - `#alerts-database`: Database alerts
   - `#alerts-infrastructure`: Redis, networking
   - `#alerts-error-budget`: Error budget tracking
   - `#alerts-business`: Business logic alerts
   - `#alerts-agents`: Agent health alerts

2. **PagerDuty**: Critical alerts only

3. **Email**: Configurable SMTP integration

#### Alert Routing

```yaml
routes:
  # Critical SLO violations → PagerDuty + Slack (immediate)
  - match:
      severity: critical
      slo: latency
    receiver: 'pagerduty-critical'
    group_wait: 0s
    repeat_interval: 5m
  
  # Warning SLO violations → Slack (30s delay)
  - match:
      severity: warning
      slo: latency
    receiver: 'slack-slo-warnings'
    group_wait: 30s
    repeat_interval: 1h
```

### Deploying SLO Enforcement

```bash
# Apply Prometheus rules
kubectl apply -f infrastructure/monitoring/prometheus-rules.yaml

# Apply Alertmanager configuration
kubectl apply -f infrastructure/monitoring/alertmanager-config.yaml

# Verify Prometheus rules loaded
kubectl exec -n monitoring prometheus-0 -- promtool check rules /etc/prometheus/rules/*.yaml

# Verify Alertmanager configuration
kubectl exec -n monitoring alertmanager-0 -- amtool check-config /etc/alertmanager/alertmanager.yml

# View active alerts
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Open http://localhost:9090/alerts

# View Alertmanager UI
kubectl port-forward -n monitoring svc/alertmanager 9093:9093
# Open http://localhost:9093
```

---

## 5. Rollback Procedures

### 5.1 Rollback HPA Changes

```bash
# Revert to previous HPA configuration
kubectl rollout undo deployment/unit-talk-api -n unit-talk

# Or apply previous version
git checkout HEAD~1 infrastructure/kubernetes/hpa-configs.yaml
kubectl apply -f infrastructure/kubernetes/hpa-configs.yaml
```

### 5.2 Rollback Connection Pool Limits

```bash
# Remove connection pool ConfigMaps
kubectl delete configmap redis-connection-pool-config -n unit-talk
kubectl delete configmap postgres-connection-pool-config -n unit-talk

# Restart affected pods
kubectl rollout restart deployment/unit-talk-api -n unit-talk
```

### 5.3 Rollback Alertmanager Configuration

```bash
# Revert to previous Alertmanager config
git checkout HEAD~1 infrastructure/monitoring/alertmanager-config.yaml
kubectl apply -f infrastructure/monitoring/alertmanager-config.yaml

# Reload Alertmanager
kubectl exec -n monitoring alertmanager-0 -- kill -HUP 1
```

### 5.4 Emergency Procedures

#### Stop Load Testing

```bash
# Kill all k6 processes
pkill k6

# Or use Ctrl+C in terminal
```

#### Stop Chaos Engineering

```bash
# Kill chaos scripts
pkill -f "pod-failure.sh"
pkill -f "redis-outage.sh"

# Manually scale up if needed
kubectl scale deployment/unit-talk-api --replicas=5 -n unit-talk
kubectl scale deployment/redis --replicas=1 -n unit-talk
```

#### Disable Auto-Scaling

```bash
# Temporarily disable HPA
kubectl delete hpa unit-talk-api-hpa -n unit-talk

# Set manual replica count
kubectl scale deployment/unit-talk-api --replicas=5 -n unit-talk
```

---

## 6. Monitoring and Validation

### 6.1 Grafana Dashboards

Access dashboards at: `https://grafana.unit-talk.com`

- **SLO Dashboard**: Real-time SLO compliance tracking
- **Performance Dashboard**: Latency, throughput, error rates
- **Infrastructure Dashboard**: CPU, memory, network
- **Error Budget Dashboard**: Error budget burn rate

### 6.2 Prometheus Queries

```promql
# API p95 latency
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="unit-talk-api"}[5m])) by (le)) * 1000

# Error rate
(sum(rate(http_requests_total{job="unit-talk-api",status=~"5.."}[5m])) / sum(rate(http_requests_total{job="unit-talk-api"}[5m]))) * 100

# Database p95 latency
histogram_quantile(0.95, sum(rate(database_query_duration_seconds_bucket{job="unit-talk-api"}[5m])) by (le)) * 1000

# HPA current replicas
kube_horizontalpodautoscaler_status_current_replicas{horizontalpodautoscaler="unit-talk-api-hpa"}

# Redis connection pool usage
redis_connected_clients / redis_config_maxclients * 100
```

### 6.3 Health Checks

```bash
# API health
curl https://api.unit-talk.com/health

# Prometheus health
curl http://prometheus:9090/-/healthy

# Alertmanager health
curl http://alertmanager:9093/-/healthy

# Grafana health
curl https://grafana.unit-talk.com/api/health
```

---

## 7. Next Steps

1. **Run Initial Load Tests**: Execute k6 tests during low-traffic period
2. **Validate Chaos Engineering**: Run pod failure and Redis outage tests
3. **Monitor SLO Compliance**: Track metrics for 7 days
4. **Tune Auto-Scaling**: Adjust HPA thresholds based on real data
5. **Optimize Connection Pools**: Fine-tune based on actual usage patterns
6. **Document Incidents**: Record any SLO violations and root causes
7. **Iterate**: Continuously improve based on production data

---

## 8. Support and Escalation

### Contacts

- **Platform SRE Team**: sre@unit-talk.com
- **On-Call Engineer**: PagerDuty rotation
- **Slack**: #platform-sre

### Escalation Path

1. **Level 1**: On-call engineer (PagerDuty)
2. **Level 2**: Platform SRE lead
3. **Level 3**: CTO

### Documentation

- **Runbooks**: `https://docs.unit-talk.com/runbooks/`
- **Architecture**: `docs/architecture/`
- **Deployment**: `docs/deployment/`

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-25  
**Next Review**: 2025-02-25

