import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

/**
 * TEST WNBA PLAYER INSERT
 * 
 * Simple test to insert one WNBA player and understand schema requirements
 */

async function testWnbaInsert() {
  console.log('🧪 TESTING WNBA PLAYER INSERT');
  console.log('='.repeat(40));

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test player data based on schema
    const testPlayer = {
      player_id: 'test-wnba-123',
      player_name: 'Test WNBA Player',
      sport: 'WNBA',
      team: 'TEST',
      position: 'PG'
    };

    console.log('\n📝 Test player data:');
    console.log(JSON.stringify(testPlayer, null, 2));

    console.log('\n💾 Attempting insert...');
    const { data: insertResult, error: insertError } = await supabase
      .from('players')
      .insert([testPlayer])
      .select();

    if (insertError) {
      console.log('❌ Insert failed:', insertError.message);
      console.log('Error details:', insertError);
    } else {
      console.log('✅ Insert successful!');
      console.log('Inserted data:', insertResult);

      // Clean up - delete the test player
      console.log('\n🧹 Cleaning up test player...');
      const { error: deleteError } = await supabase
        .from('players')
        .delete()
        .eq('player_id', 'test-wnba-123');

      if (deleteError) {
        console.log('⚠️  Failed to clean up test player:', deleteError.message);
      } else {
        console.log('✅ Test player cleaned up');
      }
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test
testWnbaInsert();