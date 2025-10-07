import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testDatabaseAccess() {
  console.log('🔍 Testing database access...\n');

  // Test 1: Direct count
  const { count, error: countError } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true })
    .not('actual_value', 'is', null);

  if (countError) {
    console.log('❌ Count error:', countError.message);
  } else {
    console.log(`✅ Total settled outcomes: ${count?.toLocaleString()}`);
  }

  // Test 2: RPC function
  console.log('\n🔍 Testing count_outcomes_by_sport() RPC...\n');
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('count_outcomes_by_sport');

  if (rpcError) {
    console.log('❌ RPC Error:', rpcError.message);
    console.log('Details:', rpcError);
  } else {
    console.log('✅ RPC Response:', rpcData);

    if (rpcData && rpcData.length > 0) {
      console.log('\nSport Distribution:');
      rpcData.forEach((row: any) => {
        console.log(`  ${row.sport}: ${row.count.toLocaleString()}`);
      });
    }
  }

  // Test 3: Manual aggregation
  console.log('\n🔍 Testing manual sport aggregation...\n');
  const { data: sampleData } = await supabase
    .from('settled_outcomes')
    .select('sport')
    .not('actual_value', 'is', null)
    .limit(10000);

  if (sampleData) {
    const sportCounts = sampleData.reduce((acc: any, row: any) => {
      acc[row.sport] = (acc[row.sport] || 0) + 1;
      return acc;
    }, {});

    console.log('Sport Distribution (10K sample):');
    Object.entries(sportCounts).forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count}`);
    });
  }

  process.exit(0);
}

testDatabaseAccess();
