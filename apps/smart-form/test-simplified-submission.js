const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const supabaseUrl = 'https://cqfnsozknjzvyiziwicl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSimplifiedSubmission() {
  console.log('🧪 Testing Simplified Unified Picks Submission...');
  
  try {
    // Get a user ID from the users table
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .limit(1);
      
    const userId = users?.[0]?.id || uuidv4();
    
    console.log('👤 Using user ID:', userId);
    
    // Try a minimal submission that should work
    const minimalSubmission = {
      id: uuidv4(),
      user_id: userId,
      sport: 'NCAAF',
      status: 'submitted',
      created_at: new Date().toISOString()
    };
    
    console.log('📤 Attempting minimal submission...');
    const { data, error } = await supabase
      .from('unified_picks')
      .insert([minimalSubmission])
      .select()
      .single();
    
    if (error) {
      console.log('❌ Minimal submission failed:', error.message);
      console.log('🔍 Error details:', error.details || 'None');
      console.log('💡 Error hint:', error.hint || 'None');
      
      // Try to understand what columns exist by checking schema
      console.log('\n🔍 Let me check what endpoints are available...');
      
      // Check if the table endpoint exists in Supabase OpenAPI
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey
          }
        });
        const schema = await response.json();
        
        // Look for unified_picks in paths
        const unifiedPicksPath = schema.paths?.['/unified_picks'];
        if (unifiedPicksPath) {
          console.log('✅ unified_picks endpoint exists');
          const getParams = unifiedPicksPath.get?.parameters || [];
          const columns = getParams
            .filter(p => p.$ref && p.$ref.includes('rowFilter.unified_picks.'))
            .map(p => p.$ref.split('.').pop());
          console.log('📋 Available columns:', columns.slice(0, 20)); // Show first 20
        } else {
          console.log('❌ unified_picks endpoint not found in schema');
        }
      } catch (schemaError) {
        console.log('⚠️ Could not fetch schema:', schemaError.message);
      }
      
    } else {
      console.log('✅ Success! Minimal submission worked');
      console.log('📋 Returned record:', Object.keys(data));
      console.log('🆔 Record ID:', data.id);
      
      // Clean up
      await supabase.from('unified_picks').delete().eq('id', data.id);
      console.log('🧹 Test record cleaned up');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testSimplifiedSubmission();