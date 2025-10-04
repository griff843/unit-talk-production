import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function getTableSchema() {
  console.log('🔍 Getting unified_picks table schema...\n');

  // Get column information
  const { data: columns, error } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable, column_default')
    .eq('table_schema', 'public')
    .eq('table_name', 'unified_picks')
    .order('ordinal_position');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('📋 Columns:\n');
  columns?.forEach(col => {
    console.log(`  ${col.column_name}`);
    console.log(`    Type: ${col.data_type}`);
    console.log(`    Nullable: ${col.is_nullable}`);
    if (col.column_default) {
      console.log(`    Default: ${col.column_default}`);
    }
    console.log('');
  });

  // Get a sample row to see actual data structure
  const { data: sample } = await supabase
    .from('unified_picks')
    .select('*')
    .limit(1);

  if (sample && sample.length > 0) {
    console.log('\n📋 Sample row structure:');
    console.log(JSON.stringify(sample[0], null, 2));
  } else {
    console.log('\n⚠️  No rows in table to sample');
  }
}

getTableSchema().catch(console.error);
