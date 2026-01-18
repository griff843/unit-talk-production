import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRPCFunction() {
  console.log('=== CHECKING create_pick_with_event RPC FUNCTION ===\n');

  // SQL to check if function exists
  const checkSQL = `
    select proname, oid::regprocedure as signature
    from pg_proc
    join pg_namespace n on n.oid = pg_proc.pronamespace
    where n.nspname='public' and proname='create_pick_with_event';
  `;

  console.log('Running SQL:');
  console.log(checkSQL);
  console.log('');

  const { data, error } = await supabase.rpc('exec_sql', {
    sql_string: checkSQL
  });

  if (error) {
    // Try direct query instead
    console.log('exec_sql RPC not available, using direct query...\n');

    const { data: directData, error: directError } = await supabase
      .from('pg_proc')
      .select('proname')
      .eq('proname', 'create_pick_with_event');

    if (directError) {
      console.error('❌ Cannot query pg_proc:', directError);
      console.log('\n=== MANUAL VERIFICATION REQUIRED ===');
      console.log('Run this SQL in Supabase SQL Editor:\n');
      console.log(checkSQL);
      process.exit(1);
    }
  }

  if (!data || data.length === 0) {
    console.log('❌ FUNCTION NOT FOUND');
    console.log('\nThe create_pick_with_event function does NOT exist in the database.');
    console.log('\n=== ACTION REQUIRED ===');
    console.log('You must apply the migration in Supabase SQL Editor.');
    console.log('See: phase1_rpc_proof.md for exact SQL to run');
    process.exit(1);
  }

  console.log('✅ FUNCTION EXISTS');
  console.log('\nFunction Details:');
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

checkRPCFunction();
