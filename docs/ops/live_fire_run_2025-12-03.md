# LIVE-FIRE TEST RUN LOG - DECEMBER 3, 2025

**Date/Time Started:** 2025-12-03 [Fill in start time: ___:___ ET]
**Environment:** PRODUCTION CANARY
**Target Sports:** NBA + NCAAB (College Basketball)
**CANARY Channel ID:** 1296531122234327100
**Operator:** Griff
**Test Capper:** GriffTest
**Reference:** WEDNESDAY_LIVE_FIRE_TEST_PLAN.md

---

## QUICK DECISION MATRIX

At the end of this test, circle ONE:

### ✅ YES - System Works As Intended
All critical requirements met. System is ready for production rollout.

### ❌ NO - System Does NOT Work
Critical blockers identified. Investigation and fixes required before go-live.

**Signature:** _________________ **Date:** _________ **Time:** _____

---

## PHASE STATUS TABLE

| Phase | Description | Status | Notes | Evidence |
|-------|-------------|--------|-------|----------|
| **PHASE 0** | CANARY Smoke Test | ⬜ PASS ⬜ FAIL | | |
| **PHASE 1** | Live Data Ingestion (NBA + NCAAB) | ⬜ PASS ⬜ FAIL | | |
| **PHASE 2** | Submit Picks (via Smart Form API) | ⬜ PASS ⬜ FAIL | | |
| **PHASE 3** | Command Center Verification | ⬜ PASS ⬜ FAIL | | |
| **PHASE 4** | Approval & Promotion | ⬜ PASS ⬜ FAIL | | |
| **PHASE 5** | Discord Verification | ⬜ PASS ⬜ FAIL | | |
| **PHASE 6** | Workflows & DLQ | ⬜ PASS ⬜ FAIL | | |
| **PHASE 7** | Recap (OPTIONAL) | ⬜ PASS ⬜ FAIL ⬜ SKIP | | |

**Overall Test Result:** ⬜ PASS ⬜ FAIL

---

## PRE-TEST ENVIRONMENT CHECK

**Date/Time:** ___:___ ET

### Environment Variables
```bash
# Verify critical settings
Get-Content .env | Select-String "PICK_DRIVER|PUBLISH_MODE|SHADOW_MODE|DISCORD_CANARY_CHANNEL_ID"
```

**Results:**
- [ ] PICK_DRIVER=canonical ✅
- [ ] PUBLISH_MODE=outbox ✅
- [ ] SHADOW_MODE=false ✅
- [ ] DISCORD_CANARY_CHANNEL_ID=1296531122234327100 ✅
- [ ] ODDS_API_KEY is set ✅
- [ ] DISCORD_TOKEN is set ✅

**Issues:** _________________________________________

### Services Health
```bash
./dev.sh start
./dev.sh status
```

**Results:**
- [ ] PostgreSQL: Running ✅
- [ ] Redis: Running ✅
- [ ] Temporal: Running ✅
- [ ] API Server: Healthy ✅
- [ ] Discord Bot: Logged in ✅
- [ ] Workers: Running ✅

**Issues:** _________________________________________

### Test Capper Account Created

**SQL to run in Supabase Dashboard:**
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

**Test Capper UUID:** ___________________________________________
**Stored in:** $env:TEST_CAPPER_ID

---

## PHASE 0: CANARY SMOKE TEST 🧪

**Start Time:** ___:___ ET
**Duration Target:** 3 minutes

### What To Do

1. **Run the smoke test script:**
```powershell
npx tsx scripts/test_discord_canary.ts
```

2. **Expected Console Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 DISCORD CANARY CHANNEL SMOKE TEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Configuration Check:
   ✅ CANARY Channel ID: 1296531122234327100
   ✅ Discord Token: ***configured***

✅ Discord client connected
✅ Discord bot ready: YourBot#1234
✅ CANARY channel fetched successfully
✅ Test message sent successfully!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ CANARY SMOKE TEST PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

3. **Manual Verification in Discord:**
   - Open Discord channel ID: 1296531122234327100
   - Verify gold-colored embed appears with:
     - Title: "🧪 CANARY SMOKE TEST"
     - Test timestamp
     - Safety checks confirmed

### What We Observed

**Console Output:**
```
[Paste actual output here]
```

**Discord Channel:**
- [ ] Message visible in CANARY channel ✅
- [ ] Gold color (#FFD700) ✅
- [ ] Contains test timestamp ✅
- [ ] Formatting looks correct ✅

**Message URL:** ___________________________________________

### Pass/Fail & Why

**Status:** ⬜ PASS ⬜ FAIL

**Pass Criteria:**
- ✅ Script exits with code 0
- ✅ Test message appears in Discord CANARY channel
- ✅ Message is gold-colored
- ✅ No error messages in console

**Failure Criteria:**
- ❌ Script exits with error
- ❌ No message appears in Discord
- ❌ Message appears in wrong channel
- ❌ Discord token/channel ID errors

**Decision:** _________________________________________

**Evidence:** Screenshot/logs at: _________________________________________

**End Time:** ___:___ ET
**Duration:** _____ minutes

---

## PHASE 1: LIVE DATA INGESTION (NBA + NCAAB)

**Start Time:** ___:___ ET
**Duration Target:** 10 minutes

### What To Do

1. **Verify today's date:**
```powershell
Get-Date -Format "yyyy-MM-dd"
# Expected: 2025-12-03 ✅
```

2. **Trigger live data ingestion:**

**Option A - If FeedAgent is running:**
```powershell
curl -X POST http://localhost:3010/ops/feed/refresh `
  -H "Authorization: Bearer admin-test-token" `
  -H "Content-Type: application/json" `
  -d '{
    "sports": ["NBA", "NCAAB"],
    "forceRefresh": true
  }'
```

**Option B - Direct ingestion script:**
```powershell
npx tsx apps/api/scripts/live-odds-ingestion-test.ts --sports NBA,NCAAB --limit 100
```

3. **Verify props ingested (SQL in Supabase Dashboard):**
```sql
-- Check props ingested in last 10 minutes
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

4. **Verify canonical IDs assigned:**
```sql
SELECT
  id,
  sport,
  player_name,
  stat_type,
  line,
  over_odds,
  under_odds,
  canonical_player_id IS NOT NULL as has_player_id,
  canonical_game_id IS NOT NULL as has_game_id
FROM raw_props
WHERE sport IN ('NBA', 'NCAAB')
  AND created_at > NOW() - INTERVAL '10 minutes'
LIMIT 10;
```

### What We Observed

**Ingestion Command Output:**
```
[Paste actual output here]
```

**SQL Query Results:**

**Props Count:**
- NBA: ______ props
- NCAAB: ______ props
- **TOTAL: ______ props** (Target: 50+)

**Canonical ID Coverage:**
- Props with canonical_player_id: ______ / ______ (Target: 80%+)
- Props with canonical_game_id: ______ / ______ (Target: 80%+)

**Sample Props:**
```
[Paste sample rows here]
```

**Ingestion Duration:** _____ seconds (Target: < 120s)

### Pass/Fail & Why

**Status:** ⬜ PASS ⬜ FAIL

**Pass Criteria:**
- ✅ At least 50 total props ingested (NBA + NCAAB)
- ✅ Ingestion completed within 2 minutes
- ✅ At least 80% have canonical_player_id populated
- ✅ At least 80% have canonical_game_id populated
- ✅ No errors in API logs

**Failure Criteria:**
- ❌ Zero props ingested
- ❌ Ingestion takes > 5 minutes
- ❌ Canonical IDs are NULL for all props
- ❌ API logs show critical errors

**Decision:** _________________________________________

**Evidence:** Logs/screenshots at: _________________________________________

**End Time:** ___:___ ET
**Duration:** _____ minutes

---

## PHASE 2: SUBMIT REAL PICKS (via API)

**Start Time:** ___:___ ET
**Duration Target:** 5 minutes

### What To Do

1. **Set test capper ID:**
```powershell
$env:TEST_CAPPER_ID = "<paste-uuid-from-pre-test>"
```

2. **Submit Pick #1 (NBA):**
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

3. **Submit Pick #2 (NCAAB) - OPTIONAL:**
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

4. **Verify in database:**
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

### What We Observed

**Pick #1 Response:**
```json
[Paste actual API response here]
```
- pickId: ___________________________________________
- status: ___________________________________________

**Pick #2 Response:**
```json
[Paste actual API response here]
```
- pickId: ___________________________________________
- status: ___________________________________________

**Database Verification:**
```
[Paste SQL results here]
```

### Pass/Fail & Why

**Status:** ⬜ PASS ⬜ FAIL

**Pass Criteria:**
- ✅ Both picks return `success: true`
- ✅ Each pick has valid pickId (UUID format)
- ✅ Picks show workflow_stage='pending_review'
- ✅ Picks have status='pending'
- ✅ Database query shows picks with complete metadata

**Failure Criteria:**
- ❌ API returns error (400, 500 status codes)
- ❌ pickId is null or undefined
- ❌ Picks not visible in database
- ❌ workflow_stage is null or incorrect

**Decision:** _________________________________________

**Evidence:** Logs/screenshots at: _________________________________________

**Pick IDs for Phase 4:**
- Pick #1 UUID: ___________________________________________
- Pick #2 UUID: ___________________________________________

**End Time:** ___:___ ET
**Duration:** _____ minutes

---

## PHASE 3: COMMAND CENTER VERIFICATION

**Start Time:** ___:___ ET
**Duration Target:** 3 minutes

### What To Do

1. **Open Command Center:**
   - URL: http://localhost:3004 (or your Command Center URL)
   - Navigate to "Pending Picks" section

2. **Look for GriffTest picks:**
   - Filter by capper: GriffTest
   - Filter by date: Today (2025-12-03)

3. **API Verification (if UI not working):**
```powershell
curl -H "Authorization: Bearer admin-test-token" `
  "http://localhost:3010/api/ops/picks/pending?capper=GriffTest" `
  | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### What We Observed

**Command Center UI:**
- [ ] Both picks visible ✅
- [ ] Player names displayed correctly ✅
- [ ] Market types shown (POINTS) ✅
- [ ] Lines and sides correct (25.5 OVER, 20.5 UNDER) ✅
- [ ] Odds accurate (-115, +105) ✅
- [ ] Confidence scores shown (80, 70) ✅
- [ ] Capper name = GriffTest ✅
- [ ] Status badge = "Pending Review" ✅
- [ ] Action buttons (Approve, Reject) clickable ✅

**API Response:**
```json
[Paste API response if used instead of UI]
```

**Screenshots:** _________________________________________

### Pass/Fail & Why

**Status:** ⬜ PASS ⬜ FAIL

**Pass Criteria:**
- ✅ Both picks visible in Command Center UI
- ✅ All metadata fields populated and accurate
- ✅ Real-time updates work (no page refresh needed)
- ✅ Action buttons are enabled

**Failure Criteria:**
- ❌ Picks not visible in UI
- ❌ Metadata incomplete or incorrect
- ❌ UI shows errors or loads indefinitely
- ❌ Buttons disabled or non-functional

**Decision:** _________________________________________

**Evidence:** Screenshots at: _________________________________________

**End Time:** ___:___ ET
**Duration:** _____ minutes

---

## PHASE 4: APPROVAL & PROMOTION

**Start Time:** ___:___ ET
**Duration Target:** 5 minutes

### What To Do

**Step 4A: Approve Picks (via Command Center UI)**

1. Click "Approve" button on Pick #1 (NBA pick)
2. Wait for confirmation message
3. Click "Approve" button on Pick #2 (NCAAB pick)
4. Verify status badge changes to "Approved"

**Step 4B: Promote Picks (via Manual Script)**

1. **Promote Pick #1:**
```powershell
npx tsx scripts/manual_promote_pick.ts `
  --pickId=<PICK_1_UUID> `
  --channel=CANARY
```

2. **Promote Pick #2:**
```powershell
npx tsx scripts/manual_promote_pick.ts `
  --pickId=<PICK_2_UUID> `
  --channel=CANARY
```

3. **Verify pick_publish records:**
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

### What We Observed

**Pick #1 Approval:**
- [ ] Approved successfully ✅
- [ ] Status changed to "Approved" ✅
- Timestamp: ___:___ ET

**Pick #2 Approval:**
- [ ] Approved successfully ✅
- [ ] Status changed to "Approved" ✅
- Timestamp: ___:___ ET

**Pick #1 Promotion Output:**
```
[Paste script output here]
```
- publishId: ___________________________________________

**Pick #2 Promotion Output:**
```
[Paste script output here]
```
- publishId: ___________________________________________

**Database Verification:**
```
[Paste SQL results showing pick_publish records]
```

### Pass/Fail & Why

**Status:** ⬜ PASS ⬜ FAIL

**Pass Criteria:**
- ✅ Both picks approved successfully (workflow_stage='approved')
- ✅ Promotion script returns success: true for both
- ✅ Each promotion returns valid publishId
- ✅ pick_publish records exist with status='pending'
- ✅ Metadata includes player name, sport, odds, line

**Failure Criteria:**
- ❌ Approval fails with error message
- ❌ Promotion script returns error
- ❌ No pick_publish records created
- ❌ Metadata incomplete in pick_publish

**Decision:** _________________________________________

**Evidence:** Logs at: _________________________________________

**End Time:** ___:___ ET
**Duration:** _____ minutes

---

## PHASE 5: DISCORD VERIFICATION

**Start Time:** ___:___ ET
**Duration Target:** 10 minutes

### What To Do

1. **Monitor worker logs:**
```powershell
./dev.sh logs api --follow | Select-String "Discord|Publishing|pick_publish"
```

Expected log sequence:
```
[DiscordPublishingWorker] Fetching pending publish records...
[DiscordPublishingWorker] Found 2 pending records
[DiscordPublishingWorker] Processing publish record...
[DiscordPublishingWorker] Building Discord embed for...
[DiscordPublishingWorker] Sending to Discord channel CANARY
[DiscordBot] Message sent successfully
[DiscordPublishingWorker] Updated publish record status=sent
```

2. **Check Discord CANARY channel:**
   - Open Discord application
   - Navigate to channel ID: 1296531122234327100
   - Wait up to 30 seconds for messages to appear

3. **Verify pick_publish status:**
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

### What We Observed

**Worker Logs:**
```
[Paste relevant worker log lines here]
```

**Discord Channel:**

**Message #1 (NBA Pick):**
- [ ] Message appeared ✅
- [ ] Correct channel (CANARY) ✅
- [ ] Player name: _________________ (Expected: LeBron James)
- [ ] Market: _________________ (Expected: Points)
- [ ] Pick: _________________ (Expected: OVER 25.5)
- [ ] Odds: _________________ (Expected: -115)
- [ ] Units: _________________ (Expected: 1u)
- [ ] Capper: _________________ (Expected: GriffTest, Tier B)
- [ ] Confidence: _________________ (Expected: 80%)
- [ ] Proper formatting and emojis ✅
- Message URL: ___________________________________________
- Time to appear: _____ seconds (Target: < 15s)

**Message #2 (NCAAB Pick):**
- [ ] Message appeared ✅
- [ ] Correct channel (CANARY) ✅
- [ ] Player name: _________________ (Expected: Zach Edey)
- [ ] Market: _________________ (Expected: Points)
- [ ] Pick: _________________ (Expected: UNDER 20.5)
- [ ] Odds: _________________ (Expected: +105)
- [ ] Units: _________________ (Expected: 0.5u)
- [ ] Capper: _________________ (Expected: GriffTest, Tier B)
- [ ] Confidence: _________________ (Expected: 70%)
- [ ] Proper formatting and emojis ✅
- Message URL: ___________________________________________
- Time to appear: _____ seconds (Target: < 15s)

**Database Status:**
```
[Paste SQL results showing sent status and external_message_id]
```

**Screenshots:** _________________________________________

### Pass/Fail & Why

**Status:** ⬜ PASS ⬜ FAIL

**Pass Criteria:**
- ✅ Both Discord messages appear within 15 seconds
- ✅ Messages in CANARY channel (not production)
- ✅ Player names correct
- ✅ Market types correct (POINTS)
- ✅ Lines and odds accurate
- ✅ Capper tier shown (Tier B)
- ✅ Confidence scores displayed
- ✅ Proper formatting and emojis
- ✅ pick_publish.status = 'sent'
- ✅ pick_publish.external_message_id populated

**Failure Criteria:**
- ❌ No messages appear after 30 seconds
- ❌ Messages go to wrong channel
- ❌ Player names incorrect
- ❌ Metadata missing or wrong
- ❌ pick_publish.status = 'failed'
- ❌ Worker logs show errors

**Decision:** _________________________________________

**Evidence:** Screenshots/logs at: _________________________________________

**End Time:** ___:___ ET
**Duration:** _____ minutes

---

## PHASE 6: WORKFLOWS & DLQ

**Start Time:** ___:___ ET
**Duration Target:** 5 minutes

### What To Do

1. **Check Temporal UI:**
   - URL: http://localhost:8088
   - Navigate to: Workflows → Recent Workflows
   - Filter by: WorkflowType = "TicketLifecycleWorkflow"

2. **Verify workflows:**
   - [ ] 2 workflows visible (one per pick) ✅
   - [ ] Status: "Completed" (green checkmark) ✅
   - [ ] Duration: < 10 seconds ✅

3. **Check DLQ (Dead Letter Queue):**
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
Expected: 0 rows (no DLQ entries)

4. **Check error logs:**
```powershell
./dev.sh logs | Select-String "ERROR" | Select-Object -Last 50
```
Expected: No errors related to pick promotion or Discord publishing

5. **Check Prometheus metrics (if available):**
```powershell
curl "http://localhost:9090/api/v1/query?query=discord_publishing_errors_total" | ConvertFrom-Json
```
Expected: No increase in error counter

### What We Observed

**Temporal Workflows:**

**Workflow #1:**
- Workflow ID: ___________________________________________
- Status: ___________________________________________
- Duration: _____ seconds
- Activities completed: ___________________________________________

**Workflow #2:**
- Workflow ID: ___________________________________________
- Status: ___________________________________________
- Duration: _____ seconds
- Activities completed: ___________________________________________

**DLQ Check Results:**
```
[Paste SQL results - should be empty]
```
- DLQ entries for our picks: _____ (Target: 0)

**Error Log Check:**
```
[Paste any ERROR lines related to our test, or "NONE" if clean]
```

**Prometheus Metrics:**
```
[Paste metrics results if available]
```

**Screenshots:** _________________________________________

### Pass/Fail & Why

**Status:** ⬜ PASS ⬜ FAIL

**Pass Criteria:**
- ✅ 2 workflows completed successfully
- ✅ All activities completed without errors
- ✅ Workflow duration < 10 seconds
- ✅ Zero DLQ entries for pick_publish
- ✅ No ERROR logs related to promotion/publishing
- ✅ Worker error counters unchanged

**Failure Criteria:**
- ❌ Workflows stuck in "Running" state
- ❌ Workflows failed with errors
- ❌ DLQ has entries for our picks
- ❌ ERROR logs show critical failures
- ❌ Worker error counters increased

**Decision:** _________________________________________

**Evidence:** Screenshots/logs at: _________________________________________

**End Time:** ___:___ ET
**Duration:** _____ minutes

---

## PHASE 7: RECAP (OPTIONAL)

**Start Time:** ___:___ ET
**Duration Target:** 7 minutes

**Note:** Only run if time permits and you want to test the recap system.

### What To Do

1. **Trigger recap for today:**
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

2. **Verify recap created:**
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

3. **Check Discord for recap message (if published)**

### What We Observed

**Recap Trigger Response:**
```json
[Paste API response here]
```

**Database Verification:**
```
[Paste SQL results here]
```

**Discord Recap:**
- [ ] Recap message appeared in Discord ✅
- [ ] Our test picks included in recap ✅
- [ ] Statistics accurate ✅

### Pass/Fail & Why

**Status:** ⬜ PASS ⬜ FAIL ⬜ SKIP

**Pass Criteria:**
- ✅ Recap record created for today
- ✅ pick_ids array includes our test pick IDs
- ✅ Statistics accurate
- ✅ Discord recap message sent (if applicable)

**Failure Criteria:**
- ❌ No recap record created
- ❌ Our picks not included
- ❌ Statistics zero or wrong

**Decision:** _________________________________________

**Evidence:** Logs/screenshots at: _________________________________________

**End Time:** ___:___ ET
**Duration:** _____ minutes

---

## POST-TEST VALIDATION

### Database Consistency Check

```sql
-- Verify complete data flow
SELECT
  p.id as pick_id,
  p.selection,
  p.workflow_stage,
  p.status as pick_status,
  pp.id as publish_id,
  pp.status as publish_status,
  pp.external_message_id
FROM picks p
LEFT JOIN pick_publish pp ON p.id = pp.pick_id
WHERE p.user_id = '<TEST_CAPPER_ID>'
  AND p.created_at > NOW() - INTERVAL '1 hour'
ORDER BY p.created_at DESC;
```

**Results:**
```
[Paste SQL results here]
```

### Tag Test Picks for Exclusion

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

**Rows Updated:**
- picks: _____ rows
- pick_publish: _____ rows

---

## BINARY DECISION FRAMEWORK

### ✅ YES - System Works As Intended IF:

**Critical Requirements (ALL MUST PASS):**

1. ✅ **Data Ingestion:** 50+ live props from Odds API (NBA + NCAAB)
2. ✅ **Pick Submission:** 2 picks submitted successfully via API
3. ✅ **Command Center:** All picks visible with complete metadata
4. ✅ **Approval:** Both picks approved via UI without errors
5. ✅ **Promotion:** Both picks promoted to pick_publish table
6. ✅ **Discord Publishing:** 2 formatted messages in CANARY channel within 15 seconds
7. ✅ **Message Quality:** All Discord messages include player, odds, tier, confidence, line
8. ✅ **Workflows:** 2 Temporal workflows completed successfully
9. ✅ **Zero Errors:** No DLQ entries, no failed publish records, no critical ERROR logs
10. ✅ **Database Integrity:** All picks → pick_publish → Discord chain complete

**Extended Validation (SHOULD PASS):**

11. ✅ **Professional Grading:** Messages include professional score if USE_PRO_SCORER=true
12. ✅ **CLV Data:** CLV tracking initiated (if CLV system enabled)
13. ✅ **Audit Trail:** Complete audit log for all operations
14. ✅ **Real-time Updates:** Command Center updates without page refresh
15. ✅ **Referential Integrity:** All database foreign keys valid

---

### ❌ NO - System Does NOT Work IF:

**Critical Failures (ANY ONE BLOCKS GO-LIVE):**

1. ❌ Zero props ingested from Odds API
2. ❌ Pick submission fails with API errors
3. ❌ Picks not visible in Command Center
4. ❌ Approval process fails or errors out
5. ❌ Promotion fails (no pick_publish records)
6. ❌ No Discord messages appear after 60 seconds
7. ❌ Discord messages missing critical data (player, odds, line)
8. ❌ Workflows fail or get stuck
9. ❌ DLQ entries for our test picks
10. ❌ Critical ERROR logs indicate system instability

**Moderate Issues (INVESTIGATE BEFORE GO-LIVE):**

11. ⚠️ Ingestion takes > 5 minutes
12. ⚠️ Discord messages delayed > 60 seconds
13. ⚠️ Metadata incomplete in some fields
14. ⚠️ Worker retries needed (attempts > 1)
15. ⚠️ Performance slower than expected

---

## FINAL DECISION STATEMENT

**Test Completion Time:** ___:___ ET
**Total Duration:** _____ minutes
**Test Operator:** Griff
**Environment:** Production Canary
**Sports Tested:** NBA + NCAAB
**Picks Submitted:** _____
**Discord Messages Sent:** _____

### System Works As Intended: ⬜ **YES** ⬜ **NO**

**Justification:**

**Data Ingestion:** ⬜ PASS ⬜ FAIL
_Details: ___________________________________________

**Pick Submission:** ⬜ PASS ⬜ FAIL
_Details: ___________________________________________

**Command Center:** ⬜ PASS ⬜ FAIL
_Details: ___________________________________________

**Approval & Promotion:** ⬜ PASS ⬜ FAIL
_Details: ___________________________________________

**Discord Publishing:** ⬜ PASS ⬜ FAIL
_Details: ___________________________________________

**Workflows & DLQ:** ⬜ PASS ⬜ FAIL
_Details: ___________________________________________

---

### Overall Confidence: ⬜ LOW ⬜ MEDIUM ⬜ HIGH

---

### Recommendation:

**Choose ONE:**

- [ ] ✅ **READY FOR PRODUCTION** - All systems working correctly, proceed with full rollout
- [ ] ⚠️ **NEEDS MINOR FIXES** - Small issues to address before production, retest specific phases
- [ ] ❌ **NOT READY** - Critical failures require investigation and major fixes

---

### Next Steps:

**Immediate Actions (within 24 hours):**
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

**Short-term Actions (within 1 week):**
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

**Blockers Identified:**
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

---

### Critical Issues Summary

**If NO, list all critical issues that blocked the test:**

1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

**Root Cause Analysis:**
___________________________________________
___________________________________________
___________________________________________

**Fix Plan:**
___________________________________________
___________________________________________
___________________________________________

---

## EVIDENCE ARCHIVE

**All evidence should be stored in:** `docs/ops/live_fire_run_2025-12-03_evidence/`

- [ ] Screenshots of Command Center picks
- [ ] Screenshots of Discord CANARY messages
- [ ] Console logs from all commands
- [ ] SQL query results
- [ ] Temporal workflow screenshots
- [ ] Error logs (if any failures)
- [ ] Worker logs showing publishing
- [ ] Pick promotion script outputs

---

## APPROVALS

**Test Conducted By:**
Name: _________________
Signature: _________________
Date/Time: _________________

**Results Reviewed By:**
Name: _________________
Signature: _________________
Date/Time: _________________

---

**END OF RUN LOG**

**Version:** 1.0
**Created:** 2025-12-03
**Last Updated:** 2025-12-03
**Owner:** Platform Engineering Team
