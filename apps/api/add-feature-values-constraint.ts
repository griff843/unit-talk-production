import { supabaseClient } from './src/services/supabaseClient';

async function addConstraint() {
  if (!supabaseClient) {
    console.log('Supabase client not initialized');
    process.exit(1);
  }

  console.log('Adding unique constraint to feature_values table...');

  // Use raw SQL to add the constraint
  const { data, error } = await supabaseClient.rpc('exec_sql', {
    sql_query: `
      ALTER TABLE public.feature_values
      ADD CONSTRAINT feature_values_unique_constraint
      UNIQUE (entity_type, entity_id, feature_name, as_of);
    `
  });

  if (error) {
    // Try alternative approach using direct SQL execution
    console.log('RPC method failed, trying direct execution...');
    
    // Create constraint using INSERT into a temp approach
    const { error: execError } = await supabaseClient.rpc('exec_raw_sql', {
      query: `ALTER TABLE public.feature_values ADD CONSTRAINT feature_values_unique_constraint UNIQUE (entity_type, entity_id, feature_name, as_of);`
    });

    if (execError) {
      console.error('Failed to add constraint:', execError);
      console.log('\n⚠️  Manual SQL required. Run this in Supabase SQL editor:');
      console.log(`
ALTER TABLE public.feature_values
ADD CONSTRAINT feature_values_unique_constraint
UNIQUE (entity_type, entity_id, feature_name, as_of);
      `);
      process.exit(1);
    }
  }

  console.log('✅ Constraint added successfully');
}

addConstraint().then(() => process.exit(0)).catch(console.error);
