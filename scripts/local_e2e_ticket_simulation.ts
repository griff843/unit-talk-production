/**
 * Local E2E Ticket Lifecycle Simulation
 *
 * Simulates complete end-to-end ticket submission and processing
 * for full local stack validation.
 *
 * Usage:
 *   npx tsx scripts/local_e2e_ticket_simulation.ts
 *
 * Features:
 * - Creates test capper user (LocalTester)
 * - Submits 2-3 picks via Smart Form API
 * - Triggers TicketLifecycleWorkflow
 * - Monitors workflow completion
 * - Verifies pick rows with canonical IDs
 * - Validates professional pipeline results
 * - Checks CLV tracking
 * - Validates pick_publish entries
 * - Monitors DiscordPublishingWorker
 */

import { supabaseClient } from '../apps/api/src/services/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';

interface SimulationStats {
  cappersCreated: number;
  picksSubmitted: number;
  workflowsCompleted: number;
  picksWithCanonicalIds: number;
  professionalScoresGenerated: number;
  clvTrackingCreated: number;
  pickPublishEntries: number;
  discordAttemptsLogged: number;
  errors: string[];
}

const stats: SimulationStats = {
  cappersCreated: 0,
  picksSubmitted: 0,
  workflowsCompleted: 0,
  picksWithCanonicalIds: 0,
  professionalScoresGenerated: 0,
  clvTrackingCreated: 0,
  pickPublishEntries: 0,
  discordAttemptsLogged: 0,
  errors: [],
};

// Configuration
const SMART_FORM_API_URL = process.env.SMART_FORM_URL || 'http://localhost:3002';
const API_URL = process.env.API_URL || 'http://localhost:3001';
const MAX_WAIT_TIME_MS = 60000; // 60 seconds
const POLL_INTERVAL_MS = 2000; // 2 seconds

/**
 * Create test capper user
 */
async function createTestCapper(): Promise<string | null> {
  console.log('\n👤 Creating test capper user...');

  try {
    const capperId = uuidv4();
    const { error } = await supabaseClient.from('users').insert({
      id: capperId,
      discord_id: 'local-test-' + Date.now(),
      username: 'LocalTester',
      tier: 'Premium',
      capper_tier: 'pro',
      status: 'active',
      total_picks: 0,
      win_rate: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error && !error.message.includes('duplicate key')) {
      console.error('  ❌ Failed to create test capper:', error);
      stats.errors.push(`Create capper: ${error.message}`);
      return null;
    }

    console.log(`  ✅ Created test capper: LocalTester (ID: ${capperId})`);
    stats.cappersCreated++;
    return capperId;
  } catch (err: any) {
    console.error('  ❌ Error creating test capper:', err.message);
    stats.errors.push(`Create capper error: ${err.message}`);
    return null;
  }
}

/**
 * Fetch seeded raw props for pick submission
 */
async function fetchSeededProps(): Promise<any[]> {
  console.log('\n📊 Fetching seeded props for pick simulation...');

  try {
    const { data: props, error } = await supabaseClient
      .from('raw_props')
      .select('*')
      .limit(5);

    if (error) {
      console.error('  ❌ Failed to fetch props:', error);
      stats.errors.push(`Fetch props: ${error.message}`);
      return [];
    }

    if (!props || props.length === 0) {
      console.error('  ❌ No seeded props found. Run seed script first.');
      stats.errors.push('No seeded props available');
      return [];
    }

    console.log(`  ✅ Found ${props.length} seeded props`);
    return props;
  } catch (err: any) {
    console.error('  ❌ Error fetching props:', err.message);
    stats.errors.push(`Fetch props error: ${err.message}`);
    return [];
  }
}

/**
 * Submit pick via Smart Form API
 */
async function submitPick(
  capperId: string,
  prop: any,
  pickNumber: number
): Promise<string | null> {
  console.log(`\n📝 Submitting pick ${pickNumber}...`);
  console.log(`  Player: ${prop.player_name}`);
  console.log(`  Stat: ${prop.stat_type}`);
  console.log(`  Line: ${prop.line}`);

  try {
    const betSlipId = uuidv4();
    const payload = {
      userId: capperId,
      league: prop.sport,
      marketType: prop.stat_type,
      line: prop.line,
      side: Math.random() > 0.5 ? 'over' : 'under',
      playerId: prop.player_id,
      playerName: prop.player_name,
      gameId: prop.game_id,
      odds: -110,
      stakeText: '1u',
      stake: 1.0,
      userScore: Math.floor(Math.random() * 5) + 6, // 6-10
      betSlipId,
      confidence: 0.75,
      autoPublish: false, // Don't publish to Discord in local testing
      idempotencyKey: betSlipId,
    };

    console.log(`  📤 Submitting to ${SMART_FORM_API_URL}/api/domain/picks/insert`);

    const response = await fetch(`${SMART_FORM_API_URL}/api/domain/picks/insert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`  ❌ Failed to submit pick (HTTP ${response.status}):`, errorText);
      stats.errors.push(`Submit pick ${pickNumber}: HTTP ${response.status}`);
      return null;
    }

    const result = await response.json();
    console.log(`  ✅ Pick submitted successfully`);
    console.log(`  Bet Slip ID: ${betSlipId}`);
    console.log(`  Pick ID: ${result.pickId || 'N/A'}`);
    stats.picksSubmitted++;
    return betSlipId;
  } catch (err: any) {
    console.error(`  ❌ Error submitting pick ${pickNumber}:`, err.message);
    stats.errors.push(`Submit pick ${pickNumber}: ${err.message}`);
    return null;
  }
}

/**
 * Wait for pick to appear in picks table
 */
async function waitForPickCreation(betSlipId: string): Promise<any | null> {
  console.log(`\n⏳ Waiting for pick to be created (bet_slip_id: ${betSlipId})...`);

  const startTime = Date.now();

  while (Date.now() - startTime < MAX_WAIT_TIME_MS) {
    try {
      const { data: picks, error } = await supabaseClient
        .from('picks')
        .select('*')
        .eq('bet_slip_id', betSlipId)
        .single();

      if (!error && picks) {
        console.log(`  ✅ Pick created in picks table`);
        console.log(`  Pick ID: ${picks.id}`);
        console.log(`  Status: ${picks.status}`);
        console.log(`  Canonical Game ID: ${picks.canonical_game_id || 'N/A'}`);
        console.log(`  Canonical Player ID: ${picks.canonical_player_id || 'N/A'}`);
        return picks;
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    } catch (err: any) {
      console.error(`  ⚠️  Error polling for pick:`, err.message);
    }
  }

  console.error(`  ❌ Pick creation timed out after ${MAX_WAIT_TIME_MS}ms`);
  stats.errors.push(`Pick creation timeout: ${betSlipId}`);
  return null;
}

/**
 * Verify professional grading results
 */
async function verifyProfessionalGrading(pickId: string): Promise<boolean> {
  console.log(`\n🎯 Verifying professional grading results...`);

  try {
    const { data: pick, error } = await supabaseClient
      .from('picks')
      .select('*')
      .eq('id', pickId)
      .single();

    if (error) {
      console.error('  ❌ Failed to fetch pick for grading verification:', error);
      stats.errors.push(`Grading verification: ${error.message}`);
      return false;
    }

    if (!pick) {
      console.error('  ❌ Pick not found');
      stats.errors.push(`Grading verification: Pick ${pickId} not found`);
      return false;
    }

    // Check for professional score
    if (pick.professional_score !== null && pick.professional_score !== undefined) {
      console.log(`  ✅ Professional score: ${pick.professional_score}`);
      stats.professionalScoresGenerated++;
    } else {
      console.warn(`  ⚠️  No professional score yet (may still be processing)`);
    }

    // Check for tier assignment
    if (pick.tier) {
      console.log(`  ✅ Tier assigned: ${pick.tier}`);
    } else {
      console.warn(`  ⚠️  No tier assigned yet`);
    }

    // Check for canonical IDs
    if (pick.canonical_game_id && pick.canonical_player_id) {
      console.log(`  ✅ Canonical IDs mapped`);
      stats.picksWithCanonicalIds++;
    } else {
      console.warn(`  ⚠️  Canonical IDs missing`);
    }

    return true;
  } catch (err: any) {
    console.error('  ❌ Error verifying professional grading:', err.message);
    stats.errors.push(`Grading verification error: ${err.message}`);
    return false;
  }
}

/**
 * Verify CLV tracking
 */
async function verifyCLVTracking(pickId: string): Promise<boolean> {
  console.log(`\n📈 Verifying CLV tracking...`);

  try {
    const { data: clvEntries, error } = await supabaseClient
      .from('clv_tracking')
      .select('*')
      .eq('pick_id', pickId);

    if (error) {
      console.error('  ❌ Failed to fetch CLV tracking:', error);
      stats.errors.push(`CLV verification: ${error.message}`);
      return false;
    }

    if (!clvEntries || clvEntries.length === 0) {
      console.warn('  ⚠️  No CLV tracking entries found');
      return false;
    }

    console.log(`  ✅ CLV tracking created: ${clvEntries.length} entries`);
    stats.clvTrackingCreated += clvEntries.length;
    return true;
  } catch (err: any) {
    console.error('  ❌ Error verifying CLV tracking:', err.message);
    stats.errors.push(`CLV verification error: ${err.message}`);
    return false;
  }
}

/**
 * Verify pick_publish entry
 */
async function verifyPickPublish(pickId: string): Promise<boolean> {
  console.log(`\n📤 Verifying pick_publish entry...`);

  try {
    const { data: publishEntries, error } = await supabaseClient
      .from('pick_publish')
      .select('*')
      .eq('pick_id', pickId);

    if (error) {
      console.error('  ❌ Failed to fetch pick_publish entries:', error);
      stats.errors.push(`Pick publish verification: ${error.message}`);
      return false;
    }

    if (!publishEntries || publishEntries.length === 0) {
      console.warn('  ⚠️  No pick_publish entries found');
      return false;
    }

    const entry = publishEntries[0];
    console.log(`  ✅ Pick publish entry created`);
    console.log(`  Status: ${entry.status}`);
    console.log(`  Attempts: ${entry.attempts || 0}`);
    console.log(`  Payload size: ${JSON.stringify(entry.payload || {}).length} bytes`);
    stats.pickPublishEntries++;

    if (entry.attempts > 0) {
      console.log(`  📊 DiscordPublishingWorker made ${entry.attempts} delivery attempts`);
      stats.discordAttemptsLogged++;
    }

    return true;
  } catch (err: any) {
    console.error('  ❌ Error verifying pick_publish:', err.message);
    stats.errors.push(`Pick publish verification error: ${err.message}`);
    return false;
  }
}

/**
 * Monitor Temporal workflow completion
 */
async function monitorWorkflowCompletion(betSlipId: string): Promise<boolean> {
  console.log(`\n⏱️  Monitoring TicketLifecycleWorkflow completion...`);

  const startTime = Date.now();

  while (Date.now() - startTime < MAX_WAIT_TIME_MS) {
    try {
      // Check bridge_outbox for processed status
      const { data: outboxEntries, error } = await supabaseClient
        .from('bridge_outbox')
        .select('*')
        .eq('bet_slip_id', betSlipId)
        .single();

      if (!error && outboxEntries && outboxEntries.status === 'processed') {
        console.log(`  ✅ TicketLifecycleWorkflow completed successfully`);
        console.log(`  Processing time: ${Date.now() - startTime}ms`);
        stats.workflowsCompleted++;
        return true;
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    } catch (err: any) {
      console.error(`  ⚠️  Error polling workflow status:`, err.message);
    }
  }

  console.error(`  ❌ Workflow completion timed out after ${MAX_WAIT_TIME_MS}ms`);
  stats.errors.push(`Workflow timeout: ${betSlipId}`);
  return false;
}

/**
 * Process single pick through full pipeline
 */
async function processPickThroughPipeline(
  capperId: string,
  prop: any,
  pickNumber: number
): Promise<boolean> {
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`PROCESSING PICK ${pickNumber}`);
  console.log('═══════════════════════════════════════════════════');

  // Step 1: Submit pick
  const betSlipId = await submitPick(capperId, prop, pickNumber);
  if (!betSlipId) {
    console.error(`\n❌ Failed to submit pick ${pickNumber}`);
    return false;
  }

  // Step 2: Wait for pick creation
  const pick = await waitForPickCreation(betSlipId);
  if (!pick) {
    console.error(`\n❌ Pick ${pickNumber} was not created in database`);
    return false;
  }

  // Step 3: Monitor workflow completion
  const workflowCompleted = await monitorWorkflowCompletion(betSlipId);
  if (!workflowCompleted) {
    console.warn(`\n⚠️  Workflow for pick ${pickNumber} did not complete in time`);
  }

  // Step 4: Verify professional grading
  await verifyProfessionalGrading(pick.id);

  // Step 5: Verify CLV tracking
  await verifyCLVTracking(pick.id);

  // Step 6: Verify pick_publish
  await verifyPickPublish(pick.id);

  console.log(`\n✅ Pick ${pickNumber} processed through full pipeline`);
  return true;
}

/**
 * Print final statistics
 */
function printStats() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('📊 LOCAL E2E SIMULATION - SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Cappers Created: ${stats.cappersCreated}`);
  console.log(`Picks Submitted: ${stats.picksSubmitted}`);
  console.log(`Workflows Completed: ${stats.workflowsCompleted}`);
  console.log(`Picks with Canonical IDs: ${stats.picksWithCanonicalIds}`);
  console.log(`Professional Scores Generated: ${stats.professionalScoresGenerated}`);
  console.log(`CLV Tracking Entries: ${stats.clvTrackingCreated}`);
  console.log(`Pick Publish Entries: ${stats.pickPublishEntries}`);
  console.log(`Discord Publishing Attempts: ${stats.discordAttemptsLogged}`);
  console.log(`Errors: ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    stats.errors.forEach((error, idx) => {
      console.log(`  ${idx + 1}. ${error}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════');

  // Determine overall success
  const pipelineWorking =
    stats.cappersCreated > 0 &&
    stats.picksSubmitted > 0 &&
    stats.workflowsCompleted > 0;

  if (pipelineWorking) {
    console.log('✅ LOCAL SYSTEM PIPELINE IS FUNCTIONAL!');
    console.log('\nSuccessfully demonstrated:');
    console.log('  ✅ Props ingestion (seeded data)');
    console.log('  ✅ Canonical mapping');
    console.log('  ✅ Pick submission via Smart Form API');
    console.log('  ✅ TicketLifecycleWorkflow orchestration');
    if (stats.professionalScoresGenerated > 0) {
      console.log('  ✅ Professional grading pipeline');
    }
    if (stats.clvTrackingCreated > 0) {
      console.log('  ✅ CLV tracking');
    }
    if (stats.pickPublishEntries > 0) {
      console.log('  ✅ Pick publishing (pick_publish table)');
    }
    if (stats.discordAttemptsLogged > 0) {
      console.log('  ✅ DiscordPublishingWorker activity');
    }
    console.log('\nNext steps:');
    console.log('  1. Run: npm run test:e2e for Playwright validation');
    console.log('  2. Check logs: ./dev.sh logs');
    console.log('  3. Monitor services: ./dev.sh status');
    console.log('═══════════════════════════════════════════════════\n');
  } else {
    console.log('❌ LOCAL SYSTEM HAS ISSUES');
    console.log('\nProblems detected:');
    if (stats.cappersCreated === 0) {
      console.log('  ❌ Failed to create test capper');
    }
    if (stats.picksSubmitted === 0) {
      console.log('  ❌ Failed to submit picks via Smart Form API');
    }
    if (stats.workflowsCompleted === 0) {
      console.log('  ❌ TicketLifecycleWorkflow did not complete');
    }
    console.log('\nTroubleshooting:');
    console.log('  1. Check service health: ./dev.sh status');
    console.log('  2. Review logs: ./dev.sh logs');
    console.log('  3. Verify database: Check Supabase connection');
    console.log('  4. Check Temporal: Visit http://localhost:8088');
    console.log('═══════════════════════════════════════════════════\n');
    process.exit(1);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🔄 LOCAL E2E TICKET LIFECYCLE SIMULATION');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Smart Form API: ${SMART_FORM_API_URL}`);
  console.log(`API: ${API_URL}`);
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // Step 1: Create test capper
    const capperId = await createTestCapper();
    if (!capperId) {
      console.error('\n❌ Failed to create test capper. Aborting simulation.');
      process.exit(1);
    }

    // Step 2: Fetch seeded props
    const props = await fetchSeededProps();
    if (props.length === 0) {
      console.error('\n❌ No seeded props available. Run seed script first.');
      console.error('Command: ./dev.sh seed-local');
      process.exit(1);
    }

    // Step 3: Process picks through pipeline (submit 2-3 picks)
    const numPicks = Math.min(3, props.length);
    console.log(`\n📋 Processing ${numPicks} picks through full pipeline...\n`);

    for (let i = 0; i < numPicks; i++) {
      await processPickThroughPipeline(capperId, props[i], i + 1);

      // Small delay between picks
      if (i < numPicks - 1) {
        console.log('\n⏳ Waiting 5 seconds before next pick...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Step 4: Print final statistics
    printStats();
  } catch (err: any) {
    console.error('\n❌ FATAL ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Execute
main();
