#!/usr/bin/env node
/**
 * STRUCTURAL-DOMINANCE-FINALIZE-006: Lint Warning Budget Gate
 * Enforces that legacy lint warnings do not increase over time.
 *
 * This is a governed containment mechanism for pre-existing lint debt.
 * The budget MUST NOT increase. It should only decrease as debt is paid down.
 */

const { execSync } = require('child_process');
const path = require('path');

// Warning budget - established baseline from 2026-02-28
// See: docs/ops/sop/SOP_LINT_DEBT_POLICY.md
const WARNING_BUDGET = 1650;
const BASELINE_DATE = '2026-02-28';

console.log('🔍 Discord Bot Lint Warning Budget Gate');
console.log('=========================================');
console.log(`Budget: ${WARNING_BUDGET} warnings (baseline from ${BASELINE_DATE})`);
console.log('');

// Change to discord-bot directory
const discordBotDir = path.resolve(__dirname, '..');
process.chdir(discordBotDir);

let lintOutput;
try {
  // Run eslint and capture output (allow non-zero exit for warnings)
  lintOutput = execSync('npx eslint src/**/*.ts --format stylish 2>&1', {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large output
  });
} catch (error) {
  // eslint exits non-zero on errors/warnings, capture the output
  lintOutput = error.stdout || error.message;
}

// Parse the summary line: "✖ X problems (Y errors, Z warnings)"
const summaryMatch = lintOutput.match(/(\d+) problems? \((\d+) errors?, (\d+) warnings?\)/);

let errorCount = 0;
let warningCount = 0;

if (summaryMatch) {
  errorCount = parseInt(summaryMatch[2], 10);
  warningCount = parseInt(summaryMatch[3], 10);
} else {
  // No problems found
  console.log('No lint issues found.');
}

console.log('Current state:');
console.log(`  Errors:   ${errorCount}`);
console.log(`  Warnings: ${warningCount}`);
console.log(`  Budget:   ${WARNING_BUDGET}`);
console.log('');

// Fail on any errors
if (errorCount > 0) {
  console.log(`❌ FAIL: ${errorCount} lint errors found`);
  console.log('Lint errors must be fixed before merge.');
  process.exit(1);
}

// Check warning budget
if (warningCount > WARNING_BUDGET) {
  const over = warningCount - WARNING_BUDGET;
  console.log(`❌ FAIL: Warning budget exceeded by ${over}`);
  console.log('You have introduced new lint warnings.');
  console.log('Either fix the warnings or update the budget in scripts/lint-budget.js');
  console.log('');
  console.log('To see new warnings, run: pnpm --filter discord-bot lint');
  process.exit(1);
}

// Calculate margin
const margin = WARNING_BUDGET - warningCount;
console.log(`✅ PASS: Warning budget OK (${margin} under budget)`);

// Celebrate reduction
if (warningCount < WARNING_BUDGET) {
  console.log('');
  console.log(`🎉 Good news! You've reduced lint warnings by ${margin}.`);
  console.log(`Consider updating the budget to ${warningCount} to lock in progress.`);
}

process.exit(0);
