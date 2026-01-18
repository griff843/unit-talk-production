# ============================================================================
# Simple E2E Validation Runner
# ============================================================================
# Runs E2E validation for all 4 leagues and generates artifacts
# Date: 2025-10-30
# ============================================================================

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$artifactsDir = "out\ops\cutover\metrics\100"
$apiBaseUrl = "http://localhost:3010"
$healthUrl = "http://localhost:3010/api/health"
$defaultTenantId = "12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a"

# Create artifacts directory
New-Item -ItemType Directory -Force -Path $artifactsDir | Out-Null

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "E2E VALIDATION - 4 LEAGUES" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Timestamp: $timestamp" -ForegroundColor White
Write-Host "Artifacts: $artifactsDir" -ForegroundColor White
Write-Host ""

# League configurations
$leagues = @{
    NBA = @{ market = "PLAYER_POINTS"; line = 27.5; player = "LeBron James" }
    NFL = @{ market = "PLAYER_RECEIVING_YARDS"; line = 62.5; player = "Travis Kelce" }
    MLB = @{ market = "TOTAL_BASES"; line = 1.5; player = "Aaron Judge" }
    NHL = @{ market = "PLAYER_POINTS"; line = 0.5; player = "Connor McDavid" }
}

# Results storage
$results = @{}
$allPassed = $true

# Step 1: Health check
Write-Host "[1/5] Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri $healthUrl -Method Get -UseBasicParsing
    Write-Host "  API Status: $($health.status)" -ForegroundColor Green
    Write-Host "  Driver: $($health.driver.effective)" -ForegroundColor Green
    Write-Host "  Publisher: $($health.publisher.running)" -ForegroundColor Green
} catch {
    Write-Host "  Health check failed: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Get capper ID from env
Write-Host "[2/5] Loading configuration..." -ForegroundColor Yellow
$envFile = Get-Content .env
$capperId = $null
foreach ($line in $envFile) {
    if ($line -match "^CAPPER_ID=(.+)$") {
        $capperId = $matches[1]
        break
    }
    if ($line -match "^DEFAULT_CAPPER_ID=(.+)$") {
        $capperId = $matches[1]
        break
    }
}

if (-not $capperId) {
    # Use a test UUID
    $capperId = "00000000-0000-0000-0000-000000000001"
    Write-Host "  Using test capper ID: $capperId" -ForegroundColor Yellow
} else {
    Write-Host "  Capper ID: $capperId" -ForegroundColor Green
}

# Step 3: Run validation for each league
Write-Host "[3/5] Running E2E validation..." -ForegroundColor Yellow

foreach ($leagueName in $leagues.Keys | Sort-Object) {
    Write-Host ""
    Write-Host "  League: $leagueName" -ForegroundColor Cyan
    
    $config = $leagues[$leagueName]
    $playerId = [guid]::NewGuid().ToString()
    
    # DRY-RUN (SKIPPED - endpoint not available in API server)
    Write-Host "    DRY-RUN: SKIPPED (not implemented in API server)" -ForegroundColor Yellow
    $results["$leagueName-dryrun"] = "SKIPPED"
    
    # LIVE INSERT
    Write-Host "    LIVE INSERT..." -ForegroundColor Gray

    $livePayload = @{
        tenantId = $defaultTenantId
        userId = $capperId
        league = $leagueName
        marketType = $config.market
        line = $config.line
        side = "over"
        playerId = $playerId
        playerName = $config.player
        gameDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        odds = -110
        stake = 1.0
        userScore = 8
        confidence = 0.85
        betSlipId = "live-$leagueName-$timestamp"
        idempotencyKey = "e2e-live-$leagueName-$timestamp"
    }
    
    try {
        $liveStart = Get-Date
        $liveResponse = Invoke-RestMethod `
            -Uri "$apiBaseUrl/api/domain/picks/insert" `
            -Method Post `
            -Headers @{ "Idempotency-Key" = "e2e-live-$leagueName-$timestamp"; "Content-Type" = "application/json" } `
            -Body ($livePayload | ConvertTo-Json -Depth 10) `
            -UseBasicParsing
        $liveDuration = ((Get-Date) - $liveStart).TotalMilliseconds
        
        if ($liveResponse.pickId) {
            Write-Host "      PASS (pickId: $($liveResponse.pickId), $([int]$liveDuration)ms)" -ForegroundColor Green
            $results["$leagueName-live"] = "PASS"
            $results["$leagueName-pickId"] = $liveResponse.pickId
        } else {
            Write-Host "      FAIL (no pickId)" -ForegroundColor Red
            $results["$leagueName-live"] = "FAIL"
            $allPassed = $false
        }
    } catch {
        Write-Host "      FAIL ($_)" -ForegroundColor Red
        $results["$leagueName-live"] = "FAIL"
        $allPassed = $false
    }
}

# Step 4: Generate artifacts
Write-Host ""
Write-Host "[4/5] Generating artifacts..." -ForegroundColor Yellow

$e2eResults = @{
    timestamp = (Get-Date).ToUniversalTime().ToString("o")
    leagues = @{}
    summary = @{
        total_leagues = 4
        passed = 0
        failed = 0
        overall_result = if ($allPassed) { "PASS" } else { "FAIL" }
    }
}

foreach ($leagueName in $leagues.Keys) {
    # League passes if live insert succeeds (dry-run is optional)
    $leaguePassed = ($results["$leagueName-live"] -eq "PASS")

    $e2eResults.leagues[$leagueName] = @{
        dryrun = $results["$leagueName-dryrun"]
        live = $results["$leagueName-live"]
        pickId = $results["$leagueName-pickId"]
        result = if ($leaguePassed) { "PASS" } else { "FAIL" }
    }

    if ($leaguePassed) {
        $e2eResults.summary.passed++
    } else {
        $e2eResults.summary.failed++
    }
}

# Save JSON
$jsonPath = Join-Path $artifactsDir "E2E_RESULTS_$timestamp.json"
$e2eResults | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonPath -Encoding UTF8
Write-Host "  JSON: $jsonPath" -ForegroundColor Green

# Save Markdown
$mdContent = @"
# E2E Validation Results

**Date**: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')  
**Timestamp**: $timestamp  
**Overall Result**: $($e2eResults.summary.overall_result)

## Summary

- **Total Leagues**: $($e2eResults.summary.total_leagues)
- **Passed**: $($e2eResults.summary.passed)
- **Failed**: $($e2eResults.summary.failed)

## League Results

$(foreach ($leagueName in $leagues.Keys | Sort-Object) {
    $lr = $e2eResults.leagues[$leagueName]
    "### $leagueName`n`n- **DRY-RUN**: $($lr.dryrun)`n- **LIVE**: $($lr.live)`n- **Pick ID**: $($lr.pickId)`n- **Result**: $($lr.result)`n"
})

## Artifacts

- **JSON**: ``$jsonPath``
- **Markdown**: This file

---

**Generated**: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')
"@

$mdPath = Join-Path $artifactsDir "E2E_RESULTS_$timestamp.md"
$mdContent | Out-File -FilePath $mdPath -Encoding UTF8
Write-Host "  Markdown: $mdPath" -ForegroundColor Green

# Step 5: Summary
Write-Host ""
Write-Host "[5/5] Summary" -ForegroundColor Yellow
Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "E2E VALIDATION COMPLETE" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

foreach ($leagueName in $leagues.Keys | Sort-Object) {
    $lr = $e2eResults.leagues[$leagueName]
    $icon = if ($lr.result -eq "PASS") { "[PASS]" } else { "[FAIL]" }
    Write-Host "  $icon $leagueName : $($lr.result)" -ForegroundColor $(if ($lr.result -eq "PASS") { "Green" } else { "Red" })
}

Write-Host ""
Write-Host "Overall: $($e2eResults.summary.overall_result)" -ForegroundColor $(if ($allPassed) { "Green" } else { "Red" })
Write-Host ""

if ($allPassed) {
    Write-Host "GO - All validations passed" -ForegroundColor Green
    exit 0
} else {
    Write-Host "NO-GO - Some validations failed" -ForegroundColor Red
    exit 1
}

