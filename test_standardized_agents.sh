#!/bin/bash
# test_standardized_agents.sh
# Comprehensive test script for standardized agents and the 25-Point Model

set -e  # Exit on any error
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"  # Ensure we're in the script directory

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Counters for summary
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run tests with proper output
run_test() {
  local test_name=$1
  local test_command=$2
  
  echo -e "${BLUE}Running test: ${CYAN}$test_name${NC}"
  echo -e "${YELLOW}Command: $test_command${NC}"
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  if eval "$test_command"; then
    echo -e "${GREEN}✓ Test passed: $test_name${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    return 0
  else
    echo -e "${RED}✗ Test failed: $test_name${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    return 1
  fi
}

# Function to print section headers
print_header() {
  echo
  echo -e "${BLUE}======================================================${NC}"
  echo -e "${BLUE}== $1${NC}"
  echo -e "${BLUE}======================================================${NC}"
  echo
}

# Check if npm and node are installed
if ! command -v npm &> /dev/null; then
  echo -e "${RED}Error: npm is not installed. Please install Node.js and npm.${NC}"
  exit 1
fi

# Install dependencies if needed
print_header "Installing dependencies"
npm install

# Create test results directory
RESULTS_DIR="test_results"
mkdir -p "$RESULTS_DIR"

# 1. Test BaseAgent implementation
print_header "Testing BaseAgent Implementation"
run_test "BaseAgent Unit Tests" "npm test -- --testPathPattern=src/agents/BaseAgent --json > $RESULTS_DIR/baseagent_unit.json"

# 2. Test each standardized agent
print_header "Testing Standardized Agents"

# IngestionAgent
run_test "IngestionAgent Unit Tests" "npm test -- --testPathPattern=src/agents/IngestionAgent --json > $RESULTS_DIR/ingestionagent_unit.json"

# FinalizerAgent
run_test "FinalizerAgent Unit Tests" "npm test -- --testPathPattern=src/agents/FinalizerAgent --json > $RESULTS_DIR/finalizeragent_unit.json"

# PromoAgent
run_test "PromoAgent Unit Tests" "npm test -- --testPathPattern=src/agents/PromoAgent --json > $RESULTS_DIR/promoagent_unit.json"

# PromotionAgent
run_test "PromotionAgent Unit Tests" "npm test -- --testPathPattern=src/agents/PromotionAgent --json > $RESULTS_DIR/promotionagent_unit.json"

# RecapAgent
run_test "RecapAgent Unit Tests" "npm test -- --testPathPattern=src/agents/RecapAgent --json > $RESULTS_DIR/recapagent_unit.json"

# ReferralAgent
run_test "ReferralAgent Unit Tests" "npm test -- --testPathPattern=src/agents/ReferralAgent --json > $RESULTS_DIR/referralagent_unit.json"

# 3. Test 25-Point Model Implementation
print_header "Testing 25-Point Model Implementation"

# GradingAgent
run_test "GradingAgent Unit Tests" "npm test -- --testPathPattern=src/agents/GradingAgent --json > $RESULTS_DIR/gradingagent_unit.json"

# Test specific 25-Point Model components
run_test "Margin Adjustment Tests" "npm test -- --testPathPattern=src/agents/GradingAgent/scoring/marginAdjustment --json > $RESULTS_DIR/margin_adjustment.json"
run_test "Contextual Bonus Tests" "npm test -- --testPathPattern=src/agents/GradingAgent/scoring/contextualBonus --json > $RESULTS_DIR/contextual_bonus.json"
run_test "Penalty Calculations Tests" "npm test -- --testPathPattern=src/agents/GradingAgent/scoring/penaltyCalculations --json > $RESULTS_DIR/penalty_calculations.json"
run_test "Volatility Models Tests" "npm test -- --testPathPattern=src/agents/GradingAgent/scoring/volatilityModels --json > $RESULTS_DIR/volatility_models.json"

# 4. Test Temporal Workflows
print_header "Testing Temporal Workflows"
run_test "Ingestion Workflow Tests" "npm test -- --testPathPattern=src/workflows/ingestion.workflow --json > $RESULTS_DIR/ingestion_workflow.json"
run_test "Finalization Workflow Tests" "npm test -- --testPathPattern=src/workflows/finalization.workflow --json > $RESULTS_DIR/finalization_workflow.json"
run_test "Referral Workflow Tests" "npm test -- --testPathPattern=src/workflows/referral.workflow --json > $RESULTS_DIR/referral_workflow.json"
run_test "General Workflow Tests" "npm test -- --testPathPattern=src/workflows/index --json > $RESULTS_DIR/general_workflow.json"

# 5. Run integration tests if available
print_header "Running Integration Tests"
if [ -d "src/test/integration" ]; then
  run_test "Integration Tests" "npm run test:integration -- --json > $RESULTS_DIR/integration_tests.json"
else
  echo -e "${YELLOW}No integration tests directory found. Skipping integration tests.${NC}"
fi

# 6. Type checking
print_header "Running Type Checking"
run_test "TypeScript Type Checking" "npm run type-check"

# 7. Linting
print_header "Running Linter"
run_test "ESLint" "npm run lint"

# 8. Verify agent standardization
print_header "Verifying Agent Standardization"

# Check if each agent properly extends BaseAgent
echo "Checking agent inheritance patterns..."
AGENTS=("IngestionAgent" "FinalizerAgent" "PromoAgent" "PromotionAgent" "RecapAgent" "ReferralAgent")
for agent in "${AGENTS[@]}"; do
  if grep -q "export class $agent extends BaseAgent" "src/agents/$agent/index.ts" 2>/dev/null; then
    echo -e "${GREEN}✓ $agent correctly extends BaseAgent${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    echo -e "${RED}✗ $agent does not properly extend BaseAgent${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
done

# Check for required lifecycle methods
echo "Checking for required lifecycle methods..."
METHODS=("initialize" "process" "cleanup" "checkHealth" "collectMetrics")
for agent in "${AGENTS[@]}"; do
  for method in "${METHODS[@]}"; do
    if grep -q "protected async $method()" "src/agents/$agent/index.ts" 2>/dev/null; then
      echo -e "${GREEN}✓ $agent implements $method${NC}"
      PASSED_TESTS=$((PASSED_TESTS + 1))
    else
      echo -e "${RED}✗ $agent is missing $method implementation${NC}"
      FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
  done
done

# Check for Temporal workflow integration
echo "Checking for Temporal workflow integration..."
if grep -q "referralActivities\|finalizerActivities\|ingestionActivities\|promotionActivities\|recapActivities\|promoActivities" "src/workflows/index.ts" 2>/dev/null; then
  echo -e "${GREEN}✓ Workflows properly integrate standardized agents${NC}"
  PASSED_TESTS=$((PASSED_TESTS + 1))
else
  echo -e "${RED}✗ Workflows do not properly integrate standardized agents${NC}"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# 9. Generate test summary
print_header "Test Summary"
echo -e "${CYAN}Total tests: $TOTAL_TESTS${NC}"
echo -e "${GREEN}Passed tests: $PASSED_TESTS${NC}"
echo -e "${RED}Failed tests: $FAILED_TESTS${NC}"

# Calculate pass percentage
PASS_PERCENTAGE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
echo -e "${BLUE}Pass percentage: $PASS_PERCENTAGE%${NC}"

# Generate timestamp
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
echo -e "${YELLOW}Tests completed at: $TIMESTAMP${NC}"

# Save summary to file
echo "Test Summary ($TIMESTAMP)" > "$RESULTS_DIR/summary.txt"
echo "Total tests: $TOTAL_TESTS" >> "$RESULTS_DIR/summary.txt"
echo "Passed tests: $PASSED_TESTS" >> "$RESULTS_DIR/summary.txt"
echo "Failed tests: $FAILED_TESTS" >> "$RESULTS_DIR/summary.txt"
echo "Pass percentage: $PASS_PERCENTAGE%" >> "$RESULTS_DIR/summary.txt"

# Exit with appropriate code
if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed. Check the results directory for details.${NC}"
  exit 1
fi
