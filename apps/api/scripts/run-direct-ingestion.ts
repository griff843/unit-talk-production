// Bypass env validation for this script
process.env.NODE_ENV = 'development';
process.env.LOG_LEVEL = 'info';
process.env.TEMPORAL_TASK_QUEUE = 'unit-talk-local';

import * as dotenv from 'dotenv';
dotenv.config();

import * as readline from 'readline';

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

async function fetchOptimalProps(apiKey: string, sport: string) {
  const baseUrl = 'https://api.optimal-bet.com';
  
  try {
    console.log(`\n📊 Fetching ${sport} props from Optimal API...`);
    
    const response = await axios.get(`${baseUrl}/v1/playerProps/${sport}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    return response.data;
  } catch (error: any) {
    console.error(`❌ Failed to fetch ${sport} props:`, error.response?.data || error.message);
    return null;
  }
}

async function runDirectIngestion() {
  console.log('🎯 Unit Talk - Direct Prop Ingestion from Optimal API\n');
  
  // Check for environment variables or prompt
  let supabaseUrl = process.env.SUPABASE_URL;
  let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let optimalApiKey = process.env.OPTIMAL_API_KEY;
  
  if (!supabaseUrl) {
    supabaseUrl = await question('Enter Supabase URL: ');
  }
  
  if (!supabaseKey) {
    supabaseKey = await question('Enter Supabase Service Role Key: ');
  }
  
  if (!optimalApiKey) {
    optimalApiKey = await question('Enter Optimal API Key: ');
  }
  
  console.log('\n✅ Credentials loaded');
  console.log(`📊 Connecting to Supabase...`);
  
  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Test connection
  const { error: testError } = await supabase.from('raw_props').select('id').limit(1);
  
  if (testError) {
    console.error('❌ Supabase connection failed:', testError.message);
    rl.close();
    process.exit(1);
  }
  
  console.log('✅ Supabase connection successful');
  
  // Fetch props for each sport
  const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
  let totalProps = 0;
  
  for (const sport of sports) {
    const propsData = await fetchOptimalProps(optimalApiKey, sport);
    
    if (propsData && propsData.props) {
      console.log(`✅ Found ${propsData.props.length} ${sport} props`);
      
      // Transform and insert props
      const transformedProps = propsData.props.map((prop: any) => ({
        external_id: `optimal_${prop.id}`,
        source: 'optimal',
        sport: sport,
        league: sport,
        game_id: prop.gameId || `${sport}_${new Date().toISOString().split('T')[0]}`,
        player_name: prop.playerName,
        player_id: prop.playerId?.toString() || null,
        team: prop.team || null,
        opponent: prop.opponent || null,
        market_type: prop.propType || prop.market,
        line: prop.line,
        odds: prop.odds || -110,
        sportsbook: prop.sportsbook || 'optimal',
        timestamp: new Date().toISOString(),
        is_active: true,
        metadata: {
          originalData: prop,
          fetchedAt: new Date().toISOString()
        }
      }));
      
      // Insert in batches
      const batchSize = 50;
      for (let i = 0; i < transformedProps.length; i += batchSize) {
        const batch = transformedProps.slice(i, i + batchSize);
        
        const { error: insertError } = await supabase
          .from('raw_props')
          .upsert(batch, { onConflict: 'external_id' });
        
        if (insertError) {
          console.error(`❌ Failed to insert batch:`, insertError.message);
        } else {
          console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(transformedProps.length/batchSize)}`);
        }
      }
      
      totalProps += transformedProps.length;
    }
  }
  
  console.log(`\n🎉 Ingestion complete! Total props inserted: ${totalProps}`);
  
  // Show sample of inserted props
  const { data: sampleProps } = await supabase
    .from('raw_props')
    .select('*')
    .eq('source', 'optimal')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (sampleProps && sampleProps.length > 0) {
    console.log('\n📊 Sample of inserted props:');
    sampleProps.forEach((prop, i) => {
      console.log(`\n${i + 1}. ${prop.player_name} - ${prop.market_type}`);
      console.log(`   ${prop.sport} | Line: ${prop.line} | Odds: ${prop.odds}`);
    });
  }
  
  rl.close();
  process.exit(0);
}

// Run the ingestion
runDirectIngestion().catch(error => {
  console.error('❌ Fatal error:', error);
  rl.close();
  process.exit(1);
});