# Smart Form Release Runbook

**Application**: Smart Form (Betting Submission Interface) **Team**: Frontend
Engineering **Last Updated**: 2025-10-25 **Version**: 1.0.0

## Overview

This runbook guides operators through the Smart Form canary deployment process,
monitoring, and rollback procedures.

## Pre-Deployment Checklist

- [ ] All TypeScript compilation errors resolved (`npm run type-check` passes)
- [ ] Production build successful (`npm run build` passes)
- [ ] Smoke tests passing (`npm run test:e2e -- smoke-test.spec.ts`)
- [ ] Environment variables configured in Kubernetes secrets
- [ ] Supabase connection verified
- [ ] ArgoCD sync policy reviewed
- [ ] Monitoring dashboards prepared
- [ ] Incident response team notified

## Deployment Architecture

```
┌─────────────────────────────────────┐
│   Ingress (NGINX with Canary)       │
│   - Default: 0% traffic to Smart Form
│   - Canary header: X-Canary-Smart-Form
└─────────────────┬───────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌──────────────┐    ┌──────────────┐
│  Existing    │    │  Smart Form  │
│  Frontend    │    │  (Canary)    │
│  (Stable)    │    │              │
│              │    │  Replicas: 2 │
│              │    │  Port: 3021  │
└──────────────┘    └──────────────┘
```

## Phase 1: Initial Deployment (Traffic Weight: 0%)

### Step 1: Deploy Application

```bash
# Apply Kubernetes manifests
kubectl apply -f infrastructure/kubernetes/apps/smart-form/

# Verify deployment
kubectl -n unit-talk get deployment smart-form
kubectl -n unit-talk get pods -l app=smart-form
kubectl -n unit-talk logs -l app=smart-form --tail=50
```

**Expected Output**:

- Deployment shows `2/2` ready replicas
- Pods are in `Running` state
- Logs show Next.js server started on port 3021

### Step 2: Verify Health Checks

```bash
# Check readiness probe
kubectl -n unit-talk exec -it deployment/smart-form -- curl http://localhost:3021/api/health

# Expected response:
# {"status":"healthy","timestamp":"..."}
```

### Step 3: Test Canary Header Access

```bash
# Access Smart Form via canary header (should work)
curl -H "X-Canary-Smart-Form: enabled" https://smart-form.unit-talk.com

# Access without header (should route to existing frontend)
curl https://smart-form.unit-talk.com
```

**Validation**:

- ✅ With header: Smart Form renders correctly
- ✅ Without header: Existing frontend (no Smart Form traffic)

## Phase 2: Canary Rollout (5% Traffic)

### Step 1: Update Canary Weight

```bash
# Edit ingress to increase canary weight to 5%
kubectl -n unit-talk patch ingress smart-form -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/canary-weight":"5"}}}'
```

### Step 2: Monitor Metrics (15-30 minutes)

```bash
# Watch pod metrics
kubectl -n unit-talk top pods -l app=smart-form

# Check for errors
kubectl -n unit-talk logs -l app=smart-form --tail=100 | grep -i error

# Monitor ingress traffic
kubectl -n unit-talk logs -l app=nginx-ingress --tail=100 | grep smart-form
```

**Key Metrics to Monitor**:

- **Error Rate**: < 1% (5xx responses)
- **Response Time**: p95 < 2s, p99 < 5s
- **CPU Usage**: < 50% of limits
- **Memory Usage**: < 80% of limits
- **Availability**: > 99.5%

**Dashboards**:

- Grafana: `https://grafana.unit-talk.com/d/smart-form-canary`
- Prometheus: `https://prometheus.unit-talk.com/graph`

### Step 3: Validate User Experience

```bash
# Test form submission flow
curl -X POST https://smart-form.unit-talk.com/api/submit-ticket \
  -H "Content-Type: application/json" \
  -d '{"capper":"test","sport":"NFL","selections":[...]}'

# Expected: 200 OK with success response
```

**Go/No-Go Decision**:

- ✅ **GO**: Error rate < 1%, response times acceptable, no critical issues
- ❌ **NO-GO**: Error rate > 2%, response times > 5s, user complaints

## Phase 3: Gradual Traffic Increase

### Traffic Progression Schedule

| Phase              | Traffic Weight | Duration | Monitoring           |
| ------------------ | -------------- | -------- | -------------------- |
| Canary Header Only | 0%             | 24h      | Manual testing       |
| Initial Canary     | 5%             | 4h       | Intensive monitoring |
| Early Rollout      | 25%            | 8h       | Active monitoring    |
| Majority Rollout   | 50%            | 12h      | Standard monitoring  |
| Full Rollout       | 100%           | Stable   | Standard monitoring  |

### Increase Traffic Command

```bash
# Increase to 25%
kubectl -n unit-talk patch ingress smart-form -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/canary-weight":"25"}}}'

# Increase to 50%
kubectl -n unit-talk patch ingress smart-form -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/canary-weight":"50"}}}'

# Increase to 100%
kubectl -n unit-talk patch ingress smart-form -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/canary-weight":"100"}}}'
```

**Between Each Phase**:

1. Monitor for specified duration
2. Review metrics dashboard
3. Check error logs
4. Validate user feedback
5. Get team approval before proceeding

## Rollback Procedures

### Immediate Rollback (Emergency)

```bash
# Reduce traffic to 0% immediately
kubectl -n unit-talk patch ingress smart-form -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/canary-weight":"0"}}}'

# Verify rollback
kubectl -n unit-talk get ingress smart-form -o jsonpath='{.metadata.annotations.nginx\.ingress\.kubernetes\.io/canary-weight}'

# Expected: 0
```

**When to Use**:

- Error rate > 5%
- Critical functionality broken
- Security incident detected
- Database connection failures
- Cascading failures observed

### Graceful Rollback

```bash
# Reduce traffic incrementally
kubectl -n unit-talk patch ingress smart-form -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/canary-weight":"25"}}}' # From 50%
# Wait 10 minutes, monitor
kubectl -n unit-talk patch ingress smart-form -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/canary-weight":"5"}}}' # From 25%
# Wait 10 minutes, monitor
kubectl -n unit-talk patch ingress smart-form -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/canary-weight":"0"}}}' # From 5%
```

**When to Use**:

- Error rate 2-4% (elevated but not critical)
- Performance degradation observed
- Non-critical functionality issues
- User experience complaints

### Complete Rollback (Remove Deployment)

```bash
# Set traffic to 0%
kubectl -n unit-talk patch ingress smart-form -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/canary-weight":"0"}}}'

# Scale down deployment
kubectl -n unit-talk scale deployment smart-form --replicas=0

# Optionally delete resources
kubectl delete -f infrastructure/kubernetes/apps/smart-form/
```

## Monitoring & Observability

### Prometheus Queries

```promql
# Error rate
sum(rate(nginx_ingress_controller_requests{service="smart-form",status=~"5.."}[5m]))
/ sum(rate(nginx_ingress_controller_requests{service="smart-form"}[5m]))

# Response time p95
histogram_quantile(0.95, sum(rate(nginx_ingress_controller_request_duration_seconds_bucket{service="smart-form"}[5m])) by (le))

# Pod CPU usage
sum(rate(container_cpu_usage_seconds_total{pod=~"smart-form.*"}[5m])) by (pod)

# Pod memory usage
sum(container_memory_working_set_bytes{pod=~"smart-form.*"}) by (pod)
```

### Log Analysis

```bash
# View errors in last hour
kubectl -n unit-talk logs -l app=smart-form --since=1h | grep -i error

# Count error types
kubectl -n unit-talk logs -l app=smart-form --since=1h | grep -i error | awk '{print $5}' | sort | uniq -c

# Follow real-time logs
kubectl -n unit-talk logs -f -l app=smart-form
```

### Health Checks

```bash
# Deployment status
kubectl -n unit-talk get deployment smart-form

# Pod status
kubectl -n unit-talk get pods -l app=smart-form -o wide

# Service endpoints
kubectl -n unit-talk get endpoints smart-form

# Ingress status
kubectl -n unit-talk get ingress smart-form
```

## Incident Response

### Severity Levels

**P0 - Critical (Immediate Rollback)**:

- Complete service outage
- Data loss or corruption
- Security breach
- Error rate > 10%

**P1 - High (Gradeful Rollback)**:

- Partial service degradation
- Error rate 5-10%
- Performance severely degraded
- Core functionality broken

**P2 - Medium (Hold Rollout)**:

- Error rate 2-5%
- Non-critical functionality issues
- Performance moderately degraded
- User experience complaints

**P3 - Low (Continue with Caution)**:

- Error rate < 2%
- Minor issues observed
- Edge case failures
- Cosmetic issues

### Escalation Contacts

- **Frontend Team Lead**: [Contact Info]
- **Platform Engineer**: [Contact Info]
- **Database Admin**: [Contact Info]
- **Security Team**: [Contact Info]
- **On-Call Engineer**: [PagerDuty Link]

## Post-Deployment Validation

After 100% rollout, validate:

- [ ] All smoke tests passing
- [ ] Error rate < 0.5% for 24 hours
- [ ] Response times within SLO
- [ ] No increase in support tickets
- [ ] Positive user feedback
- [ ] Database connections stable
- [ ] No memory leaks observed
- [ ] Canary annotations removed
- [ ] Documentation updated
- [ ] Retrospective scheduled

## Appendix

### Environment Variables

```bash
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=<from-secret>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from-secret>
PORT=3021
```

### Resource Limits

```yaml
resources:
  requests:
    memory: 256Mi
    cpu: 100m
  limits:
    memory: 512Mi
    cpu: 500m
```

### Useful Commands

```bash
# View all Smart Form resources
kubectl -n unit-talk get all -l app=smart-form

# Describe deployment for events
kubectl -n unit-talk describe deployment smart-form

# Get recent events
kubectl -n unit-talk get events --sort-by='.lastTimestamp' | grep smart-form

# Execute shell in pod
kubectl -n unit-talk exec -it deployment/smart-form -- /bin/sh
```

---

**Document Version**: 1.0.0 **Last Reviewed**: 2025-10-25 **Next Review**:
Monthly or after major incidents
