#!/usr/bin/env pwsh
# Clean E2E Validation Script
# Date: 2025-10-30

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Configuration
$API_URL = "http://localhost:3010"
$TENANT_ID = "12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a"
$CAPPER_ID = "d290f1ee-6c54-4b01-90e6-d701748f0851"
$TIMESTAMP = Get-Date -Format 'yyyyMMdd_HHmmss'
$ARTIFACTS_DIR = "out/ops/cutover/metrics/100"

# Ensure artifacts directory exists
New-Item -ItemType Directory -Force -Path $ARTIFACTS_DIR | Out-Null

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "E2E VALIDATION - ALL LEAGUES" -ForegroundColor Cyan
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

foreach ($league in $leagues.Keys | Sort-Object) {
    Write-Host "Testing $league..." -ForegroundColor Yellow
    
    $config = $leagues[$league]
    
    # DRY-RUN Test
    Write-Host "  DRY-RUN..." -NoNewline
    $dryBetSlipId = "e2e-dry-$league-$TIMESTAMP"
    
    $dryPayload = @{
        tenantId = $TENANT_ID
        capperId = $CAPPER_ID
        betSlipId = $dryBetSlipId
        league = $league
        playerName = $config.player
        marketType = $config.market
        line = $config.line
        side = "OVER"
        odds = -110
        stake = 1.0
        confidence = 8
        dryRun = $true
    }
    
    try {
        $dryResponse = Invoke-WebRequest `
            -Uri "$API_URL/api/domain/picks/submit" `
            -Method POST `
            -Body ($dryPayload | ConvertTo-Json -Depth 10) `
            -ContentType "application/json" `
            -UseBasicParsing `
            -TimeoutSec 30
        
        if ($dryResponse.StatusCode -eq 200) {
            Write-Host " PASS" -ForegroundColor Green
            $dryStatus = "PASS"
        } else {
            Write-Host " FAIL (Status: $($dryResponse.StatusCode))" -ForegroundColor Red
            $dryStatus = "FAIL"
            $allPass = $false
        }
    } catch {
        Write-Host " FAIL (Error: $_)" -ForegroundColor Red
        $dryStatus = "FAIL"
        $allPass = $false
    }
    
    # LIVE Test
    Write-Host "  LIVE..." -NoNewline
    $liveBetSlipId = "e2e-live-$league-$TIMESTAMP"
    
    $livePayload = @{
        tenantId = $TENANT_ID
        capperId = $CAPPER_ID
        betSlipId = $liveBetSlipId
        league = $league
        playerName = $config.player
        marketType = $config.market
        line = $config.line
        side = "OVER"
        odds = -110
        stake = 1.0
        confidence = 8
        dryRun = $false
    }
    
    try {
        $liveStart = Get-Date
        $liveResponse = Invoke-WebRequest `
            -Uri "$API_URL/api/domain/picks/submit" `
            -Method POST `
            -Body ($livePayload | ConvertTo-Json -Depth 10) `
            -ContentType "application/json" `
            -UseBasicParsing `
            -TimeoutSec 30
        $liveDuration = ((Get-Date) - $liveStart).TotalMilliseconds
        
        if ($liveResponse.StatusCode -eq 200) {
            Write-Host " PASS ($([int]$liveDuration)ms)" -ForegroundColor Green
            $liveStatus = "PASS"
        } else {
            Write-Host " FAIL (Status: $($liveResponse.StatusCode))" -ForegroundColor Red
            $liveStatus = "FAIL"
            $allPass = $false
        }
    } catch {
        Write-Host " FAIL (Error: $_)" -ForegroundColor Red
        $liveStatus = "FAIL"
        $liveDuration = 0
        $allPass = $false
    }
    
    $results[$league] = @{
        dryRun = $dryStatus
        live = $liveStatus
        durationMs = [int]$liveDuration
        conclusion = if ($dryStatus -eq "PASS" -and $liveStatus -eq "PASS") { "PASS" } else { "FAIL" }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "+---------+----------+------+--------------+----------+" -ForegroundColor Gray
Write-Host "| League  | DRY-RUN  | LIVE | Duration(ms) | Result   |" -ForegroundColor Gray
Write-Host "+---------+----------+------+--------------+----------+" -ForegroundColor Gray

foreach ($league in $results.Keys | Sort-Object) {
    $r = $results[$league]
    $dryIcon = if ($r.dryRun -eq "PASS") { "PASS" } else { "FAIL" }
    $liveIcon = if ($r.live -eq "PASS") { "PASS" } else { "FAIL" }
    $duration = $r.durationMs
    $overallIcon = if ($r.conclusion -eq "PASS") { "PASS" } else { "FAIL" }
    
    Write-Host ("| {0,-7} | {1,-8} | {2,-4} | {3,12} | {4,-8} |" -f $league, $dryIcon, $liveIcon, $duration, $overallIcon) -ForegroundColor Gray
}

Write-Host "+---------+----------+------+--------------+----------+" -ForegroundColor Gray
Write-Host ""

# Save results
$finalReport = @{
    timestamp = $TIMESTAMP
    conclusion = if ($allPass) { "GO" } else { "NO-GO" }
    leagues = $results
}

$reportPath = "$ARTIFACTS_DIR/FINAL_GO_NO_GO_$TIMESTAMP.json"
$finalReport | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportPath -Encoding UTF8

Write-Host "Report saved to: $reportPath" -ForegroundColor Cyan

# Create markdown summary
$mdPath = "$ARTIFACTS_DIR/FINAL_GO_NO_GO_$TIMESTAMP.md"
$mdContent = @"
# E2E Validation Report

**Date:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  
**Conclusion:** $($finalReport.conclusion)

## Results by League

| League | DRY-RUN | LIVE | Duration (ms) | Result |
|--------|---------|------|---------------|--------|
"@

foreach ($league in $results.Keys | Sort-Object) {
    $r = $results[$league]
    $mdContent += "| $league | $($r.dryRun) | $($r.live) | $($r.durationMs) | $($r.conclusion) |`n"
}

$mdContent | Out-File -FilePath $mdPath -Encoding UTF8

Write-Host "Markdown report saved to: $mdPath" -ForegroundColor Cyan
Write-Host ""

# Final verdict
if ($allPass) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "VERDICT: GO" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    exit 0
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "VERDICT: NO-GO" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}

