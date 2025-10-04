#!/usr/bin/env tsx
/**
 * Check actual unified_picks table schema
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkSchema() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Check both tables
  const tables = ['unified_picks', 'raw_props'];

  for (const table of tables) {
    console.log(`\n=== ${table} ===`);

    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact' })
      .limit(1);

    if (error) {
      console.error(`Error querying ${table}:`, error.message);
      continue;
    }

    console.log(`Row count: ${count}`);

    if (!data || data.length === 0) {
      console.log(`No data in ${table} table`);
      continue;
    }

    console.log('Columns:');
    console.log(JSON.stringify(Object.keys(data[0]).sort(), null, 2));
  }
}

checkSchema();
