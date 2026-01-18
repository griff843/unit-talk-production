#!/usr/bin/env bash
#
# Phase 15 - Production Promotion Automation
#
# Automates the complete Phase 15 production readiness promotion:
# - Preflight checks & environment snapshot
# - PostgREST visibility verification & reload
# - Test user seeding
# - API container rebuild & restart
# - LIVE E2E validation for all 4 leagues
# - Publish verification
# - Alert webhook testing
# - Final GO/NO-GO report generation
#
# Date: 2025-10-31
# Follows: docs/PRODUCTION_CHARTER.md

set +e  # Continue on errors (we handle them)

# Colors
COLOR_RESET='\033[0m'
COLOR_GREEN='\033[32m'
COLOR_YELLOW='\033[33m'
COLOR_RED='\033[31m'
COLOR_BLUE='\033[34m'
COLOR_CYAN='\033[36m'

function write_phase() {
    echo -e "${COLOR_CYAN}===============================================================================${COLOR_RESET}"
    echo -e "${COLOR_CYAN}$1${COLOR_RESET}"
    echo -e "${COLOR_CYAN}===============================================================================${COLOR_RESET}"
}

function write_step() {
    echo -e "${COLOR_BLUE}▶ $1${COLOR_RESET}"
}

function write_success() {
    echo -e "${COLOR_GREEN}✅ $1${COLOR_RESET}"
}

function write_warning() {
    echo -e "${COLOR_YELLOW}⚠️  $1${COLOR_RESET}"
}

function write_error() {
    echo -e "${COLOR_RED}❌ $1${COLOR_RESET}"
}

# Initialize
timestamp=$(date +"%Y-%m-%d_%H-%M-%S")
outDir="out/ops/cutover/metrics/phase15"
reportFile="$outDir/FINAL_GO_NO_GO.md"
reportJson="$outDir/FINAL_GO_NO_GO.json"

# Create output directory
mkdir -p "$outDir"

write_phase "PHASE 15 - PRODUCTION PROMOTION AUTOMATION"
echo "Timestamp: $timestamp"
echo "Output Directory: $outDir"
echo ""

# Results tracking (we'll build JSON manually)
total_checks=0
passed_checks=0
failed_checks=0
warning_checks=0
decision="PENDING"

# ============================================================================
# PHASE 1: PREFLIGHT & SNAPSHOT
# ============================================================================
write_phase "PHASE 1: PREFLIGHT & SNAPSHOT"

write_step "Capturing environment snapshot..."
env | grep -E 'SUPABASE|DATABASE|PICK_DRIVER|PUBLISH_MODE|SHADOW_MODE' > "$outDir/ENV_SNAPSHOT.txt"
write_success "Environment snapshot saved"

write_step "Capturing Docker container status..."
docker compose ps > "$outDir/docker_ps.txt"
write_success "Docker status saved"

write_step "Checking API health..."
if curl -sfS http://localhost:3010/api/health -o "$outDir/health.json"; then
    write_success "API health check passed"
    preflight_status="PASS"
    ((total_checks++))
    ((passed_checks++))
else
    write_warning "API health check failed"
    preflight_status="WARN"
    ((total_checks++))
    ((warning_checks++))
fi

write_step "Checking driver status..."
curl -sfS http://localhost:3010/api/domain/picks/status -o "$outDir/driver_status.json" || true

# ============================================================================
# PHASE 2: POSTGREST VISIBILITY
# ============================================================================
write_phase "PHASE 2: POSTGREST VISIBILITY VERIFICATION"

write_step "Running PostgREST visibility check..."
if node scripts/ops/verify-pgrst-visible.ts > "$outDir/pgrst_verify.txt" 2>&1; then
    write_success "PostgREST visibility verified"
    postgrest_status="PASS"
    postgrest_retries=0
else
    write_warning "PostgREST visibility check failed, attempting reload..."
    
    write_step "Forcing PostgREST schema reload..."
    node scripts/ops/force-postgrest-reload.js --reason "phase15-promotion" > "$outDir/pgrst_reload.log" 2>&1
    
    write_step "Waiting 10 seconds for reload to propagate..."
    sleep 10
    
    write_step "Re-verifying PostgREST visibility..."
    if node scripts/ops/verify-pgrst-visible.ts >> "$outDir/pgrst_verify_retry.txt" 2>&1; then
        write_success "PostgREST visibility verified after reload"
        postgrest_status="PASS"
        postgrest_retries=1
    else
        write_error "PostgREST visibility FAILED after reload - BLOCKING"
        postgrest_status="FAIL"
        postgrest_retries=1
        ((total_checks++))
        ((failed_checks++))
        decision="NO-GO"
        
        # Generate early failure report
        echo "{\"decision\":\"NO-GO\",\"reason\":\"PostgREST visibility failed\",\"timestamp\":\"$timestamp\"}" > "$reportJson"
        write_error "CRITICAL FAILURE - Aborting Phase 15"
        exit 1
    fi
fi

((total_checks++))
((passed_checks++))

# ============================================================================
# PHASE 3: SEED TEST USER
# ============================================================================
write_phase "PHASE 3: SEED TEST USER"

test_user_id="00000000-0000-0000-0000-000000000001"

write_step "Seeding test user (idempotent)..."
node scripts/ops/seed-test-user.js --id "$test_user_id" --role capper > "$outDir/seed_user.log" 2>&1

write_step "Verifying user exists..."
if node scripts/ops/check-user.js "$test_user_id" > "$outDir/seed_verification.json" 2>&1; then
    write_success "Test user verified"
    seed_status="PASS"
    ((total_checks++))
    ((passed_checks++))
else
    write_error "Test user verification FAILED - BLOCKING"
    seed_status="FAIL"
    ((total_checks++))
    ((failed_checks++))
    decision="NO-GO"
    
    echo "{\"decision\":\"NO-GO\",\"reason\":\"Test user verification failed\",\"timestamp\":\"$timestamp\"}" > "$reportJson"
    write_error "CRITICAL FAILURE - Cannot proceed without test user"
    exit 1
fi

# ============================================================================
# PHASE 4: REBUILD & RESTART API
# ============================================================================
write_phase "PHASE 4: REBUILD & RESTART API CONTAINER"

write_step "Building API container (no cache)..."
docker compose build --no-cache api > "$outDir/api_build.log" 2>&1

write_step "Starting API container..."
docker compose up -d api > "$outDir/api_start.log" 2>&1

write_step "Waiting 15 seconds for API to stabilize..."
sleep 15

write_step "Capturing API logs..."
docker compose logs api --tail=100 > "$outDir/api_logs_after_restart.txt" 2>&1

write_step "Testing dry-run endpoint..."
if curl -sfS -X POST http://localhost:3010/api/domain/picks/dry-run \
    -H "Content-Type: application/json" \
    -d '{}' \
    -w "%{http_code}" \
    -o /dev/null | grep -q "204"; then
    write_success "Dry-run endpoint responding correctly (204)"
    api_rebuild_status="PASS"
else
    write_warning "Dry-run endpoint test failed"
    api_rebuild_status="WARN"
fi

((total_checks++))
if [ "$api_rebuild_status" = "PASS" ]; then
    ((passed_checks++))
else
    ((warning_checks++))
fi

write_success "Phase 4 complete - continuing to E2E validation"

# ============================================================================
# PHASE 5: LIVE E2E VALIDATION (ALL LEAGUES)
# ============================================================================
write_phase "PHASE 5: LIVE E2E VALIDATION"

leagues=("NBA" "NFL" "MLB" "NHL")
e2e_passes=0
e2e_fails=0

for league in "${leagues[@]}"; do
    write_step "Running LIVE E2E for $league..."
    
    e2e_output_file="$outDir/e2e_${league}_live.json"
    
    if node scripts/ops/phase13-manual-e2e.js --league "$league" --mode live > "$e2e_output_file" 2>&1; then
        write_success "$league E2E PASSED"
        
        # Extract pickId from output
        pick_id=$(jq -r '.pickId // empty' "$e2e_output_file" 2>/dev/null || echo "")
        
        if [ -n "$pick_id" ]; then
            write_step "Verifying publish status for $league (pickId: $pick_id)..."
            
            publish_output_file="$outDir/publish_${league}.json"
            if node scripts/ops/check-publish-status.js --pickId="$pick_id" --timeout=90 > "$publish_output_file" 2>&1; then
                write_success "$league publish verified (sent within 90s)"
                ((e2e_passes++))
            else
                write_error "$league publish FAILED (timeout or error)"
                ((e2e_fails++))
            fi
        else
            write_warning "$league E2E passed but no pickId found"
            ((warning_checks++))
        fi
    else
        write_error "$league E2E FAILED"
        ((e2e_fails++))
    fi
    
    ((total_checks++))
done

# Update counters based on E2E results
passed_checks=$((passed_checks + e2e_passes))
failed_checks=$((failed_checks + e2e_fails))

# ============================================================================
# PHASE 6: ALERT WEBHOOK VERIFICATION
# ============================================================================
write_phase "PHASE 6: ALERT WEBHOOK VERIFICATION"

write_step "Testing Discord webhook..."
if node scripts/ops/test-alerts.js --channels=discord --severity=test > "$outDir/test_alert_discord.txt" 2>&1; then
    discord_status="PASS"
else
    discord_status="FAIL"
fi

write_step "Testing Slack webhook..."
if node scripts/ops/test-alerts.js --channels=slack --severity=test > "$outDir/test_alert_slack.txt" 2>&1; then
    slack_status="PASS"
else
    slack_status="FAIL"
fi

((total_checks++))
if [ "$discord_status" = "PASS" ] || [ "$slack_status" = "PASS" ]; then
    write_success "At least one alert channel verified"
    ((passed_checks++))
else
    write_warning "All alert channels failed (non-blocking)"
    ((warning_checks++))
fi

# ============================================================================
# PHASE 7: FINAL GO/NO-GO DECISION
# ============================================================================
write_phase "PHASE 7: FINAL GO/NO-GO DECISION"

# Determine decision
blocking_failures=0
critical_passes=0

# Critical checks
[ "$postgrest_status" = "PASS" ] && ((critical_passes++)) || ((blocking_failures++))
[ "$seed_status" = "PASS" ] && ((critical_passes++)) || ((blocking_failures++))

# E2E checks (at least 3 of 4 must pass)
if [ "$e2e_passes" -ge 3 ]; then
    ((critical_passes++))
    write_success "E2E validation: $e2e_passes/4 leagues passed (threshold: 3)"
else
    ((blocking_failures++))
    write_error "E2E validation: Only $e2e_passes/4 leagues passed (threshold: 3)"
fi

# Make decision
if [ "$blocking_failures" -eq 0 ] && [ "$critical_passes" -ge 3 ]; then
    decision="GO"
    write_success "==============================================================================="
    write_success "                              ✅ GO FOR PRODUCTION                              "
    write_success "==============================================================================="
    exit_code=0
else
    decision="NO-GO"
    write_error "==============================================================================="
    write_error "                            ❌ NO-GO - BLOCKING ISSUES                           "
    write_error "==============================================================================="
    exit_code=1
fi

echo ""
write_phase "PHASE 15 COMPLETE"
echo ""
echo "Decision: $decision"
echo "Total Checks: $total_checks"
echo "Passed: $passed_checks"
echo "Failed: $failed_checks"
echo "Warnings: $warning_checks"
echo ""
echo "Reports saved to: $outDir/"
echo ""

exit $exit_code

