import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  // Known pick_ids from pick_publish
  const pickIds = [
    '22567e52-80d3-4cb2-9e3b-c70a4691f8b7',
    '4584747f-5780-4ac9-bed7-17a9caf33356',
  ];

  // Tables to check
  const tables = [
    'unified_picks',
    'daily_picks',
    'final_picks',
    'approved_picks',
    'published_picks',
    'picks',
    'pick_queue',
    'pick_history',
    'smart_form_picks',
    'capper_picks',
  ];

  console.log('=== Searching for pick_ids across tables ===\n');

  for (const table of tables) {
    console.log(`Checking ${table}...`);
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .in('id', pickIds);

    if (error) {
      if (error.message.includes('does not exist') || error.message.includes('Could not find')) {
        console.log(`  ❌ Table doesn't exist`);
      } else {
        console.log(`  ❌ Error: ${error.message}`);
      }
    } else if (data && data.length > 0) {
      console.log(`  ✅ FOUND ${data.length} matching IDs!`);
      console.log(`     IDs: ${data.map(d => d.id).join(', ')}`);
    } else {
      console.log(`  ⚪ Table exists but no matching IDs`);
    }
  }

  // Also check if maybe pick_publish doesn't have FK at all,
  // and the IDs are from a view or computed
  console.log('\n=== Checking pick_publish table structure ===');
  const { data: sample } = await supabase
    .from('pick_publish')
    .select('*')
    .limit(1)
    .single();

  if (sample) {
    console.log('pick_publish columns:', Object.keys(sample).join(', '));
  }

  // Check if the FK error might be due to RLS or timing
  console.log('\n=== Testing direct insert without FK validation ===');

  // Try inserting with an existing pick_publish pick_id (already validated)
  const existingPickId = '22567e52-80d3-4cb2-9e3b-c70a4691f8b7';
  const { error: insertError } = await supabase
    .from('pick_publish')
    .insert({
      pick_id: existingPickId,
      tenant_id: '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a',
      channel: 'CANARY',
      status: 'pending',
      attempts: 0,
      max_attempts: 1,
      dedupe_key: 'test_existing_' + Date.now(),
    });

  if (!insertError) {
    console.log('✅ Existing pick_id works - FK might reference archived/deleted picks');
    await supabase.from('pick_publish').delete().match({ pick_id: existingPickId, channel: 'CANARY' });
  } else {
    console.log('❌ Error:', insertError.message);
  }
}

main().catch(console.error);
