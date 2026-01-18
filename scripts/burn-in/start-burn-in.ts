#!/usr/bin/env tsx
/**
 * PHASE 5: Start Burn-In Scheduler (CLI)
 *
 * Command-line interface for starting the autonomous burn-in scheduler.
 *
 * Usage:
 *   npm run burn-in:start
 *   npm run burn-in:start -- --duration 48
 *   npm run burn-in:start -- --autopilot-interval 10 --slo-interval 3
 *
 * Options:
 *   --duration <hours>              Burn-in duration (default: 72)
 *   --autopilot-interval <minutes>  Autopilot interval (default: 15)
 *   --slo-interval <minutes>        SLO evaluation interval (default: 5)
 *   --ingestion-interval <minutes>  Ingestion interval (default: 5)
 *   --skip-safety-checks            Skip pre-flight safety checks (dangerous!)
 *
 * @module scripts/burn-in/start-burn-in
 */

import { parseArgs } from 'util';

async function startBurnIn() {
  const { values } = parseArgs({
    options: {
      duration: { type: 'string', default: '72' },
      'autopilot-interval': { type: 'string', default: '15' },
      'slo-interval': { type: 'string', default: '5' },
      'ingestion-interval': { type: 'string', default: '5' },
      'skip-safety-checks': { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  const config = {
    durationHours: parseInt(values.duration as string, 10),
    autopilotIntervalMinutes: parseInt(
      values['autopilot-interval'] as string,
      10
    ),
    sloIntervalMinutes: parseInt(values['slo-interval'] as string, 10),
    ingestionIntervalMinutes: parseInt(
      values['ingestion-interval'] as string,
      10
    ),
    safetyChecks: !values['skip-safety-checks'],
  };

  console.log('========================================');
  console.log('PHASE 5: STARTING BURN-IN SCHEDULER');
  console.log('========================================');
  console.log(`Duration: ${config.durationHours} hours`);
  console.log(`Autopilot Interval: ${config.autopilotIntervalMinutes} minutes`);
  console.log(`SLO Interval: ${config.sloIntervalMinutes} minutes`);
  console.log(`Ingestion Interval: ${config.ingestionIntervalMinutes} minutes`);
  console.log(
    `Safety Checks: ${config.safetyChecks ? 'ENABLED' : 'DISABLED (DANGEROUS!)'}`
  );
  console.log('========================================\n');

  try {
    const response = await fetch('http://localhost:3015/api/burn-in/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Failed to start scheduler:');
      console.error(`   ${result.error}`);
      if (result.details) {
        console.error(`   Details: ${result.details}`);
      }
      process.exit(1);
    }

    console.log('✅ Scheduler started successfully');
    console.log('\nConfiguration:');
    console.log(JSON.stringify(result.config, null, 2));
    console.log(
      '\n📊 Monitor progress at: http://localhost:3015/dashboard/burn-in'
    );
    console.log('🛑 Stop scheduler: npm run burn-in:stop');
    console.log('⏸️  Pause scheduler: curl -X POST http://localhost:3015/api/burn-in/pause');
    console.log('▶️  Resume scheduler: curl -X POST http://localhost:3015/api/burn-in/resume\n');
  } catch (error) {
    console.error('❌ Error starting scheduler:');
    console.error(error);
    process.exit(1);
  }
}

startBurnIn().catch(console.error);
