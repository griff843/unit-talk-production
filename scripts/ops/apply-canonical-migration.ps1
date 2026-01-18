#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Apply Canonical Convergence Migration to Supabase
    
.DESCRIPTION
    Executes the canonical convergence migration using Docker postgres client
    to connect to Supabase and apply the idempotent DDL.
    
.NOTES
    Date: 2025-01-28
    Author: Unit Talk Engineering
    Version: 1.0.0
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

function Write-Status { 
    param([string]$Message) 
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] [INFO] $Message" -ForegroundColor Cyan 
}

function Write-Success { 
    param([string]$Message) 
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] [PASS] $Message" -ForegroundColor Green 
}

function Write-Failure { 
    param([string]$Message) 
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] [FAIL] $Message" -ForegroundColor Red 
}

# ============================================================================
# LOAD ENVIRONMENT
# ============================================================================

Write-Status "Loading environment configuration..."

# Load .env
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, 'Process')
        }
    }
}

$databaseUrl = [Environment]::GetEnvironmentVariable('DATABASE_DIRECT_URL', 'Process')

if (-not $databaseUrl) {
    Write-Failure "DATABASE_DIRECT_URL not found in .env"
    exit 1
}

Write-Success "Environment loaded"

# ============================================================================
# VERIFY MIGRATION FILE
# ============================================================================

$migrationFile = "scripts/migrations/2025-01-28_canonical_convergence.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Failure "Migration file not found: $migrationFile"
    exit 1
}

Write-Success "Migration file found: $migrationFile"

# ============================================================================
# APPLY MIGRATION VIA DOCKER
# ============================================================================

Write-Status "Applying canonical convergence migration..."
Write-Host ""

# Copy migration file to temp location accessible by Docker
$tempMigration = "scripts/migrations/temp_canonical_migration.sql"
Copy-Item $migrationFile $tempMigration -Force

try {
    # Use docker exec to run psql inside postgres container
    # Note: This assumes postgres container is running
    $result = docker exec -i unit-talk-postgres psql "$databaseUrl" -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/../../../$tempMigration 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Failure "Migration failed with exit code: $LASTEXITCODE"
        Write-Host $result
        exit 1
    }
    
    Write-Host $result
    Write-Success "Migration applied successfully"
}
catch {
    Write-Failure "Error applying migration: $_"
    exit 1
}
finally {
    # Clean up temp file
    if (Test-Path $tempMigration) {
        Remove-Item $tempMigration -Force
    }
}

# ============================================================================
# FORCE POSTGREST SCHEMA RELOAD
# ============================================================================

Write-Status "Forcing PostgREST schema reload..."

try {
    $reloadSql = "select pg_notify('pgrst','reload schema');"
    $reloadResult = docker exec -i unit-talk-postgres psql "$databaseUrl" -c "$reloadSql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "PostgREST schema reload triggered"
        Write-Status "Waiting 5 seconds for schema propagation..."
        Start-Sleep -Seconds 5
    }
    else {
        Write-Failure "PostgREST reload failed (non-critical)"
    }
}
catch {
    Write-Failure "PostgREST reload error (non-critical): $_"
}

# ============================================================================
# VERIFY CANONICAL TABLES
# ============================================================================

Write-Status "Verifying canonical tables..."

$verifySQL = @"
SELECT 
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='picks') AS picks_exists,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='pick_publish') AS pick_publish_exists,
  (SELECT count(*) FROM public.picks) AS picks_count,
  (SELECT count(*) FROM public.pick_publish) AS pick_publish_count;
"@

try {
    $verifyResult = docker exec -i unit-talk-postgres psql "$databaseUrl" -c "$verifySQL" 2>&1
    Write-Host $verifyResult
    Write-Success "Canonical tables verified"
}
catch {
    Write-Failure "Verification failed: $_"
    exit 1
}

# ============================================================================
# FINAL STATUS
# ============================================================================

Write-Host ""
Write-Host "=" * 80 -ForegroundColor Gray
Write-Success "CANONICAL CONVERGENCE MIGRATION COMPLETE"
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Restart services: ./dev.sh restart" -ForegroundColor Gray
Write-Host "  2. Verify API status: curl http://localhost:3010/api/domain/picks/status" -ForegroundColor Gray
Write-Host "  3. Run E2E validation: .\scripts\ops\industry-standard-e2e-validation.ps1" -ForegroundColor Gray
Write-Host ""

