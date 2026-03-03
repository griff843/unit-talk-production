import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

import { fetchOptimalProps } from './agents/FeedAgent/optimal';

// Load environment variables
config();

async function testOptimalInsertion() {
  console.log('🧪 Testing Optimal API Integration with REAL Database Insertion...\n');

  try {
    // Initialize Supabase client
    const supabase = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_KEY']!);

    console.log('1️⃣ Fetching props from Optimal API...');
    const props = await fetchOptimalProps('MLB');
    console.log(`✅ Fetched ${props.length} props from Optimal API\n`);

    if (props.length === 0) {
      console.log('⚠️ No props returned from Optimal API');
      return;
    }

    console.log('2️⃣ Sample prop structure:');
    console.log(JSON.stringify(props[0], null, 2));
    console.log('');

    console.log('3️⃣ Inserting first 10 props into database (PERMANENT)...');
    const testProps = props.slice(0, 10);

    // Insert props directly into database - NO CLEANUP THIS TIME
    const { data, error } = await supabase.from('raw_props').insert(testProps).select();

    if (error) {
      console.error('❌ Database insertion failed:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return;
    }

    console.log('✅ Database insertion successful!');
    console.log(`📊 Inserted ${data?.length || 0} props into database`);
    console.log(
      '📋 Inserted prop IDs:',
      data?.map(p => p.id)
    );

    // Verify the data is actually in the database
    const { data: verifyData, error: verifyError } = await supabase
      .from('raw_props')
      .select('*')
      .eq('provider', 'Optimal')
      .order('created_at', { ascending: false })
      .limit(5);

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError);
      return;
    }

    console.log('\n🔍 Verification - Optimal props in database:');
    console.log(`Found ${verifyData?.length || 0} Optimal props`);
    if (verifyData && verifyData.length > 0) {
      verifyData.forEach((prop, index) => {
        console.log(
          `${index + 1}. ${prop.player_name} - ${prop.stat_type} ${prop.line} (${prop.sport})`
        );
      });
    }

    console.log('\n🎉 Real insertion test completed successfully!');
    console.log(`\n📈 Summary:`);
    console.log(`   • Fetched: ${props.length} props from Optimal API`);
    console.log(`   • Inserted: ${testProps.length} props into database`);
    console.log(`   • Verified: ${verifyData?.length || 0} Optimal props in database`);
    console.log(`   • Status: ✅ Props are now PERMANENTLY in your database`);
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  }
}

// Run the test
testOptimalInsertion();
