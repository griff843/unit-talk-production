/**
 * Find all views that depend on scored_props table
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('🔍 Checking for v_command_center_board view...\n');

  // Try to query the view to see if it exists
  const { data: viewData, error: viewError } = await supabase
    .from('v_command_center_board')
    .select('*')
    .limit(1);

  if (viewError) {
    if (viewError.code === '42P01') {
      console.log('✅ v_command_center_board does NOT exist');
      console.log('   (This is unexpected - migration error mentioned it)');
    } else {
      console.log('⚠️  Error checking v_command_center_board:', viewError.message);
    }
  } else {
    console.log('✅ v_command_center_board EXISTS');
    console.log(`   Found ${viewData?.length || 0} sample rows`);
  }

  console.log('');
  console.log('Views to drop in migration:');
  console.log('═══════════════════════════════════════════════');
  console.log('  1. v_daily_board');
  console.log('  2. v_prop_read_model');
  console.log('  3. v_open_promotions');
  console.log('  4. v_command_center_board (if exists)');
  console.log('');
  console.log('Strategy: Add v_command_center_board to DROP statements');
  console.log('');
  process.exit(0);
}

main();
