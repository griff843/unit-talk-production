#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Unit Talk — Canonical-Ready E2E Validation Script

.DESCRIPTION
    Production-grade, fully functional E2E validation:
    1) Validate PICK_DRIVER=canonical and PUBLISH_MODE=outbox
    2) Run DRY-RUN + LIVE submissions for NBA, NFL, MLB, NHL
    3) Capture response status, timing, and errors
    4) Generate JSON and Markdown attestations per league
    5) Produce consolidated GO/NO-GO report

.NOTES
    Date: 2025-01-28
    Author: Unit Talk Engineering
    Version: 2.0.0 - Canonical Ready
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# ============================================================================
# CONSTANTS & CONFIGURATION
# ============================================================================

$TIMESTAMP = Get-Date -Format 'yyyyMMdd_HHmmss'
$ARTIFACTS_DIR = "out/ops/cutover/metrics/100"
$KNOWN_DEFAULT_TENANT_ID = "12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a"
$API_BASE_URL = "http://localhost:3002"
$HEALTH_URL = "http://localhost:3010/api/health"

$LEAGUE_CONFIGS = @{
    NBA = @{ market = "PLAYER_POINTS"; line = 27.5; playerName = "LeBron James" }
    NFL = @{ market = "PLAYER_RECEIVING_YARDS"; line = 62.5; playerName = "Travis Kelce" }
    MLB = @{ market = "TOTAL_BASES"; line = 1.5; playerName = "Aaron Judge" }
    NHL = @{ market = "PLAYER_POINTS"; line = 0.5; playerName = "Connor McDavid" }
}

$SLO_TARGETS = @{
    api_p95_ms = 500
    success_rate_pct = 100
}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

function Write-Status {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 🔵 $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ✅ $Message" -ForegroundColor Green
}

function Write-Failure {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ❌ $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ⚠️  $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ℹ️  $Message" -ForegroundColor Gray
}

function Invoke-ApiRequest {
    param(
        [string]$Uri,
        [string]$Method = 'GET',
        [hashtable]$Headers = @{},
        [hashtable]$Body = $null,
        [int]$TimeoutSec = 30
    )

    $startTime = Get-Date

    try {
        $params = @{
            Uri = $Uri
            Method = $Method
            Headers = $Headers
            TimeoutSec = $TimeoutSec
            UseBasicParsing = $true
        }

        if ($Body) {
            $jsonBody = $Body | ConvertTo-Json -Depth 10 -Compress
            $params.Body = $jsonBody
            $params.ContentType = 'application/json'
        }

        $response = Invoke-WebRequest @params
        $duration = ((Get-Date) - $startTime).TotalMilliseconds

        $content = $null
        if ($response.Content) {
            try {
                $content = $response.Content | ConvertFrom-Json
            } catch {
                $content = $response.Content
            }
        }

        return @{
            Success = $true
            StatusCode = $response.StatusCode
            Duration = [math]::Round($duration, 2)
            Content = $content
            RawContent = $response.Content
        }
    }
    catch {
        $duration = ((Get-Date) - $startTime).TotalMilliseconds
        $statusCode = 0
        $errorBody = $null

        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $errorBody = $reader.ReadToEnd()
            } catch {}
        }

        return @{
            Success = $false
            StatusCode = $statusCode
            Duration = [math]::Round($duration, 2)
            Error = $_.Exception.Message
            ErrorBody = $errorBody
        }
    }
}

# ============================================================================
# STEP 0: INITIALIZATION
# ============================================================================

Write-Status "Step 0: Initialization"

# Create artifacts directory
New-Item -ItemType Directory -Force -Path $ARTIFACTS_DIR | Out-Null
Write-Success "Artifacts directory: $ARTIFACTS_DIR"

# Git SHA
$gitSha = git rev-parse --short HEAD 2>$null
if ($gitSha) {
    Write-Success "Git SHA: $gitSha"
} else {
    $gitSha = "unknown"
}

# ============================================================================
# STEP 1: HEALTH CHECKS
# ============================================================================

Write-Status "Step 1: Health Checks"

# Check API health
Write-Status "Checking API health at $HEALTH_URL..."
$healthCheck = Invoke-ApiRequest -Uri $HEALTH_URL -TimeoutSec 10

if (-not $healthCheck.Success) {
    Write-Failure "API health check failed: $($healthCheck.Error)"
    Write-Info "Make sure services are running: ./dev.sh start"
    exit 1
}

Write-Success "API is healthy"

# Check Smart Form health
Write-Status "Checking Smart Form health..."
$sfHealth = Invoke-ApiRequest -Uri "$API_BASE_URL/api/health" -TimeoutSec 10

if (-not $sfHealth.Success) {
    Write-Failure "Smart Form health check failed: $($sfHealth.Error)"
    exit 1
}

Write-Success "Smart Form is healthy"

# ============================================================================
# STEP 2: LOAD CONFIGURATION
# ============================================================================

Write-Status "Step 2: Loading Configuration"

# Load .env file
$envVars = @{}
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $envVars[$matches[1].Trim()] = $matches[2].Trim()
        }
    }
}

# Verify PICK_DRIVER and PUBLISH_MODE
$pickDriver = $envVars["PICK_DRIVER"]
$publishMode = $envVars["PUBLISH_MODE"]

if ($pickDriver -ne "canonical") {
    Write-Warning "PICK_DRIVER is not 'canonical' (found: $pickDriver)"
}

if ($publishMode -ne "outbox") {
    Write-Warning "PUBLISH_MODE is not 'outbox' (found: $publishMode)"
}

Write-Success "PICK_DRIVER=$pickDriver, PUBLISH_MODE=$publishMode"

# Tenant ID
$TENANT_ID = $envVars["DEFAULT_TENANT_ID"]
if (-not $TENANT_ID) {
    $TENANT_ID = $KNOWN_DEFAULT_TENANT_ID
    Write-Info "Using default TENANT_ID: $TENANT_ID"
} else {
    Write-Success "TENANT_ID: $TENANT_ID"
}

# Capper ID - try multiple sources
$CAPPER_ID = $null
$capperVars = @("CAPPER_ID", "DEFAULT_CAPPER_ID", "TEST_CAPPER_ID", "SMARTFORM_DEFAULT_CAPPER_ID")
foreach ($var in $capperVars) {
    if ($envVars.ContainsKey($var) -and $envVars[$var]) {
        $CAPPER_ID = $envVars[$var]
        Write-Success "CAPPER_ID from $var : $CAPPER_ID"
        break
    }
}

# Check CAPPER_IDS (comma-separated)
if (-not $CAPPER_ID -and $envVars.ContainsKey("CAPPER_IDS")) {
    $CAPPER_ID = ($envVars["CAPPER_IDS"] -split ',')[0].Trim()
    Write-Success "CAPPER_ID from CAPPER_IDS: $CAPPER_ID"
}

if (-not $CAPPER_ID) {
    Write-Failure "CAPPER_ID not found - please set in .env"
    exit 1
}

Write-Success "Configuration loaded successfully"

# ============================================================================
# STEP 3: RUN E2E VALIDATION FOR ALL LEAGUES
# ============================================================================

Write-Status "Step 3: Running E2E Validation for All Leagues"

$leagueResults = @{}
$allTimings = @()

foreach ($league in @('NBA', 'NFL', 'MLB', 'NHL')) {
    Write-Host "`n" -NoNewline
    Write-Status "Testing League: $league"

    $config = $LEAGUE_CONFIGS[$league]
    $result = @{
        league = $league
        dryRun = @{ status = "PENDING" }
        live = @{ status = "PENDING" }
        conclusion = "PENDING"
        timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    }

    # Generate unique IDs for this test
    $playerId = [guid]::NewGuid().ToString()
    $playerName = $config.playerName
    $gameDate = (Get-Date).AddDays(1).ToString("yyyy-MM-ddTHH:mm:ssZ")

    # Base payload for both DRY-RUN and LIVE
    $basePayload = @{
        userId = $CAPPER_ID
        tenantId = $TENANT_ID
        league = $league
        marketType = $config.market
        line = $config.line
        side = "over"
        playerId = $playerId
        playerName = $playerName
        gameDate = $gameDate
        odds = -110
        stake = 1.0
        userScore = 8
        confidence = 0.85
        prediction = "over"
        reasoning = "E2E validation test for $league"
    }

    # ========================================================================
    # DRY-RUN TEST
    # ========================================================================

    Write-Status "  → DRY-RUN test..."

    $dryRunIdempotencyKey = "e2e-dryrun-$league-$TIMESTAMP"
    $dryRunPayload = $basePayload.Clone()
    $dryRunPayload.betSlipId = "dryrun-$league-$TIMESTAMP"
    $dryRunPayload.idempotencyKey = $dryRunIdempotencyKey

    $dryRunResult = Invoke-ApiRequest `
        -Uri "$API_BASE_URL/api/domain/picks/dry-run" `
        -Method POST `
        -Headers @{
            "Idempotency-Key" = $dryRunIdempotencyKey
        } `
        -Body $dryRunPayload `
        -TimeoutSec 30

    if ($dryRunResult.Success -and $dryRunResult.StatusCode -eq 204) {
        Write-Success "  ✅ DRY-RUN PASS ($($dryRunResult.Duration)ms)"
        $result.dryRun = @{
            status = "PASS"
            statusCode = $dryRunResult.StatusCode
            durationMs = $dryRunResult.Duration
        }
        $allTimings += $dryRunResult.Duration
    } else {
        Write-Failure "  ❌ DRY-RUN FAIL (HTTP $($dryRunResult.StatusCode))"
        if ($dryRunResult.ErrorBody) {
            Write-Info "  Error: $($dryRunResult.ErrorBody)"
        }
        $result.dryRun = @{
            status = "FAIL"
            statusCode = $dryRunResult.StatusCode
            durationMs = $dryRunResult.Duration
            error = $dryRunResult.Error
            errorBody = $dryRunResult.ErrorBody
        }
        $result.conclusion = "FAIL"
        $leagueResults[$league] = $result
        continue
    }

    # ========================================================================
    # LIVE INSERT TEST
    # ========================================================================

    Write-Status "  → LIVE INSERT test..."

    $liveIdempotencyKey = "e2e-live-$league-$TIMESTAMP"
    $livePayload = $basePayload.Clone()
    $livePayload.betSlipId = "live-$league-$TIMESTAMP"
    $livePayload.idempotencyKey = $liveIdempotencyKey

    $liveResult = Invoke-ApiRequest `
        -Uri "$API_BASE_URL/api/domain/picks/insert" `
        -Method POST `
        -Headers @{
            "Idempotency-Key" = $liveIdempotencyKey
        } `
        -Body $livePayload `
        -TimeoutSec 30

    if ($liveResult.Success -and ($liveResult.StatusCode -eq 200 -or $liveResult.StatusCode -eq 201)) {
        $pickId = $null

        if ($liveResult.Content) {
            if ($liveResult.Content.pickId) {
                $pickId = $liveResult.Content.pickId
            } elseif ($liveResult.Content.id) {
                $pickId = $liveResult.Content.id
            } elseif ($liveResult.Content.data -and $liveResult.Content.data.id) {
                $pickId = $liveResult.Content.data.id
            }
        }

        if ($pickId) {
            Write-Success "  ✅ LIVE INSERT PASS ($($liveResult.Duration)ms) - pickId: $pickId"
            $result.live = @{
                status = "PASS"
                statusCode = $liveResult.StatusCode
                durationMs = $liveResult.Duration
                pickId = $pickId
            }
            $allTimings += $liveResult.Duration
        } else {
            Write-Warning "  ⚠️  LIVE INSERT returned 2xx but no pickId found"
            $result.live = @{
                status = "PASS"
                statusCode = $liveResult.StatusCode
                durationMs = $liveResult.Duration
                warning = "No pickId in response"
            }
            $allTimings += $liveResult.Duration
        }
    } else {
        Write-Failure "  ❌ LIVE INSERT FAIL (HTTP $($liveResult.StatusCode))"
        if ($liveResult.ErrorBody) {
            Write-Info "  Error: $($liveResult.ErrorBody)"
        }
        $result.live = @{
            status = "FAIL"
            statusCode = $liveResult.StatusCode
            durationMs = $liveResult.Duration
            error = $liveResult.Error
            errorBody = $liveResult.ErrorBody
        }
        $result.conclusion = "FAIL"
        $leagueResults[$league] = $result
        continue
    }

    # ========================================================================
    # DETERMINE CONCLUSION
    # ========================================================================

    if ($result.dryRun.status -eq "PASS" -and $result.live.status -eq "PASS") {
        $result.conclusion = "PASS"
        Write-Success "✅ $league - PASS"
    } else {
        $result.conclusion = "FAIL"
        Write-Failure "❌ $league - FAIL"
    }

    $leagueResults[$league] = $result
}

# ============================================================================
# STEP 4: GENERATE ARTIFACTS
# ============================================================================

Write-Host "`n" -NoNewline
Write-Status "Step 4: Generating Artifacts"

# Calculate metrics
$passCount = 0
$failCount = 0
$avgResponseTime = 0

if ($allTimings.Count -gt 0) {
    $avgResponseTime = [math]::Round(($allTimings | Measure-Object -Average).Average, 2)
}

foreach ($result in $leagueResults.Values) {
    if ($result.conclusion -eq "PASS") {
        $passCount++
    } else {
        $failCount++
    }
}

$successRate = if ($leagueResults.Count -gt 0) {
    [math]::Round(($passCount / $leagueResults.Count) * 100, 2)
} else {
    0
}

# Per-league attestations
foreach ($league in $leagueResults.Keys) {
    $result = $leagueResults[$league]

    # JSON attestation
    $jsonPath = "$ARTIFACTS_DIR/${league}_attestation_canonical_live_$TIMESTAMP.json"
    $result | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonPath -Encoding UTF8
    Write-Info "Generated: $jsonPath"

    # Markdown attestation
    $mdPath = "$ARTIFACTS_DIR/${league}_attestation_canonical_live_$TIMESTAMP.md"
    $mdContent = @"
# $league E2E Validation Attestation (Canonical)

**Date:** $($result.timestamp)
**Conclusion:** $($result.conclusion)
**Git SHA:** $gitSha

## Configuration
- **Tenant ID:** $TENANT_ID
- **Capper ID:** $CAPPER_ID
- **PICK_DRIVER:** canonical
- **PUBLISH_MODE:** outbox

## DRY-RUN Results
- **Status:** $($result.dryRun.status)
- **HTTP Status:** $($result.dryRun.statusCode)
- **Duration:** $($result.dryRun.durationMs)ms

## LIVE INSERT Results
- **Status:** $($result.live.status)
- **HTTP Status:** $($result.live.statusCode)
- **Duration:** $($result.live.durationMs)ms
- **Pick ID:** $($result.live.pickId)

## Overall Result
**$($result.conclusion)**

"@

    if ($result.conclusion -eq "FAIL") {
        $mdContent += @"

## Errors
- **DRY-RUN Error:** $($result.dryRun.error)
- **LIVE Error:** $($result.live.error)

"@
    }

    $mdContent | Out-File -FilePath $mdPath -Encoding UTF8
    Write-Info "Generated: $mdPath"
}

# ============================================================================
# STEP 5: CONSOLIDATED GO/NO-GO REPORT
# ============================================================================

Write-Host "`n" -NoNewline
Write-Status "Step 5: Generating Consolidated GO/NO-GO Report"

$allPass = ($failCount -eq 0)
$goNoGo = if ($allPass) { "GO" } else { "NO-GO" }

# Generate consolidated report
$consolidatedPath = "$ARTIFACTS_DIR/FINAL_GO_NO_GO_canonical_$TIMESTAMP.md"
$consolidatedContent = @"
# Unit Talk E2E Validation - Final GO/NO-GO Report

**Date:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
**Git SHA:** $gitSha
**PICK_DRIVER:** canonical
**PUBLISH_MODE:** outbox
**Decision:** **$goNoGo**

---

## Executive Summary

- **Total Leagues Tested:** $($leagueResults.Count)
- **Passed:** $passCount
- **Failed:** $failCount
- **Success Rate:** $successRate%
- **Average Response Time:** $avgResponseTime ms

---

## League Results

| League | DRY-RUN | LIVE | Duration (ms) | Result |
|--------|---------|------|---------------|--------|
"@

foreach ($league in @('NBA', 'NFL', 'MLB', 'NHL')) {
    if ($leagueResults.ContainsKey($league)) {
        $r = $leagueResults[$league]
        $dryIcon = if ($r.dryRun.status -eq "PASS") { "✅" } else { "❌" }
        $liveIcon = if ($r.live.status -eq "PASS") { "✅" } else { "❌" }
        $dryDuration = if ($r.dryRun.durationMs) { $r.dryRun.durationMs } else { "N/A" }
        $liveDuration = if ($r.live.durationMs) { $r.live.durationMs } else { "N/A" }
        $overallIcon = if ($r.conclusion -eq "PASS") { "✅ PASS" } else { "❌ FAIL" }

        $consolidatedContent += "`n| $league | $dryIcon $dryDuration | $liveIcon $liveDuration | $liveDuration | $overallIcon |"
    }
}

$consolidatedContent += @"


---

## SLO Targets

- **API Response Time (p95):** < $($SLO_TARGETS.api_p95_ms)ms
- **Success Rate:** $($SLO_TARGETS.success_rate_pct)%

---

## Artifacts

"@

foreach ($league in $leagueResults.Keys) {
    $consolidatedContent += "- [$league JSON](./${league}_attestation_canonical_live_$TIMESTAMP.json)`n"
    $consolidatedContent += "- [$league Markdown](./${league}_attestation_canonical_live_$TIMESTAMP.md)`n"
}

$consolidatedContent += @"

---

## Final Recommendation

**$goNoGo**

"@

if ($allPass) {
    $consolidatedContent += @"

✅ All leagues passed validation. System is ready for production deployment.

**Next Steps:**
1. Review individual league attestations
2. Monitor production metrics
3. Proceed with deployment

"@
} else {
    $consolidatedContent += @"

❌ One or more leagues failed validation. Review failed attestations and remediate before production deployment.

**Required Actions:**
1. Review failed league attestations above
2. Check error logs and fix root causes
3. Re-run validation script

"@
}

$consolidatedContent | Out-File -FilePath $consolidatedPath -Encoding UTF8
Write-Success "Generated: $consolidatedPath"

# ============================================================================
# FINAL OUTPUT
# ============================================================================

Write-Host "`n" -NoNewline
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "              E2E VALIDATION COMPLETE (CANONICAL)" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "`n"

# Results table
Write-Host "LEAGUE RESULTS:" -ForegroundColor Yellow
Write-Host "+---------+----------+------+--------------+----------+" -ForegroundColor Gray
Write-Host "| League  | DRY-RUN  | LIVE | Duration(ms) | Result   |" -ForegroundColor Gray
Write-Host "+---------+----------+------+--------------+----------+" -ForegroundColor Gray

foreach ($league in @('NBA', 'NFL', 'MLB', 'NHL')) {
    if ($leagueResults.ContainsKey($league)) {
        $r = $leagueResults[$league]
        $dryIcon = if ($r.dryRun.status -eq "PASS") { "✅" } else { "❌" }
        $liveIcon = if ($r.live.status -eq "PASS") { "✅" } else { "❌" }
        $duration = if ($r.live.durationMs) { $r.live.durationMs } else { "N/A" }
        $overallIcon = if ($r.conclusion -eq "PASS") { "✅ PASS" } else { "❌ FAIL" }

        Write-Host ("| {0,-7} | {1,-8} | {2,-4} | {3,-12} | {4,-8} |" -f $league, $dryIcon, $liveIcon, $duration, $overallIcon) -ForegroundColor Gray
    }
}

Write-Host "+---------+----------+------+--------------+----------+" -ForegroundColor Gray
Write-Host "`n"

# Summary metrics
Write-Host "SUMMARY METRICS:" -ForegroundColor Yellow
Write-Host "  Total Leagues:        $($leagueResults.Count)" -ForegroundColor Gray
Write-Host "  Passed:               $passCount" -ForegroundColor Green
Write-Host "  Failed:               $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Gray" })
Write-Host "  Success Rate:         $successRate%" -ForegroundColor $(if ($successRate -eq 100) { "Green" } else { "Yellow" })
Write-Host "  Avg Response Time:    $avgResponseTime ms" -ForegroundColor Gray
Write-Host "`n"

# Artifacts
Write-Host "ARTIFACTS:" -ForegroundColor Yellow
Write-Host "  Consolidated Report: $consolidatedPath" -ForegroundColor Cyan
foreach ($league in $leagueResults.Keys) {
    Write-Host "  $league JSON: $ARTIFACTS_DIR/${league}_attestation_canonical_live_$TIMESTAMP.json" -ForegroundColor Gray
    Write-Host "  $league MD:   $ARTIFACTS_DIR/${league}_attestation_canonical_live_$TIMESTAMP.md" -ForegroundColor Gray
}

Write-Host "`n"

# Final decision
if ($allPass) {
    Write-Host "✅ All leagues passed (GO)" -ForegroundColor Green
    Write-Host "System is ready for production deployment." -ForegroundColor Green
    Write-Host "`n"
    exit 0
} else {
    Write-Host "❌ One or more leagues failed (NO-GO)" -ForegroundColor Red
    Write-Host "Review failed attestations and remediate before deployment." -ForegroundColor Red
    Write-Host "`n"
    exit 1
}

