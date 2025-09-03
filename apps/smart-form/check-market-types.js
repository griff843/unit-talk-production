const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkMarketTypes() {
  try {
    const { data: props, error } = await supabase
      .from('raw_props')
      .select('game_id, market_type, stat_type, line, odds')
      .eq('game_id', '9a134e77-d3e5-4e7f-9697-347cadb27fab');

    if (error) {
      console.log('Error:', error);
    } else {
      console.log(`Props for game 9a134e77...: ${props.length}`);
      props.forEach((prop, i) => {
        console.log(
          `  ${i + 1}. market_type: ${prop.market_type}, stat_type: ${prop.stat_type}, line: ${prop.line}`
        );
      });
    }

    // Also check what market_type values exist in general
    const { data: allMarketTypes, error: marketError } = await supabase
      .from('raw_props')
      .select('market_type')
      .not('game_id', 'is', null)
      .limit(10);

    if (!marketError && allMarketTypes) {
      const uniqueMarketTypes = [...new Set(allMarketTypes.map(p => p.market_type))];
      console.log(`\nUnique market_type values: ${uniqueMarketTypes.join(', ')}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkMarketTypes();
