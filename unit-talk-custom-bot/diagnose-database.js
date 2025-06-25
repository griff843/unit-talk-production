const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function diagnoseTables() {
  console.log('🔍 Diagnosing Database Tables and Columns...\n');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing environment variables');
    return;
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  try {
    // Check what tables exist
    console.log('📋 Checking existing tables...');
    
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_table_names');

    if (tablesError) {
      // Alternative method to check tables
      console.log('Using alternative method to check tables...');
      
      const testTables = [
        'user_profiles',
        'onboarding_config', 
        'onboarding_flows',
        'onboarding_progress',
        'picks',
        'user_settings',
        'notifications'
      ];

      for (const tableName of testTables) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(0);

          if (error) {
            if (error.code === '42P01') {
              console.log(`❌ Table '${tableName}' does not exist`);
            } else {
              console.log(`✅ Table '${tableName}' exists`);
              
              // Check columns for this table
              try {
                const { data: columnData, error: columnError } = await supabase
                  .from(tableName)
                  .select('*')
                  .limit(1);
                
                if (columnData && columnData.length === 0) {
                  console.log(`   📝 Table '${tableName}' is empty (normal for new setup)`);
                } else if (columnData && columnData.length > 0) {
                  console.log(`   📝 Table '${tableName}' has data, columns:`, Object.keys(columnData[0]));
                }
              } catch (colErr) {
                console.log(`   ⚠️  Could not check columns for '${tableName}'`);
              }
            }
          } else {
            console.log(`✅ Table '${tableName}' exists and accessible`);
          }
        } catch (err) {
          console.log(`❌ Error checking table '${tableName}':`, err.message);
        }
      }
    }

    // Try to identify the specific error
    console.log('\n🔍 Testing specific queries that might be failing...');
    
    // Test the queries that are likely failing in your bot
    const testQueries = [
      {
        name: 'onboarding_flows query',
        query: () => supabase.from('onboarding_flows').select('*').eq('is_active', true)
      },
      {
        name: 'onboarding_config query', 
        query: () => supabase.from('onboarding_config').select('*').eq('is_active', true)
      },
      {
        name: 'user_profiles query',
        query: () => supabase.from('user_profiles').select('*').limit(1)
      }
    ];

    for (const test of testQueries) {
      try {
        const { data, error } = await test.query();
        if (error) {
          console.log(`❌ ${test.name} failed:`, error.message);
          if (error.message.includes('user_id')) {
            console.log(`   🚨 FOUND THE ISSUE: ${test.name} is missing user_id column!`);
          }
        } else {
          console.log(`✅ ${test.name} successful`);
        }
      } catch (err) {
        console.log(`❌ ${test.name} error:`, err.message);
        if (err.message.includes('user_id')) {
          console.log(`   🚨 FOUND THE ISSUE: ${test.name} is missing user_id column!`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Diagnosis failed:', error.message);
  }
}

diagnoseTables().catch(console.error);