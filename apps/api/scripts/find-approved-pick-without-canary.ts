import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findApprovedPickWithoutCanary() {
  console.log('=== SEARCHING FOR APPROVED PICK WITHOUT CANARY RECORD ===\n');

  // Get all approved picks
  const { data: approvedPicks, error: picksError } = await supabase
    .from('picks')
    .select('id, workflow_stage, metadata, created_at')
    .eq('workflow_stage', 'approved')
    .order('created_at', { ascending: false })
    .limit(50);

  if (picksError) {
    console.error('ERROR fetching picks:', picksError);
    process.exit(1);
  }

  console.log(`Found ${approvedPicks.length} approved picks\n`);

  // For each pick, check if it has a CANARY publish record
  for (const pick of approvedPicks) {
    const { data: canaryRecords, error: publishError } = await supabase
      .from('pick_publish')
      .select('id, channel, status')
      .eq('pick_id', pick.id)
      .eq('channel', 'CANARY');

    if (publishError) {
      console.error(`ERROR checking pick ${pick.id}:`, publishError);
      continue;
    }

    if (!canaryRecords || canaryRecords.length === 0) {
      console.log('✅ FOUND APPROVED PICK WITHOUT CANARY RECORD!');
      console.log(`  Pick ID: ${pick.id}`);
      console.log(`  Workflow Stage: ${pick.workflow_stage}`);
      console.log(`  Created At: ${pick.created_at}`);
      console.log(`  Metadata: ${JSON.stringify(pick.metadata, null, 2)}`);
      process.exit(0);
    }
  }

  console.log('❌ NO APPROVED PICKS WITHOUT CANARY RECORD FOUND');
  console.log('All approved picks already have CANARY records');
  process.exit(1);
}

findApprovedPickWithoutCanary();
