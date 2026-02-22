// Test script to map user_id to real capper names
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cqfnsozknjzvyiziwicl.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o';

async function testUserMapping() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Finding real capper for user_id from unified_picks...');

  try {
    // Get the user_id from unified_picks
    const { data: picksData } = await supabase.from('unified_picks').select('user_id').limit(1);

    if (picksData && picksData.length > 0) {
      const userId = picksData[0].user_id;
      console.log(`🎯 User ID from picks: ${userId}`);

      // Find this user in the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (!userError && userData) {
        console.log(`✅ Found matching user:`);
        console.log(`  Username: ${userData.username}`);
        console.log(`  Discord ID: ${userData.discord_id}`);
        console.log(`  Is Capper: ${userData.is_capper}`);
        console.log(`  Capper Status: ${userData.capper_status}`);
        console.log(`  Capper Tier: ${userData.capper_tier}`);
      } else {
        console.log('❌ User not found in users table:', userError?.message);
      }

      // Also check cappers table
      const { data: cappersData } = await supabase.from('cappers').select('*');

      console.log('\n📊 All available cappers:');
      cappersData?.forEach(capper => {
        console.log(`  - ${capper.name} (Status: ${capper.status}, Role: ${capper.role})`);
      });
    }
  } catch (err) {
    console.log('❌ Database connection failed:', err.message);
  }
}

// Run the test
testUserMapping();
