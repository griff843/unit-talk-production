# ===============================================================================
# PHASE 13 DEPLOYMENT ORCHESTRATOR - Charter v4.0
# ===============================================================================
# Date: 2025-11-01
# Purpose: Complete Phase 13 deployment with E2E validation, canary rollout, SLO monitoring
# Exit Criteria: All validations ✅, SLOs met, GO/NO-GO decision documented
# ===============================================================================

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Colors
$RED = "Red"
$GREEN = "Green"
$YELLOW = "Yellow"
$BLUE = "Cyan"

# Paths
$REPO_ROOT = "c:\Users\griff\OneDrive\Desktop\unit-talk-production-main"
$OUTPUT_DIR = "$REPO_ROOT\out\ops\cutover\metrics\phase13"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$LOG_FILE = "$OUTPUT_DIR\deployment_$TIMESTAMP.log"

# Counters
$script:PASSED = 0
$script:FAILED = 0
$script:WARNINGS = 0

# ===============================================================================
# LOGGING FUNCTIONS
# ===============================================================================

function Write-Log {
    param([string]$Message, [string]$Color = "White")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage -ForegroundColor $Color
    Add-Content -Path $LOG_FILE -Value $logMessage
}

function Write-Section {
    param([string]$Title)
    Write-Log "`n$('=' * 80)" -Color $BLUE
    Write-Log $Title -Color $BLUE
    Write-Log "$('=' * 80)" -Color $BLUE
}

function Write-Success {
    param([string]$Message)
    Write-Log "✅ $Message" -Color $GREEN
    $script:PASSED++
}

function Write-Failure {
    param([string]$Message)
    Write-Log "❌ $Message" -Color $RED
    $script:FAILED++
}

function Write-Warning {
    param([string]$Message)
    Write-Log "⚠️  $Message" -Color $YELLOW
    $script:WARNINGS++
}

# ===============================================================================
# ENVIRONMENT VERIFICATION
# ===============================================================================

function Test-Environment {
    Write-Section "A) ENVIRONMENT & SCHEMA VERIFICATION"
    
    # Check .env file
    Write-Log "Checking .env configuration..."
    if (Test-Path "$REPO_ROOT\.env") {
        Write-Success ".env file exists"
        
        # Mask and display critical env vars
        $envContent = Get-Content "$REPO_ROOT\.env" | Select-String -Pattern "^(SUPABASE_URL|DATABASE_DIRECT_URL|PICK_DRIVER|PUBLISH_MODE|SHADOW_MODE)="
        foreach ($line in $envContent) {
            $masked = $line -replace '(=.{10}).*', '$1***'
            Write-Log "  $masked"
        }
    } else {
        Write-Failure ".env file not found"
        return $false
    }
    
    # Verify Docker is running
    Write-Log "Checking Docker status..."
    try {
        $dockerStatus = docker ps 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker is running"
        } else {
            Write-Failure "Docker is not running"
            return $false
        }
    } catch {
        Write-Failure "Docker command failed: $_"
        return $false
    }
    
    return $true
}

# ===============================================================================
# DATABASE MIGRATION
# ===============================================================================

function Invoke-DatabaseMigration {
    Write-Section "B) DATABASE MIGRATION - Phase 13 Serving Schema"
    
    $migrationFile = "$REPO_ROOT\supabase\migrations\20251101_phase13_serving.sql"
    
    Write-Log "Checking migration file exists..."
    if (-not (Test-Path $migrationFile)) {
        Write-Failure "Migration file not found: $migrationFile"
        return $false
    }
    Write-Success "Migration file found"
    
    Write-Log "Applying migration (idempotent)..."
    try {
        # Use docker-compose exec with DATABASE_DIRECT_URL
        $result = docker-compose exec -T api bash -c "psql `$DATABASE_DIRECT_URL -f /app/../../supabase/migrations/20251101_phase13_serving.sql" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Migration applied successfully"
            Write-Log "Migration output (last 10 lines):"
            $result | Select-Object -Last 10 | ForEach-Object { Write-Log "  $_" }
        } else {
            Write-Failure "Migration failed with exit code $LASTEXITCODE"
            Write-Log "Error output: $result"
            return $false
        }
    } catch {
        Write-Failure "Migration execution error: $_"
        return $false
    }
    
    # Verify tables created
    Write-Log "Verifying tables created..."
    $tables = @("model_predictions_live", "model_performance_history")
    foreach ($table in $tables) {
        try {
            $check = docker-compose exec -T api bash -c "psql `$DATABASE_DIRECT_URL -c `"SELECT to_regclass('public.$table');`"" 2>&1
            if ($check -match $table) {
                Write-Success "Table '$table' exists"
            } else {
                Write-Failure "Table '$table' not found"
                return $false
            }
        } catch {
            Write-Failure "Table verification failed for '$table': $_"
            return $false
        }
    }
    
    # Verify function created
    Write-Log "Verifying check_model_slo_compliance function..."
    try {
        $funcCheck = docker-compose exec -T api bash -c "psql `$DATABASE_DIRECT_URL -c `"SELECT to_regproc('check_model_slo_compliance');`"" 2>&1
        if ($funcCheck -match "check_model_slo_compliance") {
            Write-Success "Function 'check_model_slo_compliance' exists"
        } else {
            Write-Failure "Function 'check_model_slo_compliance' not found"
            return $false
        }
    } catch {
        Write-Failure "Function verification failed: $_"
        return $false
    }
    
    return $true
}

# ===============================================================================
# POSTGREST RELOAD
# ===============================================================================

function Invoke-PostgRESTReload {
    Write-Section "C) POSTGREST SCHEMA RELOAD"
    
    Write-Log "Triggering PostgREST reload via pg_notify..."
    try {
        $reload = docker-compose exec -T api bash -c "psql `$DATABASE_DIRECT_URL -c `"SELECT pg_notify('pgrst', 'reload schema');`"" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "PostgREST reload notification sent"
        } else {
            Write-Warning "PostgREST reload may have failed (exit code $LASTEXITCODE)"
        }
    } catch {
        Write-Warning "PostgREST reload error: $_"
    }
    
    Write-Log "Waiting 15 seconds for PostgREST to process reload..."
    Start-Sleep -Seconds 15
    
    # Verify visibility using verify-pgrst-visible.ts if available
    Write-Log "Verifying PostgREST visibility..."
    if (Test-Path "$REPO_ROOT\scripts\ops\verify-pgrst-visible.ts") {
        try {
            $verify = docker-compose exec -T api npx tsx scripts/ops/verify-pgrst-visible.ts 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Success "PostgREST visibility verified"
            } else {
                Write-Warning "PostgREST visibility check returned warnings"
                Write-Log "Output: $verify"
            }
        } catch {
            Write-Warning "PostgREST visibility check failed: $_"
        }
    } else {
        Write-Warning "verify-pgrst-visible.ts not found, skipping visibility check"
    }
    
    return $true
}

# ===============================================================================
# SERVICE HEALTH CHECKS
# ===============================================================================

function Test-ServiceHealth {
    Write-Section "D) SERVICE HEALTH & METRICS"
    
    Write-Log "Starting services with ./dev.sh start..."
    # Note: On Windows, we may need to use docker-compose directly
    try {
        docker-compose up -d 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Services started"
        } else {
            Write-Failure "Failed to start services"
            return $false
        }
    } catch {
        Write-Failure "Service startup error: $_"
        return $false
    }
    
    Write-Log "Waiting 10 seconds for services to initialize..."
    Start-Sleep -Seconds 10
    
    # Check API health
    Write-Log "Checking API health endpoint..."
    try {
        $health = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 5
        if ($health.StatusCode -eq 200) {
            Write-Success "API health check passed (200 OK)"
        } else {
            Write-Failure "API health check failed (status: $($health.StatusCode))"
            return $false
        }
    } catch {
        Write-Failure "API health check error: $_"
        return $false
    }
    
    # Check metrics endpoint (if ModelServingMetrics is running)
    Write-Log "Checking metrics endpoint (port 9464)..."
    try {
        $metrics = Invoke-WebRequest -Uri "http://localhost:9464/metrics" -UseBasicParsing -TimeoutSec 5
        if ($metrics.StatusCode -eq 200) {
            Write-Success "Metrics endpoint responding (200 OK)"
            
            # Check for model_serving metrics
            if ($metrics.Content -match "model_serving_") {
                Write-Success "Model serving metrics registered"
            } else {
                Write-Warning "Model serving metrics not found in output"
            }
        } else {
            Write-Warning "Metrics endpoint returned status: $($metrics.StatusCode)"
        }
    } catch {
        Write-Warning "Metrics endpoint not accessible (may not be started yet): $_"
    }
    
    return $true
}

# ===============================================================================
# MAIN EXECUTION
# ===============================================================================

function Main {
    Write-Log "╔═══════════════════════════════════════════════════════════════════════════╗"
    Write-Log "║         PHASE 13 DEPLOYMENT ORCHESTRATOR - Charter v4.0                  ║"
    Write-Log "║         Model Serving & Ensemble Infrastructure                          ║"
    Write-Log "╚═══════════════════════════════════════════════════════════════════════════╝"
    Write-Log ""
    Write-Log "Timestamp: $TIMESTAMP"
    Write-Log "Log File:  $LOG_FILE"
    Write-Log ""
    
    # Execute deployment phases
    $envOk = Test-Environment
    if (-not $envOk) {
        Write-Log "`n❌ BLOCKER: Environment verification failed" -Color $RED
        Write-Log "Remediation: Fix environment issues and re-run" -Color $YELLOW
        exit 1
    }
    
    $migrationOk = Invoke-DatabaseMigration
    if (-not $migrationOk) {
        Write-Log "`n❌ BLOCKER: Database migration failed" -Color $RED
        Write-Log "Remediation: Check migration SQL and database connectivity" -Color $YELLOW
        exit 1
    }
    
    $pgrst = Invoke-PostgRESTReload
    
    $healthOk = Test-ServiceHealth
    if (-not $healthOk) {
        Write-Log "`n⚠️  WARNING: Service health checks incomplete" -Color $YELLOW
    }
    
    # Summary
    Write-Section "DEPLOYMENT SUMMARY"
    Write-Log ""
    Write-Log "✅ Passed:   $script:PASSED" -Color $GREEN
    Write-Log "⚠️  Warnings: $script:WARNINGS" -Color $YELLOW
    Write-Log "❌ Failed:   $script:FAILED" -Color $RED
    Write-Log ""
    
    if ($script:FAILED -eq 0) {
        Write-Log "SUCCESS: PHASE 13 DEPLOYMENT COMPLETE" -Color $GREEN
        Write-Log ""
        Write-Log "Next Steps:" -Color $BLUE
        Write-Log "  1. Run E2E validation: .\scripts\ops\phase13-e2e-validation.ps1"
        Write-Log "  2. Deploy canary: .\scripts\ops\phase13-canary-deployment.ps1"
        Write-Log "  3. Review attestation: $OUTPUT_DIR\MODEL_SERVING_ATTESTATION_*.md"
        Write-Log ""
        exit 0
    } else {
        Write-Log "FAILED: PHASE 13 DEPLOYMENT INCOMPLETE" -Color $RED
        Write-Log ""
        Write-Log "Review log file: $LOG_FILE" -Color $YELLOW
        exit 1
    }
}

# Run main
Main

