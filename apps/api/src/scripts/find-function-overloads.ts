import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findFunctionOverloads() {
  const { data, error } = await supabase.rpc('pg_catalog.pg_get_function_arguments', {});
  
  // Query to find all submit_pick function signatures
  const query = `
    SELECT 
      p.proname as function_name,
      pg_catalog.pg_get_function_arguments(p.oid) as arguments,
      pg_catalog.pg_get_function_result(p.oid) as return_type,
      p.oid
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('submit_pick', 'approve_pick', 'deny_pick')
    ORDER BY p.proname, p.oid;
  `;

  const result = await supabase.rpc('exec_sql', { sql: query });
  
  if (result.error) {
    console.error('Error:', result.error);
    // Fallback: use direct SQL
    console.log('\nTrying direct query...\n');
    
    const { data: pgData } = await supabase
      .from('pg_proc')
      .select('*')
      .eq('proname', 'submit_pick');
    
    console.log('Direct pg_proc query:', JSON.stringify(pgData, null, 2));
  } else {
    console.log('Function Overloads Found:');
    console.log(JSON.stringify(result.data, null, 2));
  }
}

findFunctionOverloads().catch(console.error);
