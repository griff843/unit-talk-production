# E2E Validation Script - Canonical Ready

**Date:** 2025-01-28  
**Script:** `scripts/ops/industry-standard-e2e-validation.ps1`  
**Version:** 2.0.0 - Canonical Ready

---

## Overview

This PowerShell script provides **production-grade, fully functional E2E validation** for the Unit Talk platform's canonical picks architecture. It validates both DRY-RUN and LIVE submissions across all major leagues (NBA, NFL, MLB, NHL) and generates comprehensive attestation reports.

---

## Features

✅ **Canonical Driver Validation** - Verifies `PICK_DRIVER=canonical` and `PUBLISH_MODE=outbox`  
✅ **Cross-League Testing** - Tests NBA, NFL, MLB, NHL automatically  
✅ **DRY-RUN + LIVE** - Validates both modes for each league  
✅ **Response Timing** - Captures API response times with <500ms target  
✅ **Error Handling** - Robust error capture with detailed error bodies  
✅ **JSON + Markdown Artifacts** - Generates attestations per league  
✅ **Consolidated GO/NO-GO** - Final report with pass/fail summary  
✅ **Exit Codes** - Returns 0 for success, 1 for failure  
✅ **No Here-Strings** - Uses `@{}` hashtables with `ConvertTo-Json`  
✅ **Idempotent** - Safe to re-run multiple times

---

## Prerequisites

1. **Services Running**
   ```powershell
   ./dev.sh start
   ```

2. **Environment Variables** (in `.env`)
   ```bash
   PICK_DRIVER=canonical
   PUBLISH_MODE=outbox
   DEFAULT_TENANT_ID=12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a
   CAPPER_ID=<your-capper-uuid>
   ```

3. **API Endpoints Available**
   - API Health: `http://localhost:3010/api/health`
   - Smart Form: `http://localhost:3002`
   - DRY-RUN: `http://localhost:3002/api/domain/picks/dry-run`
   - LIVE INSERT: `http://localhost:3002/api/domain/picks/insert`

---

## Usage

### Quick Start

```powershell
# Navigate to workspace root
cd C:\Users\griff\OneDrive\Desktop\unit-talk-production-main

# Run validation
.\scripts\ops\industry-standard-e2e-validation.ps1
```

### Expected Output

```
[HH:mm:ss] 🔵 Step 0: Initialization
[HH:mm:ss] ✅ Artifacts directory: out/ops/cutover/metrics/100
[HH:mm:ss] ✅ Git SHA: abc1234

[HH:mm:ss] 🔵 Step 1: Health Checks
[HH:mm:ss] ✅ API is healthy
[HH:mm:ss] ✅ Smart Form is healthy

[HH:mm:ss] 🔵 Step 2: Loading Configuration
[HH:mm:ss] ✅ PICK_DRIVER=canonical, PUBLISH_MODE=outbox
[HH:mm:ss] ✅ TENANT_ID: 12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a
[HH:mm:ss] ✅ CAPPER_ID from CAPPER_ID : <uuid>

[HH:mm:ss] 🔵 Step 3: Running E2E Validation for All Leagues

[HH:mm:ss] 🔵 Testing League: NBA
[HH:mm:ss] 🔵   → DRY-RUN test...
[HH:mm:ss] ✅   ✅ DRY-RUN PASS (45.23ms)
[HH:mm:ss] 🔵   → LIVE INSERT test...
[HH:mm:ss] ✅   ✅ LIVE INSERT PASS (123.45ms) - pickId: <uuid>
[HH:mm:ss] ✅ ✅ NBA - PASS

... (NFL, MLB, NHL) ...

[HH:mm:ss] 🔵 Step 4: Generating Artifacts
[HH:mm:ss] ℹ️  Generated: out/ops/cutover/metrics/100/NBA_attestation_canonical_live_20250128_143022.json
[HH:mm:ss] ℹ️  Generated: out/ops/cutover/metrics/100/NBA_attestation_canonical_live_20250128_143022.md
... (all leagues) ...

[HH:mm:ss] 🔵 Step 5: Generating Consolidated GO/NO-GO Report
[HH:mm:ss] ✅ Generated: out/ops/cutover/metrics/100/FINAL_GO_NO_GO_canonical_20250128_143022.md

============================================================================
              E2E VALIDATION COMPLETE (CANONICAL)
============================================================================

LEAGUE RESULTS:
┌─────────┬──────────┬──────┬──────────────┬──────────┐
│ League  │ DRY-RUN  │ LIVE │ Duration(ms) │ Result   │
├─────────┼──────────┼──────┼──────────────┼──────────┤
│ NBA     │ ✅       │ ✅   │ 123.45       │ ✅ PASS  │
│ NFL     │ ✅       │ ✅   │ 145.67       │ ✅ PASS  │
│ MLB     │ ✅       │ ✅   │ 98.76        │ ✅ PASS  │
│ NHL     │ ✅       │ ✅   │ 112.34       │ ✅ PASS  │
└─────────┴──────────┴──────┴──────────────┴──────────┘

SUMMARY METRICS:
  Total Leagues:        4
  Passed:               4
  Failed:               0
  Success Rate:         100%
  Avg Response Time:    120.06 ms

ARTIFACTS:
  Consolidated Report: out/ops/cutover/metrics/100/FINAL_GO_NO_GO_canonical_20250128_143022.md
  NBA JSON: out/ops/cutover/metrics/100/NBA_attestation_canonical_live_20250128_143022.json
  NBA MD:   out/ops/cutover/metrics/100/NBA_attestation_canonical_live_20250128_143022.md
  ... (all leagues) ...

✅ All leagues passed (GO)
System is ready for production deployment.
```

---

## Output Files

### Per-League Attestations

For each league (NBA, NFL, MLB, NHL):

1. **JSON Attestation**
   - Path: `out/ops/cutover/metrics/100/{LEAGUE}_attestation_canonical_live_{TIMESTAMP}.json`
   - Contains: Full test results, timings, errors, configuration

2. **Markdown Attestation**
   - Path: `out/ops/cutover/metrics/100/{LEAGUE}_attestation_canonical_live_{TIMESTAMP}.md`
   - Contains: Human-readable summary with pass/fail status

### Consolidated Report

**Path:** `out/ops/cutover/metrics/100/FINAL_GO_NO_GO_canonical_{TIMESTAMP}.md`

**Contents:**
- Executive summary (pass/fail counts, success rate)
- League results table
- SLO targets comparison
- Links to all artifacts
- Final GO/NO-GO recommendation

---

## Payload Structure

### DRY-RUN Payload

```json
{
  "userId": "<capper-uuid>",
  "tenantId": "<tenant-uuid>",
  "league": "NBA",
  "marketType": "PLAYER_POINTS",
  "line": 27.5,
  "side": "over",
  "playerId": "<player-uuid>",
  "playerName": "LeBron James",
  "gameDate": "2025-01-29T14:30:22Z",
  "odds": -110,
  "stake": 1.0,
  "userScore": 8,
  "confidence": 0.85,
  "prediction": "over",
  "reasoning": "E2E validation test for NBA",
  "betSlipId": "dryrun-NBA-20250128_143022",
  "idempotencyKey": "e2e-dryrun-NBA-20250128_143022"
}
```

### LIVE INSERT Payload

Same as DRY-RUN, but with:
- `betSlipId`: `"live-NBA-20250128_143022"`
- `idempotencyKey`: `"e2e-live-NBA-20250128_143022"`

---

## Exit Codes

- **0** - All leagues passed (GO)
- **1** - One or more leagues failed (NO-GO)

---

## Troubleshooting

### Error: "API health check failed"

**Solution:**
```powershell
./dev.sh start
./dev.sh status
./dev.sh logs
```

### Error: "CAPPER_ID not found"

**Solution:** Add to `.env`:
```bash
CAPPER_ID=<your-capper-uuid>
```

### Error: "DRY-RUN FAIL (HTTP 400)"

**Possible Causes:**
- Invalid payload structure
- Missing required fields
- Schema validation error

**Solution:** Check error body in output for details

### Error: "LIVE INSERT FAIL (HTTP 422)"

**Possible Causes:**
- Capper ID not found in database
- Invalid UUID format
- Missing tenant configuration

**Solution:** Verify capper exists in `users` table

---

## Technical Details

### API Endpoints

| Endpoint | Method | Purpose | Expected Response |
|----------|--------|---------|-------------------|
| `/api/health` | GET | Health check | 200 OK |
| `/api/domain/picks/dry-run` | POST | Validation only | 204 No Content |
| `/api/domain/picks/insert` | POST | Live submission | 200/201 with pickId |

### Headers

```
Idempotency-Key: e2e-{mode}-{league}-{timestamp}
Content-Type: application/json
```

### Response Time Targets

- **DRY-RUN:** < 100ms
- **LIVE INSERT:** < 500ms
- **Overall Success Rate:** 100%

---

## Integration with CI/CD

```yaml
# Example GitHub Actions workflow
- name: Run E2E Validation
  run: |
    ./dev.sh start
    pwsh -File scripts/ops/industry-standard-e2e-validation.ps1
  shell: pwsh
```

---

## Changelog

### v2.0.0 - 2025-01-28 (Canonical Ready)
- ✅ Rebuilt for canonical picks architecture
- ✅ Removed here-string syntax (PowerShell compatibility)
- ✅ Added robust error handling with error body capture
- ✅ Simplified to DRY-RUN + LIVE only (no publish verification)
- ✅ Added response timing metrics
- ✅ Improved artifact naming with `canonical_live` suffix
- ✅ Added comprehensive summary table
- ✅ Exit code reflects overall result

### v1.0.0 - Previous
- Initial implementation with unified picks driver

---

## Support

For issues or questions:
1. Check `./dev.sh logs` for service errors
2. Review generated attestation files for detailed error messages
3. Verify environment variables in `.env`
4. Ensure all services are healthy before running

---

**End of Documentation**

