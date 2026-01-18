import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from workspace root
const envPath = path.resolve(__dirname, '../../../.env');
console.log(`Loading .env from: ${envPath}\n`);
dotenv.config({ path: envPath });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findApprovedPickForCanary() {
  console.log('=== SEARCHING FOR APPROVED PICK WITHOUT CANARY RECORD ===\n');

  // Find picks with workflow_stage = 'approved'
  const { data: picks, error: picksError } = await supabase
    .from('picks')
    .select('id, tenant_id, user_id, workflow_stage, status, metadata, created_at')
    .eq('workflow_stage', 'approved')
    .order('created_at', { ascending: false })
    .limit(50);

  if (picksError) {
    console.error('Error fetching approved picks:', picksError);
    process.exit(1);
  }

  console.log(`Found ${picks?.length || 0} picks with workflow_stage='approved'\n`);

  if (!picks || picks.length === 0) {
    console.log('❌ NO APPROVED PICKS FOUND');
    console.log('\nChecking what workflow_stages exist...\n');

    const { data: allPicks } = await supabase
      .from('picks')
      .select('workflow_stage')
      .limit(100);

    const stages = new Set(allPicks?.map(p => p.workflow_stage) || []);
    console.log('Available workflow_stages:', Array.from(stages));
    process.exit(1);
  }

  // Check each approved pick for CANARY publish record
  for (const pick of picks) {
    const { data: publishRecords, error: publishError } = await supabase
      .from('pick_publish')
      .select('id, channel, status, discord_channel_id')
      .eq('pick_id', pick.id)
      .eq('channel', 'CANARY');

    const hasCanary = publishRecords && publishRecords.length > 0;

    if (!hasCanary) {
      console.log('✅ FOUND PROMOTABLE APPROVED PICK:');
      console.log(`  Pick ID: ${pick.id}`);
      console.log(`  Tenant ID: ${pick.tenant_id}`);
      console.log(`  User ID: ${pick.user_id}`);
      console.log(`  Workflow Stage: ${pick.workflow_stage}`);
      console.log(`  Status: ${pick.status}`);
      console.log(`  Player: ${pick.metadata?.player_name || 'N/A'}`);
      console.log(`  League: ${pick.metadata?.league || 'N/A'}`);
      console.log(`  Created: ${pick.created_at}`);
      console.log(`  Has CANARY record: NO ✅`);
      process.exit(0);
    } else {
      console.log(`Skip ${pick.id}: Has CANARY record`);
    }
  }

  console.log('\n❌ All approved picks already have CANARY records');
  process.exit(1);
}

findApprovedPickForCanary();
