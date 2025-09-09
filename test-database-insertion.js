const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Testing Database Insertion Issue');
console.log('='.repeat(50));

async function testDatabaseInsertion() {
  try {
    // Test 1: Basic database connectivity
    console.log('1. Testing basic database connectivity...');
    const { data: testQuery, error: testError } = await supabase
      .from('raw_props')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.log('❌ Database connectivity failed:', testError.message);
      return;
    }
    
    console.log('✅ Database connectivity working');
    
    // Test 2: Check raw_props table structure
    console.log('\n2. Checking raw_props table structure...');
    const { data: columnTest, error: columnError } = await supabase
      .from('raw_props')
      .select('*')
      .limit(1);
    
    if (columnError) {
      console.log('❌ Raw props table error:', columnError.message);
      return;
    }
    
    console.log('✅ Raw props table accessible');
    if (columnTest.length > 0) {
      console.log('   Sample columns:', Object.keys(columnTest[0]).slice(0, 10).join(', '));
    }
    
    // Test 3: Try inserting a simple test prop
    console.log('\n3. Testing simple prop insertion...');
    const testProp = {
      id: crypto.randomUUID(),
      player_name: 'Test Player',
      team: 'TEST',
      opponent: 'TEST2',
      market: 'passing_yards', 
      line: 250.5,
      over: -110,
      under: -110,
      market_type: 'player_prop',
      game_time: new Date().toISOString(),
      sport: 'TEST_SPORT',
      scraped_at: new Date().toISOString(),
      provider: 'test'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('raw_props')
      .insert(testProp)
      .select();
    
    if (insertError) {
      console.log('❌ Test insertion failed:', insertError.message);
      console.log('   Error details:', insertError);
      
      // Check if it's a column issue
      if (insertError.message.includes('column') || insertError.message.includes('does not exist')) {
        console.log('\n   🔍 Checking exact table schema...');
        
        // Get table structure via information_schema
        const { data: schemaData, error: schemaError } = await supabase.rpc('get_table_schema', {
          table_name: 'raw_props'
        });
        
        if (schemaError) {
          console.log('   Schema check failed, trying direct query...');
          
          // Try a simpler insertion to identify the issue
          const simpleProp = {
            id: crypto.randomUUID(),
            player_name: 'Simple Test',
            sport: 'TEST'
          };
          
          const { data: simpleData, error: simpleError } = await supabase
            .from('raw_props')
            .insert(simpleProp)
            .select();
          
          if (simpleError) {
            console.log('   Even simple insertion failed:', simpleError.message);
          } else {
            console.log('   Simple insertion worked - complex prop structure issue');
          }
        }
      }
      
      return;
    }
    
    console.log('✅ Test insertion successful!');
    console.log('   Inserted prop ID:', insertData[0]?.id);
    
    // Clean up test data
    await supabase
      .from('raw_props')
      .delete()
      .eq('id', testProp.id);
    
    console.log('✅ Test data cleaned up');
    
    // Test 4: Check current raw_props count to see if FeedAgent data is there
    console.log('\n4. Checking current raw_props count...');
    const { data: countData, error: countError } = await supabase
      .from('raw_props')
      .select('id', { count: 'exact' });
    
    if (countError) {
      console.log('❌ Count check failed:', countError.message);
      return;
    }
    
    console.log(`Current total props: ${countData.length}`);
    
    // Check props from last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentData, error: recentError } = await supabase
      .from('raw_props')
      .select('id, sport, created_at')
      .gte('created_at', oneHourAgo);
    
    if (recentError) {
      console.log('❌ Recent props check failed:', recentError.message);
      return;
    }
    
    console.log(`Props from last hour: ${recentData.length}`);
    
    if (recentData.length > 0) {
      const sportCounts = recentData.reduce((acc, prop) => {
        acc[prop.sport] = (acc[prop.sport] || 0) + 1;
        return acc;
      }, {});
      console.log('   Recent props by sport:', sportCounts);
      
      console.log('\n🎉 SUCCESS: FeedAgent data IS in database!');
      console.log('   The 9,557 props were likely inserted successfully');
      console.log('   Initial check may have used wrong time window');
    } else {
      console.log('\n❌ ISSUE: No recent props found - FeedAgent insertion likely failed');
    }
    
  } catch (error) {
    console.error('💥 Database insertion test failed:', error.message);
  }
}

testDatabaseInsertion();