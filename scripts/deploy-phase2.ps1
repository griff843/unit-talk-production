# Phase 2 Deployment Script
# Date: 2025-10-20
# Purpose: Deploy Phase 2 CI/CD pipeline to Supabase

param(
    [Parameter(Mandatory=$false)]
    [string]$AccessToken = $env:SUPABASE_ACCESS_TOKEN
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "Phase 2 Deployment - SaaS-Grade CI/CD Pipeline" -ForegroundColor Cyan
Write-Host "Date: 2025-10-20" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# Check for access token
if ([string]::IsNullOrEmpty($AccessToken)) {
    Write-Host "❌ ERROR: SUPABASE_ACCESS_TOKEN not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please set the token:" -ForegroundColor Yellow
    Write-Host '  $env:SUPABASE_ACCESS_TOKEN = "sbp_..."' -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or pass as parameter:" -ForegroundColor Yellow
    Write-Host '  .\scripts\deploy-phase2.ps1 -AccessToken "sbp_..."' -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

$env:SUPABASE_ACCESS_TOKEN = $AccessToken
$PROJECT_REF = "cqfnsozknjzvyiziwicl"

Write-Host "Step 1: Link Supabase project" -ForegroundColor Green
Write-Host "Project: $PROJECT_REF" -ForegroundColor Gray
Write-Host ""

supabase link --project-ref $PROJECT_REF

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to link project" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Project linked" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Push database migrations" -ForegroundColor Green
Write-Host "Migration: supabase/migrations/20251020_phase2_core.sql" -ForegroundColor Gray
Write-Host ""

supabase db push

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to push migrations" -ForegroundColor Red
    Write-Host ""
    Write-Host "If you see 'remote versions not found locally', run:" -ForegroundColor Yellow
    Write-Host "  supabase migration list" -ForegroundColor Yellow
    Write-Host "  supabase migration repair --status reverted <migration_id>" -ForegroundColor Yellow
    Write-Host "  supabase db push" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "✅ Migrations pushed" -ForegroundColor Green
Write-Host ""

Write-Host "Step 3: Run admin RPCs" -ForegroundColor Green
Write-Host "Script: apps/api/src/scripts/ci-run-admin-rpcs.ts" -ForegroundColor Gray
Write-Host ""

npx tsx apps/api/src/scripts/ci-run-admin-rpcs.ts

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Admin RPCs failed" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Admin RPCs completed" -ForegroundColor Green
Write-Host ""

Write-Host "Step 4: Verify gates" -ForegroundColor Green
Write-Host "Script: apps/api/src/scripts/verify-gates.ts" -ForegroundColor Gray
Write-Host ""

npx tsx apps/api/src/scripts/verify-gates.ts

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Gates failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Check report: apps/api/out/ops/verify/E2E_VALIDATION_REPORT.md" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "✅ All gates passed" -ForegroundColor Green
Write-Host ""

Write-Host "Step 5: Verify SLOs" -ForegroundColor Green
Write-Host "Script: apps/api/src/scripts/verify-slo.ts" -ForegroundColor Gray
Write-Host ""

npx tsx apps/api/src/scripts/verify-slo.ts

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ SLOs breached" -ForegroundColor Red
    Write-Host ""
    Write-Host "Check report: apps/api/out/ops/verify/SLO_REPORT.md" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "✅ All SLOs met" -ForegroundColor Green
Write-Host ""

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "✅ Phase 2 Deployment Complete!" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Artifacts:" -ForegroundColor Yellow
Write-Host "  - apps/api/out/ops/verify/E2E_VALIDATION_REPORT.json" -ForegroundColor Gray
Write-Host "  - apps/api/out/ops/verify/E2E_VALIDATION_REPORT.md" -ForegroundColor Gray
Write-Host "  - apps/api/out/ops/verify/SLO_REPORT.json" -ForegroundColor Gray
Write-Host "  - apps/api/out/ops/verify/SLO_REPORT.md" -ForegroundColor Gray
Write-Host "  - out/ops/db/EXECUTIVE_SUMMARY.md" -ForegroundColor Gray
Write-Host ""

Write-Host "One-Liners:" -ForegroundColor Yellow
Write-Host "  # Re-run backfill" -ForegroundColor Gray
Write-Host '  npx tsx apps/api/src/scripts/ci-run-admin-rpcs.ts' -ForegroundColor Gray
Write-Host ""
Write-Host "  # Re-verify gates" -ForegroundColor Gray
Write-Host '  npx tsx apps/api/src/scripts/verify-gates.ts' -ForegroundColor Gray
Write-Host ""
Write-Host "  # Re-verify SLOs" -ForegroundColor Gray
Write-Host '  npx tsx apps/api/src/scripts/verify-slo.ts' -ForegroundColor Gray
Write-Host ""

exit 0

