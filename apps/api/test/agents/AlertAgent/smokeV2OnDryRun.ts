/* eslint-disable no-console, max-lines-per-function */
/**
 * Smoke test: V2 ON + DRY_RUN
 * Generates at least 2 alert payload JSONs (different types).
 *
 * Run: ALERT_ENGINE_V2=true ALERT_DRY_RUN=true npx tsx test/agents/AlertAgent/smokeV2OnDryRun.ts
 */

// Force V2 ON + DRY_RUN
process.env.ALERT_ENGINE_V2 = 'true';
process.env.ALERT_DRY_RUN = 'true';

import * as fs from 'fs';
import * as path from 'path';

import { AlertEngineV2 } from '../../../src/agents/AlertAgent/v2/alertEngineV2';

import type { AlertSignal } from '../../../src/agents/AlertAgent/v2/types';

const OUTPUT_DIR = path.resolve(__dirname, '../../../../out/alert-agent/2026-01-29/04-smoke');

async function main() {
  console.log('=== SMOKE TEST: V2 ON + DRY_RUN ===');
  console.log('');

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const engine = new AlertEngineV2({
    enabled: true,
    dryRun: true,
    dryRunOutputDir: OUTPUT_DIR,
  });

  console.log(`Engine enabled: ${engine.isEnabled()}`);
  console.log(`Engine dryRun:  ${engine.isDryRun()}`);
  console.log(`Output dir:     ${OUTPUT_DIR}`);
  console.log('');

  // Signal 1: Steam move
  const steamSignal: AlertSignal = {
    type: 'steam',
    sport: 'NBA',
    market: 'points',
    player_name: 'Luka Doncic',
    player_id: 'luka-77',
    game_id: 'game-dal-phx',
    line: 32.5,
    odds: -115,
    book: 'FanDuel',
    detection: {
      lineMovement: 2.5,
      publicPercentage: 84,
    },
    timestamp: new Date().toISOString(),
  };

  console.log('Processing signal 1: STEAM...');
  const result1 = await engine.processSignal(steamSignal);
  if (result1) {
    console.log(`  ✅ Alert generated: ${result1.alert_key}`);
    console.log(`  Type: ${result1.type}`);
    console.log(`  Action: ${result1.advice.action}`);
    console.log(`  DryRun: ${result1.dry_run}`);
  } else {
    console.log('  ⚠️ Alert suppressed');
  }
  console.log('');

  // Signal 2: Injury alert
  const injurySignal: AlertSignal = {
    type: 'injury',
    sport: 'NFL',
    market: 'passing_yards',
    player_name: 'Josh Allen',
    player_id: 'josh-17',
    game_id: 'game-buf-kc',
    line: 265.5,
    odds: -110,
    book: 'BetMGM',
    detection: {
      status: 'questionable',
      gameTimeClose: true,
      injury: 'ankle',
    },
    timestamp: new Date().toISOString(),
  };

  console.log('Processing signal 2: INJURY...');
  const result2 = await engine.processSignal(injurySignal);
  if (result2) {
    console.log(`  ✅ Alert generated: ${result2.alert_key}`);
    console.log(`  Type: ${result2.type}`);
    console.log(`  Action: ${result2.advice.action}`);
    console.log(`  DryRun: ${result2.dry_run}`);
  } else {
    console.log('  ⚠️ Alert suppressed');
  }
  console.log('');

  // Signal 3: Hedge opportunity
  const hedgeSignal: AlertSignal = {
    type: 'hedge',
    sport: 'MLB',
    market: 'home_runs',
    player_name: 'Aaron Judge',
    player_id: 'judge-99',
    game_id: 'game-nyy-bos',
    line: 0.5,
    odds: +150,
    book: 'DraftKings',
    detection: {
      lineDiscrepancy: 5.0,
      arbitragePercentage: 3.2,
    },
    timestamp: new Date().toISOString(),
  };

  console.log('Processing signal 3: HEDGE...');
  const result3 = await engine.processSignal(hedgeSignal);
  if (result3) {
    console.log(`  ✅ Alert generated: ${result3.alert_key}`);
    console.log(`  Type: ${result3.type}`);
    console.log(`  Action: ${result3.advice.action}`);
    console.log(`  DryRun: ${result3.dry_run}`);
  } else {
    console.log('  ⚠️ Alert suppressed');
  }
  console.log('');

  // Verify artifacts written
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith('dryrun-'));
  console.log(`Dry-run artifacts written: ${files.length}`);
  for (const f of files) {
    console.log(`  📄 ${f}`);
  }
  console.log('');

  if (files.length < 2) {
    console.error('❌ FAIL: Expected at least 2 dry-run artifacts');
    engine.destroy();
    process.exit(1);
  }

  // Verify duplicate suppression
  console.log('Processing duplicate signal (should be suppressed)...');
  const dup = await engine.processSignal(steamSignal);
  if (dup) {
    console.error('❌ FAIL: Duplicate was NOT suppressed');
    engine.destroy();
    process.exit(1);
  }
  console.log('  ✅ Duplicate correctly suppressed');
  console.log('');

  engine.destroy();
  console.log('=== SMOKE TEST PASSED ===');
}

main().catch(err => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
