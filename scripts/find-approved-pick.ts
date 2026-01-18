import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function findApprovedPick() {
  console.log('=== Finding Approved Pick for Testing ===\n');

  // Find an approved pick that hasn't been promoted yet
  const { data: picks, error } = await supabase
    .from('picks')
    .select('id, workflow_stage, selection, created_at')
    .eq('workflow_stage', 'approved')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }

  if (!picks || picks.length === 0) {
    console.log('No approved picks found. Let me check all picks...');

    const { data: allPicks, error: allError } = await supabase
      .from('picks')
      .select('id, workflow_stage, selection, created_at')
      .order('created_at', { ascending: false})
      .limit(10);

    if (allError) {
      console.error('ERROR:', allError);
      process.exit(1);
    }

    console.log('All picks:');
    console.log(JSON.stringify(allPicks, null, 2));
    process.exit(0);
  }

  console.log(`Found ${picks.length} approved picks:`);
  console.log(JSON.stringify(picks, null, 2));
  console.log('');

  // Check which ones have pick_publish records
  for (const pick of picks) {
    const { data: publishRecords } = await supabase
      .from('pick_publish')
      .select('id, status')
      .eq('pick_id', pick.id);

    if (!publishRecords || publishRecords.length === 0) {
      console.log(`✅ Pick ${pick.id} has NO pick_publish records - can use for testing`);
      return;
    } else {
      console.log(`❌ Pick ${pick.id} already has ${publishRecords.length} pick_publish record(s)`);
    }
  }
}

findApprovedPick().catch(console.error);
