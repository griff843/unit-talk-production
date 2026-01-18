# Test-SafeQuery.ps1
# Purpose: Test the safe SQL query runner
# Usage: .\scripts\ops\Test-SafeQuery.ps1 [-Environment dev|staging|prod] [-Query "SELECT 1"]

param(
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment = 'dev',
    [string]$Query = "SELECT COUNT(*) as total FROM picks"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SAFE SQL QUERY RUNNER TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "Query: $Query" -ForegroundColor Yellow
Write-Host ""

# Check environment variable
$envVar = "SUPABASE_READONLY_DATABASE_URL_" + $Environment.ToUpper()
$connectionString = [System.Environment]::GetEnvironmentVariable($envVar)

if (-not $connectionString) {
    Write-Host "❌ Environment variable not set: $envVar" -ForegroundColor Red
    Write-Host ""
    Write-Host "Add to .env file:" -ForegroundColor Yellow
    Write-Host "$envVar=postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Mask connection string
$masked = $connectionString -replace '(postgresql://[^:]+:)[^@]+(@)', '$1****$2'
Write-Host "Connection: $masked" -ForegroundColor Cyan
Write-Host ""

# Run the query
Write-Host "Executing query..." -ForegroundColor Cyan
Write-Host ""

try {
    npx tsx scripts\ops\supabase-query.ts --env $Environment "$Query"
    Write-Host ""
    Write-Host "✅ Query executed successfully" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "❌ Query failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "TEST COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Try these examples:" -ForegroundColor Cyan
Write-Host "  .\scripts\ops\Test-SafeQuery.ps1 -Query 'SELECT * FROM picks LIMIT 5'" -ForegroundColor White
Write-Host "  .\scripts\ops\Test-SafeQuery.ps1 -Query 'SELECT COUNT(*) FROM pick_publish'" -ForegroundColor White
Write-Host "  .\scripts\ops\Test-SafeQuery.ps1 -Query 'DROP TABLE picks'  # Should be blocked" -ForegroundColor White
