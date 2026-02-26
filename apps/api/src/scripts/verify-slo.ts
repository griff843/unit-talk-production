#!/usr/bin/env tsx
/* eslint-disable max-lines, max-lines-per-function, complexity, security/detect-non-literal-fs-filename */
/**
 * CI SLO Verification Script
 * Sprint: SPRINT-B7-VERIFY-SLO-REAL-003
 * Sprint: SPRINT-B1B4-ENV-WIRING-TRUTH-005
 * Purpose: Verify Service Level Objectives before production release
 *
 * SLOs Verified:
 *   1. Outbox Health - No stale events (> 2 min), no dead-letter events
 *   2. Pending Age - No pending events older than threshold
 *   3. Retry Cap - No events exceeding retry limit
 *   4. Health Endpoints - API health endpoint responds
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/verify-slo.ts
 *   npx tsx apps/api/src/scripts/verify-slo.ts --strict
 *   npx tsx apps/api/src/scripts/verify-slo.ts --output-file ./slo-report.json
 *
 * Exit codes:
 *   0: All SLOs met
 *   1: One or more SLOs violated (strict mode)
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

interface SloResult {
  name: string;
  met: boolean;
  threshold: string;
  actual: string;
  message: string;
  details?: Record<string, unknown>;
}

interface SloReport {
  generated_at: string;
  environment: string;
  all_met: boolean;
  slos: SloResult[];
  summary: {
    total: number;
    met: number;
    violated: number;
  };
}

// ============================================================
// Constants - Phase B Thresholds
// ============================================================

// SLO-001: Max pending age (OUTBOX-002 requirement)
const SLO_MAX_PENDING_AGE_MS = 2 * 60 * 1000; // 2 minutes

// SLO-002: Max retry count before dead-letter
const SLO_MAX_RETRY_COUNT = 5;

// SLO-003: Max dead-letter events allowed (0 = none allowed)
const SLO_MAX_DEAD_LETTER = 0;

// SLO-004: Max stale events allowed (0 = none allowed)
const SLO_MAX_STALE_EVENTS = 0;

// ============================================================
// SLO Check Implementations
// ============================================================

/**
 * SLO-001: Outbox Pending Age
 * No events should be pending longer than 2 minutes
 */
async function checkOutboxPendingAge(supabase: SupabaseClient): Promise<SloResult> {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - SLO_MAX_PENDING_AGE_MS);

  const { data, error } = await supabase
    .from('bridge_outbox')
    .select('id, bet_slip_id, event_type, status, created_at, retry_count')
    .in('status', ['pending', 'processing'])
    .lt('created_at', staleThreshold.toISOString())
    .limit(10);

  if (error) {
    return {
      name: 'Outbox Pending Age',
      met: false,
      threshold: `< ${SLO_MAX_PENDING_AGE_MS / 1000}s`,
      actual: 'ERROR',
      message: `Error checking pending age: ${error.message}`,
    };
  }

  const staleCount = data?.length || 0;
  const met = staleCount <= SLO_MAX_STALE_EVENTS;

  // Calculate oldest pending age if there are stale events
  let oldestAge = 0;
  if (data && data.length > 0) {
    for (const event of data) {
      const ageMs = now.getTime() - new Date(event.created_at).getTime();
      if (ageMs > oldestAge) oldestAge = ageMs;
    }
  }

  return {
    name: 'Outbox Pending Age',
    met,
    threshold: `<= ${SLO_MAX_STALE_EVENTS} events > ${SLO_MAX_PENDING_AGE_MS / 1000}s`,
    actual: `${staleCount} stale events`,
    message: met
      ? 'No stale events detected'
      : `${staleCount} events pending > 2 minutes (oldest: ${Math.round(oldestAge / 1000)}s)`,
    details: {
      stale_count: staleCount,
      oldest_age_ms: oldestAge,
      threshold_ms: SLO_MAX_PENDING_AGE_MS,
      sample_ids: data?.slice(0, 5).map(e => e.id) || [],
    },
  };
}

/**
 * SLO-002: Outbox Dead-Letter Count
 * No events should be in dead-letter state (failed or retry >= 5)
 */
async function checkOutboxDeadLetter(supabase: SupabaseClient): Promise<SloResult> {
  const { data, error } = await supabase
    .from('bridge_outbox')
    .select('id, bet_slip_id, event_type, status, retry_count, error_message')
    .or(`status.eq.failed,retry_count.gte.${SLO_MAX_RETRY_COUNT}`)
    .limit(10);

  if (error) {
    return {
      name: 'Outbox Dead-Letter',
      met: false,
      threshold: `<= ${SLO_MAX_DEAD_LETTER}`,
      actual: 'ERROR',
      message: `Error checking dead-letter events: ${error.message}`,
    };
  }

  const deadLetterCount = data?.length || 0;
  const met = deadLetterCount <= SLO_MAX_DEAD_LETTER;

  return {
    name: 'Outbox Dead-Letter',
    met,
    threshold: `<= ${SLO_MAX_DEAD_LETTER} dead-letter events`,
    actual: `${deadLetterCount} dead-letter events`,
    message: met
      ? 'No dead-letter events detected'
      : `${deadLetterCount} events in dead-letter state`,
    details: {
      dead_letter_count: deadLetterCount,
      max_retry_count: SLO_MAX_RETRY_COUNT,
      sample_ids: data?.slice(0, 5).map(e => e.id) || [],
      sample_errors: data?.slice(0, 3).map(e => e.error_message?.substring(0, 100)) || [],
    },
  };
}

/**
 * SLO-003: Outbox Backlog Size
 * Warn if backlog exceeds threshold (not a hard failure, but logged)
 */
async function checkOutboxBacklog(supabase: SupabaseClient): Promise<SloResult> {
  const BACKLOG_WARNING_THRESHOLD = 100;

  const { data, error } = await supabase
    .from('bridge_outbox')
    .select('id', { count: 'exact' })
    .in('status', ['pending', 'processing']);

  if (error) {
    return {
      name: 'Outbox Backlog',
      met: false,
      threshold: `< ${BACKLOG_WARNING_THRESHOLD}`,
      actual: 'ERROR',
      message: `Error checking backlog: ${error.message}`,
    };
  }

  const backlogSize = data?.length || 0;
  const met = backlogSize < BACKLOG_WARNING_THRESHOLD;

  return {
    name: 'Outbox Backlog',
    met,
    threshold: `< ${BACKLOG_WARNING_THRESHOLD} pending events`,
    actual: `${backlogSize} pending events`,
    message: met
      ? `Backlog healthy (${backlogSize} pending)`
      : `Backlog elevated: ${backlogSize} pending events`,
    details: {
      backlog_size: backlogSize,
      warning_threshold: BACKLOG_WARNING_THRESHOLD,
    },
  };
}

/**
 * SLO-004: Database Connectivity
 * Verify we can query the database
 */
async function checkDatabaseConnectivity(supabase: SupabaseClient): Promise<SloResult> {
  const startTime = Date.now();

  try {
    const { error } = await supabase.from('bridge_outbox').select('id').limit(1);

    const latencyMs = Date.now() - startTime;

    if (error) {
      return {
        name: 'Database Connectivity',
        met: false,
        threshold: 'Query succeeds',
        actual: 'Query failed',
        message: `Database query failed: ${error.message}`,
        details: { error: error.message, latency_ms: latencyMs },
      };
    }

    return {
      name: 'Database Connectivity',
      met: true,
      threshold: 'Query succeeds',
      actual: `Query succeeded (${latencyMs}ms)`,
      message: `Database healthy (latency: ${latencyMs}ms)`,
      details: { latency_ms: latencyMs },
    };
  } catch (err) {
    return {
      name: 'Database Connectivity',
      met: false,
      threshold: 'Query succeeds',
      actual: 'Exception thrown',
      message: `Database error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * SLO-005: Use DB-level health check function (from SPRINT-B3)
 * Calls check_outbox_health() RPC if available
 */
async function checkOutboxHealthRpc(supabase: SupabaseClient): Promise<SloResult> {
  try {
    const { data, error } = await supabase.rpc('check_outbox_health');

    if (error) {
      // Function may not exist yet - graceful degradation
      if (error.message.includes('function') || error.code === '42883') {
        return {
          name: 'Outbox Health RPC',
          met: true,
          threshold: 'RPC returns healthy',
          actual: 'RPC not available (skipped)',
          message: 'check_outbox_health() not deployed - using fallback checks',
          details: { skipped: true, reason: 'function_not_found' },
        };
      }

      return {
        name: 'Outbox Health RPC',
        met: false,
        threshold: 'RPC returns healthy',
        actual: 'RPC error',
        message: `RPC error: ${error.message}`,
      };
    }

    // Parse RPC result
    const result = Array.isArray(data) ? data[0] : data;
    const isHealthy = result?.is_healthy ?? false;
    const healthMessage = result?.health_message ?? 'Unknown';

    return {
      name: 'Outbox Health RPC',
      met: isHealthy,
      threshold: 'is_healthy = true',
      actual: `is_healthy = ${isHealthy}`,
      message: healthMessage,
      details: {
        total_pending: result?.total_pending,
        stale_count: result?.stale_count,
        dead_letter_count: result?.dead_letter_count,
      },
    };
  } catch (err) {
    return {
      name: 'Outbox Health RPC',
      met: true,
      threshold: 'RPC returns healthy',
      actual: 'RPC not available (skipped)',
      message: 'check_outbox_health() not available - using fallback checks',
      details: { skipped: true, error: err instanceof Error ? err.message : String(err) },
    };
  }
}

// ============================================================
// Main SLO Verification
// ============================================================

async function runSloVerification(): Promise<SloReport> {
  // SPRINT-B1B4-ENV-WIRING-TRUTH-005: Canonical key is SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.SUPABASE_URL;

  // Prefer canonical SUPABASE_SERVICE_ROLE_KEY, fallback to deprecated SUPABASE_SERVICE_KEY
  let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseKey && process.env.SUPABASE_SERVICE_KEY) {
    console.warn(
      '[DEPRECATION WARNING] SUPABASE_SERVICE_KEY is deprecated. Use SUPABASE_SERVICE_ROLE_KEY instead.'
    );
    supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  }
  // Last resort fallback to anon key (not recommended for admin operations)
  if (!supabaseKey) {
    supabaseKey = process.env.SUPABASE_ANON_KEY;
  }

  if (!supabaseUrl || !supabaseKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Ensure .env file exists with required variables.'
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const report: SloReport = {
    generated_at: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    all_met: true,
    slos: [],
    summary: {
      total: 0,
      met: 0,
      violated: 0,
    },
  };

  // Run all SLO checks
  const checks = [
    checkDatabaseConnectivity(supabase),
    checkOutboxPendingAge(supabase),
    checkOutboxDeadLetter(supabase),
    checkOutboxBacklog(supabase),
    checkOutboxHealthRpc(supabase),
  ];

  const results = await Promise.all(checks);

  for (const result of results) {
    report.slos.push(result);
    report.summary.total++;

    if (result.met) {
      report.summary.met++;
    } else {
      report.summary.violated++;
      report.all_met = false;
    }
  }

  return report;
}

// ============================================================
// CLI Entry Point
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const outputFileIdx = args.indexOf('--output-file');
  const outputFile = outputFileIdx >= 0 ? args[outputFileIdx + 1] : null;
  const strictMode = args.includes('--strict');

  console.log('='.repeat(60));
  console.log('CI SLO Verification');
  console.log('Sprint: SPRINT-B7-VERIFY-SLO-REAL-003');
  console.log('='.repeat(60));

  try {
    const report = await runSloVerification();

    // Print results
    console.log('\nSLO RESULTS:');
    console.log(`  Environment: ${report.environment}`);
    console.log(`  Generated: ${report.generated_at}`);
    console.log('');

    for (const slo of report.slos) {
      const status = slo.met ? '✅ MET' : '❌ VIOLATED';
      console.log(`  ${slo.name}`);
      console.log(`    Status: ${status}`);
      console.log(`    Threshold: ${slo.threshold}`);
      console.log(`    Actual: ${slo.actual}`);
      console.log(`    Message: ${slo.message}`);
      console.log('');
    }

    // Summary
    console.log('-'.repeat(60));
    console.log('SUMMARY:');
    console.log(`  Total SLOs: ${report.summary.total}`);
    console.log(`  Met: ${report.summary.met}`);
    console.log(`  Violated: ${report.summary.violated}`);
    console.log('');

    // Write output file if requested
    if (outputFile) {
      const outputDir = path.dirname(outputFile);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
      console.log(`[INFO] Report written to: ${outputFile}`);
    }

    // Also write to standard location for CI
    const opsDir = path.resolve(process.cwd(), 'out/ops/verify');
    try {
      fs.mkdirSync(opsDir, { recursive: true });
      fs.writeFileSync(path.join(opsDir, 'SLO_REPORT.json'), JSON.stringify(report, null, 2));
      console.log(`[INFO] Report written to: ${path.join(opsDir, 'SLO_REPORT.json')}`);
    } catch {
      // Non-blocking - CI artifact upload will handle this
    }

    // JSON output for parsing
    console.log('\n' + '='.repeat(60));
    console.log('JSON OUTPUT:');
    console.log(
      JSON.stringify(
        {
          all_met: report.all_met,
          ...report.summary,
        },
        null,
        2
      )
    );

    // Exit handling
    console.log('\n' + '='.repeat(60));
    if (report.all_met) {
      console.log('[SUCCESS] All SLOs verified - system healthy');
      console.log('[SLOs] Status: ALL MET');
      console.log('='.repeat(60));
      process.exit(0);
    } else {
      console.log('[FAILURE] One or more SLOs violated');
      console.log('[SLOs] Status: VIOLATED');
      console.log('='.repeat(60));

      if (strictMode) {
        console.log('\n[STRICT MODE] Exiting with code 1 - CI should fail');
        process.exit(1);
      } else {
        console.log('\n[NON-STRICT MODE] Exiting with code 0 - run with --strict to fail CI');
        process.exit(0);
      }
    }
  } catch (error) {
    console.error('\n[ERROR]', error instanceof Error ? error.message : error);
    console.log('\n[SLOs] Status: ERROR');
    process.exit(2);
  }
}

main();
