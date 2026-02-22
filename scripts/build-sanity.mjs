#!/usr/bin/env node
/**
 * SPRINT-ARCHITECTURE-HARDENING-002A: Build Sanity Mode
 *
 * Verifies that builds succeed without runtime environment variables.
 * This ensures proper build/runtime separation per SYSTEM_INVARIANTS.md #5.
 *
 * Usage: node scripts/build-sanity.mjs
 *
 * Exit codes:
 *   0 = Pass (build succeeds with placeholder env)
 *   1 = Fail (build requires runtime env vars)
 */

import { execSync } from 'child_process';
import { existsSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';

// Colors for output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

// Build-time placeholder values
// These are intentionally fake to ensure builds don't depend on real values
const BUILD_PLACEHOLDERS = {
  // Public vars (NEXT_PUBLIC_*) - required at build time
  NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder-build.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
  NEXT_PUBLIC_API_URL: 'http://placeholder:3000',
  NEXT_PUBLIC_APP_URL: 'http://placeholder:3015',
  NEXT_PUBLIC_PLATFORM_API_URL: 'http://placeholder:3000',
  NEXT_PUBLIC_ANALYTICS_API_URL: 'http://placeholder:3005',
  NEXT_PUBLIC_ENV: 'build-sanity',

  // Basic env (always safe)
  NODE_ENV: 'production',
  CI: 'true',
};

// Apps to build (in order)
const BUILD_TARGETS = [
  { name: 'api', workspace: 'apps/api', script: 'build' },
  { name: 'command-center', workspace: 'apps/command-center', script: 'build' },
  { name: 'smart-form', workspace: 'apps/smart-form', script: 'build' },
];

function createPlaceholderEnv(rootDir) {
  const envPath = join(rootDir, '.env.sanity');
  const content = Object.entries(BUILD_PLACEHOLDERS)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  writeFileSync(envPath, content);
  console.log(`   Created placeholder env: .env.sanity`);
  return envPath;
}

function cleanupEnv(envPath) {
  if (existsSync(envPath)) {
    unlinkSync(envPath);
    console.log(`   Cleaned up: .env.sanity`);
  }
}

function runBuild(target, env) {
  const cmd = `npm run ${target.script} --workspace=${target.workspace}`;
  console.log(`   Running: ${cmd}`);

  try {
    execSync(cmd, {
      env: { ...env, ...BUILD_PLACEHOLDERS },
      stdio: 'pipe',
      timeout: 300000, // 5 minute timeout
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.stderr?.toString() || error.message,
    };
  }
}

function main() {
  const rootDir = process.cwd();

  console.log(`${BOLD}BUILD SANITY MODE${RESET}`);
  console.log(`   Purpose: Verify builds succeed without runtime env vars`);
  console.log('');

  console.log(`${BOLD}PHASE 1: Setup${RESET}`);
  const envPath = createPlaceholderEnv(rootDir);
  console.log('');

  console.log(`${BOLD}PHASE 2: Build Verification${RESET}`);
  const results = [];

  for (const target of BUILD_TARGETS) {
    console.log(`   Building: ${target.name}`);
    const result = runBuild(target, process.env);
    results.push({ ...target, ...result });

    if (result.success) {
      console.log(`   ${GREEN}PASS${RESET}`);
    } else {
      console.log(`   ${RED}FAIL${RESET}`);
      console.log(`   Error: ${result.error?.substring(0, 200)}...`);
    }
    console.log('');
  }

  console.log(`${BOLD}PHASE 3: Cleanup${RESET}`);
  cleanupEnv(envPath);
  console.log('');

  // Report
  console.log(`${BOLD}RESULTS${RESET}`);
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`   Passed: ${passed}/${results.length}`);
  console.log(`   Failed: ${failed}/${results.length}`);
  console.log('');

  if (failed > 0) {
    console.log(`${RED}${BOLD}SANITY CHECK FAILED${RESET}`);
    console.log('   Some builds require runtime environment variables at build time.');
    console.log('   This violates SYSTEM_INVARIANTS.md #5 (Build vs Runtime Separation).');
    console.log('');
    console.log('   Failed builds:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   ${RED}- ${r.name}${RESET}`);
    });
    process.exit(1);
  } else {
    console.log(`${GREEN}${BOLD}SANITY CHECK PASSED${RESET}`);
    console.log('   All builds succeed with placeholder environment.');
    console.log('   Build/runtime separation is maintained.');
    process.exit(0);
  }
}

main();
