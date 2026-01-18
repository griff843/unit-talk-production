# Chaos Engineering Suite

**Phase 13 - Performance and Reliability Hardening**  
**Date:** 2025-01-25

## Overview

Automated chaos engineering tests to validate system resilience, recovery capabilities, and graceful degradation under failure conditions.

## ⚠️ Important Safety Notice

**CRITICAL:** These tests intentionally cause failures in production-like environments. Always:

1. ✅ Run during low-traffic periods
2. ✅ Notify team before running
3. ✅ Monitor dashboards during tests
4. ✅ Have rollback plan ready
5. ✅ Start with staging environment
6. ❌ Never run without approval
7. ❌ Never run during peak hours

## Prerequisites

### Required Tools

- `kubectl` - Kubernetes CLI
- `curl` - HTTP client
- `jq` - JSON processor (optional)
- Bash 4.0+ or compatible shell

### Required Access

- Kubernetes cluster access (RBAC permissions)
- Namespace: `unit-talk`
- Ability to delete pods
- Ability to create NetworkPolicies

### Environment Variables

```bash
export NAMESPACE="unit-talk"
export DEPLOYMENT="unit-talk-api"
export REDIS_DEPLOYMENT="redis"
export HEALTH_CHECK_URL="https://api.unit-talk.com/health"
export API_URL="https://api.unit-talk.com"
export SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

## Test Scripts

### 1. Pod Failure Tests

**Script:** `pod-failure.sh`

**Purpose:** Validate Kubernetes pod failure recovery and auto-healing.

**Target:** Recovery time < 60 seconds

#### Test Cases

##### Test 1: Single Pod Failure
- Deletes one API pod
- Validates Kubernetes recreates pod
- Checks API remains healthy
- Measures recovery time

##### Test 2: Multiple Pod Failures (50%)
- Deletes half of API pods simultaneously
- Validates graceful degradation
- Ensures remaining pods handle load
- Measures recovery time

##### Test 3: Rolling Pod Failures
- Sequentially deletes all pods one by one
- Validates zero-downtime rolling updates
- Checks API remains healthy throughout
- Simulates rolling deployment scenario

#### Running Pod Failure Tests

```bash
# Make script executable
chmod +x scripts/chaos/pod-failure.sh

# Run all tests
./scripts/chaos/pod-failure.sh

# Run with custom namespace
NAMESPACE=staging ./scripts/chaos/pod-failure.sh

# Run with custom deployment
DEPLOYMENT=my-api ./scripts/chaos/pod-failure.sh

# Run with Slack notifications
SLACK_WEBHOOK=https://hooks.slack.com/... ./scripts/chaos/pod-failure.sh
```

#### Expected Results

✅ **PASS** if:
- All pods recover within 60 seconds
- API remains healthy or degrades gracefully
- No data loss or corruption
- All tests complete successfully

❌ **FAIL** if:
- Recovery time > 60 seconds
- API becomes completely unavailable
- Pods fail to recreate
- Data inconsistencies detected

### 2. Redis Outage Tests

**Script:** `redis-outage.sh`

**Purpose:** Validate Redis failure recovery and circuit breaker behavior.

**Target:** Recovery time < 60 seconds, graceful degradation

#### Test Cases

##### Test 1: Redis Pod Deletion
- Deletes Redis pod
- Validates circuit breaker activation
- Checks API continues with degraded functionality
- Measures recovery time

##### Test 2: Redis Network Partition
- Creates NetworkPolicy to block Redis traffic
- Simulates network partition scenario
- Validates API handles Redis unavailability
- Removes NetworkPolicy and validates recovery

##### Test 3: Redis Connection Pool Exhaustion
- Simulates connection pool saturation
- Validates connection pool limits enforced
- Checks API resilience under connection pressure
- Verifies graceful error handling

#### Running Redis Outage Tests

```bash
# Make script executable
chmod +x scripts/chaos/redis-outage.sh

# Run all tests
./scripts/chaos/redis-outage.sh

# Run with custom Redis deployment
REDIS_DEPLOYMENT=my-redis ./scripts/chaos/redis-outage.sh

# Run with custom API URL
API_URL=https://staging.unit-talk.com ./scripts/chaos/redis-outage.sh
```

#### Expected Results

✅ **PASS** if:
- Redis recovers within 60 seconds
- Circuit breaker activates correctly
- API continues with degraded functionality
- No cascading failures
- Data consistency maintained

❌ **FAIL** if:
- Recovery time > 60 seconds
- Circuit breaker fails to activate
- API becomes completely unavailable
- Cascading failures occur
- Data corruption detected

## Test Execution Workflow

### Pre-Test Checklist

- [ ] Team notified via Slack
- [ ] Grafana dashboards open and monitored
- [ ] Low-traffic period confirmed
- [ ] Backup/snapshot taken (if applicable)
- [ ] Rollback plan documented
- [ ] On-call engineer available
- [ ] Environment variables configured
- [ ] Scripts tested in staging

### During Test

1. **Monitor Dashboards**
   - Grafana: `https://grafana.unit-talk.com`
   - Prometheus: `http://prometheus:9090`
   - Kubernetes Dashboard: `kubectl proxy`

2. **Watch Logs**
   ```bash
   # API logs
   kubectl logs -n unit-talk -l app=unit-talk-api -f
   
   # Redis logs
   kubectl logs -n unit-talk -l app=redis -f
   
   # Test logs
   tail -f out/ops/chaos/*.log
   ```

3. **Monitor Metrics**
   ```bash
   # Pod status
   watch kubectl get pods -n unit-talk
   
   # HPA status
   watch kubectl get hpa -n unit-talk
   
   # Events
   kubectl get events -n unit-talk --watch
   ```

### Post-Test Checklist

- [ ] All tests completed
- [ ] Results documented
- [ ] Logs saved
- [ ] Issues identified and logged
- [ ] Team notified of completion
- [ ] Grafana snapshots saved
- [ ] Lessons learned documented
- [ ] Action items created

## Interpreting Results

### Success Indicators

✅ **System is resilient** if:
- Recovery time < 60 seconds
- No complete service outages
- Graceful degradation observed
- Auto-healing works correctly
- Circuit breakers activate properly
- No data loss or corruption

### Failure Indicators

❌ **System needs improvement** if:
- Recovery time > 60 seconds
- Complete service outages occur
- Cascading failures observed
- Auto-healing fails
- Circuit breakers don't activate
- Data inconsistencies detected

### Common Issues and Solutions

#### Issue: Pods Don't Recreate

**Symptoms:**
- Deleted pods stay in Terminating state
- New pods don't appear

**Possible Causes:**
- Resource quota exceeded
- Node capacity issues
- Image pull failures

**Solutions:**
```bash
# Check resource quotas
kubectl describe resourcequota -n unit-talk

# Check node capacity
kubectl describe nodes

# Check pod events
kubectl describe pod <pod-name> -n unit-talk
```

#### Issue: Recovery Time > 60s

**Symptoms:**
- Pods take too long to become ready
- API health checks fail for extended period

**Possible Causes:**
- Slow image pulls
- Long startup times
- Health check misconfiguration

**Solutions:**
```bash
# Check pod startup time
kubectl get events -n unit-talk --sort-by='.lastTimestamp'

# Review health check configuration
kubectl get deployment unit-talk-api -n unit-talk -o yaml | grep -A 10 livenessProbe

# Optimize startup
# - Use smaller images
# - Implement readiness probes
# - Reduce startup dependencies
```

#### Issue: Circuit Breaker Doesn't Activate

**Symptoms:**
- API fails completely when Redis is down
- No graceful degradation

**Possible Causes:**
- Circuit breaker not configured
- Thresholds too high
- Implementation bug

**Solutions:**
```bash
# Check circuit breaker configuration
kubectl get configmap -n unit-talk -o yaml | grep -i circuit

# Review application logs
kubectl logs -n unit-talk -l app=unit-talk-api | grep -i circuit

# Verify circuit breaker implementation
# - Check code for circuit breaker pattern
# - Verify thresholds are appropriate
# - Test circuit breaker in isolation
```

## Emergency Procedures

### Abort Test

```bash
# Kill running chaos scripts
pkill -f "pod-failure.sh"
pkill -f "redis-outage.sh"

# Remove any NetworkPolicies created
kubectl delete networkpolicy redis-chaos-block -n unit-talk

# Manually scale up if needed
kubectl scale deployment/unit-talk-api --replicas=5 -n unit-talk
kubectl scale deployment/redis --replicas=1 -n unit-talk
```

### Rollback

```bash
# Restore from backup (if applicable)
kubectl apply -f backup/deployment.yaml

# Force pod recreation
kubectl rollout restart deployment/unit-talk-api -n unit-talk
kubectl rollout restart deployment/redis -n unit-talk

# Check rollout status
kubectl rollout status deployment/unit-talk-api -n unit-talk
```

### Escalation

If tests reveal critical issues:

1. **Stop tests immediately**
2. **Notify on-call engineer** via PagerDuty
3. **Post in Slack** #platform-sre channel
4. **Document issue** in incident tracker
5. **Create action items** for remediation

## Reports and Logs

### Log Files

Test logs are saved in:
```
out/ops/chaos/pod-failure-{timestamp}.log
out/ops/chaos/redis-outage-{timestamp}.log
```

### Log Format

```
[2025-01-25 10:30:45] ℹ️  Starting test...
[2025-01-25 10:30:46] ✅ Test passed
[2025-01-25 10:30:47] ❌ Test failed
[2025-01-25 10:30:48] ⚠️  Warning detected
```

### Slack Notifications

If `SLACK_WEBHOOK` is configured, notifications are sent for:
- Test start
- Test completion
- Test failures
- Recovery time violations

## Best Practices

### Gradual Chaos Introduction

1. **Start small**: Single pod failures first
2. **Increase intensity**: Multiple pod failures
3. **Add complexity**: Network partitions, resource exhaustion
4. **Automate**: Integrate into CI/CD pipeline

### Regular Testing Schedule

- **Weekly**: Single pod failure tests
- **Monthly**: Full chaos engineering suite
- **Quarterly**: Extended chaos scenarios
- **Before major releases**: Comprehensive validation

### Documentation

- Document all test runs
- Track recovery times over time
- Identify trends and patterns
- Share learnings with team

## Integration with CI/CD

### GitHub Actions

```yaml
name: Chaos Engineering

on:
  schedule:
    - cron: '0 3 * * 0'  # Weekly on Sunday at 3 AM
  workflow_dispatch:

jobs:
  chaos-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure kubectl
        uses: azure/k8s-set-context@v3
        with:
          kubeconfig: ${{ secrets.KUBECONFIG }}
      
      - name: Run pod failure tests
        run: ./scripts/chaos/pod-failure.sh
      
      - name: Run Redis outage tests
        run: ./scripts/chaos/redis-outage.sh
      
      - name: Upload logs
        uses: actions/upload-artifact@v3
        with:
          name: chaos-logs
          path: out/ops/chaos/
```

## Support

- **Documentation**: `docs/ops/PHASE13_PERF_HARDENING.md`
- **Slack**: #platform-sre
- **Email**: sre@unit-talk.com
- **On-Call**: PagerDuty rotation

## References

- [Chaos Engineering Principles](https://principlesofchaos.org/)
- [Kubernetes Chaos Engineering](https://kubernetes.io/docs/tasks/debug-application-cluster/)
- [Netflix Chaos Monkey](https://netflix.github.io/chaosmonkey/)
- [Phase 13 Documentation](../../docs/ops/PHASE13_PERF_HARDENING.md)

---

**Last Updated:** 2025-01-25  
**Maintained By:** Platform SRE Team

