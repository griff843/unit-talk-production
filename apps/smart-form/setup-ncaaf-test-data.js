const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const supabaseUrl = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E'; // Use service role

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupNCAAFTestData() {
  console.log('🏈 Setting up NCAAF test data for future dates...');
  
  // Future dates for NCAAF season
  const futureDates = [
    '2025-08-30', // Week 1 of 2025 season
    '2025-09-06', // Week 2
    '2025-09-13', // Week 3
    '2025-09-20', // Week 4
  ];
  
  const ncaafGames = [];
  const gameIds = [];
  
  futureDates.forEach((date, dateIdx) => {
    // Key NCAAF matchups for testing
    const matchups = [
      { home: 'Georgia', away: 'Alabama', venue: 'Sanford Stadium' },
      { home: 'Ohio State', away: 'Michigan', venue: 'Ohio Stadium' },
      { home: 'Texas', away: 'Oklahoma', venue: 'Darrell K Royal Stadium' },
      { home: 'Clemson', away: 'North Carolina', venue: 'Memorial Stadium' },
      { home: 'Notre Dame', away: 'USC', venue: 'Notre Dame Stadium' },
    ];
    
    matchups.forEach((matchup, idx) => {
      const gameId = uuidv4(); // Generate proper UUID
      gameIds.push(gameId);
      
      const commenceTime = new Date(date + 'T19:00:00Z'); // 7 PM UTC
      commenceTime.setHours(commenceTime.getHours() + (idx * 3)); // Stagger times
      
      ncaafGames.push({
        id: gameId,
        game_id: gameId,
        sport: 'FOOTBALL',
        league: 'NCAAF',
        season: '2025',
        home_team: `${matchup.home.toUpperCase().replace(/\s+/g, '_')}_NCAAF`,
        away_team: `${matchup.away.toUpperCase().replace(/\s+/g, '_')}_NCAAF`,
        home_team_meta: {
          names: {
            long: matchup.home,
            short: matchup.home.substring(0, 4).toUpperCase(),
            medium: matchup.home,
            location: matchup.home,
            nickname: matchup.home
          },
          teamID: `${matchup.home.toUpperCase().replace(/\s+/g, '_')}_NCAAF`,
          colors: { primary: '#000080', primaryContrast: '#FFFFFF' }
        },
        away_team_meta: {
          names: {
            long: matchup.away,
            short: matchup.away.substring(0, 4).toUpperCase(),
            medium: matchup.away,
            location: matchup.away,
            nickname: matchup.away
          },
          teamID: `${matchup.away.toUpperCase().replace(/\s+/g, '_')}_NCAAF`,
          colors: { primary: '#800000', primaryContrast: '#FFFFFF' }
        },
        game_date: date,
        commence_time: commenceTime.toISOString(),
        start_time: commenceTime.toISOString(),
        status: '{"started":false,"completed":false,"live":false,"displayLong":"Upcoming"}',
        venue: matchup.venue,
        matchup: `${matchup.away} @ ${matchup.home}`,
        
        // Realistic NCAAF odds
        spread: (Math.random() > 0.5 ? '-' : '+') + (3 + Math.random() * 10).toFixed(1),
        total: (45 + Math.random() * 15).toFixed(1), // 45-60 point totals
        moneyline_home: Math.random() > 0.5 ? `-${120 + Math.random() * 200}` : `+${110 + Math.random() * 150}`,
        moneyline_away: Math.random() > 0.5 ? `-${120 + Math.random() * 200}` : `+${110 + Math.random() * 150}`,
        spread_odds: '-110',
        total_over_odds: '-110',
        total_under_odds: '-110',
        
        source: 'test_data',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });
  });
  
  console.log(`📊 Created ${ncaafGames.length} NCAAF games for testing`);
  
  // Insert games into database
  const { data: insertedGames, error: gamesError } = await supabase
    .from('games')
    .upsert(ncaafGames, { onConflict: 'id' })
    .select('id, matchup, game_date');
  
  if (gamesError) {
    console.error('❌ Error inserting NCAAF games:', gamesError);
    return;
  }
  
  console.log('✅ Successfully inserted NCAAF games:', insertedGames?.length);
  
  // Now create props for these games
  console.log('🎯 Creating props for NCAAF games...');
  
  const ncaafProps = [];
  
  gameIds.forEach((gameId, gameIdx) => {
    const game = ncaafGames[gameId];
    
    // Key NCAAF prop types
    const propTypes = [
      { type: 'Passing Yards', line: 250 + Math.random() * 100 },
      { type: 'Rushing Yards', line: 80 + Math.random() * 60 },
      { type: 'Receiving Yards', line: 60 + Math.random() * 40 },
      { type: 'Total Touchdowns', line: 1.5 + Math.random() * 1 },
      { type: 'Completions', line: 18 + Math.random() * 8 },
    ];
    
    // Sample players for props
    const players = [
      'Quarterback A', 'Running Back A', 'Wide Receiver A',
      'Quarterback B', 'Running Back B', 'Wide Receiver B'
    ];
    
    players.forEach((player, playerIdx) => {
      propTypes.forEach((prop, propIdx) => {
        const propId = uuidv4(); // Generate proper UUID for props
        
        ncaafProps.push({
          id: propId,
          game_id: gameId,
          player_name: player,
          stat_type: prop.type, // v3.0.0 uses stat_type
          market_type: 'player_props',
          line: prop.line.toFixed(1),
          over_odds: -110 + Math.random() * 20 - 10, // -120 to -100
          under_odds: -110 + Math.random() * 20 - 10,
          team: gameIdx % 2 === playerIdx % 2 ? 'HOME' : 'AWAY',
          sport: 'NCAAF',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });
    });
  });
  
  console.log(`🎯 Created ${ncaafProps.length} NCAAF props`);
  
  // Insert props into database
  const { data: insertedProps, error: propsError } = await supabase
    .from('raw_props')
    .upsert(ncaafProps, { onConflict: 'id' })
    .select('id, player_name, stat_type');
    
  if (propsError) {
    console.error('❌ Error inserting NCAAF props:', propsError);
    return;
  }
  
  console.log('✅ Successfully inserted NCAAF props:', insertedProps?.length);
  
  console.log('\n🎉 NCAAF test data setup complete!');
  console.log('📋 Summary:');
  console.log(`  - Games: ${insertedGames?.length || 0}`);
  console.log(`  - Props: ${insertedProps?.length || 0}`);
  console.log(`  - Date range: ${futureDates[0]} to ${futureDates[futureDates.length - 1]}`);
}

// Run the setup
setupNCAAFTestData().catch(console.error);