# Unit Talk — Industry-Standard E2E Validation

**Date:** 2025-01-28  
**Version:** 1.0.0  
**Status:** Production Ready

## Overview

This directory contains world-class, zero-prompts production validation scripts that execute comprehensive end-to-end testing across all sports leagues (NBA, NFL, MLB, NHL) with automatic Supabase schema refresh, stack orchestration, and SLO verification.

## Scripts

### PowerShell (Windows)
```powershell
.\scripts\ops\industry-standard-e2e-validation.ps1
```

### Bash (Linux/macOS)
```bash
./scripts/ops/industry-standard-e2e-validation.sh
```

## What It Does

### 1. **Supabase Schema Cache Refresh**
- Runtime header bypass (`x-supabase-reload-schema: true`)
- Supabase CLI refresh (if available)
- Container restart fallback

### 2. **Stack Orchestration**
- Starts all services via `./dev.sh start`
- Auto-detects API port (3010, 3000, 3011)
- Verifies health endpoints

### 3. **Multi-League Validation**
For each league (NBA, NFL, MLB, NHL):
- **DRY-RUN**: Validates request without database writes
- **LIVE INSERT**: Creates actual pick in database
- **Outbox Verification**: Polls `pick_publish` table for Discord publishing
- **Audit Trail**: Verifies `audit_log` entries
- **Command Center**: Checks UI visibility

### 4. **SLO Capture**
- API p95 response time (target: <150ms)
- Database p95 write time (target: <50ms)
- Error rate (target: <0.5%)
- Publish lag p95 (target: <60s)

### 5. **Artifact Generation**
Per-league attestations:
- `{LEAGUE}_attestation_{TIMESTAMP}.json`
- `{LEAGUE}_attestation_{TIMESTAMP}.md`

Consolidated report:
- `FINAL_GO_NO_GO_{TIMESTAMP}.md`

## Prerequisites

### Required
- Docker & docker-compose running
- `.env` file with required variables (see below)
- `./dev.sh` executable in workspace root

### Optional
- Supabase CLI (for schema refresh)
- `jq` (for JSON parsing in bash version)
- `uuidgen` (for test data generation in bash version)

## Environment Variables

### Required in `.env`

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Tenant & Capper
DEFAULT_TENANT_ID=12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a
CAPPER_ID=your-capper-uuid

# Picks Configuration
PICK_DRIVER=canonical
PUBLISH_MODE=outbox
SHADOW_MODE=false
LOG_MODE=sync

# Discord (for publishing verification)
DISCORD_BOT_TOKEN=your-bot-token
```

### Optional Variables

```bash
# Alternative capper ID sources (checked in order)
DEFAULT_CAPPER_ID=uuid
TEST_CAPPER_ID=uuid
SMARTFORM_DEFAULT_CAPPER_ID=uuid
CAPPER_IDS=uuid1,uuid2,uuid3  # Comma-separated
```

## Usage

### Quick Start (PowerShell)

```powershell
# Navigate to workspace root
cd C:\Users\griff\OneDrive\Desktop\unit-talk-production-main

# Run validation
.\scripts\ops\industry-standard-e2e-validation.ps1

# Check exit code
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ GO - Ready for production"
} else {
    Write-Host "❌ NO-GO - Review failures"
}
```

### Quick Start (Bash)

```bash
# Navigate to workspace root
cd ~/unit-talk-production-main

# Make executable
chmod +x ./scripts/ops/industry-standard-e2e-validation.sh

# Run validation
./scripts/ops/industry-standard-e2e-validation.sh

# Check exit code
if [ $? -eq 0 ]; then
    echo "✅ GO - Ready for production"
else
    echo "❌ NO-GO - Review failures"
fi
```

## Output

### Console Output

```
[12:34:56] 🔵 Step 0: Filesystem & Tool Checks
[12:34:56] ✅ Docker: Docker version 24.0.7
[12:34:56] ✅ docker-compose: docker-compose version 1.29.2
[12:34:56] ✅ Git SHA: a1b2c3d
[12:34:57] 🔵 Step 1: Supabase Schema Cache Refresh
[12:34:57] ✅ Supabase schema refreshed via CLI
[12:34:58] 🔵 Step 2: Bringing Up Stack via ./dev.sh
[12:35:18] ✅ API detected at: http://localhost:3010
[12:35:19] ✅ Smart Form: healthy
[12:35:19] ✅ API Status: driver=canonical, publishMode=outbox ✅
[12:35:20] 🔵 Step 3: Auto-Discovering IDs
[12:35:20] ✅ TENANT_ID from .env: 12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a
[12:35:20] ✅ CAPPER_ID from CAPPER_ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
[12:35:21] 🔵 Step 4: Running DRY-RUN + LIVE for All Leagues
[12:35:21] 🔵 Processing League: NBA
[12:35:21] 🔵   → DRY-RUN for NBA
[12:35:21] ✅   ✅ DRY-RUN passed (45.23ms)
[12:35:21] 🔵   → LIVE INSERT for NBA
[12:35:22] ✅   ✅ LIVE INSERT passed - pickId: 12345678-90ab-cdef-1234-567890abcdef
[12:35:22] ✅ League NBA - PASS
...

============================================================================
                    E2E VALIDATION COMPLETE
============================================================================

LEAGUE RESULTS:
┌─────────┬──────────┬──────┬─────────┬─────────┬──────────┐
│ League  │ DRY-RUN  │ LIVE │ Publish │ Discord │ Overall  │
├─────────┼──────────┼──────┼─────────┼─────────┼──────────┤
│ NBA     │ ✅       │ ✅   │ ✅      │ ✅      │ ✅ PASS  │
│ NFL     │ ✅       │ ✅   │ ✅      │ ✅      │ ✅ PASS  │
│ MLB     │ ✅       │ ✅   │ ✅      │ ✅      │ ✅ PASS  │
│ NHL     │ ✅       │ ✅   │ ✅      │ ✅      │ ✅ PASS  │
└─────────┴──────────┴──────┴─────────┴─────────┴──────────┘

SLO SUMMARY:
  NBA - API: 125.3ms | DB: 32.1ms | Lag: 45.2s
  NFL - API: 118.7ms | DB: 28.9ms | Lag: 42.8s
  MLB - API: 132.4ms | DB: 35.6ms | Lag: 48.1s
  NHL - API: 121.9ms | DB: 30.2ms | Lag: 44.5s

ARTIFACTS:
  Consolidated: out/ops/cutover/metrics/100/FINAL_GO_NO_GO_20250128_123456.md
  NBA JSON: out/ops/cutover/metrics/100/NBA_attestation_20250128_123456.json
  NBA MD:   out/ops/cutover/metrics/100/NBA_attestation_20250128_123456.md
  ...

FINAL DECISION: 🟢 GO
System is ready for production deployment.
```

### Artifacts

#### Per-League JSON (`NBA_attestation_20250128_123456.json`)
```json
{
  "league": "NBA",
  "dryRun": {
    "status": "PASS",
    "statusCode": 204,
    "durationMs": 45.23,
    "serverTiming": "total;dur=45.23"
  },
  "live": {
    "status": "PASS",
    "pickId": "12345678-90ab-cdef-1234-567890abcdef",
    "statusCode": 201,
    "durationMs": 125.3,
    "driver": "canonical",
    "publishMode": "outbox"
  },
  "publish": {
    "status": "PASS",
    "publishStatus": "sent",
    "externalMessageId": "1234567890123456789",
    "lagSeconds": 45.2
  },
  "slos": {
    "api_p95_ms": 125.3,
    "db_p95_ms": 32.1,
    "error_rate_pct": 0.0,
    "publish_lag_p95_sec": 45.2
  },
  "conclusion": "PASS"
}
```

#### Consolidated Report (`FINAL_GO_NO_GO_20250128_123456.md`)
See example in console output above.

## Troubleshooting

### API Not Detected
```
❌ Could not detect API on ports: 3010, 3000, 3011
```

**Solution:**
1. Check Docker containers: `docker-compose ps`
2. View API logs: `docker-compose logs --tail=200 api`
3. Manually start API: `docker-compose up -d api`

### CAPPER_ID Not Found
```
❌ CAPPER_ID not found - please set in .env
```

**Solution:**
Add to `.env`:
```bash
CAPPER_ID=your-capper-uuid
```

Or query database:
```sql
SELECT id FROM public.users 
WHERE role IN ('capper','tipster') 
AND (disabled IS NULL OR disabled=false) 
ORDER BY created_at DESC LIMIT 1;
```

### Schema Errors (400 Response)
```
⚠️  Schema error detected - retrying with x-supabase-reload-schema
```

**Solution:**
Script automatically retries with schema reload header. If still failing:
1. Manually refresh: `supabase db refresh-schema`
2. Restart Supabase containers: `docker-compose restart supabase supabase-db`
3. Check migration status: `docker-compose exec api npm run db:status`

### Publish Timeout
```
❌ Publish verification failed (timeout)
```

**Solution:**
1. Check Discord bot is running: `docker-compose ps discord-bot`
2. Verify `DISCORD_BOT_TOKEN` in `.env`
3. Check `SHADOW_MODE=false` (not `true`)
4. View worker logs: `docker-compose logs --tail=200 workers`

## SLO Targets

| Metric | Target | Notes |
|--------|--------|-------|
| API p95 | <150ms | End-to-end request processing |
| DB p95 | <50ms | Database write operations |
| Error Rate | <0.5% | Percentage of failed requests |
| Publish Lag p95 | <60s | Time from insert to Discord post |

**INFO:** Windows/Docker Desktop may exceed DB p95 target due to virtualization overhead. This is expected and documented in artifacts.

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: E2E Validation

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  e2e-validation:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup environment
        run: |
          cp .env.example .env
          # Populate with secrets
          
      - name: Run E2E validation
        run: ./scripts/ops/industry-standard-e2e-validation.sh
        
      - name: Upload artifacts
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: e2e-attestations
          path: out/ops/cutover/metrics/100/
```

## Support

For issues or questions:
1. Review artifacts in `out/ops/cutover/metrics/100/`
2. Check Docker logs: `./dev.sh logs`
3. Verify environment variables in `.env`
4. Contact Unit Talk Engineering team

---

**Last Updated:** 2025-01-28  
**Maintained By:** Unit Talk Engineering  
**License:** Proprietary

