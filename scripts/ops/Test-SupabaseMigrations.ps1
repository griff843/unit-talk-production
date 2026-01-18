# Test-SupabaseMigrations.ps1
# Purpose: Test Supabase migrations locally before CI/CD
# Usage: .\scripts\ops\Test-SupabaseMigrations.ps1 [-DryRun] [-Environment dev|staging|prod]

param(
    [switch]$DryRun,
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment = 'dev'
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SUPABASE MIGRATION TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "Dry Run: $DryRun" -ForegroundColor Yellow
Write-Host ""

# Check if Supabase CLI is installed
try {
    $version = supabase --version
    Write-Host "✅ Supabase CLI installed: $version" -ForegroundColor Green
} catch {
    Write-Host "❌ Supabase CLI not installed" -ForegroundColor Red
    Write-Host "Install: https://supabase.com/docs/guides/cli/getting-started#installing-the-supabase-cli" -ForegroundColor Yellow
    exit 1
}

# Check environment variables
$projectRef = $env:SUPABASE_PROJECT_REF
$accessToken = $env:SUPABASE_ACCESS_TOKEN

if (-not $projectRef) {
    Write-Host "❌ SUPABASE_PROJECT_REF environment variable not set" -ForegroundColor Red
    Write-Host "Set it in .env file or export it: `$env:SUPABASE_PROJECT_REF='your-project-ref'" -ForegroundColor Yellow
    exit 1
}

if (-not $accessToken) {
    Write-Host "❌ SUPABASE_ACCESS_TOKEN environment variable not set" -ForegroundColor Red
    Write-Host "Get token from: https://supabase.com/dashboard/account/tokens" -ForegroundColor Yellow
    Write-Host "Set it: `$env:SUPABASE_ACCESS_TOKEN='sbp_your_token_here'" -ForegroundColor Yellow
    exit 1
}

# Mask tokens in output
$maskedRef = $projectRef.Substring(0, [Math]::Min(4, $projectRef.Length)) + "****"
$maskedToken = "sbp_****"

Write-Host "Project Ref: $maskedRef" -ForegroundColor Cyan
Write-Host "Access Token: $maskedToken" -ForegroundColor Cyan
Write-Host ""

# Link to project
Write-Host "Linking to Supabase project..." -ForegroundColor Cyan
try {
    supabase link --project-ref $projectRef
    Write-Host "✅ Linked successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to link: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Count migrations
$migrationCount = (Get-ChildItem -Path "supabase\migrations" -Filter "*.sql" | Measure-Object).Count
Write-Host "Found $migrationCount migration files" -ForegroundColor Cyan
Write-Host ""

# List migrations
Write-Host "Migration files:" -ForegroundColor Cyan
Get-ChildItem -Path "supabase\migrations" -Filter "*.sql" |
    Sort-Object Name |
    ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor White }

Write-Host ""

if ($DryRun) {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "DRY RUN MODE - NO CHANGES WILL BE APPLIED" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To apply migrations, run without -DryRun flag" -ForegroundColor Yellow
    exit 0
}

# Confirm before applying
Write-Host "⚠️  WARNING: About to apply migrations to $Environment environment" -ForegroundColor Yellow
$confirm = Read-Host "Type 'YES' to continue"

if ($confirm -ne 'YES') {
    Write-Host "Cancelled by user" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Applying migrations..." -ForegroundColor Cyan

# Apply migrations with retry
$maxAttempts = 3
$attempt = 0

while ($attempt -lt $maxAttempts) {
    $attempt++
    Write-Host "Attempt $attempt/$maxAttempts..." -ForegroundColor Cyan

    try {
        supabase db push --include-all
        Write-Host "✅ Migrations applied successfully" -ForegroundColor Green
        break
    } catch {
        if ($attempt -lt $maxAttempts) {
            Write-Host "⚠️  Attempt $attempt failed, retrying in 10 seconds..." -ForegroundColor Yellow
            Start-Sleep -Seconds 10
        } else {
            Write-Host "❌ All $maxAttempts attempts failed" -ForegroundColor Red
            Write-Host "Error: $_" -ForegroundColor Red
            exit 1
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "MIGRATION COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Run verification: .\scripts\ops\Verify-SupabaseSchema.ps1" -ForegroundColor White
Write-Host "2. Run smoke tests: .\scripts\ops\Test-DatabaseConnection.ps1" -ForegroundColor White
