/* eslint-disable no-console */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || 'https://cqfnsozknjzvyiziwicl.supabase.co';
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxZm5zb3prbmp6dnlpeml3aWNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg5NDQxOSwiZXhwIjoyMDc1NDcwNDE5fQ.0fvfA63iHuhlsPNwsVjtQdzMjNivtPLFQZ4hCRX43LI';

const supabase = createClient(url, key);

async function main() {
  console.log('Checking player_projections table...');

  const { data, error } = await supabase.from('player_projections').select('id').limit(1);

  if (error) {
    if (error.message.includes('does not exist')) {
      console.log('❌ Table does not exist - migration needed');
      console.log('Run the following SQL in Supabase dashboard:');
      console.log('supabase/migrations/20260221200000_create_player_projections.sql');
    } else {
      console.log('Error:', error.message);
    }
  } else {
    console.log('✅ Table exists! Current rows:', data?.length ?? 0);
  }
}

main();
