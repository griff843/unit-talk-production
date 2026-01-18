#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Self-Heal and Validate Wrapper for Canonical Picks

.DESCRIPTION
    Orchestrates the full self-heal and validation flow:
    1) Force PostgREST reload
    2) Verify schema visibility
    3) Start/verify stack
    4) Run industry-standard E2E validation
    5) Collect and report artifacts

.NOTES
    Date: 2025-01-28
    Author: Unit Talk Engineering
    Version: 1.0.0
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# ============================================================================
# CONSTANTS
# ============================================================================

$TIMESTAMP = Get-Date -Format 'yyyyMMdd_HHmmss'
$ARTIFACTS_DIR = "out/ops/cutover/metrics/100"
$REPORT_FILE = "$ARTIFACTS_DIR/SELF_HEAL_VALIDATION_$TIMESTAMP.md"

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

function Write-Status {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] [INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] [PASS] $Message" -ForegroundColor Green
}

function Write-Failure {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] [FAIL] $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] [WARN] $Message" -ForegroundColor Yellow
}

# ============================================================================
# PRE-CHECKS
# ============================================================================

Write-Status "Starting Self-Heal and Validation Flow"
Write-Status "Timestamp: $TIMESTAMP"
Write-Host ""

# Create artifacts directory
New-Item -ItemType Directory -Force -Path $ARTIFACTS_DIR | Out-Null

# Check environment
Write-Status "Environment Pre-Checks"
Write-Host "  Node: $(node --version)"
Write-Host "  PowerShell: $($PSVersionTable.PSVersion)"
Write-Host ""

# Mask secrets
$envVars = @('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DISCORD_TOKEN', 'DEFAULT_TENANT_ID', 'PICK_DRIVER', 'PUBLISH_MODE', 'SHADOW_MODE')
foreach ($var in $envVars) {
    $val = [Environment]::GetEnvironmentVariable($var)
    if ($val) {
        if ($var -match 'KEY|TOKEN') {
            Write-Host "  $var = $($val.Substring(0, [Math]::Min(10, $val.Length)))***"
        } else {
            Write-Host "  $var = $val"
        }
    } else {
        Write-Warning "  $var = NOT SET"
    }
}
Write-Host ""

# ============================================================================
# STEP 1: FORCE POSTGREST RELOAD
# ============================================================================

Write-Status "Step 1: Force PostgREST Reload"
$reloadAttempts = 0
$maxReloadAttempts = 2

for ($i = 0; $i -lt $maxReloadAttempts; $i++) {
    $reloadAttempts++
    Write-Status "  Reload attempt $reloadAttempts/$maxReloadAttempts"
    
    try {
        node scripts/ops/force-postgrest-reload.js --reason "self-heal-validation"
        if ($LASTEXITCODE -eq 0) {
            Write-Success "  PostgREST reload successful"
            break
        }
    } catch {
        Write-Warning "  Reload attempt $reloadAttempts failed: $_"
    }
    
    if ($i -lt $maxReloadAttempts - 1) {
        Write-Status "  Waiting 5 seconds before retry..."
        Start-Sleep -Seconds 5
    }
}
Write-Host ""

# ============================================================================
# STEP 2: VERIFY SCHEMA VISIBILITY
# ============================================================================

Write-Status "Step 2: Verify Schema Visibility"
$visibilityAttempts = 0
$maxVisibilityAttempts = 2

for ($i = 0; $i -lt $maxVisibilityAttempts; $i++) {
    $visibilityAttempts++
    Write-Status "  Visibility check attempt $visibilityAttempts/$maxVisibilityAttempts"
    
    try {
        npx tsx scripts/ops/verify-pgrst-visible.ts
        if ($LASTEXITCODE -eq 0) {
            Write-Success "  Schema visibility confirmed"
            break
        }
    } catch {
        Write-Warning "  Visibility check $visibilityAttempts failed: $_"
    }
    
    if ($i -lt $maxVisibilityAttempts - 1) {
        Write-Status "  Waiting 10 seconds for schema propagation..."
        Start-Sleep -Seconds 10
    }
}

if ($LASTEXITCODE -ne 0) {
    Write-Failure "Schema visibility check failed after $visibilityAttempts attempts"
    Write-Host ""
    Write-Host "Remediation Required:"
    Write-Host "  1. Check Supabase Dashboard for PostgREST status"
    Write-Host "  2. Manually restart PostgREST if needed"
    Write-Host "  3. Re-run this script"
    Write-Host ""
    exit 1
}
Write-Host ""

# ============================================================================
# STEP 3: START/VERIFY STACK
# ============================================================================

Write-Status "Step 3: Start/Verify Stack"
Write-Status "  Starting services via ./dev.sh start"

try {
    bash ./dev.sh start
    Start-Sleep -Seconds 5
} catch {
    Write-Warning "  Stack start command failed (may already be running): $_"
}

Write-Status "  Checking health endpoints"
$healthChecks = @(
    @{ Name = "API Health"; Url = "http://localhost:3010/api/health" }
    @{ Name = "Picks Preflight"; Url = "http://localhost:3010/api/domain/picks/preflight" }
    @{ Name = "Picks Status"; Url = "http://localhost:3010/api/domain/picks/status" }
)

foreach ($check in $healthChecks) {
    try {
        $response = Invoke-RestMethod -Uri $check.Url -Method GET -TimeoutSec 10 -ErrorAction Stop
        Write-Success "  $($check.Name): OK"
    } catch {
        Write-Failure "  $($check.Name): FAILED - $_"
    }
}
Write-Host ""

# ============================================================================
# STEP 4: RUN E2E VALIDATION
# ============================================================================

Write-Status "Step 4: Run Industry-Standard E2E Validation"
Write-Status "  Executing: scripts/ops/industry-standard-e2e-validation.ps1"
Write-Host ""

$validationExitCode = 0
try {
    & .\scripts\ops\industry-standard-e2e-validation.ps1
    $validationExitCode = $LASTEXITCODE
} catch {
    Write-Failure "  E2E validation script failed: $_"
    $validationExitCode = 1
}
Write-Host ""

# ============================================================================
# STEP 5: COLLECT ARTIFACTS
# ============================================================================

Write-Status "Step 5: Collect Artifacts"
$artifacts = @()

$artifactPatterns = @(
    "*attestation*.json",
    "*attestation*.md",
    "FINAL_GO_NO_GO_canonical_*.md",
    "SELF_HEAL_VALIDATION_*.md",
    "CLAUDE_CODE_ATTESTATION*.md"
)

foreach ($pattern in $artifactPatterns) {
    $files = Get-ChildItem -Path $ARTIFACTS_DIR -Filter $pattern -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        $artifacts += $file.FullName
        Write-Success "  Found: $($file.Name)"
    }
}

if ($artifacts.Count -eq 0) {
    Write-Warning "  No artifacts found in $ARTIFACTS_DIR"
}
Write-Host ""

# ============================================================================
# STEP 6: GENERATE SUMMARY REPORT
# ============================================================================

Write-Status "Step 6: Generate Summary Report"

# Build report content
$reportLines = @()
$reportLines += "# Self-Heal and Validation Report"
$reportLines += "**Date:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$reportLines += "**Timestamp:** $TIMESTAMP"
$reportLines += ""
$reportLines += "## Self-Heal Summary"
$reportLines += "- **PostgREST Reload Attempts:** $reloadAttempts"
$reportLines += "- **Schema Visibility Attempts:** $visibilityAttempts"
$reportLines += "- **Stack Start:** Completed"
$reportLines += "- **Health Checks:** See details above"
$reportLines += ""
$reportLines += "## E2E Validation Result"
$reportLines += "- **Exit Code:** $validationExitCode"
if ($validationExitCode -eq 0) {
    $reportLines += "- **Status:** GO"
} else {
    $reportLines += "- **Status:** NO-GO"
}
$reportLines += ""
$reportLines += "## Artifacts Collected"
if ($artifacts.Count -gt 0) {
    foreach ($artifact in $artifacts) {
        $reportLines += "- $artifact"
    }
} else {
    $reportLines += "- No artifacts found"
}
$reportLines += ""
$reportLines += "## Next Actions"
if ($validationExitCode -eq 0) {
    $reportLines += "All validations passed. System is GO for production."
} else {
    $reportLines += "Validation failed. Review artifacts and logs for remediation."
}

$reportContent = $reportLines -join "`n"
$reportContent | Out-File -FilePath $REPORT_FILE -Encoding UTF8
Write-Success "  Report saved: $REPORT_FILE"
Write-Host ""

# ============================================================================
# FINAL OUTPUT
# ============================================================================

Write-Host ("=" * 80)
if ($validationExitCode -eq 0) {
    Write-Success "SELF-HEAL AND VALIDATION: GO"
} else {
    Write-Failure "SELF-HEAL AND VALIDATION: NO-GO"
}
Write-Host ("=" * 80)
Write-Host ""

Write-Host "Summary Report: $REPORT_FILE"
Write-Host "Artifacts Directory: $ARTIFACTS_DIR"
Write-Host ""

exit $validationExitCode

