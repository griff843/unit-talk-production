#!/usr/bin/env tsx
/**
 * PHASE 5: Run One Full Burn-In Cycle
 *
 * Executes a single burn-in cycle (ingestion + autopilot + SLO) and outputs results.
 * Used for testing before starting 72-hour scheduler.
 *
 * Usage: npm run burn-in:once
 */

import 'dotenv/config';
import { burnInRunner } from '../../src/lib/burn-in/runner';

async function runOneCycle() {
  console.log('========================================');
  console.log('PHASE 5: RUNNING ONE BURN-IN CYCLE');
  console.log('========================================\n');

  try {
    const result = await burnInRunner.runFullCycle();

    console.log('\n========================================');
    console.log('CYCLE COMPLETE');
    console.log('========================================');
    console.log(`Cycle ID: ${result.cycle_id}`);
    console.log(`Success: ${result.success ? '✅' : '❌'}`);
    console.log(`Total Duration: ${result.total_duration_ms}ms`);
    console.log('');
    console.log('Task Results:');
    console.log('  Ingestion:');
    console.log(`    Success: ${result.results.ingestion.success ? '✅' : '❌'}`);
    console.log(`    Duration: ${result.results.ingestion.duration_ms}ms`);
    if (result.results.ingestion.data) {
      console.log(`    Status: ${result.results.ingestion.data.status}`);
      console.log(
        `    Minutes Since Last: ${result.results.ingestion.data.minutes_since_last}`
      );
    }
    console.log('');
    console.log('  Autopilot:');
    console.log(`    Success: ${result.results.autopilot.success ? '✅' : '❌'}`);
    console.log(`    Duration: ${result.results.autopilot.duration_ms}ms`);
    if (result.results.autopilot.data) {
      console.log(`    Evaluated: ${result.results.autopilot.data.total_evaluated}`);
      console.log(`    Approved: ${result.results.autopilot.data.approved}`);
      console.log(`    Rejected: ${result.results.autopilot.data.rejected}`);
      console.log(`    Unknown: ${result.results.autopilot.data.unknown}`);
    }
    console.log('');
    console.log('  SLO + Alerts:');
    console.log(`    Success: ${result.results.slo.success ? '✅' : '❌'}`);
    console.log(`    Duration: ${result.results.slo.duration_ms}ms`);
    if (result.results.slo.data) {
      console.log(`    Total SLOs: ${result.results.slo.data.total_slos}`);
      console.log(`    Passing: ${result.results.slo.data.passing}`);
      console.log(`    Failing: ${result.results.slo.data.failing}`);
      console.log(`    Alerts Generated: ${result.results.slo.data.alerts_generated}`);
    }

    console.log('\n========================================\n');

    if (!result.success) {
      console.error('❌ One or more tasks failed. See details above.');
      process.exit(1);
    } else {
      console.log('✅ All tasks completed successfully');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Error running cycle:');
    console.error(error);
    process.exit(1);
  }
}

runOneCycle();
