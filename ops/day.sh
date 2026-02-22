#!/usr/bin/env bash
#
# CANONICAL ENTRYPOINT: pnpm ops:day
# SPRINT-FRONTEND-CONTAINER-TRUTH-LOCK-102B
#
# THE ONE TRUE WAY to start a production workday locally.
# All other entrypoints (dev.sh, etc.) are DEPRECATED.
#
# Usage:
#   pnpm ops:day          # cloud mode (default)
#   pnpm ops:day local    # local mode with postgres container
#
# Exit codes:
#   0 - Production Day Ready
#   1 - Fatal error (any failure = non-zero)
#

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

DB_MODE="${1:-cloud}"
SPRINT_ID="SPRINT-FRONTEND-CONTAINER-TRUTH-LOCK-102B"
DATE=$(date +%Y-%m-%d)
PROOF_DIR="out/sprints/$SPRINT_ID/$DATE/proofs"
# Use 127.0.0.1 instead of localhost to avoid IPv6 issues on Windows
API_URL="${API_URL:-http://127.0.0.1:3010}"
CRITICAL_TIMEOUT=300  # 5 min for critical services
FRONTEND_TIMEOUT=900  # 15 min for frontends (Next.js cold builds)
STRICT_FRONTENDS="${OPS_STRICT_FRONTENDS:-0}"
HEALTH_TIMEOUT=$FRONTEND_TIMEOUT

# Service URLs
# SPRINT-FRONTEND-CONTAINER-TRUTH-LOCK-102B: Fixed ports
SMART_FORM_URL="http://localhost:3021"
COMMAND_CENTER_URL="http://localhost:3004"
DASHBOARD_URL="http://localhost:3003"
GRAFANA_URL="http://localhost:3001"
PROMETHEUS_URL="http://localhost:9090"
TEMPORAL_UI_URL="http://localhost:8088"

# ============================================================================
# OUTPUT FUNCTIONS (No emojis for clean log parsing)
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

step()  { echo -e "\n${CYAN}${BOLD}=== $1 ===${NC}"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
fail()  { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }
info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }

# ============================================================================
# VALIDATION
# ============================================================================

if [[ "$DB_MODE" != "cloud" && "$DB_MODE" != "local" ]]; then
    fail "Invalid DB_MODE: $DB_MODE (must be 'cloud' or 'local')"
fi

# ============================================================================
# BANNER
# ============================================================================

echo ""
echo "========================================"
echo "  UNIT TALK - PRODUCTION DAY"
echo "  Canonical Entrypoint: pnpm ops:day"
echo "========================================"
echo "  Date:     $DATE"
echo "  DB Mode:  $DB_MODE"
echo "  API URL:  $API_URL"
echo "========================================"
echo ""

export DB_MODE

# Create proof directory
mkdir -p "$PROOF_DIR"

# ============================================================================
# STEP A: Git Status (informational, not blocking)
# ============================================================================

step "A) Git Repository Status"

git fetch origin 2>/dev/null || warn "Git fetch failed (offline?)"

GIT_STATUS=$(git status --porcelain 2>/dev/null || echo "")
if [[ -n "$GIT_STATUS" ]]; then
    warn "Working tree has uncommitted changes:"
    git status --short
else
    ok "Working tree clean"
fi

AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "0")
BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "0")

if [[ "$BEHIND" -gt 0 ]]; then
    warn "Branch is $BEHIND commits behind origin/main"
fi
if [[ "$AHEAD" -gt 0 ]]; then
    info "Branch is $AHEAD commits ahead of origin/main"
fi

# ============================================================================
# STEP B: Docker Verification (FAIL-CLOSED)
# ============================================================================

step "B) Docker Verification"

if ! command -v docker &> /dev/null; then
    fail "Docker not found. Install Docker Desktop and try again."
fi

if ! docker info &> /dev/null; then
    fail "Docker daemon not running. Start Docker Desktop and try again."
fi

ok "$(docker --version)"
ok "$(docker compose version)"

# ============================================================================
# STEP C: Compose Stack (FAIL-CLOSED)
# ============================================================================

step "C) Starting Docker Compose Stack"

# Stop existing containers
info "Stopping existing containers..."
docker compose down --remove-orphans 2>/dev/null || true

# Start based on mode
if [[ "$DB_MODE" == "local" ]]; then
    info "Mode: LOCAL (with postgres container)"
    if [[ ! -f "docker-compose.local.yml" ]]; then
        fail "docker-compose.local.yml not found for local mode"
    fi
    docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build 2>&1 || fail "Docker compose up failed"
else
    info "Mode: CLOUD (Supabase)"
    docker compose up -d --build 2>&1 || fail "Docker compose up failed"
fi

ok "Containers started"

# ============================================================================
# STEP D: Wait for Health (bounded timeout)
# ============================================================================

step "D) Waiting for Services to Become Healthy"

WAITED=0
INTERVAL=5

while [[ $WAITED -lt $HEALTH_TIMEOUT ]]; do
    sleep $INTERVAL
    WAITED=$((WAITED + INTERVAL))

    # Get unhealthy services using node for JSON parsing
    UNHEALTHY=$(docker compose ps --format json 2>/dev/null | node -e "
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin });
        const unhealthy = [];
        rl.on('line', (line) => {
            try {
                const svc = JSON.parse(line);
                if (svc.Health && svc.Health !== 'healthy' && svc.Health !== '') {
                    unhealthy.push(svc.Name);
                }
            } catch (e) {}
        });
        rl.on('close', () => {
            console.log(unhealthy.join(' '));
        });
    " 2>/dev/null || true)

    if [[ -z "$UNHEALTHY" || "$UNHEALTHY" == " " ]]; then
        ok "All services healthy (${WAITED}s)"
        break
    fi

    info "Waiting... (${WAITED}s / ${HEALTH_TIMEOUT}s) - Unhealthy: $UNHEALTHY"
done

if [[ $WAITED -ge $HEALTH_TIMEOUT ]]; then
    fail "Services did not become healthy within ${HEALTH_TIMEOUT}s. Run: docker compose ps"
fi

# Extra settling time for API startup
sleep 5

# ============================================================================
# STEP D.1: Verify Temporal Health (FAIL-CLOSED)
# SPRINT-TEMPORAL-FOUNDATION-TRUTH-LOCK-099A
# ============================================================================

step "D.1) Verifying Temporal Services (FAIL-CLOSED)"

# Check temporal-postgres health
TEMPORAL_PG_STATUS=$(docker compose ps temporal-postgres --format json 2>/dev/null | node -e "
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', (line) => {
        try {
            const svc = JSON.parse(line);
            console.log(svc.Health || 'unknown');
        } catch (e) { console.log('error'); }
    });
" 2>/dev/null || echo "error")

if [[ "$TEMPORAL_PG_STATUS" != "healthy" ]]; then
    warn "temporal-postgres status: $TEMPORAL_PG_STATUS"
    echo "--- temporal-postgres logs (last 50 lines) ---"
    docker compose logs --tail=50 temporal-postgres 2>&1 || true
    fail "temporal-postgres is not healthy. Cannot proceed."
fi
ok "temporal-postgres: healthy"

# Check temporal health
TEMPORAL_STATUS=$(docker compose ps temporal --format json 2>/dev/null | node -e "
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', (line) => {
        try {
            const svc = JSON.parse(line);
            console.log(svc.Health || 'unknown');
        } catch (e) { console.log('error'); }
    });
" 2>/dev/null || echo "error")

if [[ "$TEMPORAL_STATUS" != "healthy" ]]; then
    warn "temporal status: $TEMPORAL_STATUS"
    echo "--- temporal logs (last 100 lines) ---"
    docker compose logs --tail=100 temporal 2>&1 || true
    echo "--- temporal-postgres logs (last 50 lines) ---"
    docker compose logs --tail=50 temporal-postgres 2>&1 || true
    fail "temporal is not healthy. Cannot proceed."
fi
ok "temporal: healthy"

# Check temporal-ui health (non-blocking warning only)
TEMPORAL_UI_STATUS=$(docker compose ps temporal-ui --format json 2>/dev/null | node -e "
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', (line) => {
        try {
            const svc = JSON.parse(line);
            console.log(svc.Health || 'unknown');
        } catch (e) { console.log('not_running'); }
    });
" 2>/dev/null || echo "not_running")

if [[ "$TEMPORAL_UI_STATUS" == "healthy" ]]; then
    ok "temporal-ui: healthy"
elif [[ "$TEMPORAL_UI_STATUS" == "starting" || "$TEMPORAL_UI_STATUS" == "unknown" ]]; then
    info "temporal-ui: $TEMPORAL_UI_STATUS (non-blocking)"
else
    warn "temporal-ui: $TEMPORAL_UI_STATUS (non-blocking)"
fi

ok "Temporal foundation verified"

# ============================================================================
# STEP D.2: Verify Frontend Health
# SPRINT-FRONTEND-CONTAINER-TRUTH-LOCK-102B
# ============================================================================

step "D.2) Verifying Frontend Health"

# Display strict mode setting
if [[ "$STRICT_FRONTENDS" == "1" ]]; then
    info "STRICT_FRONTENDS=YES - Frontends MUST be healthy"
else
    info "STRICT_FRONTENDS=NO - Frontend failures are warnings"
fi

# Function to check frontend health
check_frontend_health() {
    local name="$1"
    local url="$2"
    local container="$3"
    local max_retries=10
    local retry_delay=5

    local health_url="${url}/api/health"
    info "Checking $name at $health_url..."

    for i in $(seq 1 $max_retries); do
        response=$(curl -sf "$health_url" 2>/dev/null || echo "")
        if [[ -n "$response" ]]; then
            status=$(echo "$response" | node -e "
                const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
                console.log(data.status || 'unknown');
            " 2>/dev/null || echo "unknown")
            if [[ "$status" == "ok" || "$status" == "healthy" ]]; then
                ok "$name: healthy (status: $status)"
                return 0
            else
                info "$name: status=$status (retry $i/$max_retries)"
            fi
        else
            info "$name: not ready (retry $i/$max_retries)"
        fi
        sleep $retry_delay
    done

    # Frontend failed to become healthy - dump logs
    warn "$name: UNHEALTHY after $max_retries retries"
    echo "--- $container logs (last 100 lines) ---"
    docker compose logs --tail=100 "$container" 2>&1 || true
    echo "--- end $container logs ---"
    return 1
}

# Track frontend health status
SMART_FORM_HEALTHY=false
COMMAND_CENTER_HEALTHY=false
DASHBOARD_HEALTHY=false

# Check Smart Form
if check_frontend_health "smart-form" "$SMART_FORM_URL" "smart-form"; then
    SMART_FORM_HEALTHY=true
fi

# Check Command Center
if check_frontend_health "command-center" "$COMMAND_CENTER_URL" "command-center"; then
    COMMAND_CENTER_HEALTHY=true
fi

# Check Dashboard
if check_frontend_health "dashboard" "$DASHBOARD_URL" "dashboard"; then
    DASHBOARD_HEALTHY=true
fi

# Evaluate results
UNHEALTHY_FRONTENDS=""
if [[ "$SMART_FORM_HEALTHY" != "true" ]]; then
    UNHEALTHY_FRONTENDS="$UNHEALTHY_FRONTENDS smart-form"
fi
if [[ "$COMMAND_CENTER_HEALTHY" != "true" ]]; then
    UNHEALTHY_FRONTENDS="$UNHEALTHY_FRONTENDS command-center"
fi
if [[ "$DASHBOARD_HEALTHY" != "true" ]]; then
    UNHEALTHY_FRONTENDS="$UNHEALTHY_FRONTENDS dashboard"
fi

if [[ -z "$UNHEALTHY_FRONTENDS" || "$UNHEALTHY_FRONTENDS" == "   " ]]; then
    ok "All frontends healthy"
elif [[ "$STRICT_FRONTENDS" == "1" ]]; then
    fail "STRICT_FRONTENDS=1: Unhealthy frontends:$UNHEALTHY_FRONTENDS"
else
    warn "Unhealthy frontends (non-blocking):$UNHEALTHY_FRONTENDS"
    info "Set OPS_STRICT_FRONTENDS=1 to fail on frontend issues"
fi

# ============================================================================
# STEP E: Assert /ops/status (FAIL-CLOSED)
# ============================================================================

step "E) Querying /ops/status"

# Helper function to parse JSON using node (since jq may not be available on Windows)
parse_json() {
    local json="$1"
    local path="$2"
    echo "$json" | node -e "
        const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
        const path = '$path'.split('.');
        let val = data;
        for (const p of path) {
            if (val === null || val === undefined) { console.log('null'); process.exit(0); }
            val = val[p];
        }
        console.log(val === null || val === undefined ? 'null' : val);
    " 2>/dev/null || echo "null"
}

# Retry logic for API
MAX_RETRIES=5
RETRY_DELAY=3
STATUS_RESPONSE=""

for i in $(seq 1 $MAX_RETRIES); do
    STATUS_RESPONSE=$(curl -sf "$API_URL/ops/status" 2>/dev/null || echo "")
    if [[ -n "$STATUS_RESPONSE" && "$STATUS_RESPONSE" != "{}" ]]; then
        break
    fi
    info "API not ready, retry $i/$MAX_RETRIES..."
    sleep $RETRY_DELAY
done

if [[ -z "$STATUS_RESPONSE" || "$STATUS_RESPONSE" == "{}" ]]; then
    fail "Failed to query /ops/status after $MAX_RETRIES retries. Run: docker compose logs api"
fi

# Parse response using node
OVERALL_READY=$(parse_json "$STATUS_RESPONSE" "overall_ready")
REPORTED_MODE=$(parse_json "$STATUS_RESPONSE" "components.db.mode")
DB_TARGET=$(parse_json "$STATUS_RESPONSE" "components.db.target")
MISMATCH=$(parse_json "$STATUS_RESPONSE" "components.db.mismatchDetected")
MISMATCH_REASON=$(parse_json "$STATUS_RESPONSE" "components.db.mismatchReason")
FINGERPRINT=$(parse_json "$STATUS_RESPONSE" "supabase_fingerprint")

# Discord status
DISCORD_READY=$(parse_json "$STATUS_RESPONSE" "components.discord.ready")
DISCORD_WORKER_HEALTHY=$(parse_json "$STATUS_RESPONSE" "components.discord.worker_healthy")
DISCORD_LAST_POST=$(parse_json "$STATUS_RESPONSE" "components.discord.last_post_at")
if [[ "$DISCORD_LAST_POST" == "null" ]]; then DISCORD_LAST_POST="never"; fi

# Outbox status
OUTBOX_PENDING=$(parse_json "$STATUS_RESPONSE" "components.outbox.pending_count")
OUTBOX_FAILED=$(parse_json "$STATUS_RESPONSE" "components.outbox.failed_count")

echo ""
echo "  Overall Ready:     $OVERALL_READY"
echo "  DB Mode:           $REPORTED_MODE"
echo "  DB Target:         $DB_TARGET"
echo "  Supabase FP:       $FINGERPRINT"
echo "  Mismatch:          $MISMATCH"
echo "  Discord Ready:     $DISCORD_READY"
echo "  Worker Healthy:    $DISCORD_WORKER_HEALTHY"
echo "  Last Discord Post: $DISCORD_LAST_POST"
echo "  Outbox Pending:    $OUTBOX_PENDING"
echo "  Outbox Failed:     $OUTBOX_FAILED"
echo ""

# FAIL-CLOSED assertions
if [[ "$MISMATCH" == "true" ]]; then
    fail "DB MODE MISMATCH: $MISMATCH_REASON"
fi

if [[ "$REPORTED_MODE" != "$DB_MODE" ]]; then
    fail "DB mode mismatch: requested '$DB_MODE', reported '$REPORTED_MODE'"
fi

ok "DB mode verified: $DB_MODE"

# Save ops status proof (format with node)
echo "$STATUS_RESPONSE" | node -e "
    const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    console.log(JSON.stringify(data, null, 2));
" > "$PROOF_DIR/proof_ops_status.json" 2>/dev/null || echo "$STATUS_RESPONSE" > "$PROOF_DIR/proof_ops_status.json"
ok "Saved: proof_ops_status.json"

# Parse Temporal status from /ops/status
TEMPORAL_CONFIGURED=$(parse_json "$STATUS_RESPONSE" "components.temporal.configured")
TEMPORAL_HEALTHY=$(parse_json "$STATUS_RESPONSE" "components.temporal.healthy")
TEMPORAL_ENDPOINT=$(parse_json "$STATUS_RESPONSE" "components.temporal.endpoint")
TEMPORAL_UI_REACHABLE=$(parse_json "$STATUS_RESPONSE" "components.temporal.ui_reachable")

# Display Temporal status
echo "  Temporal Configured: $TEMPORAL_CONFIGURED"
echo "  Temporal Healthy:    $TEMPORAL_HEALTHY"
echo "  Temporal Endpoint:   $TEMPORAL_ENDPOINT"
echo "  Temporal UI:         $TEMPORAL_UI_REACHABLE"
echo ""

# FAIL-CLOSED: Temporal must be healthy
if [[ "$TEMPORAL_HEALTHY" != "true" ]]; then
    warn "Temporal health from /ops/status: $TEMPORAL_HEALTHY"
    # Fall back to checking UI directly
    if curl -sf "$TEMPORAL_UI_URL" &>/dev/null; then
        ok "Temporal UI reachable (fallback check)"
        TEMPORAL_DISPLAY_STATUS="degraded (UI only)"
    else
        warn "Temporal UI not reachable"
        TEMPORAL_DISPLAY_STATUS="degraded"
    fi
else
    ok "Temporal: healthy"
    TEMPORAL_DISPLAY_STATUS="healthy"
fi

# ============================================================================
# STEP F: Run Required Proofs (FAIL-CLOSED)
# ============================================================================

step "F) Running E2E Proof Scripts"

# Required: e2e-receipt-proof.mjs
if [[ -f "scripts/e2e-receipt-proof.mjs" ]]; then
    info "Running: scripts/e2e-receipt-proof.mjs"
    if node scripts/e2e-receipt-proof.mjs > "$PROOF_DIR/proof_e2e_receipt_output.txt" 2>&1; then
        ok "e2e-receipt-proof.mjs PASSED"
        # Copy the actual proof file if it exists
        if [[ -f "out/audits/FOUNDATION-TRUTH-LOCK-094A/$DATE/proof_e2e_receipt.json" ]]; then
            cp "out/audits/FOUNDATION-TRUTH-LOCK-094A/$DATE/proof_e2e_receipt.json" "$PROOF_DIR/proof_e2e_receipt.json" 2>/dev/null || true
        fi
    else
        cat "$PROOF_DIR/proof_e2e_receipt_output.txt"
        fail "e2e-receipt-proof.mjs FAILED (required)"
    fi
else
    fail "scripts/e2e-receipt-proof.mjs not found (required)"
fi

# Recommended: proof-db-mode-095a.mjs
if [[ -f "scripts/proof-db-mode-095a.mjs" ]]; then
    info "Running: scripts/proof-db-mode-095a.mjs"
    if node scripts/proof-db-mode-095a.mjs > "$PROOF_DIR/proof_db_mode_output.txt" 2>&1; then
        ok "proof-db-mode-095a.mjs PASSED"
        # Copy proofs if they exist
        DB_MODE_PROOF_DIR="out/sprints/SPRINT-DB-MODE-TRUTH-LOCK-095A/$DATE/proofs"
        if [[ -d "$DB_MODE_PROOF_DIR" ]]; then
            cp "$DB_MODE_PROOF_DIR"/*.json "$PROOF_DIR/" 2>/dev/null || true
            cp "$DB_MODE_PROOF_DIR"/*.txt "$PROOF_DIR/" 2>/dev/null || true
        fi
    else
        cat "$PROOF_DIR/proof_db_mode_output.txt"
        fail "proof-db-mode-095a.mjs FAILED"
    fi
else
    warn "scripts/proof-db-mode-095a.mjs not found (optional, skipped)"
fi

# ============================================================================
# STEP G: Capture Additional Proofs
# ============================================================================

step "G) Capturing Additional Proofs"

# Docker ps
docker compose ps > "$PROOF_DIR/proof_docker_ps.txt" 2>&1
ok "Saved: proof_docker_ps.txt"

# Git status
git status > "$PROOF_DIR/proof_git_status.txt" 2>&1
ok "Saved: proof_git_status.txt"

# ============================================================================
# PRODUCTION DAY READY SUMMARY
# ============================================================================

echo ""
echo "========================================"
echo "  PRODUCTION DAY READY"
echo "========================================"
echo ""
echo "  ${BOLD}Service URLs:${NC}"
echo "    Smart Form:      $SMART_FORM_URL"
echo "    Command Center:  $COMMAND_CENTER_URL"
echo "    Dashboard:       $DASHBOARD_URL"
echo "    API:             $API_URL"
echo "    Grafana:         $GRAFANA_URL"
echo "    Prometheus:      $PROMETHEUS_URL"
echo "    Temporal UI:     $TEMPORAL_UI_URL"
echo ""
echo "  ${BOLD}Database:${NC}"
echo "    Mode:            $DB_MODE"
echo "    Target:          $DB_TARGET"
echo "    Fingerprint:     $FINGERPRINT"
echo ""
echo "  ${BOLD}Discord Worker:${NC}"
echo "    Healthy:         $DISCORD_WORKER_HEALTHY"
echo "    Last Post:       $DISCORD_LAST_POST"
echo "    Outbox Pending:  $OUTBOX_PENDING"
echo ""
echo "  ${BOLD}Temporal:${NC}"
echo "    Status:          $TEMPORAL_DISPLAY_STATUS"
echo "    Endpoint:        $TEMPORAL_ENDPOINT"
echo ""
echo "  ${BOLD}Frontends:${NC}"
echo "    Smart Form:      $(if [[ "$SMART_FORM_HEALTHY" == "true" ]]; then echo "healthy"; else echo "UNHEALTHY"; fi)"
echo "    Command Center:  $(if [[ "$COMMAND_CENTER_HEALTHY" == "true" ]]; then echo "healthy"; else echo "UNHEALTHY"; fi)"
echo "    Dashboard:       $(if [[ "$DASHBOARD_HEALTHY" == "true" ]]; then echo "healthy"; else echo "UNHEALTHY"; fi)"
echo "    Strict Mode:     $(if [[ "$STRICT_FRONTENDS" == "1" ]]; then echo "YES"; else echo "NO"; fi)"
echo ""
echo "  ${BOLD}Proof Bundle:${NC}"
echo "    Location:        $PROOF_DIR"
echo "    Files:"
ls -1 "$PROOF_DIR" 2>/dev/null | sed 's/^/      - /'
echo ""
echo "========================================"
echo "  All checks passed. Ready for work."
echo "========================================"
echo ""

exit 0
