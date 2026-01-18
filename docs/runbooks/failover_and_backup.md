# Failover & Backup Strategy

**Owner**: SRE Team + Infrastructure Lead
**Last Updated**: 2025-12-01
**Review Cadence**: Quarterly + After Major Incidents
**Phase**: Phase 3 - Disaster Recovery Planning

---

## Overview

This document outlines the disaster recovery, failover, and backup strategies for Unit Talk's critical systems. The goal is to minimize data loss (RPO) and downtime (RTO) in the event of catastrophic failures.

**Recovery Objectives**:
- **RTO** (Recovery Time Objective): < 1 hour for critical systems
- **RPO** (Recovery Point Objective): < 5 minutes of data loss

---

## Critical Components Inventory

### Tier 1: Critical (Cannot Operate Without)

| Component | Provider | Backup Strategy | Failover Strategy | RTO | RPO |
|-----------|----------|-----------------|-------------------|-----|-----|
| **Primary Database** | Supabase PostgreSQL | Continuous + Daily | Read replica | 15 min | 1 min |
| **Temporal Server** | Temporal Cloud | Built-in HA | Multi-region | 5 min | 0 |
| **Discord Bot** | Discord API | Stateless | Auto-restart | 2 min | 0 |

### Tier 2: Important (Degraded Operation Possible)

| Component | Provider | Backup Strategy | Failover Strategy | RTO | RPO |
|-----------|----------|-----------------|-------------------|-----|-----|
| **Redis Cache** | Redis Cloud | Periodic snapshots | Rebuild from DB | 30 min | 1 hour |
| **Prometheus Metrics** | Self-hosted | Weekly backups | Restart + rehydrate | 1 hour | 1 day |
| **File Storage (logos, etc.)** | S3/Supabase Storage | Versioned | Multi-region | 15 min | 0 |

### Tier 3: Non-Critical (Operational Data)

| Component | Provider | Backup Strategy | Failover Strategy | RTO | RPO |
|-----------|----------|-----------------|-------------------|-----|-----|
| **Logs** | CloudWatch/Loki | 90-day retention | N/A | N/A | N/A |
| **Grafana Dashboards** | Self-hosted | Git-backed JSON | Redeploy from Git | 30 min | 0 |

---

## Primary Database: Supabase PostgreSQL

### Backup Strategy

**Continuous Backups** (Point-in-Time Recovery):
- Enabled via Supabase Pro plan
- Retention: 7 days
- Recovery granularity: 1-second precision
- Storage: Supabase-managed AWS S3

**Daily Backups** (Long-term Retention):
- Automated via `pg_dump` cron job
- Schedule: 3:00 AM UTC daily
- Retention: 30 days
- Storage: External S3 bucket (separate AWS account)
- Encryption: AES-256 at rest

**Backup Command**:
```bash
# Manual backup (run from cron)
pg_dump "$DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  --file="backup_$(date +%Y%m%d_%H%M%S).dump"

# Upload to S3
aws s3 cp backup_*.dump s3://unittalk-db-backups/$(date +%Y/%m/)/
```

### Restore Strategy

**Point-in-Time Restore** (recent data loss):
```bash
# Via Supabase dashboard
# 1. Navigate to Database → Backups
# 2. Select timestamp (last known good state)
# 3. Click "Restore" → Confirm
# 4. Wait ~10 minutes for restore
# 5. Verify via /api/health endpoint
```

**Full Restore from pg_dump** (complete disaster):
```bash
# Download backup from S3
aws s3 cp s3://unittalk-db-backups/2025/12/01/backup.dump ./

# Restore to new Supabase project
pg_restore --verbose \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname="$NEW_DATABASE_URL" \
  backup.dump

# Update environment variables
# Update SUPABASE_URL and DATABASE_URL in all services

# Restart services
kubectl rollout restart deployment/api deployment/worker

# Verify
curl https://api.unittalk.ai/health
```

**Verification Steps**:
1. Run `SELECT COUNT(*) FROM picks` - compare with pre-failure count
2. Check latest `created_at` timestamp - verify no future data
3. Run E2E test suite
4. Verify Discord publishing working

### Failover Strategy

**Read Replica** (for read traffic):
- Supabase provides read replicas in different regions
- Configure via Supabase dashboard
- Update connection string for read-only queries

**Degraded Mode Operations**:
- If primary DB unreachable, API enters read-only mode
- New picks rejected with `503 Service Unavailable`
- Discord bot continues to post from outbox queue
- Grading workflows paused until DB restored

---

## Temporal Server

### Backup Strategy

**Built-in High Availability**:
- Temporal Cloud provides multi-region HA
- Automatic failover without manual intervention
- No additional backup required

**Workflow State**:
- Workflow histories stored in Temporal DB
- Automatic persistence and replication
- Survives Temporal server restarts

### Failover Strategy

**Temporal Unavailable** (degraded mode):
- API continues to accept picks (stored in DB)
- Workflows queued but not executing
- After Temporal recovery, workflows resume automatically
- No data loss due to durable workflow state

**Workflow Recovery**:
```typescript
// Workflows automatically resume after Temporal restart
// No manual intervention required

// To manually replay workflow if needed:
temporal workflow replay --workflow-id=lifecycle-abc123
```

---

## Discord Bot

### Backup Strategy

**Stateless Design**:
- Discord bot is completely stateless
- All state stored in database (`pick_publish` table)
- No backup required

### Failover Strategy

**Bot Unavailable** (auto-recovery):
- Kubernetes automatically restarts crashed pods
- Health check endpoint monitored
- Auto-restart on failure

**Discord API Outage**:
- Picks queued in `pick_publish` table (outbox pattern)
- Exponential backoff retry (1min, 5min, 15min)
- Circuit breaker prevents spam
- After Discord recovery, outbox worker processes queue

**Manual Restart**:
```bash
# Restart Discord bot
kubectl rollout restart deployment/discord-bot

# Check health
kubectl logs -f deployment/discord-bot

# Verify publishing
curl https://api.unittalk.ai/health | jq '.discord'
```

---

## Redis Cache

### Backup Strategy

**Periodic Snapshots** (RDB):
- Automated via Redis Cloud
- Schedule: Every 6 hours
- Retention: 7 days
- Storage: Redis Cloud managed

**AOF (Append-Only File)**:
- Enabled for durability
- Synced every second
- Trade-off: Performance vs durability

### Failover Strategy

**Redis Unavailable** (graceful degradation):
- API falls back to database for all queries
- Performance degraded but functional
- No data loss (cache is ephemeral)

**Cache Rebuild**:
```bash
# After Redis recovery, cache rebuilds automatically
# Warm up critical caches:
npm run cache:warm -- --keys=game_odds,player_props,canonical_entities
```

**Manual Intervention**:
- If Redis corrupted, flush and rebuild:
```bash
redis-cli FLUSHALL
npm run cache:warm
```

---

## Secrets Management

### Backup Strategy

**GitHub Secrets** (encrypted backups):
- Secrets stored in GitHub Actions Secrets
- Exported weekly to encrypted JSON file
- Stored in separate secure S3 bucket
- Access restricted to SRE team only

**Export Script**:
```bash
# Export secrets (requires GitHub PAT with repo:secrets scope)
npm run secrets:export -- --output=secrets_backup.json.enc

# Upload to secure S3
aws s3 cp secrets_backup.json.enc s3://unittalk-secrets-backup/$(date +%Y%m%d)/
```

### Recovery Strategy

**Secrets Lost** (manual restore):
```bash
# Download from S3
aws s3 cp s3://unittalk-secrets-backup/latest/ ./

# Decrypt
npm run secrets:decrypt -- --input=secrets_backup.json.enc

# Re-import to GitHub
npm run secrets:import -- --input=secrets_backup.json
```

---

## Disaster Recovery Scenarios

### Scenario 1: Complete Database Loss

**Trigger**: Supabase region failure, data corruption, accidental deletion

**Recovery Steps**:
1. **Assess** (5 minutes):
   - Verify database is truly inaccessible
   - Check Supabase status page
   - Determine RPO (how much data lost)

2. **Communicate** (immediate):
   - Post incident in #incidents channel
   - Page on-call SRE
   - Update status page

3. **Restore** (30 minutes):
   - Provision new Supabase project (if needed)
   - Restore from latest pg_dump backup
   - Apply any missing migrations
   - Update DNS/environment variables

4. **Verify** (15 minutes):
   - Run data integrity checks
   - Execute E2E test suite
   - Verify Discord publishing
   - Check SLO dashboards

5. **Resume** (immediate):
   - Enable write traffic
   - Resume Temporal workflows
   - Monitor closely for 24 hours

**Data Loss**:
- Best case: 0 (if point-in-time restore available)
- Worst case: Last daily backup (up to 24 hours)

---

### Scenario 2: Temporal Server Failure

**Trigger**: Temporal Cloud outage, workflow corruption

**Recovery Steps**:
1. **Assess** (5 minutes):
   - Check Temporal Cloud status
   - Verify workflow execution stopped

2. **Degrade Gracefully** (immediate):
   - API continues accepting picks
   - Workflows queued in database
   - Discord publishing continues from outbox

3. **Wait for Recovery** (variable):
   - Temporal Cloud auto-recovers
   - Workflows resume automatically
   - No manual intervention needed

4. **Verify** (10 minutes):
   - Check workflow executions resumed
   - Verify no failed workflows
   - Monitor workflow lag

**Data Loss**: None (durable workflow state)

---

### Scenario 3: Complete AWS Region Failure

**Trigger**: AWS us-east-1 outage (Supabase, Temporal, etc.)

**Recovery Steps**:
1. **Assess** (10 minutes):
   - Verify multi-service outage
   - Check AWS status page
   - Determine scope of failure

2. **Failover** (1 hour):
   - Switch DNS to standby region (if configured)
   - Restore database from backups to new region
   - Redeploy all services to different region
   - Update environment variables

3. **Partial Service** (2 hours):
   - Enable read-only mode first
   - Gradually enable writes
   - Monitor error rates closely

4. **Full Recovery** (4 hours):
   - All services operational in new region
   - Data synchronized
   - SLOs restored

**Data Loss**: Up to 5 minutes (continuous backup RPO)

---

## Backup Testing

### Monthly Backup Verification

**Automated Test** (runs 1st of each month):
```bash
#!/bin/bash
# Test backup restoration to separate test database

# 1. Download latest backup
aws s3 cp s3://unittalk-db-backups/latest/ ./backup.dump

# 2. Restore to test database
pg_restore --dbname="$TEST_DATABASE_URL" backup.dump

# 3. Run validation queries
psql "$TEST_DATABASE_URL" -c "SELECT COUNT(*) FROM picks"
psql "$TEST_DATABASE_URL" -c "SELECT MAX(created_at) FROM picks"

# 4. Run E2E tests against test database
TEST_DB=true npm run test:e2e

# 5. Report results
if [ $? -eq 0 ]; then
  echo "✅ Backup verification successful"
else
  echo "❌ Backup verification FAILED - alert SRE team"
  # Send alert to #sre-alerts
fi
```

### Quarterly Disaster Recovery Drill

**Full DR Drill** (runs quarterly):
1. Schedule drill during low-traffic window
2. Simulate complete production failure
3. Execute full DR playbook
4. Measure actual RTO/RPO
5. Document lessons learned
6. Update playbooks based on findings

**Metrics to Track**:
- Time to detection: ? minutes
- Time to decision: ? minutes
- Time to restore: ? minutes
- Total RTO: ? minutes
- Data loss (RPO): ? minutes

---

## Incident Response Integration

### Incident Severity → DR Actions

| Severity | Description | DR Action |
|----------|-------------|-----------|
| **P0** | Complete outage | Execute full DR playbook |
| **P1** | Partial outage | Evaluate failover necessity |
| **P2** | Degraded service | Monitor, prepare for failover |
| **P3** | Warning | No DR action |

### Postmortem Requirements

After any DR event:
1. Document timeline (detection → resolution)
2. Calculate actual RTO/RPO achieved
3. Identify gaps in DR plan
4. Update playbooks
5. Schedule drill of improved plan

---

## Monitoring DR Readiness

### Backup Health Metrics

**Prometheus Metrics**:
```yaml
# Backup freshness (how long since last successful backup)
backup_last_success_timestamp_seconds{component="database"}

# Backup size (for anomaly detection)
backup_size_bytes{component="database"}

# Backup success rate
backup_success_total{component="database"}
backup_failure_total{component="database"}
```

**Alerts**:
```yaml
- alert: BackupStale
  expr: |
    (time() - backup_last_success_timestamp_seconds{component="database"}) > 86400
  for: 1h
  labels:
    severity: P1
  annotations:
    summary: "Database backup is stale (>24 hours)"

- alert: BackupFailed
  expr: |
    rate(backup_failure_total{component="database"}[1h]) > 0
  labels:
    severity: P2
  annotations:
    summary: "Database backup failed"
```

---

## Contact Information

### On-Call Rotation

**Primary On-Call**: Check PagerDuty schedule
**Secondary On-Call**: Check PagerDuty schedule

**Escalation Path**:
1. On-Call SRE (immediate)
2. SRE Lead (if no response in 15 min)
3. VP Engineering (P0 incidents only)

### External Vendor Contacts

**Supabase Support**:
- Email: support@supabase.com
- Priority Support Portal: https://supabase.com/dashboard/support
- SLA: 1-hour response for P0 (Pro plan)

**Temporal Cloud Support**:
- Email: support@temporal.io
- Support Portal: https://temporal.io/support
- SLA: 30-min response for P0 (Enterprise plan)

**Discord Developer Support**:
- Developer Portal: https://discord.com/developers/applications
- Status: https://discordstatus.com

---

## Related Documentation

- [Production Charter](../PRODUCTION_CHARTER.md)
- [Deployment Runbook](./deployments.md)
- [SLO/SLI Overview](../ops/slo_sli_overview.md)

---

**Version**: 1.0
**Next Review**: 2025-03-01 (Quarterly)
**Next DR Drill**: 2025-03-15
