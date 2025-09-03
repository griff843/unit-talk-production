const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
);

async function setupTestData() {
  console.log('🚀 Setting up test data for smart form...');

  try {
    // Create games table with correct schema
    console.log('📋 Creating games table...');

    // First, check if table exists
    const { data: existingGames, error: checkError } = await supabase
      .from('games')
      .select('*')
      .limit(1);

    if (checkError && checkError.code === '42P01') {
      console.log('🛠️ Games table does not exist, creating...');

      // Create games table
      const createGamesTable = `
        CREATE TABLE IF NOT EXISTS games (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          sport TEXT NOT NULL,
          home_team TEXT NOT NULL,
          away_team TEXT NOT NULL,
          game_date DATE NOT NULL,
          game_time TIME,
          status TEXT DEFAULT 'scheduled',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      const { error: createError } = await supabase.rpc('exec_sql', { sql: createGamesTable });
      if (createError) {
        console.log('⚠️ Could not create games table via RPC, trying direct insert...');
      }
    }

    // Insert sample games for testing
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const sampleGames = [
      {
        sport: 'MLB',
        home_team: 'New York Yankees',
        away_team: 'Tampa Bay Rays',
        game_date: tomorrowStr,
        game_time: '19:05:00',
        status: 'scheduled',
      },
      {
        sport: 'MLB',
        home_team: 'Los Angeles Dodgers',
        away_team: 'San Francisco Giants',
        game_date: tomorrowStr,
        game_time: '20:10:00',
        status: 'scheduled',
      },
      {
        sport: 'NBA',
        home_team: 'Los Angeles Lakers',
        away_team: 'Golden State Warriors',
        game_date: tomorrowStr,
        game_time: '19:30:00',
        status: 'scheduled',
      },
      {
        sport: 'NFL',
        home_team: 'Kansas City Chiefs',
        away_team: 'Buffalo Bills',
        game_date: tomorrowStr,
        game_time: '20:15:00',
        status: 'scheduled',
      },
    ];

    console.log('🎯 Inserting sample games...');
    const { data: insertedGames, error: insertError } = await supabase
      .from('games')
      .insert(sampleGames)
      .select();

    if (insertError) {
      console.log('⚠️ Insert error:', insertError.message);

      // Try alternative approach - check existing data
      const { data: existingData } = await supabase
        .from('games')
        .select('*')
        .eq('game_date', tomorrowStr);

      if (existingData && existingData.length > 0) {
        console.log('✅ Found existing games:', existingData.length);
      } else {
        console.log('📝 Creating minimal games table and data...');

        // Create a simple games table and insert data
        for (const game of sampleGames) {
          const { error: singleInsertError } = await supabase.from('games').insert(game);

          if (singleInsertError) {
            console.log(
              '❌ Could not insert game:',
              game.home_team,
              'vs',
              game.away_team,
              singleInsertError.message
            );
          } else {
            console.log('✅ Inserted:', game.home_team, 'vs', game.away_team);
          }
        }
      }
    } else {
      console.log('✅ Successfully inserted', insertedGames.length, 'sample games');
    }

    // Verify data
    const { data: allGames } = await supabase.from('games').select('*').order('game_date');

    console.log('📊 Total games in database:', allGames?.length || 0);
    if (allGames && allGames.length > 0) {
      console.log(
        '🎮 Sample games:',
        allGames.slice(0, 3).map(g => `${g.away_team} @ ${g.home_team} (${g.sport})`)
      );
    }

    console.log('✅ Test data setup complete!');
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  }
}

setupTestData();
