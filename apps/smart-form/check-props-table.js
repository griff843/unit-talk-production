const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkPropsTable() {
  try {
    console.log('🔍 Checking raw_props table...');

    const { data: sampleProps, error: sampleError } = await supabase
      .from('raw_props')
      .select('*')
      .limit(10);

    if (sampleError) {
      console.log('❌ Error fetching sample props:', sampleError);
      return;
    }

    console.log(`📊 Found ${sampleProps?.length || 0} props in database`);

    if (sampleProps && sampleProps.length > 0) {
      console.log('📋 Sample props:');
      sampleProps.forEach((prop, i) => {
        const gameId = prop.game_id ? prop.game_id.substring(0, 8) + '...' : 'N/A';
        console.log(
          `  ${i + 1}. Game: ${gameId} | ${prop.prop_type} | Line: ${prop.line} | Odds: ${prop.odds}`
        );
      });

      // Check if any props match our test game IDs
      const testGameIds = [
        '9a134e77-d3e5-4e7f-9697-347cadb27fab',
        '377533af-f6e5-4a16-b29d-a8401f7eefb8',
      ];

      for (const gameId of testGameIds) {
        const { data: gameProps, error: gameError } = await supabase
          .from('raw_props')
          .select('*')
          .eq('game_id', gameId);

        if (!gameError && gameProps) {
          console.log(`\n🎯 Props for game ${gameId.substring(0, 8)}...: ${gameProps.length}`);
        }
      }
    } else {
      console.log('⚠️ No props found in database');

      // Check table structure
      const { data: structure, error: structError } = await supabase
        .from('raw_props')
        .select('*')
        .limit(1);

      if (structError) {
        console.log('❌ Table structure error:', structError.message);
      }
    }
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

checkPropsTable();
