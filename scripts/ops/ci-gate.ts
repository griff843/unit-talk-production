#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * CI Gate Script
 *
 * SPRINT-ENV-BUILD-TRUTH-LOCK
 *
 * Full CI gate check: env validation, type-check, build, lifecycle gate.
 * Fail-closed: exits non-zero if ANY gate fails.
 *
 * Usage:
 *   npx tsx scripts/ops/ci-gate.ts           # Run all gates
 *   pnpm ops:ci:gate                         # Run via pnpm
 */

import { execSync, spawnSync } from 'child_process';
import { existsSync } from 'fs';

// ============================================================================
// GATE DEFINITIONS
// ============================================================================

interface Gate {
  name: string;
  command: string;
  cwd?: string;
  isRequired: boolean;
  description: string;
}

const GATES: Gate[] = [
  {
    name: 'env-check',
    command: 'npx tsx scripts/ops/env-check.ts',
    isRequired: true,
    description: 'Validate environment variables',
  },
  {
    name: 'type-check:api',
    command: 'pnpm run type-check',
    cwd: 'apps/api',
    isRequired: true,
    description: 'API type check',
  },
  {
    name: 'type-check:command-center',
    command: 'pnpm run type-check',
    cwd: 'apps/command-center',
    isRequired: true,
    description: 'Command Center type check',
  },
  {
    name: 'type-check:smart-form',
    command: 'pnpm run type-check',
    cwd: 'apps/smart-form',
    isRequired: true,
    description: 'Smart Form type check',
  },
  {
    name: 'type-check:dashboard',
    command: 'pnpm run type-check',
    cwd: 'apps/dashboard',
    isRequired: true,
    description: 'Dashboard type check',
  },
  {
    name: 'type-check:discord-bot',
    command: 'pnpm run type-check',
    cwd: 'apps/discord-bot',
    isRequired: true,
    description: 'Discord Bot type check',
  },
  {
    name: 'build:api',
    command: 'pnpm run build',
    cwd: 'apps/api',
    isRequired: true,
    description: 'API build',
  },
  {
    name: 'build:command-center',
    command: 'pnpm run build',
    cwd: 'apps/command-center',
    isRequired: true,
    description: 'Command Center build',
  },
  {
    name: 'build:smart-form',
    command: 'pnpm run build',
    cwd: 'apps/smart-form',
    isRequired: true,
    description: 'Smart Form build',
  },
  {
    name: 'build:dashboard',
    command: 'pnpm run build',
    cwd: 'apps/dashboard',
    isRequired: true,
    description: 'Dashboard build',
  },
  {
    name: 'lifecycle-gate',
    command: 'pnpm run lifecycle:single-writer -- --strict',
    cwd: 'apps/api',
    isRequired: true,
    description: 'Single-writer lifecycle gate',
  },
];

// ============================================================================
// EXECUTION
// ============================================================================

interface GateResult {
  gate: Gate;
  success: boolean;
  duration: number;
  output: string;
}

function runGate(gate: Gate): GateResult {
  const startTime = Date.now();

  // Skip if cwd doesn't exist
  if (gate.cwd && !existsSync(gate.cwd)) {
    return {
      gate,
      success: false,
      duration: 0,
      output: `Directory not found: ${gate.cwd}`,
    };
  }

  try {
    const output = execSync(gate.command, {
      cwd: gate.cwd || process.cwd(),
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 600000, // 10 minute timeout
    });

    return {
      gate,
      success: true,
      duration: Date.now() - startTime,
      output: output || 'OK',
    };
  } catch (err) {
    const error = err as { stdout?: string; stderr?: string; status?: number };
    return {
      gate,
      success: false,
      duration: Date.now() - startTime,
      output: error.stderr || error.stdout || String(err),
    };
  }
}

// ============================================================================
// OUTPUT
// ============================================================================

function printGateResult(result: GateResult): void {
  const icon = result.success ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  const duration = `${(result.duration / 1000).toFixed(1)}s`;
  const required = result.gate.isRequired ? '' : ' (optional)';

  console.log(`${icon} ${result.gate.name}${required} (${duration})`);

  if (!result.success) {
    // Show first 15 lines of error
    const lines = result.output.split('\n').slice(0, 15);
    for (const line of lines) {
      console.log(`    ${line}`);
    }
    if (result.output.split('\n').length > 15) {
      console.log('    ... (truncated)');
    }
  }
}

function printSummary(results: GateResult[]): void {
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success);
  const requiredFailed = failed.filter((r) => r.gate.isRequired);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log('\n========================================');
  console.log('  CI GATE SUMMARY');
  console.log('  SPRINT-ENV-BUILD-TRUTH-LOCK');
  console.log('========================================');
  console.log(`  Gates run: ${results.length}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed.length}`);
  console.log(`  Required failed: ${requiredFailed.length}`);
  console.log(`  Total time: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log('========================================');

  if (requiredFailed.length > 0) {
    console.log('\n\x1b[31mCI GATE FAILED\x1b[0m\n');
    console.log('Required gates that failed:');
    for (const result of requiredFailed) {
      console.log(`  ✗ ${result.gate.name}: ${result.gate.description}`);
    }
    console.log('\nMerge is BLOCKED until all required gates pass.\n');
  } else if (failed.length > 0) {
    console.log('\n\x1b[33mCI GATE PASSED (with warnings)\x1b[0m\n');
    console.log('Optional gates that failed:');
    for (const result of failed) {
      console.log(`  ⚠ ${result.gate.name}: ${result.gate.description}`);
    }
    console.log('');
  } else {
    console.log('\n\x1b[32mCI GATE PASSED\x1b[0m\n');
    console.log('All gates passed. Merge is allowed.\n');
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('========================================');
  console.log('  CI GATE');
  console.log('  SPRINT-ENV-BUILD-TRUTH-LOCK');
  console.log('========================================\n');

  const results: GateResult[] = [];

  for (const gate of GATES) {
    console.log(`Running: ${gate.name}...`);
    const result = runGate(gate);
    results.push(result);
    printGateResult(result);
    console.log('');

    // Fail fast on required gates
    if (!result.success && gate.isRequired) {
      console.log('\x1b[31mFail-fast: Required gate failed, stopping.\x1b[0m\n');
      break;
    }
  }

  printSummary(results);

  // Exit with error if any required gate failed
  const hasRequiredFailures = results.some((r) => !r.success && r.gate.isRequired);
  process.exit(hasRequiredFailures ? 1 : 0);
}

main().catch((err) => {
  console.error('\x1b[31mFatal error:\x1b[0m', err);
  process.exit(1);
});
