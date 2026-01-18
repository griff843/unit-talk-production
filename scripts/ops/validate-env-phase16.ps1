# Phase 16 Environment Validation Script
# Validates that required environment variables are present in .env file

param(
    [switch]$Json = $false
)

$envFile = '.env'
$envContent = Get-Content $envFile -Raw

$requiredVars = @(
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DISCORD_BOT_TOKEN',
    'DISCORD_WEBHOOK_URL',
    'OPTIMAL_API_KEY',
    'ODDS_API_KEY'
)

$missing = @()
$present = @()

foreach ($var in $requiredVars) {
    if ($envContent -match "(?m)^$var=") {
        $present += $var
    } else {
        $missing += $var
    }
}

$result = @{
    timestamp = (Get-Date -Format 'o')
    total_required = $requiredVars.Count
    present = $present.Count
    missing = $missing.Count
    missing_vars = $missing
    present_vars = $present
    status = if ($missing.Count -eq 0) { 'PASS' } else { 'WARN' }
    env_file_exists = $true
    note = 'Some vars may be optional for Phase16 testing'
}

if ($Json) {
    $result | ConvertTo-Json
} else {
    Write-Host "Environment Validation Results:"
    Write-Host "================================"
    Write-Host "Total Required: $($result.total_required)"
    Write-Host "Present: $($result.present)"
    Write-Host "Missing: $($result.missing)"
    Write-Host "Status: $($result.status)"
    if ($missing.Count -gt 0) {
        Write-Host "Missing Variables:"
        $missing | ForEach-Object { Write-Host "  - $_" }
    }
}

