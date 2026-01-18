#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Apply Canonical Convergence Migration to Supabase via SQL Editor
    
.DESCRIPTION
    Reads the canonical convergence migration SQL and provides instructions
    for applying it via Supabase SQL Editor or generates a curl command.
    
.NOTES
    Date: 2025-01-28
    Author: Unit Talk Engineering
    Version: 1.0.0
#>

[CmdletBinding()]
param(
    [switch]$GenerateCurl,
    [switch]$ShowSQL
)

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

$supabaseUrl = [Environment]::GetEnvironmentVariable('SUPABASE_URL', 'Process')
$supabaseServiceKey = [Environment]::GetEnvironmentVariable('SUPABASE_SERVICE_ROLE_KEY', 'Process')

if (-not $supabaseUrl -or -not $supabaseServiceKey) {
    Write-Failure "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env"
    exit 1
}

# Extract project ref from URL
if ($supabaseUrl -match 'https://([^.]+)\.supabase\.co') {
    $projectRef = $matches[1]
}
else {
    Write-Failure "Could not extract project ref from SUPABASE_URL"
    exit 1
}

Write-Success "Environment loaded (Project: $projectRef)"

# ============================================================================
# READ MIGRATION FILE
# ============================================================================

$migrationFile = "scripts/migrations/2025-01-28_canonical_convergence.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Failure "Migration file not found: $migrationFile"
    exit 1
}

$migrationSQL = Get-Content $migrationFile -Raw
Write-Success "Migration file loaded ($($migrationSQL.Length) bytes)"

# ============================================================================
# DISPLAY OPTIONS
# ============================================================================

Write-Host ""
Write-Host "=" * 80 -ForegroundColor Yellow
Write-Host "CANONICAL CONVERGENCE MIGRATION - APPLICATION OPTIONS" -ForegroundColor Yellow
Write-Host "=" * 80 -ForegroundColor Yellow
Write-Host ""

if ($ShowSQL) {
    Write-Host "MIGRATION SQL:" -ForegroundColor Cyan
    Write-Host $migrationSQL
    Write-Host ""
    exit 0
}

Write-Host "Option 1: Supabase SQL Editor (RECOMMENDED)" -ForegroundColor Green
Write-Host "  1. Open: https://supabase.com/dashboard/project/$projectRef/sql/new" -ForegroundColor Gray
Write-Host "  2. Copy the SQL from: $migrationFile" -ForegroundColor Gray
Write-Host "  3. Paste into SQL Editor and click 'Run'" -ForegroundColor Gray
Write-Host ""

Write-Host "Option 2: Use Supabase CLI (if installed)" -ForegroundColor Cyan
Write-Host "  supabase db execute --project-ref $projectRef --file $migrationFile" -ForegroundColor Gray
Write-Host ""

Write-Host "Option 3: Direct PostgreSQL Connection" -ForegroundColor Cyan
Write-Host "  psql `"$([Environment]::GetEnvironmentVariable('DATABASE_DIRECT_URL', 'Process'))`" -f $migrationFile" -ForegroundColor Gray
Write-Host ""

if ($GenerateCurl) {
    Write-Host "Option 4: REST API (Advanced)" -ForegroundColor Yellow
    Write-Host "  Note: Supabase REST API doesn't support arbitrary SQL execution" -ForegroundColor Gray
    Write-Host "  Use SQL Editor or CLI instead" -ForegroundColor Gray
    Write-Host ""
}

# ============================================================================
# VERIFICATION QUERY
# ============================================================================

Write-Host "After applying migration, verify with this query:" -ForegroundColor Cyan
Write-Host ""

$verifySQL = @"
SELECT 
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='picks') AS picks_exists,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='pick_publish') AS pick_publish_exists,
  (SELECT count(*) FROM public.picks) AS picks_count,
  (SELECT count(*) FROM public.pick_publish) AS pick_publish_count;
"@

Write-Host $verifySQL -ForegroundColor Gray
Write-Host ""

# ============================================================================
# POSTGREST RELOAD
# ============================================================================

Write-Host "After migration, force PostgREST schema reload:" -ForegroundColor Cyan
Write-Host "  SELECT pg_notify('pgrst','reload schema');" -ForegroundColor Gray
Write-Host ""

Write-Host "=" * 80 -ForegroundColor Yellow
Write-Host ""
Write-Host "Ready to proceed? Choose an option above to apply the migration." -ForegroundColor Green
Write-Host ""

