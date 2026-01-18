#!/usr/bin/env tsx
/**
 * PHASE 5: Verify SLO Fix (PROOF SCRIPT)
 *
 * Verifies the SLO crash has been fixed by:
 * 1. Calling POST /api/burn-in/run-once
 * 2. Asserting structured results with no crashes
 * 3. Writing proof artifact to phase5-evidence/
 *
 * Usage: npm run burn-in:verify-fix
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';

interface ProofResult {
  timestamp: string;
  test_method: string;
  verdict: 'PASS' | 'FAIL';
  errors: string[];
  baseline_before: {
    timestamp: string;
    autopilot_decisions: number;
    alert_events: number;
    pick_publish: number;
    picks_updated_recent: number;
  };
  cycle_execution: {
    cycle_id: string;
    success: boolean;
    total_duration_ms: number;
    tasks: {
      ingestion: {
        success: boolean;
        note: string;
      };
      autopilot: {
        success: boolean;
        total_evaluated: number;
        note: string;
      };
      slo: {
        success: boolean;
        total_slos: number;
        passing: number;
        failing: number;
        unknown: number;
        alerts_generated: number;
        note: string;
      };
    };
  };
  baseline_after: {
    timestamp: string;
    autopilot_decisions: number;
    alert_events: number;
    pick_publish: number;
    picks_updated_recent: number;
  };
  forbidden_side_effects_check: {
    verdict: 'CLEAN' | 'VIOLATION';
    pick_publish_delta: number;
    picks_updated_recent_delta: number;
    autopilot_decisions_delta: number;
    alert_events_delta: number;
    log_only_enforced: boolean;
    notes: string[];
  };
  pass_criteria: {
    slo_no_crash: boolean;
    slo_returns_structured_results: boolean;
    autopilot_executed: boolean;
    no_pick_publish_mutations: boolean;
    overall: 'PASS' | 'FAIL';
  };
}

async function callAPI(url: string, method: string = 'GET', body?: any): Promise<any> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  return response.json();
}

async function verify(): Promise<void> {
  console.log('========================================');
  console.log('PHASE 5: VERIFY SLO FIX');
  console.log('========================================\n');

  const errors: string[] = [];

  console.log('Step 1: Get baseline counts...');
  const baselineBefore = await callAPI('http://localhost:3015/api/burn-in/baseline');
  console.log(`  autopilot_decisions: ${baselineBefore.autopilot_decisions}`);
  console.log(`  alert_events: ${baselineBefore.alert_events}`);
  console.log(`  pick_publish: ${baselineBefore.pick_publish}`);
  console.log(`  picks_updated_recent: ${baselineBefore.picks_updated_recent}\n`);

  console.log('Step 2: Running one full burn-in cycle...');
  const cycleResult = await callAPI('http://localhost:3015/api/burn-in/run-once', 'POST');
  console.log(`  Cycle ID: ${cycleResult.cycle_id}`);
  console.log(`  Success: ${cycleResult.success ? '✅' : '❌'}`);
  console.log(`  Total Duration: ${cycleResult.total_duration_ms}ms\n`);

  // Validate SLO task
  console.log('Step 3: Verify SLO task executed without crash...');
  if (!cycleResult.results?.slo) {
    errors.push('SLO results missing from cycle response');
    console.log('  ❌ SLO results missing');
  } else if (!cycleResult.results.slo.success) {
    errors.push(`SLO task failed: ${cycleResult.results.slo.error || 'Unknown error'}`);
    console.log(`  ❌ SLO task failed: ${cycleResult.results.slo.error}`);
  } else {
    console.log('  ✅ SLO task executed successfully');
    console.log(`    Total SLOs: ${cycleResult.results.slo.data.total_slos}`);
    console.log(`    Passing: ${cycleResult.results.slo.data.passing}`);
    console.log(`    Failing: ${cycleResult.results.slo.data.failing}`);
    console.log(`    Unknown: ${cycleResult.results.slo.data.unknown}`);
    console.log(`    Alerts Generated: ${cycleResult.results.slo.data.alerts_generated}\n`);

    // Verify structured results
    if (typeof cycleResult.results.slo.data.total_slos !== 'number') {
      errors.push('SLO results missing total_slos count');
    }
    if (typeof cycleResult.results.slo.data.passing !== 'number') {
      errors.push('SLO results missing passing count');
    }
    if (typeof cycleResult.results.slo.data.failing !== 'number') {
      errors.push('SLO results missing failing count');
    }
    if (typeof cycleResult.results.slo.data.unknown !== 'number') {
      errors.push('SLO results missing unknown count');
    }
    if (typeof cycleResult.results.slo.data.alerts_generated !== 'number') {
      errors.push('SLO results missing alerts_generated count');
    }
  }

  // Verify autopilot task
  console.log('Step 4: Verify autopilot task executed...');
  if (!cycleResult.results?.autopilot) {
    errors.push('Autopilot results missing from cycle response');
    console.log('  ❌ Autopilot results missing');
  } else if (!cycleResult.results.autopilot.success) {
    errors.push(`Autopilot task failed: ${cycleResult.results.autopilot.error || 'Unknown error'}`);
    console.log(`  ❌ Autopilot task failed: ${cycleResult.results.autopilot.error}`);
  } else {
    console.log('  ✅ Autopilot task executed successfully');
    console.log(`    Evaluation Run ID: ${cycleResult.results.autopilot.data.evaluation_run_id}`);
    console.log(`    Total Evaluated: ${cycleResult.results.autopilot.data.total_evaluated}\n`);
  }

  console.log('Step 5: Get post-cycle baseline...');
  const baselineAfter = await callAPI('http://localhost:3015/api/burn-in/baseline');
  console.log(`  autopilot_decisions: ${baselineAfter.autopilot_decisions}`);
  console.log(`  alert_events: ${baselineAfter.alert_events}`);
  console.log(`  pick_publish: ${baselineAfter.pick_publish}`);
  console.log(`  picks_updated_recent: ${baselineAfter.picks_updated_recent}\n`);

  console.log('Step 6: Check forbidden side effects...');
  const pickPublishDelta = baselineAfter.pick_publish - baselineBefore.pick_publish;
  const picksUpdatedDelta = baselineAfter.picks_updated_recent - baselineBefore.picks_updated_recent;
  const autopilotDecisionsDelta = baselineAfter.autopilot_decisions - baselineBefore.autopilot_decisions;
  const alertEventsDelta = baselineAfter.alert_events - baselineBefore.alert_events;

  console.log(`  pick_publish delta: ${pickPublishDelta}`);
  console.log(`  picks_updated_recent delta: ${picksUpdatedDelta}`);
  console.log(`  autopilot_decisions delta: ${autopilotDecisionsDelta}`);
  console.log(`  alert_events delta: ${alertEventsDelta}\n`);

  if (pickPublishDelta !== 0) {
    errors.push(`FORBIDDEN: pick_publish increased by ${pickPublishDelta} (log_only mode violated)`);
    console.log(`  ❌ pick_publish increased by ${pickPublishDelta} (VIOLATION)`);
  } else {
    console.log('  ✅ pick_publish did not change (log_only enforced)');
  }

  if (picksUpdatedDelta !== 0) {
    errors.push(`FORBIDDEN: picks_updated_recent increased by ${picksUpdatedDelta} (workflow mutations)`);
    console.log(`  ❌ picks_updated_recent increased by ${picksUpdatedDelta} (VIOLATION)`);
  } else {
    console.log('  ✅ picks_updated_recent did not change (no workflow mutations)');
  }

  // Construct proof object
  const proof: ProofResult = {
    timestamp: new Date().toISOString(),
    test_method: 'API_ENDPOINT_VERIFICATION',
    verdict: errors.length === 0 ? 'PASS' : 'FAIL',
    errors,
    baseline_before: baselineBefore,
    cycle_execution: {
      cycle_id: cycleResult.cycle_id,
      success: cycleResult.success,
      total_duration_ms: cycleResult.total_duration_ms,
      tasks: {
        ingestion: {
          success: cycleResult.results.ingestion.success,
          note: cycleResult.results.ingestion.success
            ? 'Ingestion check passed'
            : 'Expected failure - data is stale',
        },
        autopilot: {
          success: cycleResult.results.autopilot.success,
          total_evaluated: cycleResult.results.autopilot.data.total_evaluated,
          note: 'Autopilot ran in log_only mode',
        },
        slo: {
          success: cycleResult.results.slo?.success || false,
          total_slos: cycleResult.results.slo?.data?.total_slos || 0,
          passing: cycleResult.results.slo?.data?.passing || 0,
          failing: cycleResult.results.slo?.data?.failing || 0,
          unknown: cycleResult.results.slo?.data?.unknown || 0,
          alerts_generated: cycleResult.results.slo?.data?.alerts_generated || 0,
          note: cycleResult.results.slo?.success
            ? 'SLO evaluation completed successfully - crash fixed'
            : 'SLO evaluation failed',
        },
      },
    },
    baseline_after: baselineAfter,
    forbidden_side_effects_check: {
      verdict: pickPublishDelta === 0 && picksUpdatedDelta === 0 ? 'CLEAN' : 'VIOLATION',
      pick_publish_delta: pickPublishDelta,
      picks_updated_recent_delta: picksUpdatedDelta,
      autopilot_decisions_delta: autopilotDecisionsDelta,
      alert_events_delta: alertEventsDelta,
      log_only_enforced: pickPublishDelta === 0,
      notes: [
        `pick_publish: ${pickPublishDelta === 0 ? 'NO CHANGE ✅' : `INCREASED by ${pickPublishDelta} ❌`}`,
        `picks_updated_recent: ${picksUpdatedDelta === 0 ? 'NO CHANGE ✅' : `INCREASED by ${picksUpdatedDelta} ❌`}`,
        `autopilot_decisions: ${autopilotDecisionsDelta === 0 ? 'NO CHANGE (no picks to evaluate)' : `INCREASED by ${autopilotDecisionsDelta}`}`,
        `alert_events: ${alertEventsDelta === 0 ? 'NO CHANGE' : `INCREASED by ${alertEventsDelta} (expected from SLO violations)`}`,
      ],
    },
    pass_criteria: {
      slo_no_crash: cycleResult.results.slo?.success === true,
      slo_returns_structured_results:
        typeof cycleResult.results.slo?.data?.total_slos === 'number' &&
        typeof cycleResult.results.slo?.data?.passing === 'number',
      autopilot_executed: cycleResult.results.autopilot?.success === true,
      no_pick_publish_mutations: pickPublishDelta === 0,
      overall: errors.length === 0 ? 'PASS' : 'FAIL',
    },
  };

  // Write proof to file
  const evidenceDir = path.join(process.cwd(), 'phase5-evidence');
  await fs.mkdir(evidenceDir, { recursive: true });

  const proofFilePath = path.join(evidenceDir, 'phase5-proof-run-once-fixed.json');
  await fs.writeFile(proofFilePath, JSON.stringify(proof, null, 2), 'utf-8');

  console.log('\n========================================');
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
    console.log('\n✅ All verification checks PASSED');
    console.log('✅ SLO crash has been FIXED');
    console.log('✅ Forbidden side effects: CLEAN\n');
    process.exit(0);
  }
}

verify().catch(error => {
  console.error('\n❌ Verification failed with error:');
  console.error(error);
  process.exit(1);
});
