#!/usr/bin/env bash
# Self-Heal and Validate Wrapper for Canonical Picks
# Date: 2025-01-28
# Author: Unit Talk Engineering
# Version: 1.0.0

set -euo pipefail

# ============================================================================
# CONSTANTS
# ============================================================================

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARTIFACTS_DIR="out/ops/cutover/metrics/100"
REPORT_FILE="$ARTIFACTS_DIR/SELF_HEAL_VALIDATION_$TIMESTAMP.md"

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

log_status() {
    echo -e "\033[36m[$(date +%H:%M:%S)] 🔵 $1\033[0m"
}

log_success() {
    echo -e "\033[32m[$(date +%H:%M:%S)] ✅ $1\033[0m"
}

log_failure() {
    echo -e "\033[31m[$(date +%H:%M:%S)] ❌ $1\033[0m"
}

log_warning() {
    echo -e "\033[33m[$(date +%H:%M:%S)] ⚠️  $1\033[0m"
}

# ============================================================================
# PRE-CHECKS
# ============================================================================

log_status "Starting Self-Heal and Validation Flow"
log_status "Timestamp: $TIMESTAMP"
echo ""

# Create artifacts directory
mkdir -p "$ARTIFACTS_DIR"

# Check environment
log_status "Environment Pre-Checks"
echo "  Node: $(node --version)"
echo "  Bash: $BASH_VERSION"
echo ""

# Mask secrets
for var in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY DISCORD_TOKEN DEFAULT_TENANT_ID PICK_DRIVER PUBLISH_MODE SHADOW_MODE; do
    val="${!var:-}"
    if [[ -n "$val" ]]; then
        if [[ "$var" =~ KEY|TOKEN ]]; then
            echo "  $var = ${val:0:10}***"
        else
            echo "  $var = $val"
        fi
    else
        log_warning "  $var = NOT SET"
    fi
done
echo ""

# ============================================================================
# STEP 1: FORCE POSTGREST RELOAD
# ============================================================================

log_status "Step 1: Force PostgREST Reload"
reload_attempts=0
max_reload_attempts=2

for ((i=0; i<max_reload_attempts; i++)); do
    ((reload_attempts++))
    log_status "  Reload attempt $reload_attempts/$max_reload_attempts"
    
    if node scripts/ops/force-postgrest-reload.js --reason "self-heal-validation"; then
        log_success "  PostgREST reload successful"
        break
    else
        log_warning "  Reload attempt $reload_attempts failed"
    fi
    
    if ((i < max_reload_attempts - 1)); then
        log_status "  Waiting 5 seconds before retry..."
        sleep 5
    fi
done
echo ""

# ============================================================================
# STEP 2: VERIFY SCHEMA VISIBILITY
# ============================================================================

log_status "Step 2: Verify Schema Visibility"
visibility_attempts=0
max_visibility_attempts=2

for ((i=0; i<max_visibility_attempts; i++)); do
    ((visibility_attempts++))
    log_status "  Visibility check attempt $visibility_attempts/$max_visibility_attempts"
    
    if npx tsx scripts/ops/verify-pgrst-visible.ts; then
        log_success "  Schema visibility confirmed"
        break
    else
        log_warning "  Visibility check $visibility_attempts failed"
    fi
    
    if ((i < max_visibility_attempts - 1)); then
        log_status "  Waiting 10 seconds for schema propagation..."
        sleep 10
    fi
done

if ! npx tsx scripts/ops/verify-pgrst-visible.ts 2>/dev/null; then
    log_failure "Schema visibility check failed after $visibility_attempts attempts"
    echo ""
    echo "Remediation Required:"
    echo "  1. Check Supabase Dashboard for PostgREST status"
    echo "  2. Manually restart PostgREST if needed"
    echo "  3. Re-run this script"
    echo ""
    exit 1
fi
echo ""

# ============================================================================
# STEP 3: START/VERIFY STACK
# ============================================================================

log_status "Step 3: Start/Verify Stack"
log_status "  Starting services via ./dev.sh start"

if ./dev.sh start; then
    sleep 5
else
    log_warning "  Stack start command failed (may already be running)"
fi

log_status "  Checking health endpoints"
for endpoint in "http://localhost:3010/api/health" "http://localhost:3010/api/domain/picks/preflight" "http://localhost:3010/api/domain/picks/status"; do
    if curl -sf "$endpoint" > /dev/null; then
        log_success "  $(basename $endpoint): OK"
    else
        log_failure "  $(basename $endpoint): FAILED"
    fi
done
echo ""

# ============================================================================
# STEP 4: RUN E2E VALIDATION
# ============================================================================

log_status "Step 4: Run Industry-Standard E2E Validation"
log_status "  Executing: scripts/ops/industry-standard-e2e-validation.sh"
echo ""

validation_exit_code=0
if bash scripts/ops/industry-standard-e2e-validation.sh; then
    validation_exit_code=0
else
    validation_exit_code=$?
    log_failure "  E2E validation script failed with exit code: $validation_exit_code"
fi
echo ""

# ============================================================================
# STEP 5: COLLECT ARTIFACTS
# ============================================================================

log_status "Step 5: Collect Artifacts"
artifacts=()

for pattern in "*attestation*.json" "*attestation*.md" "FINAL_GO_NO_GO_canonical_*.md" "SELF_HEAL_VALIDATION_*.md" "CLAUDE_CODE_ATTESTATION*.md"; do
    while IFS= read -r -d '' file; do
        artifacts+=("$file")
        log_success "  Found: $(basename "$file")"
    done < <(find "$ARTIFACTS_DIR" -name "$pattern" -print0 2>/dev/null)
done

if [[ ${#artifacts[@]} -eq 0 ]]; then
    log_warning "  No artifacts found in $ARTIFACTS_DIR"
fi
echo ""

# ============================================================================
# STEP 6: GENERATE SUMMARY REPORT
# ============================================================================

log_status "Step 6: Generate Summary Report"

cat > "$REPORT_FILE" <<EOF
# Self-Heal and Validation Report
**Date:** $(date '+%Y-%m-%d %H:%M:%S')
**Timestamp:** $TIMESTAMP

## Self-Heal Summary
- **PostgREST Reload Attempts:** $reload_attempts
- **Schema Visibility Attempts:** $visibility_attempts
- **Stack Start:** Completed
- **Health Checks:** See details above

## E2E Validation Result
- **Exit Code:** $validation_exit_code
- **Status:** $(if [[ $validation_exit_code -eq 0 ]]; then echo "✅ GO"; else echo "❌ NO-GO"; fi)

## Artifacts Collected
$(if [[ ${#artifacts[@]} -gt 0 ]]; then
    for artifact in "${artifacts[@]}"; do
        echo "- $artifact"
    done
else
    echo "- No artifacts found"
fi)

## Next Actions
$(if [[ $validation_exit_code -eq 0 ]]; then
    echo "✅ All validations passed. System is GO for production."
else
    echo "❌ Validation failed. Review artifacts and logs for remediation."
fi)
EOF

log_success "  Report saved: $REPORT_FILE"
echo ""

# ============================================================================
# FINAL OUTPUT
# ============================================================================

echo "================================================================================"
if [[ $validation_exit_code -eq 0 ]]; then
    log_success "SELF-HEAL AND VALIDATION: ✅ GO"
else
    log_failure "SELF-HEAL AND VALIDATION: ❌ NO-GO"
fi
echo "================================================================================"
echo ""

echo "Summary Report: $REPORT_FILE"
echo "Artifacts Directory: $ARTIFACTS_DIR"
echo ""

exit $validation_exit_code

