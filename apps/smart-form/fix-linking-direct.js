const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fixLinkingDirect() {
  console.log('🔧 Fixing Props-Games Linking Directly...\n');

  try {
    // Step 1: Fix exact external_game_id matches
    console.log('1️⃣ Fixing exact external_game_id matches...');

    // Get all unlinked props with external_game_id
    const { data: unlinkedProps } = await supabase
      .from('raw_props')
      .select('id, external_game_id')
      .is('game_id', null)
      .not('external_game_id', 'is', null);

    console.log(`Found ${unlinkedProps?.length || 0} unlinked props with external_game_id`);

    let exactMatches = 0;

    for (const prop of unlinkedProps || []) {
      // Find matching game
      const { data: matchingGame } = await supabase
        .from('games')
        .select('id')
        .eq('external_game_id', prop.external_game_id)
        .single();

      if (matchingGame) {
        // Update the prop with the game_id
        const { error } = await supabase
          .from('raw_props')
          .update({ game_id: matchingGame.id })
          .eq('id', prop.id);

        if (!error) {
          exactMatches++;
        }
      }
    }

    console.log(`✅ Linked ${exactMatches} props via exact external_game_id matching`);

    // Step 2: Fix team-based matches
    console.log('\n2️⃣ Fixing team-based matches...');

    // Get remaining unlinked props with team info
    const { data: remainingProps } = await supabase
      .from('raw_props')
      .select('id, team, opponent, sport')
      .is('game_id', null)
      .not('team', 'is', null);

    console.log(`Found ${remainingProps?.length || 0} remaining unlinked props with team info`);

    let teamMatches = 0;

    for (const prop of remainingProps || []) {
      // Find matching game by team and sport
      const { data: matchingGames } = await supabase
        .from('games')
        .select('id, home_team, away_team')
        .eq('league', prop.sport)
        .or(`home_team.ilike.%${prop.team}%,away_team.ilike.%${prop.team}%`);

      if (matchingGames && matchingGames.length > 0) {
        // Use the first match (could be improved with better matching logic)
        const { error } = await supabase
          .from('raw_props')
          .update({ game_id: matchingGames[0].id })
          .eq('id', prop.id);

        if (!error) {
          teamMatches++;
        }
      }
    }

    console.log(`✅ Linked ${teamMatches} props via team-based matching`);

    // Step 3: Verify results
    console.log('\n3️⃣ Verifying results...');

    const { data: totalPropsAfter } = await supabase
      .from('raw_props')
      .select('id', { count: 'exact' });

    const { data: linkedPropsAfter } = await supabase
      .from('raw_props')
      .select('id', { count: 'exact' })
      .not('game_id', 'is', null);

    const totalCount = totalPropsAfter?.length || 0;
    const linkedCount = linkedPropsAfter?.length || 0;
    const linkPercentage = totalCount > 0 ? Math.round((linkedCount / totalCount) * 100) : 0;

    console.log(`📊 FINAL RESULTS:`);
    console.log(`   Total props: ${totalCount}`);
    console.log(`   Linked props: ${linkedCount}`);
    console.log(`   Link percentage: ${linkPercentage}%`);
    console.log(`   Improvement: +${exactMatches + teamMatches} linked props`);

    if (linkPercentage > 80) {
      console.log('\n✅ SUCCESS: Most props are now linked to games!');
    } else if (linkPercentage > 50) {
      console.log('\n⚠️ PARTIAL SUCCESS: Significant improvement, but more work needed');
    } else {
      console.log('\n❌ LIMITED SUCCESS: Need to investigate other linking strategies');
    }

    // Step 4: Test the props API with a linked game
    console.log('\n4️⃣ Testing props API with linked data...');

    // Find a game that should now have props
    const { data: gameWithProps } = await supabase
      .from('games')
      .select(
        `
        id, 
        home_team, 
        away_team, 
        league,
        raw_props!inner(id)
      `
      )
      .eq('league', 'MLB')
      .limit(1)
      .single();

    if (gameWithProps) {
      console.log(`🎯 Testing with game: ${gameWithProps.away_team} @ ${gameWithProps.home_team}`);

      // Test the props API
      const fetch = require('node-fetch');
      const response = await fetch(
        `http://localhost:3002/api/props?game_id=${gameWithProps.id}&sport=MLB&prop_type=player_props`
      );
      const result = await response.json();

      console.log(`   Props API result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`   Props found: ${result.count}`);
      console.log(`   Data source: ${result.source}`);

      if (result.count > 0) {
        console.log(`   Sample prop: ${result.props[0].display_name}`);
        console.log('\n🎉 PROPS ARE NOW WORKING IN THE FORM!');
      }
    }
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

fixLinkingDirect();
