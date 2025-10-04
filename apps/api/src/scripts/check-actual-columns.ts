import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log('🔍 Checking actual unified_picks columns...\n');

  // Direct SQL to get column names
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'unified_picks'
      ORDER BY ordinal_position;
    `
  }) as any;

  if (error) {
    console.error('❌ Error:', error);

    // Try alternative: just select from table and inspect
    console.log('\n🔍 Trying to get sample data instead...\n');
    const { data: sample, error: sampleError } = await supabase
      .from('unified_picks')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.error('❌ Sample error:', sampleError);
    } else if (sample && sample.length > 0) {
      console.log('📋 Sample row columns:');
      Object.keys(sample[0]).forEach(key => {
        console.log(`  - ${key}: ${typeof sample[0][key]}`);
      });
    } else {
      console.log('⚠️  No data in table');
    }
    return;
  }

  console.log('📋 All Columns:\n');
  data?.forEach((col: any) => {
    console.log(`  ${col.column_name}`);
    console.log(`    Type: ${col.data_type}`);
    console.log(`    Nullable: ${col.is_nullable}`);
    console.log('');
  });
}

checkColumns().catch(console.error);
