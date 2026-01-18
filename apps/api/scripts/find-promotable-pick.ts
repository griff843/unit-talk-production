import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findPromotablePick() {
  // Find approved picks
  const { data: picks, error: picksError } = await supabase
    .from('picks')
    .select('id, tenant_id, status, metadata, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(10);

  if (picksError) {
    console.error('Error fetching picks:', picksError);
    process.exit(1);
  }

  console.log('\n=== APPROVED PICKS (Latest 10) ===');
  console.log(JSON.stringify(picks, null, 2));

  // Check which ones already have CANARY publish records
  for (const pick of picks || []) {
    const { data: publishRecords, error: publishError } = await supabase
      .from('pick_publish')
      .select('id, channel, status, discord_channel_id')
      .eq('pick_id', pick.id);

    console.log(`\nPick ${pick.id}:`);
    console.log(`  Player: ${pick.metadata?.player_name || 'N/A'}`);
    console.log(`  League: ${pick.metadata?.league || 'N/A'}`);
    console.log(`  Stat Type: ${pick.metadata?.stat_type || 'N/A'}`);
    console.log(`  Existing publish records:`, publishRecords || 'none');

    const hasCanary = publishRecords?.some(r => r.channel === 'CANARY');
    console.log(`  Has CANARY record: ${hasCanary ? 'YES (skip)' : 'NO (promotable)'}`);

    if (!hasCanary) {
      console.log(`\n✅ PROMOTABLE PICK FOUND: ${pick.id}`);
      console.log(JSON.stringify(pick, null, 2));
      process.exit(0);
    }
  }

  console.log('\n❌ No promotable picks found. All have existing CANARY records.');
  process.exit(1);
}

findPromotablePick();
