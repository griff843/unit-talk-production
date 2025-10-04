/**
 * Check settled_outcomes table schema
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkSchema() {
  console.log('🔍 Checking settled_outcomes schema...\n');

  // Query information_schema to get column details
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'settled_outcomes'
      ORDER BY ordinal_position;
    `
  });

  if (error) {
    console.error('Error querying schema:', error);

    // Try alternate method - query a single row to see structure
    console.log('\nTrying alternate method - fetching sample row...\n');

    const { data: sample, error: sampleError } = await supabase
      .from('settled_outcomes')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.error('Sample query error:', sampleError);
    } else {
      console.log('Sample row structure:');
      if (sample && sample.length > 0) {
        console.log('Columns:', Object.keys(sample[0]));
      } else {
        console.log('Table is empty - trying to insert a test row to see required fields');

        const { error: insertError } = await supabase
          .from('settled_outcomes')
          .insert({
            prop_id: 'test_' + Date.now(),
            sport: 'TEST',
            market: 'test_market',
            market_type: 'test_type'
          });

        if (insertError) {
          console.log('\nInsert error reveals required fields:');
          console.log(insertError.message);

          // Parse the error to find which column is missing
          const match = insertError.message.match(/column "([^"]+)"/);
          if (match) {
            console.log(`\n❌ Missing required field: ${match[1]}`);
          }
        }
      }
    }

    process.exit(1);
  }

  console.log('Schema columns:');
  console.table(data);

  // Extract required (NOT NULL) columns
  const requiredCols = data?.filter((col: any) => col.is_nullable === 'NO') || [];
  console.log('\n📋 Required columns (NOT NULL):');
  requiredCols.forEach((col: any) => {
    console.log(`  - ${col.column_name} (${col.data_type})`);
  });

  process.exit(0);
}

checkSchema();
