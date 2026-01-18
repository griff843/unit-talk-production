# Verify-SupabaseSchema.ps1
# Purpose: Verify Supabase schema after migrations
# Usage: .\scripts\ops\Verify-SupabaseSchema.ps1 [-Environment dev|staging|prod]

param(
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment = 'dev'
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SUPABASE SCHEMA VERIFICATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host ""

# Check if Node.js is available
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not installed" -ForegroundColor Red
    exit 1
}

# Check if TypeScript is available
try {
    npx tsx --version | Out-Null
    Write-Host "✅ TypeScript execution ready" -ForegroundColor Green
} catch {
    Write-Host "❌ tsx not available, installing..." -ForegroundColor Yellow
    npm install -D tsx
}

Write-Host ""
Write-Host "Running schema verification script..." -ForegroundColor Cyan
Write-Host ""

# Run the verification script
try {
    npx tsx scripts\ops\verify-schema-post-migration.ts --env=$Environment
    Write-Host ""
    Write-Host "✅ Schema verification passed" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "❌ Schema verification failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "VERIFICATION COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
