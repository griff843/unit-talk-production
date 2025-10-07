import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
  console.log('🔍 Inspecting bridge_outbox table schema via direct query...\n');

  // Try to read one row to see what columns exist
  const { data, error } = await supabase
    .from('bridge_outbox')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error querying table:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️ Table is empty, cannot inspect actual data structure');
    console.log('💡 Let me try a different approach - query pg_catalog...\n');

    // Query PostgreSQL information_schema to get column definitions
    const { data: schemaData, error: schemaError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bridge_outbox'
        ORDER BY ordinal_position;
      `
    });

    if (schemaError) {
      console.error('❌ Schema query failed:', schemaError);
      console.log('\n💡 Trying minimal insert to discover schema...');

      // Try minimal insert with only required fields
      const minimalEntry = {
        event_type: 'test',
        payload: { test: true },
      };

      const { error: insertError } = await supabase
        .from('bridge_outbox')
        .insert(minimalEntry);

      if (insertError) {
        console.error('❌ Minimal insert failed:', insertError);
        console.log('\nThe bridge_outbox table schema does NOT match the expected structure.');
        console.log('Expected columns: id, event_type, payload, unique_key, status, attempts, max_attempts, created_at, updated_at, processed_at, error_message');
        console.log('Actual schema needs to be discovered via psql or Supabase Dashboard.');
      } else {
        console.log('✅ Minimal insert succeeded! Now let me read it back...');

        const { data: testData, error: testError } = await supabase
          .from('bridge_outbox')
          .select('*')
          .eq('event_type', 'test')
          .order('created_at', { ascending: false })
          .limit(1);

        if (!testError && testData && testData.length > 0) {
          console.log('\n📋 Actual table columns:');
          Object.keys(testData[0]).forEach(col => {
            console.log(`  - ${col}: ${typeof testData[0][col]}`);
          });

          console.log('\n🗑️ Cleaning up test entry...');
          await supabase.from('bridge_outbox').delete().eq('event_type', 'test');
        }
      }
    } else {
      console.log('📋 Table schema from information_schema:');
      console.log(JSON.stringify(schemaData, null, 2));
    }
  } else {
    console.log('📋 Actual columns in bridge_outbox (from existing row):');
    Object.keys(data[0]).forEach(col => {
      console.log(`  - ${col}: ${typeof data[0][col]} = ${JSON.stringify(data[0][col]).substring(0, 50)}`);
    });
  }
}

inspectSchema().catch(console.error);
