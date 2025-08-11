const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUnifiedPicksSchema() {
  console.log('🔍 Checking unified_picks table schema...');
  
  try {
    // Try to insert a test record to see what columns are available
    const testRecord = {
      id: 'schema-test-id',
      user_id: 'test-user',
      sport: 'TEST',
      status: 'test'
    };
    
    const { data, error } = await supabase
      .from('unified_picks')
      .insert([testRecord])
      .select()
      .single();
      
    if (error) {
      console.log('❌ Insert failed (expected):', error.message);
      console.log('🔍 Error details:', error.details || 'No details available');
      console.log('📋 Error hint:', error.hint || 'No hint available');
      
      // Let's try with a minimal record to understand the required schema
      console.log('\n🔬 Trying minimal insert to understand schema...');
      const minimalRecord = {
        user_id: 'test-user',
        sport: 'TEST'
      };
      
      const { data: data2, error: error2 } = await supabase
        .from('unified_picks')
        .insert([minimalRecord])
        .select()
        .single();
        
      if (error2) {
        console.log('❌ Minimal insert also failed:', error2.message);
        console.log('🔍 Details:', error2.details || 'No details');
        
        // Let's query the existing structure
        console.log('\n📊 Querying existing records to understand structure...');
        const { data: existing, error: queryError } = await supabase
          .from('unified_picks')
          .select('*')
          .limit(1);
          
        if (queryError) {
          console.log('❌ Query failed:', queryError.message);
        } else {
          console.log('✅ Table exists and is queryable');
          console.log('📋 Sample record structure:', existing?.[0] ? Object.keys(existing[0]) : 'No records found');
        }
      } else {
        console.log('✅ Minimal insert succeeded!');
        console.log('📋 Record structure:', Object.keys(data2));
        
        // Clean up test record
        await supabase.from('unified_picks').delete().eq('id', data2.id);
      }
    } else {
      console.log('✅ Test insert succeeded!');
      console.log('📋 Record structure:', Object.keys(data));
      
      // Clean up test record
      await supabase.from('unified_picks').delete().eq('id', data.id);
    }
    
  } catch (error) {
    console.error('❌ Schema check failed:', error);
  }
}

checkUnifiedPicksSchema();