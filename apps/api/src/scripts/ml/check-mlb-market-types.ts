/**
 * Check MLB market types in raw_props
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkMarketTypes() {
  const { data } = await supabase
    .from('raw_props')
    .select('stat_type')
    .eq('sport', 'MLB')
    .limit(1000);

  const uniqueTypes = [...new Set(data?.map(p => p.stat_type))].sort();

  console.log(`MLB market types in raw_props (${uniqueTypes.length} unique):\n`);
  uniqueTypes.forEach(t => console.log('  -', t));

  process.exit(0);
}

checkMarketTypes();
