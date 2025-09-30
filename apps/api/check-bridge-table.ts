import { createClient } from '@supabase/supabase-js';

async function checkBridgeOutboxTable() {
  console.log('Checking if bridge_outbox table exists...');

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ Missing Supabase credentials');
      console.log('SUPABASE_URL:', supabaseUrl ? 'present' : 'missing');
      console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'present' : 'missing');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to query the table structure
    const { data, error } = await supabase
      .from('bridge_outbox')
      .select('*')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        console.log('❌ bridge_outbox table does NOT exist');
        console.log('Error code:', error.code);
        console.log('Error message:', error.message);
      } else {
        console.log('⚠️  bridge_outbox table check failed:', error.code, error.message);
      }
      return false;
    } else {
      console.log('✅ bridge_outbox table EXISTS');
      console.log('Sample data structure:', data);
      return true;
    }
  } catch (err) {
    console.error('Error checking bridge_outbox table:', err);
    return false;
  }
}

checkBridgeOutboxTable().then(() => process.exit(0));