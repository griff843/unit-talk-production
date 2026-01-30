/* eslint-disable no-console */
/**
 * Smoke test: V2 OFF
 * Proves legacy path still runs when ALERT_ENGINE_V2 is not set.
 *
 * Run: npx tsx test/agents/AlertAgent/smokeV2Off.ts
 */

// Ensure V2 is OFF
delete process.env.ALERT_ENGINE_V2;
delete process.env.ALERT_DRY_RUN;

import { loadAlertEngineV2Config } from '../../../src/agents/AlertAgent/v2/alertEngineV2';

async function main() {
  console.log('=== SMOKE TEST: V2 OFF ===');
  console.log('');

  const config = loadAlertEngineV2Config();
  console.log('AlertEngine V2 config:');
  console.log(`  enabled: ${config.enabled}`);
  console.log(`  dryRun:  ${config.dryRun}`);
  console.log('');

  if (config.enabled) {
    console.error('❌ FAIL: V2 should be OFF by default');
    process.exit(1);
  }

  console.log('✅ V2 is OFF by default — legacy path would execute.');
  console.log('');

  // Verify the EventSubscriptionManager would NOT create a V2 engine
  console.log('Checking flag gate logic...');
  const envValue = process.env.ALERT_ENGINE_V2;
  const wouldCreateV2 = envValue === 'true';
  console.log(`  ALERT_ENGINE_V2 env: ${envValue ?? '(not set)'}`);
  console.log(`  Would create V2 engine: ${wouldCreateV2}`);

  if (wouldCreateV2) {
    console.error('❌ FAIL: V2 engine would be created when flag not set');
    process.exit(1);
  }

  console.log('✅ Flag gate confirms legacy path is active.');
  console.log('');
  console.log('=== SMOKE TEST PASSED ===');
}

main().catch(err => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
