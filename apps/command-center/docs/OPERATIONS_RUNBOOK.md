# Unit Talk Command Center - Operations Runbook

**Version**: 1.0.0  
**Last Updated**: January 2025  
**Classification**: Internal Operations Manual  
**Target Audience**: DevOps Engineers, Site Reliability Engineers, On-Call Personnel

## 🚨 Emergency Contacts & Escalation

### Severity Levels
- **Critical (P0)**: Revenue-impacting, security breach, complete system outage
- **High (P1)**: Significant functionality broken, SLO violations, high error rates
- **Medium (P2)**: Minor functionality issues, performance degradation
- **Low (P3)**: Cosmetic issues, non-urgent improvements

### On-Call Escalation
1. **Primary On-Call**: Engineering Lead (Response: 15 minutes)
2. **Secondary On-Call**: Senior Engineer (Response: 30 minutes)
3. **Executive Escalation**: CTO (Response: 1 hour for P0/P1)

## 📊 Service Level Objectives (SLOs)

### Core SLOs
| Service | SLO | Error Budget | Fast Burn | Slow Burn |
|---------|-----|-------------|-----------|-----------|
| API Response Time | <200ms (95th percentile) | 5% | 14.4x | 1.0x |
| System Uptime | 99.9% | 0.1% | 14.4x | 1.0x |
| Grading Pipeline | <5min lag (95th percentile) | 5% | 14.4x | 1.0x |
| Database Response | <50ms (95th percentile) | 2% | 14.4x | 1.0x |
| Temporal Success Rate | 99.5% | 0.5% | 14.4x | 1.0x |

### SLO Violation Response
1. **Immediate**: Check SLO Status Widget in Command Center
2. **Within 5 minutes**: Review burn-rate alerts and determine severity
3. **Within 15 minutes**: Begin incident response procedure
4. **Within 30 minutes**: Notify stakeholders and provide status update

## 🔥 Incident Response Procedures

### Step 1: Incident Detection
**Automatic Detection**:
- SLO burn-rate alerts (>14.4x fast burn or >1.0x slow burn)
- Exposure risk alerts (Kelly at risk >20%, correlation violations)
- Temporal missed schedules (>10 minutes late)
- System health alerts (uptime <99%, error rate >1%)

**Manual Detection**:
- User reports via Discord/Slack
- Monitoring dashboard alerts
- Performance degradation observations

### Step 2: Initial Assessment (0-5 minutes)
```bash
# Quick health check commands
curl -s https://api.unittalk.com/health | jq
curl -s https://command-center.unittalk.com/api/temporal/summary | jq
```

**Assessment Checklist**:
- [ ] System uptime and error rates
- [ ] Database connection health
- [ ] Temporal workflow status
- [ ] API response times
- [ ] Current exposure levels

### Step 3: Classification & Response (5-15 minutes)

#### P0 - Critical Incidents
**Symptoms**: Complete system outage, security breach, revenue impact
**Response Time**: <15 minutes
**Actions**:
1. Activate Safe Mode via Command Center Admin panel
2. Page primary and secondary on-call
3. Create incident channel: `#incident-YYYYMMDD-HHMMSS`
4. Begin status page updates

#### P1 - High Severity
**Symptoms**: SLO violations, major functionality broken, high error rates
**Response Time**: <30 minutes
**Actions**:
1. Assess impact scope using Command Center dashboards
2. Consider Safe Mode if exposure risk is elevated
3. Notify engineering team
4. Begin root cause investigation

#### P2/P3 - Medium/Low Severity
**Response Time**: <1 hour
**Actions**:
1. Create ticket for investigation
2. Monitor for escalation
3. Schedule fix during next maintenance window

### Step 4: Safe Mode & System Controls

#### Activating Safe Mode
**When to Use**: High exposure, SLO violations, system instability
**Effect**: Forces S-tier picks only, +2% EV boost, mutes teasers/combos

```bash
# Via Command Center Admin Panel:
# 1. Navigate to Admin Controls
# 2. Click "Enable Safe Mode"
# 3. Provide reason and estimated duration
# 4. Confirm activation

# Via API (emergency):
curl -X POST https://command-center.unittalk.com/api/admin/safe-mode \
  -H "Content-Type: application/json" \
  -H "x-user-id: oncall-engineer" \
  -d '{"enable": true, "reason": "P1 incident response"}'
```

#### System Freeze
**When to Use**: Critical bugs, data corruption risk, emergency maintenance
**Effect**: Stops publishing while maintaining grading

```bash
# Via Command Center Admin Panel or API
curl -X POST https://command-center.unittalk.com/api/admin/freeze \
  -H "Content-Type: application/json" \
  -H "x-user-id: oncall-engineer" \
  -d '{"enable": true, "reason": "Emergency maintenance", "estimated_duration": "1 hour"}'
```

### Step 5: Investigation & Mitigation

#### Key Investigation Resources
1. **Command Center Dashboards**:
   - SLO Status Widget: Real-time SLO health and incidents
   - Exposure Risk Widget: Kelly at risk, correlation clusters
   - Temporal Health Widget: Workflow execution monitoring

2. **OpenTelemetry Traces**:
   - Access via `/api/telemetry/traces` endpoint
   - Filter by business context: `unit_talk.business_context`
   - Look for golden prop workflow traces

3. **Database Investigation**:
   ```sql
   -- Recent errors
   SELECT * FROM audit_log 
   WHERE status = 'failure' 
     AND created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC;

   -- SLO incidents
   SELECT * FROM slo_incidents 
   WHERE status = 'open' 
   ORDER BY created_at DESC;

   -- Temporal health
   SELECT * FROM temporal_workflow_health 
   WHERE status = 'failed' 
     AND created_at > NOW() - INTERVAL '1 hour';
   ```

4. **Log Analysis**:
   ```bash
   # Application logs
   docker logs command-center --tail 100 --follow

   # System metrics
   docker exec command-center curl -s localhost:3000/api/monitoring/metrics | jq
   ```

### Step 6: Resolution & Recovery

#### Recovery Validation Checklist
- [ ] SLO burn rates back to normal (<1.0x)
- [ ] Error rates below thresholds
- [ ] All Temporal workflows executing successfully  
- [ ] Exposure levels within acceptable ranges
- [ ] End-to-end functionality tests passing

#### Post-Resolution Actions
1. **Disable Emergency Modes**:
   - Deactivate Safe Mode
   - Disable System Freeze
   - Verify normal operations resumed

2. **Audit Trail Review**:
   - Check audit_log for all admin actions
   - Verify proper authorization was used
   - Document any manual interventions

3. **Stakeholder Communication**:
   - Update incident channel with resolution
   - Notify affected users if applicable
   - Update status page

## 🔍 Common Issues & Solutions

### High Exposure Risk
**Symptoms**: Kelly at risk >20%, correlation violations
**Diagnosis**: Check Exposure Risk Widget for auto-remediation recommendations
**Solution**:
```bash
# Execute suggested remediation via Command Center UI
# Or manually adjust pick sizing/tiers via admin controls
```

### Temporal Workflow Failures
**Symptoms**: Failed workflows, stuck executions, missed schedules
**Diagnosis**: Check Temporal Health Widget and `/api/temporal/missed-schedules`
**Solutions**:
```bash
# Restart stuck workflows
curl -X POST https://api.unittalk.com/temporal/workflows/restart \
  -d '{"workflow_ids": ["stuck-workflow-id"]}'

# Check schedule health
curl https://command-center.unittalk.com/api/temporal/missed-schedules?threshold=10
```

### Database Performance Issues
**Symptoms**: Query timeouts, high response times
**Diagnosis**: Check `vw_queue_backlog` and `vw_grading_lag` views
**Solutions**:
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
WHERE mean_exec_time > 1000 
ORDER BY mean_exec_time DESC;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE schemaname = 'public' 
ORDER BY n_distinct DESC;
```

### API Performance Degradation
**Symptoms**: High response times, timeouts
**Diagnosis**: Check system_metrics and API traces
**Solutions**:
1. Scale up API containers
2. Enable query caching
3. Review N+1 query patterns
4. Check database connection pools

## 🔧 Maintenance Procedures

### Scheduled Maintenance
**Frequency**: Weekly during off-peak hours (Sunday 2-4 AM UTC)
**Duration**: 2 hours maximum

#### Pre-Maintenance Checklist
- [ ] Notify users 48 hours in advance
- [ ] Create maintenance branch
- [ ] Run full test suite
- [ ] Backup database
- [ ] Document rollback plan

#### Maintenance Steps
1. **Enable Maintenance Mode**:
   ```bash
   curl -X POST https://command-center.unittalk.com/api/admin/freeze \
     -d '{"enable": true, "reason": "Scheduled maintenance"}'
   ```

2. **Apply Updates**:
   - Database migrations
   - Application deployments
   - Infrastructure changes

3. **Validation**:
   - Run smoke tests
   - Verify SLO compliance
   - Check audit logs

4. **Resume Operations**:
   ```bash
   curl -X POST https://command-center.unittalk.com/api/admin/freeze \
     -d '{"enable": false, "reason": "Maintenance complete"}'
   ```

### Database Migrations
**Location**: `migrations/006_fortune100_slo_monitoring.sql`
**Verification**: 
```sql
-- Check migration status
SELECT * FROM schema_migrations ORDER BY version DESC;

-- Validate new tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('system_metrics', 'slos', 'slo_incidents');
```

## 📈 Performance Tuning

### Database Optimization
```sql
-- Update statistics
ANALYZE;

-- Vacuum tables
VACUUM ANALYZE system_metrics;
VACUUM ANALYZE exposure_snapshots;

-- Check index usage
SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch 
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;
```

### Cache Management
```typescript
// Clear Redis cache if performance degrades
import { redis } from '@/lib/redis';
await redis.flushall();
```

### Temporal Optimization
- Monitor queue depths via Temporal Health Widget
- Scale workers based on backlog size
- Adjust retry policies for failed workflows
- Review workflow timeouts and heartbeats

## 🛡️ Security Procedures

### Access Control
- All admin actions require RBAC permissions (ADMIN role)
- Audit logging for all sensitive operations
- Session monitoring via audit_log table

### Security Incident Response
1. **Detect**: Security alerts, unauthorized access, data anomalies
2. **Contain**: Enable Safe Mode, freeze publishing if needed
3. **Investigate**: Check audit_log for suspicious activities
4. **Recover**: Patch vulnerabilities, reset credentials if compromised
5. **Learn**: Post-incident security review and improvements

### Regular Security Tasks
- Weekly audit log review
- Monthly access control verification  
- Quarterly security assessment
- Annual penetration testing

## 📋 Runbook Validation

### Monthly Runbook Testing
- Test emergency contact procedures
- Validate Safe Mode activation/deactivation
- Verify monitoring alerting works
- Practice incident response scenarios

### Quarterly Reviews
- Update emergency contacts
- Review and adjust SLO thresholds
- Validate escalation procedures
- Update documentation based on lessons learned

---

**Document Owner**: Engineering Lead  
**Next Review Date**: Monthly on the 1st  
**Version History**:
- v1.0.0 - Initial Fortune-100 quality operations runbook