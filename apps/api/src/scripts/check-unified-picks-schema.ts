/**
 * Quick script to check unified_picks schema in Supabase
 */

import { supabase } from '../lib/db/supabaseClient';

(async () => {
  console.log('Fetching unified_picks schema...');

  // Try to query one row to see what columns come back
  const { data, error } = await supabase
    .from('unified_picks')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  if (data && data.length > 0) {
    console.log('Columns in unified_picks:');
    console.log(Object.keys(data[0]).join(', '));
  } else {
    console.log('No rows in table - trying insert to get schema error...');
    const { error: insertError } = await supabase
      .from('unified_picks')
      .insert({ test: 'value' });
    console.log('Insert error (shows schema):', insertError);
  }
})();
