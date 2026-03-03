import 'dotenv/config';
import { createSupabaseClient } from './utils/supabase';

const supabase = createSupabaseClient();

async function testOptimalInsertion() {
  console.log('Environment check:');
  console.log('SUPABASE_URL:', process.env['SUPABASE_URL'] ? 'Set' : 'Not set');
  console.log('SUPABASE_KEY:', process.env['SUPABASE_KEY'] ? 'Set' : 'Not set');

  try {
    // Test basic connection
    const { error: connectionError } = await supabase.from('raw_props').select('count').limit(1);

    if (connectionError) {
      console.error('Connection error:', connectionError);
      return;
    }

    console.log('✅ Database connection successful');

    // Test data retrieval
    const { data: testProps, error: retrievalError } = await supabase
      .from('raw_props')
      .select('*')
      .limit(1);

    if (retrievalError) {
      console.error('Data retrieval error:', retrievalError);
      return;
    }

    if (testProps && testProps.length > 0) {
      const testProp = testProps[0];
      if (testProp) {
        console.log('Sample prop ID:', testProp.id);
        console.log('Sample prop player:', testProp.player_name);
        console.log('Sample prop league:', testProp.league);
        console.log('Sample prop sport:', testProp['sport']);
        console.log('Sample prop created:', testProp.created_at);
        console.log('All prop keys:', Object.keys(testProp));
      }
    } else {
      console.log('No test props found in database');
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testOptimalInsertion();
