import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getSchemaColumns() {
  console.log('Fetching unified_picks schema...\n');
  const { data: up } = await supabase.from('unified_picks').select('*').limit(1);
  if (up && up[0]) {
    console.log('unified_picks columns:', Object.keys(up[0]).sort());
  }

  console.log('\nFetching scored_props schema...\n');
  const { data: sp } = await supabase.from('scored_props').select('*').limit(1);
  if (sp && sp[0]) {
    console.log('scored_props columns:', Object.keys(sp[0]).sort());
  }

  console.log('\nFetching raw_props sample...\n');
  const { data: rp } = await supabase.from('raw_props').select('*').limit(1);
  if (rp && rp[0]) {
    console.log('raw_props columns:', Object.keys(rp[0]).sort());
  }
}

getSchemaColumns().catch(console.error);
