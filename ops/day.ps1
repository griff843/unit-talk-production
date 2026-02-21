<#
.SYNOPSIS
    CANONICAL ENTRYPOINT: pnpm ops:day (PowerShell variant)
.DESCRIPTION
    SPRINT-ENTRYPOINT-CANONICALIZATION-097A

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
# CONFIGURATION
# ============================================================================

$SPRINT_ID = "SPRINT-ENTRYPOINT-CANONICALIZATION-097A"
$DATE = Get-Date -Format "yyyy-MM-dd"
$PROOF_DIR = "out/sprints/$SPRINT_ID/$DATE/proofs"
# Use 127.0.0.1 instead of localhost to avoid IPv6 issues on Windows
$API_URL = if ($env:API_URL) { $env:API_URL } else { "http://127.0.0.1:3010" }
$HEALTH_TIMEOUT = 180  # 3 minutes max wait

# Service URLs
$SMART_FORM_URL = "http://localhost:3002"
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
    git fetch origin 2>$null
} catch {
    Write-Warn "Git fetch failed (offline?)"
}

$gitStatus = git status --porcelain 2>$null
if ($gitStatus) {
    Write-Warn "Working tree has uncommitted changes:"
    git status --short
} else {
    Write-Ok "Working tree clean"
}

$ahead = git rev-list --count origin/main..HEAD 2>$null
$behind = git rev-list --count HEAD..origin/main 2>$null
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
    $dockerVersion = docker --version 2>$null
    if (-not $dockerVersion) { throw "Docker not found" }
    Write-Ok $dockerVersion
} catch {
    Write-Fail "Docker not found. Install Docker Desktop and try again."
}

try {
    $dockerInfo = docker info 2>$null
    if ($LASTEXITCODE -ne 0) { throw "Docker daemon not running" }
} catch {
    Write-Fail "Docker daemon not running. Start Docker Desktop and try again."
}

$composeVersion = docker compose version
Write-Ok $composeVersion

# ============================================================================
# STEP C: Compose Stack (FAIL-CLOSED)
# ============================================================================

Write-Step "C) Starting Docker Compose Stack"

Write-Info "Stopping existing containers..."
docker compose down --remove-orphans 2>$null | Out-Null

if ($DbMode -eq 'local') {
    Write-Info "Mode: LOCAL (with postgres container)"
    if (-not (Test-Path "docker-compose.local.yml")) {
        Write-Fail "docker-compose.local.yml not found for local mode"
    }
    $result = docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host $result
        Write-Fail "Docker compose up failed"
    }
} else {
    Write-Info "Mode: CLOUD (Supabase)"
    $result = docker compose up -d --build 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host $result
        Write-Fail "Docker compose up failed"
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

    $psOutput = docker compose ps --format json 2>$null
    if ($psOutput) {
        try {
            $services = $psOutput | ConvertFrom-Json
            $unhealthy = $services | Where-Object { $_.Health -and $_.Health -ne 'healthy' -and $_.Health -ne '' } | Select-Object -ExpandProperty Name
            if (-not $unhealthy) {
                Write-Ok "All services healthy (${waited}s)"
                break
            }
            Write-Info "Waiting... (${waited}s / ${HEALTH_TIMEOUT}s) - Unhealthy: $($unhealthy -join ', ')"
        } catch {
            Write-Info "Waiting... (${waited}s / ${HEALTH_TIMEOUT}s)"
        }
    }
}

if ($waited -ge $HEALTH_TIMEOUT) {
    Write-Fail "Services did not become healthy within ${HEALTH_TIMEOUT}s. Run: docker compose ps"
}

# Extra settling time
Start-Sleep -Seconds 5

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

# Check Temporal (non-blocking)
$temporalStatus = "unknown"
try {
    Invoke-WebRequest -Uri $TEMPORAL_UI_URL -TimeoutSec 5 -ErrorAction Stop | Out-Null
    $temporalStatus = "healthy"
    Write-Ok "Temporal UI: healthy"
} catch {
    $temporalStatus = "degraded"
    Write-Warn "Temporal UI: DEGRADED (not blocking Discord pipeline)"
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

docker compose ps | Out-File -FilePath "$PROOF_DIR/proof_docker_ps.txt" -Encoding UTF8
Write-Ok "Saved: proof_docker_ps.txt"

git status | Out-File -FilePath "$PROOF_DIR/proof_git_status.txt" -Encoding UTF8
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
Write-Host "    Status:          $temporalStatus"
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
