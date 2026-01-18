# Phase 13 Deployment - Simplified
# Date: 2025-11-01
# Charter v4.0

$ErrorActionPreference = "Stop"

$REPO_ROOT = "c:\Users\griff\OneDrive\Desktop\unit-talk-production-main"
$OUTPUT_DIR = "$REPO_ROOT\out\ops\cutover\metrics\phase13"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$LOG_FILE = "$OUTPUT_DIR\deployment_$TIMESTAMP.log"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
    Add-Content -Path $LOG_FILE -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
}

function Write-OK {
    param([string]$Message)
    Write-Host "  OK: $Message" -ForegroundColor Green
    Add-Content -Path $LOG_FILE -Value "  OK: $Message"
}

function Write-Fail {
    param([string]$Message)
    Write-Host "  FAIL: $Message" -ForegroundColor Red
    Add-Content -Path $LOG_FILE -Value "  FAIL: $Message"
}

Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "PHASE 13 DEPLOYMENT - Charter v4.0" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Yellow

# Step 1: Environment Check
Write-Step "1. Environment Verification"
if (Test-Path "$REPO_ROOT\.env") {
    Write-OK ".env file exists"
} else {
    Write-Fail ".env file not found"
    exit 1
}

# Step 2: Apply Migration
Write-Step "2. Applying Database Migration"
$migrationFile = "$REPO_ROOT\supabase\migrations\20251101_phase13_serving.sql"
if (Test-Path $migrationFile) {
    Write-OK "Migration file found"
    
    Write-Host "  Executing migration..." -ForegroundColor Yellow
    $result = docker-compose exec -T api bash -c "psql `$DATABASE_DIRECT_URL -f /app/../../supabase/migrations/20251101_phase13_serving.sql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-OK "Migration applied successfully"
    } else {
        Write-Fail "Migration failed"
        Write-Host $result
        exit 1
    }
} else {
    Write-Fail "Migration file not found"
    exit 1
}

# Step 3: Verify Tables
Write-Step "3. Verifying Database Schema"
$tables = @("model_predictions_live", "model_performance_history")
foreach ($table in $tables) {
    $check = docker-compose exec -T api bash -c "psql `$DATABASE_DIRECT_URL -c `"SELECT to_regclass('public.$table');`"" 2>&1
    if ($check -match $table) {
        Write-OK "Table '$table' exists"
    } else {
        Write-Fail "Table '$table' not found"
        exit 1
    }
}

# Step 4: PostgREST Reload
Write-Step "4. PostgREST Schema Reload"
$reload = docker-compose exec -T api bash -c "psql `$DATABASE_DIRECT_URL -c `"SELECT pg_notify('pgrst', 'reload schema');`"" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-OK "PostgREST reload triggered"
    Write-Host "  Waiting 15 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 15
} else {
    Write-Fail "PostgREST reload failed"
}

# Step 5: Start Services
Write-Step "5. Starting Services"
docker-compose up -d 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-OK "Services started"
    Write-Host "  Waiting 10 seconds for initialization..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
} else {
    Write-Fail "Failed to start services"
    exit 1
}

# Step 6: Health Checks
Write-Step "6. Service Health Checks"
try {
    $health = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 5
    if ($health.StatusCode -eq 200) {
        Write-OK "API health check passed"
    } else {
        Write-Fail "API health check failed"
    }
} catch {
    Write-Fail "API not responding: $_"
}

# Summary
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "DEPLOYMENT COMPLETE" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Yellow
Write-Host "Log file: $LOG_FILE`n" -ForegroundColor Cyan

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Run E2E validation" -ForegroundColor White
Write-Host "  2. Deploy canary rollout" -ForegroundColor White
Write-Host "  3. Review attestation documents`n" -ForegroundColor White

