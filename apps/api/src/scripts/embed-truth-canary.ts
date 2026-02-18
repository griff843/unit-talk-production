/* eslint-disable no-console */
/**
 * embed-truth-canary.ts - EMBED-TRUTH-FIX-031
 *
 * Canary script to verify:
 * 1. Player prop embeds show correct market label (PTS, AST, etc.) NOT "Moneyline"
 * 2. Team bet embeds show correct team logos NOT league logos
 * 3. Build SHA is present (not "unknown")
 * 4. Posting gate validates correctly
 *
 * Run inside API container:
 *   docker-compose exec api npx tsx src/scripts/embed-truth-canary.ts
 */
import 'dotenv/config';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { buildPickPresentation } from '../services/pickPresentationBuilder';
import {
  buildProductionFooter,
  validatePostingGate,
  validateBuildProvenance,
  validatePickPresentation,
} from '../lib/embedPresentationContract';
import { getBuildInfo } from '../lib/buildInfo';
import { UnifiedPickRow } from '../types/pickPresentation';

// ---- CONFIG ----
const DISCORD_WEBHOOK_URL = process.env['DISCORD_WEBHOOK_URL'] || '';
const SUPABASE_URL = process.env['SUPABASE_URL'] || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---- HELPERS ----
function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : odds.toString();
}

interface CanaryResult {
  testName: string;
  passed: boolean;
  details: Record<string, any>;
  errors: string[];
}

// ---- CANARY 1: PLAYER PROP ----
async function canaryPlayerProp(capperId: string, capperName: string): Promise<CanaryResult> {
  console.log('\n=== CANARY 1: PLAYER PROP ===');

  const errors: string[] = [];
  const betSlipId = uuidv4();
  const pickId = uuidv4();

  // Simulate a player prop pick exactly as Smart Form would submit it
  const pick: UnifiedPickRow = {
    id: pickId,
    bet_slip_id: betSlipId,
    user_id: capperId,
    sport: 'NBA',
    stat_type: 'PTS',
    bet_type: 'player_prop',
    selection: 'Jaylen Brown Over 24.5 PTS',  // Full selection string
    player_name: 'Jaylen Brown',
    line: 24.5,
    odds: -115,
    direction: 'over',
    tier: 'A',
    unit_size: 1,
    matchup: 'Celtics @ Heat',
    meta: {
      pick_origin: 'capper',
      capper: capperName,
      canary_test: true,
      canary_id: 'EMBED-TRUTH-FIX-031-PLAYER-PROP',
    },
  };

  console.log('Pick data:', JSON.stringify(pick, null, 2));

  // Test 1: Posting Gate Validation
  console.log('\n--- Test 1: Posting Gate ---');
  const postingGate = validatePostingGate({
    player_name: pick.player_name,
    team: pick.team,
    selection: pick.selection,
    stat_type: pick.stat_type,
    bet_type: pick.bet_type,
    line: pick.line,
    direction: pick.direction,
  });

  console.log('Posting Gate Result:', JSON.stringify(postingGate, null, 2));

  if (!postingGate.canPost) {
    errors.push(`Posting gate failed: ${postingGate.violations.join(', ')}`);
  }

  // Test 2: Build Presentation
  console.log('\n--- Test 2: Build Presentation ---');
  const presentation = await buildPickPresentation(pick);
  console.log('Presentation:', JSON.stringify(presentation, null, 2));

  // Verify market label is NOT "Moneyline"
  if (presentation.market_label.toLowerCase() === 'moneyline') {
    errors.push(`WRONG MARKET LABEL: Got "${presentation.market_label}" but expected "PTS"`);
  }

  // Verify market_type is player_prop
  if (presentation.market_type !== 'player_prop') {
    errors.push(`WRONG MARKET TYPE: Got "${presentation.market_type}" but expected "player_prop"`);
  }

  // Verify title contains player name
  if (!presentation.title.includes('Jaylen Brown')) {
    errors.push(`WRONG TITLE: Got "${presentation.title}" but expected to contain "Jaylen Brown"`);
  }

  // Test 3: Presentation Validation
  console.log('\n--- Test 3: Presentation Validation ---');
  const presentationValidation = validatePickPresentation({
    title: presentation.title,
    market_label: presentation.market_label,
    market_type: presentation.market_type,
    thumbnail_url: presentation.thumbnail_url,
    context_line: presentation.context_line,
  });
  console.log('Presentation Validation:', JSON.stringify(presentationValidation, null, 2));

  if (!presentationValidation.valid) {
    errors.push(`Presentation validation failed: ${presentationValidation.violations.join(', ')}`);
  }

  // Test 4: Build Provenance
  console.log('\n--- Test 4: Build Provenance ---');
  const buildInfo = getBuildInfo('embed-truth-canary');
  console.log('Build Info:', JSON.stringify(buildInfo, null, 2));

  const provenanceCheck = validateBuildProvenance(buildInfo.commitShort, buildInfo.environment);
  console.log('Provenance Check:', JSON.stringify(provenanceCheck, null, 2));

  if (buildInfo.commitShort === 'unknown') {
    errors.push('BUILD SHA IS UNKNOWN - provenance not set correctly');
  }

  const passed = errors.length === 0;
  console.log(`\nPlayer Prop Canary: ${passed ? 'PASSED' : 'FAILED'}`);
  if (!passed) {
    console.log('Errors:', errors);
  }

  return {
    testName: 'PLAYER_PROP_CANARY',
    passed,
    details: {
      pick_id: pickId,
      presentation,
      postingGate,
      buildInfo,
    },
    errors,
  };
}

// ---- CANARY 2: TEAM BET (SPREAD) ----
async function canaryTeamSpread(capperId: string, capperName: string): Promise<CanaryResult> {
  console.log('\n=== CANARY 2: TEAM SPREAD ===');

  const errors: string[] = [];
  const betSlipId = uuidv4();
  const pickId = uuidv4();

  // Simulate a spread pick
  const pick: UnifiedPickRow = {
    id: pickId,
    bet_slip_id: betSlipId,
    user_id: capperId,
    sport: 'NBA',
    stat_type: 'spread',
    bet_type: 'spread',
    selection: 'Lakers -3.5',
    team: 'Lakers',
    line: -3.5,
    odds: -110,
    tier: 'B',
    unit_size: 1,
    matchup: 'Lakers @ Warriors',
    meta: {
      pick_origin: 'capper',
      capper: capperName,
      canary_test: true,
      canary_id: 'EMBED-TRUTH-FIX-031-SPREAD',
    },
  };

  console.log('Pick data:', JSON.stringify(pick, null, 2));

  // Test 1: Posting Gate Validation
  console.log('\n--- Test 1: Posting Gate ---');
  const postingGate = validatePostingGate({
    player_name: pick.player_name,
    team: pick.team,
    selection: pick.selection,
    stat_type: pick.stat_type,
    bet_type: pick.bet_type,
    line: pick.line,
    direction: pick.direction,
  });

  console.log('Posting Gate Result:', JSON.stringify(postingGate, null, 2));

  if (!postingGate.canPost) {
    errors.push(`Posting gate failed: ${postingGate.violations.join(', ')}`);
  }

  // Test 2: Build Presentation
  console.log('\n--- Test 2: Build Presentation ---');
  const presentation = await buildPickPresentation(pick);
  console.log('Presentation:', JSON.stringify(presentation, null, 2));

  // Verify market label is "Spread"
  if (presentation.market_label !== 'Spread') {
    errors.push(`WRONG MARKET LABEL: Got "${presentation.market_label}" but expected "Spread"`);
  }

  // Verify market_type is spread
  if (presentation.market_type !== 'spread') {
    errors.push(`WRONG MARKET TYPE: Got "${presentation.market_type}" but expected "spread"`);
  }

  // Verify title contains team and line
  if (!presentation.title.includes('Lakers') || !presentation.title.includes('-3.5')) {
    errors.push(`WRONG TITLE: Got "${presentation.title}" but expected to contain "Lakers" and "-3.5"`);
  }

  // Verify thumbnail is NOT league logo (should be team logo)
  if (presentation.thumbnail_url.includes('leagues/500/nba.png')) {
    errors.push(`WRONG THUMBNAIL: Got league logo but expected team logo`);
  }

  const passed = errors.length === 0;
  console.log(`\nTeam Spread Canary: ${passed ? 'PASSED' : 'FAILED'}`);
  if (!passed) {
    console.log('Errors:', errors);
  }

  return {
    testName: 'TEAM_SPREAD_CANARY',
    passed,
    details: {
      pick_id: pickId,
      presentation,
      postingGate,
    },
    errors,
  };
}

// ---- CANARY 3: GAME TOTAL ----
async function canaryGameTotal(capperId: string, capperName: string): Promise<CanaryResult> {
  console.log('\n=== CANARY 3: GAME TOTAL ===');

  const errors: string[] = [];
  const betSlipId = uuidv4();
  const pickId = uuidv4();

  // Simulate a game total pick
  const pick: UnifiedPickRow = {
    id: pickId,
    bet_slip_id: betSlipId,
    user_id: capperId,
    sport: 'NBA',
    stat_type: 'total',
    bet_type: 'total',
    selection: 'OVER 224.5',
    line: 224.5,
    odds: -110,
    direction: 'over',
    tier: 'C',
    unit_size: 1,
    matchup: 'Lakers @ Warriors',
    meta: {
      pick_origin: 'capper',
      capper: capperName,
      canary_test: true,
      canary_id: 'EMBED-TRUTH-FIX-031-TOTAL',
    },
  };

  console.log('Pick data:', JSON.stringify(pick, null, 2));

  // Test 1: Posting Gate Validation
  console.log('\n--- Test 1: Posting Gate ---');
  const postingGate = validatePostingGate({
    player_name: pick.player_name,
    team: pick.team,
    selection: pick.selection,
    stat_type: pick.stat_type,
    bet_type: pick.bet_type,
    line: pick.line,
    direction: pick.direction,
  });

  console.log('Posting Gate Result:', JSON.stringify(postingGate, null, 2));

  if (!postingGate.canPost) {
    errors.push(`Posting gate failed: ${postingGate.violations.join(', ')}`);
  }

  // Test 2: Build Presentation
  console.log('\n--- Test 2: Build Presentation ---');
  const presentation = await buildPickPresentation(pick);
  console.log('Presentation:', JSON.stringify(presentation, null, 2));

  // Verify market label is "Game Total"
  if (presentation.market_label !== 'Game Total') {
    errors.push(`WRONG MARKET LABEL: Got "${presentation.market_label}" but expected "Game Total"`);
  }

  // Verify market_type is total
  if (presentation.market_type !== 'total') {
    errors.push(`WRONG MARKET TYPE: Got "${presentation.market_type}" but expected "total"`);
  }

  // Verify title contains direction and line
  if (!presentation.title.toLowerCase().includes('over') || !presentation.title.includes('224.5')) {
    errors.push(`WRONG TITLE: Got "${presentation.title}" but expected to contain "Over" and "224.5"`);
  }

  const passed = errors.length === 0;
  console.log(`\nGame Total Canary: ${passed ? 'PASSED' : 'FAILED'}`);
  if (!passed) {
    console.log('Errors:', errors);
  }

  return {
    testName: 'GAME_TOTAL_CANARY',
    passed,
    details: {
      pick_id: pickId,
      presentation,
      postingGate,
    },
    errors,
  };
}

// ---- MAIN ----
async function main() {
  console.log('=== EMBED-TRUTH-FIX-031 CANARY TEST ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Get build info first
  const buildInfo = getBuildInfo('embed-truth-canary');
  console.log(`\nBuild Info:`);
  console.log(`  Commit: ${buildInfo.commit}`);
  console.log(`  Commit Short: ${buildInfo.commitShort}`);
  console.log(`  Branch: ${buildInfo.branch}`);
  console.log(`  Environment: ${buildInfo.environment}`);

  if (buildInfo.commitShort === 'unknown') {
    console.warn('\n BUILD SHA IS "unknown" - provenance not set!');
    console.warn('   Make sure to run: export GIT_COMMIT_SHORT=$(git rev-parse --short HEAD)');
    console.warn('   Or restart containers after updating dev.sh');
  }

  // Get a test capper
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(' Supabase credentials not set!');
    process.exit(1);
  }

  const { data: cappers, error: capperError } = await supabase
    .from('users')
    .select('id, username')
    .eq('active', true)
    .limit(1);

  if (capperError || !cappers?.length) {
    console.error(' Failed to fetch capper:', capperError?.message);
    process.exit(1);
  }
  const capper = cappers[0];
  console.log(`\nUsing capper: ${capper.username} (${capper.id})`);

  // Run all canaries
  const results: CanaryResult[] = [];

  results.push(await canaryPlayerProp(capper.id, capper.username));
  results.push(await canaryTeamSpread(capper.id, capper.username));
  results.push(await canaryGameTotal(capper.id, capper.username));

  // Summary
  console.log('\n========================================');
  console.log('=== CANARY SUMMARY ===');
  console.log('========================================');

  let allPassed = true;
  for (const result of results) {
    const status = result.passed ? 'PASS' : 'FAIL';
    console.log(`${status} ${result.testName}`);
    if (!result.passed) {
      allPassed = false;
      for (const error of result.errors) {
        console.log(`     ${error}`);
      }
    }
  }

  console.log('\n----------------------------------------');
  console.log(`Overall: ${allPassed ? 'ALL CANARIES PASSED' : 'SOME CANARIES FAILED'}`);
  console.log(`Build: ${buildInfo.commitShort}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('----------------------------------------');

  // Write proof file
  const proofData = {
    sprint: 'EMBED-TRUTH-FIX-031',
    phase: 'phase3',
    timestamp: new Date().toISOString(),
    buildInfo,
    results: results.map(r => ({
      testName: r.testName,
      passed: r.passed,
      errors: r.errors,
    })),
    allPassed,
  };

  console.log('\nProof data (for artifact):');
  console.log(JSON.stringify(proofData, null, 2));

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Canary script error:', err);
  process.exit(1);
});
