const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function analyzeLinkingIssue() {
  console.log('🔍 Analyzing Props-Games Linking Issue...\n');

  try {
    // 1. Check current linking status
    console.log('1️⃣ CURRENT LINKING STATUS:');

    const { data: totalProps } = await supabase.from('raw_props').select('id', { count: 'exact' });

    const { data: linkedProps } = await supabase
      .from('raw_props')
      .select('id', { count: 'exact' })
      .not('game_id', 'is', null);

    const totalCount = totalProps?.length || 0;
    const linkedCount = linkedProps?.length || 0;
    const linkPercentage = totalCount > 0 ? Math.round((linkedCount / totalCount) * 100) : 0;

    console.log(`   Total props: ${totalCount}`);
    console.log(`   Linked props: ${linkedCount}`);
    console.log(`   Link percentage: ${linkPercentage}%`);

    // 2. Analyze linking patterns
    console.log('\n2️⃣ LINKING PATTERNS ANALYSIS:');

    // Check external_game_id patterns
    const { data: externalIds } = await supabase
      .from('raw_props')
      .select('external_game_id')
      .not('external_game_id', 'is', null)
      .limit(10);

    console.log('Sample external_game_ids from props:');
    externalIds?.forEach((prop, i) => {
      console.log(`   ${i + 1}. ${prop.external_game_id}`);
    });

    // Check games external_game_id patterns
    const { data: gameExternalIds } = await supabase
      .from('games')
      .select('id, external_game_id, league, home_team, away_team')
      .not('external_game_id', 'is', null)
      .limit(10);

    console.log('\nSample external_game_ids from games:');
    gameExternalIds?.forEach((game, i) => {
      console.log(
        `   ${i + 1}. ${game.external_game_id} (${game.league}: ${game.away_team} @ ${game.home_team})`
      );
    });

    // 3. Check for potential matches
    console.log('\n3️⃣ POTENTIAL MATCHING ANALYSIS:');

    // Get unique external_game_ids from both tables
    const { data: propExternalIds } = await supabase
      .from('raw_props')
      .select('external_game_id')
      .not('external_game_id', 'is', null);

    const { data: gameExternalIds2 } = await supabase
      .from('games')
      .select('external_game_id')
      .not('external_game_id', 'is', null);

    const propIds = [...new Set(propExternalIds?.map(p => p.external_game_id) || [])];
    const gameIds = [...new Set(gameExternalIds2?.map(g => g.external_game_id) || [])];

    console.log(`Unique external_game_ids in props: ${propIds.length}`);
    console.log(`Unique external_game_ids in games: ${gameIds.length}`);

    // Find exact matches
    const exactMatches = propIds.filter(id => gameIds.includes(id));
    console.log(`Exact external_game_id matches: ${exactMatches.length}`);

    if (exactMatches.length > 0) {
      console.log('Sample exact matches:');
      exactMatches.slice(0, 5).forEach((match, i) => {
        console.log(`   ${i + 1}. ${match}`);
      });
    }

    // 4. Check team-based matching potential
    console.log('\n4️⃣ TEAM-BASED MATCHING ANALYSIS:');

    // Get sample props with team info
    const { data: propsWithTeams } = await supabase
      .from('raw_props')
      .select('team, opponent, sport, game_time')
      .not('team', 'is', null)
      .limit(5);

    console.log('Sample props with team info:');
    propsWithTeams?.forEach((prop, i) => {
      console.log(
        `   ${i + 1}. ${prop.team} vs ${prop.opponent} (${prop.sport}) - ${prop.game_time}`
      );
    });

    // Get sample games with team info
    const { data: gamesWithTeams } = await supabase
      .from('games')
      .select('home_team, away_team, league, commence_time')
      .limit(5);

    console.log('\nSample games with team info:');
    gamesWithTeams?.forEach((game, i) => {
      console.log(
        `   ${i + 1}. ${game.away_team} @ ${game.home_team} (${game.league}) - ${game.commence_time}`
      );
    });

    // 5. Recommendations
    console.log('\n5️⃣ LINKING STRATEGY RECOMMENDATIONS:');

    if (exactMatches.length > 0) {
      console.log('✅ EXACT MATCHING: Found exact external_game_id matches');
      console.log('   → Strategy: Update raw_props.game_id where external_game_ids match');
      console.log('   → Expected improvement: Significant');
    } else {
      console.log('❌ NO EXACT MATCHES: No external_game_id matches found');
    }

    console.log('🔄 TEAM-BASED MATCHING: Can match by team names + sport + time');
    console.log('   → Strategy: Match props to games by team names within time window');
    console.log('   → Expected improvement: Moderate to High');

    console.log('🆔 PLAYER-BASED MATCHING: Need to check player_id relationships');
    console.log('   → Strategy: Link via players table if available');
    console.log('   → Expected improvement: High accuracy');

    // 6. Generate linking SQL
    console.log('\n6️⃣ RECOMMENDED LINKING SQL:');

    if (exactMatches.length > 0) {
      console.log('-- Exact external_game_id matching:');
      console.log(`UPDATE raw_props SET game_id = games.id`);
      console.log(`FROM games`);
      console.log(`WHERE raw_props.game_id IS NULL`);
      console.log(`  AND raw_props.external_game_id = games.external_game_id;`);
    }

    console.log('\n-- Team-based matching:');
    console.log(`UPDATE raw_props SET game_id = games.id`);
    console.log(`FROM games`);
    console.log(`WHERE raw_props.game_id IS NULL`);
    console.log(`  AND raw_props.sport = games.league`);
    console.log(`  AND (`);
    console.log(`    LOWER(games.home_team) LIKE '%' || LOWER(raw_props.team) || '%' OR`);
    console.log(`    LOWER(games.away_team) LIKE '%' || LOWER(raw_props.team) || '%'`);
    console.log(`  );`);
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

analyzeLinkingIssue();
