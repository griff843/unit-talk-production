#!/usr/bin/env tsx
/* eslint-disable max-lines-per-function, complexity */
/**
 * CI Gates Verification Script
 * Sprint: SPRINT-B3-OUTBOX-DETERMINISM-002
 * Sprint: SPRINT-B4-DISCORD-CANARY-ROUTING-004
 * Sprint: SPRINT-B1B4-ENV-WIRING-TRUTH-005
 * Purpose: Verify deployment gates pass before production release
 *
 * Gates:
 *   1. Outbox Health - No stale events (> 2 min), no dead-letter events
 *   2. Discord Routing - Mode configured and appropriate webhooks set
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

import {
  validateDiscordRoutingConfig,
  resolveDiscordRoutingConfig,
} from '../config/discordRouting';

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

/**
 * Gate 2: Discord Routing
 * Checks DISCORD_MODE is set and appropriate webhooks are configured.
 * Per SPRINT-B4: mode=canary requires canary URL, mode=production requires all channel URLs.
 * Per SPRINT-B1B4-ENV-WIRING-TRUTH-005: Pass with warning when Discord not configured (mode not set).
 */
function checkDiscordRoutingGate(): GateResult {
  const config = resolveDiscordRoutingConfig();

  // If Discord mode is not set, pass with a warning (Discord not intended to be used)
  if (!config.mode) {
    return {
      name: 'Discord Routing',
      passed: true,
      message: 'Discord not configured (DISCORD_MODE not set) - skipping validation',
      details: {
        mode: 'NOT SET',
        note: 'Set DISCORD_MODE=canary or DISCORD_MODE=production to enable Discord routing',
      },
    };
  }

  // Discord mode is set - validate the configuration
  const issues = validateDiscordRoutingConfig();

  if (issues.length === 0) {
    return {
      name: 'Discord Routing',
      passed: true,
      message: `Discord routing configured correctly (mode: ${config.mode})`,
      details: {
        mode: config.mode,
        has_canary_url: !!config.canaryWebhookUrl,
        production_webhooks_configured: Object.values(config.productionWebhooks).filter(Boolean)
          .length,
      },
    };
  }

  // Discord mode is set but configuration is invalid - fail
  return {
    name: 'Discord Routing',
    passed: false,
    message: issues.join('; '),
    details: {
      mode: config.mode,
      issues,
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
  // SPRINT-B1B4-ENV-WIRING-TRUTH-005: Canonical key is SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.SUPABASE_URL;

  // Prefer canonical SUPABASE_SERVICE_ROLE_KEY, fallback to deprecated SUPABASE_SERVICE_KEY
  let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseKey && process.env.SUPABASE_SERVICE_KEY) {
    console.warn(
      '\n[DEPRECATION WARNING] SUPABASE_SERVICE_KEY is deprecated. Use SUPABASE_SERVICE_ROLE_KEY instead.'
    );
    supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  }
  // Last resort fallback to anon key (not recommended for admin operations)
  if (!supabaseKey) {
    supabaseKey = process.env.SUPABASE_ANON_KEY;
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error('\n[ERROR] Missing required environment variables:');
    if (!supabaseUrl) console.error('  - SUPABASE_URL');
    if (!supabaseKey) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    console.log('\n[GATES] Status: ERROR - Missing environment variables');
    console.log(
      '\nEnsure .env file exists with required variables, or set them in your environment.'
    );
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

  // Gate 2: Discord Routing (SPRINT-B4-DISCORD-CANARY-ROUTING-004)
  try {
    const discordGate = checkDiscordRoutingGate();
    report.gates.push(discordGate);
    if (!discordGate.passed) {
      report.all_passed = false;
    }
    console.log(`\nGate 2: Discord Routing`);
    console.log(`  Status: ${discordGate.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Message: ${discordGate.message}`);
    if (discordGate.details) {
      console.log(`  Details: mode=${discordGate.details.mode}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    report.gates.push({
      name: 'Discord Routing',
      passed: false,
      message: `Gate error: ${errorMessage}`,
    });
    report.all_passed = false;
    console.log(`\nGate 2: Discord Routing`);
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
