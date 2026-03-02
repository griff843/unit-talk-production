/**
 * Test CCC API locally
 * Sprint: CAPPER-COMMAND-CENTER-MVP-001
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testCCCAPI() {
  console.log('=== CCC API TEST ===\n');

  // Test 1: Fetch from view_scored_legs_latest
  console.log('--- TEST 1: Fetch scored legs ---');
  const { data: legs, error: legsErr } = await supabase
    .from('view_scored_legs_latest')
    .select('*')
    .limit(10);

  if (legsErr) {
    console.log('Error:', legsErr.message);
  } else {
    console.log(`Found ${legs?.length || 0} scored legs`);
    if (legs && legs.length > 0) {
      console.log('Sample leg keys:', Object.keys(legs[0]).join(', '));
    }
  }
  console.log('');

  // Test 2: Verify capper_actions table exists
  console.log('--- TEST 2: Verify capper_actions table ---');
  const { data: actions, error: actionsErr } = await supabase
    .from('capper_actions')
    .select('*')
    .limit(1);

  if (actionsErr) {
    console.log('Error:', actionsErr.message);
  } else {
    console.log('capper_actions table exists');
    console.log(`Current action count: ${actions?.length || 0}`);
  }
  console.log('');

  // Test 3: Insert a test action
  console.log('--- TEST 3: Insert test action ---');
  const testAction = {
    leg_id: '00000000-0000-0000-0000-000000000001',
    action: 'APPROVE',
    actor_id: 'test-capper',
    actor_name: 'Test Capper',
    ranking_version: 'ccc_rank_v1.0.0',
    p_final: 0.55,
    p_market_devig: 0.52,
    edge_final: 0.03,
    uncertainty_final: 0.08,
    rank_position: 1,
  };

  const { data: insertedAction, error: insertErr } = await supabase
    .from('capper_actions')
    .insert(testAction)
    .select()
    .single();

  if (insertErr) {
    console.log('Insert error:', insertErr.message);
  } else {
    console.log('Action inserted successfully');
    console.log(JSON.stringify(insertedAction, null, 2));
  }
  console.log('');

  // Test 4: Verify override rate view
  console.log('--- TEST 4: Verify override rate view ---');
  const { data: overrideRate, error: overrideErr } = await supabase
    .from('view_capper_override_rate')
    .select('*')
    .limit(5);

  if (overrideErr) {
    console.log('Error:', overrideErr.message);
  } else {
    console.log('view_capper_override_rate exists');
    console.log(JSON.stringify(overrideRate, null, 2));
  }

  console.log('\n=== TEST COMPLETE ===');
}

testCCCAPI().catch(e => {
  console.error('Test failed:', e.message);
  process.exit(1);
});
