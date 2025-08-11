import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

/**
 * CHECK PLAYERS TABLE SCHEMA
 * 
 * Examine the actual structure of the players table
 */

async function checkPlayersTableSchema() {
  console.log('🔍 CHECKING PLAYERS TABLE SCHEMA');
  console.log('='.repeat(50));

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get sample player to see structure
    console.log('\n📋 Getting sample player record...');
    const { data: samplePlayer, error: sampleError } = await supabase
      .from('players')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.log('❌ Error getting sample player:', sampleError.message);
      return;
    }

    if (!samplePlayer || samplePlayer.length === 0) {
      console.log('❌ No players found in table');
      return;
    }

    console.log('✅ Sample player record found');
    console.log('\n📊 PLAYERS TABLE COLUMNS:');
    
    const columns = Object.keys(samplePlayer[0]);
    columns.forEach((column, index) => {
      const value = samplePlayer[0][column];
      const type = typeof value;
      console.log(`  ${index + 1}. ${column}: ${type} (${value === null ? 'null' : String(value).substring(0, 50)})`);
    });

    console.log(`\n📈 Total columns: ${columns.length}`);

    // Check if required columns exist
    const requiredColumns = ['player_id', 'player_name', 'sport'];
    const optionalColumns = ['team', 'position', 'created_at'];

    console.log('\n✅ REQUIRED COLUMNS:');
    requiredColumns.forEach(col => {
      const exists = columns.includes(col);
      console.log(`  ${exists ? '✅' : '❌'} ${col}`);
    });

    console.log('\n❓ OPTIONAL COLUMNS:');
    optionalColumns.forEach(col => {
      const exists = columns.includes(col);
      console.log(`  ${exists ? '✅' : '❌'} ${col}`);
    });

    // Show sample data
    console.log('\n📋 SAMPLE PLAYER DATA:');
    console.log(JSON.stringify(samplePlayer[0], null, 2));

  } catch (error) {
    console.error('💥 Schema check failed:', error);
  }
}

// Run the schema check
checkPlayersTableSchema();