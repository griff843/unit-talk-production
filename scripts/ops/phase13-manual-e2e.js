#!/usr/bin/env node
/* eslint-disable no-console, max-lines-per-function, max-lines, complexity, security/detect-object-injection, no-empty, max-depth, security/detect-non-literal-fs-filename */
/**
 * Phase 13 Manual E2E Validation - Phase 15 Enhanced
 * Tests leagues (NBA, NFL, MLB, NHL) with DRY-RUN + LIVE modes
 *
 * Features:
 * - Retry logic with exponential backoff
 * - Parallel and serial execution modes
 * - Schema error detection with automatic PostgREST reload
 * - Timeout handling
 * - Machine-readable JSON output
 * - Per-league detailed reporting
 *
 * Usage:
 *   node phase13-manual-e2e.js [--league LEAGUE] [--mode MODE] [--retries N] [--parallel] [--timeout MS] [--json]
 *
 * Options:
 *   --league LEAGUE   Single league to test (default: all - NBA,NFL,MLB,NHL)
 *   --mode MODE       Test mode: dry-run, live, or both (default: both)
 *   --retries N       Number of retry attempts (default: 1)
 *   --parallel        Run leagues in parallel (default: serial)
 *   --timeout MS      Request timeout in milliseconds (default: 10000)
 *   --json            Output JSON only (no logs)
 *
 * Exit codes:
 *   0 - All tests passed
 *   1 - One or more tests failed
 *
 * @date 2025-10-31
 * @charter docs/PRODUCTION_CHARTER.md v3.0
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { createClient } = require('@supabase/supabase-js');

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

const args = process.argv.slice(2);
const flags = {
  league: null, // null = all leagues
  mode: 'both', // dry-run, live, or both
  retries: 1,
  parallel: false,
  timeout: 10000,
  json: false,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--league' && args[i + 1]) {
    flags.league = args[i + 1].toUpperCase();
    i++;
  } else if (args[i] === '--mode' && args[i + 1]) {
    flags.mode = args[i + 1].toLowerCase();
    i++;
  } else if (args[i] === '--retries' && args[i + 1]) {
    flags.retries = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--parallel') {
    flags.parallel = true;
  } else if (args[i] === '--timeout' && args[i + 1]) {
    flags.timeout = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--json') {
    flags.json = true;
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_USER_ID = '012602a5-52e8-457e-838e-45f0f43edfc3'; // E2E_TestCapper
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a';
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3010';

const ALL_LEAGUES = ['NBA', 'NFL', 'MLB', 'NHL'];
const LEAGUES_TO_TEST = flags.league ? [flags.league] : ALL_LEAGUES;

const LEAGUE_PAYLOADS = {
  NBA: {
    sport: 'NBA',
    player_name: 'LeBron James',
    stat_type: 'points',
    line: 25.5,
    selection: 'over',
    odds: -110,
    confidence: 8,
  },
  NFL: {
    sport: 'NFL',
    player_name: 'Patrick Mahomes',
    stat_type: 'passing_yards',
    line: 275.5,
    selection: 'over',
    odds: -115,
    confidence: 7,
  },
  MLB: {
    sport: 'MLB',
    player_name: 'Shohei Ohtani',
    stat_type: 'hits',
    line: 1.5,
    selection: 'over',
    odds: -120,
    confidence: 9,
  },
  NHL: {
    sport: 'NHL',
    player_name: 'Connor McDavid',
    stat_type: 'points',
    line: 1.5,
    selection: 'over',
    odds: -105,
    confidence: 8,
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function log(level, message, data = {}) {
  if (flags.json) return;
  const prefix =
    level === 'error' ? '❌' : level === 'warn' ? '⚠️ ' : level === 'success' ? '✅' : 'ℹ️ ';
  const dataStr = Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '';
  console.log(`${prefix} [E2E] ${message}`, dataStr);
}

function outputResult(result) {
  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if error is schema-related (column/relation does not exist)
function isSchemaError(error) {
  if (!error) return false;
  const message = typeof error === 'string' ? error : error.message || error.msg || '';
  return /(column|relation).+(does not exist|unknown)|PGRST204|PGRST205/i.test(message);
}

// Trigger PostgREST reload via the enhanced script
async function triggerPostgrestReload(reason) {
  log('info', `Triggering PostgREST reload (reason: ${reason})`);

  try {
    // Call pgrst_reload() RPC
    const { data, error } = await supabase.rpc('pgrst_reload');

    if (error) {
      log('warn', 'PostgREST reload via RPC failed', { error: error.message });
      return { success: false, error: error.message };
    }

    log('success', 'PostgREST reload successful', { reloadId: data?.reload_id });

    // Wait for schema propagation
    await sleep(2000);

    return { success: true, reloadId: data?.reload_id };
  } catch (err) {
    log('error', 'PostgREST reload error', { error: err.message });
    return { success: false, error: err.message };
  }
}

// ============================================================================
// TEST EXECUTION
// ============================================================================

async function testDryRun(league, payload) {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), flags.timeout);

    const response = await fetch(`${API_BASE}/api/domain/picks/dry-run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const duration = Date.now() - start;
    const status = response.status === 204 || response.status === 200 ? 'PASS' : 'FAIL';

    let errorBody = null;
    if (status === 'FAIL') {
      try {
        errorBody = await response.text();
      } catch {
        // Ignore parse errors
      }
    }

    return {
      status,
      httpStatus: response.status,
      duration,
      error: errorBody,
    };
  } catch (err) {
    const duration = Date.now() - start;
    return {
      status: 'FAIL',
      httpStatus: 0,
      duration,
      error: err.message,
    };
  }
}

async function testLiveInsert(league, payload) {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), flags.timeout);

    const response = await fetch(`${API_BASE}/api/domain/picks/insert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const duration = Date.now() - start;
    const body = await response.json();

    const status = response.status >= 200 && response.status < 300 ? 'PASS' : 'FAIL';

    return {
      status,
      httpStatus: response.status,
      duration,
      pickId: body.pickId || body.pick?.id,
      body,
      schemaError: isSchemaError(body.error || body.message),
    };
  } catch (err) {
    const duration = Date.now() - start;
    return {
      status: 'FAIL',
      httpStatus: 0,
      duration,
      error: err.message,
      schemaError: isSchemaError(err),
    };
  }
}

async function verifyPickInDatabase(pickId) {
  try {
    const { data, error } = await supabase
      .from('picks')
      .select('id, sport, selection, workflow_stage, status')
      .eq('id', pickId)
      .single();

    if (error) {
      return { verified: false, error: error.message };
    }

    return { verified: true, pick: data };
  } catch (err) {
    return { verified: false, error: err.message };
  }
}

async function verifyPublishOutbox(pickId) {
  try {
    const { data, error } = await supabase
      .from('pick_publish')
      .select('status, channel, attempts')
      .eq('pick_id', pickId)
      .maybeSingle();

    if (error) {
      return { found: false, error: error.message };
    }

    if (!data) {
      return { found: false, message: 'No outbox entry (may be expected if SHADOW_MODE=true)' };
    }

    return { found: true, outbox: data };
  } catch (err) {
    return { found: false, error: err.message };
  }
}

// ============================================================================
// LEAGUE TEST WITH RETRY LOGIC
// ============================================================================

async function testLeague(league, retryCount = 0) {
  const maxRetries = flags.retries;

  log('info', `[${league}] Starting test (attempt ${retryCount + 1}/${maxRetries + 1})`);

  const result = {
    league,
    attempt: retryCount + 1,
    dryRun: { status: 'NOT_RUN' },
    live: { status: 'NOT_RUN' },
    verification: { status: 'NOT_RUN' },
    outbox: { status: 'NOT_RUN' },
    errors: [],
  };

  try {
    // DRY-RUN Test
    if (flags.mode === 'dry-run' || flags.mode === 'both') {
      const payload = {
        ...LEAGUE_PAYLOADS[league],
        user_id: TEST_USER_ID,
        tenant_id: DEFAULT_TENANT_ID,
        idempotency_key: `e2e-${league}-dryrun-${Date.now()}`,
      };

      result.dryRun = await testDryRun(league, payload);

      if (result.dryRun.status === 'PASS') {
        log('success', `[${league}] DRY-RUN PASS (${result.dryRun.duration}ms)`);
      } else {
        log('error', `[${league}] DRY-RUN FAIL`, { error: result.dryRun.error });
        result.errors.push('dry_run_failed');
      }
    }

    // LIVE Test
    if (flags.mode === 'live' || flags.mode === 'both') {
      const payload = {
        ...LEAGUE_PAYLOADS[league],
        user_id: TEST_USER_ID,
        tenant_id: DEFAULT_TENANT_ID,
        idempotency_key: `e2e-${league}-live-${Date.now()}`,
        bet_slip_id: `e2e-${league}-slip-${Date.now()}`,
      };

      result.live = await testLiveInsert(league, payload);

      // Check for schema error and trigger reload if needed
      if (result.live.schemaError && retryCount < maxRetries) {
        log('warn', `[${league}] Schema error detected - triggering PostgREST reload`);

        const reloadResult = await triggerPostgrestReload(`schema_error_${league}`);

        if (reloadResult.success) {
          log('info', `[${league}] Retrying after successful reload`);
          return await testLeague(league, retryCount + 1);
        } else {
          result.errors.push('reload_failed');
          log('error', `[${league}] PostgREST reload failed - cannot retry`);
        }
      }

      if (result.live.status === 'PASS') {
        log(
          'success',
          `[${league}] LIVE INSERT PASS (${result.live.duration}ms) - Pick ID: ${result.live.pickId}`
        );

        // Verify pick in database
        if (result.live.pickId) {
          await sleep(500); // Brief wait for propagation

          result.verification = await verifyPickInDatabase(result.live.pickId);

          if (result.verification.verified) {
            log('success', `[${league}] Database verification PASS`);
          } else {
            log('warn', `[${league}] Database verification FAIL`, {
              error: result.verification.error,
            });
            result.errors.push('db_verification_failed');
          }

          // Check publish outbox
          await sleep(1000);
          result.outbox = await verifyPublishOutbox(result.live.pickId);

          if (result.outbox.found) {
            log(
              'success',
              `[${league}] Outbox verification PASS - Status: ${result.outbox.outbox.status}`
            );
          } else {
            log('warn', `[${league}] Outbox not found (may be expected)`, {
              message: result.outbox.message,
            });
          }
        }
      } else {
        log('error', `[${league}] LIVE INSERT FAIL`, {
          httpStatus: result.live.httpStatus,
          error: result.live.error || result.live.body,
        });
        result.errors.push('live_insert_failed');

        // Retry if schema error and retries available
        if (result.live.schemaError && retryCount < maxRetries) {
          log('info', `[${league}] Retrying (${retryCount + 1}/${maxRetries})`);
          return await testLeague(league, retryCount + 1);
        }
      }
    }
  } catch (error) {
    log('error', `[${league}] Fatal error during test`, { error: error.message });
    result.errors.push('fatal_error');
    result.fatalError = error.message;
  }

  return result;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const startTime = Date.now();

  if (!flags.json) {
    console.log('\n' + '╔' + '═'.repeat(78) + '╗');
    console.log('║' + ' '.repeat(20) + 'PHASE 13 E2E VALIDATION - Phase 15' + ' '.repeat(24) + '║');
    console.log('╚' + '═'.repeat(78) + '╝\n');
    console.log(`Test User: ${TEST_USER_ID}`);
    console.log(`Tenant: ${DEFAULT_TENANT_ID}`);
    console.log(`API Base: ${API_BASE}`);
    console.log(`Leagues: ${LEAGUES_TO_TEST.join(', ')}`);
    console.log(`Mode: ${flags.mode}`);
    console.log(`Retries: ${flags.retries}`);
    console.log(`Parallel: ${flags.parallel}`);
    console.log(`Timeout: ${flags.timeout}ms\n`);
  }

  const results = {
    timestamp: new Date().toISOString(),
    config: {
      leagues: LEAGUES_TO_TEST,
      mode: flags.mode,
      retries: flags.retries,
      parallel: flags.parallel,
      timeout: flags.timeout,
    },
    leagues: {},
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
    },
  };

  // Execute tests (parallel or serial)
  if (flags.parallel) {
    log('info', 'Running tests in PARALLEL mode');
    const promises = LEAGUES_TO_TEST.map(league => testLeague(league));
    const leagueResults = await Promise.all(promises);

    leagueResults.forEach((result, index) => {
      results.leagues[LEAGUES_TO_TEST[index]] = result;
    });
  } else {
    log('info', 'Running tests in SERIAL mode');
    for (const league of LEAGUES_TO_TEST) {
      const result = await testLeague(league);
      results.leagues[league] = result;
      await sleep(500); // Brief pause between leagues in serial mode
    }
  }

  // Calculate summary
  for (const league of LEAGUES_TO_TEST) {
    const result = results.leagues[league];
    results.summary.total++;

    const dryRunPassed = flags.mode === 'live' || result.dryRun.status === 'PASS';
    const livePassed = flags.mode === 'dry-run' || result.live.status === 'PASS';

    if (dryRunPassed && livePassed) {
      results.summary.passed++;
    } else {
      results.summary.failed++;
    }
  }

  const duration = Date.now() - startTime;
  results.totalDurationMs = duration;

  // Save results to file
  const outputDir = path.join(process.cwd(), 'out/ops/cutover/metrics/phase15/e2e');
  fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `e2e_results_${timestamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  // Output results
  outputResult(results);

  if (!flags.json) {
    console.log('\n' + '╔' + '═'.repeat(78) + '╗');
    console.log('║' + ' '.repeat(30) + 'SUMMARY' + ' '.repeat(41) + '║');
    console.log('╚' + '═'.repeat(78) + '╝\n');
    console.log(`Total Leagues: ${results.summary.total}`);
    console.log(`Passed: ${results.summary.passed}`);
    console.log(`Failed: ${results.summary.failed}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`\nResults saved: ${outputPath}\n`);
  }

  process.exit(results.summary.failed > 0 ? 1 : 0);
}

main().catch(error => {
  const output = {
    success: false,
    error: 'fatal_error',
    message: error.message,
    stack: error.stack,
  };
  outputResult(output);
  log('error', 'Fatal error during E2E test', { error: error.message });
  process.exit(1);
});
