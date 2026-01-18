# Quick Start - Windows PowerShell

**Purpose:** Fast-track guide to execute runtime proofs on Windows

---

## Prerequisites (5 minutes)

```powershell
# 1. Check Node.js
node --version
# Need: v18.x.x or v20.x.x
# Install: https://nodejs.org/en/download/

# 2. Install Supabase CLI
npm install -g supabase

# 3. Verify installation
supabase --version
# Expected: supabase version 1.x.x
```

---

## Setup Environment (5 minutes)

```powershell
# Navigate to repo
cd C:\Users\griff\OneDrive\Desktop\unit-talk-production-main

# Copy .env.example to .env
Copy-Item .env.example .env

# Edit .env with your values:
# - SUPABASE_PROJECT_REF=your-project-ref
# - SUPABASE_ACCESS_TOKEN=sbp_your_token
# - DATABASE_DIRECT_URL=postgresql://...
# - SUPABASE_READONLY_DATABASE_URL_DEV=postgresql://...

# Load environment variables
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}

# Verify variables loaded
$env:SUPABASE_PROJECT_REF
# Should output: your-project-ref (not empty)

# Install dependencies
npm ci
```

---

## Phase 1: Trigger GitHub Actions (10 minutes)

**Cannot be done via PowerShell - use GitHub Web UI:**

### Dry Run

1. Go to: `https://github.com/[YOUR_ORG]/unit-talk-production/actions`
2. Click: **"Supabase Migrations CI/CD"**
3. Click: **"Run workflow"** (top right)
4. Configure:
   - Branch: `main`
   - Environment: `dev`
   - Dry run: ✅ `true`
5. Click: **"Run workflow"**
6. Wait for completion (~3-5 minutes)
7. **Copy the workflow run URL** (e.g., `https://github.com/.../actions/runs/123456`)

### Real Run

1. Same steps as above, but set:
   - Dry run: ❌ `false`
2. Wait for completion (~3-5 minutes)
3. **Copy the workflow run URL**

**Save both URLs in `docs/ops/PROOF_PACK_ACTIVATION.md`**

---

## Phase 2: Test Safe SQL Queries (5 minutes)

```powershell
# Test 1: Verify autopilot_decisions exists
npx tsx scripts\ops\supabase-query.ts --env dev "SELECT to_regclass('public.autopilot_decisions')"
# Expected: autopilot_decisions

# Test 2: Count rows
npx tsx scripts\ops\supabase-query.ts --env dev "SELECT COUNT(*) FROM autopilot_decisions"
# Expected: 0 (for fresh deployment)

# Test 3: Test helper function
npx tsx scripts\ops\supabase-query.ts --env dev "SELECT * FROM get_daily_autopilot_report()"
# Expected: All zeros (for fresh deployment)

# Test 4: Verify alert_events exists
npx tsx scripts\ops\supabase-query.ts --env dev "SELECT to_regclass('public.alert_events')"
# Expected: alert_events (or NULL if not created yet)
```

---

## Phase 3: Test Security (2 minutes)

```powershell
# Test blocked queries (should all fail)
npx tsx scripts\ops\supabase-query.ts --env dev "DROP TABLE picks"
# Expected: ❌ Blocked pattern detected

npx tsx scripts\ops\supabase-query.ts --env dev "DELETE FROM picks"
# Expected: ❌ Blocked pattern detected

npx tsx scripts\ops\supabase-query.ts --env dev "SELECT pg_read_file('/etc/passwd')"
# Expected: ❌ Dangerous function blocked
```

---

## Phase 4: Test Credential Redaction (1 minute)

```powershell
npx tsx scripts\ops\supabase-query.ts --env dev "SELECT 'sbp_abc123' as token, 'postgresql://user:pass@host/db' as url"
# Expected: sbp_****, postgresql://****:****@host/db
```

---

## Phase 5: Test PowerShell Scripts (5 minutes)

```powershell
# Test migration script (dry run)
.\scripts\ops\Test-SupabaseMigrations.ps1 -DryRun
# Expected: Shows migration plan, no changes applied

# Verify schema
.\scripts\ops\Verify-SupabaseSchema.ps1 -Environment dev
# Expected: All 8 tables verified ✅

# Verify autopilot_decisions comprehensively
.\scripts\ops\Verify-AutopilotDecisions.ps1 -Environment dev
# Expected: 5/5 checks pass ✅

# Test safe query wrapper
.\scripts\ops\Test-SafeQuery.ps1 -Query "SELECT COUNT(*) FROM picks"
# Expected: Returns count
```

---

## Capture Proof (10 minutes)

**For each command above:**

1. Run the command
2. Copy the output
3. Paste into `docs/ops/PROOF_PACK_ACTIVATION.md` in the appropriate section
4. Redact any secrets (replace with ****)

**For GitHub Actions:**

1. Navigate to workflow run URL
2. Expand job logs
3. Copy relevant excerpts
4. Paste into `docs/ops/PROOF_PACK_ACTIVATION.md`
5. Redact any secrets

---

## Troubleshooting

### Error: "SUPABASE_PROJECT_REF not set"

```powershell
# Check if variable is set
$env:SUPABASE_PROJECT_REF

# If empty, reload .env
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}
```

### Error: "Supabase CLI not found"

```powershell
# Install globally
npm install -g supabase

# Verify
supabase --version
```

### Error: "tsx not found"

```powershell
# Install dependencies
npm ci

# Verify
npx tsx --version
```

### Error: "Missing connection string"

```powershell
# Check .env file has:
# SUPABASE_READONLY_DATABASE_URL_DEV=postgresql://...

# Reload environment
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}
```

---

## Total Time: ~35 minutes

- Setup: 10 minutes
- GitHub Actions: 10 minutes
- SQL queries: 5 minutes
- Security tests: 2 minutes
- Credential tests: 1 minute
- PowerShell scripts: 5 minutes
- Capture proof: 10 minutes

**Result:** Complete runtime proof that automation works end-to-end.
