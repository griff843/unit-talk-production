import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('Checking pick_publish table...');

  // Get existing entries
  const { data, error } = await supabase
    .from('pick_publish')
    .select('*')
    .limit(5);

  if (error) {
    console.log('Error:', error.message);
  }

  if (data && data.length > 0) {
    console.log('Existing entries:');
    data.forEach((p: any) => {
      console.log(`  channel: ${p.channel}, status: ${p.status}`);
    });
    console.log('Sample columns:', Object.keys(data[0]).join(', '));
  } else {
    console.log('No existing entries');
  }

  // Check valid channel values by inserting with valid pick_id
  console.log('\nTesting channel values with a real pick_id...');

  // First get a real pick_id
  const { data: picks } = await supabase.from('unified_picks').select('id').limit(1);
  if (!picks || picks.length === 0) {
    console.log('No picks found to test with');
    return;
  }

  const pickId = picks[0].id;
  console.log('Using pick_id:', pickId);

  const channels = ['discord', 'DISCORD', 'Discord', 'twitter', 'slack', 'email', 'TWITTER', 'SLACK', 'EMAIL'];

  for (const channel of channels) {
    const { error: insertError } = await supabase
      .from('pick_publish')
      .insert({
        pick_id: pickId,
        tenant_id: '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a',
        channel: channel,
        status: 'test',
        attempts: 0,
        max_attempts: 1,
        dedupe_key: 'test_' + channel + '_' + Date.now(),
      });

    if (!insertError) {
      console.log(`✅ channel="${channel}" - VALID`);
      // Delete test entry
      await supabase.from('pick_publish').delete().eq('dedupe_key', 'test_' + channel + '_' + Date.now());
    } else if (insertError.message.includes('channel')) {
      console.log(`❌ channel="${channel}" - INVALID (channel constraint)`);
    } else {
      console.log(`? channel="${channel}" - Other error: ${insertError.message}`);
    }
  }
}

main().catch(console.error);
