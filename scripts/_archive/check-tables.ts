import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://csbiuvcpbhttcenmqcqx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTables() {
  console.log('Checking database tables...\n');

  const tables = ['users', 'unified_picks', 'pick_publish', 'picks', 'smart_tickets', 'agent_health'];

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: EXISTS (${data?.length || 0} rows sampled)`);
      }
    } catch (e) {
      console.log(`❌ ${table}: ERROR - ${e}`);
    }
  }
}

checkTables();
