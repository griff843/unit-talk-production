# NFL Sunday E2E Production Validation - Quick Start Guide
**Date:** 2025-10-26

## Overview

Automated end-to-end validation for NFL Sunday operations with **zero manual ID configuration**. The system auto-discovers all required IDs and generates comprehensive attestations.

## Quick Start

### Windows (PowerShell)
```powershell
# Run validation
powershell -ExecutionPolicy Bypass -File scripts/ops/nfl_sunday_e2e_validation.ps1

# View latest results
Get-ChildItem out/ops/cutover/metrics/100 -Filter *.md | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Get-Content
```

### Linux/Mac (Bash)
```bash
# Run validation
bash scripts/ops/nfl_sunday_e2e_validation.sh

# View latest results
ls -t out/ops/cutover/metrics/100/*.md | head -1 | xargs cat
```

## What It Does

### Auto-Discovery (Zero Manual Configuration)
1. **Tenant ID** - Reads from environment chain (.env.effective → .env.local → .env)
2. **Capper ID** - Checks environment variables, falls back to database query
3. **Player ID** - Generates test ID or queries real NFL players from database

### Validation Steps
1. ✅ **Health Checks** - Smart Form, API, database connectivity
2. ✅ **ID Discovery** - Auto-discover all required identifiers
3. ✅ **DRY-RUN** - Test pick submission without database writes
4. ✅ **LIVE Submit** - Real pick submission with idempotency
5. ✅ **Database Verification** - Confirm pick in database
6. ✅ **Publish Verification** - Poll for Discord publish status
7. ✅ **Audit Log** - Verify events logged
8. ✅ **Command Center** - Confirm pick visibility
9. ✅ **Attestation** - Generate JSON and Markdown reports

### Outputs
- **JSON Attestation:** `out/ops/cutover/metrics/100/nfl_sunday_attestation_TIMESTAMP.json`
- **Markdown Report:** `out/ops/cutover/metrics/100/nfl_sunday_attestation_TIMESTAMP.md`

## Prerequisites

### Required Services
```bash
# Check service status
docker-compose ps

# Required services:
# - smart-form (port 3002) - REQUIRED
# - api (port 3010) - RECOMMENDED
# - postgres (port 5432) - REQUIRED
# - discord-bot - REQUIRED for publish verification
# - command-center (port 3004) - OPTIONAL
```

### Start Missing Services
```bash
# Start all services
docker-compose up -d

# Or start specific services
docker-compose up -d api smart-form postgres discord-bot
```

## Configuration

### Environment Variables (Optional)
The validation auto-discovers IDs, but you can override:

```bash
# .env or .env.local
DEFAULT_TENANT_ID=12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a
CAPPER_ID=your-capper-uuid
PICK_DRIVER=canonical
PUBLISH_MODE=outbox
```

### No Configuration Required
If environment variables are not set, the script will:
- Use DEFAULT_TENANT_ID from .env.effective
- Query database for a valid capper user
- Generate or query for an NFL player

## Interpreting Results

### Success (PASS)
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ NFL SUNDAY E2E VALIDATION: PASS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pick ID: abc123...
Published: sent with message ID 456789
Attestations: out/ops/cutover/metrics/100/nfl_sunday_attestation_TIMESTAMP.json
```

### Failure (FAIL)
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ❌ NFL SUNDAY E2E VALIDATION: FAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reason: [Specific failure reason]
Attestations: out/ops/cutover/metrics/100/nfl_sunday_attestation_TIMESTAMP.json
```

Check the attestation file for:
- Detailed failure reason
- Remediation steps
- Service status at time of failure

## Common Issues & Remediation

### Issue: API Service Not Running
**Symptom:** `API status check failed on both 3000 and 3011`  
**Fix:**
```bash
docker-compose up -d api
docker-compose ps api
```

### Issue: Smart Form Health Check Failed
**Symptom:** `Smart Form health check failed`  
**Fix:**
```bash
docker-compose restart smart-form
docker-compose logs smart-form --tail=50
```

### Issue: Database Connection Failed
**Symptom:** `Database query failed`  
**Fix:**
```bash
docker-compose ps postgres
docker-compose logs postgres --tail=50
# Verify DATABASE_URL in .env
```

### Issue: DRY-RUN 400 Bad Request
**Symptom:** `DRY-RUN failed with HTTP 400`  
**Cause:** Test player ID not accepted by Smart Form API  
**Fix:** Use a real NFL player ID from database:
```sql
SELECT id, player_name FROM raw_props 
WHERE sport='NFL' AND stat_type='receiving_yards' 
LIMIT 5;
```

### Issue: Pick Not Published to Discord
**Symptom:** `Pick publish did not reach status='sent' within 90s`  
**Fix:**
```bash
# Check Discord bot
docker-compose ps discord-bot
docker-compose logs discord-bot --tail=50

# Verify DISCORD_BOT_TOKEN in .env
# Check bridge_outbox table for pending events
```

## Advanced Usage

### Custom Player ID
Edit the script to use a specific player:
```powershell
# In nfl_sunday_e2e_validation.ps1, replace the player discovery section:
$PlayerId = "your-real-player-uuid"
$PlayerName = "Patrick Mahomes"
```

### Custom Polling Timeout
Adjust the publish verification timeout:
```powershell
# In nfl_sunday_e2e_validation.ps1
$MaxPolls = 18  # 18 * 10s = 180s (3 minutes)
```

### Skip Specific Steps
Comment out sections in the script to skip steps:
```powershell
# Skip Command Center verification
# Write-Step "F) Command Center Verification"
# ...
```

## Monitoring & Alerting

### View All Attestations
```bash
# List all validation runs
ls -lh out/ops/cutover/metrics/100/nfl_sunday_attestation_*

# View latest JSON
cat out/ops/cutover/metrics/100/nfl_sunday_attestation_*.json | tail -1 | jq '.'

# View latest Markdown
cat out/ops/cutover/metrics/100/nfl_sunday_attestation_*.md | tail -1
```

### Track Success Rate
```bash
# Count PASS vs FAIL
grep -h "conclusion" out/ops/cutover/metrics/100/nfl_sunday_attestation_*.json | sort | uniq -c
```

### Performance Metrics
Check attestation files for:
- **DRY-RUN Latency:** Target <100ms (prod), <200ms (dev)
- **Publish Latency:** Target <60s p95
- **End-to-End Time:** Full validation should complete in <120s

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: NFL Sunday Validation
on:
  schedule:
    - cron: '0 */6 * * 0'  # Every 6 hours on Sunday
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Start Services
        run: docker-compose up -d
      - name: Run Validation
        run: bash scripts/ops/nfl_sunday_e2e_validation.sh
      - name: Upload Attestations
        uses: actions/upload-artifact@v3
        with:
          name: validation-attestations
          path: out/ops/cutover/metrics/100/nfl_sunday_attestation_*
```

## Support

### Logs
```bash
# View all service logs
docker-compose logs --tail=100

# Specific service
docker-compose logs smart-form --tail=50
docker-compose logs api --tail=50
docker-compose logs discord-bot --tail=50
```

### Database Inspection
```bash
# Connect to database
docker-compose exec postgres psql -U postgres -d unit_talk_dev

# Check recent picks
SELECT id, user_id, player_id, league, market_type, created_at 
FROM picks 
ORDER BY created_at DESC LIMIT 5;

# Check publish status
SELECT pp.pick_id, pp.status, pp.external_message_id, pp.created_at
FROM pick_publish pp
ORDER BY pp.created_at DESC LIMIT 5;
```

### Health Checks
```bash
# Smart Form
curl -I http://localhost:3002/api/health

# API
curl http://localhost:3010/api/domain/picks/status

# Command Center
curl http://localhost:3004/api/health
```

## Troubleshooting Decision Tree

```
Validation Failed?
├─ Health Check Failed?
│  ├─ Smart Form: Restart service, check logs
│  ├─ API: Start service, verify port
│  └─ Database: Check postgres container
│
├─ ID Discovery Failed?
│  ├─ Tenant ID: Check .env files
│  ├─ Capper ID: Verify users table has data
│  └─ Player ID: Use real player from database
│
├─ DRY-RUN Failed?
│  ├─ 400 Bad Request: Use real player ID
│  ├─ 500 Server Error: Check Smart Form logs
│  └─ Timeout: Increase timeout, check network
│
└─ Publish Failed?
   ├─ Check Discord bot status
   ├─ Verify DISCORD_BOT_TOKEN
   ├─ Check bridge_outbox table
   └─ Review worker logs
```

---

**Script Locations:**
- PowerShell: `scripts/ops/nfl_sunday_e2e_validation.ps1`
- Bash: `scripts/ops/nfl_sunday_e2e_validation.sh`

**Attestation Directory:** `out/ops/cutover/metrics/100/`

**Last Updated:** 2025-10-26

