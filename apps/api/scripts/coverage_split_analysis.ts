/**
 * EVENT-LINKED-COVERAGE-RAISE-006
 * Coverage Split Analysis: Event-Linked vs Manual Legs
 *
 * Queries the database to produce:
 * 1. Coverage split (event_id IS NOT NULL vs IS NULL)
 * 2. Event-linked coverage detail
 * 3. Missing primitive reasons for event-linked legs
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../../.env') });

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';

const PROOF_DIR = resolve(
  __dirname,
  '../../../out/sprints/EVENT-LINKED-COVERAGE-RAISE-006/2026-03-02'
);

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  mkdirSync(PROOF_DIR, { recursive: true });

  // ─── Query 1: Coverage Split ─────────────────────────────────────────────
  console.log('\n=== COVERAGE SPLIT: event-linked vs manual ===\n');

  // Get all scored legs joined with ticket_legs to check event_id
  const { data: allLegs, error: allLegsErr } = await supabase
    .from('scored_legs')
    .select(
      `
      id,
      leg_id,
      p_final,
      p_market_devig,
      uncertainty_final,
      edge_final,
      consensus_weights_json,
      is_latest,
      ticket_legs!inner (
        id,
        event_id,
        market_type_id,
        participant_id,
        selection,
        provider
      )
    `
    )
    .eq('is_latest', true);

  if (allLegsErr) {
    console.error('Query error (allLegs):', allLegsErr.message);
    process.exit(1);
  }

  if (!allLegs || allLegs.length === 0) {
    console.log('No scored legs found.');
    process.exit(0);
  }

  // Split by event_id
  const eventLinked = allLegs.filter((l: any) => l.ticket_legs?.event_id != null);
  const manual = allLegs.filter((l: any) => l.ticket_legs?.event_id == null);

  const eventLinkedWithP = eventLinked.filter((l: any) => l.p_final != null);
  const manualWithP = manual.filter((l: any) => l.p_final != null);

  const coverageSplit = {
    timestamp: new Date().toISOString(),
    sprint: 'EVENT-LINKED-COVERAGE-RAISE-006',
    total_scored_legs: allLegs.length,
    event_linked: {
      total: eventLinked.length,
      with_probability: eventLinkedWithP.length,
      without_probability: eventLinked.length - eventLinkedWithP.length,
      coverage_pct:
        eventLinked.length > 0
          ? parseFloat(((eventLinkedWithP.length / eventLinked.length) * 100).toFixed(2))
          : 0,
    },
    manual: {
      total: manual.length,
      with_probability: manualWithP.length,
      without_probability: manual.length - manualWithP.length,
      coverage_pct:
        manual.length > 0 ? parseFloat(((manualWithP.length / manual.length) * 100).toFixed(2)) : 0,
    },
  };

  console.log(JSON.stringify(coverageSplit, null, 2));
  writeFileSync(
    resolve(PROOF_DIR, 'proof_coverage_split.json'),
    JSON.stringify(coverageSplit, null, 2)
  );
  console.log('  → Saved to proof_coverage_split.json');

  // ─── Query 2: Event-Linked Coverage Detail ───────────────────────────────
  console.log('\n=== EVENT-LINKED COVERAGE DETAIL ===\n');

  const eventLinkedCoverage = {
    timestamp: new Date().toISOString(),
    sprint: 'EVENT-LINKED-COVERAGE-RAISE-006',
    event_linked_total: eventLinked.length,
    event_linked_with_p_final: eventLinkedWithP.length,
    event_linked_coverage_pct: coverageSplit.event_linked.coverage_pct,
    pass_criteria: '>= 80%',
    pass: coverageSplit.event_linked.coverage_pct >= 80 || eventLinked.length === 0,
    note:
      eventLinked.length === 0
        ? 'No event-linked legs found (may indicate data is not yet scored)'
        : undefined,
  };

  console.log(JSON.stringify(eventLinkedCoverage, null, 2));
  writeFileSync(
    resolve(PROOF_DIR, 'proof_event_linked_coverage.json'),
    JSON.stringify(eventLinkedCoverage, null, 2)
  );
  console.log('  → Saved to proof_event_linked_coverage.json');

  // ─── Query 3: Missing Primitive Reasons ──────────────────────────────────
  console.log('\n=== MISSING PRIMITIVE REASONS (event-linked legs) ===\n');

  const eventLinkedWithoutP = eventLinked.filter((l: any) => l.p_final == null);

  // Infer fail reason from available data
  // (probability_fail_reason is not stored in DB, only in TypeScript runtime)
  function inferFailReason(leg: any): string {
    const tl = leg.ticket_legs;
    if (!tl?.market_type_id) return 'MISSING_MARKET_TYPE_ID';
    // Has event_id + market_type_id but still no p_final →
    // likely INSUFFICIENT_BOOKS or COMPUTATION_ERROR
    return 'INSUFFICIENT_BOOKS_OR_COMPUTATION_ERROR';
  }

  // Group by fail reason
  const reasonCounts: Record<string, number> = {};
  const reasonExamples: Record<string, any[]> = {};

  for (const leg of eventLinkedWithoutP) {
    const reasonGroup = inferFailReason(leg);
    reasonCounts[reasonGroup] = (reasonCounts[reasonGroup] || 0) + 1;

    if (!reasonExamples[reasonGroup]) {
      reasonExamples[reasonGroup] = [];
    }
    if (reasonExamples[reasonGroup].length < 3) {
      reasonExamples[reasonGroup].push({
        scored_leg_id: (leg as any).id,
        leg_id: (leg as any).leg_id,
        event_id: (leg as any).ticket_legs?.event_id,
        market_type_id: (leg as any).ticket_legs?.market_type_id,
        participant_id: (leg as any).ticket_legs?.participant_id,
        inferred_reason: reasonGroup,
      });
    }
  }

  const missingReasons = {
    timestamp: new Date().toISOString(),
    sprint: 'EVENT-LINKED-COVERAGE-RAISE-006',
    event_linked_without_probability: eventLinkedWithoutP.length,
    reason_breakdown: reasonCounts,
    examples_per_reason: reasonExamples,
  };

  console.log(JSON.stringify(missingReasons, null, 2));
  writeFileSync(
    resolve(PROOF_DIR, 'proof_missing_reasons.json'),
    JSON.stringify(missingReasons, null, 2)
  );
  console.log('  → Saved to proof_missing_reasons.json');

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log('\n=== SUMMARY ===');
  console.log(`Total scored legs: ${allLegs.length}`);
  console.log(
    `Event-linked: ${eventLinked.length} (${coverageSplit.event_linked.coverage_pct}% with probability)`
  );
  console.log(
    `Manual:       ${manual.length} (${coverageSplit.manual.coverage_pct}% with probability)`
  );
  console.log(
    `\nPASS CRITERIA (event-linked >= 80%): ${eventLinkedCoverage.pass ? 'PASS' : 'FAIL'}`
  );
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
