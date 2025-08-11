const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testDirectQuery() {
  try {
    const gameId = '9a134e77-d3e5-4e7f-9697-347cadb27fab';
    const propType = 'player_props';

    console.log(`🧪 Testing direct database query...`);
    console.log(`  Game ID: ${gameId}`);
    console.log(`  Prop Type: ${propType}`);

    // Exact same query as the API
    const { data: dbProps, error } = await supabase
      .from('raw_props')
      .select(
        `
        id,
        game_id,
        player_id,
        team_id,
        stat_type,
        market_type,
        line,
        odds,
        player_name,
        team
      `
      )
      .eq('game_id', gameId)
      .eq('market_type', propType)
      .order('stat_type')
      .order('line');

    console.log(`\n📊 Query Results:`);
    console.log(`  Error: ${error ? error.message : 'None'}`);
    console.log(`  Props found: ${dbProps ? dbProps.length : 0}`);

    if (dbProps && dbProps.length > 0) {
      console.log(`\n🎯 Props details:`);
      dbProps.forEach((prop, i) => {
        console.log(
          `  ${i + 1}. ${prop.stat_type} | Line: ${prop.line} | Odds: ${prop.odds} | Player: ${prop.player_name}`
        );
      });

      // Transform exactly like the API does
      const transformedProps = dbProps.map(prop => ({
        id: prop.id,
        game_id: prop.game_id,
        player_name: prop.player_name || 'Unknown Player',
        team: prop.team || 'UNK',
        prop_type: prop.stat_type,
        market_type: prop.market_type,
        line: prop.line,
        over_odds: prop.odds > 0 ? `+${prop.odds}` : prop.odds,
        under_odds: prop.odds > 0 ? `-${Math.abs(prop.odds) + 20}` : `+${Math.abs(prop.odds) - 20}`,
        display_name: `${prop.player_name || 'Unknown'} ${prop.stat_type}${prop.line ? ` ${prop.line}` : ''}`,
        selection_options: prop.line
          ? [
              { value: 'over', label: `Over ${prop.line}`, odds: prop.odds },
              {
                value: 'under',
                label: `Under ${prop.line}`,
                odds: prop.odds > 0 ? -(Math.abs(prop.odds) + 20) : Math.abs(prop.odds) - 20,
              },
            ]
          : [
              { value: 'yes', label: 'Yes', odds: prop.odds },
              {
                value: 'no',
                label: 'No',
                odds: prop.odds > 0 ? -(Math.abs(prop.odds) + 20) : Math.abs(prop.odds) - 20,
              },
            ],
      }));

      console.log(`\n🔄 Transformed props:`);
      transformedProps.forEach((prop, i) => {
        console.log(`  ${i + 1}. ${prop.display_name}`);
        console.log(
          `     Options: ${prop.selection_options.map(opt => `${opt.label} (${opt.odds})`).join(', ')}`
        );
      });

      console.log(`\n✅ API should return:`);
      console.log(
        JSON.stringify(
          {
            success: true,
            props: transformedProps,
            count: transformedProps.length,
            source: 'database',
          },
          null,
          2
        )
      );
    }
  } catch (error) {
    console.error('💥 Error in direct query test:', error);
  }
}

testDirectQuery();
