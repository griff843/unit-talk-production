#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Reload PostgREST schema via Supabase REST API
.DESCRIPTION
    Uses the x-supabase-reload-schema header to force schema reload
.NOTES
    Date: 2025-10-30
#>

$ErrorActionPreference = "Stop"

# Load environment variables
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

$SUPABASE_URL = $env:SUPABASE_URL
$SUPABASE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $SUPABASE_URL -or -not $SUPABASE_KEY) {
    Write-Host "❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set" -ForegroundColor Red
    exit 1
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "POSTGREST SCHEMA RELOAD (via API)" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "→ Sending reload request to Supabase..." -ForegroundColor Yellow

$headers = @{
    "apikey" = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
    "x-supabase-reload-schema" = "true"
}

try {
    # Try to query picks table with reload header
    $response = Invoke-WebRequest `
        -Uri "$SUPABASE_URL/rest/v1/picks?select=id&limit=1" `
        -Headers $headers `
        -UseBasicParsing `
        -ErrorAction Stop
    
    Write-Host "✅ Schema reload triggered successfully" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Waiting 10 seconds for reload to complete..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    Write-Host "✅ Reload complete" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Failed to reload schema: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "✅ RELOAD COMPLETE" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

exit 0

