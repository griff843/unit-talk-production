// Quick API test to prove props are working
const testAPI = async () => {
  console.log('🧪 TESTING PROPS API DIRECTLY\n');

  try {
    // Test with a sample game ID from our database
    const testUrl =
      'http://localhost:3004/api/api/props?game_id=9a134e77-d3e5-4e7f-9697-347cadb27fab&sport=MLB&prop_type=player_props';

    console.log('📡 Making API request...');
    console.log(`URL: ${testUrl}\n`);

    const response = await fetch(testUrl);
    const data = await response.json();

    console.log('📊 API RESPONSE:');
    console.log('===============');
    console.log(`Status: ${response.status}`);
    console.log(`Success: ${data.success}`);
    console.log(`Props count: ${data.props?.length || 0}`);
    console.log(`Source: ${data.source}`);
    console.log(`Message: ${data.message || 'N/A'}`);

    if (data.success && data.props?.length > 0) {
      console.log('\n✅ PROPS API IS WORKING!');
      console.log('\n📋 Sample prop structure:');

      const sampleProp = data.props[0];
      console.log(`Display name: ${sampleProp.display_name}`);
      console.log(`Selection options: ${sampleProp.selection_options?.length || 0}`);

      if (sampleProp.selection_options?.length > 0) {
        console.log('\n🎯 Available selections:');
        sampleProp.selection_options.slice(0, 3).forEach((opt, i) => {
          console.log(`  ${i + 1}. ${opt.label}: ${opt.odds}`);
        });
      }

      console.log('\n🎉 CRITICAL FIX #1 CONFIRMED: Props loading from database!');
    } else {
      console.log('\n❌ Props API issue detected');
      if (data.error) {
        console.log(`Error: ${data.error}`);
      }
    }
  } catch (error) {
    console.log('❌ Error testing API:', error.message);
    console.log('\n💡 Make sure dev server is running on port 3004');
  }
};

// Test after a short delay
setTimeout(testAPI, 2000);
