const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testDatabaseConnection() {
  console.log('🔍 Testing Unit Talk Discord Bot Database Connection...\n');

  // Check environment variables
  console.log('📋 Environment Variables Check:');
  console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);
  console.log(
    `SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing'}`
  );
  console.log(`DISCORD_TOKEN: ${process.env.DISCORD_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log('');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables. Please check your .env file.');
    return;
  }

  // Create Supabase client
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('🔗 Testing basic connection...');

  try {
    // Test basic connection with a simpler query
    const { data: healthCheck, error: healthError } = await supabase.rpc('version');

    if (healthError) {
      // Try alternative connection test
      const { data: altTest, error: altError } = await supabase
        .from('pg_tables')
        .select('tablename')
        .limit(1);

      if (altError) {
        console.error('❌ Basic connection failed:', altError.message);
        return;
      }
    }

    console.log('✅ Basic connection successful');
    console.log('');

    // Test specific tables that the bot needs
    console.log('📋 Testing required tables...');

    const requiredTables = [
      'onboarding_config',
      'onboarding_flows',
      'user_profiles',
      'picks',
      'onboarding_progress',
    ];

    let missingTables = [];

    for (const tableName of requiredTables) {
      try {
        const { data, error } = await supabase.from(tableName).select('*').limit(1);

        if (error) {
          if (error.code === '42P01' || error.message.includes('does not exist')) {
            console.log(`❌ Table '${tableName}' does not exist`);
            missingTables.push(tableName);
          } else {
            console.log(`⚠️  Table '${tableName}' exists but query failed: ${error.message}`);
          }
        } else {
          console.log(`✅ Table '${tableName}' exists and accessible`);
        }
      } catch (err) {
        console.log(`❌ Error testing table '${tableName}':`, err.message);
        missingTables.push(tableName);
      }
    }

    console.log('');

    if (missingTables.length > 0) {
      console.log('🚨 MISSING TABLES DETECTED!');
      console.log('The following tables need to be created:');
      missingTables.forEach(table => console.log(`   - ${table}`));
      console.log('');
      console.log('🛠️  SOLUTION:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Copy and run the complete-database-setup.sql file');
      console.log('');
      return;
    }

    console.log('🔍 Testing specific queries that failed in your logs...');

    // Test the specific queries that are failing
    try {
      const { data: flowsData, error: flowsError } = await supabase
        .from('onboarding_flows')
        .select('*')
        .eq('is_active', true);

      if (flowsError) {
        console.log('❌ onboarding_flows query failed:', flowsError.message);
      } else {
        console.log(`✅ onboarding_flows query successful (${flowsData?.length || 0} records)`);
      }
    } catch (err) {
      console.log('❌ onboarding_flows query error:', err.message);
    }

    try {
      const { data: configData, error: configError } = await supabase
        .from('onboarding_config')
        .select('*')
        .eq('is_active', true)
        .single();

      if (configError) {
        if (configError.code === 'PGRST116') {
          console.log(
            '⚠️  onboarding_config query: No records found (this is expected on first run)'
          );
        } else {
          console.log('❌ onboarding_config query failed:', configError.message);
        }
      } else {
        console.log('✅ onboarding_config query successful');
      }
    } catch (err) {
      console.log('❌ onboarding_config query error:', err.message);
    }

    console.log('');
    console.log('📊 Summary:');
    if (missingTables.length === 0) {
      console.log('🎉 All required tables exist! Your bot should work now.');
      console.log('Try running: npm run dev');
    } else {
      console.log('❌ Some tables are missing. Run the database setup SQL script first.');
    }
    console.log('');
  } catch (error) {
    console.error('❌ Connection test failed:', error);

    if (error.message.includes('fetch failed')) {
      console.log('');
      console.log('🔧 Troubleshooting "fetch failed" error:');
      console.log('1. Check your internet connection');
      console.log('2. Verify your Supabase URL is correct');
      console.log('3. Ensure your Supabase project is active (not paused)');
      console.log('4. Check if there are any firewall restrictions');
      console.log('5. Try accessing your Supabase dashboard in a browser');
    }
  }
}

testDatabaseConnection().catch(console.error);
