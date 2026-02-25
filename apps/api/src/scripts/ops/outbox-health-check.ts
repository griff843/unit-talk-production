#!/usr/bin/env npx tsx
/* eslint-disable max-lines-per-function, complexity, security/detect-non-literal-fs-filename */
/**
 * OUTBOX HEALTH CHECK SCRIPT
 * Sprint: SPRINT-B3-OUTBOX-DETERMINISM-002
 *
 * READ-ONLY script that monitors bridge_outbox health.
 * Outputs deterministic, parseable JSON report.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/ops/outbox-health-check.ts
 *   npx tsx apps/api/src/scripts/ops/outbox-health-check.ts --strict
 *   npx tsx apps/api/src/scripts/ops/outbox-health-check.ts --output-file ./outbox-report.json
 *
 * Health Checks:
 *   - Stale events (pending > 2 min)
 *   - Dead-letter events (failed OR retry_count >= 5)
 *   - Backlog size
 *   - Oldest pending age
 *
 * Exit codes:
 *   0: Healthy (no stale or dead-letter events)
 *   1: Unhealthy (stale or dead-letter events detected)
 *   2: Error (script failure)
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

import { createClient } from '@supabase/supabase-js';

// ============================================================
// Types
// ============================================================

interface OutboxEvent {
  id: string;
  bet_slip_id: string | null;
  event_type: string;
  status: string;
  retry_count: number;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
  pending_duration_ms?: number;
}

interface OutboxHealthReport {
  generated_at: string;
  environment: string;
  is_healthy: boolean;
  summary: {
    total_pending: number;
    stale_count: number;
    dead_letter_count: number;
    oldest_pending_age_ms: number | null;
    health_message: string;
  };
  thresholds: {
    max_pending_age_ms: number;
    max_retry_count: number;
  };
  stale_events: OutboxEvent[];
  dead_letter_events: OutboxEvent[];
}

// ============================================================
// Constants
// ============================================================

// OUTBOX-002 requirement: 2 minute max pending age
const MAX_PENDING_AGE_MS = 2 * 60 * 1000; // 2 minutes
// OUTBOX-002 requirement: 5 retry cap
const MAX_RETRY_COUNT = 5;

// ============================================================
// Main Health Check Logic
// ============================================================

async function checkOutboxHealth(): Promise<OutboxHealthReport> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY/SUPABASE_ANON_KEY required');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const now = new Date();

  const report: OutboxHealthReport = {
    generated_at: now.toISOString(),
    environment: process.env.NODE_ENV || 'development',
    is_healthy: true,
    summary: {
      total_pending: 0,
      stale_count: 0,
      dead_letter_count: 0,
      oldest_pending_age_ms: null,
      health_message: 'Outbox healthy',
    },
    thresholds: {
      max_pending_age_ms: MAX_PENDING_AGE_MS,
      max_retry_count: MAX_RETRY_COUNT,
    },
    stale_events: [],
    dead_letter_events: [],
  };

  // --------------------------------------------------------
  // 1. Count total pending events
  // --------------------------------------------------------
  const { data: pendingData, error: pendingError } = await supabase
    .from('bridge_outbox')
    .select('id, created_at')
    .in('status', ['pending', 'processing']);

  if (pendingError) {
    console.error('Error fetching pending events:', pendingError.message);
  }

  if (pendingData) {
    report.summary.total_pending = pendingData.length;

    // Calculate oldest pending age
    if (pendingData.length > 0) {
      let oldestAge = 0;
      for (const event of pendingData) {
        const createdAt = new Date(event.created_at);
        const ageMs = now.getTime() - createdAt.getTime();
        if (ageMs > oldestAge) {
          oldestAge = ageMs;
        }
      }
      report.summary.oldest_pending_age_ms = oldestAge;
    }
  }

  // --------------------------------------------------------
  // 2. Detect stale events (pending > 2 minutes)
  // --------------------------------------------------------
  const staleThreshold = new Date(now.getTime() - MAX_PENDING_AGE_MS);

  const { data: staleData, error: staleError } = await supabase
    .from('bridge_outbox')
    .select(
      'id, bet_slip_id, event_type, status, retry_count, error_message, created_at, processed_at'
    )
    .in('status', ['pending', 'processing'])
    .lt('created_at', staleThreshold.toISOString())
    .order('created_at', { ascending: true })
    .limit(100);

  if (staleError) {
    console.error('Error fetching stale events:', staleError.message);
  }

  if (staleData && staleData.length > 0) {
    report.is_healthy = false;
    report.summary.stale_count = staleData.length;

    for (const event of staleData) {
      const createdAt = new Date(event.created_at);
      report.stale_events.push({
        id: event.id,
        bet_slip_id: event.bet_slip_id,
        event_type: event.event_type,
        status: event.status,
        retry_count: event.retry_count || 0,
        error_message: event.error_message,
        created_at: event.created_at,
        processed_at: event.processed_at,
        pending_duration_ms: now.getTime() - createdAt.getTime(),
      });
    }
  }

  // --------------------------------------------------------
  // 3. Detect dead-letter events (failed or retry >= 5)
  // --------------------------------------------------------
  const { data: deadLetterData, error: deadLetterError } = await supabase
    .from('bridge_outbox')
    .select(
      'id, bet_slip_id, event_type, status, retry_count, error_message, created_at, processed_at'
    )
    .or(`status.eq.failed,retry_count.gte.${MAX_RETRY_COUNT}`)
    .order('created_at', { ascending: false })
    .limit(100);

  if (deadLetterError) {
    console.error('Error fetching dead-letter events:', deadLetterError.message);
  }

  if (deadLetterData && deadLetterData.length > 0) {
    report.is_healthy = false;
    report.summary.dead_letter_count = deadLetterData.length;

    for (const event of deadLetterData) {
      report.dead_letter_events.push({
        id: event.id,
        bet_slip_id: event.bet_slip_id,
        event_type: event.event_type,
        status: event.status,
        retry_count: event.retry_count || 0,
        error_message: event.error_message,
        created_at: event.created_at,
        processed_at: event.processed_at,
      });
    }
  }

  // --------------------------------------------------------
  // 4. Build health message
  // --------------------------------------------------------
  if (report.is_healthy) {
    report.summary.health_message = 'Outbox healthy';
  } else {
    const messages: string[] = [];
    if (report.summary.stale_count > 0) {
      messages.push(`${report.summary.stale_count} stale events (> 2 min pending)`);
    }
    if (report.summary.dead_letter_count > 0) {
      messages.push(`${report.summary.dead_letter_count} dead-letter events`);
    }
    report.summary.health_message = messages.join('. ');
  }

  return report;
}

// ============================================================
// Format helpers
// ============================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

// ============================================================
// CLI Entry Point
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const outputFileIdx = args.indexOf('--output-file');
  const outputFile = outputFileIdx >= 0 ? args[outputFileIdx + 1] : null;
  const strictMode = args.includes('--strict');

  console.log('========================================');
  console.log('OUTBOX HEALTH CHECK');
  console.log('Sprint: SPRINT-B3-OUTBOX-DETERMINISM-002');
  console.log('========================================\n');

  try {
    const report = await checkOutboxHealth();

    // Print summary
    console.log('SUMMARY:');
    console.log(`  Status: ${report.is_healthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
    console.log(`  Environment: ${report.environment}`);
    console.log(`  Generated at: ${report.generated_at}`);
    console.log('');
    console.log(`  Total pending: ${report.summary.total_pending}`);
    console.log(`  Stale events: ${report.summary.stale_count}`);
    console.log(`  Dead-letter events: ${report.summary.dead_letter_count}`);
    if (report.summary.oldest_pending_age_ms !== null) {
      console.log(`  Oldest pending: ${formatDuration(report.summary.oldest_pending_age_ms)}`);
    }
    console.log('');
    console.log('THRESHOLDS:');
    console.log(`  Max pending age: ${formatDuration(report.thresholds.max_pending_age_ms)}`);
    console.log(`  Max retry count: ${report.thresholds.max_retry_count}`);

    console.log('\n----------------------------------------');

    // Print stale events if any
    if (report.stale_events.length > 0) {
      console.log('\n⚠️  STALE EVENTS (pending > 2 min):');
      for (const event of report.stale_events.slice(0, 10)) {
        console.log(`  [${event.event_type}] ${event.bet_slip_id || event.id}`);
        console.log(`    Status: ${event.status}, Retries: ${event.retry_count}`);
        console.log(`    Pending: ${formatDuration(event.pending_duration_ms || 0)}`);
        if (event.error_message) {
          console.log(`    Error: ${event.error_message.substring(0, 80)}`);
        }
      }
      if (report.stale_events.length > 10) {
        console.log(`  ... and ${report.stale_events.length - 10} more`);
      }
    }

    // Print dead-letter events if any
    if (report.dead_letter_events.length > 0) {
      console.log('\n❌ DEAD-LETTER EVENTS (failed or retry >= 5):');
      for (const event of report.dead_letter_events.slice(0, 10)) {
        console.log(`  [${event.event_type}] ${event.bet_slip_id || event.id}`);
        console.log(`    Status: ${event.status}, Retries: ${event.retry_count}`);
        if (event.error_message) {
          console.log(`    Error: ${event.error_message.substring(0, 80)}`);
        }
      }
      if (report.dead_letter_events.length > 10) {
        console.log(`  ... and ${report.dead_letter_events.length - 10} more`);
      }
    }

    // Write to file if requested
    if (outputFile) {
      const outputDir = path.dirname(outputFile);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
      console.log(`\n  Report written to: ${outputFile}`);
    }

    // Output JSON summary for parsing
    console.log('\n========================================');
    console.log('JSON OUTPUT:');
    console.log(
      JSON.stringify(
        {
          is_healthy: report.is_healthy,
          ...report.summary,
        },
        null,
        2
      )
    );

    // Exit with appropriate code
    if (!report.is_healthy) {
      if (strictMode) {
        console.log('\n❌ UNHEALTHY - exiting with code 1 (strict mode)');
        process.exit(1);
      } else {
        console.log('\n⚠️  UNHEALTHY - but not in strict mode, exiting with code 0');
        process.exit(0);
      }
    }

    console.log('\n✅ HEALTHY - exiting with code 0');
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error instanceof Error ? error.message : error);
    process.exit(2);
  }
}

main();
