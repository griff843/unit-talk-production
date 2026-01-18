/**
 * Phase C: Create Approved Pick from Raw Prop (v2 - Schema Corrected)
 *
 * Creates an approved pick using correct picks table schema
 * Uses the candidate from Phase B
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment from repo root
config({ path: resolve(__dirname, '../.env.shared') });
config({ path: resolve(__dirname, '../.env'), override: true });
config({ path: resolve(__dirname, '../.env.canary'), override: true });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID = '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a';

// Candidate from Phase B
const RAW_PROP_CANDIDATE = {
  raw_prop_id: '70695d79-f59d-4690-904f-3955daee03a8',
  sport: 'NCAAB',
  league: 'NCAAB',
  home_team: 'Missouri Tigers',
  away_team: 'Alabama St Hornets',
  selection: 'Alabama St Hornets', // Away team for moneyline
  market: 'FanDuel',
  bet_type: 'moneyline',
  line: 0,
  odds: 3500,
  canonical_game_id: 'e9423c83-d210-4598-982e-7db390adc333',
  canonical_player_id: '2703db84-31b7-4a07-bd09-02443cba2ee3',
  external_game_id: '602e77923111f4e11b2b2fcd70005cf5',
};

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function createApprovedPick(): Promise<void> {
  console.log('🎯 Creating approved pick from raw_prop candidate...\n');

  // Step 1: Get valid user_id from recent approved pick
  console.log('Step 1: Discovering valid user_id from existing picks');
  const { data: recentPicks, error: picksError } = await supabase
    .from('picks')
    .select('id, user_id, workflow_stage')
    .eq('workflow_stage', 'approved')
    .order('created_at', { ascending: false })
    .limit(5);

  if (picksError) {
    console.error('❌ Error querying picks:', picksError);
    process.exit(1);
  }

  if (!recentPicks || recentPicks.length === 0) {
    console.error('❌ No approved picks found to get user_id');
    process.exit(1);
  }

  console.log(`✅ Found ${recentPicks.length} approved picks`);
  console.log('Using user_id from most recent approved pick:', recentPicks[0].id);

  const userId = recentPicks[0].user_id;
  await createPickDirect(userId);
}

async function createPickDirect(userId: string): Promise<void> {
  console.log(`\nStep 2: Creating pick directly in picks table`);
  console.log(`  Tenant ID: ${TENANT_ID}`);
  console.log(`  User ID: ${userId}`);

  const correlationId = `canary-test-${Date.now()}`;

  // Build pick record using CORRECT schema
  const pickRecord = {
    tenant_id: TENANT_ID,
    user_id: userId,
    prop_id: null, // Set to null like existing test picks (raw_prop_id stored in metadata)
    selection: RAW_PROP_CANDIDATE.selection,
    odds: RAW_PROP_CANDIDATE.odds,
    stake: 10, // Small test stake (not stake_amount)
    confidence: 8, // Integer 1-10 (not "HIGH")
    workflow_stage: 'approved',
    status: 'pending',
    idempotency_key: correlationId,
    metadata: {
      // Store all game/prop details in metadata
      raw_prop_id: RAW_PROP_CANDIDATE.raw_prop_id, // Store raw_prop_id here
      sport: RAW_PROP_CANDIDATE.sport,
      league: RAW_PROP_CANDIDATE.league,
      home_team: RAW_PROP_CANDIDATE.home_team,
      away_team: RAW_PROP_CANDIDATE.away_team,
      bet_type: RAW_PROP_CANDIDATE.bet_type,
      market: RAW_PROP_CANDIDATE.market,
      line: RAW_PROP_CANDIDATE.line,
      canonical_game_id: RAW_PROP_CANDIDATE.canonical_game_id,
      canonical_player_id: RAW_PROP_CANDIDATE.canonical_player_id,
      external_game_id: RAW_PROP_CANDIDATE.external_game_id,
      source: 'CANARY_LIVE_FIRE_TEST',
      test_timestamp: new Date().toISOString(),
      phase: 'Phase C - Pick Creation',
      game: `${RAW_PROP_CANDIDATE.away_team} @ ${RAW_PROP_CANDIDATE.home_team}`,
    },
  };

  console.log('\nPick Record (sanitized):');
  console.log(JSON.stringify(pickRecord, null, 2));

  const { data, error } = await supabase
    .from('picks')
    .insert(pickRecord)
    .select()
    .single();

  if (error) {
    console.error('\n❌ Direct insert failed:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    process.exit(1);
  }

  console.log('\n✅ Pick created successfully');
  console.log('New pick ID:', data.id);

  await verifyPick(data.id);
}

async function verifyPick(pickId: string): Promise<void> {
  console.log(`\nStep 3: Verifying pick ${pickId}`);

  // Verify pick exists and has correct workflow_stage
  const { data: pick, error: pickError } = await supabase
    .from('picks')
    .select('id, workflow_stage, prop_id, selection, odds, stake, confidence, metadata, created_at')
    .eq('id', pickId)
    .single();

  if (pickError) {
    console.error('❌ Error verifying pick:', pickError);
    process.exit(1);
  }

  console.log('\n✅ Pick verified:');
  console.log(JSON.stringify(pick, null, 2));

  if (pick.workflow_stage !== 'approved') {
    console.error(`\n⚠️  WARNING: Pick workflow_stage is "${pick.workflow_stage}", not "approved"`);
    console.log('This may require manual approval before CANARY promotion');
  } else {
    console.log('\n✅ Pick is APPROVED');
  }

  // Check for existing CANARY publish record
  console.log('\nStep 4: Checking for existing CANARY publish record');
  const { data: publishRecords, error: publishError } = await supabase
    .from('pick_publish')
    .select('id, channel, status, created_at')
    .eq('pick_id', pickId)
    .eq('channel', 'CANARY');

  if (publishError) {
    console.error('⚠️  Error checking pick_publish:', publishError);
  } else if (publishRecords && publishRecords.length > 0) {
    console.error('\n⚠️  WARNING: CANARY publish record already exists!');
    console.log('Existing records:', publishRecords);
  } else {
    console.log('✅ No existing CANARY publish record (good)');
  }

  // Check for any events created
  console.log('\nStep 5: Checking for events');
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, event_type, created_at')
    .eq('entity_id', pickId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (eventsError) {
    console.error('⚠️  Error checking events:', eventsError);
  } else if (events && events.length > 0) {
    console.log(`✅ Found ${events.length} events:`);
    events.forEach(evt => {
      console.log(`  - ${evt.event_type} (${evt.id}) at ${evt.created_at}`);
    });
  } else {
    console.log('ℹ️  No events found (expected for direct inserts)');
  }

  console.log('\n' + '═'.repeat(80));
  console.log('📊 PHASE C SUMMARY');
  console.log('═'.repeat(80));
  console.log(`New Pick ID: ${pickId}`);
  console.log(`Workflow Stage: ${pick.workflow_stage}`);
  console.log(`Canonical Game ID: ${pick.metadata?.canonical_game_id || 'N/A'}`);
  console.log(`Sport/League: ${pick.metadata?.sport}/${pick.metadata?.league}`);
  console.log(`Game: ${pick.metadata?.game}`);
  console.log(`Selection: ${pick.selection}`);
  console.log(`Odds: ${pick.odds}`);
  console.log(`Confidence: ${pick.confidence}/10`);
  console.log(`Stake: $${pick.stake}`);
  console.log(`Events Created: ${events?.length || 0}`);
  console.log(`CANARY Publish Exists: ${publishRecords && publishRecords.length > 0 ? 'YES (BLOCKED)' : 'NO (READY)'}`);
  console.log('═'.repeat(80));

  if (pick.workflow_stage === 'approved' && (!publishRecords || publishRecords.length === 0)) {
    console.log('\n✅ ✅ ✅ Pick is READY for CANARY promotion (Phase D) ✅ ✅ ✅');
  } else {
    console.log('\n⚠️  Pick may need manual intervention before Phase D');
  }
}

// Run the creation
createApprovedPick().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
