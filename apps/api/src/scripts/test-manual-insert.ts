import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInserts() {
  console.log('🧪 Testing manual inserts...\n');

  // Test 1: Insert with DraftKings
  console.log('📝 Test 1: Inserting Red Sox @ DraftKings +210...');
  const { data: insert1, error: error1 } = await supabase
    .from('unified_picks')
    .insert({
      user_id: '7ce2ba1f-459f-47cf-ab06-dc3566a847c6',
      pick_type: 'single',
      external_game_id: 'test_game_123',
      external_prop_id: null,
      market: 'h2h',
      selection: 'Boston Red Sox',
      odds: 210,
      metadata: {
        bookmaker: 'DraftKings',
        bookmaker_key: 'draftkings'
      }
    })
    .select();

  if (error1) {
    console.error('  ❌ Error:', error1);
  } else {
    console.log('  ✅ Success! ID:', insert1[0]?.id);
  }

  // Test 2: Insert same pick with FanDuel (should work - different bookmaker)
  console.log('\n📝 Test 2: Inserting Red Sox @ FanDuel +210 (different bookmaker)...');
  const { data: insert2, error: error2 } = await supabase
    .from('unified_picks')
    .insert({
      user_id: '7ce2ba1f-459f-47cf-ab06-dc3566a847c6',
      pick_type: 'single',
      external_game_id: 'test_game_123',
      external_prop_id: null,
      market: 'h2h',
      selection: 'Boston Red Sox',
      odds: 210,
      metadata: {
        bookmaker: 'FanDuel',
        bookmaker_key: 'fanduel'
      }
    })
    .select();

  if (error2) {
    console.error('  ❌ Error:', error2);
  } else {
    console.log('  ✅ Success! ID:', insert2[0]?.id);
  }

  // Test 3: Try duplicate (should fail)
  console.log('\n📝 Test 3: Inserting duplicate Red Sox @ DraftKings +210 (should fail)...');
  const { data: insert3, error: error3 } = await supabase
    .from('unified_picks')
    .insert({
      user_id: '7ce2ba1f-459f-47cf-ab06-dc3566a847c6',
      pick_type: 'single',
      external_game_id: 'test_game_123',
      external_prop_id: null,
      market: 'h2h',
      selection: 'Boston Red Sox',
      odds: 210,
      metadata: {
        bookmaker: 'DraftKings',
        bookmaker_key: 'draftkings'
      }
    })
    .select();

  if (error3) {
    console.log('  ✅ Correctly rejected duplicate! Error:', error3.code);
  } else {
    console.error('  ❌ Should have failed but succeeded!');
  }

  // Verify inserts
  console.log('\n🔍 Verifying picks in database...');
  const { data: picks, count } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact' })
    .eq('external_game_id', 'test_game_123');

  console.log(`📊 Total test picks: ${count}`);
  picks?.forEach(pick => {
    console.log(`  - ${pick.selection} @ ${pick.metadata.bookmaker_key} (+${pick.odds})`);
  });

  // Cleanup
  console.log('\n🧹 Cleaning up test data...');
  const { error: deleteError } = await supabase
    .from('unified_picks')
    .delete()
    .eq('external_game_id', 'test_game_123');

  if (deleteError) {
    console.error('  ❌ Cleanup error:', deleteError);
  } else {
    console.log('  ✅ Test data cleaned up');
  }
}

testInserts().catch(console.error);
