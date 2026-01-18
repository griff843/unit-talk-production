// Test Supabase Connection
import { createClient } from '@supabase/supabase-js';

async function main() {
  console.log('=== SUPABASE CONNECTION TEST ===\n');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log(`SUPABASE_URL: ${url?.slice(0, 30)}...`);
  console.log(`SERVICE_ROLE_KEY: ${key ? 'Present' : 'Missing'}\n`);

  if (!url || !key) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  try {
    console.log('[1/3] Creating Supabase client...');
    const supabase = createClient(url, key, {
      auth: { persistSession: false }
    });
    console.log('✅ Client created\n');

    console.log('[2/3] Testing simple query (count raw_props)...');
    const { count, error } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Query failed:', error.message);
      console.error('Details:', JSON.stringify(error, null, 2));
      process.exit(1);
    }

    console.log(`✅ Query successful: ${count} rows in raw_props\n`);

    console.log('[3/3] Testing insert capability...');
    const testProp = {
      sport: 'NBA',
      player_name: 'Connection Test',
      stat_type: 'points',
      line: 25.5,
      over_odds: -110,
      under_odds: -110,
      game_id: 'test-connection',
      game_date: new Date().toISOString(),
      source: 'connection-test'
    };

    const { error: insertError } = await supabase
      .from('raw_props')
      .insert([testProp])
      .select();

    if (insertError) {
      console.error('❌ Insert test failed:', insertError.message);
      console.error('Details:', JSON.stringify(insertError, null, 2));
      process.exit(1);
    }

    console.log('✅ Insert test successful\n');

    console.log('=== CONNECTION TEST PASSED ===');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ CONNECTION TEST FAILED:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

main();
