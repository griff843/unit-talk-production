#!/usr/bin/env npx tsx
/**
 * DRIFT DETECTION SCRIPT
 * Sprint: POSTING-SETTLEMENT-EXACTNESS-040
 *
 * READ-ONLY script that detects posting and settlement drift modes.
 * Outputs deterministic, parseable JSON report.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/ops/drift-detection.ts
 *   npx tsx apps/api/src/scripts/ops/drift-detection.ts --output-file ./drift-report.json
 *
 * Drift Modes Detected:
 *   Posting:
 *     P1: posted_to_discord = true but no meta.discord_receipt.message_id
 *     P3: promotion_posted_at set but no discord_receipt
 *     P5: bridge_outbox stuck in processing > 5 min
 *
 *   Settlement:
 *     S1: settlement_status = 'settled' but settled_at IS NULL
 *     S2: settlement_status = 'settled' but settlement_result IS NULL
 *     S3: settlement_result IS NOT NULL but settlement_status != 'settled'
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// Types
// ============================================================

interface DriftEntry {
  pick_id: string;
  drift_mode: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  details: Record<string, unknown>;
  detected_at: string;
}

interface DriftReport {
  generated_at: string;
  environment: string;
  summary: {
    total_drift: number;
    by_mode: Record<string, number>;
    by_severity: Record<string, number>;
  };
  posting_drift: DriftEntry[];
  settlement_drift: DriftEntry[];
  outbox_drift: DriftEntry[];
}

// ============================================================
// Constants
// ============================================================

const STUCK_OUTBOX_THRESHOLD_MINUTES = 5;

// ============================================================
// Main Detection Logic
// ============================================================

async function detectDrift(): Promise<DriftReport> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY/SUPABASE_ANON_KEY required');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const report: DriftReport = {
    generated_at: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    summary: {
      total_drift: 0,
      by_mode: {},
      by_severity: {},
    },
    posting_drift: [],
    settlement_drift: [],
    outbox_drift: [],
  };

  // --------------------------------------------------------
  // P1: posted_to_discord = true but no discord_receipt.message_id
  // --------------------------------------------------------
  const { data: p1Data } = await supabase
    .from('unified_picks')
    .select('id, posted_to_discord, promotion_posted_at, meta, bet_slip_id, ticket_type')
    .eq('posted_to_discord', true)
    .limit(500);

  if (p1Data) {
    for (const pick of p1Data) {
      const hasMessageId = pick.meta?.discord_receipt?.message_id;
      if (!hasMessageId) {
        report.posting_drift.push({
          pick_id: pick.id,
          drift_mode: 'P1',
          severity: 'HIGH',
          description: 'Claimed for posting but no discord_receipt.message_id',
          details: {
            posted_to_discord: pick.posted_to_discord,
            promotion_posted_at: pick.promotion_posted_at,
            ticket_type: pick.ticket_type,
            bet_slip_id: pick.bet_slip_id,
          },
          detected_at: new Date().toISOString(),
        });
      }
    }
  }

  // --------------------------------------------------------
  // P3: promotion_posted_at set but no discord_receipt
  // --------------------------------------------------------
  const { data: p3Data } = await supabase
    .from('unified_picks')
    .select('id, posted_to_discord, promotion_posted_at, meta, bet_slip_id, ticket_type')
    .not('promotion_posted_at', 'is', null)
    .limit(500);

  if (p3Data) {
    for (const pick of p3Data) {
      const hasReceipt = pick.meta?.discord_receipt;
      if (!hasReceipt) {
        // Check if not already captured by P1
        const alreadyCaptured = report.posting_drift.some(
          (d) => d.pick_id === pick.id && d.drift_mode === 'P1'
        );
        if (!alreadyCaptured) {
          report.posting_drift.push({
            pick_id: pick.id,
            drift_mode: 'P3',
            severity: 'HIGH',
            description: 'promotion_posted_at set but no discord_receipt',
            details: {
              posted_to_discord: pick.posted_to_discord,
              promotion_posted_at: pick.promotion_posted_at,
              ticket_type: pick.ticket_type,
            },
            detected_at: new Date().toISOString(),
          });
        }
      }
    }
  }

  // --------------------------------------------------------
  // P5: bridge_outbox stuck in processing
  // --------------------------------------------------------
  const stuckThreshold = new Date(Date.now() - STUCK_OUTBOX_THRESHOLD_MINUTES * 60000);
  const { data: p5Data } = await supabase
    .from('bridge_outbox')
    .select('id, bet_slip_id, status, updated_at, created_at, retry_count')
    .eq('status', 'processing')
    .lt('updated_at', stuckThreshold.toISOString())
    .limit(100);

  if (p5Data) {
    for (const outbox of p5Data) {
      report.outbox_drift.push({
        pick_id: outbox.id, // outbox id, not pick id
        drift_mode: 'P5',
        severity: 'HIGH',
        description: `bridge_outbox stuck in processing > ${STUCK_OUTBOX_THRESHOLD_MINUTES} min`,
        details: {
          outbox_id: outbox.id,
          bet_slip_id: outbox.bet_slip_id,
          status: outbox.status,
          updated_at: outbox.updated_at,
          created_at: outbox.created_at,
          retry_count: outbox.retry_count,
        },
        detected_at: new Date().toISOString(),
      });
    }
  }

  // --------------------------------------------------------
  // S1: settlement_status = 'settled' but settled_at IS NULL
  // --------------------------------------------------------
  const { data: s1Data } = await supabase
    .from('unified_picks')
    .select('id, settlement_status, settlement_result, settled_at')
    .eq('settlement_status', 'settled')
    .is('settled_at', null)
    .limit(100);

  if (s1Data) {
    for (const pick of s1Data) {
      report.settlement_drift.push({
        pick_id: pick.id,
        drift_mode: 'S1',
        severity: 'CRITICAL',
        description: 'settlement_status = settled but settled_at IS NULL',
        details: {
          settlement_status: pick.settlement_status,
          settlement_result: pick.settlement_result,
          settled_at: pick.settled_at,
        },
        detected_at: new Date().toISOString(),
      });
    }
  }

  // --------------------------------------------------------
  // S2: settlement_status = 'settled' but settlement_result IS NULL
  // --------------------------------------------------------
  const { data: s2Data } = await supabase
    .from('unified_picks')
    .select('id, settlement_status, settlement_result, settled_at')
    .eq('settlement_status', 'settled')
    .is('settlement_result', null)
    .limit(100);

  if (s2Data) {
    for (const pick of s2Data) {
      // Avoid duplicate if already captured by S1
      const alreadyCaptured = report.settlement_drift.some(
        (d) => d.pick_id === pick.id && d.drift_mode === 'S1'
      );
      if (!alreadyCaptured) {
        report.settlement_drift.push({
          pick_id: pick.id,
          drift_mode: 'S2',
          severity: 'CRITICAL',
          description: 'settlement_status = settled but settlement_result IS NULL',
          details: {
            settlement_status: pick.settlement_status,
            settlement_result: pick.settlement_result,
            settled_at: pick.settled_at,
          },
          detected_at: new Date().toISOString(),
        });
      }
    }
  }

  // --------------------------------------------------------
  // S3: settlement_result IS NOT NULL but settlement_status != 'settled'
  // --------------------------------------------------------
  const { data: s3Data } = await supabase
    .from('unified_picks')
    .select('id, settlement_status, settlement_result, settled_at')
    .not('settlement_result', 'is', null)
    .neq('settlement_status', 'settled')
    .limit(100);

  if (s3Data) {
    for (const pick of s3Data) {
      report.settlement_drift.push({
        pick_id: pick.id,
        drift_mode: 'S3',
        severity: 'HIGH',
        description: 'settlement_result set but settlement_status != settled',
        details: {
          settlement_status: pick.settlement_status,
          settlement_result: pick.settlement_result,
          settled_at: pick.settled_at,
        },
        detected_at: new Date().toISOString(),
      });
    }
  }

  // --------------------------------------------------------
  // Calculate summary
  // --------------------------------------------------------
  const allDrift = [
    ...report.posting_drift,
    ...report.settlement_drift,
    ...report.outbox_drift,
  ];

  report.summary.total_drift = allDrift.length;

  for (const entry of allDrift) {
    report.summary.by_mode[entry.drift_mode] =
      (report.summary.by_mode[entry.drift_mode] || 0) + 1;
    report.summary.by_severity[entry.severity] =
      (report.summary.by_severity[entry.severity] || 0) + 1;
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

  console.log('========================================');
  console.log('DRIFT DETECTION REPORT');
  console.log('Sprint: POSTING-SETTLEMENT-EXACTNESS-040');
  console.log('========================================\n');

  try {
    const report = await detectDrift();

    // Print summary
    console.log('SUMMARY:');
    console.log(`  Total drift detected: ${report.summary.total_drift}`);
    console.log(`  Environment: ${report.environment}`);
    console.log(`  Generated at: ${report.generated_at}`);
    console.log('');

    if (report.summary.total_drift === 0) {
      console.log('  NO DRIFT DETECTED');
    } else {
      console.log('  By Mode:');
      for (const [mode, count] of Object.entries(report.summary.by_mode)) {
        console.log(`    ${mode}: ${count}`);
      }
      console.log('');
      console.log('  By Severity:');
      for (const [severity, count] of Object.entries(report.summary.by_severity)) {
        console.log(`    ${severity}: ${count}`);
      }
    }

    console.log('\n----------------------------------------');

    // Print details if drift exists
    if (report.posting_drift.length > 0) {
      console.log('\nPOSTING DRIFT:');
      for (const entry of report.posting_drift.slice(0, 10)) {
        console.log(`  [${entry.drift_mode}] ${entry.pick_id}: ${entry.description}`);
      }
      if (report.posting_drift.length > 10) {
        console.log(`  ... and ${report.posting_drift.length - 10} more`);
      }
    }

    if (report.settlement_drift.length > 0) {
      console.log('\nSETTLEMENT DRIFT:');
      for (const entry of report.settlement_drift.slice(0, 10)) {
        console.log(`  [${entry.drift_mode}] ${entry.pick_id}: ${entry.description}`);
      }
      if (report.settlement_drift.length > 10) {
        console.log(`  ... and ${report.settlement_drift.length - 10} more`);
      }
    }

    if (report.outbox_drift.length > 0) {
      console.log('\nOUTBOX DRIFT:');
      for (const entry of report.outbox_drift.slice(0, 10)) {
        console.log(`  [${entry.drift_mode}] ${entry.details.bet_slip_id}: ${entry.description}`);
      }
      if (report.outbox_drift.length > 10) {
        console.log(`  ... and ${report.outbox_drift.length - 10} more`);
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

    // Also output JSON for parsing
    console.log('\n========================================');
    console.log('JSON OUTPUT:');
    console.log(JSON.stringify(report.summary, null, 2));

    // Exit with error code if critical drift found
    if (report.summary.by_severity['CRITICAL'] > 0) {
      console.log('\n  CRITICAL drift detected - exiting with code 1');
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error instanceof Error ? error.message : error);
    process.exit(2);
  }
}

main();
