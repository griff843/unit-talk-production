import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraints() {
  console.log('🔍 Checking unified_picks constraints...\n');

  // Query PostgreSQL system catalogs for constraints
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        con.conname AS constraint_name,
        con.contype AS constraint_type,
        pg_get_constraintdef(con.oid) AS constraint_definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE rel.relname = 'unified_picks'
        AND nsp.nspname = 'public'
        AND con.contype IN ('u', 'p')
      ORDER BY con.conname;
    `
  });

  if (error) {
    console.error('❌ Error:', error);

    // Fallback: Try getting info from information_schema
    console.log('\nTrying alternative method...\n');

    const { data: altData, error: altError } = await supabase
      .from('information_schema.table_constraints')
      .select('*')
      .eq('table_name', 'unified_picks')
      .in('constraint_type', ['UNIQUE', 'PRIMARY KEY']);

    if (altError) {
      console.error('❌ Alternative method error:', altError);
    } else {
      console.log('📋 Constraints:', JSON.stringify(altData, null, 2));
    }
    return;
  }

  console.log('📋 Current Constraints:');
  console.log(JSON.stringify(data, null, 2));
}

checkConstraints().catch(console.error);
