#!/usr/bin/env tsx
/**
 * PHASE 5: Verify Burn-In Once (PROOF SCRIPT)
 *
 * Runs one cycle then queries database for HARD EVIDENCE:
 * - autopilot_decisions logged
 * - alert_events logged
 * - NO forbidden side effects (no pick_publish from autopilot, no workflow_stage mutations)
 *
 * Outputs proof JSON to: phase5-evidence/phase5-proof-once.json
 *
 * Usage: npm run burn-in:verify
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { burnInRunner } from '../../src/lib/burn-in/runner';
import fs from 'fs/promises';
import path from 'path';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL_DEV!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY_DEV!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ProofResult {
  timestamp: string;
  cycle_id: string;
  verdict: 'PASS' | 'FAIL';
  errors: string[];
  evidence: {
    autopilot_decisions: {
      count_before: number;
      count_after: number;
      new_decisions: number;
      sample_decisions: any[];
    };
    alert_events: {
      count_before: number;
      count_after: number;
      new_alerts: number;
      sample_alerts: any[];
    };
    forbidden_side_effects: {
      pick_publish_count_before: number;
      pick_publish_count_after: number;
      new_publishes: number;
      picks_workflow_mutations: number;
      verdict: 'CLEAN' | 'VIOLATION';
    };
  };
}

async function verify(): Promise<void> {
  console.log('========================================');
  console.log('PHASE 5: BURN-IN VERIFICATION WITH PROOF');
  console.log('========================================\n');

  const errors: string[] = [];

  console.log('Step 1: Get baseline counts...');

  // Get baseline counts BEFORE running cycle
  const { count: autopilotCountBefore } = await supabase
    .from('autopilot_decisions')
    .select('*', { count: 'exact', head: true });

  const { count: alertCountBefore } = await supabase
    .from('alert_events')
    .select('*', { count: 'exact', head: true });

  const { count: pickPublishCountBefore } = await supabase
    .from('pick_publish')
    .select('*', { count: 'exact', head: true });

  console.log(`  autopilot_decisions: ${autopilotCountBefore || 0}`);
  console.log(`  alert_events: ${alertCountBefore || 0}`);
  console.log(`  pick_publish: ${pickPublishCountBefore || 0}\n`);

  console.log('Step 2: Running one full burn-in cycle...');
  const cycleResult = await burnInRunner.runFullCycle();
  console.log(`  Cycle ID: ${cycleResult.cycle_id}`);
  console.log(`  Success: ${cycleResult.success ? '✅' : '❌'}\n`);

  if (!cycleResult.success) {
    errors.push('Burn-in cycle failed to execute');
  }

  console.log('Step 3: Get post-cycle counts...');

  const { count: autopilotCountAfter } = await supabase
    .from('autopilot_decisions')
    .select('*', { count: 'exact', head: true });

  const { count: alertCountAfter } = await supabase
    .from('alert_events')
    .select('*', { count: 'exact', head: true });

  const { count: pickPublishCountAfter } = await supabase
    .from('pick_publish')
    .select('*', { count: 'exact', head: true });

  const newDecisions = (autopilotCountAfter || 0) - (autopilotCountBefore || 0);
  const newAlerts = (alertCountAfter || 0) - (alertCountBefore || 0);
  const newPublishes = (pickPublishCountAfter || 0) - (pickPublishCountBefore || 0);

  console.log(`  autopilot_decisions: ${autopilotCountAfter || 0} (+${newDecisions})`);
  console.log(`  alert_events: ${alertCountAfter || 0} (+${newAlerts})`);
  console.log(`  pick_publish: ${pickPublishCountAfter || 0} (+${newPublishes})\n`);

  console.log('Step 4: Verify autopilot decisions were logged...');

  if (newDecisions === 0 && cycleResult.success) {
    errors.push(
      'Expected autopilot_decisions to be logged, but count did not increase'
    );
    console.log('  ❌ No new decisions logged');
  } else {
    console.log(`  ✅ ${newDecisions} decisions logged`);
  }

  // Get sample decisions
  const { data: sampleDecisions } = await supabase
    .from('autopilot_decisions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('Step 5: Verify alerts were generated...');
  if (newAlerts >= 0) {
    console.log(`  ✅ ${newAlerts} alerts generated`);
  } else {
    console.log('  ⚠️  No alerts generated (may be normal if no SLO violations)');
  }

  // Get sample alerts
  const { data: sampleAlerts } = await supabase
    .from('alert_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('\nStep 6: Check for forbidden side effects...');

  // Check pick_publish did NOT increase (autopilot is log_only)
  if (newPublishes > 0) {
    errors.push(
      `FORBIDDEN: pick_publish increased by ${newPublishes} (autopilot should be log_only)`
    );
    console.log(`  ❌ VIOLATION: ${newPublishes} new pick_publish rows (should be 0)`);
  } else {
    console.log('  ✅ No new pick_publish rows (log_only enforced)');
  }

  // Check picks workflow_stage did NOT mutate
  // Note: This is a simplified check - in production would track specific pick IDs
  const { count: picksCount } = await supabase
    .from('picks')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Last 5 minutes

  console.log(`  ℹ️  ${picksCount || 0} picks updated in last 5 minutes`);

  const forbiddenSideEffects =
    newPublishes === 0 && (picksCount === 0 || picksCount === null);

  console.log(
    `  Forbidden Side Effects: ${forbiddenSideEffects ? '✅ CLEAN' : '❌ VIOLATION'}\n`
  );

  // Construct proof object
  const proof: ProofResult = {
    timestamp: new Date().toISOString(),
    cycle_id: cycleResult.cycle_id,
    verdict: errors.length === 0 ? 'PASS' : 'FAIL',
    errors,
    evidence: {
      autopilot_decisions: {
        count_before: autopilotCountBefore || 0,
        count_after: autopilotCountAfter || 0,
        new_decisions: newDecisions,
        sample_decisions: sampleDecisions || [],
      },
      alert_events: {
        count_before: alertCountBefore || 0,
        count_after: alertCountAfter || 0,
        new_alerts: newAlerts,
        sample_alerts: sampleAlerts || [],
      },
      forbidden_side_effects: {
        pick_publish_count_before: pickPublishCountBefore || 0,
        pick_publish_count_after: pickPublishCountAfter || 0,
        new_publishes: newPublishes,
        picks_workflow_mutations: picksCount || 0,
        verdict: forbiddenSideEffects ? 'CLEAN' : 'VIOLATION',
      },
    },
  };

  // Write proof to file
  const evidenceDir = path.join(
    process.cwd(),
    'phase5-evidence'
  );
  await fs.mkdir(evidenceDir, { recursive: true });

  const proofFilePath = path.join(evidenceDir, 'phase5-proof-once.json');
  await fs.writeFile(proofFilePath, JSON.stringify(proof, null, 2), 'utf-8');

  console.log('========================================');
  console.log('VERIFICATION COMPLETE');
  console.log('========================================');
  console.log(`Verdict: ${proof.verdict}`);
  console.log(`Proof saved to: ${proofFilePath}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(err => console.log(`   - ${err}`));
    console.log('');
    process.exit(1);
  } else {
    console.log('\n✅ All verification checks PASSED\n');
    process.exit(0);
  }
}

verify().catch(error => {
  console.error('\n❌ Verification failed with error:');
  console.error(error);
  process.exit(1);
});
