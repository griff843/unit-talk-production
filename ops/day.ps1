<#
.SYNOPSIS
    CANONICAL ENTRYPOINT: pnpm ops:day (PowerShell variant)
.DESCRIPTION
    SPRINT-OPS-DAY-HEALTH-TIMEOUTS-101A

    THE ONE TRUE WAY to start a production workday locally.
    All other entrypoints (dev.sh, etc.) are DEPRECATED.

    Exit codes:
      0 - Production Day Ready
      1 - Fatal error (any failure = non-zero)
.PARAMETER DbMode
    Database mode: 'cloud' (default) or 'local'
.EXAMPLE
    .\ops\day.ps1
    .\ops\day.ps1 -DbMode local
#>

param(
    [ValidateSet('cloud', 'local')]
    [string]$DbMode = 'cloud'
)

$ErrorActionPreference = 'Stop'

# ============================================================================
# INVOKE-NATIVE: Safe native command execution with exit code enforcement
# ============================================================================
# Docker and other native commands write progress/status to stderr.
# PowerShell with $ErrorActionPreference='Stop' treats stderr as terminating errors.
# This helper:
#   1. Temporarily sets ErrorActionPreference to 'Continue' during execution
#   2. Merges stderr into stdout to prevent NativeCommandError
#   3. ALWAYS checks $LASTEXITCODE after the command
#   4. Throws if exit code is non-zero (FAIL-CLOSED behavior)
#
# Usage:
#   Invoke-Native { docker compose down }                    # Silent mode
#   Invoke-Native { docker compose up -d --build } -ShowOutput   # Show output
#   $output = Invoke-Native { docker compose ps } -Capture   # Capture output
# ============================================================================

function Invoke-Native {
    param(
        [Parameter(Mandatory)]
        [scriptblock]$Command,

        [switch]$ShowOutput, # Show command output in real-time
        [switch]$Capture,   # Return captured output instead of displaying
        [switch]$AllowFail, # Don't throw on non-zero exit (use with caution)
        [string]$ErrorMessage = "Native command failed"
    )

    # Save current preference and switch to Continue to prevent NativeCommandError
    $savedErrorPref = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'

    try {
        # Execute command with stderr merged to stdout
        if ($Capture) {
            # Capture all output for return
            $output = & $Command 2>&1
            $exitCode = $LASTEXITCODE
        } elseif ($ShowOutput) {
            # Stream output to console
            & $Command 2>&1 | ForEach-Object { Write-Host $_ }
            $exitCode = $LASTEXITCODE
            $output = $null
        } else {
            # Silent execution - discard output
            & $Command 2>&1 | Out-Null
            $exitCode = $LASTEXITCODE
            $output = $null
        }
    }
    finally {
        # Restore original preference
        $ErrorActionPreference = $savedErrorPref
    }

    # FAIL-CLOSED: Throw if command failed (unless AllowFail)
    if ($exitCode -ne 0 -and -not $AllowFail) {
        if ($output) {
            Write-Host ($output -join "`n") -ForegroundColor Red
        }
        throw "$ErrorMessage (exit code: $exitCode)"
    }

    # Return captured output if requested
    if ($Capture) {
        return $output
    }
}

# ============================================================================
# CONFIGURATION
# ============================================================================

$SPRINT_ID = "SPRINT-FRONTEND-CONTAINER-TRUTH-LOCK-102B"
$DATE = Get-Date -Format "yyyy-MM-dd"
$PROOF_DIR = "out/sprints/$SPRINT_ID/$DATE/proofs"
# Use 127.0.0.1 instead of localhost to avoid IPv6 issues on Windows
$API_URL = if ($env:API_URL) { $env:API_URL } else { "http://127.0.0.1:3010" }
$CRITICAL_TIMEOUT = 300  # 5 min for critical services
$FRONTEND_TIMEOUT = 900  # 15 min for frontends (Next.js cold builds)
$STRICT_FRONTENDS = if ($env:OPS_STRICT_FRONTENDS -eq "1") { $true } else { $false }
$HEALTH_TIMEOUT = $FRONTEND_TIMEOUT

# Service URLs
# SPRINT-FRONTEND-CONTAINER-TRUTH-LOCK-102B: Fixed ports
$SMART_FORM_URL = "http://localhost:3021"
$COMMAND_CENTER_URL = "http://localhost:3004"
$DASHBOARD_URL = "http://localhost:3003"
$GRAFANA_URL = "http://localhost:3001"
$PROMETHEUS_URL = "http://localhost:9090"
$TEMPORAL_UI_URL = "http://localhost:8088"

# ============================================================================
# OUTPUT FUNCTIONS
# ============================================================================

function Write-Step { param($msg) Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Ok { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "[FAIL] $msg" -ForegroundColor Red; exit 1 }
function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }

# ============================================================================
# BANNER
# ============================================================================

Write-Host ""
Write-Host "========================================"
Write-Host "  UNIT TALK - PRODUCTION DAY"
Write-Host "  Canonical Entrypoint: pnpm ops:day"
Write-Host "========================================"
Write-Host "  Date:     $DATE"
Write-Host "  DB Mode:  $DbMode"
Write-Host "  API URL:  $API_URL"
Write-Host "========================================"
Write-Host ""

$env:DB_MODE = $DbMode

# Create proof directory
New-Item -ItemType Directory -Force -Path $PROOF_DIR | Out-Null

# ============================================================================
# STEP A: Git Repository Status
# ============================================================================

Write-Step "A) Git Repository Status"

try {
    Invoke-Native { git fetch origin } -AllowFail
} catch {
    Write-Warn "Git fetch failed (offline?)"
}

$gitStatus = Invoke-Native { git status --porcelain } -Capture -AllowFail
if ($gitStatus) {
    Write-Warn "Working tree has uncommitted changes:"
    $shortStatus = Invoke-Native { git status --short } -Capture -AllowFail
    Write-Host ($shortStatus -join "`n")
} else {
    Write-Ok "Working tree clean"
}

$ahead = Invoke-Native { git rev-list --count origin/main..HEAD } -Capture -AllowFail
$behind = Invoke-Native { git rev-list --count HEAD..origin/main } -Capture -AllowFail
if ([int]$behind -gt 0) {
    Write-Warn "Branch is $behind commits behind origin/main"
}
if ([int]$ahead -gt 0) {
    Write-Info "Branch is $ahead commits ahead of origin/main"
}

# ============================================================================
# STEP B: Docker Verification (FAIL-CLOSED)
# ============================================================================

Write-Step "B) Docker Verification"

try {
    $dockerVersion = Invoke-Native { docker --version } -Capture
    if (-not $dockerVersion) { throw "Docker not found" }
    Write-Ok ($dockerVersion -join " ")
} catch {
    Write-Fail "Docker not found. Install Docker Desktop and try again."
}

try {
    Invoke-Native { docker info } -ErrorMessage "Docker daemon not running"
} catch {
    Write-Fail "Docker daemon not running. Start Docker Desktop and try again."
}

$composeVersion = Invoke-Native { docker compose version } -Capture
Write-Ok ($composeVersion -join " ")

# ============================================================================
# STEP C: Compose Stack (FAIL-CLOSED)
# ============================================================================

Write-Step "C) Starting Docker Compose Stack"

Write-Info "Stopping existing containers..."
try {
    # AllowFail because containers may not exist yet
    Invoke-Native { docker compose down --remove-orphans } -AllowFail
    Write-Ok "Existing containers stopped"
} catch {
    Write-Warn "No containers to stop (clean slate)"
}

if ($DbMode -eq 'local') {
    Write-Info "Mode: LOCAL (with postgres container)"
    if (-not (Test-Path "docker-compose.local.yml")) {
        Write-Fail "docker-compose.local.yml not found for local mode"
    }
    try {
        Invoke-Native { docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build } -ShowOutput -ErrorMessage "Docker compose up (local mode) failed"
    } catch {
        Write-Fail "Docker compose up failed: $_"
    }
} else {
    Write-Info "Mode: CLOUD (Supabase)"
    try {
        Invoke-Native { docker compose up -d --build } -ShowOutput -ErrorMessage "Docker compose up (cloud mode) failed"
    } catch {
        Write-Fail "Docker compose up failed: $_"
    }
}

Write-Ok "Containers started"

# ============================================================================
# STEP D: Wait for Health (bounded timeout)
# ============================================================================

Write-Step "D) Waiting for Services to Become Healthy"

$waited = 0
$interval = 5

while ($waited -lt $HEALTH_TIMEOUT) {
    Start-Sleep -Seconds $interval
    $waited += $interval

    try {
        $psOutput = Invoke-Native { docker compose ps --format json } -Capture -AllowFail
        if ($psOutput) {
            $services = $psOutput | ConvertFrom-Json
            $unhealthy = $services | Where-Object { $_.Health -and $_.Health -ne 'healthy' -and $_.Health -ne '' } | Select-Object -ExpandProperty Name
            if (-not $unhealthy) {
                Write-Ok "All services healthy (${waited}s)"
                break
            }
            Write-Info "Waiting... (${waited}s / ${HEALTH_TIMEOUT}s) - Unhealthy: $($unhealthy -join ', ')"
        }
    } catch {
        Write-Info "Waiting... (${waited}s / ${HEALTH_TIMEOUT}s)"
    }
}

if ($waited -ge $HEALTH_TIMEOUT) {
    Write-Fail "Services did not become healthy within ${HEALTH_TIMEOUT}s. Run: docker compose ps"
}

# Extra settling time
Start-Sleep -Seconds 5

# ============================================================================
# STEP D.1: Verify Temporal Health (FAIL-CLOSED)
# SPRINT-TEMPORAL-FOUNDATION-TRUTH-LOCK-099A
# ============================================================================

Write-Step "D.1) Verifying Temporal Services (FAIL-CLOSED)"

# Check temporal-postgres health
$temporalPgJson = Invoke-Native { docker compose ps temporal-postgres --format json } -Capture -AllowFail
$temporalPgStatus = "unknown"
if ($temporalPgJson) {
    try {
        $temporalPgSvc = $temporalPgJson | ConvertFrom-Json
        $temporalPgStatus = $temporalPgSvc.Health
    } catch {
        $temporalPgStatus = "parse_error"
    }
}

if ($temporalPgStatus -ne "healthy") {
    Write-Warn "temporal-postgres status: $temporalPgStatus"
    Write-Host "--- temporal-postgres logs (last 50 lines) ---"
    Invoke-Native { docker compose logs --tail=50 temporal-postgres } -ShowOutput -AllowFail
    Write-Fail "temporal-postgres is not healthy. Cannot proceed."
}
Write-Ok "temporal-postgres: healthy"

# Check temporal health
$temporalJson = Invoke-Native { docker compose ps temporal --format json } -Capture -AllowFail
$temporalSvcStatus = "unknown"
if ($temporalJson) {
    try {
        $temporalSvc = $temporalJson | ConvertFrom-Json
        $temporalSvcStatus = $temporalSvc.Health
    } catch {
        $temporalSvcStatus = "parse_error"
    }
}

if ($temporalSvcStatus -ne "healthy") {
    Write-Warn "temporal status: $temporalSvcStatus"
    Write-Host "--- temporal logs (last 100 lines) ---"
    Invoke-Native { docker compose logs --tail=100 temporal } -ShowOutput -AllowFail
    Write-Host "--- temporal-postgres logs (last 50 lines) ---"
    Invoke-Native { docker compose logs --tail=50 temporal-postgres } -ShowOutput -AllowFail
    Write-Fail "temporal is not healthy. Cannot proceed."
}
Write-Ok "temporal: healthy"

# Check temporal-ui health (non-blocking warning only)
$temporalUiJson = Invoke-Native { docker compose ps temporal-ui --format json } -Capture -AllowFail
$temporalUiStatus = "not_running"
if ($temporalUiJson) {
    try {
        $temporalUiSvc = $temporalUiJson | ConvertFrom-Json
        $temporalUiStatus = $temporalUiSvc.Health
    } catch {
        $temporalUiStatus = "parse_error"
    }
}

if ($temporalUiStatus -eq "healthy") {
    Write-Ok "temporal-ui: healthy"
} elseif ($temporalUiStatus -eq "starting" -or $temporalUiStatus -eq "unknown") {
    Write-Info "temporal-ui: $temporalUiStatus (non-blocking)"
} else {
    Write-Warn "temporal-ui: $temporalUiStatus (non-blocking)"
}

Write-Ok "Temporal foundation verified"

# ============================================================================
# STEP D.2: Verify Frontend Health
# SPRINT-FRONTEND-CONTAINER-TRUTH-LOCK-102B
# ============================================================================

Write-Step "D.2) Verifying Frontend Health"

# Display strict mode setting
if ($STRICT_FRONTENDS) {
    Write-Info "STRICT_FRONTENDS=YES - Frontends MUST be healthy"
} else {
    Write-Info "STRICT_FRONTENDS=NO - Frontend failures are warnings"
}

# Function to check frontend health
function Test-FrontendHealth {
    param(
        [string]$Name,
        [string]$Url,
        [string]$ContainerName,
        [int]$MaxRetries = 10,
        [int]$RetryDelay = 5
    )

    $healthUrl = "$Url/api/health"
    Write-Info "Checking $Name at $healthUrl..."

    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            $response = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 5 -ErrorAction Stop
            if ($response.status -eq "ok" -or $response.status -eq "healthy") {
                Write-Ok "${Name}: healthy (status: $($response.status))"
                return $true
            } else {
                Write-Info "${Name}: status=$($response.status) (retry $i/$MaxRetries)"
            }
        } catch {
            Write-Info "${Name}: not ready (retry $i/$MaxRetries)"
        }
        Start-Sleep -Seconds $RetryDelay
    }

    # Frontend failed to become healthy - dump logs
    Write-Warn "${Name}: UNHEALTHY after $MaxRetries retries"
    Write-Host "--- $ContainerName logs (last 100 lines) ---"
    Invoke-Native { docker compose logs --tail=100 $ContainerName } -ShowOutput -AllowFail
    Write-Host "--- end $ContainerName logs ---"
    return $false
}

# Track frontend health status
$frontendStatus = @{}

# Check Smart Form
$frontendStatus["smart-form"] = Test-FrontendHealth -Name "smart-form" -Url $SMART_FORM_URL -ContainerName "smart-form"

# Check Command Center
$frontendStatus["command-center"] = Test-FrontendHealth -Name "command-center" -Url $COMMAND_CENTER_URL -ContainerName "command-center"

# Check Dashboard
$frontendStatus["dashboard"] = Test-FrontendHealth -Name "dashboard" -Url $DASHBOARD_URL -ContainerName "dashboard"

# Evaluate results
$unhealthyFrontends = $frontendStatus.GetEnumerator() | Where-Object { $_.Value -eq $false } | Select-Object -ExpandProperty Name

if ($unhealthyFrontends.Count -eq 0) {
    Write-Ok "All frontends healthy"
} elseif ($STRICT_FRONTENDS) {
    Write-Fail "STRICT_FRONTENDS=1: Unhealthy frontends: $($unhealthyFrontends -join ', ')"
} else {
    Write-Warn "Unhealthy frontends (non-blocking): $($unhealthyFrontends -join ', ')"
    Write-Info "Set OPS_STRICT_FRONTENDS=1 to fail on frontend issues"
}

# ============================================================================
# STEP E: Assert /ops/status (FAIL-CLOSED)
# ============================================================================

Write-Step "E) Querying /ops/status"

$maxRetries = 5
$retryDelay = 3
$statusResponse = $null

for ($i = 1; $i -le $maxRetries; $i++) {
    try {
        $statusResponse = Invoke-RestMethod -Uri "$API_URL/ops/status" -Method Get -TimeoutSec 10 -ErrorAction Stop
        break
    } catch {
        Write-Info "API not ready, retry $i/$maxRetries..."
        Start-Sleep -Seconds $retryDelay
    }
}

if (-not $statusResponse) {
    Write-Fail "Failed to query /ops/status after $maxRetries retries. Run: docker compose logs api"
}

$overallReady = $statusResponse.overall_ready
$reportedMode = $statusResponse.components.db.mode
$dbTarget = $statusResponse.components.db.target
$mismatch = $statusResponse.components.db.mismatchDetected
$mismatchReason = $statusResponse.components.db.mismatchReason
$fingerprint = $statusResponse.supabase_fingerprint

$discordReady = $statusResponse.components.discord.ready
$discordWorkerHealthy = $statusResponse.components.discord.worker_healthy
$discordLastPost = $statusResponse.components.discord.last_post_at
if (-not $discordLastPost) { $discordLastPost = "never" }

$outboxPending = $statusResponse.components.outbox.pending_count
$outboxFailed = $statusResponse.components.outbox.failed_count

Write-Host ""
Write-Host "  Overall Ready:     $overallReady"
Write-Host "  DB Mode:           $reportedMode"
Write-Host "  DB Target:         $dbTarget"
Write-Host "  Supabase FP:       $fingerprint"
Write-Host "  Mismatch:          $mismatch"
Write-Host "  Discord Ready:     $discordReady"
Write-Host "  Worker Healthy:    $discordWorkerHealthy"
Write-Host "  Last Discord Post: $discordLastPost"
Write-Host "  Outbox Pending:    $outboxPending"
Write-Host "  Outbox Failed:     $outboxFailed"
Write-Host ""

# FAIL-CLOSED assertions
if ($mismatch -eq $true) {
    Write-Fail "DB MODE MISMATCH: $mismatchReason"
}

if ($reportedMode -ne $DbMode) {
    Write-Fail "DB mode mismatch: requested '$DbMode', reported '$reportedMode'"
}

Write-Ok "DB mode verified: $DbMode"

# Save ops status proof
$statusResponse | ConvertTo-Json -Depth 10 | Out-File -FilePath "$PROOF_DIR/proof_ops_status.json" -Encoding UTF8
Write-Ok "Saved: proof_ops_status.json"

# Parse Temporal status from /ops/status
$temporalConfigured = $statusResponse.components.temporal.configured
$temporalHealthy = $statusResponse.components.temporal.healthy
$temporalEndpoint = $statusResponse.components.temporal.endpoint
$temporalUiReachable = $statusResponse.components.temporal.ui_reachable
if (-not $temporalEndpoint) { $temporalEndpoint = "temporal:7233" }

Write-Host ""
Write-Host "  Temporal Configured: $temporalConfigured"
Write-Host "  Temporal Healthy:    $temporalHealthy"
Write-Host "  Temporal Endpoint:   $temporalEndpoint"
Write-Host "  Temporal UI:         $temporalUiReachable"
Write-Host ""

# Determine display status
$temporalDisplayStatus = "unknown"
if ($temporalHealthy -eq $true) {
    Write-Ok "Temporal: healthy"
    $temporalDisplayStatus = "healthy"
} else {
    Write-Warn "Temporal health from /ops/status: $temporalHealthy"
    # Fall back to checking UI directly
    try {
        Invoke-WebRequest -Uri $TEMPORAL_UI_URL -TimeoutSec 5 -ErrorAction Stop | Out-Null
        Write-Ok "Temporal UI reachable (fallback check)"
        $temporalDisplayStatus = "degraded (UI only)"
    } catch {
        Write-Warn "Temporal UI not reachable"
        $temporalDisplayStatus = "degraded"
    }
}

# ============================================================================
# STEP F: Run Required Proofs (FAIL-CLOSED)
# ============================================================================

Write-Step "F) Running E2E Proof Scripts"

# Required: e2e-receipt-proof.mjs
if (Test-Path "scripts/e2e-receipt-proof.mjs") {
    Write-Info "Running: scripts/e2e-receipt-proof.mjs"
    $output = node scripts/e2e-receipt-proof.mjs 2>&1
    $output | Out-File -FilePath "$PROOF_DIR/proof_e2e_receipt_output.txt" -Encoding UTF8
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "e2e-receipt-proof.mjs PASSED"
        $receiptPath = "out/audits/FOUNDATION-TRUTH-LOCK-094A/$DATE/proof_e2e_receipt.json"
        if (Test-Path $receiptPath) {
            Copy-Item $receiptPath "$PROOF_DIR/proof_e2e_receipt.json" -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host $output
        Write-Fail "e2e-receipt-proof.mjs FAILED (required)"
    }
} else {
    Write-Fail "scripts/e2e-receipt-proof.mjs not found (required)"
}

# Recommended: proof-db-mode-095a.mjs
if (Test-Path "scripts/proof-db-mode-095a.mjs") {
    Write-Info "Running: scripts/proof-db-mode-095a.mjs"
    $output = node scripts/proof-db-mode-095a.mjs 2>&1
    $output | Out-File -FilePath "$PROOF_DIR/proof_db_mode_output.txt" -Encoding UTF8
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "proof-db-mode-095a.mjs PASSED"
        $dbModeProofDir = "out/sprints/SPRINT-DB-MODE-TRUTH-LOCK-095A/$DATE/proofs"
        if (Test-Path $dbModeProofDir) {
            Copy-Item "$dbModeProofDir/*.json" $PROOF_DIR -ErrorAction SilentlyContinue
            Copy-Item "$dbModeProofDir/*.txt" $PROOF_DIR -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host $output
        Write-Fail "proof-db-mode-095a.mjs FAILED"
    }
} else {
    Write-Warn "scripts/proof-db-mode-095a.mjs not found (optional, skipped)"
}

# ============================================================================
# STEP G: Capture Additional Proofs
# ============================================================================

Write-Step "G) Capturing Additional Proofs"

$dockerPs = Invoke-Native { docker compose ps } -Capture -AllowFail
$dockerPs | Out-File -FilePath "$PROOF_DIR/proof_docker_ps.txt" -Encoding UTF8
Write-Ok "Saved: proof_docker_ps.txt"

$gitStatusOutput = Invoke-Native { git status } -Capture -AllowFail
$gitStatusOutput | Out-File -FilePath "$PROOF_DIR/proof_git_status.txt" -Encoding UTF8
Write-Ok "Saved: proof_git_status.txt"

# ============================================================================
# PRODUCTION DAY READY SUMMARY
# ============================================================================

Write-Host ""
Write-Host "========================================"
Write-Host "  PRODUCTION DAY READY"
Write-Host "========================================"
Write-Host ""
Write-Host "  Service URLs:" -ForegroundColor White
Write-Host "    Smart Form:      $SMART_FORM_URL"
Write-Host "    Command Center:  $COMMAND_CENTER_URL"
Write-Host "    Dashboard:       $DASHBOARD_URL"
Write-Host "    API:             $API_URL"
Write-Host "    Grafana:         $GRAFANA_URL"
Write-Host "    Prometheus:      $PROMETHEUS_URL"
Write-Host "    Temporal UI:     $TEMPORAL_UI_URL"
Write-Host ""
Write-Host "  Database:" -ForegroundColor White
Write-Host "    Mode:            $DbMode"
Write-Host "    Target:          $dbTarget"
Write-Host "    Fingerprint:     $fingerprint"
Write-Host ""
Write-Host "  Discord Worker:" -ForegroundColor White
Write-Host "    Healthy:         $discordWorkerHealthy"
Write-Host "    Last Post:       $discordLastPost"
Write-Host "    Outbox Pending:  $outboxPending"
Write-Host ""
Write-Host "  Temporal:" -ForegroundColor White
Write-Host "    Status:          $temporalDisplayStatus"
Write-Host "    Endpoint:        $temporalEndpoint"
Write-Host ""
Write-Host "  Frontends:" -ForegroundColor White
Write-Host "    Smart Form:      $(if ($frontendStatus['smart-form']) { 'healthy' } else { 'UNHEALTHY' })"
Write-Host "    Command Center:  $(if ($frontendStatus['command-center']) { 'healthy' } else { 'UNHEALTHY' })"
Write-Host "    Dashboard:       $(if ($frontendStatus['dashboard']) { 'healthy' } else { 'UNHEALTHY' })"
Write-Host "    Strict Mode:     $(if ($STRICT_FRONTENDS) { 'YES' } else { 'NO' })"
Write-Host ""
Write-Host "  Proof Bundle:" -ForegroundColor White
Write-Host "    Location:        $PROOF_DIR"
Write-Host "    Files:"
Get-ChildItem $PROOF_DIR | ForEach-Object { Write-Host "      - $($_.Name)" }
Write-Host ""
Write-Host "========================================"
Write-Host "  All checks passed. Ready for work."
Write-Host "========================================"
Write-Host ""

exit 0
