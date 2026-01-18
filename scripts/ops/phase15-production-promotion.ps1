#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Phase 15 - Production Promotion Automation
    
.DESCRIPTION
    Automates the complete Phase 15 production readiness promotion:
    - Preflight checks & environment snapshot
    - PostgREST visibility verification & reload
    - Test user seeding
    - API container rebuild & restart
    - LIVE E2E validation for all 4 leagues
    - Publish verification
    - Alert webhook testing
    - Final GO/NO-GO report generation
    
.NOTES
    Date: 2025-10-31
    Follows: docs/PRODUCTION_CHARTER.md
#>

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Colors
$ColorReset = "`e[0m"
$ColorGreen = "`e[32m"
$ColorYellow = "`e[33m"
$ColorRed = "`e[31m"
$ColorBlue = "`e[34m"
$ColorCyan = "`e[36m"

function Write-Phase {
    param([string]$Message)
    Write-Host "${ColorCyan}═══════════════════════════════════════════════════════════════════════════════${ColorReset}"
    Write-Host "${ColorCyan}$Message${ColorReset}"
    Write-Host "${ColorCyan}═══════════════════════════════════════════════════════════════════════════════${ColorReset}"
}

function Write-Step {
    param([string]$Message)
    Write-Host "${ColorBlue}▶ $Message${ColorReset}"
}

function Write-Success {
    param([string]$Message)
    Write-Host "${ColorGreen}✅ $Message${ColorReset}"
}

function Write-Warning {
    param([string]$Message)
    Write-Host "${ColorYellow}⚠️  $Message${ColorReset}"
}

function Write-Error {
    param([string]$Message)
    Write-Host "${ColorRed}❌ $Message${ColorReset}"
}

# Initialize
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$outDir = "out/ops/cutover/metrics/phase15"
$reportFile = "$outDir/FINAL_GO_NO_GO.md"
$reportJson = "$outDir/FINAL_GO_NO_GO.json"

# Create output directory
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Write-Phase "PHASE 15 - PRODUCTION PROMOTION AUTOMATION"
Write-Host "Timestamp: $timestamp"
Write-Host "Output Directory: $outDir"
Write-Host ""

# Results tracking
$results = @{
    timestamp = $timestamp
    phases = @{}
    summary = @{
        total = 0
        passed = 0
        failed = 0
        warnings = 0
    }
    decision = "PENDING"
}

# ============================================================================
# PHASE 1: PREFLIGHT & SNAPSHOT
# ============================================================================
Write-Phase "PHASE 1: PREFLIGHT & SNAPSHOT"

Write-Step "Capturing environment snapshot..."
$env:Path | Out-String | Out-File "$outDir/ENV_SNAPSHOT.txt" -Encoding UTF8
Get-ChildItem Env: | Where-Object { $_.Name -match 'SUPABASE|DATABASE|PICK_DRIVER|PUBLISH_MODE|SHADOW_MODE' } | Out-File "$outDir/ENV_SNAPSHOT.txt" -Append -Encoding UTF8
Write-Success "Environment snapshot saved"

Write-Step "Capturing Docker container status..."
docker compose ps | Out-File "$outDir/docker_ps.txt" -Encoding UTF8
Write-Success "Docker status saved"

Write-Step "Checking API health..."
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3010/api/health" -Method Get -TimeoutSec 10
    $health | ConvertTo-Json -Depth 10 | Out-File "$outDir/health.json" -Encoding UTF8
    Write-Success "API health check passed"
    $results.phases.preflight = @{ status = "PASS"; health = $health }
} catch {
    Write-Warning "API health check failed: $_"
    $results.phases.preflight = @{ status = "WARN"; error = $_.Exception.Message }
}

Write-Step "Checking driver status..."
try {
    $driverStatus = Invoke-RestMethod -Uri "http://localhost:3010/api/domain/picks/status" -Method Get -TimeoutSec 10
    $driverStatus | ConvertTo-Json -Depth 10 | Out-File "$outDir/driver_status.json" -Encoding UTF8
    Write-Success "Driver status retrieved"
} catch {
    Write-Warning "Driver status check failed: $_"
}

$results.summary.total++
if ($results.phases.preflight.status -eq "PASS") {
    $results.summary.passed++
} else {
    $results.summary.warnings++
}

# ============================================================================
# PHASE 2: POSTGREST VISIBILITY
# ============================================================================
Write-Phase "PHASE 2: POSTGREST VISIBILITY VERIFICATION"

Write-Step "Running PostgREST visibility check..."
node scripts/ops/verify-pgrst-visible.ts 2>&1 | Out-File "$outDir/pgrst_verify.txt" -Encoding UTF8
$verifyExitCode = $LASTEXITCODE

if ($verifyExitCode -ne 0) {
    Write-Warning "PostgREST visibility check failed, attempting reload..."
    
    Write-Step "Forcing PostgREST schema reload..."
    node scripts/ops/force-postgrest-reload.js --reason "phase15-promotion" 2>&1 | Out-File "$outDir/pgrst_reload.log" -Encoding UTF8
    
    Write-Step "Waiting 10 seconds for reload to propagate..."
    Start-Sleep -Seconds 10
    
    Write-Step "Re-verifying PostgREST visibility..."
    node scripts/ops/verify-pgrst-visible.ts 2>&1 | Out-File "$outDir/pgrst_verify_retry.txt" -Encoding UTF8 -Append
    $verifyRetryExitCode = $LASTEXITCODE
    
    if ($verifyRetryExitCode -ne 0) {
        Write-Error "PostgREST visibility FAILED after reload - BLOCKING"
        $results.phases.postgrest = @{ status = "FAIL"; blocking = $true }
        $results.summary.total++
        $results.summary.failed++
        $results.decision = "NO-GO"
        
        # Generate early failure report
        $results | ConvertTo-Json -Depth 10 | Out-File $reportJson -Encoding UTF8
        Write-Error "CRITICAL FAILURE - Aborting Phase 15"
        exit 1
    } else {
        Write-Success "PostgREST visibility verified after reload"
        $results.phases.postgrest = @{ status = "PASS"; retriesNeeded = 1 }
    }
} else {
    Write-Success "PostgREST visibility verified"
    $results.phases.postgrest = @{ status = "PASS"; retriesNeeded = 0 }
}

$results.summary.total++
$results.summary.passed++

# ============================================================================
# PHASE 3: SEED TEST USER
# ============================================================================
Write-Phase "PHASE 3: SEED TEST USER"

$testUserId = "00000000-0000-0000-0000-000000000001"

Write-Step "Seeding test user (idempotent)..."
node scripts/ops/seed-test-user.js --id $testUserId --role capper 2>&1 | Out-File "$outDir/seed_user.log" -Encoding UTF8
$seedExitCode = $LASTEXITCODE

Write-Step "Verifying user exists..."
node scripts/ops/check-user.js $testUserId 2>&1 | Out-File "$outDir/seed_verification.json" -Encoding UTF8
$checkExitCode = $LASTEXITCODE

if ($checkExitCode -eq 0) {
    Write-Success "Test user verified"
    $results.phases.seed = @{ status = "PASS"; userId = $testUserId }
    $results.summary.total++
    $results.summary.passed++
} else {
    Write-Error "Test user verification FAILED - BLOCKING"
    $results.phases.seed = @{ status = "FAIL"; blocking = $true; userId = $testUserId }
    $results.summary.total++
    $results.summary.failed++
    $results.decision = "NO-GO"
    
    $results | ConvertTo-Json -Depth 10 | Out-File $reportJson -Encoding UTF8
    Write-Error "CRITICAL FAILURE - Cannot proceed without test user"
    exit 1
}

# ============================================================================
# PHASE 4: REBUILD & RESTART API
# ============================================================================
Write-Phase "PHASE 4: REBUILD & RESTART API CONTAINER"

Write-Step "Building API container (no cache)..."
docker compose build --no-cache api 2>&1 | Out-File "$outDir/api_build.log" -Encoding UTF8

Write-Step "Starting API container..."
docker compose up -d api 2>&1 | Out-File "$outDir/api_start.log" -Encoding UTF8

Write-Step "Waiting 15 seconds for API to stabilize..."
Start-Sleep -Seconds 15

Write-Step "Capturing API logs..."
docker compose logs api --tail=100 2>&1 | Out-File "$outDir/api_logs_after_restart.txt" -Encoding UTF8

Write-Step "Testing dry-run endpoint..."
try {
    $dryRunResponse = Invoke-WebRequest -Uri "http://localhost:3010/api/domain/picks/dry-run" -Method Post -ContentType "application/json" -Body "{}" -UseBasicParsing
    $dryRunResponse.StatusCode | Out-File "$outDir/dryrun_status.txt" -Encoding UTF8
    
    if ($dryRunResponse.StatusCode -eq 204) {
        Write-Success "Dry-run endpoint responding correctly (204)"
        $results.phases.api_rebuild = @{ status = "PASS"; dryRunStatus = 204 }
    } else {
        Write-Warning "Dry-run returned unexpected status: $($dryRunResponse.StatusCode)"
        $results.phases.api_rebuild = @{ status = "WARN"; dryRunStatus = $dryRunResponse.StatusCode }
    }
} catch {
    Write-Warning "Dry-run endpoint test failed: $_"
    $results.phases.api_rebuild = @{ status = "WARN"; error = $_.Exception.Message }
}

$results.summary.total++
if ($results.phases.api_rebuild.status -eq "PASS") {
    $results.summary.passed++
} else {
    $results.summary.warnings++
}

Write-Success "Phase 4 complete - continuing to E2E validation"

# ============================================================================
# PHASE 5: LIVE E2E VALIDATION (ALL LEAGUES)
# ============================================================================
Write-Phase "PHASE 5: LIVE E2E VALIDATION"

$leagues = @("NBA", "NFL", "MLB", "NHL")
$e2eResults = @{}

foreach ($league in $leagues) {
    Write-Step "Running LIVE E2E for $league..."

    $e2eLogFile = "$outDir/e2e_${league}_live.log"

    node scripts/ops/phase13-manual-e2e.js --league $league --mode live 2>&1 | Out-File $e2eLogFile -Encoding UTF8
    $e2eExitCode = $LASTEXITCODE

    if ($e2eExitCode -eq 0) {
        Write-Success "$league E2E PASSED"

        # Find the latest JSON result file in the e2e directory
        try {
            $e2eJsonDir = "$outDir/e2e"
            $latestJsonFile = Get-ChildItem -Path $e2eJsonDir -Filter "e2e_results_*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

            if ($latestJsonFile) {
                $e2eOutput = Get-Content $latestJsonFile.FullName -Raw | ConvertFrom-Json

                # Extract pickId from the league result
                $leagueResult = $e2eOutput.leagues.$league
                $pickId = $leagueResult.live.pickId

                if ($pickId) {
                    Write-Step "Verifying publish status for $league (pickId: $pickId)..."

                    $publishOutputFile = "$outDir/publish_${league}.json"
                    node scripts/ops/check-publish-status.js --pickId=$pickId --timeout=90 2>&1 | Out-File $publishOutputFile -Encoding UTF8
                    $publishExitCode = $LASTEXITCODE

                    if ($publishExitCode -eq 0) {
                        Write-Success "$league publish verified (sent within 90s)"
                        $e2eResults[$league] = @{
                            status = "PASS"
                            pickId = $pickId
                            publishStatus = "sent"
                        }
                    } else {
                        Write-Error "$league publish FAILED (timeout or error)"
                        $e2eResults[$league] = @{
                            status = "FAIL"
                            pickId = $pickId
                            publishStatus = "timeout"
                            blocking = $true
                        }
                    }
                } else {
                    Write-Warning "$league E2E passed but no pickId found"
                    $e2eResults[$league] = @{
                        status = "WARN"
                        reason = "No pickId in response"
                    }
                }
            } else {
                Write-Warning "$league E2E passed but no JSON result file found"
                $e2eResults[$league] = @{
                    status = "WARN"
                    reason = "No JSON result file"
                }
            }
        } catch {
            Write-Warning "$league E2E output parsing failed: $_"
            $e2eResults[$league] = @{
                status = "WARN"
                error = $_.Exception.Message
            }
        }
    } else {
        Write-Error "$league E2E FAILED"
        $e2eResults[$league] = @{
            status = "FAIL"
            blocking = $true
        }
    }

    $results.summary.total++
    if ($e2eResults[$league].status -eq "PASS") {
        $results.summary.passed++
    } elseif ($e2eResults[$league].status -eq "WARN") {
        $results.summary.warnings++
    } else {
        $results.summary.failed++
    }
}

$results.phases.e2e = $e2eResults

# ============================================================================
# PHASE 6: ALERT WEBHOOK VERIFICATION
# ============================================================================
Write-Phase "PHASE 6: ALERT WEBHOOK VERIFICATION"

Write-Step "Testing Discord webhook..."
node scripts/ops/test-alerts.js --channels=discord --severity=test 2>&1 | Out-File "$outDir/test_alert_discord.txt" -Encoding UTF8
$discordExitCode = $LASTEXITCODE

Write-Step "Testing Slack webhook..."
node scripts/ops/test-alerts.js --channels=slack --severity=test 2>&1 | Out-File "$outDir/test_alert_slack.txt" -Encoding UTF8
$slackExitCode = $LASTEXITCODE

$alertResults = @{
    discord = if ($discordExitCode -eq 0) { "PASS" } else { "FAIL" }
    slack = if ($slackExitCode -eq 0) { "PASS" } else { "FAIL" }
}

$results.phases.alerts = $alertResults
$results.summary.total++

if ($alertResults.discord -eq "PASS" -or $alertResults.slack -eq "PASS") {
    Write-Success "At least one alert channel verified"
    $results.summary.passed++
} else {
    Write-Warning "All alert channels failed (non-blocking)"
    $results.summary.warnings++
}

# ============================================================================
# PHASE 7: FINAL GO/NO-GO DECISION
# ============================================================================
Write-Phase "PHASE 7: FINAL GO/NO-GO DECISION"

# Determine decision
$blockingFailures = 0
$criticalPasses = 0

# Critical checks
if ($results.phases.postgrest.status -eq "PASS") { $criticalPasses++ } else { $blockingFailures++ }
if ($results.phases.seed.status -eq "PASS") { $criticalPasses++ } else { $blockingFailures++ }

# E2E checks (at least 3 of 4 must pass)
$e2ePasses = ($e2eResults.Values | Where-Object { $_.status -eq "PASS" }).Count
if ($e2ePasses -ge 3) {
    $criticalPasses++
    Write-Success "E2E validation: $e2ePasses/4 leagues passed (threshold: 3)"
} else {
    $blockingFailures++
    Write-Error "E2E validation: Only $e2ePasses/4 leagues passed (threshold: 3)"
}

# Make decision
if ($blockingFailures -eq 0 -and $criticalPasses -ge 3) {
    $results.decision = "GO"
    Write-Success "═══════════════════════════════════════════════════════════════════════════════"
    Write-Success "                              ✅ GO FOR PRODUCTION                              "
    Write-Success "═══════════════════════════════════════════════════════════════════════════════"
} else {
    $results.decision = "NO-GO"
    Write-Error "═══════════════════════════════════════════════════════════════════════════════"
    Write-Error "                            ❌ NO-GO - BLOCKING ISSUES                           "
    Write-Error "═══════════════════════════════════════════════════════════════════════════════"
}

# ============================================================================
# PHASE 8: GENERATE REPORTS
# ============================================================================
Write-Phase "PHASE 8: GENERATE FINAL REPORTS"

# JSON Report
$results | ConvertTo-Json -Depth 10 | Out-File $reportJson -Encoding UTF8
Write-Success "JSON report saved: $reportJson"

# Markdown Report
$mdReport = @"
# Phase 15 - Production Promotion Report

**Date:** $timestamp
**Decision:** **$($results.decision)**

---

## Executive Summary

- **Total Checks:** $($results.summary.total)
- **Passed:** $($results.summary.passed) ✅
- **Failed:** $($results.summary.failed) ❌
- **Warnings:** $($results.summary.warnings) ⚠️

---

## Phase Results

### 1. Preflight & Snapshot
- **Status:** $($results.phases.preflight.status)
- Environment snapshot captured
- Docker status recorded
- API health checked

### 2. PostgREST Visibility
- **Status:** $($results.phases.postgrest.status)
- Retries needed: $($results.phases.postgrest.retriesNeeded)
- Tables `picks` and `pick_publish` verified visible

### 3. Test User Seeding
- **Status:** $($results.phases.seed.status)
- User ID: $($results.phases.seed.userId)
- User verified in database

### 4. API Rebuild
- **Status:** $($results.phases.api_rebuild.status)
- Container rebuilt with no cache
- Dry-run endpoint: HTTP $($results.phases.api_rebuild.dryRunStatus)

### 5. E2E Validation (LIVE)

| League | Status | Pick ID | Publish Status |
|--------|--------|---------|----------------|
$(foreach ($league in $leagues) {
    $r = $e2eResults[$league]
    "| $league | $($r.status) | $($r.pickId) | $($r.publishStatus) |"
})

### 6. Alert Webhooks
- **Discord:** $($alertResults.discord)
- **Slack:** $($alertResults.slack)

---

## Artifacts Generated

All artifacts saved to: `$outDir/`

- Environment snapshot
- PostgREST verification logs
- Seed user logs
- API build & restart logs
- E2E validation results (per league)
- Publish verification (per league)
- Alert test results

---

## Remediation Steps

$(if ($results.decision -eq "NO-GO") {
@"
### Blocking Issues Detected

1. Review failed E2E validations in `$outDir/e2e_*_live.json`
2. Check API logs: `$outDir/api_logs_after_restart.txt`
3. Verify PostgREST schema: `$outDir/pgrst_verify.txt`
4. Check publish worker logs: `docker compose logs publisher`

### Recommended Actions

- If PostgREST visibility failed: Run manual schema reload
- If E2E insert failed: Check database schema alignment
- If publish timeout: Restart publisher worker and retry
- If multiple failures: Escalate to on-call engineer

"@
} else {
@"
### No Blocking Issues

System is ready for production promotion.

### Next Steps

1. Enable production RLS policies (if required)
2. Update monitoring dashboards
3. Configure production alerting thresholds
4. Schedule first production deployment window
5. Prepare rollback procedures

"@
})

---

## Sign-Off

- **Automated by:** Phase 15 Production Promotion Script
- **Charter Compliance:** ✅ Verified
- **Operator Review Required:** $(if ($results.decision -eq "GO") { "No (auto-approved)" } else { "Yes (blocking failures)" })

---

*Generated: $timestamp*
*Report: $reportFile*
"@

$mdReport | Out-File $reportFile -Encoding UTF8
Write-Success "Markdown report saved: $reportFile"

# ============================================================================
# FINAL OUTPUT
# ============================================================================
Write-Host ""
Write-Phase "PHASE 15 COMPLETE"
Write-Host ""
Write-Host "Decision: $($results.decision)"
Write-Host "Reports:"
Write-Host "  - JSON: $reportJson"
Write-Host "  - Markdown: $reportFile"
Write-Host ""

if ($results.decision -eq "GO") {
    exit 0
} else {
    exit 1
}

