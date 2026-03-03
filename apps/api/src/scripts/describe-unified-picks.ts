import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const admin = createClient(url, key);
  const { data, error } = await admin
    .from('information_schema.columns' as any)
    .select('column_name, data_type')
    .eq('table_schema', 'public' as any)
    .eq('table_name', 'unified_picks' as any)
    .order('ordinal_position' as any);
  if (error) {
    console.error('Error describing unified_picks:', error.message);
    process.exit(1);
  }
  console.log('Columns in unified_picks:', data?.length || 0);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
