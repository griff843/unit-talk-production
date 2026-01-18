import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findPickWithoutCanary() {
  // Get recent picks
  const { data: picks, error: picksError } = await supabase
    .from('picks')
    .select('id, tenant_id, status, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (picksError || !picks) {
    console.error('Error fetching picks:', picksError);
    process.exit(1);
  }

  console.log(`Checking ${picks.length} recent picks...`);

  for (const pick of picks) {
    // Check for existing CANARY publish record
    const { data: publishRecords, error: publishError } = await supabase
      .from('pick_publish')
      .select('id, channel, status, discord_channel_id')
      .eq('pick_id', pick.id)
      .eq('channel', 'CANARY');

    const hasCanary = publishRecords && publishRecords.length > 0;

    if (!hasCanary) {
      console.log(`\n✅ FOUND: Pick ${pick.id} has NO CANARY record`);
      console.log(`  Status: ${pick.status}`);
      console.log(`  Tenant: ${pick.tenant_id}`);
      console.log(`  Player: ${pick.metadata?.player_name || 'N/A'}`);
      console.log(`  League: ${pick.metadata?.league || 'N/A'}`);
      console.log(`  Created: ${pick.created_at}`);
      process.exit(0);
    } else {
      console.log(`Skip ${pick.id}: Has CANARY record`);
    }
  }

  console.log('\n❌ All picks have CANARY records');
  process.exit(1);
}

findPickWithoutCanary();
