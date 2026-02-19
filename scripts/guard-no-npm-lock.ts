#!/usr/bin/env npx tsx
/**
 * GUARD: No npm/yarn lockfiles allowed
 *
 * This script enforces pnpm as the sole package manager by failing if
 * package-lock.json or yarn.lock exists at repo root.
 *
 * Sprint: SPRINT-PACKAGE-MANAGER-SINGLE-SOURCE-058A
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');

const FORBIDDEN_LOCKFILES = ['package-lock.json', 'yarn.lock'];

const REQUIRED_LOCKFILE = 'pnpm-lock.yaml';

function main(): void {
  console.log('🔒 LOCKFILE GUARD');
  console.log('   Canonical package manager: pnpm');
  console.log('   Checking for forbidden lockfiles...\n');

  let hasErrors = false;

  // Check for forbidden lockfiles
  for (const lockfile of FORBIDDEN_LOCKFILES) {
    const lockfilePath = path.join(REPO_ROOT, lockfile);
    if (fs.existsSync(lockfilePath)) {
      console.error(`❌ FORBIDDEN: ${lockfile} exists at repo root`);
      hasErrors = true;
    } else {
      console.log(`✅ OK: ${lockfile} not present`);
    }
  }

  // Check for required lockfile
  const requiredPath = path.join(REPO_ROOT, REQUIRED_LOCKFILE);
  if (!fs.existsSync(requiredPath)) {
    console.error(`\n❌ MISSING: ${REQUIRED_LOCKFILE} not found`);
    hasErrors = true;
  } else {
    console.log(`✅ OK: ${REQUIRED_LOCKFILE} present`);
  }

  if (hasErrors) {
    console.error('\n' + '='.repeat(60));
    console.error('LOCKFILE GUARD FAILED');
    console.error('='.repeat(60));
    console.error('\nRemediation steps:');
    console.error('  1. Delete any package-lock.json or yarn.lock files');
    console.error('  2. Run: pnpm install');
    console.error('  3. Commit pnpm-lock.yaml');
    console.error('\npnpm is the only allowed package manager in this repo.');
    console.error('Do NOT run npm install or yarn install.\n');
    process.exit(1);
  }

  console.log('\n✅ LOCKFILE GUARD PASSED\n');
  process.exit(0);
}

main();
