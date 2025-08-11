// Test script to query unified_picks table and see what data is available
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o';

async function testUnifiedPicksQuery() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Testing unified_picks table query...');

  try {
    // Query unified_picks table structure and data
    const { data: picksData, error: picksError } = await supabase
      .from('unified_picks')
      .select('*')
      .limit(5);

    if (picksError) {
      console.log('❌ Unified picks query error:', picksError);
      return;
    }

    console.log(`✅ Found ${picksData.length} picks in unified_picks`);

    if (picksData.length > 0) {
      console.log('\n📊 Sample pick data:');
      console.log('Columns:', Object.keys(picksData[0]));

      picksData.forEach((pick, index) => {
        console.log(`\nPick ${index + 1}:`);
        console.log(`  ID: ${pick.id}`);
        console.log(`  User ID: ${pick.user_id}`);
        console.log(`  Prop ID: ${pick.prop_id}`);
        console.log(`  Selection: ${pick.selection}`);
        console.log(`  Confidence: ${pick.confidence}`);
        console.log(`  Status: ${pick.status}`);
        console.log(`  Workflow Stage: ${pick.workflow_stage}`);
        console.log(`  Created By: ${pick.created_by}`);
      });
    } else {
      console.log('ℹ️  No data in unified_picks table');
    }

    // Check total count
    const { count, error: countError } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`\n📊 Total unified_picks records: ${count}`);
    }
  } catch (err) {
    console.log('❌ Database connection failed:', err.message);
  }
}

// Run the test
testUnifiedPicksQuery();
