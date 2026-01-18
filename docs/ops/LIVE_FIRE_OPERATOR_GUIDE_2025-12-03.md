# LIVE-FIRE TEST - OPERATOR QUICK REFERENCE

**Date:** December 3, 2025 (TODAY)
**Environment:** PRODUCTION CANARY
**Target:** NBA + College Basketball
**CANARY Channel ID:** 1296531122234327100

**📋 Full Run Log:** `docs/ops/live_fire_run_2025-12-03.md` (fill this out as you go)
**📖 Detailed Plan:** `WEDNESDAY_LIVE_FIRE_TEST_PLAN.md` (background reading)

---

## 🚨 PRE-FLIGHT (15 minutes)

### 1. Navigate to Project
```powershell
cd "C:\Users\griff\OneDrive\Desktop\unit-talk-production-main"
```

### 2. Verify Environment
```powershell
Get-Content .env | Select-String "PICK_DRIVER|PUBLISH_MODE|SHADOW_MODE|DISCORD_CANARY_CHANNEL_ID"
```

**Must see:**
- PICK_DRIVER=canonical ✅
- PUBLISH_MODE=outbox ✅
- SHADOW_MODE=false ✅
- DISCORD_CANARY_CHANNEL_ID=1296531122234327100 ✅

### 3. Start Services
```powershell
./dev.sh start
Start-Sleep -Seconds 30
./dev.sh status
```

**Must see all RUNNING/HEALTHY:**
- PostgreSQL, Redis, Temporal, API Server, Discord Bot, Workers

### 4. Create Test Capper

**Open Supabase Dashboard → SQL Editor, run:**
```sql
INSERT INTO users (id, username, discord_id, tier, capper_tier, active, metadata)
VALUES (
  gen_random_uuid(),
  'GriffTest',
  '9999999999999999999',
  'B',
  'B',
  true,
  '{"is_test": true, "purpose": "live_fire_test_2025_12_03"}'::jsonb
)
ON CONFLICT (username) DO UPDATE
SET metadata = '{"is_test": true, "purpose": "live_fire_test_2025_12_03"}'::jsonb
RETURNING id, username, tier;
```

**Copy the returned UUID and save it:**
```powershell
$env:TEST_CAPPER_ID = "<paste-uuid-here>"
```

---

## 🧪 PHASE 0: CANARY SMOKE TEST (3 min)

**Purpose:** Verify Discord bot can post to CANARY channel BEFORE the full test.

### Command
```powershell
npx tsx scripts/test_discord_canary.ts
```

### Expected Output
```
✅ CANARY SMOKE TEST PASSED
```

### Manual Check
1. Open Discord
2. Go to channel ID: 1296531122234327100
3. See gold-colored test message with "🧪 CANARY SMOKE TEST"

**🚨 IF THIS FAILS, STOP. Do NOT proceed to Phase 1.**

**Record in run log:** `docs/ops/live_fire_run_2025-12-03.md` → PHASE 0 section

---

## 📥 PHASE 1: LIVE DATA INGESTION (10 min)

**Purpose:** Ingest today's NBA + NCAAB props from Odds API.

### Commands

**Check date:**
```powershell
Get-Date -Format "yyyy-MM-dd"
# Should show: 2025-12-03
```

**Trigger ingestion (Option A - if FeedAgent running):**
```powershell
curl -X POST http://localhost:3010/ops/feed/refresh `
  -H "Authorization: Bearer admin-test-token" `
  -H "Content-Type: application/json" `
  -d '{
    "sports": ["NBA", "NCAAB"],
    "forceRefresh": true
  }'
```

**OR Option B - direct script:**
```powershell
npx tsx apps/api/scripts/live-odds-ingestion-test.ts --sports NBA,NCAAB --limit 100
```

### Verification SQL (Supabase Dashboard)

**Count props:**
```sql
SELECT
  sport,
  COUNT(*) as prop_count,
  MAX(created_at) as latest_ingest
FROM raw_props
WHERE sport IN ('NBA', 'NCAAB')
  AND created_at > NOW() - INTERVAL '10 minutes'
GROUP BY sport
ORDER BY sport;
```

**Check canonical IDs:**
```sql
SELECT
  id,
  sport,
  player_name,
  stat_type,
  line,
  canonical_player_id IS NOT NULL as has_player_id,
  canonical_game_id IS NOT NULL as has_game_id
FROM raw_props
WHERE sport IN ('NBA', 'NCAAB')
  AND created_at > NOW() - INTERVAL '10 minutes'
LIMIT 10;
```

### Pass Criteria
- ✅ 50+ total props (NBA + NCAAB)
- ✅ 80%+ have canonical_player_id
- ✅ 80%+ have canonical_game_id
- ✅ Completes in < 2 minutes

**Record in run log:** PHASE 1 section

---

## 📝 PHASE 2: SUBMIT PICKS (5 min)

**Purpose:** Submit 1-2 test picks as GriffTest via API.

### Commands

**Verify TEST_CAPPER_ID is set:**
```powershell
echo $env:TEST_CAPPER_ID
# Should show UUID
```

**Submit Pick #1 (NBA - LeBron James):**
```powershell
$pick1 = @{
  userId = $env:TEST_CAPPER_ID
  league = "NBA"
  marketType = "POINTS"
  playerName = "LeBron James"
  line = 25.5
  side = "OVER"
  odds = -115
  stakeText = "1u"
  confidence = 80
  betSlipId = "test-nba-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  autoPublish = $false
  metadata = @{
    is_test = $true
    test_date = "2025-12-03"
    test_operator = "Griff"
  }
} | ConvertTo-Json

curl -X POST http://localhost:3010/api/domain/picks/insert `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer admin-test-token" `
  -d $pick1
```

**Submit Pick #2 (NCAAB - Zach Edey) - OPTIONAL:**
```powershell
$pick2 = @{
  userId = $env:TEST_CAPPER_ID
  league = "NCAAB"
  marketType = "POINTS"
  playerName = "Zach Edey"
  line = 20.5
  side = "UNDER"
  odds = +105
  stakeText = "0.5u"
  confidence = 70
  betSlipId = "test-ncaab-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  autoPublish = $false
  metadata = @{
    is_test = $true
    test_date = "2025-12-03"
    test_operator = "Griff"
  }
} | ConvertTo-Json

curl -X POST http://localhost:3010/api/domain/picks/insert `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer admin-test-token" `
  -d $pick2
```

### Verification SQL

```sql
SELECT
  id,
  selection,
  odds,
  workflow_stage,
  status,
  metadata->>'is_test' as is_test
FROM picks
WHERE user_id = '<TEST_CAPPER_ID>'
  AND created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;
```

### Expected Response (each pick)
```json
{
  "success": true,
  "pickId": "<uuid>",
  "status": "pending_review"
}
```

**Save pickId values - you need them for Phase 4!**

### Pass Criteria
- ✅ Both API calls return success: true
- ✅ Both picks have valid pickId (UUID)
- ✅ workflow_stage = 'pending_review'
- ✅ Picks visible in database

**Record in run log:** PHASE 2 section (include pickId values)

---

## 👁️ PHASE 3: COMMAND CENTER (3 min)

**Purpose:** Verify picks visible in Command Center UI.

### Steps

1. **Open Command Center:**
   - URL: http://localhost:3004
   - Navigate to "Pending Picks"

2. **Filter:**
   - Capper: GriffTest
   - Date: Today (2025-12-03)

3. **Verify each pick shows:**
   - Player name
   - Market type (POINTS)
   - Line and side
   - Odds
   - Confidence
   - Status badge: "Pending Review"
   - Approve/Reject buttons enabled

**If UI not working, use API:**
```powershell
curl -H "Authorization: Bearer admin-test-token" `
  "http://localhost:3010/api/ops/picks/pending?capper=GriffTest" `
  | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### Pass Criteria
- ✅ Both picks visible
- ✅ All metadata accurate
- ✅ Action buttons enabled

**Record in run log:** PHASE 3 section

---

## ✅ PHASE 4: APPROVE & PROMOTE (5 min)

**Purpose:** Approve picks, then promote to CANARY channel.

### Step 4A: Approve (Command Center UI)

1. Click "Approve" on Pick #1
2. Wait for confirmation
3. Click "Approve" on Pick #2
4. Verify status → "Approved"

### Step 4B: Promote (Manual Script)

**Promote Pick #1:**
```powershell
npx tsx scripts/manual_promote_pick.ts `
  --pickId=<PICK_1_UUID> `
  --channel=CANARY
```

**Promote Pick #2:**
```powershell
npx tsx scripts/manual_promote_pick.ts `
  --pickId=<PICK_2_UUID> `
  --channel=CANARY
```

### Expected Output (each promotion)
```
✅ Pick promoted successfully!
Details:
  Pick ID: <uuid>
  Publish ID: <uuid>
  Publish Mode: outbox
  Channel: CANARY
  Status: pending
```

### Verification SQL

```sql
SELECT
  id as publish_id,
  pick_id,
  channel,
  status,
  attempts,
  metadata->>'player_name' as player,
  metadata->>'sport' as sport,
  created_at
FROM pick_publish
WHERE channel = 'CANARY'
  AND created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;
```

### Pass Criteria
- ✅ Both approvals succeed
- ✅ Both promotions return success
- ✅ pick_publish records exist with status='pending'

**Record in run log:** PHASE 4 section (include publishId values)

---

## 💬 PHASE 5: DISCORD VERIFICATION (10 min)

**Purpose:** Verify formatted messages appear in CANARY Discord channel.

### Monitor Worker Logs
```powershell
./dev.sh logs api --follow | Select-String "Discord|Publishing|pick_publish"
```

**Expected sequence:**
```
[DiscordPublishingWorker] Fetching pending publish records...
[DiscordPublishingWorker] Found 2 pending records
[DiscordPublishingWorker] Processing publish record...
[DiscordBot] Message sent successfully
[DiscordPublishingWorker] Updated publish record status=sent
```

### Check Discord Channel

1. **Open Discord app**
2. **Navigate to channel:** 1296531122234327100
3. **Wait up to 30 seconds**
4. **Verify 2 messages appear with:**
   - Player names (LeBron James, Zach Edey)
   - Market (Points)
   - Lines (25.5 OVER, 20.5 UNDER)
   - Odds (-115, +105)
   - Capper (GriffTest, Tier B)
   - Confidence (80%, 70%)
   - Proper formatting & emojis

### Verification SQL

```sql
SELECT
  id,
  status,
  external_message_id,
  sent_at,
  attempts,
  metadata->>'error' as error_msg
FROM pick_publish
WHERE channel = 'CANARY'
  AND created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;
```

### Pass Criteria
- ✅ Both messages appear within 15 seconds
- ✅ Correct CANARY channel (not production)
- ✅ Player names, lines, odds correct
- ✅ Proper formatting
- ✅ pick_publish.status = 'sent'
- ✅ external_message_id populated

**Record in run log:** PHASE 5 section (include message URLs, screenshots)

---

## 🔄 PHASE 6: WORKFLOWS & DLQ (5 min)

**Purpose:** Verify Temporal workflows completed, no DLQ entries.

### Check Temporal UI

1. **Open:** http://localhost:8088
2. **Navigate:** Workflows → Recent Workflows
3. **Filter:** WorkflowType = "TicketLifecycleWorkflow"
4. **Verify:**
   - 2 workflows visible
   - Status: "Completed" (green checkmark)
   - Duration: < 10 seconds

### Check DLQ (Dead Letter Queue)

```sql
SELECT
  id,
  record_type,
  record_id,
  failure_reason,
  attempts,
  created_at
FROM dead_letter_queue
WHERE record_type = 'pick_publish'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Expected: 0 rows (empty result)**

### Check Error Logs

```powershell
./dev.sh logs | Select-String "ERROR" | Select-Object -Last 50
```

**Expected: No errors related to pick promotion or Discord publishing**

### Pass Criteria
- ✅ 2 workflows completed successfully
- ✅ Workflow duration < 10 seconds
- ✅ Zero DLQ entries
- ✅ No ERROR logs for our test

**Record in run log:** PHASE 6 section

---

## 📊 PHASE 7: RECAP - OPTIONAL (7 min)

**Purpose:** Test daily recap generation (only if time permits).

### Trigger Recap

```powershell
curl -X POST http://localhost:3010/ops/generate-recap `
  -H "Authorization: Bearer admin-test-token" `
  -H "Content-Type: application/json" `
  -d '{
    "date": "2025-12-03",
    "sports": ["NBA", "NCAAB"],
    "force": true
  }'
```

### Verify Recap Created

```sql
SELECT
  id,
  recap_date,
  sport,
  pick_ids,
  metadata->>'totalPicks' as total_picks,
  metadata->>'approvedPicks' as approved_picks,
  published
FROM daily_recaps
WHERE recap_date = '2025-12-03'
  AND sport IN ('NBA', 'NCAAB')
ORDER BY recap_date DESC;
```

### Pass Criteria
- ✅ Recap record created
- ✅ pick_ids includes our test picks
- ✅ Statistics accurate

**Record in run log:** PHASE 7 section

---

## 🧹 POST-TEST CLEANUP

### Tag Test Picks

```sql
-- Flag test picks to exclude from analytics
UPDATE picks
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{is_test}',
  'true'
)
WHERE user_id = '<TEST_CAPPER_ID>'
  AND created_at > NOW() - INTERVAL '1 hour';

UPDATE pick_publish
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{is_test}',
  'true'
)
WHERE pick_id IN (
  SELECT id FROM picks
  WHERE user_id = '<TEST_CAPPER_ID>'
    AND created_at > NOW() - INTERVAL '1 hour'
);
```

---

## ✅ FINAL DECISION

**Go to run log and fill out the BINARY DECISION section:**

### System Works? Circle ONE:

**✅ YES** - All phases passed, system ready for production rollout

**❌ NO** - Critical blockers identified, fixes required

**Fill out:**
- Justification for each phase (PASS/FAIL)
- Overall confidence (LOW/MEDIUM/HIGH)
- Recommendation (READY / NEEDS FIXES / NOT READY)
- Next steps

---

## 📁 EVIDENCE STORAGE

**Create directory:**
```powershell
mkdir "docs\ops\live_fire_run_2025-12-03_evidence"
```

**Store:**
- Screenshots of Command Center
- Screenshots of Discord messages
- Console output logs
- SQL query results
- Temporal workflow screenshots
- Error logs (if any)

---

## 🆘 TROUBLESHOOTING QUICK REF

| Issue | Quick Fix |
|-------|-----------|
| Smoke test fails | Check DISCORD_TOKEN and CANARY_CHANNEL_ID in .env |
| Zero props ingested | Check ODDS_API_KEY quota, verify API is up |
| Picks not in DB | Verify PICK_DRIVER=canonical in .env |
| Picks not in Command Center | Hard refresh browser (Ctrl+Shift+R) |
| Promotion fails | Ensure picks are approved first |
| No Discord messages | Check DiscordPublishingWorker is running: `./dev.sh status` |
| Wrong Discord channel | Verify DISCORD_WEBHOOK_URL NOT used, using CANARY resolver |
| Workflows stuck | Check Temporal worker: `./dev.sh logs api | Select-String Temporal` |

---

## 📞 EMERGENCY STOP

**If critical failure occurs:**

1. **Stop services:**
```powershell
./dev.sh stop
```

2. **Capture logs:**
```powershell
./dev.sh logs > emergency_logs_2025-12-03.txt
```

3. **Flag test data (DO NOT DELETE):**
```sql
UPDATE picks
SET metadata = jsonb_set(metadata, '{is_test_failed}', 'true')
WHERE user_id = '<TEST_CAPPER_ID>'
  AND created_at > NOW() - INTERVAL '2 hours';
```

4. **Document in run log and investigate before retry**

---

## ⏱️ TIME BUDGET

- **Pre-flight:** 15 min
- **Phase 0:** 3 min (smoke test)
- **Phase 1:** 10 min (ingestion)
- **Phase 2:** 5 min (submit picks)
- **Phase 3:** 3 min (Command Center)
- **Phase 4:** 5 min (approve & promote)
- **Phase 5:** 10 min (Discord verify)
- **Phase 6:** 5 min (workflows/DLQ)
- **Phase 7:** 7 min (recap - OPTIONAL)
- **Cleanup:** 5 min

**TOTAL: ~60-70 minutes**

---

**REMEMBER:**
1. Use this guide for COMMANDS
2. Use `docs/ops/live_fire_run_2025-12-03.md` for RECORDING RESULTS
3. Use `WEDNESDAY_LIVE_FIRE_TEST_PLAN.md` for BACKGROUND DETAILS

**Good luck! 🚀**

---

**Version:** 1.0
**Created:** 2025-12-03
**Owner:** Platform Engineering Team
