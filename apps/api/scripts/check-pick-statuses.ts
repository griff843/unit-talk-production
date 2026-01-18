import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkStatuses() {
  const { data, error } = await supabase
    .from('picks')
    .select('id, status, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('Recent picks (any status):');
  data?.forEach(pick => {
    console.log(`\nID: ${pick.id}`);
    console.log(`  Status: ${pick.status}`);
    console.log(`  Player: ${pick.metadata?.player_name || 'N/A'}`);
    console.log(`  League: ${pick.metadata?.league || 'N/A'}`);
    console.log(`  Created: ${pick.created_at}`);
  });

  // Count by status
  const { data: statusCounts } = await supabase
    .from('picks')
    .select('status')
    .limit(1000);

  const counts: Record<string, number> = {};
  statusCounts?.forEach(p => {
    counts[p.status] = (counts[p.status] || 0) + 1;
  });

  console.log('\n=== Status Counts ===');
  console.log(JSON.stringify(counts, null, 2));
}

checkStatuses();
