import 'dotenv/config';
import * as readline from 'readline';

import { createClient } from '@supabase/supabase-js';

import { BaseAgentConfig } from '../src/agents/BaseAgent/types';
import { IngestionAgent } from '../src/agents/IngestionAgent';
import { logger } from '../src/utils/logger';

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

async function runIngestion() {
  console.log('🎯 Unit Talk - Prop Ingestion from Optimal API\n');
  
  // Check for environment variables
  let supabaseUrl = process.env.SUPABASE_URL;
  let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let optimalApiKey = process.env.OPTIMAL_API_KEY;
  
  // Prompt for missing credentials
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
  console.log(`📊 Supabase URL: ${supabaseUrl}`);
  console.log(`🔑 Optimal API Key: ${optimalApiKey.substring(0, 8)}...`);
  
  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Test Supabase connection
  console.log('\n🔄 Testing Supabase connection...');
  const { data, error } = await supabase.from('raw_props').select('count').limit(1);
  
  if (error) {
    console.error('❌ Supabase connection failed:', error.message);
    rl.close();
    process.exit(1);
  }
  
  console.log('✅ Supabase connection successful');
  
  // Configure IngestionAgent
  const ingestionConfig: BaseAgentConfig & any = {
    name: 'IngestionAgent-Optimal',
    version: '1.0.0',
    enabled: true,
    logLevel: 'info',
    metrics: {
      enabled: true,
      interval: 60
    },
    providers: [
      {
        name: 'Optimal',
        enabled: true,
        apiKey: optimalApiKey,
        baseUrl: 'https://api.optimal-bet.com',
        rateLimit: {
          maxRequests: 900,
          windowMs: 3600000
        },
        sports: ['NFL', 'NBA', 'MLB', 'NHL'],
        propTypes: ['points', 'rebounds', 'assists', 'passing_yards', 'rushing_yards', 'receiving_yards']
      }
    ],
    batchSize: 50,
    dedupeEnabled: true,
    scheduleInterval: 300 // 5 minutes
  };
  
  // Create agent dependencies
  const dependencies = {
    supabase,
    logger,
    errorHandler: {
      handleError: (error: Error) => logger.error('Error:', error),
      wrapAsync: <T>(fn: () => Promise<T>) => fn()
    }
  };
  
  // Initialize and run the agent
  const agent = new IngestionAgent(ingestionConfig, dependencies);
  
  console.log('\n🚀 Starting ingestion from Optimal API...');
  console.log('📋 Sports: NFL, NBA, MLB, NHL');
  console.log('📊 This will fetch current props and store them in the raw_props table\n');
  
  try {
    // Initialize the agent
    await agent.start();
    
    // Run one cycle
    console.log('⏳ Running ingestion cycle...');
    
    // Wait for the cycle to complete (give it 30 seconds)
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Check results
    const { data: newProps, error: countError } = await supabase
      .from('raw_props')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (!countError && newProps) {
      console.log(`\n✅ Ingestion complete! Found ${newProps.length} recent props`);
      console.log('\n📊 Sample props:');
      newProps.slice(0, 3).forEach((prop, i) => {
        console.log(`\n${i + 1}. ${prop.player_name} - ${prop.market_type}`);
        console.log(`   Sport: ${prop.sport}, League: ${prop.league}`);
        console.log(`   Line: ${prop.line}, Odds: ${prop.odds}`);
        console.log(`   Sportsbook: ${prop.sportsbook}`);
      });
    }
    
    // Stop the agent
    await agent.stop();
    
  } catch (error) {
    console.error('❌ Ingestion failed:', error);
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Run the ingestion
runIngestion().catch(console.error);