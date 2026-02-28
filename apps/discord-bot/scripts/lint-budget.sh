#!/bin/bash
# STRUCTURAL-DOMINANCE-FINALIZE-006: Lint Warning Budget Gate
# Enforces that legacy lint warnings do not increase over time

set -e

# Warning budget - established baseline from 2026-02-28
# This number MUST NOT increase. It should only decrease over time.
WARNING_BUDGET=1650

echo "🔍 Discord Bot Lint Warning Budget Gate"
echo "========================================="
echo "Budget: ${WARNING_BUDGET} warnings (baseline from 2026-02-28)"
echo ""

# Run eslint and capture output
LINT_OUTPUT=$(cd "$(dirname "$0")/.." && pnpm run lint 2>&1 || true)

# Extract warning count from eslint output
# Format: "✖ X problems (Y errors, Z warnings)"
WARNING_COUNT=$(echo "$LINT_OUTPUT" | grep -oP '\d+ warnings' | head -1 | grep -oP '\d+' || echo "0")
ERROR_COUNT=$(echo "$LINT_OUTPUT" | grep -oP '\d+ errors' | head -1 | grep -oP '\d+' || echo "0")

echo "Current state:"
echo "  Errors:   ${ERROR_COUNT}"
echo "  Warnings: ${WARNING_COUNT}"
echo "  Budget:   ${WARNING_BUDGET}"
echo ""

# Fail on any errors
if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "❌ FAIL: ${ERROR_COUNT} lint errors found"
    echo "Lint errors must be fixed before merge."
    exit 1
fi

# Check warning budget
if [ "$WARNING_COUNT" -gt "$WARNING_BUDGET" ]; then
    OVER=$((WARNING_COUNT - WARNING_BUDGET))
    echo "❌ FAIL: Warning budget exceeded by ${OVER}"
    echo "You have introduced new lint warnings."
    echo "Either fix the warnings or update the budget in scripts/lint-budget.sh"
    echo ""
    echo "To see new warnings, run: pnpm --filter discord-bot lint"
    exit 1
fi

# Calculate margin
MARGIN=$((WARNING_BUDGET - WARNING_COUNT))
echo "✅ PASS: Warning budget OK (${MARGIN} under budget)"

# Celebrate reduction
if [ "$WARNING_COUNT" -lt "$WARNING_BUDGET" ]; then
    echo ""
    echo "🎉 Good news! You've reduced lint warnings by ${MARGIN}."
    echo "Consider updating the budget to ${WARNING_COUNT} to lock in progress."
fi

exit 0
