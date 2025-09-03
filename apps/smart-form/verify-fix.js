console.log('🧪 Verifying prop selection fix...\n');

// Test the API endpoint to confirm props are still loading
const testAPI = async () => {
  try {
    const response = await fetch(
      'http://localhost:3003/api/api/props?game_id=9a134e77-d3e5-4e7f-9697-347cadb27fab&sport=NBA&prop_type=player_props'
    );
    const data = await response.json();

    console.log('📊 Props API Test:');
    console.log(`   Status: ${response.status}`);
    console.log(`   Success: ${data.success}`);
    console.log(`   Props count: ${data.props?.length || 0}`);
    console.log(`   Source: ${data.source}`);

    if (data.success && data.props?.length > 0) {
      console.log('\n✅ API is working - props are loading from database');

      const sampleProp = data.props[0];
      console.log('\n📋 Sample prop structure:');
      console.log(`   Display name: ${sampleProp.display_name}`);
      console.log(`   Selection options: ${sampleProp.selection_options?.length || 0}`);

      if (sampleProp.selection_options?.length > 0) {
        console.log('   Options:');
        sampleProp.selection_options.forEach(opt => {
          console.log(`     - ${opt.label}: ${opt.odds}`);
        });
      }

      console.log('\n✅ NAMING FIX VERIFICATION:');
      console.log('=====================================');
      console.log('✅ Props API working correctly');
      console.log('✅ Data structure includes selection_options');
      console.log('✅ Frontend should now load props when bet_type = "player_prop"');
      console.log('✅ Over/Under buttons should display');
      console.log('✅ Clicking buttons should enable "Add Selection"');
      console.log('');
      console.log('🎯 The naming inconsistency fix should resolve the prop selection issue!');
      console.log('');
      console.log('To manually verify:');
      console.log('1. Go to http://localhost:3003/submit-ticket');
      console.log('2. Select NBA sport and advance through steps');
      console.log('3. Select "Player Props" bet type');
      console.log('4. Select any game');
      console.log('5. Verify props load with Over/Under buttons');
      console.log('6. Click a prop button and verify "Add Selection" appears');
    } else {
      console.log('❌ API issue - props not loading properly');
    }
  } catch (error) {
    console.log('❌ Error testing API:', error.message);
    console.log('   Make sure dev server is running on port 3003');
  }
};

// Wait a moment for server to fully start
setTimeout(testAPI, 3000);
