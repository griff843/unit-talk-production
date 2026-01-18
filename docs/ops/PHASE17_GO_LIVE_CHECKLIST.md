# Phase 17 - Go-Live & Post-Launch Stabilization Checklist

**Date:** 2025-01-25
**Phase:** Production Go-Live
**Estimated Duration:** 4-6 hours (initial deployment) + 30-day stabilization
**Deployment Method:** Blue-Green via GitHub Actions

---

## Pre-Go-Live Checklist

### T-72 Hours: Final Preparation

#### Stakeholder Communication

- [ ] **Executive approval obtained** for production deployment
- [ ] **Customer communication** prepared and scheduled
  - Maintenance window notification (if needed)
  - New feature announcements
  - Support contact information
- [ ] **Internal team briefing** completed
  - Engineering team
  - Customer success team
  - Executive leadership
- [ ] **Go/No-Go meeting** scheduled (T-24 hours)

#### Team Coordination

- [ ] **War room established**
  - Slack channel: #production-deployment
  - Video call link: _____________________
  - Incident management tool: _____________________
- [ ] **On-call engineers assigned**
  - Primary on-call: _____________________
  - Secondary on-call: _____________________
  - Database specialist: _____________________
  - Network engineer: _____________________
- [ ] **Escalation paths documented**
  - Level 1: On-call engineer
  - Level 2: Engineering manager
  - Level 3: CTO/VP Engineering
  - Level 4: CEO (critical outages only)

#### Infrastructure Readiness

- [ ] **Phase 16 staging validation** complete
  - All acceptance tests passing
  - Performance benchmarks met
  - Security audit complete
  - Load testing successful
- [ ] **Production environment verified**
  ```bash
  # Check cluster health
  kubectl get nodes
  kubectl get pods -n unit-talk --all-namespaces
  kubectl top nodes

  # Verify no pending alerts
  curl -s http://prometheus:9090/api/v1/alerts | jq '.data.alerts[] | select(.state=="firing")'
  ```
- [ ] **Database backup completed**
  ```bash
  # Supabase backup
  pg_dump -h <supabase-host> -U postgres -Fc unit_talk_production > backup-$(date +%Y%m%d-%H%M%S).dump

  # Verify backup integrity
  pg_restore --list backup-*.dump | head -20
  ```
- [ ] **Monitoring dashboards verified**
  - [ ] Grafana: https://grafana.unit-talk.com
  - [ ] Prometheus: http://prometheus:9090
  - [ ] Alertmanager: http://alertmanager:9093
  - [ ] Sentry error tracking
  - [ ] DataDog APM (if applicable)

#### Pre-Deployment Verification

- [ ] **Run pre-deployment verification suite**
  ```bash
  cd C:\Users\griff\OneDrive\Desktop\unit-talk-production-main
  npm run ops:verify
  ```
- [ ] **Record baseline metrics**
  - API p95 latency: _____ ms (Target: <150ms)
  - Database p95 latency: _____ ms (Target: <50ms)
  - Error rate: _____ % (Target: <0.5%)
  - Active users: _____
  - Request rate: _____ req/s
  - Pod count: _____
  - CPU usage: _____ %
  - Memory usage: _____ %

#### Rollback Preparation

- [ ] **Rollback plan documented** (see Rollback Procedures section)
- [ ] **Rollback script tested** in staging
  ```bash
  # Test rollback script
  ./scripts/blue-green/rollback.sh --dry-run
  ```
- [ ] **Database rollback strategy** confirmed
  - Migration rollback scripts tested
  - Point-in-time recovery verified
  - Backup restoration time: _____ minutes
- [ ] **Traffic rollback time** estimated: _____ minutes

---

## T-24 Hours: Go/No-Go Decision

### Go/No-Go Criteria

#### Technical Criteria (All Must Pass)

- [ ] **Phase 16 staging** - All tests passing
- [ ] **Infrastructure health** - 100% healthy nodes and pods
- [ ] **Database performance** - Latency within SLO
- [ ] **Security scans** - No critical vulnerabilities
- [ ] **Load testing** - Meets production capacity requirements
- [ ] **Backup verification** - Successful backup and restore test

#### Business Criteria

- [ ] **Customer impact** - Acceptable maintenance window (if needed)
- [ ] **Support readiness** - Team trained and available
- [ ] **Communication** - Stakeholders informed
- [ ] **Risk assessment** - Acceptable risk level

#### Environmental Criteria

- [ ] **No major holidays** or peak usage periods
- [ ] **Business hours** deployment (for immediate support)
- [ ] **Weather/external factors** - No known infrastructure risks

### Go/No-Go Decision

**Decision:** [ ] GO [ ] NO-GO
**Approved By:** _____________________
**Date/Time:** _____________________
**Notes:** _____________________

---

## Go-Live Execution

### Phase 1: Pre-Deployment (T-0 to T+15 min)

#### T-0: Deployment Initiation

- [ ] **Start war room session**
- [ ] **Announce deployment start** in Slack
  ```bash
  curl -X POST $SLACK_WEBHOOK \
    -H 'Content-Type: application/json' \
    -d '{"text":"🚀 Phase 17 Production Deployment INITIATED - War room active"}'
  ```
- [ ] **Enable maintenance mode** (if required)
  ```bash
  kubectl scale deployment unit-talk-api-blue --replicas=0 -n unit-talk
  ```

#### T+0 to T+15: GitHub Actions Deployment

- [ ] **Trigger blue-green deployment workflow**
  - Navigate to: https://github.com/[org]/[repo]/actions/workflows/global-deploy.yml
  - Click "Run workflow"
  - Select inputs:
    - Environment: `production`
    - Mode: `green` (if blue is current)
    - Rollout: `5` (start with 5% canary)

- [ ] **Monitor deployment progress**
  ```bash
  # Watch GitHub Actions workflow
  gh run watch

  # Monitor pod rollout
  watch kubectl get pods -n unit-talk -l version=green
  ```

- [ ] **Verify pre-deployment checks pass**
  - [ ] Code compilation successful
  - [ ] Security scans pass
  - [ ] Database migrations applied successfully
  - [ ] Environment variables configured

- [ ] **Monitor deployment logs**
  ```bash
  # Terminal 1: Watch deployment
  kubectl rollout status deployment/unit-talk-api-green -n unit-talk

  # Terminal 2: Watch pod logs
  kubectl logs -n unit-talk -l app=unit-talk-api,version=green -f

  # Terminal 3: Watch HPA
  watch kubectl get hpa -n unit-talk
  ```

### Phase 2: Canary Deployment (T+15 to T+45 min)

#### T+15: 5% Traffic Canary

- [ ] **Verify green pods healthy**
  ```bash
  kubectl get pods -n unit-talk -l version=green
  kubectl describe pods -n unit-talk -l version=green | grep -A 5 "Conditions:"
  ```

- [ ] **Route 5% traffic to green**
  - Automated via GitHub Actions workflow
  - Verify canary ingress weight:
  ```bash
  kubectl get ingress unit-talk-api-ingress-canary -n unit-talk -o yaml | grep canary-weight
  ```

- [ ] **Monitor canary metrics (10 minutes)**
  - [ ] Error rate green vs blue: _____ % vs _____ %
  - [ ] Latency p95 green vs blue: _____ ms vs _____ ms
  - [ ] Response codes 2xx/4xx/5xx distribution
  - [ ] Memory/CPU usage comparison

  ```bash
  # Compare error rates
  curl -s 'http://prometheus:9090/api/v1/query?query=(sum(rate(http_requests_total{job="unit-talk-api",version="green",status=~"5.."}[5m]))/sum(rate(http_requests_total{job="unit-talk-api",version="green"}[5m])))*100'

  curl -s 'http://prometheus:9090/api/v1/query?query=(sum(rate(http_requests_total{job="unit-talk-api",version="blue",status=~"5.."}[5m]))/sum(rate(http_requests_total{job="unit-talk-api",version="blue"}[5m])))*100'
  ```

- [ ] **Check Sentry for new errors**
  - New error types in green: _____
  - Error frequency comparison: _____

- [ ] **Run smoke tests on green**
  ```bash
  npm run test:smoke -- --env=production --version=green
  ```

#### T+25: 25% Traffic Rollout

- [ ] **5% canary validation passed**
  - Error rate within SLO (< 0.5%)
  - Latency within SLO (p95 < 150ms)
  - No critical errors in Sentry
  - Smoke tests passing

- [ ] **Increase to 25% traffic**
  - Trigger workflow: Mode=green, Rollout=25
  - Or manually update:
  ```bash
  ./scripts/blue-green/route-traffic.sh green 25
  ```

- [ ] **Monitor 25% rollout (10 minutes)**
  - [ ] Error rate: _____ % (Target: <0.5%)
  - [ ] Latency p95: _____ ms (Target: <150ms)
  - [ ] Database connection pool: _____ % utilization
  - [ ] Redis hit rate: _____ %
  - [ ] HPA scaling behavior: _____ replicas

### Phase 3: Full Cutover (T+45 to T+60 min)

#### T+45: 100% Traffic Cutover

- [ ] **25% rollout validation passed**
  - All SLOs met for 10+ minutes
  - No anomalies detected
  - Team consensus to proceed

- [ ] **Execute full cutover**
  - Trigger workflow: Mode=green, Rollout=100
  - Or manually:
  ```bash
  ./scripts/blue-green/route-traffic.sh green 100
  ```

- [ ] **Verify 100% traffic on green**
  ```bash
  # Check ingress configuration
  kubectl get ingress -n unit-talk -o yaml | grep -A 2 "canary-weight"

  # Verify traffic distribution in Grafana
  # Dashboard: "Traffic Distribution by Version"
  ```

- [ ] **Monitor full cutover (15 minutes)**
  - [ ] Request rate: _____ req/s
  - [ ] Error rate: _____ % (Target: <0.5%)
  - [ ] Latency p50: _____ ms
  - [ ] Latency p95: _____ ms (Target: <150ms)
  - [ ] Latency p99: _____ ms (Target: <500ms)
  - [ ] Database latency p95: _____ ms (Target: <50ms)
  - [ ] Active WebSocket connections: _____
  - [ ] Queue depth: _____

### Phase 4: Validation & Cleanup (T+60 to T+90 min)

#### T+60: Post-Deployment Validation

- [ ] **Run full test suite**
  ```bash
  npm run test:e2e -- --env=production
  npm run test:integration -- --env=production
  npm run qa:smoke -- --env=production
  ```

- [ ] **Verify critical user flows**
  - [ ] User registration/login
  - [ ] Pick submission
  - [ ] Grading workflow
  - [ ] Analytics dashboard
  - [ ] Discord bot integration
  - [ ] Webhook delivery
  - [ ] Stripe payment processing

- [ ] **Check all agent health**
  ```bash
  curl https://api.unit-talk.com/health/agents | jq '.'

  # Verify in database
  SELECT agent_name, status, last_heartbeat
  FROM agent_health
  WHERE last_heartbeat > NOW() - INTERVAL '5 minutes';
  ```

- [ ] **Verify SLO compliance**
  - [ ] API latency SLO: [ ] PASS [ ] FAIL
  - [ ] Database latency SLO: [ ] PASS [ ] FAIL
  - [ ] Error rate SLO: [ ] PASS [ ] FAIL
  - [ ] Availability SLO: [ ] PASS [ ] FAIL

#### T+75: Blue Environment Cleanup

- [ ] **Verify green stability** (15+ minutes at 100%)
- [ ] **Scale down blue environment**
  ```bash
  kubectl scale deployment unit-talk-api-blue --replicas=1 -n unit-talk
  kubectl scale deployment unit-talk-command-center-blue --replicas=1 -n unit-talk
  kubectl scale deployment unit-talk-dashboard-blue --replicas=1 -n unit-talk
  kubectl scale deployment unit-talk-discord-bot-blue --replicas=1 -n unit-talk
  ```

- [ ] **Keep blue environment warm** for 24-hour observation period
- [ ] **Document deployment metrics**
  ```bash
  # Create deployment record
  cat > out/ops/production/deployment-$(date +%Y%m%d-%H%M%S).json <<EOF
  {
    "deployment_id": "phase17-$(date +%Y%m%d-%H%M%S)",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "version": "green",
    "commit_sha": "$(git rev-parse HEAD)",
    "status": "success",
    "rollout_duration_minutes": 75,
    "metrics": {
      "error_rate": "____%",
      "latency_p95": "____ms",
      "db_latency_p95": "____ms"
    }
  }
  EOF
  ```

---

## Post-Deployment Monitoring

### First 24 Hours: Critical Monitoring Period

#### Hour 1 (T+90 to T+150)

- [ ] **Monitor every 15 minutes**
  - Grafana SLO dashboard
  - Sentry error tracking
  - Alertmanager alerts
  - User feedback channels

- [ ] **Check metrics**
  - Error rate: _____
  - Latency p95: _____
  - Active users: _____
  - Database connections: _____
  - Redis memory usage: _____

#### Hours 2-4

- [ ] **Monitor every 30 minutes**
- [ ] **Review customer feedback**
  - Discord messages
  - Support tickets
  - Social media mentions

#### Hours 4-24

- [ ] **Monitor every 2 hours**
- [ ] **Capture baseline metrics** for 24-hour period
  ```bash
  # Export metrics to CSV
  ./scripts/ops/export-metrics.sh --start "24 hours ago" --end "now" > out/ops/production/24hr-baseline.csv
  ```

### 30-Day Stabilization Framework

#### Week 1: Daily Monitoring

- [ ] **Daily SLO review** at 10:00 AM
  - Review prior 24-hour metrics
  - Check for anomalies
  - Update incident log
  - Review error budget consumption

- [ ] **Daily standup** with on-call team
  - New issues identified
  - Ongoing incident updates
  - Improvement recommendations

- [ ] **Capture daily metrics**
  | Day | Error Rate | Latency P95 | Availability | Incidents |
  |-----|-----------|-------------|--------------|-----------|
  | 1   |           |             |              |           |
  | 2   |           |             |              |           |
  | 3   |           |             |              |           |
  | 4   |           |             |              |           |
  | 5   |           |             |              |           |
  | 6   |           |             |              |           |
  | 7   |           |             |              |           |

#### Week 2-4: Weekly Review

- [ ] **Weekly SLO report** (every Monday)
  - Week-over-week comparison
  - SLO compliance percentage
  - Error budget burn rate
  - Incident summary
  - Action items

- [ ] **Weekly retrospective** (every Friday)
  - What went well
  - What needs improvement
  - Action items for next week

#### 30-Day Checkpoint

- [ ] **Generate 30-day performance report**
  ```bash
  ./scripts/ops/generate-performance-report.sh --period 30days > out/ops/production/30day-report.md
  ```

- [ ] **Compare against Phase 16 baseline**
  - Latency delta: _____ % (Target: within 5%)
  - Error rate delta: _____ % (Target: within 5%)
  - Availability: _____ % (Target: >99.5%)

- [ ] **Executive review meeting**
  - Present performance data
  - Review incident summary
  - Discuss optimization opportunities
  - Get sign-off for Phase 17 completion

---

## Incident Response

### Severity Definitions

#### Severity 1 (Critical)
- Complete service outage
- Data loss or corruption
- Security breach
- Response time: **Immediate**
- Escalation: All hands

#### Severity 2 (High)
- Partial service degradation
- SLO violation (>5% over target)
- Critical feature unavailable
- Response time: **15 minutes**
- Escalation: On-call + manager

#### Severity 3 (Medium)
- Minor service degradation
- SLO approaching threshold
- Non-critical feature issue
- Response time: **1 hour**
- Escalation: On-call engineer

#### Severity 4 (Low)
- Cosmetic issues
- Performance optimization needed
- Response time: **Next business day**
- Escalation: Team discretion

### Incident Workflow

1. **Detection**
   - Alert fires in Alertmanager
   - User report
   - Proactive monitoring

2. **Acknowledgment**
   - On-call engineer acknowledges (< target response time)
   - Create incident ticket
   - Notify stakeholders

3. **Investigation**
   - Follow relevant runbook
   - Gather diagnostic data
   - Identify root cause

4. **Resolution**
   - Apply fix or rollback
   - Verify resolution
   - Update incident ticket

5. **Post-Mortem**
   - Document timeline
   - Identify contributing factors
   - Create action items
   - Share learnings

### Runbook Index

Critical runbooks available in `docs/ops/RUNBOOKS/`:

- [API Outage](RUNBOOKS/API_OUTAGE.md)
- [Database Failover](RUNBOOKS/DB_FAILOVER.md)
- [Redis Loss](RUNBOOKS/REDIS_LOSS.md)
- [Stripe Payment Errors](RUNBOOKS/STRIPE_ERROR.md)
- [Webhook Delivery Failure](RUNBOOKS/WEBHOOK_FAILURE.md)

---

## Rollback Procedures

### Emergency Rollback (< 5 minutes)

#### Immediate Traffic Rollback

```bash
# Rollback to blue immediately
./scripts/blue-green/route-traffic.sh blue 100

# Verify rollback
kubectl get ingress -n unit-talk -o yaml | grep -A 2 "canary-weight"
curl https://api.unit-talk.com/health | jq '.version'
```

#### Verify Rollback Success

```bash
# Check error rate
curl -s 'http://prometheus:9090/api/v1/query?query=(sum(rate(http_requests_total{job="unit-talk-api",status=~"5.."}[5m]))/sum(rate(http_requests_total{job="unit-talk-api"}[5m])))*100'

# Check latency
curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,sum(rate(http_request_duration_seconds_bucket{job="unit-talk-api"}[5m]))by(le))*1000'
```

### Database Rollback

#### Rollback Migrations

```bash
# Check current migration version
npm run db:status

# Rollback to previous version
npm run db:rollback

# Verify rollback
npm run db:status
```

#### Point-in-Time Recovery (if needed)

```bash
# Supabase point-in-time recovery
# Contact Supabase support or use dashboard
# Specify recovery time: _____________________
```

### Full Environment Rollback

```bash
# Scale down green
kubectl scale deployment unit-talk-api-green --replicas=0 -n unit-talk
kubectl scale deployment unit-talk-command-center-green --replicas=0 -n unit-talk
kubectl scale deployment unit-talk-dashboard-green --replicas=0 -n unit-talk
kubectl scale deployment unit-talk-discord-bot-green --replicas=0 -n unit-talk

# Scale up blue
kubectl scale deployment unit-talk-api-blue --replicas=3 -n unit-talk
kubectl scale deployment unit-talk-command-center-blue --replicas=2 -n unit-talk
kubectl scale deployment unit-talk-dashboard-blue --replicas=2 -n unit-talk
kubectl scale deployment unit-talk-discord-bot-blue --replicas=1 -n unit-talk

# Route all traffic to blue
./scripts/blue-green/route-traffic.sh blue 100
```

---

## Success Metrics

### SLO Targets

| Metric | Target | Measurement Period |
|--------|--------|-------------------|
| API Latency (p95) | < 150ms | 5-minute rolling |
| API Latency (p99) | < 500ms | 5-minute rolling |
| Database Latency (p95) | < 50ms | 5-minute rolling |
| Error Rate | < 0.5% | 5-minute rolling |
| Availability | > 99.5% | 30-day window |

### Operational Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Deployment Duration | < 90 min | _____ | [ ] PASS [ ] FAIL |
| Rollout Success Rate | 100% | _____ | [ ] PASS [ ] FAIL |
| Zero-Downtime Achievement | Yes | _____ | [ ] PASS [ ] FAIL |
| Incident Count (24hr) | 0 | _____ | [ ] PASS [ ] FAIL |
| MTTR (if incidents) | < 30 min | _____ | [ ] PASS [ ] FAIL |
| MTTD (if incidents) | < 5 min | _____ | [ ] PASS [ ] FAIL |

### Business Metrics

| Metric | Baseline | Post-Deployment | Delta |
|--------|----------|-----------------|-------|
| Active Users | _____ | _____ | _____ |
| Pick Submissions/day | _____ | _____ | _____ |
| API Requests/day | _____ | _____ | _____ |
| User Retention | _____% | _____% | _____% |
| Customer Support Tickets | _____ | _____ | _____ |

---

## Communication Templates

### Pre-Deployment Announcement

```
Subject: Scheduled Production Deployment - Phase 17

Team,

We will be deploying Phase 17 to production on [DATE] at [TIME] [TIMEZONE].

Deployment Window: [START] - [END]
Expected Downtime: None (blue-green deployment)
Rollback Window: [TIME]

New Features:
- [Feature 1]
- [Feature 2]
- [Feature 3]

Monitoring:
- War room: #production-deployment
- Status page: https://status.unit-talk.com

On-Call Team:
- Primary: [NAME]
- Secondary: [NAME]

Please ensure you are available during the deployment window.

[YOUR NAME]
Release Engineer
```

### Post-Deployment Success

```
Subject: Phase 17 Deployment - SUCCESS ✅

Team,

Phase 17 has been successfully deployed to production.

Deployment Summary:
- Start Time: [TIME]
- End Time: [TIME]
- Duration: [DURATION]
- Rollout: Blue → Green (100%)
- Incidents: 0

Metrics (first hour):
- Error Rate: [X]% (Target: <0.5%) ✅
- Latency p95: [X]ms (Target: <150ms) ✅
- Availability: [X]% (Target: >99.5%) ✅

Monitoring:
- 24-hour critical monitoring period active
- On-call team monitoring all systems
- Next checkpoint: [TIME]

Thank you to everyone involved!

[YOUR NAME]
Release Engineer
```

### Post-Deployment Issues

```
Subject: Phase 17 Deployment - ISSUES DETECTED ⚠️

Team,

Phase 17 deployment completed but issues detected.

Issue Summary:
- [Issue 1]
- [Issue 2]

Impact:
- Severity: [1-4]
- Affected Users: [NUMBER or PERCENTAGE]
- Current Status: [INVESTIGATING/MITIGATING/RESOLVED]

Actions Taken:
- [Action 1]
- [Action 2]

Next Steps:
- [Step 1]
- [Step 2]

Rollback Decision: [PROCEEDING/EVALUATING/EXECUTED]

War room active: #production-incident

[YOUR NAME]
Incident Commander
```

---

## Final Sign-Off

### Pre-Deployment Approval

**Approved By:**
- [ ] CTO/VP Engineering: _____________________ Date: _____
- [ ] Platform SRE Lead: _____________________ Date: _____
- [ ] Database Lead: _____________________ Date: _____
- [ ] Security Lead: _____________________ Date: _____

### Post-Deployment Sign-Off

**24-Hour Stability Achieved:**
- [ ] All SLOs met for 24 hours
- [ ] Zero critical incidents
- [ ] Customer feedback positive
- [ ] Monitoring dashboards healthy

**Signed:**
- [ ] Release Engineer: _____________________ Date: _____
- [ ] On-Call Primary: _____________________ Date: _____
- [ ] Engineering Manager: _____________________ Date: _____

**30-Day Stabilization Complete:**
- [ ] Performance report generated
- [ ] SLOs met >95% of time
- [ ] All action items addressed
- [ ] Executive review completed

**Signed:**
- [ ] CTO/VP Engineering: _____________________ Date: _____
- [ ] Product Lead: _____________________ Date: _____

---

## Appendix

### Useful Commands Reference

```bash
# Health checks
kubectl get pods -n unit-talk
kubectl top nodes
kubectl top pods -n unit-talk
curl https://api.unit-talk.com/health

# Metrics queries
curl -s 'http://prometheus:9090/api/v1/query?query=up{job="unit-talk-api"}'
curl -s https://api.unit-talk.com/metrics | grep http_request_duration

# Logs
kubectl logs -n unit-talk -l app=unit-talk-api --tail=100
kubectl logs -n unit-talk deployment/unit-talk-api-green -f

# Traffic routing
./scripts/blue-green/route-traffic.sh green 5
./scripts/blue-green/route-traffic.sh green 25
./scripts/blue-green/route-traffic.sh green 100

# Database
npm run db:status
npm run db:migrate
npm run db:rollback

# Testing
npm run test:smoke
npm run test:e2e
npm run qa:local
```

### Contact Information

**Engineering Team**
- Release Engineer: _____________________
- On-Call Primary: _____________________
- On-Call Secondary: _____________________
- Database Lead: _____________________
- Platform SRE: _____________________

**Emergency Escalation**
- Engineering Manager: _____________________
- CTO/VP Engineering: _____________________
- CEO (Critical Only): _____________________

**External Contacts**
- Supabase Support: _____________________
- AWS Support: _____________________
- Stripe Support: _____________________
- Discord Support: _____________________

---

**Document Version:** 1.0
**Last Updated:** 2025-01-25
**Next Review:** Post-Phase 17 completion
**Owner:** Platform SRE Team
