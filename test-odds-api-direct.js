require('dotenv').config();

async function testOddsApiDirect() {
    console.log('🔍 Testing Odds API Direct Connection...\n');
    
    const apiKey = process.env.ODDS_API_KEY;
    
    if (!apiKey) {
        console.error('❌ ODDS_API_KEY not found');
        return;
    }
    
    console.log('✅ API Key loaded:', apiKey.substring(0, 15) + '...');
    
    try {
        // Test different URL formats
        const testUrls = [
            `https://api.the-odds-api.com/v4/sports?apiKey=${apiKey}`,
            `https://api.the-odds-api.com/v4/sports/?apiKey=${apiKey}`,
        ];
        
        for (const url of testUrls) {
            console.log(`\n📡 Testing URL: ${url.replace(apiKey, 'API_KEY')}`);
            
            try {
                const response = await fetch(url);
                console.log('Status:', response.status, response.statusText);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('✅ Success! Found', data.length, 'sports');
                    
                    // Show active sports for today
                    const activeSports = data.filter(sport => sport.active);
                    console.log('🏆 Active sports today:', activeSports.length);
                    
                    activeSports.slice(0, 5).forEach(sport => {
                        console.log(`  - ${sport.title} (${sport.key})`);
                    });
                    
                    return; // Success, exit
                } else {
                    const errorText = await response.text();
                    console.log('❌ Response body:', errorText);
                }
            } catch (fetchError) {
                console.log('❌ Fetch error:', fetchError.message);
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testOddsApiDirect();