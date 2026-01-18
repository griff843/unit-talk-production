# Doctor.ps1 Operational Runbook

**Version:** 2.0.0
**Last Updated:** 2025-01-28
**Owner:** Platform Engineering
**Purpose:** Production-grade health check and diagnostic tool for Unit Talk Platform

---

## Table of Contents

1. [Overview](#overview)
2. [Environment Variable Precedence](#environment-variable-precedence)
3. [Command Reference](#command-reference)
4. [Usage Scenarios](#usage-scenarios)
5. [Expected Outputs](#expected-outputs)
6. [Troubleshooting](#troubleshooting)
7. [CI/CD Integration](#cicd-integration)

---

## Overview

`scripts/doctor.ps1` is the foundational health check gate for Unit Talk Platform. It validates:

- **PostgreSQL connectivity** (local development database)
- **Supabase connectivity** (cloud database, per environment)
- **Command Center availability** (Next.js application)
- **Autopilot tables** (production decision schema)
- **Node.js dependencies** (package.json integrity)
- **Critical files** (configuration and environment files)

### Key Features

✅ **Automatic .env Loading**: Loads `.env` and `.env.local` with proper precedence
✅ **Fail-Closed Behavior**: Exits 1 on critical failures, exits 0 only when healthy
✅ **Secret Masking**: Never prints unmasked credentials or tokens
✅ **Multi-Environment**: Supports dev, staging, prod with environment-specific variables
✅ **CI-Friendly**: `-NoDotEnv` flag for CI environments with pre-injected secrets
✅ **Self-Test Mode**: Verify environment variable configuration without running full checks

---

## Environment Variable Precedence

The script loads environment variables in the following order (highest to lowest priority):

```
1. Process Environment (highest priority)
   ↓
2. .env.local (local overrides, gitignored)
   ↓
3. .env (repository defaults, version controlled)
```

### Precedence Rules

- **Process environment variables** (set in your shell) are **NEVER overwritten**
- **`.env.local`** variables override **`.env`** variables (if not set in process env)
- **`.env`** variables are only used if not already set

### Example Behavior

```powershell
# Scenario 1: Process env takes precedence
$env:DATABASE_URL = "postgresql://localhost:5433/custom_db"
.\scripts\doctor.ps1
# Uses postgresql://localhost:5433/custom_db (process env wins)

# Scenario 2: .env.local overrides .env
# .env contains: DATABASE_URL=postgresql://localhost:5432/dev_db
# .env.local contains: DATABASE_URL=postgresql://localhost:5433/local_db
.\scripts\doctor.ps1
# Uses postgresql://localhost:5433/local_db (.env.local wins)

# Scenario 3: .env used as fallback
# .env contains: DATABASE_URL=postgresql://localhost:5432/dev_db
# .env.local does not exist, no process env set
.\scripts\doctor.ps1
# Uses postgresql://localhost:5432/dev_db (.env wins)
```

### Disabling .env Loading

```powershell
# Use -NoDotEnv to skip .env file loading (for CI environments)
.\scripts\doctor.ps1 -NoDotEnv
# Only uses variables already in process environment
```

---

## Command Reference

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `-Environment` | `dev`\|`staging`\|`prod` | `dev` | Target environment for checks |
| `-OutputFormat` | `text`\|`json` | `text` | Output format for results |
| `-Verbose` | `[switch]` | `false` | Show detailed diagnostic output |
| `-SelfTest` | `[switch]` | `false` | Verify env var config without running full checks |
| `-NoDotEnv` | `[switch]` | `false` | Skip .env file loading (CI mode) |

### Basic Usage

```powershell
# Run all health checks for dev environment
.\scripts\doctor.ps1

# Run health checks for staging environment
.\scripts\doctor.ps1 -Environment staging

# Run health checks for production environment
.\scripts\doctor.ps1 -Environment prod

# Show verbose diagnostic output
.\scripts\doctor.ps1 -Verbose

# Output results as JSON
.\scripts\doctor.ps1 -OutputFormat json

# Run in CI mode (no .env loading)
.\scripts\doctor.ps1 -NoDotEnv
```

### Self-Test Mode

```powershell
# Check which environment variables are set (basic)
.\scripts\doctor.ps1 -SelfTest

# Check environment variables for staging
.\scripts\doctor.ps1 -Environment staging -SelfTest

# Check environment variables with masked values
.\scripts\doctor.ps1 -SelfTest -Verbose

# Example output:
========================================
SELF-TEST MODE
========================================
Environment: dev

Environment Variables Checked:

  ✅ SET SUPABASE_URL_DEV
  ✅ SET SUPABASE_SERVICE_ROLE_KEY_DEV
  ❌ NOT SET SUPABASE_READONLY_DATABASE_URL_DEV
  ✅ SET SUPABASE_PROJECT_REF_DEV
  ❌ NOT SET COMMAND_CENTER_URL_DEV
  ✅ SET DATABASE_URL
  ❌ NOT SET DATABASE_DIRECT_URL_DEV

========================================
SELF-TEST COMPLETE
========================================
```

---

## Usage Scenarios

### Scenario 1: Local Development Setup Verification

**Use Case:** New developer joining team, needs to verify environment is configured correctly.

```powershell
# Step 1: Check environment variable configuration
.\scripts\doctor.ps1 -SelfTest

# Step 2: If any variables show NOT SET, add them to .env.local
# Example .env.local:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/unit_talk_dev
# SUPABASE_URL_DEV=https://abcdefgh.supabase.co
# SUPABASE_SERVICE_ROLE_KEY_DEV=eyJhbGci...

# Step 3: Re-run SelfTest to verify
.\scripts\doctor.ps1 -SelfTest

# Step 4: Run full health checks
.\scripts\doctor.ps1

# Expected: All checks PASS, exit code 0
```

### Scenario 2: Pre-Deployment Health Check

**Use Case:** Verify staging environment before promoting to production.

```powershell
# Check staging environment health
.\scripts\doctor.ps1 -Environment staging

# If all checks pass (exit code 0), safe to deploy
# If any checks fail (exit code 1), investigate before deploying
```

### Scenario 3: CI/CD Pipeline Integration

**Use Case:** GitHub Actions workflow needs to verify environment before running tests.

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Run health checks
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          SUPABASE_URL_DEV: ${{ secrets.SUPABASE_URL_DEV }}
          SUPABASE_SERVICE_ROLE_KEY_DEV: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY_DEV }}
        run: |
          # Use -NoDotEnv to rely on GitHub secrets only
          .\scripts\doctor.ps1 -NoDotEnv -OutputFormat json
```

```powershell
# Manual CI-style run (no .env loading)
$env:DATABASE_URL = "postgresql://..."
$env:SUPABASE_URL_DEV = "https://..."
.\scripts\doctor.ps1 -NoDotEnv
```

### Scenario 4: Debugging Connection Issues

**Use Case:** Command Center health check is timing out.

```powershell
# Run with verbose output to see connection details
.\scripts\doctor.ps1 -Verbose

# Example verbose output shows:
# Testing port 3015... Open
# Testing http://localhost:3015/api/health
# Response received in 127ms
```

### Scenario 5: Validating Autopilot Schema After Migration

**Use Case:** Applied new Supabase migration, need to verify autopilot_decisions table exists.

```powershell
# Run health checks to verify schema
.\scripts\doctor.ps1

# Check output for:
# ✅ PASS: Autopilot Tables - autopilot_decisions table exists

# If FAIL, verify migration was applied:
# docker-compose exec api npm run db:migrate
```

---

## Expected Outputs

### Exit Codes

| Exit Code | Meaning | Description |
|-----------|---------|-------------|
| `0` | Success | All critical checks passed |
| `1` | Failure | One or more critical checks failed (fail-closed) |

### Success Output (All Checks Pass)

```
Unit Talk Platform Health Check
Environment: dev

[2025-01-28 10:30:45 PST] Loaded 15 new environment variables from .env files

========================================
CATEGORY: Local PostgreSQL
========================================
✅ PASS: DATABASE_URL - Environment variable set
✅ PASS: Local PostgreSQL - Connection successful (latency: 12ms)

========================================
CATEGORY: Supabase Connectivity
========================================
✅ PASS: SUPABASE_URL_DEV - Environment variable set
✅ PASS: SUPABASE_SERVICE_ROLE_KEY_DEV - Environment variable set
✅ PASS: Supabase API - Connection successful (latency: 145ms)

========================================
CATEGORY: Command Center
========================================
✅ PASS: Command Center URL - Auto-detected on port 3015
✅ PASS: Command Center Health - Health check passed

========================================
CATEGORY: Autopilot Tables
========================================
✅ PASS: Autopilot Tables - autopilot_decisions table exists

========================================
CATEGORY: Node Dependencies
========================================
✅ PASS: package.json - File exists

========================================
CATEGORY: Critical Files
========================================
✅ PASS: .env - File exists
✅ PASS: docker-compose.yml - File exists

========================================
Health Check Summary
========================================
Total Checks: 11
Passed: 11
Failed: 0
Warnings: 0

Overall Status: HEALTHY

[Exit code: 0]
```

### Failure Output (Critical Checks Fail)

```
Unit Talk Platform Health Check
Environment: dev

[2025-01-28 10:32:15 PST] Loaded 10 new environment variables from .env files

========================================
CATEGORY: Local PostgreSQL
========================================
❌ FAIL: DATABASE_URL - Environment variable not set

========================================
CATEGORY: Supabase Connectivity
========================================
✅ PASS: SUPABASE_URL_DEV - Environment variable set
⚠️  WARN: SUPABASE_SERVICE_ROLE_KEY_DEV - Environment variable not set (may use alternate auth)

========================================
CATEGORY: Command Center
========================================
❌ FAIL: Command Center URL - Not configured and auto-detection failed (tried ports: 3015, 3017, 3000)

========================================
CATEGORY: Autopilot Tables
========================================
❌ FAIL: Autopilot Tables - Missing connection string for environment: dev

========================================
Health Check Summary
========================================
Total Checks: 11
Passed: 5
Failed: 3
Warnings: 1

Overall Status: UNHEALTHY

[Exit code: 1]
```

### Self-Test Output (Environment Variable Check)

```
========================================
SELF-TEST MODE
========================================
Environment: dev

Environment Variables Checked:

  ✅ SET SUPABASE_URL_DEV
  ✅ SET SUPABASE_SERVICE_ROLE_KEY_DEV
  ❌ NOT SET SUPABASE_READONLY_DATABASE_URL_DEV
  ✅ SET SUPABASE_PROJECT_REF_DEV
  ❌ NOT SET COMMAND_CENTER_URL_DEV
  ✅ SET DATABASE_URL
  ❌ NOT SET DATABASE_DIRECT_URL_DEV

========================================
SELF-TEST COMPLETE
========================================

[Exit code: 0]
```

### JSON Output Format

```json
{
  "timestamp": "2025-01-28T18:30:45Z",
  "environment": "dev",
  "checks": [
    {
      "name": "DATABASE_URL",
      "category": "Local PostgreSQL",
      "status": "PASS",
      "message": "Environment variable set",
      "data": {
        "url": "postgresql://postgres.***"
      }
    },
    {
      "name": "Local PostgreSQL",
      "category": "Local PostgreSQL",
      "status": "PASS",
      "message": "Connection successful (latency: 12ms)",
      "data": {
        "latency_ms": 12
      }
    }
  ],
  "summary": {
    "total": 11,
    "passed": 11,
    "failed": 0,
    "warnings": 0,
    "status": "HEALTHY"
  },
  "exit_code": 0
}
```

---

## Troubleshooting

### Issue: All Environment Variables Show NOT SET

**Symptoms:**
```
.\scripts\doctor.ps1 -SelfTest
❌ NOT SET DATABASE_URL
❌ NOT SET SUPABASE_URL_DEV
❌ NOT SET SUPABASE_SERVICE_ROLE_KEY_DEV
```

**Diagnosis:**
1. Check if `.env` file exists in repository root:
   ```powershell
   Test-Path .\.env
   # Should return: True
   ```

2. Check if `.env` has correct format:
   ```powershell
   Get-Content .\.env | Select-String "DATABASE_URL"
   # Should show: DATABASE_URL=postgresql://...
   ```

3. Check if variables are being loaded:
   ```powershell
   .\scripts\doctor.ps1 -Verbose
   # Should show: "Loaded X new environment variables from .env files"
   ```

**Solutions:**

**Solution A:** Create `.env` file if missing
```powershell
# Copy example .env file
Copy-Item .\.env.example .\.env

# Edit .env and add your values
notepad .\.env
```

**Solution B:** Create `.env.local` for local overrides
```powershell
# Create .env.local with your local values (gitignored)
@"
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/unit_talk_dev
SUPABASE_URL_DEV=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY_DEV=your_service_role_key
"@ | Set-Content .\.env.local
```

**Solution C:** Set process environment variables
```powershell
# Set in current PowerShell session
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/unit_talk_dev"

# Or set permanently (Windows)
[System.Environment]::SetEnvironmentVariable("DATABASE_URL", "postgresql://...", "User")
```

---

### Issue: Command Center Health Check Timeout

**Symptoms:**
```
❌ FAIL: Command Center Health - The operation has timed out
```

**Diagnosis:**
1. Check if Command Center is running:
   ```powershell
   # Check if Next.js dev server is running
   Get-Process | Where-Object { $_.ProcessName -like "*node*" }

   # Check if port is listening
   netstat -an | Select-String "3015"
   ```

2. Check if port is correct:
   ```powershell
   # Default ports checked: 3015, 3017, 3000
   # If running on different port, set COMMAND_CENTER_URL_DEV
   $env:COMMAND_CENTER_URL_DEV = "http://localhost:3016"
   ```

**Solutions:**

**Solution A:** Start Command Center
```powershell
# Start via Docker
.\dev.sh start

# Or start manually
cd apps\command-center
npm run dev
```

**Solution B:** Set correct URL
```powershell
# Add to .env.local
COMMAND_CENTER_URL_DEV=http://localhost:3016
```

**Solution C:** Increase timeout (if network is slow)
```powershell
# Edit scripts/doctor.ps1, line ~570
# Change: -TimeoutSec 5
# To:     -TimeoutSec 10
```

---

### Issue: Autopilot Tables Check Fails

**Symptoms:**
```
❌ FAIL: Autopilot Tables - Missing connection string for environment: dev
```

**Diagnosis:**
1. Check if Supabase credentials are set:
   ```powershell
   .\scripts\doctor.ps1 -SelfTest
   # Verify: ✅ SET SUPABASE_URL_DEV
   # Verify: ✅ SET SUPABASE_SERVICE_ROLE_KEY_DEV
   ```

2. Check if migration was applied:
   ```powershell
   docker-compose exec api npm run db:status
   # Should show: 20241227_phase4_autopilot_decisions.sql [APPLIED]
   ```

**Solutions:**

**Solution A:** Set Supabase credentials
```powershell
# Add to .env.local
SUPABASE_URL_DEV=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY_DEV=your_service_role_key
```

**Solution B:** Apply migration
```powershell
docker-compose exec api npm run db:migrate
```

**Solution C:** Verify table exists manually
```powershell
# Connect to Supabase and run:
SELECT to_regclass('public.autopilot_decisions');
# Should return: autopilot_decisions (not null)
```

---

### Issue: PowerShell Execution Policy Error

**Symptoms:**
```
.\scripts\doctor.ps1 : File cannot be loaded because running scripts is disabled on this system
```

**Solution:**
```powershell
# Option 1: Bypass for single execution
powershell -ExecutionPolicy Bypass -File .\scripts\doctor.ps1

# Option 2: Set execution policy for current user (permanent)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

### Issue: Reserved Variable Error (Legacy)

**Symptoms:**
```
Cannot overwrite variable Host because it is read-only or constant
```

**Solution:**
This issue was fixed in v2.0.0. If you still see this error:

1. Verify you're using latest version:
   ```powershell
   Get-Content .\scripts\doctor.ps1 | Select-String "Version:"
   # Should show: # Version: 2.0.0 or higher
   ```

2. If version is old, pull latest:
   ```bash
   git pull origin main
   ```

3. If version is current, check for local modifications:
   ```bash
   git diff scripts/doctor.ps1
   ```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Health Check

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  health-check:
    runs-on: windows-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run health checks (dev)
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          SUPABASE_URL_DEV: ${{ secrets.SUPABASE_URL_DEV }}
          SUPABASE_SERVICE_ROLE_KEY_DEV: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY_DEV }}
          COMMAND_CENTER_URL_DEV: http://localhost:3015
        run: |
          # Use -NoDotEnv to rely on GitHub secrets only
          .\scripts\doctor.ps1 -NoDotEnv -OutputFormat json | Out-File health-check.json

          # Parse JSON and fail workflow if unhealthy
          $health = Get-Content health-check.json | ConvertFrom-Json
          if ($health.exit_code -ne 0) {
            Write-Error "Health check failed: $($health.summary.status)"
            exit 1
          }

      - name: Upload health check report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: health-check-report
          path: health-check.json
          retention-days: 7
```

### Required Secrets

Add these secrets to your GitHub repository settings:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `DATABASE_URL` | Local PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `SUPABASE_URL_DEV` | Supabase project URL (dev) | `https://abc.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY_DEV` | Supabase service role key (dev) | `eyJhbGci...` |
| `SUPABASE_URL_STAGING` | Supabase project URL (staging) | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY_STAGING` | Supabase service role key (staging) | `eyJhbGci...` |
| `SUPABASE_URL_PROD` | Supabase project URL (prod) | `https://prod.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY_PROD` | Supabase service role key (prod) | `eyJhbGci...` |

---

## Environment Variable Reference

### Per-Environment Variables

The script checks for environment-specific variables using the pattern `VARIABLE_NAME_{ENV}`:

**For dev environment (`-Environment dev`):**
- `SUPABASE_URL_DEV`
- `SUPABASE_SERVICE_ROLE_KEY_DEV`
- `SUPABASE_READONLY_DATABASE_URL_DEV`
- `SUPABASE_PROJECT_REF_DEV`
- `COMMAND_CENTER_URL_DEV`
- `DATABASE_DIRECT_URL_DEV`

**For staging environment (`-Environment staging`):**
- `SUPABASE_URL_STAGING`
- `SUPABASE_SERVICE_ROLE_KEY_STAGING`
- `SUPABASE_READONLY_DATABASE_URL_STAGING`
- `SUPABASE_PROJECT_REF_STAGING`
- `COMMAND_CENTER_URL_STAGING`
- `DATABASE_DIRECT_URL_STAGING`

**For prod environment (`-Environment prod`):**
- `SUPABASE_URL_PROD`
- `SUPABASE_SERVICE_ROLE_KEY_PROD`
- `SUPABASE_READONLY_DATABASE_URL_PROD`
- `SUPABASE_PROJECT_REF_PROD`
- `COMMAND_CENTER_URL_PROD`
- `DATABASE_DIRECT_URL_PROD`

### Global Variables

These variables apply to all environments:
- `DATABASE_URL` - Local PostgreSQL connection string

---

## Testing

### Manual Testing

```powershell
# Run automated test harness
.\scripts\doctor.selftest.ps1

# Expected output:
========================================
TEST SUMMARY
========================================
Total Tests:  18
Passed:       18
Failed:       0

Pass Rate:    100%

✅ ALL TESTS PASSED
```

### Test Coverage

The test harness (`doctor.selftest.ps1`) validates:
1. PowerShell parser (no syntax errors)
2. Reserved variable checks (no $Host conflicts)
3. Exit code behavior (fail-closed)
4. Environment variable loading (precedence rules)
5. SelfTest mode output
6. Secret masking (no unmasked credentials)
7. Output format validation (text and JSON)
8. Environment parameter handling (dev/staging/prod)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2025-01-28 | Complete rewrite: added .env loading, fixed $Host bug, added -NoDotEnv flag, improved timeouts |
| 1.0.0 | 2025-01-27 | Initial implementation with 6 check categories |

---

## Support

For issues or questions:
- **File a bug:** [GitHub Issues](https://github.com/unit-talk/platform/issues)
- **Documentation:** See `docs/ops/AUTOMATION_RUNBOOK.md` for CI/CD integration
- **Team Contact:** Platform Engineering team

---

**End of Runbook**
