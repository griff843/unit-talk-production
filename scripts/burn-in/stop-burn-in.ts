#!/usr/bin/env tsx
/**
 * PHASE 5: Stop Burn-In Scheduler (CLI)
 *
 * Usage: npm run burn-in:stop
 */

async function stopBurnIn() {
  console.log('========================================');
  console.log('STOPPING BURN-IN SCHEDULER');
  console.log('========================================\n');

  try {
    const response = await fetch('http://localhost:3015/api/burn-in/stop', {
      method: 'POST',
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`❌ Failed: ${result.error}`);
      process.exit(1);
    }

    console.log('✅ Scheduler stopped successfully\n');
    console.log('Final Statistics:');
    console.log(JSON.stringify(result.finalStats, null, 2));
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

stopBurnIn().catch(console.error);
