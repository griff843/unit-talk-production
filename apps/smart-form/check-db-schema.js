const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkDatabaseSchema() {
  console.log('🔍 Checking actual database schema...\n');

  try {
    // Check games table structure
    console.log('📊 GAMES TABLE STRUCTURE:');
    const { data: gamesColumns, error: gamesError } = await supabase
      .rpc('get_table_columns', { table_name: 'games' })
      .single();

    if (gamesError) {
      console.log('Using alternative method to check games table...');
      const { data: sampleGame } = await supabase.from('games').select('*').limit(1).single();

      if (sampleGame) {
        console.log('Games table columns:', Object.keys(sampleGame));
      }
    } else {
      console.log('Games columns:', gamesColumns);
    }

    // Check raw_props table structure
    console.log('\n🎲 RAW_PROPS TABLE STRUCTURE:');
    const { data: propsColumns, error: propsError } = await supabase
      .rpc('get_table_columns', { table_name: 'raw_props' })
      .single();

    if (propsError) {
      console.log('Using alternative method to check raw_props table...');
      const { data: sampleProp } = await supabase.from('raw_props').select('*').limit(1).single();

      if (sampleProp) {
        console.log('Raw_props table columns:', Object.keys(sampleProp));
        console.log('Sample prop data:');
        Object.entries(sampleProp).forEach(([key, value]) => {
          console.log(`  ${key}: ${value} (${typeof value})`);
        });
      }
    } else {
      console.log('Raw_props columns:', propsColumns);
    }

    // Check if there's a foreign key relationship
    console.log('\n🔗 CHECKING RELATIONSHIPS:');

    // Check if game_id in raw_props references games.id
    const { data: gameIds } = await supabase.from('games').select('id').limit(5);

    const { data: propGameIds } = await supabase
      .from('raw_props')
      .select('game_id, external_game_id')
      .not('game_id', 'is', null)
      .limit(5);

    console.log(
      'Sample game IDs:',
      gameIds?.map(g => g.id)
    );
    console.log(
      'Sample prop game_ids:',
      propGameIds?.map(p => ({ game_id: p.game_id, external_game_id: p.external_game_id }))
    );

    // Check timezone handling
    console.log('\n🕐 TIMEZONE ANALYSIS:');
    const { data: gameWithTime } = await supabase
      .from('games')
      .select('id, commence_time, start_time, created_at, updated_at')
      .not('commence_time', 'is', null)
      .limit(1)
      .single();

    if (gameWithTime) {
      console.log('Sample game timing data:');
      Object.entries(gameWithTime).forEach(([key, value]) => {
        if (key.includes('time') || key.includes('at')) {
          console.log(`  ${key}: ${value} (${typeof value})`);
          if (value) {
            const date = new Date(value);
            console.log(`    Parsed: ${date.toISOString()}`);
            console.log(
              `    EST: ${date.toLocaleString('en-US', { timeZone: 'America/New_York' })}`
            );
          }
        }
      });
    }

    // Check if there are any constraints or indexes
    console.log('\n📋 SCHEMA RECOMMENDATIONS:');
    console.log('1. raw_props.game_id should be a foreign key to games.id');
    console.log('2. All timestamps should use TIMESTAMPTZ for proper timezone handling');
    console.log('3. Need proper indexing on game_id for performance');
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

checkDatabaseSchema();
