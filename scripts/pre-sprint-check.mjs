#!/usr/bin/env node
/**
 * Pre-Sprint Check Script
 * Sprint: SPRINT-CLAUDE-OS-SESSION-ENFORCEMENT-110A
 *
 * This script verifies that a baseline was run recently and no new issues exist.
 * FAIL-CLOSED: If verification fails, the sprint cannot proceed.
 *
 * Usage:
 *   node scripts/pre-sprint-check.mjs
 *   pnpm pre-sprint-check
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const BASELINE_DIR = path.join(ROOT, 'out', 'session-baseline');
const MAX_BASELINE_AGE_MINUTES = 10;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Find the most recent baseline
 */
function findLatestBaseline() {
  if (!existsSync(BASELINE_DIR)) {
    return null;
  }

  const dirs = readdirSync(BASELINE_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => ({
      name: d.name,
      path: path.join(BASELINE_DIR, d.name),
      mtime: statSync(path.join(BASELINE_DIR, d.name)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  if (dirs.length === 0) {
    return null;
  }

  const latest = dirs[0];
  const baselinePath = path.join(latest.path, 'baseline.json');

  if (!existsSync(baselinePath)) {
    return null;
  }

  try {
    const content = JSON.parse(readFileSync(baselinePath, 'utf8'));
    return {
      path: latest.path,
      timestamp: content.timestamp,
      data: content,
    };
  } catch {
    return null;
  }
}

/**
 * Check if baseline is fresh enough
 */
function isBaselineFresh(baseline, maxAgeMinutes = MAX_BASELINE_AGE_MINUTES) {
  const baselineTime = new Date(baseline.timestamp).getTime();
  const now = Date.now();
  const ageMinutes = (now - baselineTime) / (1000 * 60);

  return {
    fresh: ageMinutes <= maxAgeMinutes,
    ageMinutes: Math.round(ageMinutes * 10) / 10,
    maxAgeMinutes,
  };
}

/**
 * Check for blocking issues in baseline
 */
function checkForBlockers(baseline) {
  const blockers = [];
  const warnings = [];
  const data = baseline.data;

  // TypeScript errors are blockers
  if (data.typescript?.totalErrors > 0) {
    blockers.push({
      type: 'typescript',
      severity: 'error',
      message: `${data.typescript.totalErrors} TypeScript errors`,
      count: data.typescript.totalErrors,
    });
  }

  // ESLint errors are blockers
  if (data.eslint?.summary?.totalErrors > 0) {
    blockers.push({
      type: 'eslint',
      severity: 'error',
      message: `${data.eslint.summary.totalErrors} ESLint errors`,
      count: data.eslint.summary.totalErrors,
    });
  }

  // Schema drift is a blocker
  if (data.supabase?.drift?.hasDrift === true) {
    blockers.push({
      type: 'supabase',
      severity: 'error',
      message: 'Schema drift detected',
      details: data.supabase.drift,
    });
  }

  // Dirty working tree is a warning
  if (!data.git?.clean) {
    warnings.push({
      type: 'git',
      severity: 'warning',
      message: 'Working tree is dirty',
      staged: data.git.status?.staged || 0,
      modified: data.git.status?.modified || 0,
    });
  }

  // ESLint warnings are warnings
  if (data.eslint?.summary?.totalWarnings > 10) {
    warnings.push({
      type: 'eslint',
      severity: 'warning',
      message: `${data.eslint.summary.totalWarnings} ESLint warnings`,
      count: data.eslint.summary.totalWarnings,
    });
  }

  return { blockers, warnings };
}

/**
 * Run pre-sprint checks
 */
function runPreSprintCheck() {
  log('\n' + '═'.repeat(60), 'cyan');
  log('  PRE-SPRINT CHECK', 'bold');
  log('  FAIL-CLOSED: Must pass before any sprint begins', 'yellow');
  log('═'.repeat(60), 'cyan');

  const results = {
    passed: false,
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // Check 1: Find baseline
  log('\n[1/4] Checking for baseline...', 'blue');
  const baseline = findLatestBaseline();

  if (!baseline) {
    log('  ✗ No baseline found!', 'red');
    log('  Run: pnpm session:baseline', 'yellow');
    results.checks.baselineExists = { passed: false, reason: 'No baseline found' };
    printFailure(results);
    process.exit(1);
  }

  log(`  ✓ Baseline found: ${baseline.path}`, 'green');
  results.checks.baselineExists = { passed: true, path: baseline.path };

  // Check 2: Baseline freshness
  log('\n[2/4] Checking baseline freshness...', 'blue');
  const freshness = isBaselineFresh(baseline);

  if (!freshness.fresh) {
    log(`  ✗ Baseline is ${freshness.ageMinutes} minutes old (max: ${freshness.maxAgeMinutes})`, 'red');
    log('  Run: pnpm session:baseline', 'yellow');
    results.checks.baselineFresh = { passed: false, ...freshness };
    printFailure(results);
    process.exit(1);
  }

  log(`  ✓ Baseline is ${freshness.ageMinutes} minutes old (max: ${freshness.maxAgeMinutes})`, 'green');
  results.checks.baselineFresh = { passed: true, ...freshness };

  // Check 3: No blockers
  log('\n[3/4] Checking for blockers...', 'blue');
  const { blockers, warnings } = checkForBlockers(baseline);

  if (blockers.length > 0) {
    log(`  ✗ ${blockers.length} blocking issue(s) found:`, 'red');
    for (const blocker of blockers) {
      log(`    - ${blocker.type}: ${blocker.message}`, 'red');
    }
    results.checks.noBlockers = { passed: false, blockers };
    printFailure(results);
    process.exit(1);
  }

  log('  ✓ No blocking issues', 'green');
  results.checks.noBlockers = { passed: true };

  // Check 4: Warnings (informational, non-blocking)
  log('\n[4/4] Checking warnings...', 'blue');

  if (warnings.length > 0) {
    log(`  ⚠ ${warnings.length} warning(s):`, 'yellow');
    for (const warning of warnings) {
      log(`    - ${warning.type}: ${warning.message}`, 'yellow');
    }
    results.checks.warnings = { passed: true, count: warnings.length, warnings };
  } else {
    log('  ✓ No warnings', 'green');
    results.checks.warnings = { passed: true, count: 0 };
  }

  // All checks passed
  results.passed = true;
  printSuccess(results, baseline);
}

/**
 * Print success message
 */
function printSuccess(results, baseline) {
  log('\n' + '═'.repeat(60), 'green');
  log('  ✓ PRE-SPRINT CHECK PASSED', 'green');
  log('═'.repeat(60), 'green');

  log('\nBaseline Summary:', 'blue');
  log(`  TypeScript: ${baseline.data.typescript?.totalErrors || 0} errors`, 'reset');
  log(`  ESLint: ${baseline.data.eslint?.summary?.totalErrors || 0} errors, ${baseline.data.eslint?.summary?.totalWarnings || 0} warnings`, 'reset');
  log(`  Git: ${baseline.data.git?.clean ? 'clean' : 'dirty'}`, 'reset');
  log(`  Supabase: ${baseline.data.supabase?.hash?.hash || 'unknown'}`, 'reset');

  log('\n✅ Sprint may proceed.\n', 'green');
}

/**
 * Print failure message
 */
function printFailure(results) {
  log('\n' + '═'.repeat(60), 'red');
  log('  ✗ PRE-SPRINT CHECK FAILED', 'red');
  log('═'.repeat(60), 'red');

  log('\nFailed checks:', 'red');
  for (const [check, result] of Object.entries(results.checks)) {
    if (!result.passed) {
      log(`  - ${check}: ${result.reason || 'FAILED'}`, 'red');
    }
  }

  log('\n❌ Sprint CANNOT proceed until issues are resolved.\n', 'red');
}

// Run the check
runPreSprintCheck();
