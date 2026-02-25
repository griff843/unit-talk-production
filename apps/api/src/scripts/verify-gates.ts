#!/usr/bin/env tsx
/* eslint-disable max-lines-per-function, complexity */
/**
 * CI Gates Verification Script
 * Sprint: SPRINT-B3-OUTBOX-DETERMINISM-002
 * Purpose: Verify deployment gates pass before production release
 *
 * Gates:
 *   1. Outbox Health - No stale events (> 2 min), no dead-letter events
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/verify-gates.ts
 *   npx tsx apps/api/src/scripts/verify-gates.ts --strict
 *
 * Exit codes:
 *   0: All gates passed
 *   1: One or more gates failed
 *   2: Script error
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Force TypeScript to treat this as a module (not a script)
export {};

// ============================================================
// Types
// ============================================================

interface GateResult {
  name: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

interface GatesReport {
  generated_at: string;
  environment: string;
  all_passed: boolean;
  gates: GateResult[];
}

// ============================================================
// Constants
// ============================================================

// OUTBOX-002 requirement: 2 minute max pending age
const MAX_PENDING_AGE_MS = 2 * 60 * 1000;
// OUTBOX-002 requirement: 5 retry cap
const MAX_RETRY_COUNT = 5;

// ============================================================
// Gate Implementations
// ============================================================

/**
 * Gate 1: Outbox Health
 * Checks bridge_outbox for stale and dead-letter events.
 * Per OUTBOX-002: max pending age 2 min, retry cap 5.
 */
async function checkOutboxHealthGate(supabase: SupabaseClient): Promise<GateResult> {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - MAX_PENDING_AGE_MS);

  // Count stale events (pending > 2 minutes)
  const { data: staleData, error: staleError } = await supabase
    .from('bridge_outbox')
    .select('id', { count: 'exact' })
    .in('status', ['pending', 'processing'])
    .lt('created_at', staleThreshold.toISOString());

  if (staleError) {
    return {
      name: 'Outbox Health',
      passed: false,
      message: `Error checking stale events: ${staleError.message}`,
    };
  }

  const staleCount = staleData?.length || 0;

  // Count dead-letter events (failed or retry >= 5)
  const { data: deadLetterData, error: deadLetterError } = await supabase
    .from('bridge_outbox')
    .select('id', { count: 'exact' })
    .or(`status.eq.failed,retry_count.gte.${MAX_RETRY_COUNT}`);

  if (deadLetterError) {
    return {
      name: 'Outbox Health',
      passed: false,
      message: `Error checking dead-letter events: ${deadLetterError.message}`,
    };
  }

  const deadLetterCount = deadLetterData?.length || 0;

  // Determine pass/fail
  const passed = staleCount === 0 && deadLetterCount === 0;

  let message: string;
  if (passed) {
    message = 'Outbox healthy - no stale or dead-letter events';
  } else {
    const issues: string[] = [];
    if (staleCount > 0) {
      issues.push(`${staleCount} stale events (> 2 min pending)`);
    }
    if (deadLetterCount > 0) {
      issues.push(`${deadLetterCount} dead-letter events`);
    }
    message = issues.join(', ');
  }

  return {
    name: 'Outbox Health',
    passed,
    message,
    details: {
      stale_count: staleCount,
      dead_letter_count: deadLetterCount,
      max_pending_age_ms: MAX_PENDING_AGE_MS,
      max_retry_count: MAX_RETRY_COUNT,
    },
  };
}

// ============================================================
// Main
// ============================================================

async function runGatesVerification(): Promise<void> {
  const args = process.argv.slice(2);
  const strictMode = args.includes('--strict');

  console.log('='.repeat(60));
  console.log('CI Gates Verification');
  console.log('Sprint: SPRINT-B3-OUTBOX-DETERMINISM-002');
  console.log('='.repeat(60));

  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('\n[ERROR] SUPABASE_URL and SUPABASE_SERVICE_KEY required');
    console.log('\n[GATES] Status: ERROR - Missing environment variables');
    process.exit(2);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const report: GatesReport = {
    generated_at: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    all_passed: true,
    gates: [],
  };

  // Run all gates
  console.log('\n[INFO] Running gates verification...\n');

  // Gate 1: Outbox Health
  try {
    const outboxGate = await checkOutboxHealthGate(supabase);
    report.gates.push(outboxGate);
    if (!outboxGate.passed) {
      report.all_passed = false;
    }
    console.log(`Gate 1: Outbox Health`);
    console.log(`  Status: ${outboxGate.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Message: ${outboxGate.message}`);
    if (outboxGate.details) {
      console.log(
        `  Details: stale=${outboxGate.details.stale_count}, dead_letter=${outboxGate.details.dead_letter_count}`
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    report.gates.push({
      name: 'Outbox Health',
      passed: false,
      message: `Gate error: ${errorMessage}`,
    });
    report.all_passed = false;
    console.log(`Gate 1: Outbox Health`);
    console.log(`  Status: ❌ ERROR`);
    console.log(`  Message: ${errorMessage}`);
  }

  // Write report to file
  const outDir = path.resolve(process.cwd(), 'out/ops');
  try {
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'GATES_REPORT.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`\n[INFO] Report written to: ${outPath}`);
  } catch {
    console.log('\n[WARN] Could not write report to file');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  if (report.all_passed) {
    console.log('[SUCCESS] All gates verified successfully');
    console.log('[GATES] Status: PASSED');
    console.log('='.repeat(60));
    process.exit(0);
  } else {
    console.log('[FAILURE] One or more gates failed');
    console.log('[GATES] Status: FAILED');
    console.log('='.repeat(60));

    if (strictMode) {
      console.log('\n[STRICT MODE] Exiting with code 1');
      process.exit(1);
    } else {
      console.log('\n[NON-STRICT MODE] Exiting with code 0');
      process.exit(0);
    }
  }
}

runGatesVerification();
