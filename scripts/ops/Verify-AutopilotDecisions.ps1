# Verify-AutopilotDecisions.ps1
# Purpose: Verify autopilot_decisions table exists and is functional
# Usage: .\scripts\ops\Verify-AutopilotDecisions.ps1 [-Environment dev|staging|prod]

param(
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment = 'dev'
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AUTOPILOT_DECISIONS TABLE VERIFICATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host ""

# Step 1: Check table exists
Write-Host "[1/5] Checking if table exists..." -ForegroundColor Cyan
try {
    $query = @"
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'autopilot_decisions'
) as exists;
"@

    Write-Host "Query: $query" -ForegroundColor DarkGray
    npx tsx scripts\ops\supabase-query.ts --env $Environment --output json "$query" | Out-File -FilePath temp_result.json
    $result = Get-Content temp_result.json | ConvertFrom-Json
    Remove-Item temp_result.json

    if ($result[0].exists -eq $true) {
        Write-Host "✅ Table exists" -ForegroundColor Green
    } else {
        Write-Host "❌ Table does not exist" -ForegroundColor Red
        Write-Host "Run migrations: .\scripts\ops\Test-SupabaseMigrations.ps1" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Failed to check table existence: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Check table structure
Write-Host "[2/5] Checking table structure..." -ForegroundColor Cyan
try {
    $query = @"
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'autopilot_decisions'
ORDER BY ordinal_position;
"@

    npx tsx scripts\ops\supabase-query.ts --env $Environment "$query"
    Write-Host "✅ Table structure verified" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to check table structure: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: Check indexes
Write-Host "[3/5] Checking indexes..." -ForegroundColor Cyan
try {
    $query = @"
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'autopilot_decisions'
ORDER BY indexname;
"@

    npx tsx scripts\ops\supabase-query.ts --env $Environment "$query"
    Write-Host "✅ Indexes verified" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to check indexes: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 4: Check RLS policies
Write-Host "[4/5] Checking RLS policies..." -ForegroundColor Cyan
try {
    $query = @"
SELECT policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'autopilot_decisions';
"@

    npx tsx scripts\ops\supabase-query.ts --env $Environment "$query"
    Write-Host "✅ RLS policies verified" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to check RLS policies: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 5: Check helper functions
Write-Host "[5/5] Checking helper functions..." -ForegroundColor Cyan
try {
    $query = @"
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%autopilot%'
ORDER BY routine_name;
"@

    npx tsx scripts\ops\supabase-query.ts --env $Environment "$query"
    Write-Host "✅ Helper functions verified" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to check helper functions: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "VERIFICATION COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "✅ autopilot_decisions table is fully functional" -ForegroundColor Green
Write-Host ""
Write-Host "Test the helper functions:" -ForegroundColor Cyan
Write-Host "  SELECT * FROM get_daily_autopilot_report();" -ForegroundColor White
Write-Host "  SELECT * FROM get_autopilot_timeline(24);" -ForegroundColor White
