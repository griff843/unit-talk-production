import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const admin = createClient(url, key);
  const { data, error } = await admin.from('user_threads').select('*').order('discord_id');
  if (error) {
    console.error('Error querying user_threads:', error.message);
    process.exit(1);
  }
  console.log('user_threads rows:', data?.length || 0);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
