# ============================================================================
# Unit Talk - Nightly Validation Runner
# ============================================================================
# Runs nightly E2E validation at 03:00 UTC
# Keeps last 7 runs in out/ops/cutover/metrics/nightly/
# Date: 2025-10-30
# ============================================================================

param(
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$workspaceRoot = "C:\Users\griff\OneDrive\Desktop\unit-talk-production-main"
$nightlyDir = Join-Path $workspaceRoot "out\ops\cutover\metrics\nightly"
$logFile = Join-Path $nightlyDir "nightly_validation_$timestamp.log"

# Create nightly directory
New-Item -ItemType Directory -Force -Path $nightlyDir | Out-Null

# Start logging
Start-Transcript -Path $logFile -Append

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "NIGHTLY VALIDATION RUNNER" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')" -ForegroundColor White
Write-Host "Workspace: $workspaceRoot" -ForegroundColor White
Write-Host "Dry Run: $DryRun" -ForegroundColor White
Write-Host ""

# Change to workspace directory
Set-Location $workspaceRoot

# Step 1: Verify Docker stack is running
Write-Host "[1/5] Verifying Docker stack..." -ForegroundColor Yellow
try {
    $containers = docker-compose ps --services --filter "status=running"
    if ($containers -contains "api") {
        Write-Host "  ✅ Docker stack is running" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  API container not running - starting stack..." -ForegroundColor Yellow
        & "$workspaceRoot\dev.sh" start
        Start-Sleep -Seconds 30
    }
} catch {
    Write-Host "  ❌ Failed to verify Docker stack: $_" -ForegroundColor Red
    Stop-Transcript
    exit 1
}

# Step 2: Run PostgREST visibility check
Write-Host "[2/5] Running PostgREST visibility check..." -ForegroundColor Yellow
try {
    $verifyResult = node "$workspaceRoot\scripts\ops\verify-pgrst-visible.ts"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ PostgREST visibility check passed" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  PostgREST visibility check failed - reloading schema..." -ForegroundColor Yellow
        node "$workspaceRoot\scripts\ops\force-postgrest-reload.ts"
        Start-Sleep -Seconds 10
    }
} catch {
    Write-Host "  ⚠️  Visibility check error (non-critical): $_" -ForegroundColor Yellow
}

# Step 3: Run industry-standard E2E validation
Write-Host "[3/5] Running industry-standard E2E validation..." -ForegroundColor Yellow
try {
    $validationScript = Join-Path $workspaceRoot "scripts\ops\industry-standard-e2e-validation.ps1"
    
    if (Test-Path $validationScript) {
        & $validationScript
        $validationExitCode = $LASTEXITCODE
        
        if ($validationExitCode -eq 0) {
            Write-Host "  ✅ E2E validation PASSED" -ForegroundColor Green
        } else {
            Write-Host "  ❌ E2E validation FAILED (exit code: $validationExitCode)" -ForegroundColor Red
        }
    } else {
        Write-Host "  ⚠️  Validation script not found: $validationScript" -ForegroundColor Yellow
        Write-Host "  Using bash version instead..." -ForegroundColor Yellow
        
        bash "$workspaceRoot\scripts\ops\industry-standard-e2e-validation.sh"
        $validationExitCode = $LASTEXITCODE
    }
} catch {
    Write-Host "  ❌ E2E validation error: $_" -ForegroundColor Red
    $validationExitCode = 1
}

# Step 4: Collect metrics
Write-Host "[4/5] Collecting metrics..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "http://localhost:3010/api/health" -UseBasicParsing
    $health = $healthResponse.Content | ConvertFrom-Json
    
    $metrics = @{
        timestamp = (Get-Date).ToUniversalTime().ToString("o")
        validation_result = if ($validationExitCode -eq 0) { "PASS" } else { "FAIL" }
        validation_exit_code = $validationExitCode
        api_health = $health.status
        driver = $health.driver.effective
        publisher_running = $health.publisher.running
        uptime_seconds = $health.uptime
        memory_percentage = $health.memory.percentage
    }
    
    $metricsFile = Join-Path $nightlyDir "metrics_$timestamp.json"
    $metrics | ConvertTo-Json -Depth 10 | Out-File -FilePath $metricsFile -Encoding UTF8
    
    Write-Host "  ✅ Metrics saved: $metricsFile" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  Failed to collect metrics: $_" -ForegroundColor Yellow
}

# Step 5: Cleanup old runs (keep last 7)
Write-Host "[5/5] Cleaning up old runs..." -ForegroundColor Yellow
try {
    $allLogs = Get-ChildItem -Path $nightlyDir -Filter "nightly_validation_*.log" | Sort-Object LastWriteTime -Descending
    $allMetrics = Get-ChildItem -Path $nightlyDir -Filter "metrics_*.json" | Sort-Object LastWriteTime -Descending
    
    if ($allLogs.Count -gt 7) {
        $logsToDelete = $allLogs | Select-Object -Skip 7
        $logsToDelete | Remove-Item -Force
        Write-Host "  ✅ Deleted $($logsToDelete.Count) old log files" -ForegroundColor Green
    }
    
    if ($allMetrics.Count -gt 7) {
        $metricsToDelete = $allMetrics | Select-Object -Skip 7
        $metricsToDelete | Remove-Item -Force
        Write-Host "  ✅ Deleted $($metricsToDelete.Count) old metric files" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠️  Cleanup warning: $_" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "NIGHTLY VALIDATION COMPLETE" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Result: $(if ($validationExitCode -eq 0) { '✅ PASS' } else { '❌ FAIL' })" -ForegroundColor $(if ($validationExitCode -eq 0) { 'Green' } else { 'Red' })
Write-Host "Log: $logFile" -ForegroundColor White
Write-Host ""

Stop-Transcript

exit $validationExitCode

