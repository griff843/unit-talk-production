# Canonical UI Integration Rollout Runbook

**Version**: 1.0
**Last Updated**: 2025-01-30
**Owner**: Platform Operations Team
**Charter Compliance**: Production Charter v3.0

---

## Overview

This runbook provides step-by-step procedures for rolling out the Canonical UI integration across the Unit Talk Platform. The rollout integrates Smart Form submissions with the canonical `picks` and `pick_publish` tables, enabling real-time monitoring in Command Center and automated Discord notifications.

**Integration Flow**:
```
Smart Form → API (/api/domain/picks/insert) → Canonical picks table →
pick_publish outbox → Discord Bot → Discord Channel Notification
```

**Key Components**:
- **Smart Form**: User-facing pick submission interface with self-score feature
- **API**: Canonical picks driver with self-healing PostgREST reload
- **Command Center**: RealtimePickFeed and PickLifecycleControls components
- **Discord Bot**: Automated notification delivery from pick_publish outbox

---

## Prerequisites

### Environment Variables (Required)

Verify the following environment variables are set correctly:

```bash
# Supabase Connection
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_DIRECT_URL=postgresql://postgres:[password]@db.your-project.supabase.co:5432/postgres

# Core Configuration
DEFAULT_TENANT_ID=12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a
PICK_DRIVER=canonical  # MUST be 'canonical' for this rollout
PUBLISH_MODE=outbox     # Use pick_publish outbox pattern
SHADOW_MODE=false       # Set to 'true' for testing, 'false' for live Discord
LOG_MODE=structured     # Enable structured logging for debugging

# Discord Configuration
DISCORD_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-client-id
DISCORD_TEST_CHANNEL_ID=your-test-channel-id

# Optional: Observability
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318  # OpenTelemetry endpoint
SCHEMA_RELOAD_ON_BOOT=true  # Enable automatic PostgREST reload on startup
```

**Verification Command**:
```bash
# Check environment variables are loaded
curl -sf http://localhost:3010/api/health | jq '.env_status'
```

**Expected Output**:
```json
{
  "PICK_DRIVER": "canonical",
  "PUBLISH_MODE": "outbox",
  "SHADOW_MODE": "false",
  "database_connected": true,
  "supabase_configured": true
}
```

---

### Database State (Required)

**1. Verify Canonical Tables Exist**:

```bash
# Run schema verification script
node scripts/ops/verify-canonical-schema.js
```

**Expected Output**:
```
✓ picks table exists with all required columns
✓ pick_publish table exists with all required columns
✓ Foreign key picks_user_id_fkey exists
✓ Foreign key picks_prop_id_fkey exists
✓ Indexes on picks.workflow_stage and picks.tenant_id exist
✓ Indexes on pick_publish.status and pick_publish.pick_id exist
```

**2. Verify PostgREST Visibility**:

```bash
# Check PostgREST can see canonical tables
curl -sf http://localhost:3010/api/domain/picks/preflight | jq '.'
```

**Expected Output**:
```json
{
  "ok": true,
  "tables_visible": {
    "picks": true,
    "pick_publish": true,
    "props": true,
    "users": true
  },
  "columns_visible": {
    "picks.workflow_stage": true,
    "picks.self_score": true,
    "pick_publish.status": true
  },
  "postgrest_reload_count": 1,
  "last_reload_at": "2025-01-30T12:00:00.000Z"
}
```

**3. Verify Test User and Tenant Exist**:

```sql
-- Run in Supabase SQL Editor or psql
SELECT id, username, tier
FROM public.users
WHERE username = 'TestCapper';

SELECT id, name
FROM public.tenants
WHERE id = '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a';
```

**Expected**: At least one test user and the default tenant should exist.

---

### API Endpoints (Required)

**1. Health Check**:
```bash
curl -sf http://localhost:3010/api/health | jq '.status'
```
**Expected**: `"healthy"`

**2. Preflight Check**:
```bash
curl -sf http://localhost:3010/api/domain/picks/preflight | jq '.ok'
```
**Expected**: `true`

**3. Picks Insert Endpoint**:
```bash
# Test picks insert endpoint exists
curl -sf -X OPTIONS http://localhost:3010/api/domain/picks/insert
```
**Expected**: HTTP 200 or 204 (OPTIONS method allowed)

---

## Step-by-Step Validation Procedure

### Step 1: Submit Pick via Smart Form with userScore

**Objective**: Verify Smart Form can submit picks with self-score to canonical picks table.

**Actions**:

1. **Open Smart Form**:
   ```bash
   # Navigate to Smart Form in browser
   open http://localhost:3001/submit-ticket
   ```

2. **Complete Step 1 - Essentials**:
   - Select Capper: Choose existing capper (e.g., "TestCapper")
   - Select Sport: NBA, NFL, MLB, or NHL
   - Select Bet Type: Player Props
   - Set Confidence: 7/10
   - Click "Continue"

3. **Complete Step 2 - Configuration**:
   - Unit Size: Set to 2.0 units
   - Odds Format: American
   - Auto Parlay: Off
   - Confidence Level: 7/10 (stars)
   - **Self-Score**: Set to 8/10 using slider or number buttons
   - Click "Continue"

4. **Complete Step 3 - Bet Details**:
   - Player Name: Enter test player (e.g., "LeBron James")
   - Prop Type: Points
   - Line: 25.5
   - Selection: Over
   - Odds: -110
   - Click "Continue"

5. **Complete Step 4 - Game Selection**:
   - Select game from available games
   - Click "Submit Ticket"

**Verification**:

```bash
# Check API logs for successful insert
docker-compose logs api | tail -n 50 | grep "pick.insert"

# Query database for the submitted pick
curl -X POST http://localhost:3010/api/picks/query \
  -H "Content-Type: application/json" \
  -d '{"limit": 1, "order_by": "created_at DESC"}'
```

**Expected Output**:
```json
{
  "picks": [
    {
      "id": "uuid-here",
      "user_id": "capper-uuid",
      "selection": "over",
      "odds": -110,
      "stake": 2.0,
      "confidence": 7,
      "self_score": 8,
      "workflow_stage": "pending_review",
      "status": "pending",
      "created_at": "2025-01-30T12:05:00.000Z"
    }
  ]
}
```

**Success Criteria**:
- ✅ Pick appears in canonical `picks` table within 5 seconds
- ✅ `self_score` field is set to 8
- ✅ `workflow_stage` is `pending_review`
- ✅ `status` is `pending`
- ✅ No errors in API logs

---

### Step 2: Verify Pick Appears in Command Center RealtimePickFeed

**Objective**: Confirm real-time pick feed displays the new pick within 10 seconds.

**Actions**:

1. **Open Command Center**:
   ```bash
   # Navigate to Command Center in browser
   open http://localhost:3002/dashboard/picks
   ```

2. **Check RealtimePickFeed Component**:
   - Verify feed is in "Live" mode (green pulsing indicator)
   - Check "Last 24 Hours" filter is selected
   - Look for the submitted pick in the feed

3. **Verify Pick Display**:
   - Player name and stat type are correct
   - Capper username is displayed
   - Workflow stage badge shows "Pending Review" (yellow)
   - Status badge shows "Pending" (blue)
   - Confidence shows "7/10"
   - **Self Score shows "8/10"**
   - Approve/Reject buttons are visible

**Verification Commands**:

```bash
# Check real-time subscription is active
curl -sf http://localhost:3002/api/realtime/status | jq '.subscriptions'

# Verify WebSocket connection
wscat -c ws://localhost:3002/api/realtime/picks
```

**Expected Output (wscat)**:
```json
{
  "event": "INSERT",
  "table": "picks",
  "payload": {
    "new": {
      "id": "uuid-here",
      "workflow_stage": "pending_review",
      "self_score": 8
    }
  }
}
```

**Success Criteria**:
- ✅ Pick appears in RealtimePickFeed within 10 seconds of submission
- ✅ Self-score (8/10) is displayed correctly
- ✅ Real-time indicator is green and pulsing
- ✅ Workflow stage badge is accurate (yellow for "Pending Review")
- ✅ Quick action buttons (Approve/Reject) are visible

---

### Step 3: Check pick_publish Outbox Status

**Objective**: Verify pick_publish outbox record is created when workflow progresses.

**Actions**:

1. **Approve Pick in Command Center**:
   - Click "Approve" button on the pick in RealtimePickFeed
   - Confirm approval in dialog

2. **Publish Pick**:
   - Click "Publish" button (appears after approval)
   - Confirm publication

**Verification**:

```bash
# Check pick_publish outbox for pending record
curl -X POST http://localhost:3010/api/pick_publish/query \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {"status": "pending"},
    "limit": 1,
    "order_by": "created_at DESC"
  }'
```

**Expected Output (if SHADOW_MODE=false)**:
```json
{
  "outbox_records": [
    {
      "id": "uuid-here",
      "pick_id": "pick-uuid",
      "channel": "DISCORD",
      "status": "pending",
      "attempts": 0,
      "max_attempts": 3,
      "discord_channel_id": "your-test-channel-id",
      "created_at": "2025-01-30T12:10:00.000Z"
    }
  ]
}
```

**Expected Output (if SHADOW_MODE=true)**:
```json
{
  "message": "Shadow mode enabled - no outbox record created",
  "pick_id": "pick-uuid",
  "workflow_stage": "published"
}
```

**Success Criteria**:
- ✅ If `SHADOW_MODE=false`: `pick_publish` record exists with `status=pending`
- ✅ If `SHADOW_MODE=true`: No outbox record, but workflow stage is "published"
- ✅ `channel` is set to "DISCORD"
- ✅ `attempts` is 0
- ✅ `discord_channel_id` matches configuration

---

### Step 4: Confirm Discord Notification Sent

**Objective**: Verify Discord bot sends notification from pick_publish outbox.

**Actions (if SHADOW_MODE=false)**:

1. **Check Discord Channel**:
   - Open configured Discord test channel
   - Look for new pick notification within 60 seconds

2. **Verify Notification Content**:
   - Player name and stat type are correct
   - Line and odds are displayed
   - Capper name is shown
   - Confidence (7/10) is displayed
   - **Self-score (8/10) may be shown if configured**

**Verification**:

```bash
# Check Discord bot logs
docker-compose logs discord-bot | tail -n 50 | grep "pick.published"

# Verify pick_publish status changed to 'sent'
curl -X POST http://localhost:3010/api/pick_publish/query \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {"pick_id": "pick-uuid"},
    "limit": 1
  }'
```

**Expected Output**:
```json
{
  "outbox_records": [
    {
      "id": "uuid-here",
      "pick_id": "pick-uuid",
      "status": "sent",
      "attempts": 1,
      "sent_at": "2025-01-30T12:10:30.000Z",
      "external_message_id": "discord-message-id",
      "thread_id": "discord-thread-id"
    }
  ]
}
```

**Success Criteria (SHADOW_MODE=false)**:
- ✅ Discord notification appears within 60 seconds
- ✅ Notification content matches pick details
- ✅ `pick_publish.status` changes to "sent"
- ✅ `external_message_id` and `thread_id` are populated
- ✅ No errors in Discord bot logs

**Success Criteria (SHADOW_MODE=true)**:
- ✅ No Discord notification sent
- ✅ No pick_publish outbox record created
- ✅ Workflow stage is "published" in database
- ✅ Logs show "Shadow mode: skipping Discord publish"

---

## Troubleshooting

### Issue 1: Pick Submission Fails with "picks table not found"

**Symptoms**:
- Smart Form shows error: "Failed to submit pick"
- API logs show: `relation "public.picks" does not exist`

**Root Cause**: PostgREST schema cache is stale.

**Resolution**:

1. **Force PostgREST Reload**:
   ```bash
   curl -X POST http://localhost:3010/api/admin/reload-schema
   ```

2. **Verify Reload Success**:
   ```bash
   curl -sf http://localhost:3010/api/domain/picks/preflight | jq '.tables_visible.picks'
   ```
   **Expected**: `true`

3. **Retry Pick Submission**.

**Prevention**:
- Set `SCHEMA_RELOAD_ON_BOOT=true` in environment variables
- Run migrations with `SELECT pg_notify('pgrst', 'reload schema');` as final statement

---

### Issue 2: Pick Appears in Database but Not in RealtimePickFeed

**Symptoms**:
- Pick exists in `picks` table (verified via SQL query)
- RealtimePickFeed shows "No picks found matching filters"

**Root Cause**: Real-time subscription not active or filters excluding pick.

**Resolution**:

1. **Check Real-time Status**:
   ```bash
   # In browser console on Command Center page
   console.log(window.__SUPABASE_REALTIME_STATUS__);
   ```
   **Expected**: `"SUBSCRIBED"`

2. **Reset Filters**:
   - Set League filter to "All Leagues"
   - Set Workflow Stage to "All Stages"
   - Set Date Range to "Last 24 Hours"

3. **Force Refresh**:
   - Click "Pause" then "Resume" to restart subscription
   - Click refresh button (rotating arrow icon)

4. **Check Foreign Key Relationships**:
   ```sql
   -- Verify user relationship exists
   SELECT p.id, p.user_id, u.username
   FROM public.picks p
   LEFT JOIN public.users u ON u.id = p.user_id
   WHERE p.id = 'pick-uuid';
   ```
   **Expected**: `username` should not be NULL

**Prevention**:
- Ensure test users exist in `users` table before submitting picks
- Use explicit foreign key names (e.g., `picks_user_id_fkey`)

---

### Issue 3: pick_publish Outbox Record Stuck in "pending" Status

**Symptoms**:
- `pick_publish.status` remains "pending" for > 2 minutes
- No Discord notification sent
- `attempts` count increasing

**Root Cause**: Discord bot not running or invalid Discord configuration.

**Resolution**:

1. **Check Discord Bot Status**:
   ```bash
   docker-compose ps discord-bot
   ```
   **Expected**: `State: Up`

2. **Verify Discord Token**:
   ```bash
   curl -sf http://localhost:3010/api/health | jq '.integrations.discord'
   ```
   **Expected**: `{"status": "connected", "bot_user": "YourBotName#1234"}`

3. **Check Outbox Worker Logs**:
   ```bash
   docker-compose logs api | grep "outbox.worker"
   ```
   Look for errors related to Discord API calls.

4. **Manual Retry**:
   ```sql
   -- Reset outbox record for retry
   UPDATE public.pick_publish
   SET status = 'pending', attempts = 0, next_retry_at = NOW()
   WHERE id = 'outbox-uuid';
   ```

**Prevention**:
- Validate `DISCORD_TOKEN` and `DISCORD_TEST_CHANNEL_ID` before rollout
- Monitor Discord API rate limits
- Set appropriate `max_attempts` (default: 3)

---

### Issue 4: Self-Score Not Displayed in Command Center

**Symptoms**:
- Pick submission succeeds with `self_score` set
- Database shows `self_score` value
- RealtimePickFeed shows "N/A" for Self Score

**Root Cause**: Component not selecting `self_score` column or null value.

**Resolution**:

1. **Verify Database Column**:
   ```sql
   SELECT id, self_score, confidence
   FROM public.picks
   WHERE id = 'pick-uuid';
   ```
   **Expected**: `self_score` should have integer value (1-10)

2. **Check Component Query**:
   - Open browser DevTools → Network tab
   - Filter for `/rest/v1/picks` requests
   - Verify `select` parameter includes `self_score`

3. **Force Component Refresh**:
   - Click "Pause" then "Resume" in RealtimePickFeed
   - Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

**Prevention**:
- Ensure `self_score` is included in all `SELECT` queries for picks
- Update RealtimePickFeed component to explicitly select `self_score`

---

### Issue 5: "Multiple Relationships" Error in Supabase Query

**Symptoms**:
- API returns error: "Could not embed because more than one relationship was found"
- Query involves `users` or `props` relationships

**Root Cause**: Ambiguous foreign key relationships without explicit naming.

**Resolution**:

1. **Use Explicit Foreign Key Names**:
   ```typescript
   // ❌ INCORRECT - Ambiguous
   .select('*, users(username)')

   // ✅ CORRECT - Explicit foreign key name
   .select('*, users!picks_user_id_fkey(username)')
   ```

2. **Verify Foreign Key Names**:
   ```sql
   SELECT constraint_name, table_name, column_name
   FROM information_schema.key_column_usage
   WHERE table_name = 'picks' AND constraint_name LIKE '%fkey%';
   ```

3. **Update Component Queries**:
   - Replace all instances of `.select('*, users(...))` with explicit FK names
   - Same for `props` relationship: `props!picks_prop_id_fkey(...)`

**Prevention**:
- Always use explicit foreign key names in Supabase queries
- Document FK naming convention in schema migration files

---

## Rollback Procedure

If critical issues arise during rollout, follow this rollback procedure:

### Option 1: Switch to Unified Picks (Fallback Mode)

**When to Use**: Canonical tables exist but driver is causing issues.

**Steps**:

1. **Update Environment Variable**:
   ```bash
   # Edit .env file
   PICK_DRIVER=unified  # Change from 'canonical' to 'unified'
   ```

2. **Restart API Service**:
   ```bash
   docker-compose restart api
   ```

3. **Verify Fallback**:
   ```bash
   curl -sf http://localhost:3010/api/health | jq '.driver'
   ```
   **Expected**: `{"requested": "canonical", "effective": "unified", "reason": "manual_override"}`

4. **Monitor Logs**:
   ```bash
   docker-compose logs -f api | grep "driver"
   ```
   Look for: `"Driver fallback: canonical → unified"`

**Impact**:
- Smart Form submissions will write to `unified_picks` table instead of `picks`
- Command Center RealtimePickFeed will not show new picks (unless updated)
- Discord notifications continue to work via legacy flow

---

### Option 2: Disable Discord Publishing (Shadow Mode)

**When to Use**: Discord notifications causing issues but picks submission is working.

**Steps**:

1. **Enable Shadow Mode**:
   ```bash
   # Edit .env file
   SHADOW_MODE=true  # Change from 'false' to 'true'
   ```

2. **Restart Services**:
   ```bash
   docker-compose restart api discord-bot
   ```

3. **Verify Shadow Mode**:
   ```bash
   curl -sf http://localhost:3010/api/health | jq '.shadow_mode'
   ```
   **Expected**: `true`

4. **Test Pick Submission**:
   - Submit pick via Smart Form
   - Verify pick appears in database
   - Confirm NO Discord notification sent
   - Check logs for: `"Shadow mode: skipping Discord publish"`

**Impact**:
- Picks are created in database
- Workflow stages function normally
- No Discord notifications sent
- `pick_publish` outbox records NOT created

---

### Option 3: Complete Rollback to Legacy System

**When to Use**: Critical failures requiring immediate restoration of pre-rollout state.

**Steps**:

1. **Stop All Services**:
   ```bash
   docker-compose down
   ```

2. **Restore Environment**:
   ```bash
   # Restore .env from backup
   cp .env.backup .env
   ```

3. **Rollback Database Migration** (if canonical schema was applied during rollout):
   ```bash
   # Run rollback migration
   psql $DATABASE_DIRECT_URL -f supabase/migrations/rollback_canonical_schema.sql
   ```

4. **Restart Services**:
   ```bash
   docker-compose up -d
   ```

5. **Verify Legacy System**:
   ```bash
   # Check driver
   curl -sf http://localhost:3010/api/health | jq '.driver.effective'
   # Expected: "unified"

   # Test legacy submission
   curl -X POST http://localhost:3010/api/picks/legacy/submit \
     -H "Content-Type: application/json" \
     -d '{"capper_id": "uuid", "selection": "over"}'
   ```

**Impact**:
- All canonical UI features disabled
- System operates as pre-rollout
- Smart Form may need code rollback to remove self-score feature
- Command Center RealtimePickFeed and PickLifecycleControls will not function

---

## Success Criteria

The rollout is considered **SUCCESSFUL** when all of the following criteria are met:

### Functional Criteria

- ✅ **Pick Submission**: Smart Form successfully submits picks with optional `self_score` (1-10)
- ✅ **Database Persistence**: Picks appear in canonical `picks` table within 5 seconds
- ✅ **Real-time Feed**: RealtimePickFeed displays new picks within 10 seconds
- ✅ **Workflow Management**: PickLifecycleControls transitions work (approve → publish)
- ✅ **Discord Integration**: Published picks trigger Discord notifications within 60 seconds (if `SHADOW_MODE=false`)
- ✅ **Self-Score Display**: Command Center shows self-score alongside confidence

### Performance Criteria

- ✅ **API Response Time**: Pick submission API responds in < 500ms (p95)
- ✅ **Database Write Latency**: Database write completes in < 100ms (p95)
- ✅ **Real-time Latency**: Pick appears in UI within 10 seconds of database insert
- ✅ **Outbox Processing**: Discord publish completes within 60 seconds of workflow transition

### Reliability Criteria

- ✅ **Error Rate**: < 0.5% error rate on pick submissions over 1-hour monitoring window
- ✅ **Self-Healing**: PostgREST reload succeeds automatically on schema errors
- ✅ **Fallback Behavior**: System auto-falls back to `unified_picks` if canonical unavailable
- ✅ **Idempotency**: Duplicate submissions (same `bet_slip_id`) are rejected gracefully

### Observability Criteria

- ✅ **Structured Logging**: All pick lifecycle events logged with correlation IDs
- ✅ **Health Checks**: `/api/health` endpoint returns `ok: true` with driver status
- ✅ **Preflight Checks**: `/api/domain/picks/preflight` returns `ok: true`
- ✅ **Metrics**: OpenTelemetry spans recorded for `api.picks.insert`, `db.write`, `outbox.publish`

### Security Criteria

- ✅ **Secrets Masked**: All log outputs mask sensitive credentials (Supabase keys, Discord tokens)
- ✅ **Tenant Isolation**: All picks scoped to correct `tenant_id`
- ✅ **Audit Trail**: All workflow transitions logged to `audit_events` table
- ✅ **Rate Limiting**: Pick submission endpoint respects rate limits (10 req/min per user)

---

## Post-Rollout Monitoring

After successful rollout, monitor the following for 24-48 hours:

### Key Metrics to Watch

1. **Pick Submission Rate**:
   ```bash
   # Query last hour's submission count
   curl -X POST http://localhost:3010/api/metrics/picks \
     -H "Content-Type: application/json" \
     -d '{"metric": "submission_rate", "window": "1h"}'
   ```
   **Baseline**: Establish normal submission rate in first 24 hours

2. **Error Rate**:
   ```bash
   # Check error rate over last hour
   curl -sf http://localhost:3010/api/metrics/errors?window=1h | jq '.error_rate'
   ```
   **Threshold**: < 0.5% sustained error rate

3. **Discord Publish Lag**:
   ```sql
   -- Average time from pick.published_at to pick_publish.sent_at
   SELECT AVG(EXTRACT(EPOCH FROM (sent_at - published_at))) AS avg_lag_seconds
   FROM public.pick_publish
   WHERE sent_at IS NOT NULL
   AND sent_at > NOW() - INTERVAL '1 hour';
   ```
   **Threshold**: < 60 seconds average lag

4. **PostgREST Reload Count**:
   ```bash
   curl -sf http://localhost:3010/api/health | jq '.postgrest.reload_count'
   ```
   **Baseline**: Should be low (< 5 reloads per hour in stable state)

### Alerting

Configure alerts for:

- **P0 (Page Immediately)**: Error rate > 5% for > 5 minutes
- **P1 (Page within 5 min)**: API p95 latency > 1000ms for > 5 minutes
- **P1 (Page within 5 min)**: Discord publish lag > 5 minutes for > 10 minutes
- **P2 (Alert only)**: PostgREST reload count > 10 per hour

---

## Related Documents

- **[Production Charter v3.0](../PRODUCTION_CHARTER.md)** - Binding contract for all operations
- **[System Alignment Spec](../SYSTEM_ALIGNMENT_SPEC.yml)** - Machine-readable governance rules
- **[Smart Form CLAUDE.md](../../apps/smart-form/CLAUDE.md)** - Smart Form development guide
- **[Command Center CLAUDE.md](../../apps/command-center/CLAUDE.md)** - Command Center development guide
- **[API Canonical Picks Documentation](../../apps/api/src/routes/domain/picks-insert.ts)** - Picks insertion logic

---

**End of Runbook**

For questions or issues, contact Platform Operations Team.
