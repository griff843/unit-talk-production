# SQL vs PowerShell Boundaries

**Critical Rule**: Never mix SQL queries with shell commands. They run in completely different environments.

---

## The Problem

**SQL Editor/Runner**: Only accepts SQL syntax
- ✅ `SELECT * FROM picks WHERE id = '...'`
- ❌ `cd /path/to/dir`
- ❌ `docker logs ...`
- ❌ `Get-ChildItem ...`

**PowerShell Terminal**: Only accepts PowerShell commands
- ✅ `docker compose logs api`
- ✅ `Get-ChildItem -Recurse -Filter "*.ts"`
- ❌ `SELECT * FROM picks` (unless using a database client tool)

---

## Common Mistakes (DO NOT DO THIS)

### ❌ WRONG: Mixing SQL and Shell in Same Script

```sql
-- This FAILS in SQL editor
cd apps/api/src
SELECT * FROM picks;
docker logs unit-talk-api
```

**Error**: `syntax error at or near "cd"`

### ❌ WRONG: Running PowerShell in SQL Editor

```sql
-- This FAILS
Get-ChildItem -Filter "*.ts"
docker ps
```

**Error**: `syntax error at or near "Get"`

### ❌ WRONG: Running SQL in PowerShell Without Client

```powershell
# This FAILS (PowerShell doesn't know what SELECT is)
SELECT * FROM raw_props WHERE event_time > NOW();
```

**Error**: `The term 'SELECT' is not recognized as the name of a cmdlet`

---

## ✅ CORRECT: Separate SQL and PowerShell

### Example 1: Check Database State

**PowerShell** (run in terminal):
```powershell
# Connect to database container
docker exec -it unit-talk-postgres psql -U postgres -d unit_talk_dev
```

**SQL** (run inside psql):
```sql
SELECT COUNT(*) as total,
       COUNT(*) FILTER (WHERE event_time >= NOW()) as upcoming,
       MAX(event_time) as max_event_time
FROM raw_props;
```

### Example 2: Check Logs + Database

**PowerShell** (diagnostics):
```powershell
# Check API logs for FeedAgent
docker compose logs api --since 10m | Select-String "FeedAgent"

# Check container status
docker ps --filter "name=unit-talk"
```

**SQL** (proof query - copy/paste to SQL editor):
```sql
-- Verify upcoming games exist
SELECT sport, league, matchup, event_time, odds
FROM raw_props
WHERE is_valid = true
  AND event_time >= NOW()
  AND event_time <= NOW() + INTERVAL '48 hours'
ORDER BY event_time ASC
LIMIT 10;
```

---

## Copy/Paste Templates

### Template 1: Check raw_props Window

**PowerShell** (no SQL):
```powershell
# Check if API is healthy
curl http://localhost:3010/api/health

# Check recent ingestion logs
docker compose logs api --since 30m | Select-String -Pattern "raw_props|FeedAgent"
```

**SQL** (no PowerShell - copy to SQL editor):
```sql
-- Count raw_props by time window
WITH time_buckets AS (
  SELECT
    CASE
      WHEN event_time < NOW() - INTERVAL '24 hours' THEN 'past (>24h ago)'
      WHEN event_time < NOW() THEN 'recent past (<24h)'
      WHEN event_time <= NOW() + INTERVAL '48 hours' THEN 'upcoming (0-48h)'
      ELSE 'far future (>48h)'
    END as time_bucket,
    COUNT(*) as count
  FROM raw_props
  WHERE is_valid = true
  GROUP BY 1
)
SELECT * FROM time_buckets ORDER BY time_bucket;
```

### Template 2: Verify CANARY Pick Published

**PowerShell**:
```powershell
# Run E2E test
npx tsx scripts/canary_e2e_smoke.ts
```

**SQL** (verify in database):
```sql
-- Check most recent CANARY publish
SELECT
  id,
  pick_id,
  channel,
  status,
  external_message_id,
  attempts,
  last_error,
  created_at,
  sent_at
FROM pick_publish
WHERE channel = 'CANARY'
ORDER BY created_at DESC
LIMIT 5;
```

### Template 3: Check Temporal Worker Activities

**PowerShell**:
```powershell
# Check worker logs for activity registration
docker compose logs workers --since 5m | Select-String "Activity"

# Or check API logs if workers run in API container
docker compose logs api --since 5m | Select-String "checkApiQuota|fetchFeed"
```

**SQL** (N/A - Temporal activities are not in SQL database)

---

## Windows-Specific Notes

### Use Select-String Instead of grep

❌ **Linux/Mac**:
```bash
docker logs api | grep "FeedAgent"
```

✅ **Windows PowerShell**:
```powershell
docker compose logs api | Select-String "FeedAgent"
```

### Use Get-ChildItem Instead of find

❌ **Linux/Mac**:
```bash
find . -name "*.ts" -type f
```

✅ **Windows PowerShell**:
```powershell
Get-ChildItem -Path . -Recurse -Filter "*.ts" -File
```

### Escaping Quotes in SQL

When passing SQL from PowerShell to docker exec:

❌ **WRONG** (quote hell):
```powershell
docker exec postgres psql -c "SELECT * FROM picks WHERE id = "12345""
```

✅ **CORRECT** (escape properly):
```powershell
docker exec postgres psql -c "SELECT * FROM picks WHERE id = '12345'"
```

Or use heredoc/file:
```powershell
@"
SELECT * FROM picks WHERE id = '12345';
"@ | docker exec -i postgres psql -U postgres -d unit_talk_dev
```

---

## Decision Tree: Which Tool to Use?

```
┌─ Need to query database?
│  └─ YES → Use SQL (in psql or SQL editor)
│  └─ NO  → Continue
│
├─ Need to check logs/files/containers?
│  └─ YES → Use PowerShell
│  └─ NO  → Continue
│
├─ Need to run TypeScript script?
│  └─ YES → Use PowerShell: npx tsx ...
│  └─ NO  → Continue
│
└─ Need to verify Temporal/API endpoints?
   └─ YES → Use PowerShell: curl / Invoke-WebRequest
```

---

## Diagnostic Workflow Example

**Goal**: Find why no upcoming raw_props exist

### Step 1: PowerShell Diagnostics

```powershell
# Check services running
docker ps --filter "name=unit-talk"

# Check API health
curl http://localhost:3010/api/health | ConvertFrom-Json

# Check recent FeedAgent activity
docker compose logs api --since 30m | Select-String "FeedAgent"

# Check Temporal worker status
docker compose logs workers --since 10m | Select-String "started|registered"
```

### Step 2: SQL Verification

```sql
-- Check current database state
SELECT
  COUNT(*) FILTER (WHERE event_time >= NOW()) as upcoming_count,
  MAX(event_time) as max_event_time,
  NOW() as current_time,
  MAX(event_time) - NOW() as time_until_latest
FROM raw_props
WHERE is_valid = true;

-- If max_event_time < NOW(), ingestion is not running or not fetching future events
```

### Step 3: PowerShell Fix Action

```powershell
# Option A: Trigger manual ingestion (if endpoint exists)
curl -X POST http://localhost:3010/api/ops/feed/ingest

# Option B: Restart services
docker compose restart api workers

# Option C: Check Temporal UI
Start-Process "http://localhost:8088"
```

### Step 4: SQL Proof

```sql
-- Verify fix worked
SELECT sport, matchup, event_time, odds
FROM raw_props
WHERE event_time >= NOW()
ORDER BY event_time ASC
LIMIT 5;
```

---

## Helper Scripts Location

- **PowerShell Diagnostics**: `scripts/ops/windows/canary-diagnose.ps1`
- **SQL Proof Queries**: Copy from this doc into SQL editor
- **E2E Test**: `npx tsx scripts/canary_e2e_smoke.ts` (PowerShell)

---

## Summary

| Task | Tool | Notes |
|------|------|-------|
| Query database | SQL Editor | Pure SQL only |
| Check logs | PowerShell | Use Select-String |
| Run scripts | PowerShell | npx tsx ... |
| Check containers | PowerShell | docker ps / logs |
| Verify API health | PowerShell | curl / Invoke-WebRequest |
| Proof of data | SQL Editor | SELECT queries |

**Golden Rule**: If you see `SELECT/INSERT/UPDATE/DELETE`, use SQL. Everything else uses PowerShell.
