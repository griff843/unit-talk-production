# PHASE 5 PROD VALIDATION - Simple Executor
$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  PHASE 5 - PROD Smart Form Validation" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify workflow
Write-Host "[1/6] Verifying Phase 5 workflow..." -ForegroundColor Yellow
$workflows = gh workflow list --json name,path | ConvertFrom-Json
$phase5 = $workflows | Where-Object { $_.name -match "PHASE 5" }

if (-not $phase5) {
    Write-Host "[ERROR] Workflow not found!" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Found: $($phase5.name)" -ForegroundColor Green
Write-Host ""

# Step 2: Trigger workflow
Write-Host "[2/6] Triggering workflow..." -ForegroundColor Yellow
gh workflow run phase5-prod-validation.yml --ref feat/phase15-orchestrator
Write-Host "[OK] Triggered" -ForegroundColor Green
Write-Host ""

# Step 3: Wait and get run ID
Write-Host "[3/6] Waiting for run to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

$run = gh run list --workflow=phase5-prod-validation.yml --limit 1 --json databaseId | ConvertFrom-Json | Select-Object -First 1
$runId = $run.databaseId

Write-Host "[OK] Run ID: $runId" -ForegroundColor Green
Write-Host "URL: https://github.com/griff843/unit-talk-production/actions/runs/$runId" -ForegroundColor Cyan
Write-Host ""

# Step 4: Monitor
Write-Host "[4/6] Monitoring execution (15-20 min)..." -ForegroundColor Yellow
gh run watch $runId

# Step 5: Get results
Write-Host ""
Write-Host "[5/6] Getting results..." -ForegroundColor Yellow
$final = gh run view $runId --json conclusion,jobs | ConvertFrom-Json

Write-Host ""
Write-Host "Conclusion: $($final.conclusion)" -ForegroundColor White
Write-Host ""

# Step 6: Download artifacts
Write-Host "[6/6] Downloading artifacts..." -ForegroundColor Yellow
$dir = "out\phase5-prod-validation\$runId"
New-Item -ItemType Directory -Path $dir -Force | Out-Null

try {
    gh run download $runId --dir $dir
    Write-Host "[OK] Downloaded to: $dir" -ForegroundColor Green
}
catch {
    Write-Host "[WARNING] No artifacts" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Run ID: $runId" -ForegroundColor White

if (Test-Path "$dir\phase5-final-proof-bundle\PHASE5_PROD_PROOF_BUNDLE.md") {
    Write-Host "Proof bundle: $dir\phase5-final-proof-bundle\PHASE5_PROD_PROOF_BUNDLE.md" -ForegroundColor White
}

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# Save run ID
$runId | Out-File "out\phase5-prod-validation\latest-run-id.txt" -Encoding ASCII

exit 0
