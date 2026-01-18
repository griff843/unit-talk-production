# On-Call Schedule Template

**Phase:** Phase 17 - Go-Live & Stabilization
**Last Updated:** 2025-01-25
**Owner:** Platform SRE Team

---

## Overview

This document establishes the on-call rotation schedule, responsibilities, and escalation procedures for the Unit Talk production environment during Phase 17 go-live and the 30-day stabilization period.

### On-Call Tiers

- **Tier 1 (Primary)**: First responder, handles all incoming incidents
- **Tier 2 (Secondary)**: Backup for Tier 1, specialized support
- **Tier 3 (Manager)**: Escalation point for complex issues
- **Tier 4 (Executive)**: Critical outages, data breaches, legal issues

---

## 30-Day Rotation Schedule

### Week 1: Go-Live (High Alert)

**Days 1-7 following deployment**

| Day | Date | Primary (Tier 1) | Secondary (Tier 2) | Manager (Tier 3) | Notes |
|-----|------|------------------|-------------------|-----------------|-------|
| D+0 | _____| _______________  | _______________   | _______________ | Go-Live Day (24/7 coverage) |
| D+1 | _____| _______________  | _______________   | _______________ | Critical monitoring continues |
| D+2 | _____| _______________  | _______________   | _______________ | |
| D+3 | _____| _______________  | _______________   | _______________ | |
| D+4 | _____| _______________  | _______________   | _______________ | |
| D+5 | _____| _______________  | _______________   | _______________ | Weekend coverage |
| D+6 | _____| _______________  | _______________   | _______________ | Weekend coverage |

**Coverage:** 24/7 (Primary + Secondary both on call)

### Week 2-4: Stabilization

**Days 8-30 following deployment**

| Week | Primary (Mon-Thu) | Primary (Fri-Sun) | Secondary | Manager |
|------|-------------------|-------------------|-----------|---------|
| 2    | _______________   | _______________   | _________ | _______ |
| 3    | _______________   | _______________   | _________ | _______ |
| 4    | _______________   | _______________   | _________ | _______ |

**Coverage:** 24/7 (Standard rotation)

---

## On-Call Responsibilities

### Primary On-Call (Tier 1)

**Response Time:** < 15 minutes for Severity 1-2

**Responsibilities:**
- Monitor PagerDuty/Alertmanager for incoming alerts
- Acknowledge all incidents within response time SLA
- Triage and assess incident severity
- Execute appropriate runbook procedures
- Escalate to Secondary if needed
- Document all incidents in incident management system
- Update stakeholders via Slack during incidents
- Complete post-incident reports

**Tools Required:**
- Laptop with kubectl/psql/redis-cli installed
- VPN access configured
- PagerDuty mobile app
- Slack mobile app
- Access to Grafana/Prometheus dashboards
- AWS/Kubernetes credentials

**Handoff Checklist:**
```markdown
## Daily Handoff Template

**Date:** _____________________
**Outgoing:** _____________________
**Incoming:** _____________________

### Current Status
- [ ] All systems healthy: YES / NO
- [ ] Active incidents: (list if any)
- [ ] Ongoing investigations: (list if any)
- [ ] Scheduled maintenance: (list if any)

### Past 24 Hours
- Incidents handled: _____
- SLO compliance: _____%
- Notable events: _____________________

### Upcoming 24 Hours
- Scheduled deployments: _____________________
- Known risks: _____________________
- Special monitoring: _____________________

### Action Items
- [ ] Follow up on incident INC-___
- [ ] Monitor memory usage trend
- [ ] Review slow query from DB

**Handoff Time:** _____________________
**Sign-off:** _____________________
```

### Secondary On-Call (Tier 2)

**Response Time:** < 30 minutes for Tier 1 escalations

**Responsibilities:**
- Provide backup for Primary on-call
- Handle escalated incidents requiring specialized knowledge
- Assist with complex troubleshooting
- Cover for Primary during breaks/emergencies
- Review and approve emergency changes
- Participate in incident post-mortems

**Specializations:**
- Database expert (Supabase/PostgreSQL)
- Network/Kubernetes expert
- Application domain expert
- Security specialist

### Manager On-Call (Tier 3)

**Response Time:** < 1 hour for executive escalations

**Responsibilities:**
- Approve emergency rollbacks
- Coordinate cross-team incident response
- Communicate with executive leadership
- Make go/no-go deployment decisions
- Authorize emergency infrastructure changes
- Lead major incident post-mortems

---

## Escalation Procedures

### Severity-Based Escalation

#### Severity 1 (Critical)
**Examples:** Complete outage, data loss, security breach

**Escalation Path:**
1. **T+0:** Primary acknowledges
2. **T+5:** Page Secondary
3. **T+15:** Page Manager if not resolved
4. **T+30:** Page VP Engineering
5. **T+60:** CEO notification (if ongoing)

**Communication:**
- Immediate Slack notification (#production-incident)
- PagerDuty alert to all tiers
- Status page update
- Executive email update every 30 minutes

#### Severity 2 (High)
**Examples:** Partial outage, SLO violation, critical feature down

**Escalation Path:**
1. **T+0:** Primary acknowledges
2. **T+15:** Consult with Secondary
3. **T+30:** Escalate to Manager if not resolved
4. **T+60:** Page VP Engineering

**Communication:**
- Slack notification (#production-incident)
- Hourly status updates
- Post-incident report within 24 hours

#### Severity 3 (Medium)
**Examples:** Degraded performance, non-critical feature issue

**Escalation Path:**
1. **T+0:** Primary acknowledges
2. **T+60:** Consult with Secondary if needed
3. **Next business day:** Report to Manager

**Communication:**
- Slack notification (#platform-sre)
- Daily summary in standup

#### Severity 4 (Low)
**Examples:** Cosmetic issues, minor bugs

**Escalation Path:**
- Create ticket for next sprint
- No immediate escalation

---

## Contact Information

### Engineering Team

| Name | Role | Tier | Phone | Email | Slack |
|------|------|------|-------|-------|-------|
| _____ | Primary On-Call | 1 | _____ | _____ | @_____ |
| _____ | Secondary On-Call | 2 | _____ | _____ | @_____ |
| _____ | Database Specialist | 2 | _____ | _____ | @_____ |
| _____ | Engineering Manager | 3 | _____ | _____ | @_____ |
| _____ | VP Engineering | 3 | _____ | _____ | @_____ |

### External Support

| Vendor | Support Type | Contact | SLA |
|--------|-------------|---------|-----|
| Supabase | Database | support@supabase.io | < 1 hour (Priority) |
| AWS | Infrastructure | AWS Support Portal | < 4 hours (Business) |
| Stripe | Payments | dashboard support | < 24 hours |
| Discord | Bot API | developer support | Best effort |

### Emergency Contacts

| Situation | Contact | Phone | Notes |
|-----------|---------|-------|-------|
| Data Breach | Security Lead + Legal | _____ | Immediate escalation |
| Major Outage (>2hr) | CEO | _____ | Business continuity |
| Legal Issue | General Counsel | _____ | Compliance/liability |
| PR/Media | Communications Lead | _____ | Public statements |

---

## On-Call Tools and Access

### Required Access

```bash
# Verify access before going on-call

# 1. Kubernetes cluster access
kubectl get nodes
# Should list all cluster nodes

# 2. Database access
psql "$DATABASE_URL" -c "SELECT 1;"
# Should return: 1

# 3. Redis access
kubectl exec -n unit-talk deployment/redis -- redis-cli ping
# Should return: PONG

# 4. Prometheus/Grafana
curl http://prometheus:9090/-/healthy
# Should return: Prometheus is Healthy

# 5. PagerDuty API
curl -H "Authorization: Token token=$PAGERDUTY_API_KEY" \
  https://api.pagerduty.com/oncalls
# Should list current on-call schedule

# 6. AWS CLI
aws sts get-caller-identity
# Should return your AWS identity
```

### On-Call Toolkit

**Local Environment Setup:**
```bash
# Clone runbooks repository
git clone https://github.com/unit-talk/platform-runbooks.git ~/runbooks

# Install on-call CLI tools
brew install kubectl awscli redis postgresql

# Configure kubectl contexts
kubectl config use-context unit-talk-production

# Set environment variables
export KUBECONFIG=~/.kube/config
export DATABASE_URL="<production-db-url>"
export SLACK_WEBHOOK="<slack-webhook-url>"
export PAGERDUTY_API_KEY="<pagerduty-api-key>"

# Test all tools
./runbooks/scripts/verify-oncall-setup.sh
```

**Bookmarks:**
- Grafana SLO Dashboard: http://grafana.unit-talk.com/d/slo-dashboard
- Prometheus Alerts: http://prometheus:9090/alerts
- PagerDuty Console: https://unit-talk.pagerduty.com
- Supabase Dashboard: https://app.supabase.com/project/<project-id>
- AWS Console: https://console.aws.amazon.com
- Runbook Index: https://docs.unit-talk.com/runbooks/

---

## Incident Management Workflow

### 1. Alert Received

```bash
# When PagerDuty fires an alert

# Step 1: Acknowledge in PagerDuty (mobile app or web)
# This stops the alert from escalating

# Step 2: Join incident Slack channel
# #production-incident

# Step 3: Post acknowledgment
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "🚨 Incident INC-XXXX acknowledged by @oncall",
    "blocks": [
      {
        "type": "section",
        "text": {"type": "mrkdwn", "text": "*Status:* INVESTIGATING\n*Severity:* [1-4]\n*Alert:* [Alert name]"}
      }
    ]
  }'
```

### 2. Initial Assessment

```bash
# Determine severity and impact

# Quick health check
curl https://api.unit-talk.com/health | jq '.'
kubectl get pods -n unit-talk
curl http://prometheus:9090/api/v1/alerts | jq '.data.alerts[] | select(.state=="firing")'

# Assess impact
# - Is the API responding?
# - Are users affected?
# - Is data at risk?
# - What's the error rate?
```

### 3. Execute Runbook

```bash
# Find appropriate runbook
ls ~/runbooks/

# Common runbooks:
# - API_OUTAGE.md
# - DB_FAILOVER.md
# - REDIS_LOSS.md
# - STRIPE_ERROR.md
# - WEBHOOK_FAILURE.md

# Follow runbook step-by-step
# Document all actions taken
```

### 4. Resolution and Communication

```bash
# When incident is resolved

# Post resolution message
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "✅ Incident INC-XXXX RESOLVED",
    "blocks": [
      {
        "type": "section",
        "text": {"type": "mrkdwn", "text": "*Status:* RESOLVED\n*Duration:* [X] minutes\n*Root Cause:* [Summary]\n*Resolution:* [Actions taken]"}
      }
    ]
  }'

# Resolve in PagerDuty

# Create incident report (within 24 hours)
```

---

## On-Call Compensation and Support

### Compensation

- **Weekday On-Call (Mon-Fri 5PM-9AM)**: $XXX per day
- **Weekend On-Call (Fri 5PM-Mon 9AM)**: $XXX per day
- **Incident Response (>1 hour)**: Comp time 1:1 or overtime pay
- **After-Hours Deployment**: 4 hours minimum comp time

### Support and Well-being

- **Maximum Consecutive Days**: 7 days
- **Minimum Time Off After**: 2 days
- **Incident Handoff**: If on-call >4 hours during incident, hand off to Secondary
- **Fatigue Protocol**: Swap with Secondary if overwhelmed
- **Mental Health**: Take breaks, don't hesitate to escalate

### On-Call Best Practices

1. **Stay Alert**: Avoid alcohol during on-call, stay near laptop
2. **Prepare**: Review runbooks before shift starts
3. **Communicate**: Over-communicate in Slack during incidents
4. **Document**: Write down everything during incidents
5. **Ask for Help**: Don't hesitate to escalate or ask Secondary
6. **Self-Care**: Get sleep, take breaks between incidents
7. **Handoff**: Proper handoff is critical for continuity

---

## Training and Onboarding

### New On-Call Engineer Checklist

- [ ] Complete runbook familiarization (all 5 runbooks)
- [ ] Shadow current on-call for 1 week
- [ ] Practice incident response in staging environment
- [ ] Verify access to all tools and dashboards
- [ ] Complete tabletop exercise (simulated incident)
- [ ] Review past incidents and post-mortems
- [ ] Set up PagerDuty and Slack on mobile device
- [ ] Configure local development environment
- [ ] Meet with Secondary and Manager on-call
- [ ] Sign acknowledgment of on-call responsibilities

### Quarterly Training

- **Runbook Updates**: Review changes to runbooks and procedures
- **New Features**: Training on newly deployed features
- **Incident Review**: Analysis of past quarter's incidents
- **Chaos Engineering**: Participation in quarterly chaos drills
- **Tool Updates**: New tools or dashboard changes

---

## Metrics and Reporting

### On-Call Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Mean Time to Acknowledge (MTTA) | < 5 min | PagerDuty analytics |
| Mean Time to Detect (MTTD) | < 5 min | Prometheus alert time |
| Mean Time to Resolve (MTTR) | < 30 min (Sev 1) | Incident reports |
| Escalation Rate | < 10% | Incident data |
| False Positive Rate | < 5% | Alert review |
| Incident Recurrence | < 5% | Post-mortem tracking |

### Weekly On-Call Report

```markdown
## Weekly On-Call Report

**Week of:** _____________________
**Primary On-Call:** _____________________
**Secondary On-Call:** _____________________

### Incident Summary
- Total Incidents: _____
- Severity 1: _____
- Severity 2: _____
- Severity 3: _____
- Severity 4: _____

### Response Times
- Average MTTA: _____ minutes
- Average MTTR: _____ minutes
- Escalations: _____ (____%)

### Top Issues
1. _____________________
2. _____________________
3. _____________________

### Action Items
- [ ] Update runbook for [issue]
- [ ] Add monitoring for [metric]
- [ ] Schedule maintenance for [component]

### Recommendations
- _____________________
- _____________________

**Submitted by:** _____________________
**Date:** _____________________
```

---

## Appendix

### Quick Reference Commands

```bash
# Health checks
curl https://api.unit-talk.com/health
kubectl get pods -n unit-talk
kubectl top nodes

# View logs
kubectl logs -n unit-talk -l app=unit-talk-api --since=10m

# Check alerts
curl http://prometheus:9090/api/v1/alerts | jq '.data.alerts[] | select(.state=="firing")'

# Database check
psql "$DATABASE_URL" -c "SELECT NOW();"

# Redis check
kubectl exec -n unit-talk deployment/redis -- redis-cli ping

# Emergency rollback
./scripts/blue-green/rollback.sh

# Scale pods
kubectl scale deployment unit-talk-api-green --replicas=5 -n unit-talk
```

### Slack Commands

```
/incident create severity:1 title:"API Outage"
/incident update INC-123 status:investigating
/incident resolve INC-123
/oncall who
/oncall schedule
```

---

**Document Version:** 1.0
**Last Updated:** 2025-01-25
**Next Review:** Monthly
**Owner:** Platform SRE Team
