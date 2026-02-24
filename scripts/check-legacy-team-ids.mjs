#!/usr/bin/env node
/**
 * SPRINT-CATALOG-PARTICIPANTS-MIGRATION-091: CI Gate for Legacy Team IDs
 *
 * Fails if team_nba_* pattern exists in apps/smart-form/** outside of:
 * - Test files (*.test.ts, *.spec.ts) - may have intentional negative test cases
 * - e2e fixtures
 * - out/** directories
 *
 * Usage: node scripts/check-legacy-team-ids.mjs
 * Exit 0 = Pass, Exit 1 = Fail
 */

import { execSync } from 'child_process';

console.log('🔍 LEGACY TEAM ID GATE');
console.log('   Checking for team_nba_* in apps/smart-form...\n');

// Excluded patterns:
// - Test files (intentional negative test cases)
// - out/ directories
// - node_modules
const excludePatterns = [
  '--glob=!*.test.ts',
  '--glob=!*.spec.ts',
  '--glob=!**/out/**',
  '--glob=!**/node_modules/**',
  '--glob=!**/__tests__/**',
  '--glob=!**/fixtures/**',
];

try {
  // Use ripgrep if available, fallback to grep
  const rgArgs = [
    'rg',
    '-l', // List files only
    '--type=ts',
    '--type=tsx',
    'team_nba_',
    'apps/smart-form',
    ...excludePatterns,
  ].join(' ');

  const result = execSync(rgArgs, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd(),
  });

  // If we get here, matches were found
  const files = result.trim().split('\n').filter(Boolean);
  if (files.length > 0) {
    console.log('❌ GATE FAILED: Legacy team_nba_* patterns found:\n');
    files.forEach(f => console.log(`   - ${f}`));
    console.log('\n   These files should use UUID team_ids from participants table.');
    console.log('   See: SPRINT-CATALOG-PARTICIPANTS-MIGRATION-091\n');
    process.exit(1);
  }
} catch (e) {
  // ripgrep returns exit code 1 when no matches found
  if (e.status === 1) {
    console.log('✅ GATE PASSED: No legacy team_nba_* patterns in production code\n');
    process.exit(0);
  }
  // Try grep fallback
  try {
    const grepResult = execSync(
      'grep -rl "team_nba_" apps/smart-form --include="*.ts" --include="*.tsx" | grep -v ".test.ts" | grep -v ".spec.ts" | grep -v "__tests__" | grep -v "node_modules"',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const files = grepResult.trim().split('\n').filter(Boolean);
    if (files.length > 0) {
      console.log('❌ GATE FAILED: Legacy team_nba_* patterns found:\n');
      files.forEach(f => console.log(`   - ${f}`));
      process.exit(1);
    }
  } catch (grepError) {
    if (grepError.status === 1) {
      console.log('✅ GATE PASSED: No legacy team_nba_* patterns in production code\n');
      process.exit(0);
    }
    console.error('Error running search:', grepError.message);
    process.exit(1);
  }
}

console.log('✅ GATE PASSED: No legacy team_nba_* patterns in production code\n');
