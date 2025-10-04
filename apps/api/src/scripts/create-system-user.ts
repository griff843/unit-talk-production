/**
 * Create system user in Supabase Cloud
 */

import { supabase } from '../lib/db/supabaseClient';

const SYSTEM_USER_ID = process.env.SYSTEM_USER_ID || '00000000-0000-0000-0000-000000000001';

(async () => {
  console.log(`Creating system user with ID: ${SYSTEM_USER_ID}`);

  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: SYSTEM_USER_ID,
      discord_id: '000000000000000000',  // Fake Discord ID for system user
      username: 'system',
      email: 'system@unittalk.com',
      display_name: 'System',
      tier: 'vip',
      created_at: new Date().toISOString(),
    }, { onConflict: 'id', ignoreDuplicates: true })
    .select();

  if (error) {
    console.error('❌ Error creating system user:', error);
    process.exit(1);
  }

  console.log('✅ System user created/verified:', data);
})();
