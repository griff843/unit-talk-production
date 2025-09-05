require('dotenv').config();

async function testOptimalAPI() {
    console.log('🔍 Testing Optimal API Integration...\n');
    
    // Check environment variables
    const optimalApiKey = process.env.OPTIMAL_API_KEY;
    
    if (!optimalApiKey) {
        console.error('❌ OPTIMAL_API_KEY not found in environment');
        console.log('Available environment variables starting with OPTIMAL:', 
            Object.keys(process.env).filter(key => key.startsWith('OPTIMAL')));
        return;
    }
    
    console.log('✅ OPTIMAL_API_KEY loaded:', optimalApiKey.substring(0, 20) + '...');
    
    try {
        // Test API connectivity
        console.log('📡 Testing Optimal API connectivity...');
        
        const response = await fetch('https://api.optimalbet.com/api/v1/events', {
            headers: {
                'Authorization': `Bearer ${optimalApiKey}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Unit-Talk-Production/1.0.0'
            }
        });
        
        if (!response.ok) {
            console.error('❌ Optimal API request failed:', response.status, response.statusText);
            const text = await response.text();
            console.log('Response body:', text);
            return;
        }
        
        const data = await response.json();
        console.log('✅ Optimal API connection successful');
        console.log('📊 Response data type:', typeof data);
        console.log('📊 Events found:', Array.isArray(data) ? data.length : 'Not an array');
        
        if (Array.isArray(data) && data.length > 0) {
            console.log('Sample event:', JSON.stringify(data[0], null, 2));
        }
        
    } catch (error) {
        console.error('❌ Optimal API test failed:', error.message);
    }
}

testOptimalAPI();