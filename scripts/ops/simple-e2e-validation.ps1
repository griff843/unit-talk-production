#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Simple E2E Validation for Canonical Convergence
.DESCRIPTION
    Runs basic E2E tests across NBA, NFL, MLB, NHL
#>

$ErrorActionPreference = 'Stop'

# Configuration
$API_URL = "http://localhost:3010"
$TENANT_ID = "12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a"
$CAPPER_ID = "d290f1ee-6c54-4b01-90e6-d701748f0851"  # Griff843
$TIMESTAMP = Get-Date -Format 'yyyyMMdd_HHmmss'
$ARTIFACTS_DIR = "out/ops/cutover/metrics/100"

# Ensure artifacts directory exists
New-Item -ItemType Directory -Force -Path $ARTIFACTS_DIR | Out-Null

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CANONICAL CONVERGENCE E2E VALIDATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test configuration per league
$leagues = @{
    NBA = @{ market = "PLAYER_POINTS"; line = 27.5; player = "LeBron James" }
    NFL = @{ market = "PLAYER_RECEIVING_YARDS"; line = 62.5; player = "Justin Jefferson" }
    MLB = @{ market = "TOTAL_BASES"; line = 1.5; player = "Aaron Judge" }
    NHL = @{ market = "PLAYER_POINTS"; line = 0.5; player = "Connor McDavid" }
}

$results = @{}
$allPass = $true

foreach ($league in $leagues.Keys) {
    Write-Host "Testing $league..." -ForegroundColor Yellow
    
    $config = $leagues[$league]
    $betSlipId = "e2e-live-$league-$TIMESTAMP"
    
    # Build payload
    $payload = @{
        tenantId = $TENANT_ID
        capperId = $CAPPER_ID
        betSlipId = $betSlipId
        league = $league
        playerName = $config.player
        marketType = $config.market
        line = $config.line
        side = "over"
        odds = -110
        gameDate = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
        prediction = "win"
        confidence = 0.75
        reasoning = "E2E validation test for $league"
        idempotencyKey = "e2e-$league-$TIMESTAMP"
    } | ConvertTo-Json -Depth 10
    
    try {
        # DRY RUN
        Write-Host "  DRY-RUN..." -NoNewline
        $dryResponse = Invoke-WebRequest -Uri "$API_URL/api/domain/picks/insert?dryRun=true" `
            -Method POST `
            -ContentType "application/json" `
            -Body $payload `
            -UseBasicParsing
        
        if ($dryResponse.StatusCode -eq 204) {
            Write-Host " PASS" -ForegroundColor Green
            $dryRunPass = $true
        } else {
            Write-Host " FAIL (HTTP $($dryResponse.StatusCode))" -ForegroundColor Red
            $dryRunPass = $false
            $allPass = $false
        }
        
        # LIVE INSERT
        Write-Host "  LIVE INSERT..." -NoNewline
        $liveResponse = Invoke-WebRequest -Uri "$API_URL/api/domain/picks/insert" `
            -Method POST `
            -ContentType "application/json" `
            -Body $payload `
            -UseBasicParsing
        
        if ($liveResponse.StatusCode -eq 200 -or $liveResponse.StatusCode -eq 201) {
            $liveData = $liveResponse.Content | ConvertFrom-Json
            $pickId = $liveData.data.pickId
            Write-Host " PASS (pickId: $pickId)" -ForegroundColor Green
            $livePass = $true
        } else {
            Write-Host " FAIL (HTTP $($liveResponse.StatusCode))" -ForegroundColor Red
            $livePass = $false
            $allPass = $false
            $pickId = $null
        }
        
        # Store results
        $results[$league] = @{
            dryRun = $dryRunPass
            live = $livePass
            pickId = $pickId
            conclusion = if ($dryRunPass -and $livePass) { "PASS" } else { "FAIL" }
        }
        
    } catch {
        Write-Host " ERROR: $($_.Exception.Message)" -ForegroundColor Red
        $results[$league] = @{
            dryRun = $false
            live = $false
            pickId = $null
            conclusion = "FAIL"
            error = $_.Exception.Message
        }
        $allPass = $false
    }
    
    Write-Host ""
}

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$passCount = 0
$failCount = 0

foreach ($league in $results.Keys | Sort-Object) {
    $r = $results[$league]
    $icon = if ($r.conclusion -eq "PASS") { "✅" } else { "❌" }
    $passCount += if ($r.conclusion -eq "PASS") { 1 } else { 0 }
    $failCount += if ($r.conclusion -eq "FAIL") { 1 } else { 0 }
    
    Write-Host "$icon $league : $($r.conclusion)" -ForegroundColor $(if ($r.conclusion -eq "PASS") { "Green" } else { "Red" })
}

Write-Host ""
Write-Host "Total: $passCount PASS, $failCount FAIL" -ForegroundColor $(if ($allPass) { "Green" } else { "Yellow" })
Write-Host ""

# Save results
$resultsJson = $results | ConvertTo-Json -Depth 10
$resultsPath = "$ARTIFACTS_DIR/simple_e2e_results_$TIMESTAMP.json"
$resultsJson | Out-File -FilePath $resultsPath -Encoding UTF8
Write-Host "Results saved to: $resultsPath" -ForegroundColor Gray
Write-Host ""

# Final decision
if ($allPass) {
    Write-Host "FINAL DECISION: 🟢 GO" -ForegroundColor Green
    Write-Host "All leagues passed validation." -ForegroundColor Green
    exit 0
} else {
    Write-Host "FINAL DECISION: 🔴 NO-GO" -ForegroundColor Red
    Write-Host "One or more leagues failed. Review results above." -ForegroundColor Red
    exit 1
}

