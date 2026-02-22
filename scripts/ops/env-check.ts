#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Environment Check Script
 *
 * SPRINT-ENV-BUILD-TRUTH-LOCK
 *
 * Validates environment configuration per app using packages/config schema.
 * Fail-closed: exits non-zero if required vars missing.
 *
 * Usage:
 *   npx tsx scripts/ops/env-check.ts                    # Check all apps
 *   npx tsx scripts/ops/env-check.ts --app api          # Check specific app
 *   npx tsx scripts/ops/env-check.ts --app smart-form   # Check specific app
 *   pnpm ops:env:check                                   # Run via pnpm
 */

import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

// Load root .env first, then allow app-specific overrides
config({ path: '.env' });

import {
  checkAppEnv,
  getEnvProfile,
  type EnvCheckResult,
} from '../../packages/config/src/env-schema';

// ============================================================================
// CLI PARSING
// ============================================================================

const args = process.argv.slice(2);
const appArg = args.indexOf('--app');
const targetApp = appArg !== -1 ? args[appArg + 1] : null;
const verboseArg = args.includes('--verbose') || args.includes('-v');

const ALL_APPS = ['api', 'command-center', 'smart-form', 'dashboard', 'discord-bot'] as const;
type AppName = (typeof ALL_APPS)[number];

// ============================================================================
// ENV LOADING
// ============================================================================

function loadAppEnv(app: AppName): void {
  // Load app-specific .env.local if exists
  const envPaths = [
    join('apps', app, '.env.local'),
    join('apps', app, '.env'),
  ];

  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      config({ path: envPath, override: true });
      if (verboseArg) {
        console.log(`  Loaded: ${envPath}`);
      }
      break;
    }
  }
}

// ============================================================================
// OUTPUT FORMATTING
// ============================================================================

function printResult(result: EnvCheckResult): void {
  const icon = result.valid ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`\n${icon} ${result.app} (profile: ${result.profile})`);

  if (verboseArg) {
    if (result.presentVars.length > 0) {
      console.log(`  Present: ${result.presentVars.join(', ')}`);
    }
    if (result.missingVars.length > 0) {
      console.log(`  Missing: ${result.missingVars.join(', ')}`);
    }
  }

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.log(`  \x1b[31m✗\x1b[0m ${err}`);
    }
  }

  if (result.warnings.length > 0) {
    for (const warn of result.warnings) {
      console.log(`  \x1b[33m⚠\x1b[0m ${warn}`);
    }
  }
}

function printSummary(results: EnvCheckResult[]): void {
  const passed = results.filter((r) => r.valid).length;
  const failed = results.filter((r) => !r.valid).length;
  const profile = getEnvProfile();

  console.log('\n========================================');
  console.log('  ENV CHECK SUMMARY');
  console.log('  SPRINT-ENV-BUILD-TRUTH-LOCK');
  console.log('========================================');
  console.log(`  Profile: ${profile}`);
  console.log(`  Apps checked: ${results.length}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log('========================================');

  if (failed > 0) {
    console.log('\n\x1b[31mFAIL\x1b[0m: Fix errors above before proceeding.\n');
  } else {
    console.log('\n\x1b[32mPASS\x1b[0m: All env checks passed.\n');
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('========================================');
  console.log('  ENVIRONMENT CHECK');
  console.log('  SPRINT-ENV-BUILD-TRUTH-LOCK');
  console.log('========================================');

  const appsToCheck: AppName[] = targetApp
    ? [targetApp as AppName]
    : [...ALL_APPS];

  // Validate app name
  if (targetApp && !ALL_APPS.includes(targetApp as AppName)) {
    console.error(`\x1b[31mError:\x1b[0m Unknown app: ${targetApp}`);
    console.error(`Valid apps: ${ALL_APPS.join(', ')}`);
    process.exit(1);
  }

  const results: EnvCheckResult[] = [];

  for (const app of appsToCheck) {
    // Reload base env
    config({ path: '.env', override: false });
    // Load app-specific env
    loadAppEnv(app);
    // Check env
    const result = checkAppEnv(app);
    results.push(result);
    printResult(result);
  }

  printSummary(results);

  // Exit with error if any failed
  const hasFailures = results.some((r) => !r.valid);
  process.exit(hasFailures ? 1 : 0);
}

main().catch((err) => {
  console.error('\x1b[31mFatal error:\x1b[0m', err);
  process.exit(1);
});
