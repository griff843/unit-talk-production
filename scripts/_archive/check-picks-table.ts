import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('=== Investigating picks table ===\n');

  // Get picks table schema by getting a sample row
  const { data: sample, error } = await supabase
    .from('picks')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('picks table columns:');
  Object.entries(sample).forEach(([key, value]) => {
    const valStr = JSON.stringify(value);
    console.log(`  ${key}: ${typeof value} = ${valStr?.substring(0, 60)}${(valStr?.length || 0) > 60 ? '...' : ''}`);
  });

  // Check if we can insert into picks
  console.log('\n=== Testing picks table insert ===');

  const testPick = {
    sport: 'NBA',
    player_name: 'Test Player',
    market: 'points',
    line: 20.5,
    odds: -110,
    side: 'over',
    status: 'approved',
  };

  const { data: insertResult, error: insertError } = await supabase
    .from('picks')
    .insert(testPick)
    .select()
    .single();

  if (insertError) {
    console.log('Insert error:', insertError.message);
    console.log('Full error:', JSON.stringify(insertError, null, 2));
  } else {
    console.log('✅ Insert successful!');
    console.log('New pick ID:', insertResult.id);

    // Try inserting into pick_publish with this ID
    console.log('\n=== Testing pick_publish with new picks ID ===');
    const { error: publishError } = await supabase
      .from('pick_publish')
      .insert({
        pick_id: insertResult.id,
        tenant_id: '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a',
        channel: 'CANARY',
        status: 'pending',
        attempts: 0,
        max_attempts: 1,
        dedupe_key: 'test_picks_fk_' + Date.now(),
      });

    if (!publishError) {
      console.log('✅ pick_publish insert successful!');
      // Clean up
      await supabase.from('pick_publish').delete().match({ pick_id: insertResult.id });
    } else {
      console.log('❌ pick_publish error:', publishError.message);
    }

    // Clean up test pick - CANONICAL: delete from unified_picks (picks is a read-only view)
    await supabase.from('unified_picks').delete().eq('id', insertResult.id);
    console.log('Cleaned up test data');
  }

  // Check relationship between picks and unified_picks
  console.log('\n=== Checking picks vs unified_picks relationship ===');
  const { data: picksCount } = await supabase
    .from('picks')
    .select('id', { count: 'exact', head: true });

  const { data: unifiedCount } = await supabase
    .from('unified_picks')
    .select('id', { count: 'exact', head: true });

  console.log('Total in picks table: checking...');
  console.log('Total in unified_picks table: checking...');
}

main().catch(console.error);
