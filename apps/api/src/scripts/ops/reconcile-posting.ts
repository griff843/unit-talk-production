#!/usr/bin/env npx tsx
/**
 * RECONCILE POSTING SCRIPT
 * Sprint: POSTING-SETTLEMENT-EXACTNESS-040
 *
 * READ-ONLY script that compares expected posts vs receipts vs posted_at.
 * Outputs deterministic, parseable report of posting state.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/ops/reconcile-posting.ts
 *   npx tsx apps/api/src/scripts/ops/reconcile-posting.ts --output-file ./reconcile-report.json
 *   npx tsx apps/api/src/scripts/ops/reconcile-posting.ts --since 24h
 *
 * This script does NOT modify any data. It only reads and reports.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// Types
// ============================================================

interface PostingStateEntry {
  pick_id: string;
  bet_slip_id: string | null;
  ticket_type: string | null;
  leg_index: number | null;
  state: 'clean' | 'p1_drift' | 'p3_drift' | 'unclaimed';
  posted_to_discord: boolean;
  promotion_posted_at: string | null;
  has_receipt: boolean;
  receipt_message_id: string | null;
  receipt_posted_at: string | null;
  capper: string | null;
  created_at: string;
}

interface ReconcileReport {
  generated_at: string;
  environment: string;
  time_range: {
    since: string;
    until: string;
  };
  summary: {
    total_picks: number;
    clean: number;
    p1_drift: number;
    p3_drift: number;
    unclaimed: number;
  };
  parlay_summary: {
    total_parlays: number;
    clean_parlays: number;
    inconsistent_parlays: number;
  };
  entries: PostingStateEntry[];
  inconsistent_parlays: Array<{
    bet_slip_id: string;
    legs: PostingStateEntry[];
    issue: string;
  }>;
}

// ============================================================
// Helpers
// ============================================================

function parseSince(since: string): Date {
  const now = Date.now();
  const match = since.match(/^(\d+)(h|d|m)$/);
  if (!match) {
    throw new Error(`Invalid --since format: ${since}. Use format like 24h, 7d, 30m`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'm':
      return new Date(now - value * 60 * 1000);
    case 'h':
      return new Date(now - value * 60 * 60 * 1000);
    case 'd':
      return new Date(now - value * 24 * 60 * 60 * 1000);
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
}

function classifyState(pick: {
  posted_to_discord: boolean;
  promotion_posted_at: string | null;
  meta: { discord_receipt?: { message_id?: string; posted_at?: string } } | null;
}): 'clean' | 'p1_drift' | 'p3_drift' | 'unclaimed' {
  const hasClaimFlag = pick.posted_to_discord === true;
  const hasPostedAt = !!pick.promotion_posted_at;
  const hasReceipt = !!pick.meta?.discord_receipt?.message_id;

  // Clean: all three are consistent
  if (hasClaimFlag && hasPostedAt && hasReceipt) {
    return 'clean';
  }

  // P1 drift: claimed but no receipt
  if (hasClaimFlag && !hasReceipt) {
    return 'p1_drift';
  }

  // P3 drift: posted_at set but no receipt
  if (hasPostedAt && !hasReceipt) {
    return 'p3_drift';
  }

  // Unclaimed: not yet posted
  return 'unclaimed';
}

// ============================================================
// Main Reconciliation Logic
// ============================================================

async function reconcilePosting(since: Date): Promise<ReconcileReport> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY/SUPABASE_ANON_KEY required');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const until = new Date();

  const report: ReconcileReport = {
    generated_at: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    time_range: {
      since: since.toISOString(),
      until: until.toISOString(),
    },
    summary: {
      total_picks: 0,
      clean: 0,
      p1_drift: 0,
      p3_drift: 0,
      unclaimed: 0,
    },
    parlay_summary: {
      total_parlays: 0,
      clean_parlays: 0,
      inconsistent_parlays: 0,
    },
    entries: [],
    inconsistent_parlays: [],
  };

  // Fetch picks in time range
  const { data: picks, error } = await supabase
    .from('unified_picks')
    .select(
      'id, bet_slip_id, ticket_type, leg_index, posted_to_discord, promotion_posted_at, meta, created_at, capper_id'
    )
    .gte('created_at', since.toISOString())
    .lte('created_at', until.toISOString())
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`Failed to fetch picks: ${error.message}`);
  }

  if (!picks || picks.length === 0) {
    console.log('No picks found in time range');
    return report;
  }

  // Process each pick
  for (const pick of picks) {
    const state = classifyState({
      posted_to_discord: pick.posted_to_discord,
      promotion_posted_at: pick.promotion_posted_at,
      meta: pick.meta,
    });

    const entry: PostingStateEntry = {
      pick_id: pick.id,
      bet_slip_id: pick.bet_slip_id,
      ticket_type: pick.ticket_type,
      leg_index: pick.leg_index,
      state,
      posted_to_discord: pick.posted_to_discord,
      promotion_posted_at: pick.promotion_posted_at,
      has_receipt: !!pick.meta?.discord_receipt?.message_id,
      receipt_message_id: pick.meta?.discord_receipt?.message_id || null,
      receipt_posted_at: pick.meta?.discord_receipt?.posted_at || null,
      capper: pick.capper_id,
      created_at: pick.created_at,
    };

    report.entries.push(entry);
    report.summary.total_picks++;
    report.summary[state]++;
  }

  // Analyze parlays for consistency
  const parlayGroups = new Map<string, PostingStateEntry[]>();
  for (const entry of report.entries) {
    if (entry.ticket_type === 'parlay' && entry.bet_slip_id) {
      if (!parlayGroups.has(entry.bet_slip_id)) {
        parlayGroups.set(entry.bet_slip_id, []);
      }
      parlayGroups.get(entry.bet_slip_id)!.push(entry);
    }
  }

  report.parlay_summary.total_parlays = parlayGroups.size;

  for (const [betSlipId, legs] of parlayGroups.entries()) {
    // Check consistency: all legs should have same state and same message_id
    const states = new Set(legs.map((l) => l.state));
    const messageIds = new Set(legs.map((l) => l.receipt_message_id).filter(Boolean));

    let isConsistent = true;
    let issue = '';

    if (states.size > 1) {
      isConsistent = false;
      issue = `Mixed states: ${Array.from(states).join(', ')}`;
    } else if (messageIds.size > 1) {
      isConsistent = false;
      issue = `Multiple message_ids: ${Array.from(messageIds).join(', ')}`;
    }

    if (isConsistent) {
      report.parlay_summary.clean_parlays++;
    } else {
      report.parlay_summary.inconsistent_parlays++;
      report.inconsistent_parlays.push({
        bet_slip_id: betSlipId,
        legs,
        issue,
      });
    }
  }

  return report;
}

// ============================================================
// CLI Entry Point
// ============================================================

async function main() {
  const args = process.argv.slice(2);

  // Parse --since argument
  const sinceIdx = args.indexOf('--since');
  const sinceArg = sinceIdx >= 0 ? args[sinceIdx + 1] : '24h';
  const since = parseSince(sinceArg);

  // Parse --output-file argument
  const outputFileIdx = args.indexOf('--output-file');
  const outputFile = outputFileIdx >= 0 ? args[outputFileIdx + 1] : null;

  console.log('========================================');
  console.log('POSTING RECONCILIATION REPORT');
  console.log('Sprint: POSTING-SETTLEMENT-EXACTNESS-040');
  console.log('========================================\n');

  try {
    const report = await reconcilePosting(since);

    // Print summary
    console.log('TIME RANGE:');
    console.log(`  Since: ${report.time_range.since}`);
    console.log(`  Until: ${report.time_range.until}`);
    console.log('');

    console.log('SUMMARY:');
    console.log(`  Total picks: ${report.summary.total_picks}`);
    console.log(`  Clean: ${report.summary.clean}`);
    console.log(`  P1 drift (claimed, no receipt): ${report.summary.p1_drift}`);
    console.log(`  P3 drift (posted_at, no receipt): ${report.summary.p3_drift}`);
    console.log(`  Unclaimed: ${report.summary.unclaimed}`);
    console.log('');

    console.log('PARLAY SUMMARY:');
    console.log(`  Total parlays: ${report.parlay_summary.total_parlays}`);
    console.log(`  Clean parlays: ${report.parlay_summary.clean_parlays}`);
    console.log(`  Inconsistent parlays: ${report.parlay_summary.inconsistent_parlays}`);
    console.log('');

    // Report drift details
    if (report.summary.p1_drift > 0 || report.summary.p3_drift > 0) {
      console.log('----------------------------------------');
      console.log('DRIFT DETAILS:');

      const driftEntries = report.entries.filter(
        (e) => e.state === 'p1_drift' || e.state === 'p3_drift'
      );

      for (const entry of driftEntries.slice(0, 20)) {
        console.log(
          `  [${entry.state.toUpperCase()}] ${entry.pick_id} | ${entry.ticket_type || 'single'} | capper: ${entry.capper || 'unknown'}`
        );
      }

      if (driftEntries.length > 20) {
        console.log(`  ... and ${driftEntries.length - 20} more`);
      }
    }

    // Report inconsistent parlays
    if (report.inconsistent_parlays.length > 0) {
      console.log('----------------------------------------');
      console.log('INCONSISTENT PARLAYS:');

      for (const parlay of report.inconsistent_parlays.slice(0, 10)) {
        console.log(`  bet_slip_id: ${parlay.bet_slip_id}`);
        console.log(`    Issue: ${parlay.issue}`);
        console.log(`    Legs: ${parlay.legs.length}`);
        for (const leg of parlay.legs) {
          console.log(
            `      [${leg.leg_index}] ${leg.state} | msg_id: ${leg.receipt_message_id || 'none'}`
          );
        }
      }

      if (report.inconsistent_parlays.length > 10) {
        console.log(`  ... and ${report.inconsistent_parlays.length - 10} more`);
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
          summary: report.summary,
          parlay_summary: report.parlay_summary,
          time_range: report.time_range,
        },
        null,
        2
      )
    );

    // Exit with error code if drift found
    if (report.summary.p1_drift > 0 || report.summary.p3_drift > 0) {
      console.log('\n  Drift detected - exiting with code 1');
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error instanceof Error ? error.message : error);
    process.exit(2);
  }
}

main();
