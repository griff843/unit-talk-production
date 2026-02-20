#!/usr/bin/env npx tsx
/**
 * SPRINT VERIFICATION SCRIPT
 * Sprint: SPRINT-OPS-SUBMIT-COMPLIANCE-071C
 *
 * Provides fail-closed verification for sprint work.
 * Must be run before any sprint commit/merge.
 *
 * Usage:
 *   npm run verify:sprint
 *   npx tsx scripts/verify-sprint.ts [--ops-submit|--api|--full]
 */

import { execSync } from 'child_process';
import * as path from 'path';

const WORKSPACE_ROOT = path.resolve(__dirname, '..');

interface VerifyResult {
  passed: boolean;
  output: string;
  command: string;
}

function runCommand(cmd: string, cwd: string = WORKSPACE_ROOT): VerifyResult {
  console.log(`\n🔍 Running: ${cmd}`);
  console.log(`   CWD: ${cwd}`);
  try {
    const output = execSync(cmd, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    console.log(`   ✅ PASSED`);
    return { passed: true, output, command: cmd };
  } catch (error: any) {
    console.log(`   ❌ FAILED`);
    return {
      passed: false,
      output: error.stdout || error.message,
      command: cmd,
    };
  }
}

function verifyOpsSubmit(): boolean {
  console.log('\n' + '='.repeat(60));
  console.log('🔧 VERIFYING OPS-SUBMIT MODULE');
  console.log('='.repeat(60));

  const results: VerifyResult[] = [];

  // 1. API workspace typecheck (full)
  results.push(runCommand('npm run type-check --workspace=apps/api'));

  // 2. Command Center ops-submit targeted typecheck
  results.push(
    runCommand('npm run typecheck:ops-submit', path.join(WORKSPACE_ROOT, 'apps/command-center'))
  );

  // 3. Lint ops-submit files
  results.push(
    runCommand('npm run lint:ops-submit', path.join(WORKSPACE_ROOT, 'apps/command-center'))
  );

  const allPassed = results.every(r => r.passed);

  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('✅ OPS-SUBMIT VERIFICATION: PASSED');
  } else {
    console.log('❌ OPS-SUBMIT VERIFICATION: FAILED');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`\n   Failed: ${r.command}`);
        console.log(r.output);
      });
  }
  console.log('='.repeat(60));

  return allPassed;
}

function verifyApi(): boolean {
  console.log('\n' + '='.repeat(60));
  console.log('🔧 VERIFYING API MODULE');
  console.log('='.repeat(60));

  const results: VerifyResult[] = [];
  results.push(runCommand('npm run type-check --workspace=apps/api'));
  results.push(runCommand('npm run lint --workspace=apps/api'));

  const allPassed = results.every(r => r.passed);

  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('✅ API VERIFICATION: PASSED');
  } else {
    console.log('❌ API VERIFICATION: FAILED');
  }
  console.log('='.repeat(60));

  return allPassed;
}

function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--ops-submit';

  console.log('🛡️  SPRINT VERIFICATION SCRIPT');
  console.log('   Mode:', mode);
  console.log('   This script MUST pass before merging sprint work.');

  let passed = false;

  switch (mode) {
    case '--ops-submit':
      passed = verifyOpsSubmit();
      break;
    case '--api':
      passed = verifyApi();
      break;
    case '--full':
      passed = verifyApi() && verifyOpsSubmit();
      break;
    default:
      console.log('Unknown mode. Use: --ops-submit, --api, or --full');
      process.exit(1);
  }

  if (!passed) {
    console.log('\n❌ VERIFICATION FAILED - DO NOT MERGE');
    process.exit(1);
  }

  console.log('\n✅ VERIFICATION PASSED - SAFE TO MERGE');
  process.exit(0);
}

main();
