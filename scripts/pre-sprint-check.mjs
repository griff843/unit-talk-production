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

import { existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const BASELINE_DIR = path.join(ROOT, 'out', 'session-baseline');
const MAX_BASELINE_AGE_MINUTES = 10;

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

function findValidBaselines() {
  if (!existsSync(BASELINE_DIR)) {
    return [];
  }

  const dirs = readdirSync(BASELINE_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()
    .reverse();

  const baselines = [];
  for (const name of dirs) {
    const dirPath = path.join(BASELINE_DIR, name);
    const baselinePath = path.join(dirPath, 'baseline.json');
    if (!existsSync(baselinePath)) continue;

    try {
      const content = JSON.parse(readFileSync(baselinePath, 'utf8'));
      if (!content.timestamp) continue;
      baselines.push({
        path: dirPath,
        timestamp: content.timestamp,
        data: content,
      });
    } catch {
      continue;
    }
  }

  return baselines;
}

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

function classifyDebt(currentCount, previousCount) {
  if (typeof currentCount !== 'number' || currentCount <= 0) {
    return { label: 'clean', delta: 0 };
  }

  if (typeof previousCount !== 'number') {
    return { label: 'inherited', delta: null };
  }

  const delta = currentCount - previousCount;
  if (delta > 0) {
    return { label: 'new', delta };
  }

  return { label: 'inherited', delta: 0 };
}

function checkForBlockers(baseline, previousBaseline = null) {
  const blockers = [];
  const warnings = [];
  const data = baseline.data;
  const previousData = previousBaseline?.data;

  const tsDebt = classifyDebt(
    data.typescript?.totalErrors,
    previousData?.typescript?.totalErrors
  );
  if (data.typescript?.totalErrors > 0) {
    blockers.push({
      type: 'typescript',
      severity: 'error',
      message:
        tsDebt.label === 'new'
          ? `${data.typescript.totalErrors} TypeScript errors (newly introduced +${tsDebt.delta} vs previous baseline)`
          : `${data.typescript.totalErrors} TypeScript errors (inherited - pre-existing repo debt)`,
      count: data.typescript.totalErrors,
      inherited: tsDebt.label !== 'new',
    });
  }

  const eslintDebt = classifyDebt(
    data.eslint?.summary?.totalErrors,
    previousData?.eslint?.summary?.totalErrors
  );
  if (data.eslint?.summary?.totalErrors > 0) {
    blockers.push({
      type: 'eslint',
      severity: 'error',
      message:
        eslintDebt.label === 'new'
          ? `${data.eslint.summary.totalErrors} ESLint errors (newly introduced +${eslintDebt.delta} vs previous baseline)`
          : `${data.eslint.summary.totalErrors} ESLint errors (inherited - pre-existing repo debt)`,
      count: data.eslint.summary.totalErrors,
      inherited: eslintDebt.label !== 'new',
    });
  }

  const hasDrift = data.supabase?.drift?.hasDrift;
  const previousHasDrift = previousData?.supabase?.drift?.hasDrift;
  if (hasDrift !== false) {
    const schemaState =
      hasDrift === true
        ? 'Schema drift detected'
        : `Schema/type truth missing or unknown (hasDrift=${String(hasDrift)}) - fail-closed`;
    const comparison =
      previousHasDrift === false
        ? 'newly introduced vs previous baseline'
        : 'inherited';
    blockers.push({
      type: 'supabase',
      severity: 'error',
      message: `${schemaState} (${comparison})`,
      details: data.supabase?.drift,
    });
  }

  if (!data.git?.clean) {
    warnings.push({
      type: 'git',
      severity: 'warning',
      message: 'Working tree is dirty',
      staged: data.git.status?.staged || 0,
      modified: data.git.status?.modified || 0,
    });
  }

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

  log('\n[1/4] Checking for baseline...', 'blue');
  const baselines = findValidBaselines();
  const baseline = baselines[0] ?? null;
  const previousBaseline = baselines[1] ?? null;

  if (!baseline) {
    log('  ✗ No baseline found!', 'red');
    log('  Run: pnpm session:baseline', 'yellow');
    results.checks.baselineExists = { passed: false, reason: 'No baseline found' };
    printFailure(results);
    process.exit(1);
  }

  log(`  ✓ Baseline found: ${baseline.path}`, 'green');
  results.checks.baselineExists = { passed: true, path: baseline.path };

  log('\n[2/4] Checking baseline freshness...', 'blue');
  const freshness = isBaselineFresh(baseline);

  if (!freshness.fresh) {
    log(
      `  ✗ Baseline is ${freshness.ageMinutes} minutes old (max: ${freshness.maxAgeMinutes})`,
      'red'
    );
    log('  Run: pnpm session:baseline', 'yellow');
    results.checks.baselineFresh = { passed: false, ...freshness };
    printFailure(results);
    process.exit(1);
  }

  log(
    `  ✓ Baseline is ${freshness.ageMinutes} minutes old (max: ${freshness.maxAgeMinutes})`,
    'green'
  );
  results.checks.baselineFresh = { passed: true, ...freshness };

  log('\n[3/4] Checking for blockers...', 'blue');
  const { blockers, warnings } = checkForBlockers(baseline, previousBaseline);

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

  results.passed = true;
  printSuccess(results, baseline);
}

function printSuccess(results, baseline) {
  log('\n' + '═'.repeat(60), 'green');
  log('  ✓ PRE-SPRINT CHECK PASSED', 'green');
  log('═'.repeat(60), 'green');

  log('\nBaseline Summary:', 'blue');
  log(`  TypeScript: ${baseline.data.typescript?.totalErrors || 0} errors`, 'reset');
  log(
    `  ESLint: ${baseline.data.eslint?.summary?.totalErrors || 0} errors, ${baseline.data.eslint?.summary?.totalWarnings || 0} warnings`,
    'reset'
  );
  log(`  Git: ${baseline.data.git?.clean ? 'clean' : 'dirty'}`, 'reset');
  log(`  Supabase: ${baseline.data.supabase?.hash?.hash || 'unknown'}`, 'reset');

  log('\n✅ Sprint may proceed.\n', 'green');
}

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

runPreSprintCheck();
