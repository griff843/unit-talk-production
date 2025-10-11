import { supabaseClient } from './src/services/supabaseClient';

async function getSchema() {
  if (!supabaseClient) {
    console.log('Supabase client not initialized');
    process.exit(1);
  }

  // Query information_schema for column details
  const { data, error } = await supabaseClient
    .rpc('exec_sql', { sql: `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'feature_values'
      ORDER BY ordinal_position;
    ` });

  if (error) {
    // Try alternative: just describe what we know from the error
    console.log('Schema query failed, showing what we know from errors:');
    console.log('Required columns (NOT NULL):');
    console.log('- sport (data type unknown)');
    console.log('- entity_type');
    console.log('- entity_id');
    console.log('- feature_name');
    console.log('- as_of');
    console.log('\nColumn order from error message:');
    console.log('(id, entity_type, entity_id, ?, feature_name, ?, value, ?, as_of, ?, ?, created_at, updated_at)');
  } else {
    console.log('Schema:', data);
  }
}

getSchema().then(() => process.exit(0)).catch(console.error);
