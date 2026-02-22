#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Build Matrix Script
 *
 * SPRINT-ENV-BUILD-TRUTH-LOCK
 *
 * Runs type-check and build for all apps in the monorepo.
 * Fail-closed: exits non-zero if any gate fails.
 *
 * Usage:
 *   npx tsx scripts/ops/build-matrix.ts              # Run all gates
 *   npx tsx scripts/ops/build-matrix.ts --type-only  # Type-check only
 *   npx tsx scripts/ops/build-matrix.ts --build-only # Build only
 *   pnpm ops:build:matrix                            # Run via pnpm
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

// ============================================================================
// CLI PARSING
// ============================================================================

const args = process.argv.slice(2);
const typeOnly = args.includes('--type-only');
const buildOnly = args.includes('--build-only');
const verboseArg = args.includes('--verbose') || args.includes('-v');
const continueOnError = args.includes('--continue');

// ============================================================================
// APP CONFIGURATION
// ============================================================================

interface AppConfig {
  name: string;
  path: string;
  typeCheckCmd: string;
  buildCmd: string;
  isGate: boolean;
}

const APPS: AppConfig[] = [
  {
    name: 'api',
    path: 'apps/api',
    typeCheckCmd: 'pnpm run type-check',
    buildCmd: 'pnpm run build',
    isGate: true,
  },
  {
    name: 'command-center',
    path: 'apps/command-center',
    typeCheckCmd: 'pnpm run type-check',
    buildCmd: 'pnpm run build',
    isGate: true,
  },
  {
    name: 'smart-form',
    path: 'apps/smart-form',
    typeCheckCmd: 'pnpm run type-check',
    buildCmd: 'pnpm run build',
    isGate: true,
  },
  {
    name: 'dashboard',
    path: 'apps/dashboard',
    typeCheckCmd: 'pnpm run type-check',
    buildCmd: 'pnpm run build',
    isGate: true,
  },
  {
    name: 'discord-bot',
    path: 'apps/discord-bot',
    typeCheckCmd: 'pnpm run type-check',
    buildCmd: 'pnpm run build',
    isGate: true,
  },
];

// ============================================================================
// EXECUTION
// ============================================================================

interface GateResult {
  app: string;
  gate: 'type-check' | 'build';
  success: boolean;
  duration: number;
  output: string;
}

function runGate(
  app: AppConfig,
  gate: 'type-check' | 'build'
): GateResult {
  const cmd = gate === 'type-check' ? app.typeCheckCmd : app.buildCmd;
  const startTime = Date.now();

  if (verboseArg) {
    console.log(`  Running: cd ${app.path} && ${cmd}`);
  }

  try {
    const output = execSync(cmd, {
      cwd: app.path,
      encoding: 'utf-8',
      stdio: verboseArg ? 'inherit' : 'pipe',
      timeout: 300000, // 5 minute timeout
    });

    return {
      app: app.name,
      gate,
      success: true,
      duration: Date.now() - startTime,
      output: output || '',
    };
  } catch (err) {
    const error = err as { stdout?: string; stderr?: string };
    return {
      app: app.name,
      gate,
      success: false,
      duration: Date.now() - startTime,
      output: error.stderr || error.stdout || String(err),
    };
  }
}

// ============================================================================
// OUTPUT FORMATTING
// ============================================================================

function printResult(result: GateResult): void {
  const icon = result.success ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  const duration = `${(result.duration / 1000).toFixed(1)}s`;
  console.log(`  ${icon} ${result.app}:${result.gate} (${duration})`);

  if (!result.success && !verboseArg) {
    // Show first few lines of error
    const lines = result.output.split('\n').slice(0, 10);
    for (const line of lines) {
      console.log(`    ${line}`);
    }
    if (result.output.split('\n').length > 10) {
      console.log('    ... (truncated, use --verbose for full output)');
    }
  }
}

function printSummary(results: GateResult[]): void {
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log('\n========================================');
  console.log('  BUILD MATRIX SUMMARY');
  console.log('  SPRINT-ENV-BUILD-TRUTH-LOCK');
  console.log('========================================');
  console.log(`  Gates run: ${results.length}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total time: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log('========================================');

  if (failed > 0) {
    console.log('\n\x1b[31mFAIL\x1b[0m: Build matrix failed. Fix errors above.\n');
    console.log('Failed gates:');
    for (const result of results.filter((r) => !r.success)) {
      console.log(`  - ${result.app}:${result.gate}`);
    }
    console.log('');
  } else {
    console.log('\n\x1b[32mPASS\x1b[0m: All gates passed.\n');
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('========================================');
  console.log('  BUILD MATRIX');
  console.log('  SPRINT-ENV-BUILD-TRUTH-LOCK');
  console.log('========================================\n');

  const results: GateResult[] = [];
  let shouldExit = false;

  // Type-check phase
  if (!buildOnly) {
    console.log('=== TYPE-CHECK PHASE ===\n');
    for (const app of APPS) {
      if (!existsSync(app.path)) {
        console.log(`  \x1b[33m⚠\x1b[0m ${app.name}: path not found, skipping`);
        continue;
      }

      const result = runGate(app, 'type-check');
      results.push(result);
      printResult(result);

      if (!result.success && app.isGate && !continueOnError) {
        shouldExit = true;
        break;
      }
    }
  }

  // Build phase
  if (!typeOnly && !shouldExit) {
    console.log('\n=== BUILD PHASE ===\n');
    for (const app of APPS) {
      if (!existsSync(app.path)) {
        console.log(`  \x1b[33m⚠\x1b[0m ${app.name}: path not found, skipping`);
        continue;
      }

      const result = runGate(app, 'build');
      results.push(result);
      printResult(result);

      if (!result.success && app.isGate && !continueOnError) {
        shouldExit = true;
        break;
      }
    }
  }

  printSummary(results);

  // Exit with error if any gate failed
  const hasFailures = results.some((r) => !r.success && APPS.find((a) => a.name === r.app)?.isGate);
  process.exit(hasFailures ? 1 : 0);
}

main().catch((err) => {
  console.error('\x1b[31mFatal error:\x1b[0m', err);
  process.exit(1);
});
