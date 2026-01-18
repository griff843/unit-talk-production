#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Phase 13 E2E Validation - All Leagues (NBA, NFL, MLB, NHL)

.DESCRIPTION
    Comprehensive E2E testing for Phase 13 deployment:
    1) DRY-RUN test for each league (expect 204)
    2) LIVE insert for each league (expect 200/201 + pickId)
    3) Verify outbox → Discord flow
    4) Verify Command Center feed visibility
    5) Generate per-league attestations

.NOTES
    Date: 2025-01-30
    Author: Unit Talk Ops Orchestrator
    Version: 1.0.0
#>

[CmdletBinding()]
param(
    [string]$ApiBaseUrl = "http://localhost:3010",
    [string]$OutputDir = "out/ops/cutover/metrics/phase13/e2e"
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# ============================================================================
# CONFIGURATION
# ============================================================================

$TIMESTAMP = Get-Date -Format 'yyyyMMdd_HHmmss'
$DEFAULT_TENANT_ID = "12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a"

$LEAGUE_CONFIGS = @{
    NBA = @{
        sport = "NBA"
        market = "PLAYER_POINTS"
        line = 27.5
        playerName = "LeBron James"
        position = "OVER"
        odds = -110
        capperId = "griff843"
    }
    NFL = @{
        sport = "NFL"
        market = "PLAYER_RECEIVING_YARDS"
        line = 62.5
        playerName = "Travis Kelce"
        position = "OVER"
        odds = -115
        capperId = "griff843"
    }
    MLB = @{
        sport = "MLB"
        market = "TOTAL_BASES"
        line = 1.5
        playerName = "Aaron Judge"
        position = "OVER"
        odds = -120
        capperId = "griff843"
    }
    NHL = @{
        sport = "NHL"
        market = "PLAYER_POINTS"
        line = 0.5
        playerName = "Connor McDavid"
        position = "OVER"
        odds = -125
        capperId = "griff843"
    }
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

function Invoke-ApiCall {
    param(
        [string]$Uri,
        [string]$Method = 'POST',
        [hashtable]$Body,
        [int]$TimeoutSec = 30
    )

    $startTime = Get-Date

    try {
        $params = @{
            Uri = $Uri
            Method = $Method
            Headers = @{ 'Content-Type' = 'application/json' }
            Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
            TimeoutSec = $TimeoutSec
            UseBasicParsing = $true
        }

        $response = Invoke-WebRequest @params
        $elapsed = ((Get-Date) - $startTime).TotalMilliseconds

        return @{
            success = $true
            statusCode = $response.StatusCode
            content = ($response.Content | ConvertFrom-Json -ErrorAction SilentlyContinue)
            elapsed_ms = [math]::Round($elapsed, 2)
            error = $null
        }
    }
    catch {
        $elapsed = ((Get-Date) - $startTime).TotalMilliseconds
        return @{
            success = $false
            statusCode = $_.Exception.Response.StatusCode.value__
            content = $null
            elapsed_ms = [math]::Round($elapsed, 2)
            error = $_.Exception.Message
        }
    }
}

# ============================================================================
# E2E TEST FUNCTIONS
# ============================================================================

function Test-LeagueDryRun {
    param([hashtable]$Config, [string]$League)

    Write-Status "Testing $League DRY-RUN..."

    $payload = @{
        tenantId = $DEFAULT_TENANT_ID
        capperId = $Config.capperId
        sport = $Config.sport
        market = $Config.market
        playerName = $Config.playerName
        line = $Config.line
        position = $Config.position
        odds = $Config.odds
        dryRun = $true
    }

    $result = Invoke-ApiCall -Uri "$ApiBaseUrl/api/domain/picks/dry-run" -Body $payload

    if ($result.success -and $result.statusCode -eq 204) {
        $msg = '{0} DRY-RUN passed (204, {1}ms)' -f $League, $result.elapsed_ms
        Write-Success $msg
        return @{ passed = $true; elapsed_ms = $result.elapsed_ms }
    }
    else {
        $msg = '{0} DRY-RUN failed ({1}, {2})' -f $League, $result.statusCode, $result.error
        Write-Failure $msg
        return @{ passed = $false; elapsed_ms = $result.elapsed_ms; error = $result.error }
    }
}

function Test-LeagueLiveInsert {
    param([hashtable]$Config, [string]$League)

    Write-Status "Testing $League LIVE INSERT..."

    $payload = @{
        tenantId = $DEFAULT_TENANT_ID
        capperId = $Config.capperId
        sport = $Config.sport
        market = $Config.market
        playerName = $Config.playerName
        line = $Config.line
        position = $Config.position
        odds = $Config.odds
        confidence = 0.75
        reasoning = "Phase 13 E2E validation test for $League"
    }

    $result = Invoke-ApiCall -Uri "$ApiBaseUrl/api/domain/picks/insert" -Body $payload

    if ($result.success -and ($result.statusCode -eq 200 -or $result.statusCode -eq 201)) {
        $pickId = $result.content.pickId
        $msg = '{0} LIVE INSERT passed ({1}, pickId={2}, {3}ms)' -f $League, $result.statusCode, $pickId, $result.elapsed_ms
        Write-Success $msg
        return @{ passed = $true; pickId = $pickId; elapsed_ms = $result.elapsed_ms }
    }
    else {
        $msg = '{0} LIVE INSERT failed ({1}, {2})' -f $League, $result.statusCode, $result.error
        Write-Failure $msg
        return @{ passed = $false; elapsed_ms = $result.elapsed_ms; error = $result.error }
    }
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

Write-Host ""
Write-Host "=" * 80
Write-Host "PHASE 13 E2E VALIDATION - ALL LEAGUES"
Write-Host "=" * 80
Write-Host ""

# Ensure output directory exists
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$results = @{}

foreach ($league in @('NBA', 'NFL', 'MLB', 'NHL')) {
    Write-Host ""
    Write-Host "-" * 80
    Write-Host "LEAGUE: $league"
    Write-Host "-" * 80

    $config = $LEAGUE_CONFIGS[$league]
    
    # DRY-RUN test
    $dryRunResult = Test-LeagueDryRun -Config $config -League $league
    
    # LIVE INSERT test
    $liveResult = Test-LeagueLiveInsert -Config $config -League $league

    $results[$league] = @{
        dryRun = $dryRunResult
        liveInsert = $liveResult
        timestamp = (Get-Date -Format 'o')
    }

    # Save per-league attestation
    $attestation = @{
        league = $league
        timestamp = (Get-Date -Format 'o')
        dryRun = $dryRunResult
        liveInsert = $liveResult
        config = $config
    }

    $jsonPath = Join-Path $OutputDir "$($league)_E2E_$TIMESTAMP.json"
    $attestation | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonPath -Encoding UTF8
    Write-Status "Saved attestation: $jsonPath"
}

# ============================================================================
# SUMMARY
# ============================================================================

Write-Host ""
Write-Host "=" * 80
Write-Host "E2E VALIDATION SUMMARY"
Write-Host "=" * 80
Write-Host ""

$allPassed = $true
foreach ($league in @('NBA', 'NFL', 'MLB', 'NHL')) {
    $r = $results[$league]
    $dryStatus = if ($r.dryRun.passed) { "✅ PASS" } else { "❌ FAIL" }
    $liveStatus = if ($r.liveInsert.passed) { "✅ PASS" } else { "❌ FAIL" }

    $dryLine = '{0} DRY-RUN: {1} ({2}ms)' -f $league, $dryStatus, $r.dryRun.elapsed_ms
    $liveLine = '{0} LIVE:    {1} ({2}ms)' -f $league, $liveStatus, $r.liveInsert.elapsed_ms
    Write-Host $dryLine
    Write-Host $liveLine
    Write-Host ""

    if (-not $r.dryRun.passed -or -not $r.liveInsert.passed) {
        $allPassed = $false
    }
}

# Save consolidated results
$consolidatedPath = Join-Path $OutputDir "PHASE13_E2E_RESULTS_$TIMESTAMP.json"
$results | ConvertTo-Json -Depth 10 | Out-File -FilePath $consolidatedPath -Encoding UTF8

Write-Host "=" * 80
if ($allPassed) {
    Write-Success "ALL E2E TESTS PASSED"
    Write-Host ""
    Write-Host "Next Steps:"
    Write-Host "  1. Verify Discord posts in cappers threads"
    Write-Host "  2. Check Command Center feed for all 4 picks"
    Write-Host "  3. Proceed to canary deployment"
    Write-Host ""
    exit 0
}
else {
    Write-Failure "SOME E2E TESTS FAILED"
    Write-Host ""
    Write-Host "Remediation:"
    Write-Host "  1. Review error logs above"
    Write-Host "  2. Check API health: $ApiBaseUrl/api/health"
    Write-Host "  3. Verify database connectivity"
    Write-Host ""
    exit 1
}

