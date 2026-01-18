# Runbook: API Outage

**Severity:** Critical (Severity 1)
**Response Time:** Immediate
**Last Updated:** 2025-01-25
**Owner:** Platform SRE Team

---

## Overview

This runbook provides step-by-step procedures for responding to complete or partial API outages affecting the Unit Talk platform.

### Symptoms

- API health endpoint returns 5xx errors or times out
- Prometheus alert: `ServiceDown` or `AvailabilitySLOViolation`
- Zero or significantly reduced request rate in Grafana
- User reports of "service unavailable" errors
- Discord bot unresponsive
- Mobile app unable to connect

### Impact

- **Critical**: Complete service unavailable to all users
- **Business Impact**: Revenue loss, customer churn, reputation damage
- **SLO Impact**: Availability SLO violation (target: >99.5%)

---

## Immediate Response (0-5 minutes)

### Step 1: Acknowledge and Assess

```bash
# 1.1 Acknowledge the incident
# Update PagerDuty/Alertmanager to acknowledge

# 1.2 Check API health
curl https://api.unit-talk.com/health
# Expected: 200 OK with {"status": "healthy"}
# If timeout or 5xx: API is down

# 1.3 Check Prometheus for service status
curl -s 'http://prometheus:9090/api/v1/query?query=up{job="unit-talk-api"}' | jq '.data.result[0].value[1]'
# Expected: "1"
# If "0": Service is down

# 1.4 Check pod status
kubectl get pods -n unit-talk -l app=unit-talk-api
# Look for: Running vs CrashLoopBackOff/Error/Pending
```

**Record findings:**
- Time of detection: _____________________
- Service status: [ ] Completely down [ ] Partially down
- Affected versions: [ ] Blue [ ] Green [ ] Both
- Number of healthy pods: _____

### Step 2: Initiate Incident Response

```bash
# 2.1 Create incident ticket
# Use your incident management system

# 2.2 Notify stakeholders
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "🚨 SEVERITY 1: API Outage Detected",
    "blocks": [
      {
        "type": "section",
        "text": {"type": "mrkdwn", "text": "*Status:* INVESTIGATING\n*Impact:* Complete/Partial API outage\n*Incident Commander:* @oncall"}
      }
    ]
  }'

# 2.3 Join war room
# Channel: #production-incident
```

---

## Diagnosis (5-15 minutes)

### Step 3: Identify Root Cause

#### 3.1 Check Pod Logs

```bash
# Get recent logs from all API pods
kubectl logs -n unit-talk -l app=unit-talk-api --tail=200 --since=10m

# Look for:
# - Application startup errors
# - Uncaught exceptions
# - Database connection errors
# - Memory/OOM errors
# - Authentication failures
```

**Common errors and causes:**

| Error Pattern | Likely Cause | Solution |
|--------------|--------------|----------|
| `ECONNREFUSED` database | Database unreachable | Check DB failover (see DB_FAILOVER.md) |
| `Redis connection lost` | Redis outage | Check Redis (see REDIS_LOSS.md) |
| `FATAL: out of memory` | Memory leak/spike | Scale pods or restart |
| `Error: Cannot find module` | Broken deployment | Rollback deployment |
| `EADDRNOTAVAIL` | Port conflict | Check for duplicate pods |
| `429 Too Many Requests` | Rate limit hit | Check external API quotas |

#### 3.2 Check Resource Utilization

```bash
# Check node resources
kubectl top nodes

# Check pod resources
kubectl top pods -n unit-talk -l app=unit-talk-api

# Look for:
# - CPU usage > 80%
# - Memory usage > 90%
# - Nodes NotReady
```

#### 3.3 Check External Dependencies

```bash
# 3.3.1 Check Supabase (Database)
curl -f https://<supabase-project>.supabase.co/rest/v1/ \
  -H "apikey: $SUPABASE_ANON_KEY"
# Should return 200

# 3.3.2 Check Redis
kubectl exec -n unit-talk deployment/redis -- redis-cli ping
# Expected: PONG

# 3.3.3 Check network policies
kubectl get networkpolicies -n unit-talk
kubectl describe networkpolicy api-network-policy -n unit-talk

# 3.3.4 Check ingress
kubectl get ingress -n unit-talk
kubectl describe ingress unit-talk-api-ingress -n unit-talk
```

#### 3.4 Check Recent Deployments

```bash
# Check recent rollouts
kubectl rollout history deployment/unit-talk-api-blue -n unit-talk
kubectl rollout history deployment/unit-talk-api-green -n unit-talk

# Check recent events
kubectl get events -n unit-talk --sort-by='.lastTimestamp' | head -20
```

---

## Resolution

### Scenario A: Pod Crash/Restart Loop

**Root Cause:** Application crashes on startup or during runtime

```bash
# A.1 Check pod describe for crash details
kubectl describe pod -n unit-talk <pod-name>

# A.2 If OOMKilled, increase memory limits
kubectl set resources deployment/unit-talk-api-green -n unit-talk \
  --limits=memory=2Gi \
  --requests=memory=1Gi

# A.3 If CrashLoopBackOff due to code error, rollback
./scripts/blue-green/rollback.sh

# A.4 Force restart if needed
kubectl rollout restart deployment/unit-talk-api-green -n unit-talk

# A.5 Monitor restart
kubectl rollout status deployment/unit-talk-api-green -n unit-talk
```

### Scenario B: Database Connection Failure

**Root Cause:** Cannot connect to Supabase/PostgreSQL

```bash
# B.1 Verify database is up
curl -f https://<supabase-project>.supabase.co/rest/v1/

# B.2 Check connection pool
kubectl exec -n unit-talk deployment/unit-talk-api-green -- \
  node -e "console.log(process.env.DATABASE_URL)"

# B.3 Check secrets
kubectl get secret supabase-credentials -n unit-talk -o yaml

# B.4 Test connection from pod
kubectl exec -it -n unit-talk deployment/unit-talk-api-green -- \
  psql "$DATABASE_URL" -c "SELECT 1;"

# B.5 If database is down, follow DB_FAILOVER.md runbook

# B.6 Restart pods to reset connections
kubectl rollout restart deployment/unit-talk-api-green -n unit-talk
```

### Scenario C: Redis Connection Loss

**Root Cause:** Cannot connect to Redis cache

```bash
# C.1 Check Redis pod status
kubectl get pods -n unit-talk -l app=redis

# C.2 Test Redis connection
kubectl exec -n unit-talk deployment/redis -- redis-cli ping

# C.3 If Redis is down, follow REDIS_LOSS.md runbook

# C.4 Enable circuit breaker to bypass Redis (if implemented)
kubectl set env deployment/unit-talk-api-green \
  REDIS_CIRCUIT_BREAKER=true -n unit-talk

# C.5 Monitor API recovery
watch curl -s https://api.unit-talk.com/health
```

### Scenario D: Ingress/Load Balancer Issue

**Root Cause:** Traffic not routing to healthy pods

```bash
# D.1 Check ingress status
kubectl get ingress -n unit-talk
kubectl describe ingress unit-talk-api-ingress -n unit-talk

# D.2 Check service endpoints
kubectl get endpoints unit-talk-api-blue -n unit-talk
kubectl get endpoints unit-talk-api-green -n unit-talk

# D.3 Verify service selector
kubectl get service unit-talk-api-blue -n unit-talk -o yaml | grep selector -A 3

# D.4 Check for unhealthy pods in service
kubectl get pods -n unit-talk -l app=unit-talk-api -o wide

# D.5 Recreate service if needed
kubectl delete service unit-talk-api-green -n unit-talk
kubectl apply -f infrastructure/kubernetes/api-service.yaml

# D.6 Restart ingress controller (last resort)
kubectl rollout restart deployment/nginx-ingress-controller -n ingress-nginx
```

### Scenario E: Deployment Corruption

**Root Cause:** Bad deployment, missing dependencies, or config errors

```bash
# E.1 Immediate rollback to last known good version
./scripts/blue-green/rollback.sh

# E.2 Or manually rollback
kubectl rollout undo deployment/unit-talk-api-green -n unit-talk

# E.3 Verify rollback success
kubectl rollout status deployment/unit-talk-api-green -n unit-talk

# E.4 Route traffic to stable version
./scripts/blue-green/route-traffic.sh blue 100

# E.5 Test health
curl https://api.unit-talk.com/health
curl https://api.unit-talk.com/api/v1/health/agents
```

### Scenario F: Resource Exhaustion

**Root Cause:** Node or cluster resource exhaustion

```bash
# F.1 Check cluster capacity
kubectl describe nodes | grep -A 5 "Allocated resources"

# F.2 Evict low-priority pods if needed
kubectl delete pod -n unit-talk -l priority=low

# F.3 Scale up nodes (if using cluster autoscaler)
# Or manually add nodes via cloud provider

# F.4 Increase HPA limits temporarily
kubectl patch hpa unit-talk-api-hpa -n unit-talk -p '{"spec":{"maxReplicas":10}}'

# F.5 Monitor pod distribution
watch kubectl get pods -n unit-talk -o wide
```

---

## Verification (15-20 minutes)

### Step 4: Confirm Resolution

```bash
# 4.1 Check API health
curl https://api.unit-talk.com/health
# Expected: {"status": "healthy", "timestamp": "..."}

# 4.2 Check Prometheus metrics
curl -s 'http://prometheus:9090/api/v1/query?query=up{job="unit-talk-api"}' | jq '.data.result[0].value[1]'
# Expected: "1" for all instances

# 4.3 Check error rate
curl -s 'http://prometheus:9090/api/v1/query?query=(sum(rate(http_requests_total{job="unit-talk-api",status=~"5.."}[5m]))/sum(rate(http_requests_total{job="unit-talk-api"}[5m])))*100'
# Expected: < 0.5%

# 4.4 Check latency
curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,sum(rate(http_request_duration_seconds_bucket{job="unit-talk-api"}[5m]))by(le))*1000'
# Expected: < 150ms

# 4.5 Run smoke tests
npm run test:smoke -- --env=production

# 4.6 Verify critical user flows
# - User login
# - Pick submission
# - Dashboard load
# - Discord bot response
```

### Step 5: Monitor Stability

```bash
# Monitor for 15 minutes
watch -n 30 'curl -s https://api.unit-talk.com/health && \
  kubectl get pods -n unit-talk -l app=unit-talk-api'

# Check Grafana dashboards
# - SLO Dashboard: http://grafana.unit-talk.com/d/slo-dashboard
# - API Performance: http://grafana.unit-talk.com/d/api-performance

# Monitor logs for errors
kubectl logs -n unit-talk -l app=unit-talk-api -f | grep -i error
```

---

## Communication

### Step 6: Update Stakeholders

#### During Incident

```bash
# Provide updates every 15 minutes
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "🔄 API Outage Update - [TIME]",
    "blocks": [
      {
        "type": "section",
        "text": {"type": "mrkdwn", "text": "*Status:* MITIGATING\n*Root Cause:* [DESCRIPTION]\n*ETA to Resolution:* [TIME]\n*Current Actions:* [ACTIONS]"}
      }
    ]
  }'
```

#### Resolution Announcement

```bash
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "✅ API Outage RESOLVED",
    "blocks": [
      {
        "type": "section",
        "text": {"type": "mrkdwn", "text": "*Status:* RESOLVED\n*Duration:* [MINUTES] minutes\n*Root Cause:* [SUMMARY]\n*Resolution:* [ACTIONS TAKEN]\n*Post-Mortem:* Scheduled for [DATE]"}
      }
    ]
  }'
```

---

## Post-Incident

### Step 7: Document and Learn

#### Incident Timeline

```markdown
| Time | Event |
|------|-------|
| T+0  | Alert fired |
| T+2  | Incident acknowledged |
| T+5  | Root cause identified |
| T+10 | Fix applied |
| T+15 | Service restored |
| T+30 | Monitoring confirmed stable |
```

#### Incident Report Template

```markdown
# Incident Report: API Outage [DATE]

## Summary
- **Incident ID:** INC-[NUMBER]
- **Severity:** 1 (Critical)
- **Duration:** [MINUTES] minutes
- **MTTR:** [MINUTES] minutes
- **MTTD:** [MINUTES] minutes

## Impact
- **Users Affected:** [NUMBER or PERCENTAGE]
- **Revenue Impact:** $[AMOUNT]
- **SLO Impact:** [PERCENTAGE] availability loss

## Root Cause
[DETAILED EXPLANATION]

## Timeline
[DETAILED TIMELINE]

## Resolution
[ACTIONS TAKEN]

## Contributing Factors
1. [Factor 1]
2. [Factor 2]

## Action Items
1. [ ] [Action item 1] - Owner: [NAME] - Due: [DATE]
2. [ ] [Action item 2] - Owner: [NAME] - Due: [DATE]

## Lessons Learned
- **What went well:**
  - [Item 1]

- **What could be improved:**
  - [Item 1]

## Prevention
- [Preventive measure 1]
- [Preventive measure 2]
```

---

## Prevention

### Monitoring Improvements

```yaml
# Add custom alert for pod crash loops
- alert: PodCrashLoop
  expr: rate(kube_pod_container_status_restarts_total{namespace="unit-talk"}[15m]) > 0.05
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Pod crash loop detected"
    runbook_url: "https://docs.unit-talk.com/runbooks/api-outage"
```

### Automated Recovery

```bash
# Implement liveness and readiness probes
kubectl patch deployment unit-talk-api-green -n unit-talk -p '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "api",
          "livenessProbe": {
            "httpGet": {"path": "/health", "port": 3000},
            "initialDelaySeconds": 30,
            "periodSeconds": 10,
            "failureThreshold": 3
          },
          "readinessProbe": {
            "httpGet": {"path": "/health", "port": 3000},
            "initialDelaySeconds": 10,
            "periodSeconds": 5,
            "failureThreshold": 2
          }
        }]
      }
    }
  }
}'
```

### Chaos Engineering

```bash
# Regular chaos testing to validate resilience
./scripts/chaos/pod-failure.sh --target api --namespace unit-talk
```

---

## Escalation

### When to Escalate

- Unable to identify root cause within 15 minutes
- Unable to restore service within 30 minutes
- Data loss or corruption suspected
- Security breach suspected

### Escalation Path

1. **Level 1:** On-call engineer (0-5 min)
2. **Level 2:** Engineering manager (15 min)
3. **Level 3:** CTO/VP Engineering (30 min)
4. **Level 4:** CEO + legal (data breach/critical outage)

### External Support

- **Supabase Support:** support@supabase.io
- **AWS Support:** AWS Console → Support Center
- **Discord Support:** developer portal
- **Stripe Support:** dashboard → support

---

## Related Runbooks

- [Database Failover](DB_FAILOVER.md) - For database-related outages
- [Redis Loss](REDIS_LOSS.md) - For Redis cache outages
- [Webhook Failure](WEBHOOK_FAILURE.md) - For integration issues
- [Stripe Errors](STRIPE_ERROR.md) - For payment processing issues

---

## Appendix

### Useful Commands Cheat Sheet

```bash
# Quick status check
kubectl get pods -n unit-talk && curl https://api.unit-talk.com/health

# View all errors in last 10 minutes
kubectl logs -n unit-talk -l app=unit-talk-api --since=10m | grep -i error

# Emergency rollback
./scripts/blue-green/rollback.sh && ./scripts/blue-green/route-traffic.sh blue 100

# Scale up immediately
kubectl scale deployment unit-talk-api-green --replicas=5 -n unit-talk

# Restart all pods
kubectl rollout restart deployment/unit-talk-api-green -n unit-talk

# Check all agent health
curl https://api.unit-talk.com/api/v1/health/agents | jq '.'
```

---

**Runbook Version:** 1.0
**Last Tested:** [DATE]
**Test Frequency:** Quarterly
**Next Test:** [DATE]
