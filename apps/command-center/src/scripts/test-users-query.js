// Test script to query users table and see real capper data
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o';

async function testUsersQuery() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Testing users table query...');

  try {
    // Query users table structure and data
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(10);

    if (usersError) {
      console.log('❌ Users query error:', usersError);
      return;
    }

    console.log(`✅ Found ${usersData.length} users in the database`);

    if (usersData.length > 0) {
      console.log('\n📊 Sample user data:');
      console.log('Columns:', Object.keys(usersData[0]));

      usersData.forEach((user, index) => {
        console.log(`\nUser ${index + 1}:`);
        console.log(`  ID: ${user.id}`);
        console.log(`  Username: ${user.username || 'N/A'}`);
        console.log(`  Discord ID: ${user.discord_id || 'N/A'}`);
        console.log(`  Tier: ${user.tier || 'N/A'}`);
        console.log(`  Status: ${user.status || 'N/A'}`);
        console.log(`  Total Picks: ${user.total_picks || 0}`);
        console.log(`  Win Rate: ${user.win_rate || 'N/A'}%`);
      });
    }

    // Also check for any other user-related tables
    console.log('\n🔍 Checking for other user tables...');

    const { data: cappers, error: cappersError } = await supabase
      .from('cappers')
      .select('*')
      .limit(5);

    if (!cappersError && cappers) {
      console.log(`✅ Found cappers table with ${cappers.length} records`);
      if (cappers.length > 0) {
        console.log('Cappers columns:', Object.keys(cappers[0]));
        cappers.forEach(capper => {
          console.log(`  Capper: ${capper.name || capper.username || capper.id}`);
        });
      }
    } else {
      console.log('ℹ️  No cappers table found');
    }

    // Check for user_profiles table
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(5);

    if (!profilesError && profiles) {
      console.log(`✅ Found user_profiles table with ${profiles.length} records`);
      if (profiles.length > 0) {
        console.log('Profiles columns:', Object.keys(profiles[0]));
      }
    } else {
      console.log('ℹ️  No user_profiles table found');
    }
  } catch (err) {
    console.log('❌ Database connection failed:', err.message);
  }
}

// Run the test
testUsersQuery();
