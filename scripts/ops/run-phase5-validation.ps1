# ==============================================================================
# PHASE 5 PROD VALIDATION - Workflow Executor
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  PHASE 5 - PROD Smart Form Validation" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify workflow exists
Write-Host "[1/6] Step 1: Verifying Phase 5 workflow..." -ForegroundColor Yellow
$workflows = gh workflow list --json name,path,state | ConvertFrom-Json
$phase5Workflow = $workflows | Where-Object { $_.name -like "*PHASE 5*" -or $_.name -like "*PROD Smart Form*" }

if (-not $phase5Workflow) {
    Write-Host "[ERROR] Phase 5 workflow not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Available workflows:" -ForegroundColor Yellow
    $workflows | ForEach-Object { Write-Host "  - $($_.name)" -ForegroundColor Gray }
    exit 1
}

Write-Host "[OK] Found workflow: $($phase5Workflow.name)" -ForegroundColor Green
Write-Host "   Path: $($phase5Workflow.path)" -ForegroundColor Gray
Write-Host ""

# Step 2: Trigger workflow
Write-Host "[2/6] Step 2: Triggering Phase 5 workflow on feat/phase15-orchestrator..." -ForegroundColor Yellow
try {
    gh workflow run phase5-prod-validation.yml `
        --ref feat/phase15-orchestrator `
        --field skip_test_data_creation=false `
        --field cleanup_test_data=false

    Write-Host "[OK] Workflow triggered successfully!" -ForegroundColor Green
    Write-Host ""
}
catch {
    Write-Host "[ERROR] Failed to trigger workflow: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Wait for run to start
Write-Host "[3/6] Step 3: Waiting for workflow run to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Get latest run
$latestRun = gh run list --workflow=phase5-prod-validation.yml --limit 1 --json databaseId,status,conclusion,createdAt,displayTitle | ConvertFrom-Json | Select-Object -First 1

if (-not $latestRun) {
    Write-Host "[ERROR] Could not find workflow run!" -ForegroundColor Red
    exit 1
}

$runId = $latestRun.databaseId
Write-Host "[OK] Workflow run started!" -ForegroundColor Green
Write-Host "   Run ID: $runId" -ForegroundColor Gray
Write-Host "   Status: $($latestRun.status)" -ForegroundColor Gray
Write-Host "   URL: https://github.com/griff843/unit-talk-production/actions/runs/$runId" -ForegroundColor Cyan
Write-Host ""

# Step 4: Monitor workflow
Write-Host "[4/6] Step 4: Monitoring workflow execution..." -ForegroundColor Yellow
Write-Host "   (This will take approximately 15-20 minutes)" -ForegroundColor Gray
Write-Host ""

# Watch the run (this blocks until completion)
gh run watch $runId

# Step 5: Get final status
Write-Host ""
Write-Host "[5/6] Step 5: Retrieving final status..." -ForegroundColor Yellow
$finalRun = gh run view $runId --json status,conclusion,jobs | ConvertFrom-Json

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  WORKFLOW EXECUTION SUMMARY" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run ID: $runId" -ForegroundColor White
Write-Host "Status: $($finalRun.status)" -ForegroundColor White
Write-Host "Conclusion: $($finalRun.conclusion)" -ForegroundColor White
Write-Host ""

if ($finalRun.conclusion -eq "success") {
    Write-Host "[SUCCESS] Workflow completed successfully!" -ForegroundColor Green
}
elseif ($finalRun.conclusion -eq "failure") {
    Write-Host "[FAILED] Workflow failed!" -ForegroundColor Red
}
else {
    Write-Host "[WARNING] Workflow ended with: $($finalRun.conclusion)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Job Results:" -ForegroundColor Yellow
$finalRun.jobs | ForEach-Object {
    $icon = switch ($_.conclusion) {
        "success" { "[OK]" }
        "failure" { "[FAIL]" }
        "skipped" { "[SKIP]" }
        default { "[?]" }
    }
    Write-Host "  $icon $($_.name) - $($_.conclusion)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Step 6: Download artifacts
Write-Host "[6/6] Step 6: Downloading artifacts..." -ForegroundColor Yellow

$artifactDir = "out\phase5-prod-validation\$runId"
if (-not (Test-Path $artifactDir)) {
    New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
}

try {
    gh run download $runId --dir $artifactDir
    Write-Host "[OK] Artifacts downloaded to: $artifactDir" -ForegroundColor Green
    Write-Host ""
}
catch {
    Write-Host "[WARNING] No artifacts available (workflow may have failed before artifact generation)" -ForegroundColor Yellow
    Write-Host ""
}

# Output final instructions
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  NEXT STEPS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if (Test-Path "$artifactDir\phase5-final-proof-bundle\PHASE5_PROD_PROOF_BUNDLE.md") {
    Write-Host "📄 Review proof bundle:" -ForegroundColor Yellow
    Write-Host "   $artifactDir\phase5-final-proof-bundle\PHASE5_PROD_PROOF_BUNDLE.md" -ForegroundColor White
    Write-Host ""
}

Write-Host "🔗 View full run details:" -ForegroundColor Yellow
Write-Host "   https://github.com/griff843/unit-talk-production/actions/runs/$runId" -ForegroundColor White
Write-Host ""

Write-Host "Run ID saved for reference: $runId" -ForegroundColor Gray
Write-Host ""

# Export run ID for further processing
$runId | Out-File -FilePath "out\phase5-prod-validation\latest-run-id.txt" -Encoding utf8
Write-Host "[COMPLETE] Phase 5 validation execution complete!" -ForegroundColor Green
Write-Host ""

exit 0
