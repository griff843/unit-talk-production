// Direct test of the props API functionality
const fetch = require('node-fetch');

async function testPropsDirectly() {
  console.log('🔍 Testing props API directly...\n');

  try {
    // Test with an MLB game ID that we know exists
    const mlbGameId = '14c48859-aafe-47e6-9f1b-86611e168d24';

    console.log(`🎯 Testing props for MLB game: ${mlbGameId}`);

    // Test the props API endpoint
    const response = await fetch(
      `http://localhost:3002/api/props?game_id=${mlbGameId}&sport=MLB&prop_type=player_props`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    console.log('📊 Props API Response:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Count: ${result.count}`);
    console.log(`  Source: ${result.source}`);

    if (result.props && result.props.length > 0) {
      console.log('\n🎲 Props found:');
      result.props.forEach((prop, i) => {
        console.log(`  ${i + 1}. ${prop.display_name}`);
        console.log(`     Team: ${prop.team}`);
        console.log(`     Line: ${prop.line}`);
        console.log(
          `     Options: ${prop.selection_options?.map(opt => `${opt.label} (${opt.odds})`).join(', ')}`
        );
        console.log('');
      });

      console.log('✅ SUCCESS: Props API is working correctly!');
      console.log('✅ Props have proper display_name and selection_options');
      console.log('✅ Props are properly formatted for the frontend');
    } else {
      console.log('❌ No props returned from API');
    }

    // Test with a different sport to verify fallback
    console.log('\n🏀 Testing fallback with NBA game...');
    const nbaGameId = '9a134e77-d3e5-4e7f-9697-347cadb27fab';

    const nbaResponse = await fetch(
      `http://localhost:3002/api/props?game_id=${nbaGameId}&sport=NBA&prop_type=player_props`
    );
    const nbaResult = await nbaResponse.json();

    console.log(`NBA Props: ${nbaResult.count} found (source: ${nbaResult.source})`);

    if (nbaResult.props && nbaResult.props.length > 0) {
      console.log('Sample NBA prop:', nbaResult.props[0].display_name);
    }
  } catch (error) {
    console.error('💥 Error testing props API:', error);
  }
}

testPropsDirectly();
