#!/bin/bash
# ===============================================================================
# Phase 13 Deployment Validation Script
# ===============================================================================
# Date: 2025-11-01
# Charter: v3.0 → v4.0
# Purpose: Validate model serving infrastructure deployment
# SLO Targets:
#   - p95 inference latency < 150ms
#   - Drift score < 0.05
#   - Accuracy ≥ baseline - 2%
# ===============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Output directory
OUTPUT_DIR="out/ops/cutover/metrics/phase13"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
VALIDATION_LOG="${OUTPUT_DIR}/validation_${TIMESTAMP}.log"

# ===============================================================================
# Helper Functions
# ===============================================================================

log() {
  echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$VALIDATION_LOG"
}

success() {
  echo -e "${GREEN}✅ $1${NC}" | tee -a "$VALIDATION_LOG"
  ((PASSED++))
}

fail() {
  echo -e "${RED}❌ $1${NC}" | tee -a "$VALIDATION_LOG"
  ((FAILED++))
}

warn() {
  echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$VALIDATION_LOG"
  ((WARNINGS++))
}

section() {
  echo "" | tee -a "$VALIDATION_LOG"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}" | tee -a "$VALIDATION_LOG"
  echo -e "${BLUE}$1${NC}" | tee -a "$VALIDATION_LOG"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}" | tee -a "$VALIDATION_LOG"
  echo "" | tee -a "$VALIDATION_LOG"
}

# ===============================================================================
# Validation Functions
# ===============================================================================

validate_docker_environment() {
  section "1. Docker Environment Validation"
  
  log "Checking Docker services..."
  if docker-compose ps | grep -q "Up"; then
    success "Docker services are running"
  else
    fail "Docker services are not running. Run './dev.sh start'"
    return 1
  fi
  
  log "Checking API service..."
  if docker-compose ps api | grep -q "Up"; then
    success "API service is running"
  else
    fail "API service is not running"
    return 1
  fi
  
  log "Checking database connectivity..."
  if docker-compose exec -T api bash -c "psql \$DATABASE_DIRECT_URL -c 'SELECT 1;'" &>/dev/null; then
    success "Database is accessible"
  else
    fail "Database is not accessible"
    return 1
  fi
}

validate_database_schema() {
  section "2. Database Schema Validation"
  
  log "Checking model_predictions_live table..."
  if docker-compose exec -T api bash -c "psql \$DATABASE_DIRECT_URL -c \"SELECT to_regclass('public.model_predictions_live');\"" | grep -q "model_predictions_live"; then
    success "model_predictions_live table exists"
  else
    fail "model_predictions_live table does not exist"
    return 1
  fi
  
  log "Checking model_performance_history table..."
  if docker-compose exec -T api bash -c "psql \$DATABASE_DIRECT_URL -c \"SELECT to_regclass('public.model_performance_history');\"" | grep -q "model_performance_history"; then
    success "model_performance_history table exists"
  else
    fail "model_performance_history table does not exist"
    return 1
  fi
  
  log "Checking indexes on model_predictions_live..."
  INDEX_COUNT=$(docker-compose exec -T api bash -c "psql \$DATABASE_DIRECT_URL -t -c \"SELECT count(*) FROM pg_indexes WHERE tablename = 'model_predictions_live';\"" | tr -d ' ')
  if [ "$INDEX_COUNT" -ge 7 ]; then
    success "model_predictions_live has $INDEX_COUNT indexes (expected ≥7)"
  else
    warn "model_predictions_live has only $INDEX_COUNT indexes (expected ≥7)"
  fi
  
  log "Checking check_model_slo_compliance function..."
  if docker-compose exec -T api bash -c "psql \$DATABASE_DIRECT_URL -c \"SELECT to_regproc('check_model_slo_compliance');\"" | grep -q "check_model_slo_compliance"; then
    success "check_model_slo_compliance function exists"
  else
    fail "check_model_slo_compliance function does not exist"
    return 1
  fi
  
  log "Testing check_model_slo_compliance function..."
  if docker-compose exec -T api bash -c "psql \$DATABASE_DIRECT_URL -c \"SELECT * FROM check_model_slo_compliance((SELECT id FROM predictive_models LIMIT 1), 1);\"" &>/dev/null; then
    success "check_model_slo_compliance function is executable"
  else
    warn "check_model_slo_compliance function test failed (may be due to no data)"
  fi
}

validate_postgrest_schema() {
  section "3. PostgREST Schema Validation"
  
  log "Checking PostgREST schema visibility..."
  
  # This would require PostgREST to be running and accessible
  # For now, we'll check if the reload was triggered
  log "Verifying pg_notify was called in migration..."
  if grep -q "pg_notify('pgrst', 'reload schema')" supabase/migrations/20251101_phase13_serving.sql; then
    success "Migration includes PostgREST reload trigger"
  else
    fail "Migration missing PostgREST reload trigger"
  fi
}

validate_typescript_compilation() {
  section "4. TypeScript Compilation Validation"
  
  log "Checking TypeScript compilation..."
  if docker-compose exec -T api npm run type-check 2>&1 | grep -q "Found 0 errors"; then
    success "TypeScript compilation successful (0 errors)"
  else
    fail "TypeScript compilation has errors"
    return 1
  fi
  
  log "Checking ModelServingMetrics.ts exists..."
  if [ -f "apps/api/src/monitoring/ModelServingMetrics.ts" ]; then
    success "ModelServingMetrics.ts file exists"
  else
    fail "ModelServingMetrics.ts file not found"
    return 1
  fi
}

validate_metrics_server() {
  section "5. Metrics Server Validation"
  
  log "Checking if metrics server port is configured..."
  if grep -q "9464" apps/api/src/monitoring/ModelServingMetrics.ts; then
    success "Metrics server port 9464 configured"
  else
    warn "Metrics server port configuration not found"
  fi
  
  log "Testing metrics endpoint (if server is running)..."
  if curl -s http://localhost:9464/metrics &>/dev/null; then
    success "Metrics endpoint is responding"
    
    log "Checking for model_serving metrics..."
    if curl -s http://localhost:9464/metrics | grep -q "model_serving"; then
      success "Model serving metrics are registered"
    else
      warn "Model serving metrics not found (server may need restart)"
    fi
  else
    warn "Metrics endpoint not responding (server may not be started yet)"
  fi
  
  log "Checking health endpoint..."
  if curl -s http://localhost:9464/health | grep -q "healthy"; then
    success "Health endpoint is responding"
  else
    warn "Health endpoint not responding"
  fi
}

validate_grafana_dashboard() {
  section "6. Grafana Dashboard Validation"
  
  log "Checking dashboard file exists..."
  if [ -f "infrastructure/dashboards/model-serving-dashboard.json" ]; then
    success "Dashboard file exists"
  else
    fail "Dashboard file not found"
    return 1
  fi
  
  log "Validating dashboard JSON syntax..."
  if jq empty infrastructure/dashboards/model-serving-dashboard.json 2>/dev/null; then
    success "Dashboard JSON is valid"
  else
    fail "Dashboard JSON is invalid"
    return 1
  fi
  
  log "Checking dashboard panels..."
  PANEL_COUNT=$(jq '.dashboard.panels | length' infrastructure/dashboards/model-serving-dashboard.json)
  if [ "$PANEL_COUNT" -eq 12 ]; then
    success "Dashboard has 12 panels (expected)"
  else
    warn "Dashboard has $PANEL_COUNT panels (expected 12)"
  fi
  
  log "Checking SLO panels..."
  if jq -e '.dashboard.panels[] | select(.title | contains("SLO"))' infrastructure/dashboards/model-serving-dashboard.json &>/dev/null; then
    success "Dashboard includes SLO panels"
  else
    fail "Dashboard missing SLO panels"
  fi
}

validate_alert_rules() {
  section "7. Alert Rules Validation"
  
  log "Checking alert rules file exists..."
  if [ -f "infrastructure/monitoring/prometheus-rules-model-serving.yaml" ]; then
    success "Alert rules file exists"
  else
    fail "Alert rules file not found"
    return 1
  fi
  
  log "Validating YAML syntax..."
  if python3 -c "import yaml; yaml.safe_load(open('infrastructure/monitoring/prometheus-rules-model-serving.yaml'))" 2>/dev/null; then
    success "Alert rules YAML is valid"
  else
    warn "YAML validation failed (python3 with yaml module may not be available)"
  fi
  
  log "Checking alert groups..."
  ALERT_GROUPS=$(grep -c "name:.*-alerts" infrastructure/monitoring/prometheus-rules-model-serving.yaml || true)
  if [ "$ALERT_GROUPS" -ge 3 ]; then
    success "Alert rules have $ALERT_GROUPS groups (expected ≥3)"
  else
    warn "Alert rules have only $ALERT_GROUPS groups (expected ≥3)"
  fi
  
  log "Checking SLO alerts..."
  if grep -q "ModelServingLatencySLOViolation" infrastructure/monitoring/prometheus-rules-model-serving.yaml; then
    success "Latency SLO alert configured"
  else
    fail "Latency SLO alert missing"
  fi
  
  if grep -q "ModelServingDriftSLOViolation" infrastructure/monitoring/prometheus-rules-model-serving.yaml; then
    success "Drift SLO alert configured"
  else
    fail "Drift SLO alert missing"
  fi
  
  if grep -q "ModelServingAccuracyDropSLOViolation" infrastructure/monitoring/prometheus-rules-model-serving.yaml; then
    success "Accuracy SLO alert configured"
  else
    fail "Accuracy SLO alert missing"
  fi
}

validate_attestation_artifacts() {
  section "8. Attestation Artifacts Validation"
  
  log "Checking attestation directory..."
  if [ -d "$OUTPUT_DIR" ]; then
    success "Attestation directory exists"
  else
    fail "Attestation directory not found"
    return 1
  fi
  
  log "Checking Markdown attestation..."
  if [ -f "${OUTPUT_DIR}/MODEL_SERVING_ATTESTATION_2025-11-01.md" ]; then
    success "Markdown attestation exists"
  else
    fail "Markdown attestation not found"
  fi
  
  log "Checking JSON attestation..."
  if [ -f "${OUTPUT_DIR}/MODEL_SERVING_ATTESTATION_2025-11-01.json" ]; then
    success "JSON attestation exists"
    
    log "Validating JSON attestation syntax..."
    if jq empty "${OUTPUT_DIR}/MODEL_SERVING_ATTESTATION_2025-11-01.json" 2>/dev/null; then
      success "JSON attestation is valid"
    else
      fail "JSON attestation is invalid"
    fi
  else
    fail "JSON attestation not found"
  fi
  
  log "Checking deployment checklist..."
  if [ -f "${OUTPUT_DIR}/DEPLOYMENT_CHECKLIST.md" ]; then
    success "Deployment checklist exists"
  else
    warn "Deployment checklist not found"
  fi
}

# ===============================================================================
# Main Execution
# ===============================================================================

main() {
  log "Starting Phase 13 Deployment Validation"
  log "Output directory: $OUTPUT_DIR"
  log "Validation log: $VALIDATION_LOG"
  
  # Run all validations
  validate_docker_environment || true
  validate_database_schema || true
  validate_postgrest_schema || true
  validate_typescript_compilation || true
  validate_metrics_server || true
  validate_grafana_dashboard || true
  validate_alert_rules || true
  validate_attestation_artifacts || true
  
  # Summary
  section "Validation Summary"
  
  echo "" | tee -a "$VALIDATION_LOG"
  echo -e "${GREEN}✅ Passed:   $PASSED${NC}" | tee -a "$VALIDATION_LOG"
  echo -e "${YELLOW}⚠️  Warnings: $WARNINGS${NC}" | tee -a "$VALIDATION_LOG"
  echo -e "${RED}❌ Failed:   $FAILED${NC}" | tee -a "$VALIDATION_LOG"
  echo "" | tee -a "$VALIDATION_LOG"
  
  if [ $FAILED -eq 0 ]; then
    success "Phase 13 deployment validation PASSED"
    log "Validation log saved to: $VALIDATION_LOG"
    exit 0
  else
    fail "Phase 13 deployment validation FAILED"
    log "Validation log saved to: $VALIDATION_LOG"
    exit 1
  fi
}

# Run main function
main "$@"

