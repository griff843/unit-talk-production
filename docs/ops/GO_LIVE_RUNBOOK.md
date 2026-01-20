# PR9: Go-Live Runbook

**Version**: 1.0.0
**Status**: READY FOR STAGING
**Date**: 2026-01-19
**Author**: Platform Engineering Team

---

## Overview

This runbook provides step-by-step instructions for deploying the Ops/SLO/Incident/Remediation system (PR1-PR8) to staging and production environments.

### Prerequisites

- All PR1-PR8 migrations deployed
- Supabase service_role access configured
- Command Center operational
- Discord webhooks configured (optional for notifications)

### Safety Principles

1. **DRY RUN by DEFAULT**: All remediations are simulated until explicitly enabled
2. **APPROVAL REQUIRED**: Live executions require manual approval
3. **FEATURES OFF**: All features start disabled
4. **INCREMENTAL ROLLOUT**: Enable features one at a time with validation

---

## Phase 1: Staging Deployment

### Step 1.1: Run Staging Gate Check

```bash
# Connect to staging database and run prerequisites gate
psql -h $STAGING_SUPABASE_HOST -U postgres -d postgres -f scripts/ops/gate_prereqs_staging.sql
```

**Expected**: All checks PASS. If any FAIL, resolve before proceeding.

### Step 1.2: Run Smoke Test

```bash
# Run end-to-end smoke test
psql -h $STAGING_SUPABASE_HOST -U postgres -d postgres -f scripts/ops/smoke_ops_loop.sql
```

**Expected**: All 11 test steps PASS.

### Step 1.3: Verify Command Center Access

1. Navigate to `https://staging.command-center.unit-talk.com/dashboard`
2. Verify "Rollout Status" card shows:
   - Status: `STAGING`
   - Safety Score: `100%`
   - All feature flags OFF
   - All playbooks disabled

### Step 1.4: Enable SLO Evaluation (Staging)

```sql
-- Enable SLO evaluation in staging
UPDATE ops.remediation_config
SET config_value = 'true'
WHERE config_key = 'slo_evaluation_enabled';

-- Verify
SELECT config_key, config_value FROM ops.remediation_config
WHERE config_key = 'slo_evaluation_enabled';
```

**Monitor for 24 hours**:
- Check `ops.slo_evaluations` table for new rows
- Verify no errors in evaluation logs
- Confirm incident detection is working via `ops.slo_incidents`

### Step 1.5: Enable Discord Notifications (Staging)

```sql
-- Enable Discord notifications for staging
UPDATE ops.notification_prefs
SET enabled = true,
    channel_id = '<STAGING_DISCORD_CHANNEL_ID>'
WHERE environment = 'staging' AND destination = 'discord';

-- Verify
SELECT * FROM ops.notification_prefs WHERE environment = 'staging';
```

**Test by creating a manual incident**:
```sql
INSERT INTO ops.slo_incidents (slo_id, severity, status, trigger_value, trigger_threshold, evidence)
SELECT id, 'warning', 'open', 150, 100, '{"test": true}'::jsonb
FROM ops.slos LIMIT 1;
```

Verify Discord notification received within 5 minutes.

### Step 1.6: Test Remediation (Dry Run)

```sql
-- Verify global remediation is still disabled
SELECT config_value FROM ops.remediation_config WHERE config_key = 'global_enabled';
-- Expected: false

-- Verify dry run mode is enabled
SELECT config_value FROM ops.remediation_config WHERE config_key = 'dry_run_mode';
-- Expected: true
```

Trigger a test playbook from Command Center:
1. Go to `/dashboard/remediation`
2. Select `PIPELINE_LAG_THROTTLE` playbook
3. Click "Test (Dry Run)"
4. Verify execution shows status: `completed` with `dry_run: true`

### Step 1.7: Staging Validation Complete

**Checklist before production**:
- [ ] Gate check PASS
- [ ] Smoke test PASS
- [ ] SLO evaluation running for 24h+
- [ ] No critical errors in logs
- [ ] Discord notifications working
- [ ] Dry run remediation tested
- [ ] Command Center Rollout Status card operational

---

## Phase 2: Production Deployment

### Step 2.1: Run Production Gate Check

```bash
# Connect to production database and run STRICT prerequisites gate
psql -h $PROD_SUPABASE_HOST -U postgres -d postgres -f scripts/ops/gate_prereqs_prod.sql
```

**Expected**: All checks PASS. Production gate has STRICTER requirements:
- All feature flags must be OFF
- Dry-run mode must be ON
- Approval required must be ON
- All playbooks must be disabled

### Step 2.2: Verify Safety Defaults

```sql
-- Verify all safety defaults in production
SELECT config_key, config_value FROM ops.remediation_config;

-- Expected:
-- global_enabled: false
-- dry_run_mode: true
-- require_approval_by_default: true

-- Verify all playbooks disabled
SELECT playbook_id, enabled, dry_run_only, requires_approval
FROM ops.remediation_playbooks;

-- Expected: All enabled = false, dry_run_only = true
```

### Step 2.3: Run Production Smoke Test

```bash
psql -h $PROD_SUPABASE_HOST -U postgres -d postgres -f scripts/ops/smoke_ops_loop.sql
```

### Step 2.4: Enable SLO Evaluation (Production)

**WAIT 24 HOURS** after staging validation before enabling in production.

```sql
-- Enable SLO evaluation
UPDATE ops.remediation_config
SET config_value = 'true'
WHERE config_key = 'slo_evaluation_enabled';
```

**Monitor continuously**:
- Command Center dashboard
- `ops.slo_evaluations` growth
- Error rates in application logs

### Step 2.5: Enable Discord Notifications (Production)

**WAIT 48 HOURS** after SLO evaluation is stable.

```sql
-- Enable Discord notifications for production
UPDATE ops.notification_prefs
SET enabled = true,
    channel_id = '<PROD_DISCORD_OPS_CHANNEL_ID>',
    escalation_role_id = '<PROD_OPS_ROLE_ID>'
WHERE environment = 'production' AND destination = 'discord';
```

### Step 2.6: Enable Auto-Remediation (Careful!)

**ONLY PROCEED** after:
- [ ] 7 days of stable SLO evaluation
- [ ] 7 days of stable notifications
- [ ] No false positives in incident detection
- [ ] Team trained on approval workflow

```sql
-- Step 1: Keep dry-run mode ON, just enable the system
UPDATE ops.remediation_config
SET config_value = 'true'
WHERE config_key = 'global_enabled';

-- Monitor for 3 days with dry-run mode
```

After 3 days of successful dry-run operations:

```sql
-- Step 2: Enable specific playbooks one at a time
-- Start with RECOMMENDATION_ONLY playbooks (safest)

UPDATE ops.remediation_playbooks
SET enabled = true
WHERE playbook_id = 'MV_REFRESH_LAG';  -- RECOMMENDATION_ONLY

-- Wait 24 hours, verify no issues

UPDATE ops.remediation_playbooks
SET enabled = true
WHERE playbook_id = 'CREDIT_BURN_THROTTLE';  -- RECOMMENDATION_ONLY

-- Wait 24 hours, verify no issues
```

### Step 2.7: Enable EXECUTABLE Playbooks (High Risk)

**ONLY PROCEED** after RECOMMENDATION_ONLY playbooks stable for 1 week.

```sql
-- Enable EXECUTABLE playbooks one at a time
-- These can make actual changes to the system!

UPDATE ops.remediation_playbooks
SET enabled = true
WHERE playbook_id = 'DISCORD_BACKLOG_NUDGE';  -- Low risk, just sends notification

-- Wait 48 hours

UPDATE ops.remediation_playbooks
SET enabled = true
WHERE playbook_id = 'PIPELINE_LAG_THROTTLE';  -- Medium risk, affects autopilot

-- Wait 48 hours

UPDATE ops.remediation_playbooks
SET enabled = true
WHERE playbook_id = 'SLO_EVALUATOR_STUCK';  -- Medium risk, restarts agents

-- Wait 48 hours
```

### Step 2.8: (Optional) Disable Dry Run Mode

**EXTREME CAUTION**: Only disable dry-run after:
- [ ] 30 days of stable operation
- [ ] Full team consensus
- [ ] Incident commander approval
- [ ] Rollback plan reviewed and tested

```sql
-- Disable dry-run mode (DANGEROUS!)
UPDATE ops.remediation_config
SET config_value = 'false'
WHERE config_key = 'dry_run_mode';

-- Keep approval required (NEVER disable this in production)
SELECT config_value FROM ops.remediation_config
WHERE config_key = 'require_approval_by_default';
-- Must be: true
```

---

## Rollback Procedures

### Emergency: Disable All Remediation

```sql
-- Immediately disable all auto-remediation
UPDATE ops.remediation_config
SET config_value = 'false'
WHERE config_key = 'global_enabled';

-- Verify
SELECT config_key, config_value FROM ops.remediation_config
WHERE config_key = 'global_enabled';
-- Expected: false
```

### Disable Specific Playbook

```sql
-- Disable a specific problematic playbook
UPDATE ops.remediation_playbooks
SET enabled = false
WHERE playbook_id = 'PIPELINE_LAG_THROTTLE';

-- Verify
SELECT playbook_id, enabled FROM ops.remediation_playbooks
WHERE playbook_id = 'PIPELINE_LAG_THROTTLE';
```

### Re-enable Dry Run Mode

```sql
-- Force dry-run mode back on
UPDATE ops.remediation_config
SET config_value = 'true'
WHERE config_key = 'dry_run_mode';
```

### Disable Notifications

```sql
-- Emergency disable all notifications
UPDATE ops.notification_prefs
SET enabled = false
WHERE environment = 'production';
```

### View Rollback Steps for Specific Execution

```sql
-- Get rollback steps for a remediation
SELECT
    execution_id,
    playbook_id,
    rollback_action,
    action_taken
FROM ops.remediation_executions
WHERE execution_id = '<EXECUTION_UUID>';
```

---

## MV_REFRESH_LAG Playbook

**STATUS**: The `MV_REFRESH_LAG` playbook is now `EXECUTABLE` (updated in PR9).

### Infrastructure Added (PR9)

The following MV refresh infrastructure was created:

1. **`mv_pipeline_lag_24h`**: Materialized view for pipeline lag metrics
2. **`ops.mv_refresh_log`**: Tracking table for refresh operations
3. **`ops.logged_refresh_mv()`**: Safe refresh function with audit logging
4. **`refresh_pipeline_lag_materialized_view()`**: RPC endpoint for Command Center

### Manual Operations

If manual intervention is needed:

```sql
-- Check MV freshness
SELECT * FROM ops.v_mv_freshness;

-- Manually trigger refresh
SELECT * FROM ops.logged_refresh_mv('mv_pipeline_lag_24h', 'manual');

-- Check refresh history
SELECT * FROM ops.get_mv_refresh_history('mv_pipeline_lag_24h', 10);

-- Direct refresh (if logged function unavailable)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pipeline_lag_24h;
```

---

## Monitoring Checklist

### Daily Checks
- [ ] Command Center Rollout Status card shows expected state
- [ ] No critical incidents in `ops.slo_incidents`
- [ ] Notification delivery rate > 95%
- [ ] No failed remediations in last 24h

### Weekly Checks
- [ ] Review SLO burn rates
- [ ] Check for noisy SLOs (many incidents from same SLO)
- [ ] Verify playbook cooldowns are appropriate
- [ ] Review any skipped remediations

### Monthly Checks
- [ ] Review and update SLO thresholds if needed
- [ ] Audit remediation execution history
- [ ] Update runbook with lessons learned
- [ ] Test rollback procedures

---

## Contacts

- **On-Call**: ops-oncall@unit-talk.com
- **Escalation**: #ops-critical (Discord)
- **Documentation**: [PR8_AUTO_REMEDIATION.md](./PR8_AUTO_REMEDIATION.md)

---

**Last Updated**: 2026-01-19
**Next Review**: After first production deployment
