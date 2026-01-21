require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('Checking unified_picks schema...');

  const { data, error } = await supabase
    .from('unified_picks')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  if (data && data[0]) {
    console.log('Columns:', Object.keys(data[0]).join(', '));
    console.log('Sample row:', JSON.stringify(data[0], null, 2));
  } else {
    console.log('Table empty - checking information_schema...');
    // Try RPC call
    const { data: cols, error: colErr } = await supabase.rpc('get_columns', { table_name: 'unified_picks' });
    if (colErr) {
      console.log('RPC error:', colErr.message);
      // Fallback - insert empty to see error
      const { error: insertErr } = await supabase.from('unified_picks').insert({});
      console.log('Insert error (shows required columns):', insertErr?.message);
    } else {
      console.log('Columns:', cols);
    }
  }
}

main().catch(console.error);
