#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Verify Canonical Convergence Environment Configuration
    
.DESCRIPTION
    Validates that all required environment variables are set correctly
    for canonical-first production deployment. Prints masked values for
    security while confirming presence.
    
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

function Write-Warning {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] [WARN] $Message" -ForegroundColor Yellow
}

function Get-MaskedValue {
    param([string]$Value)
    if ([string]::IsNullOrEmpty($Value)) { return "<NOT SET>" }
    if ($Value.Length -le 8) { return "***" }
    return "$($Value.Substring(0, 4))...$($Value.Substring($Value.Length - 4))"
}

# ============================================================================
# LOAD ENVIRONMENT FILES
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
    Write-Success ".env loaded"
} else {
    Write-Failure ".env file not found"
    exit 1
}

# Load .env.shared
if (Test-Path ".env.shared") {
    Get-Content ".env.shared" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Only set if not already set by .env
            if (-not [Environment]::GetEnvironmentVariable($key, 'Process')) {
                [Environment]::SetEnvironmentVariable($key, $value, 'Process')
            }
        }
    }
    Write-Success ".env.shared loaded"
} else {
    Write-Warning ".env.shared file not found (optional)"
}

Write-Host ""

# ============================================================================
# VERIFY CRITICAL CONFIGURATION
# ============================================================================

Write-Status "Verifying canonical convergence configuration..."
Write-Host ""

$allValid = $true

# Driver Configuration
$pickDriver = [Environment]::GetEnvironmentVariable('PICK_DRIVER', 'Process')
$publishMode = [Environment]::GetEnvironmentVariable('PUBLISH_MODE', 'Process')
$shadowMode = [Environment]::GetEnvironmentVariable('SHADOW_MODE', 'Process')
$logMode = [Environment]::GetEnvironmentVariable('LOG_MODE', 'Process')

Write-Host "DRIVER CONFIGURATION" -ForegroundColor Yellow
$driverColor = if ($pickDriver -eq 'canonical') { 'Green' } else { 'Red' }
$publishColor = if ($publishMode -eq 'outbox') { 'Green' } else { 'Red' }
$shadowColor = if ($shadowMode -eq 'false') { 'Green' } else { 'Yellow' }
$logColor = if ($logMode -eq 'sync') { 'Green' } else { 'Yellow' }
Write-Host "  PICK_DRIVER:    $pickDriver" -ForegroundColor $driverColor
Write-Host "  PUBLISH_MODE:   $publishMode" -ForegroundColor $publishColor
Write-Host "  SHADOW_MODE:    $shadowMode" -ForegroundColor $shadowColor
Write-Host "  LOG_MODE:       $logMode" -ForegroundColor $logColor
Write-Host ""

if ($pickDriver -ne 'canonical') {
    Write-Failure "PICK_DRIVER must be 'canonical' (found: $pickDriver)"
    $allValid = $false
}
if ($publishMode -ne 'outbox') {
    Write-Failure "PUBLISH_MODE must be 'outbox' (found: $publishMode)"
    $allValid = $false
}
if ($shadowMode -ne 'false') {
    Write-Warning "SHADOW_MODE is not 'false' - Discord publishing may be disabled"
}

# Supabase Configuration
$supabaseUrl = [Environment]::GetEnvironmentVariable('SUPABASE_URL', 'Process')
$supabaseAnonKey = [Environment]::GetEnvironmentVariable('SUPABASE_ANON_KEY', 'Process')
$supabaseServiceKey = [Environment]::GetEnvironmentVariable('SUPABASE_SERVICE_ROLE_KEY', 'Process')
$databaseDirectUrl = [Environment]::GetEnvironmentVariable('DATABASE_DIRECT_URL', 'Process')

Write-Host "SUPABASE CONFIGURATION" -ForegroundColor Yellow
$urlColor = if ($supabaseUrl) { 'Green' } else { 'Red' }
$anonColor = if ($supabaseAnonKey) { 'Green' } else { 'Red' }
$serviceColor = if ($supabaseServiceKey) { 'Green' } else { 'Red' }
$dbUrlColor = if ($databaseDirectUrl) { 'Green' } else { 'Red' }
Write-Host "  SUPABASE_URL:              $(Get-MaskedValue $supabaseUrl)" -ForegroundColor $urlColor
Write-Host "  SUPABASE_ANON_KEY:         $(Get-MaskedValue $supabaseAnonKey)" -ForegroundColor $anonColor
Write-Host "  SUPABASE_SERVICE_ROLE_KEY: $(Get-MaskedValue $supabaseServiceKey)" -ForegroundColor $serviceColor
Write-Host "  DATABASE_DIRECT_URL:       $(Get-MaskedValue $databaseDirectUrl)" -ForegroundColor $dbUrlColor
Write-Host ""

if (-not $supabaseUrl) {
    Write-Failure "SUPABASE_URL is required"
    $allValid = $false
}
if (-not $supabaseServiceKey) {
    Write-Failure "SUPABASE_SERVICE_ROLE_KEY is required"
    $allValid = $false
}
if (-not $databaseDirectUrl) {
    Write-Failure "DATABASE_DIRECT_URL is required for PostgREST schema reload"
    $allValid = $false
}

# Discord Configuration
$discordToken = [Environment]::GetEnvironmentVariable('DISCORD_BOT_TOKEN', 'Process')
$discordGuildId = [Environment]::GetEnvironmentVariable('DISCORD_GUILD_ID', 'Process')
$alertsChannelId = [Environment]::GetEnvironmentVariable('ALERTS_CHANNEL_ID', 'Process')

Write-Host "DISCORD CONFIGURATION" -ForegroundColor Yellow
$tokenColor = if ($discordToken) { 'Green' } else { 'Red' }
$guildColor = if ($discordGuildId) { 'Green' } else { 'Red' }
$alertColor = if ($alertsChannelId) { 'Green' } else { 'Yellow' }
Write-Host "  DISCORD_BOT_TOKEN:  $(Get-MaskedValue $discordToken)" -ForegroundColor $tokenColor
Write-Host "  DISCORD_GUILD_ID:   $(Get-MaskedValue $discordGuildId)" -ForegroundColor $guildColor
Write-Host "  ALERTS_CHANNEL_ID:  $(Get-MaskedValue $alertsChannelId)" -ForegroundColor $alertColor
Write-Host ""

if (-not $discordToken) {
    Write-Failure "DISCORD_BOT_TOKEN is required for publishing"
    $allValid = $false
}
if (-not $discordGuildId) {
    Write-Failure "DISCORD_GUILD_ID is required"
    $allValid = $false
}

# Tenant Configuration
$defaultTenantId = [Environment]::GetEnvironmentVariable('DEFAULT_TENANT_ID', 'Process')

Write-Host "TENANT CONFIGURATION" -ForegroundColor Yellow
$tenantColor = if ($defaultTenantId) { 'Green' } else { 'Red' }
Write-Host "  DEFAULT_TENANT_ID: $(Get-MaskedValue $defaultTenantId)" -ForegroundColor $tenantColor
Write-Host ""

if (-not $defaultTenantId) {
    Write-Failure "DEFAULT_TENANT_ID is required"
    $allValid = $false
}

# ============================================================================
# FINAL VERDICT
# ============================================================================

Write-Host ""
Write-Host "=" * 80 -ForegroundColor Gray

if ($allValid) {
    Write-Success "✅ ALL ENVIRONMENT VARIABLES VALIDATED"
    Write-Success "System is ready for canonical convergence deployment"
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Apply canonical migration: psql `$DATABASE_DIRECT_URL -f scripts/migrations/2025-01-28_canonical_convergence.sql" -ForegroundColor Gray
    Write-Host "  2. Restart services: ./dev.sh restart" -ForegroundColor Gray
    Write-Host "  3. Run E2E validation: .\scripts\ops\industry-standard-e2e-validation.ps1" -ForegroundColor Gray
    exit 0
} else {
    Write-Failure "❌ ENVIRONMENT VALIDATION FAILED"
    Write-Failure "Fix the issues above before proceeding"
    exit 1
}

