# =============================================================================
# Canonical Smart Form Cutover Verification Script
# Date: 2025-10-26
# =============================================================================
# Verifies that the Canonical Smart Form cutover completed successfully
# Produces machine-readable and human-readable attestation with timestamps
# =============================================================================

param(
    [string]$TenantId = "12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a",
    [string]$CapperId = "",
    [string]$PlayerId = "",
    [string]$League = "NBA",
    [int]$LookbackMin = 90,
    [string]$OutDir = "out/ops/cutover/metrics/100"
)

# Configuration
$ErrorActionPreference = "Continue"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$attestationJson = "$OutDir/canonical_attestation_$timestamp.json"
$attestationMd = "$OutDir/canonical_attestation_$timestamp.md"

# Results object
$results = @{
    timestamp = (Get-Date -Format "o")
    tenant_id = $TenantId
    env = @{
        smart_form = @{}
        api = @{}
    }
    health = @{
        smart_form = @{}
        api = @{}
        picks_status = @{}
    }
    dry_run = @{
        status = 0
        server_timing_ms = $null
        reachable = $false
    }
    pick = @{}
    publish = @{}
    audit = @()
    command_center = @{
        confirmed = $false
        method = "pending"
    }
    conclusion = "PENDING"
    notes = @()
}

function Write-Step {
    param([string]$Message)
    Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] " -NoNewline -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor White
}

function Write-Pass {
    param([string]$Message)
    Write-Host "  ✅ " -NoNewline -ForegroundColor Green
    Write-Host $Message
}

function Write-Fail {
    param([string]$Message)
    Write-Host "  ❌ " -NoNewline -ForegroundColor Red
    Write-Host $Message
}

function Write-Info {
    param([string]$Message)
    Write-Host "  ℹ️  " -NoNewline -ForegroundColor Yellow
    Write-Host $Message
}

# =============================================================================
# STEP 1: Verify Container Environment Variables
# =============================================================================
Write-Step "STEP 1: Verifying container environment variables..."

try {
    $sfEnv = docker compose exec -T smart-form printenv 2>&1 | Select-String -Pattern "PICK_DRIVER|PUBLISH_MODE|DEFAULT_TENANT_ID"
    if ($sfEnv) {
        foreach ($line in $sfEnv) {
            $parts = $line -split "=", 2
            if ($parts.Count -eq 2) {
                $results.env.smart_form[$parts[0]] = $parts[1]
            }
        }
        Write-Pass "Smart Form env vars captured"
    } else {
        Write-Fail "Smart Form env vars not found"
        $results.notes += "Smart Form container may not be running"
    }
} catch {
    Write-Fail "Failed to get Smart Form env: $_"
    $results.notes += "Smart Form container error: $_"
}

try {
    $apiEnv = docker compose exec -T api printenv 2>&1 | Select-String -Pattern "PICK_DRIVER|PUBLISH_MODE|DEFAULT_TENANT_ID"
    if ($apiEnv) {
        foreach ($line in $apiEnv) {
            $parts = $line -split "=", 2
            if ($parts.Count -eq 2) {
                $results.env.api[$parts[0]] = $parts[1]
            }
        }
        Write-Pass "API env vars captured"
    } else {
        Write-Info "API env vars not found (may not be required)"
    }
} catch {
    Write-Info "API container may not be running: $_"
}

# Validate env flags
$envValid = $true
if ($results.env.smart_form.PICK_DRIVER -ne "canonical") {
    Write-Fail "Smart Form PICK_DRIVER is not 'canonical': $($results.env.smart_form.PICK_DRIVER)"
    $envValid = $false
}
if ($results.env.smart_form.PUBLISH_MODE -ne "outbox") {
    Write-Fail "Smart Form PUBLISH_MODE is not 'outbox': $($results.env.smart_form.PUBLISH_MODE)"
    $envValid = $false
}
if ($results.env.smart_form.DEFAULT_TENANT_ID -ne $TenantId) {
    Write-Fail "Smart Form DEFAULT_TENANT_ID mismatch: $($results.env.smart_form.DEFAULT_TENANT_ID)"
    $envValid = $false
}

if ($envValid) {
    Write-Pass "All environment flags are correct"
} else {
    $results.notes += "Environment flags validation failed - rebuild containers with correct .env"
}

# =============================================================================
# STEP 2: Health Checks
# =============================================================================
Write-Step "STEP 2: Running health checks..."

# Smart Form health
try {
    $sfHealth = Invoke-WebRequest -Uri "http://localhost:3002/api/health" -Method GET -UseBasicParsing -TimeoutSec 10
    $results.health.smart_form = @{
        status = $sfHealth.StatusCode
        healthy = ($sfHealth.StatusCode -eq 200)
    }
    if ($sfHealth.StatusCode -eq 200) {
        Write-Pass "Smart Form health check: 200 OK"
    } else {
        Write-Fail "Smart Form health check: $($sfHealth.StatusCode)"
    }
} catch {
    Write-Fail "Smart Form health check failed: $_"
    $results.health.smart_form = @{ status = 0; healthy = $false; error = $_.Exception.Message }
    $results.notes += "Smart Form not reachable - verify container is running and port 3002 is mapped"
}

# API health (try both ports)
$apiHealthy = $false
foreach ($port in @(3000, 3011)) {
    try {
        $apiHealth = Invoke-WebRequest -Uri "http://localhost:$port/api/health" -Method GET -UseBasicParsing -TimeoutSec 10
        if ($apiHealth.StatusCode -eq 200) {
            $results.health.api = @{
                status = $apiHealth.StatusCode
                healthy = $true
                port = $port
            }
            Write-Pass "API health check (port $port): 200 OK"
            $apiHealthy = $true
            break
        }
    } catch {
        # Try next port
    }
}

if (-not $apiHealthy) {
    Write-Info "API health check not available (may not be required for Smart Form)"
    $results.health.api = @{ status = 0; healthy = $false; note = "API not required for Smart Form operation" }
}

# Picks status endpoint
try {
    $picksStatus = Invoke-RestMethod -Uri "http://localhost:3002/api/domain/picks/status" -Method GET -TimeoutSec 10
    $results.health.picks_status = $picksStatus
    
    if ($picksStatus.driver -eq "canonical" -and $picksStatus.publish_mode -eq "outbox") {
        Write-Pass "Picks status: driver=$($picksStatus.driver), publish_mode=$($picksStatus.publish_mode)"
    } else {
        Write-Fail "Picks status mismatch: driver=$($picksStatus.driver), publish_mode=$($picksStatus.publish_mode)"
        $results.notes += "Picks status endpoint shows incorrect configuration"
    }
} catch {
    Write-Fail "Picks status endpoint failed: $_"
    $results.notes += "Picks status endpoint not reachable"
}

# =============================================================================
# STEP 3: DRY-RUN Probe
# =============================================================================
Write-Step "STEP 3: Testing DRY-RUN endpoint..."

if ([string]::IsNullOrEmpty($CapperId) -or [string]::IsNullOrEmpty($PlayerId)) {
    Write-Info "Skipping DRY-RUN test (CapperId or PlayerId not provided)"
    $results.dry_run.note = "Skipped - missing CapperId or PlayerId"
} else {
    $dryRunPayload = @{
        tenantId = $TenantId
        userId = $CapperId
        league = $League
        playerId = $PlayerId
        marketType = "PLAYER_POINTS"
        line = 27.5
        side = "OVER"
        stakeText = "verify"
        game = @{
            dateISO = (Get-Date -Format "yyyy-MM-dd")
        }
    } | ConvertTo-Json

    try {
        $dryRunResponse = Invoke-WebRequest -Uri "http://localhost:3002/api/domain/picks/dry-run" `
            -Method POST `
            -Headers @{
                "Idempotency-Key" = "sf-verify-$(Get-Date -Format 'yyyyMMddHHmmss')"
                "Content-Type" = "application/json"
            } `
            -Body $dryRunPayload `
            -UseBasicParsing `
            -TimeoutSec 30

        $results.dry_run.status = $dryRunResponse.StatusCode
        $results.dry_run.reachable = ($dryRunResponse.StatusCode -ge 200 -and $dryRunResponse.StatusCode -lt 300)
        
        # Extract Server-Timing header
        $serverTiming = $dryRunResponse.Headers["Server-Timing"]
        if ($serverTiming) {
            $results.dry_run.server_timing = $serverTiming
            if ($serverTiming -match "total;dur=(\d+\.?\d*)") {
                $results.dry_run.server_timing_ms = [decimal]$matches[1]
                Write-Pass "DRY-RUN reachable: $($dryRunResponse.StatusCode), timing: $($results.dry_run.server_timing_ms)ms"
            } else {
                Write-Pass "DRY-RUN reachable: $($dryRunResponse.StatusCode)"
            }
        } else {
            Write-Pass "DRY-RUN reachable: $($dryRunResponse.StatusCode) (no Server-Timing header)"
        }
    } catch {
        Write-Fail "DRY-RUN endpoint failed: $_"
        $results.dry_run.error = $_.Exception.Message
        $results.notes += "DRY-RUN endpoint not working - check Smart Form logs"
    }
}

# =============================================================================
# STEP 4: Database Checks
# =============================================================================
Write-Step "STEP 4: Checking database for recent picks..."

$databaseUrl = $env:DATABASE_URL
if ([string]::IsNullOrEmpty($databaseUrl)) {
    Write-Info "DATABASE_URL not set - attempting to construct from .env"
    $databaseUrl = "postgresql://postgres:postgres@localhost:5432/unit_talk_dev"
}

Write-Info "Using DATABASE_URL: $($databaseUrl -replace 'postgres:[^@]+@', 'postgres:***@')"
Write-Info "Searching for picks in last $LookbackMin minutes for tenant $TenantId"

# Note: Database queries require psql or docker exec into postgres container
# For now, we'll create the SQL and provide instructions
$pickQuery = @'
-- Latest pick for tenant in lookback window
WITH recent AS (
    SELECT id, created_at
    FROM public.picks
    WHERE tenant_id='{0}'
      AND created_at > now() - interval '{1} minutes'
    ORDER BY created_at DESC LIMIT 1
)
SELECT 'pick' AS kind, p.*
FROM public.picks p
JOIN recent r ON p.id=r.id;
'@ -f $TenantId, $LookbackMin

$publishQuery = @'
-- Publish record for recent pick
SELECT 'publish' AS kind, pp.*
FROM public.pick_publish pp
WHERE pp.pick_id IN (
    SELECT id FROM public.picks
    WHERE tenant_id='{0}'
      AND created_at > now() - interval '{1} minutes'
)
ORDER BY created_at DESC LIMIT 1;
'@ -f $TenantId, $LookbackMin

$auditQuery = @'
-- Audit events for recent picks
SELECT 'audit' AS kind, event_type, ref_type, ref_id, created_at
FROM public.audit_log
WHERE tenant_id='{0}'
  AND created_at > now() - interval '{1} minutes'
ORDER BY created_at DESC LIMIT 10;
'@ -f $TenantId, $LookbackMin

Write-Info "Database queries prepared - execute manually with psql or via docker exec"
$results.notes += "Database verification requires manual execution - see generated SQL queries"

# =============================================================================
# STEP 5: Command Center Confirmation
# =============================================================================
Write-Step "STEP 5: Command Center verification..."

Write-Info "Manual verification required: Open http://localhost:3004 and confirm pick appears in live feed"
$results.command_center.method = "manual_ui"
$results.notes += "Command Center verification requires manual UI check"

# =============================================================================
# STEP 6: Generate Attestation Files
# =============================================================================
Write-Step "STEP 6: Generating attestation files..."

# Determine conclusion
$criticalFailures = 0
if (-not $envValid) { $criticalFailures++ }
if (-not $results.health.smart_form.healthy) { $criticalFailures++ }
if ($results.health.picks_status.driver -ne "canonical" -or $results.health.picks_status.publish_mode -ne "outbox") { $criticalFailures++ }

if ($criticalFailures -eq 0) {
    $results.conclusion = "PASS"
} else {
    $results.conclusion = "FAIL"
}

# Write JSON attestation
$results | ConvertTo-Json -Depth 10 | Out-File -FilePath $attestationJson -Encoding UTF8
Write-Pass "JSON attestation written to: $attestationJson"

# Write Markdown attestation
$mdContent = @"
# Canonical Smart Form Cutover Attestation
**Date**: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")  
**Tenant ID**: $TenantId  
**Conclusion**: **$($results.conclusion)**

## Environment Configuration
- **Smart Form PICK_DRIVER**: $($results.env.smart_form.PICK_DRIVER)
- **Smart Form PUBLISH_MODE**: $($results.env.smart_form.PUBLISH_MODE)
- **Smart Form DEFAULT_TENANT_ID**: $($results.env.smart_form.DEFAULT_TENANT_ID)

## Health Checks
- **Smart Form Health**: $($results.health.smart_form.status) $(if ($results.health.smart_form.healthy) { '✅' } else { '❌' })
- **Picks Status Driver**: $($results.health.picks_status.driver)
- **Picks Status Publish Mode**: $($results.health.picks_status.publish_mode)

## DRY-RUN Test
- **Status**: $($results.dry_run.status)
- **Reachable**: $(if ($results.dry_run.reachable) { 'Yes ✅' } else { 'No ❌' })
- **Server Timing**: $($results.dry_run.server_timing_ms) ms

## Notes
$($results.notes | ForEach-Object { "- $_" } | Out-String)

## Next Steps
$(if ($results.conclusion -eq "PASS") {
"✅ Cutover verification passed. System is ready for production use.

Recommended actions:
1. Execute database queries to verify pick persistence
2. Manually verify Command Center displays picks
3. Monitor production traffic for 24 hours
4. Review audit logs for any anomalies"
} else {
"❌ Cutover verification failed. Address the following issues:

$($results.notes | ForEach-Object { "- $_" } | Out-String)

Remediation steps:
1. Ensure Docker containers are running: ./dev.sh start
2. Verify .env file has correct PICK_DRIVER=canonical and PUBLISH_MODE=outbox
3. Rebuild containers: ./dev.sh restart
4. Re-run this verification script"
})

## Database Queries (Manual Execution Required)

### Pick Query
``````sql
$pickQuery
``````

### Publish Query
``````sql
$publishQuery
``````

### Audit Query
``````sql
$auditQuery
``````

Execute with:
``````bash
docker compose exec -T postgres psql -U postgres -d unit_talk_dev -c "<query>"
``````
"@

$mdContent | Out-File -FilePath $attestationMd -Encoding UTF8
Write-Pass "Markdown attestation written to: $attestationMd"

# =============================================================================
# FINAL SUMMARY
# =============================================================================
Write-Host "`n" -NoNewline
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  VERIFICATION COMPLETE: " -NoNewline -ForegroundColor White
if ($results.conclusion -eq "PASS") {
    Write-Host "PASS ✅" -ForegroundColor Green
} else {
    Write-Host "FAIL ❌" -ForegroundColor Red
}
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Attestation files:" -ForegroundColor Yellow
Write-Host "  JSON: $attestationJson" -ForegroundColor White
Write-Host "  MD:   $attestationMd" -ForegroundColor White
Write-Host ""

if ($results.conclusion -eq "FAIL") {
    Write-Host "Critical issues found:" -ForegroundColor Red
    $results.notes | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    Write-Host ""
    exit 1
} else {
    Write-Host "All automated checks passed! ✅" -ForegroundColor Green
    Write-Host "Manual verification steps remaining:" -ForegroundColor Yellow
    Write-Host "  1. Execute database queries to verify pick persistence" -ForegroundColor White
    Write-Host "  2. Check Command Center UI at http://localhost:3004" -ForegroundColor White
    Write-Host ""
    exit 0
}

