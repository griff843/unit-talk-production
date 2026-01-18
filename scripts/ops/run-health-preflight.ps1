#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Health and Preflight Check Script
.DESCRIPTION
    Executes health and preflight endpoint checks and saves results to JSON
.NOTES
    Date: 2025-10-30
    Author: Unit Talk Engineering
#>

$ErrorActionPreference = "Stop"

# Configuration
$API_BASE = "http://localhost:3010"
$OUTPUT_DIR = "out/ops/cutover/metrics/100"
$TIMESTAMP = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"

# Ensure output directory exists
New-Item -ItemType Directory -Force -Path $OUTPUT_DIR | Out-Null

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "HEALTH & PREFLIGHT CHECKS" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Health Check
Write-Host "→ Checking API health..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "$API_BASE/api/health" -UseBasicParsing -ErrorAction Stop
    $healthData = $healthResponse.Content | ConvertFrom-Json
    Write-Host "✅ Health check passed" -ForegroundColor Green
    Write-Host "   Status: $($healthResponse.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health check failed: $_" -ForegroundColor Red
    exit 1
}

# Preflight Check
Write-Host "→ Checking preflight endpoint..." -ForegroundColor Yellow
try {
    $preflightResponse = Invoke-WebRequest -Uri "$API_BASE/api/domain/picks/preflight" -UseBasicParsing -ErrorAction Stop
    $preflightData = $preflightResponse.Content | ConvertFrom-Json
    
    if ($preflightData.ok -eq $true) {
        Write-Host "✅ Preflight check passed" -ForegroundColor Green
        Write-Host "   Driver: $($preflightData.driver)" -ForegroundColor Gray
        Write-Host "   Publish Mode: $($preflightData.publishMode)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Preflight check failed: ok=$($preflightData.ok)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Preflight check failed: $_" -ForegroundColor Red
    exit 1
}

# Build output object
$output = @{
    timestamp = $TIMESTAMP
    health = @{
        status = $healthResponse.StatusCode
        data = $healthData
    }
    preflight = @{
        status = $preflightResponse.StatusCode
        data = $preflightData
    }
    conclusion = "PASS"
}

# Save to JSON
$outputPath = Join-Path $OUTPUT_DIR "STEP_0_HEALTH_PREFLIGHT.json"
$output | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputPath -Encoding UTF8

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "✅ ALL CHECKS PASSED" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Output saved to: $outputPath" -ForegroundColor Gray
Write-Host ""

exit 0

