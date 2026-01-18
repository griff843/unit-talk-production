# PHASE 5 PROD VALIDATION - Auto-locate gh CLI
$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  PHASE 5 - PROD Smart Form Validation" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# Locate gh CLI
Write-Host "[0/6] Locating gh CLI..." -ForegroundColor Yellow

$ghLocations = @(
    "C:\Program Files\GitHub CLI\gh.exe",
    "C:\Program Files (x86)\GitHub CLI\gh.exe",
    "${env:LOCALAPPDATA}\Programs\GitHub CLI\gh.exe",
    "${env:ProgramFiles}\GitHub CLI\gh.exe",
    "${env:ProgramFiles(x86)}\GitHub CLI\gh.exe"
)

$ghPath = $null
foreach ($loc in $ghLocations) {
    if (Test-Path $loc) {
        $ghPath = $loc
        break
    }
}

if (-not $ghPath) {
    # Try to find it
    Write-Host "[INFO] Searching for gh.exe..." -ForegroundColor Cyan
    $found = Get-ChildItem -Path "C:\Program Files" -Filter "gh.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $ghPath = $found.FullName
    }
}

if (-not $ghPath) {
    Write-Host "[ERROR] gh CLI not found!" -ForegroundColor Red
    Write-Host "Please install via: winget install --id GitHub.cli" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Found gh at: $ghPath" -ForegroundColor Green
Write-Host ""

# Create gh alias
Set-Alias -Name gh -Value $ghPath -Scope Script

# Step 1: Verify workflow file exists locally
Write-Host "[1/6] Verifying Phase 5 workflow file..." -ForegroundColor Yellow
$workflowFile = ".github\workflows\phase5-prod-validation.yml"

if (-not (Test-Path $workflowFile)) {
    Write-Host "[ERROR] Workflow file not found at: $workflowFile" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Found workflow file: $workflowFile" -ForegroundColor Green
Write-Host "[INFO] Note: Workflow may not appear in gh workflow list until first run" -ForegroundColor Cyan
Write-Host ""

# Step 2: Trigger workflow
Write-Host "[2/6] Triggering workflow on feat/phase15-orchestrator..." -ForegroundColor Yellow
& $ghPath workflow run phase5-prod-validation.yml --ref feat/phase15-orchestrator
Write-Host "[OK] Triggered successfully" -ForegroundColor Green
Write-Host ""

# Step 3: Wait and get run ID
Write-Host "[3/6] Waiting for run to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

$run = & $ghPath run list --workflow=phase5-prod-validation.yml --limit 1 --json databaseId | ConvertFrom-Json | Select-Object -First 1
$runId = $run.databaseId

Write-Host "[OK] Run ID: $runId" -ForegroundColor Green
Write-Host "URL: https://github.com/griff843/unit-talk-production/actions/runs/$runId" -ForegroundColor Cyan
Write-Host ""

# Step 4: Monitor
Write-Host "[4/6] Monitoring execution (this will take 15-20 minutes)..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop watching (workflow will continue running)" -ForegroundColor Gray
Write-Host ""

& $ghPath run watch $runId

# Step 5: Get results
Write-Host ""
Write-Host "[5/6] Retrieving final results..." -ForegroundColor Yellow
$final = & $ghPath run view $runId --json conclusion,jobs | ConvertFrom-Json

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  WORKFLOW RESULTS" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Conclusion: $($final.conclusion)" -ForegroundColor White
Write-Host ""

Write-Host "Job Results:" -ForegroundColor Yellow
$final.jobs | ForEach-Object {
    $status = if ($_.conclusion -eq "success") { "[OK]" } elseif ($_.conclusion -eq "failure") { "[FAIL]" } else { "[SKIP]" }
    Write-Host "  $status $($_.name)" -ForegroundColor Gray
}
Write-Host ""

# Step 6: Download artifacts
Write-Host "[6/6] Downloading artifacts..." -ForegroundColor Yellow
$dir = "out\phase5-prod-validation\$runId"
New-Item -ItemType Directory -Path $dir -Force | Out-Null

try {
    & $ghPath run download $runId --dir $dir
    Write-Host "[OK] Downloaded to: $dir" -ForegroundColor Green
}
catch {
    Write-Host "[WARNING] No artifacts available" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  NEXT STEPS" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run ID: $runId" -ForegroundColor White

if (Test-Path "$dir\phase5-final-proof-bundle\PHASE5_PROD_PROOF_BUNDLE.md") {
    Write-Host "Proof Bundle: $dir\phase5-final-proof-bundle\PHASE5_PROD_PROOF_BUNDLE.md" -ForegroundColor White
}
else {
    Write-Host "Proof Bundle: Not found (check artifacts manually)" -ForegroundColor Yellow
}

Write-Host "GitHub URL: https://github.com/griff843/unit-talk-production/actions/runs/$runId" -ForegroundColor Cyan
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# Save run ID
$runId | Out-File "out\phase5-prod-validation\latest-run-id.txt" -Encoding ASCII

Write-Host "[COMPLETE] Phase 5 validation execution complete!" -ForegroundColor Green
Write-Host ""

exit 0
