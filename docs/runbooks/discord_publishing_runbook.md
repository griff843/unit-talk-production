# Discord Publishing Runbook

## Overview

This runbook provides operational procedures for the Discord publishing pipeline, including troubleshooting, DLQ management, and emergency procedures.

**System**: Discord Publishing Pipeline
**Owner**: Platform Engineering Team
**On-Call**: platform-oncall@unittalk.com
**Last Updated**: 2025-01-15

## Quick Reference

| Issue | Severity | Response Time | Page |
|-------|----------|---------------|------|
| Publishing stopped | Critical | 15 min | [Publishing Stopped](#publishing-stopped) |
| High DLQ rate | High | 30 min | [High DLQ Rate](#high-dlq-rate) |
| Daily recap missing | Medium | 1 hour | [Daily Recap Issues](#daily-recap-issues) |
| Rate limiting excessive | Medium | 1 hour | [Excessive Rate Limiting](#excessive-rate-limiting) |
| Outbox backlog | Medium | 1 hour | [Outbox Backlog](#outbox-backlog) |

## Architecture Quick View

```
pick_publish → DiscordPublishingWorker → DiscordPublisher → Discord API
                        ↓ on failure                ↓ on permanent failure
                       DLQ ←─────────────────────── DLQ
```

## Common Issues

### Publishing Stopped

**Symptoms**:
- No messages appearing in Discord
- `discord_publish_outbox_pending` increasing
- `discord_publish_outbox_oldest_age_seconds > 600`

**Investigation**:

1. **Check Worker Status**:
   ```bash
   pm2 status discord-publishing-worker
   # or
   systemctl status discord-publishing-worker
   ```

2. **Check Worker Logs**:
   ```bash
   pm2 logs discord-publishing-worker --lines 100
   # Look for errors, crashes, or "unhealthy" status
   ```

3. **Check Health Endpoint**:
   ```bash
   curl http://localhost:3000/health | jq '.agents[] | select(.name == "DiscordPublishingWorker")'
   ```

4. **Check Discord Connection**:
   ```bash
   # Look for "Discord client connected" in logs
   pm2 logs discord-publishing-worker | grep "Discord"
   ```

**Common Causes & Fixes**:

| Cause | Fix |
|-------|-----|
| Worker crashed | `pm2 restart discord-publishing-worker` |
| Discord token expired | Update `DISCORD_TOKEN` env var + restart |
| Supabase connection lost | Check `SUPABASE_URL` / `SUPABASE_KEY` + restart |
| Circuit breaker tripped | Wait for auto-recovery or manual reset |

**Resolution Steps**:

1. **Restart Worker**:
   ```bash
   pm2 restart discord-publishing-worker
   ```

2. **Monitor Recovery**:
   ```bash
   watch -n 5 'curl -s http://localhost:3000/health | jq ".agents[] | select(.name == \"DiscordPublishingWorker\")"'
   ```

3. **Verify Publishing**:
   ```bash
   # Check that outbox pending is decreasing
   watch -n 5 'curl -s http://localhost:9090/metrics | grep discord_publish_outbox_pending'
   ```

4. **Check Discord**:
   - Verify messages appearing in Discord channels

### High DLQ Rate

**Symptoms**:
- `dlq_messages_in_dlq{source="discord_publisher"} > 100`
- `discord_publish_dlq_routed_total` rate increasing
- Many failed publishes in logs

**Investigation**:

1. **Check DLQ Summary**:
   ```sql
   SELECT
     error_message,
     error_code,
     COUNT(*) as count,
     MIN(created_at) as first_seen,
     MAX(created_at) as last_seen
   FROM dead_letter_queue
   WHERE source = 'discord_publisher'
   AND requeued_at IS NULL
   GROUP BY error_message, error_code
   ORDER BY count DESC
   LIMIT 10;
   ```

2. **Inspect Recent DLQ Entries**:
   ```sql
   SELECT *
   FROM dead_letter_queue
   WHERE source = 'discord_publisher'
   ORDER BY created_at DESC
   LIMIT 20;
   ```

3. **Check Failure Patterns**:
   ```promql
   # In Prometheus/Grafana
   rate(discord_publish_failure_total[5m]) by (error_type)
   ```

**Common Causes & Fixes**:

| Error Code | Cause | Fix |
|------------|-------|-----|
| `CHANNEL_NOT_FOUND` | Invalid channel ID | Update channel config |
| `403` | Missing permissions | Grant bot permissions |
| `429` | Sustained rate limiting | Review rate limits / increase delay |
| `503` | Discord API unavailable | Wait for Discord recovery |
| `ENOTFOUND` | Network/DNS issues | Check network connectivity |

**Resolution Steps**:

1. **Fix Root Cause** (based on error pattern)

2. **Replay DLQ Messages**:
   ```sql
   -- Mark for replay
   UPDATE dead_letter_queue
   SET
     requeued_at = NOW(),
     requeued_by = 'ops-[your-name]',
     replay_status = 'pending',
     metadata = metadata || '{"notes": "Replaying after fixing [issue]"}'::jsonb
   WHERE
     source = 'discord_publisher'
     AND requeued_at IS NULL
     AND error_code = '[error-code-to-fix]' -- Filter by specific error
   LIMIT 100; -- Start with small batch
   ```

3. **Monitor Replay**:
   ```sql
   -- Check replay status
   SELECT
     replay_status,
     COUNT(*) as count
   FROM dead_letter_queue
   WHERE source = 'discord_publisher'
   AND requeued_at IS NOT NULL
   GROUP BY replay_status;
   ```

4. **Verify Success**:
   ```bash
   # Check Discord for replayed messages
   # Verify DLQ depth decreasing
   watch -n 5 'curl -s http://localhost:9090/metrics | grep dlq_messages_in_dlq'
   ```

### Excessive Rate Limiting

**Symptoms**:
- `discord_publish_rate_limited_total` rate high
- Long wait times: `discord_publish_rate_limit_wait_seconds` p95 > 10s
- Slow publishing

**Investigation**:

1. **Check Rate Limit Metrics**:
   ```promql
   rate(discord_publish_rate_limited_total[5m]) by (channel, limiter_type)
   ```

2. **Check Wait Time Distribution**:
   ```promql
   histogram_quantile(0.95, discord_publish_rate_limit_wait_seconds)
   ```

3. **Identify Hot Channels**:
   ```promql
   topk(10, rate(discord_publish_rate_limited_total{limiter_type="channel"}[5m]))
   ```

**Solutions**:

1. **Spread Load Across Channels**:
   - Configure multiple channels for different pick types
   - Route by sport/tier to different channels

2. **Increase Processing Interval**:
   ```bash
   # In environment config
   PUBLISH_PROCESSING_INTERVAL=10000 # 10 seconds instead of 5
   # Restart worker
   pm2 restart discord-publishing-worker
   ```

3. **Reduce Batch Size**:
   ```bash
   # In environment config
   PUBLISH_BATCH_SIZE=5 # Smaller batches
   # Restart worker
   pm2 restart discord-publishing-worker
   ```

4. **Review Message Volume**:
   ```sql
   -- Check publish rate by hour
   SELECT
     DATE_TRUNC('hour', created_at) as hour,
     COUNT(*) as total_publishes,
     COUNT(*) FILTER (WHERE status = 'sent') as successful,
     COUNT(*) FILTER (WHERE status = 'failed') as failed
   FROM pick_publish
   WHERE created_at > NOW() - INTERVAL '24 hours'
   GROUP BY hour
   ORDER BY hour DESC;
   ```

### Outbox Backlog

**Symptoms**:
- `discord_publish_outbox_pending > 50`
- `discord_publish_outbox_oldest_age_seconds > 300` (5 minutes)
- Delayed Discord messages

**Investigation**:

1. **Check Outbox Status**:
   ```sql
   SELECT
     status,
     COUNT(*) as count,
     MIN(created_at) as oldest,
     MAX(created_at) as newest
   FROM pick_publish
   GROUP BY status;
   ```

2. **Check Processing Rate**:
   ```promql
   rate(discord_publish_outbox_processed_total{status="success"}[5m])
   ```

3. **Identify Stuck Records**:
   ```sql
   SELECT *
   FROM pick_publish
   WHERE
     status = 'pending'
     AND next_attempt_at < NOW()
     AND attempts < max_attempts
   ORDER BY created_at ASC
   LIMIT 10;
   ```

**Solutions**:

1. **Scale Up Processing**:
   ```bash
   # Increase batch size
   PUBLISH_BATCH_SIZE=20
   # Restart worker
   pm2 restart discord-publishing-worker
   ```

2. **Reduce Processing Interval**:
   ```bash
   PUBLISH_PROCESSING_INTERVAL=2000 # 2 seconds
   # Restart worker
   pm2 restart discord-publishing-worker
   ```

3. **Manual Drain (Emergency)**:
   ```sql
   -- Mark old pending records as skipped
   UPDATE pick_publish
   SET
     status = 'failed',
     failed_at = NOW(),
     error_message = 'Emergency drain - manual intervention required'
   WHERE
     status = 'pending'
     AND created_at < NOW() - INTERVAL '1 hour'
     AND attempts >= max_attempts;
   ```

4. **Verify Worker Health**:
   ```bash
   # Check CPU/memory usage
   pm2 monit discord-publishing-worker

   # Check for errors
   pm2 logs discord-publishing-worker --err --lines 50
   ```

### Daily Recap Issues

**System**: Daily Recap Automation (Phase 2 Step 5)
**Related**: Temporal workflows, DailyRecapService, Discord publishing

**Symptoms**:
- Daily recap not appearing in Discord
- Recap data missing or incorrect
- Temporal workflow failures

**Investigation**:

1. **Check Recap Table**:
   ```sql
   -- Check if recap exists for date
   SELECT *
   FROM daily_recaps
   WHERE recap_date = '[date]'
   ORDER BY created_at DESC;

   -- Check recent recaps
   SELECT recap_date, total_picks, win_rate, avg_clv_bps, created_at
   FROM daily_recaps
   ORDER BY recap_date DESC
   LIMIT 7;
   ```

2. **Check Temporal Workflow Status**:
   ```bash
   # Check if scheduled workflow is running
   temporal workflow describe \
     --workflow-id scheduled-daily-recap

   # Check recent workflow executions
   temporal workflow list \
     --query 'WorkflowType="dailyRecapWorkflow"' \
     --limit 10
   ```

3. **Check Workflow Logs**:
   ```bash
   # View workflow execution logs
   temporal workflow show \
     --workflow-id daily-recap-[date] \
     --output json | jq '.history'
   ```

4. **Verify Pick Data**:
   ```sql
   -- Check if there are picks for the recap date
   SELECT COUNT(*) as total_picks
   FROM picks
   WHERE created_at::date = '[recap-date]'
   AND workflow_stage = 'published';

   -- Check CLV coverage
   SELECT
     COUNT(*) as total_picks,
     COUNT(ct.id) as with_clv,
     ROUND(100.0 * COUNT(ct.id) / COUNT(*), 2) as clv_coverage_pct
   FROM picks p
   LEFT JOIN clv_tracking ct ON p.id = ct.pick_id
   WHERE p.created_at::date = '[recap-date]'
   AND p.workflow_stage = 'published';
   ```

**Common Causes & Fixes**:

| Cause | Fix |
|-------|-----|
| Workflow not scheduled | Start scheduled workflow via Temporal |
| No picks for date | Normal - recap should have 0 picks |
| Database connection lost | Check Supabase credentials + restart workflow |
| Activity timeout | Increase `startToCloseTimeout` in workflow config |
| Missing CLV data | CLV workflow may be behind - check CLV automation |
| Discord publish failed | Check DLQ for recap messages + retry |

**Resolution Steps**:

1. **Manual Recap Generation**:
   ```bash
   # Generate recap for specific date
   npx tsx apps/api/src/scripts/generate-daily-recap.ts --date=2025-12-01

   # Or via Temporal CLI
   temporal workflow start \
     --task-queue unit-talk-tasks \
     --type dailyRecapWorkflow \
     --workflow-id daily-recap-2025-12-01-manual \
     --input '{"recapDate":"2025-12-01","publishToDiscord":true}'
   ```

2. **Query Saved Recap**:
   ```typescript
   import { dailyRecapService } from './services/recap/DailyRecapService';

   const recap = await dailyRecapService.getRecap(new Date('2025-12-01'));
   console.log('Recap:', recap);
   ```

3. **Inspect Daily Recap Data**:
   ```sql
   SELECT
     recap_date,
     total_picks,
     wins,
     losses,
     pushes,
     ROUND(win_rate * 100, 2) as win_rate_pct,
     avg_clv_bps,
     sport_breakdown,
     top_picks
   FROM daily_recaps
   WHERE recap_date = '[date]';
   ```

4. **Verify Discord Publish**:
   ```sql
   -- Check if recap was published to Discord
   SELECT *
   FROM pick_publish
   WHERE message_type = 'daily_recap'
   AND metadata->>'recap_date' = '[date]'
   ORDER BY created_at DESC;
   ```

5. **Check DLQ for Failed Publishes**:
   ```sql
   SELECT *
   FROM dead_letter_queue
   WHERE source = 'discord_publisher'
   AND original_payload->>'messageType' = 'daily_recap'
   AND original_payload->>'recap_date' = '[date]'
   ORDER BY created_at DESC;
   ```

**Metrics to Monitor**:

```promql
# Recap cycle completion
recap_cycle_completed_total

# Recap computation duration
recap_compute_duration_seconds

# Recap total picks per day
recap_total_picks

# Recap average CLV per day
recap_avg_clv_percentage
```

**Related Documentation**:
- [Daily Recap Implementation](../modernization/phase2_daily_recap.md)
- [DailyRecapService](../../apps/api/src/services/recap/DailyRecapService.ts)
- [DailyRecapWorkflow](../../apps/api/src/temporal/workflows/DailyRecapWorkflow.ts)

## DLQ Management

### Inspecting DLQ

**View DLQ Summary**:
```sql
SELECT * FROM vw_dlq_summary WHERE source = 'discord_publisher';
```

**View Recent DLQ Events**:
```sql
SELECT * FROM vw_dlq_recent WHERE source = 'discord_publisher' LIMIT 100;
```

**Get Specific DLQ Entry**:
```sql
SELECT *
FROM dead_letter_queue
WHERE id = '[dlq-entry-id]';
```

### Replaying DLQ Messages

**Mark Single Message for Replay**:
```sql
UPDATE dead_letter_queue
SET
  requeued_at = NOW(),
  requeued_by = 'ops-[your-name]',
  replay_status = 'pending',
  metadata = metadata || '{"notes": "Manual replay - reason"}'::jsonb
WHERE id = '[dlq-entry-id]';
```

**Mark Batch for Replay**:
```sql
UPDATE dead_letter_queue
SET
  requeued_at = NOW(),
  requeued_by = 'ops-[your-name]',
  replay_status = 'pending'
WHERE
  source = 'discord_publisher'
  AND requeued_at IS NULL
  AND error_code = '[specific-error-code]'
  AND created_at > NOW() - INTERVAL '24 hours'
LIMIT 100;
```

**Cancel Pending Replay**:
```sql
UPDATE dead_letter_queue
SET
  replay_status = 'cancelled'
WHERE
  source = 'discord_publisher'
  AND replay_status = 'pending'
  AND id = '[dlq-entry-id]';
```

### Monitoring Replay Progress

```sql
SELECT
  replay_status,
  COUNT(*) as count,
  MIN(requeued_at) as first_replay,
  MAX(requeued_at) as last_replay
FROM dead_letter_queue
WHERE
  source = 'discord_publisher'
  AND requeued_at IS NOT NULL
GROUP BY replay_status;
```

## Metrics Reference

### Key Metrics

| Metric | Description | Normal Range | Alert Threshold |
|--------|-------------|--------------|-----------------|
| `discord_publish_success_total` rate | Successful publishes/sec | 0.1 - 5 | < 0.01 |
| `discord_publish_failure_total` rate | Failed publishes/sec | < 0.01 | > 0.05 |
| `discord_publish_duration_seconds` p95 | Publishing latency | < 2s | > 5s |
| `discord_publish_outbox_pending` | Pending messages | < 10 | > 50 |
| `discord_publish_outbox_oldest_age_seconds` | Oldest message age | < 60s | > 300s |
| `discord_publish_rate_limited_total` rate | Rate limit hits/sec | < 0.1 | > 1.0 |
| `dlq_messages_in_dlq{source="discord_publisher"}` | DLQ depth | < 10 | > 100 |

### Useful Queries

**Publishing Success Rate**:
```promql
sum(rate(discord_publish_success_total[5m])) /
(sum(rate(discord_publish_success_total[5m])) + sum(rate(discord_publish_failure_total[5m])))
```

**Average Publishing Latency**:
```promql
rate(discord_publish_duration_seconds_sum[5m]) /
rate(discord_publish_duration_seconds_count[5m])
```

**Top Channels by Volume**:
```promql
topk(10, sum by (channel) (rate(discord_publish_success_total[1h])))
```

**Error Rate by Type**:
```promql
sum by (error_type) (rate(discord_publish_failure_total[5m]))
```

## Emergency Procedures

### Emergency Stop

**When to use**: Critical bug causing data corruption or system instability

```bash
# 1. Stop worker immediately
pm2 stop discord-publishing-worker

# 2. Prevent new outbox writes (update application config)
# Set ENABLE_DISCORD_PUBLISHING=false

# 3. Monitor DLQ
watch -n 5 'curl -s http://localhost:9090/metrics | grep dlq_messages_in_dlq'

# 4. Incident notification
# Alert #platform-incidents channel

# 5. Document incident
# Create post-mortem in docs/incidents/
```

### Mass Retry

**When to use**: After fixing a systemic issue affecting many messages

```sql
-- 1. Verify fix is deployed

-- 2. Count affected messages
SELECT COUNT(*)
FROM dead_letter_queue
WHERE
  source = 'discord_publisher'
  AND error_code = '[fixed-error-code]'
  AND requeued_at IS NULL;

-- 3. Mark in batches (start small)
UPDATE dead_letter_queue
SET
  requeued_at = NOW(),
  requeued_by = 'ops-mass-retry',
  replay_status = 'pending'
WHERE
  id IN (
    SELECT id
    FROM dead_letter_queue
    WHERE
      source = 'discord_publisher'
      AND error_code = '[fixed-error-code]'
      AND requeued_at IS NULL
    ORDER BY created_at ASC
    LIMIT 50 -- Small batch first
  );

-- 4. Monitor success rate
-- Wait 5 minutes, check replay_status

-- 5. If successful, increase batch size
-- Repeat with LIMIT 100, then 500, etc.
```

### Data Recovery

**When to use**: Messages lost due to system failure

```sql
-- 1. Identify affected time range
SELECT
  MIN(created_at) as start_time,
  MAX(created_at) as end_time,
  COUNT(*) as total_picks
FROM picks
WHERE
  created_at > '[incident-start]'
  AND created_at < '[incident-end]';

-- 2. Find picks without publish records
SELECT p.*
FROM picks p
LEFT JOIN pick_publish pp ON p.id = pp.pick_id
WHERE
  p.created_at > '[incident-start]'
  AND p.created_at < '[incident-end]'
  AND pp.id IS NULL;

-- 3. Recreate publish records (via application code or manual insert)
INSERT INTO pick_publish (
  pick_id, tenant_id, channel_id, message_type, metadata
)
SELECT
  p.id,
  p.tenant_id,
  '[default-channel-id]',
  'new_pick',
  jsonb_build_object('recovery', true, 'incident', '[incident-id]')
FROM picks p
LEFT JOIN pick_publish pp ON p.id = pp.pick_id
WHERE
  p.created_at > '[incident-start]'
  AND p.created_at < '[incident-end]'
  AND pp.id IS NULL;

-- 4. Monitor publishing recovery
```

## Preventive Maintenance

### Daily Checks

- [ ] Check DLQ depth: `dlq_messages_in_dlq{source="discord_publisher"} < 10`
- [ ] Verify publishing rate: `rate(discord_publish_success_total[1h]) > 0`
- [ ] Check error rate: `rate(discord_publish_failure_total[1h]) / rate(discord_publish_success_total[1h]) < 0.01`

### Weekly Checks

- [ ] Review DLQ trends: Are certain errors increasing?
- [ ] Analyze rate limiting patterns: Are limits appropriate?
- [ ] Check outbox age distribution: Any concerning patterns?
- [ ] Review published message samples: Quality check

### Monthly Checks

- [ ] DLQ cleanup: Archive or delete old resolved DLQ entries
- [ ] Performance review: Publishing latency trends
- [ ] Capacity planning: Projected message volume vs limits
- [ ] Documentation update: Any new procedures or insights?

## Contacts

- **On-Call**: platform-oncall@unittalk.com
- **Slack**: #platform-incidents, #publishing-alerts
- **PagerDuty**: [Link to PD service]
- **Runbook Updates**: Create PR to `docs/runbooks/`

## References

- [Phase 2 Publishing Architecture](../modernization/phase2_publishing.md)
- [DLQ Service Documentation](../../apps/api/src/services/DeadLetterQueueService.ts)
- [Discord.js Rate Limits](https://discord.com/developers/docs/topics/rate-limits)
- [Production Charter](../PRODUCTION_CHARTER.md)

---

**Last Updated**: 2025-01-15
**Next Review**: 2025-02-15
