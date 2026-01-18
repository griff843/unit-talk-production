/**
 * Phase C: Create Approved Pick from Raw Prop
 *
 * Creates an approved pick via official RPC function
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
    console.log('Trying any pick...');

    const { data: anyPicks, error: anyError } = await supabase
      .from('picks')
      .select('id, user_id, workflow_stage')
      .order('created_at', { ascending: false })
      .limit(5);

    if (anyError || !anyPicks || anyPicks.length === 0) {
      console.error('❌ No picks found in database');
      process.exit(1);
    }

    console.log(`✅ Found ${anyPicks.length} picks (any status)`);
    console.log('Using user_id from:', anyPicks[0]);

    const userId = anyPicks[0].user_id;
    await createPickWithRPC(userId);
    return;
  }

  console.log(`✅ Found ${recentPicks.length} approved picks`);
  console.log('Using user_id from most recent approved pick:', recentPicks[0].id);

  const userId = recentPicks[0].user_id;
  await createPickWithRPC(userId);
}

async function createPickWithRPC(userId: string): Promise<void> {
  console.log(`\nStep 2: Calling RPC create_pick_with_event`);
  console.log(`  Tenant ID: ${TENANT_ID}`);
  console.log(`  User ID: ${userId}`);

  // Build pick_data_jsonb
  const pickData = {
    sport: RAW_PROP_CANDIDATE.sport,
    league: RAW_PROP_CANDIDATE.league,
    game_info: {
      home_team: RAW_PROP_CANDIDATE.home_team,
      away_team: RAW_PROP_CANDIDATE.away_team,
      canonical_game_id: RAW_PROP_CANDIDATE.canonical_game_id,
      external_game_id: RAW_PROP_CANDIDATE.external_game_id,
    },
    bet_type: RAW_PROP_CANDIDATE.bet_type,
    market: RAW_PROP_CANDIDATE.market,
    selection: RAW_PROP_CANDIDATE.selection,
    odds: RAW_PROP_CANDIDATE.odds,
    line: RAW_PROP_CANDIDATE.line,
    canonical_game_id: RAW_PROP_CANDIDATE.canonical_game_id,
    canonical_player_id: RAW_PROP_CANDIDATE.canonical_player_id,
    raw_prop_id: RAW_PROP_CANDIDATE.raw_prop_id,
    workflow_stage: 'approved', // Request approved workflow stage
    source: 'CANARY_LIVE_FIRE_TEST',
    stake_amount: 10, // Small test stake
    confidence: 'HIGH',
  };

  const correlationId = `canary-test-${Date.now()}`;

  console.log('\nPick Data (sanitized):');
  console.log(JSON.stringify(pickData, null, 2));
  console.log(`\nCorrelation ID: ${correlationId}`);

  // Call RPC
  const { data, error } = await supabase.rpc('create_pick_with_event', {
    p_tenant_id: TENANT_ID,
    p_user_id: userId,
    p_pick_data: pickData,
    p_correlation_id: correlationId,
  });

  if (error) {
    console.error('\n❌ RPC call failed:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));

    // Try alternative: direct insert as fallback
    console.log('\n⚠️  Attempting fallback: direct insert to picks table');
    await createPickDirect(userId, pickData, correlationId);
    return;
  }

  console.log('\n✅ RPC call succeeded');
  console.log('Response:', JSON.stringify(data, null, 2));

  // Extract pick ID from response
  const pickId = data?.pick_id || data?.id || data;

  if (!pickId) {
    console.error('❌ No pick ID in RPC response');
    console.error('Full response:', data);
    process.exit(1);
  }

  await verifyPick(pickId);
}

async function createPickDirect(userId: string, pickData: any, correlationId: string): Promise<void> {
  console.log('Creating pick directly in picks table...');

  const pickRecord = {
    tenant_id: TENANT_ID,
    user_id: userId,
    sport: pickData.sport,
    league: pickData.league,
    home_team: pickData.game_info.home_team,
    away_team: pickData.game_info.away_team,
    bet_type: pickData.bet_type,
    market: pickData.market,
    selection: pickData.selection,
    odds: pickData.odds,
    line: pickData.line,
    canonical_game_id: pickData.canonical_game_id,
    canonical_player_id: pickData.canonical_player_id,
    workflow_stage: 'approved',
    confidence: pickData.confidence,
    stake_amount: pickData.stake_amount,
    source: pickData.source,
    correlation_id: correlationId,
  };

  const { data, error } = await supabase
    .from('picks')
    .insert(pickRecord)
    .select()
    .single();

  if (error) {
    console.error('❌ Direct insert failed:', error);
    process.exit(1);
  }

  console.log('✅ Direct insert succeeded');
  console.log('New pick ID:', data.id);

  await verifyPick(data.id);
}

async function verifyPick(pickId: string): Promise<void> {
  console.log(`\nStep 3: Verifying pick ${pickId}`);

  // Verify pick exists and has correct workflow_stage
  const { data: pick, error: pickError } = await supabase
    .from('picks')
    .select('id, workflow_stage, canonical_game_id, canonical_player_id, sport, league, selection, odds, created_at')
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
    console.log('ℹ️  No events found (may be expected for direct inserts)');
  }

  console.log('\n' + '═'.repeat(80));
  console.log('📊 PHASE C SUMMARY');
  console.log('═'.repeat(80));
  console.log(`New Pick ID: ${pickId}`);
  console.log(`Workflow Stage: ${pick.workflow_stage}`);
  console.log(`Canonical Game ID: ${pick.canonical_game_id}`);
  console.log(`Sport/League: ${pick.sport}/${pick.league}`);
  console.log(`Selection: ${pick.selection}`);
  console.log(`Odds: ${pick.odds}`);
  console.log(`Events Created: ${events?.length || 0}`);
  console.log(`CANARY Publish Exists: ${publishRecords && publishRecords.length > 0 ? 'YES (BLOCKED)' : 'NO (READY)'}`);
  console.log('═'.repeat(80));

  if (pick.workflow_stage === 'approved' && (!publishRecords || publishRecords.length === 0)) {
    console.log('\n✅ Pick is READY for CANARY promotion (Phase D)');
  } else {
    console.log('\n⚠️  Pick may need manual intervention before Phase D');
  }
}

// Run the creation
createApprovedPick().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
