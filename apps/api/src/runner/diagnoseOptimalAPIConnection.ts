/**
 * Diagnose Optimal API Connection
 * Test the actual API connection and see what data we're receiving
 */

import axios from 'axios';
// Load environment variables from root directory
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function diagnoseOptimalAPI() {
  console.log('🔍 DIAGNOSING OPTIMAL API CONNECTION');
  console.log('='.repeat(60));
  
  const apiKey = process.env.OPTIMAL_API_KEY;
  
  if (!apiKey) {
    console.log('❌ OPTIMAL_API_KEY not found in environment variables');
    console.log('Available env vars:', Object.keys(process.env).filter(key => key.includes('API')));
    return;
  }
  
  console.log('✅ API Key found:', `${apiKey.substring(0, 10)}...`);
  
  const baseUrl = 'https://api.optimal-bet.com';
  
  // Test different endpoints
  const endpoints = [
    '/v1/playerPropTypes',
    '/v1/playerProps/MLB',  
    '/v1/playerProps/NFL',
    '/v1/events',
    '/v1/gamelines/MLB'
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\n🔍 Testing endpoint: ${endpoint}`);
    console.log('-'.repeat(40));
    
    try {
      const response = await axios.get(`${baseUrl}${endpoint}`, {
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 10000
      });
      
      console.log(`✅ Status: ${response.status}`);
      console.log(`📊 Response size: ${JSON.stringify(response.data).length} bytes`);
      
      if (Array.isArray(response.data)) {
        console.log(`📋 Array length: ${response.data.length}`);
        
        if (response.data.length > 0) {
          console.log('📖 Sample data structure:');
          const sample = response.data[0];
          console.log('   Available fields:', Object.keys(sample).sort());
          
          // Check for odds-related fields
          const oddsFields = Object.keys(sample).filter(key => 
            key.includes('odd') || 
            key.includes('over') || 
            key.includes('under') || 
            key.includes('price') ||
            key.includes('line')
          );
          
          if (oddsFields.length > 0) {
            console.log('   🎯 Odds-related fields:', oddsFields);
            oddsFields.forEach(field => {
              console.log(`      ${field}: ${sample[field]} (${typeof sample[field]})`);
            });
          } else {
            console.log('   ❌ No odds-related fields found');
          }
          
          console.log('   📋 Sample record:');
          console.log('  ', JSON.stringify(sample, null, 2).substring(0, 500) + '...');
        }
      } else {
        console.log('📖 Response data:');
        console.log(JSON.stringify(response.data, null, 2).substring(0, 500) + '...');
      }
      
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Status Text: ${error.response.statusText}`);
        console.log(`   Response Data:`, error.response.data);
      }
    }
  }
  
  // Test a few more specific endpoints that might have different data
  console.log('\n🔍 Testing specific sport endpoints...');
  const specificEndpoints = [
    '/v1/props/MLB',
    '/v1/odds/MLB', 
    '/v1/sportsbooks',
    '/v1/sports'
  ];
  
  for (const endpoint of specificEndpoints) {
    console.log(`\n🎯 Testing: ${endpoint}`);
    try {
      const response = await axios.get(`${baseUrl}${endpoint}`, {
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 5000
      });
      
      console.log(`✅ ${endpoint}: ${response.status} - ${Array.isArray(response.data) ? response.data.length + ' items' : 'object'}`);
      
    } catch (error: any) {
      console.log(`❌ ${endpoint}: ${error.response?.status || 'Network Error'} - ${error.message}`);
    }
  }
}

diagnoseOptimalAPI().then(() => {
  console.log('\n✅ OPTIMAL API DIAGNOSIS COMPLETE');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Diagnosis failed:', error);
  process.exit(1);
});