/**
 * Run Feed Agent Now
 * 
 * Fetches today's props from APIs and stores them in the database
 */

import { createLogger } from '../utils/logger';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const logger = createLogger('RunFeedAgentNow');
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Import FeedAgent services directly
import { OddsApiClient } from '../agents/FeedAgent/oddsApi';
import { OptimalClient } from '../agents/FeedAgent/optimal';

async function runFeedAgent() {
  console.log('🚀 RUNNING FEED AGENT TO FETCH TODAY\'S PROPS');
  console.log('='.repeat(60));
  
  try {
    // Check current data
    const { count: existingCount } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date().toISOString().split('T')[0] + 'T00:00:00Z');
    
    console.log(`📊 Existing props for today: ${existingCount || 0}`);
    
    // Initialize feed clients
    console.log('\n📡 Initializing Feed Clients...');
    
    if (process.env.OPTIMAL_API_KEY) {
      console.log('✅ Optimal API Key found');
      const optimalClient = new OptimalClient(process.env.OPTIMAL_API_KEY);
      
      console.log('🔄 Fetching from Optimal API...');
      try {
        const optimalProps = await optimalClient.fetchOptimalProps('nfl'); // Fetch NFL props as example
        console.log(`✅ Fetched ${optimalProps.length} props from Optimal`);
        
        // Store props
        if (optimalProps.length > 0) {
          const { error } = await supabase
            .from('raw_props')
            .insert(optimalProps);
          
          if (error) {
            console.error('Error storing Optimal props:', error);
          } else {
            console.log(`✅ Stored ${optimalProps.length} Optimal props`);
          }
        }
      } catch (error) {
        console.error('Optimal API error:', error);
      }
    } else {
      console.log('⚠️ No Optimal API key found');
    }
    
    if (process.env.ODDS_API_KEY) {
      console.log('\n✅ Odds API Key found');
      const oddsApiClient = new OddsApiClient(process.env.ODDS_API_KEY);
      
      console.log('🔄 Fetching from Odds API...');
      try {
        const sports = ['americanfootball_nfl', 'basketball_nba', 'baseball_mlb', 'icehockey_nhl'];
        let totalOddsProps = 0;
        
        for (const sport of sports) {
          const props = await oddsApiClient.fetchOddsApiProps(sport as any, ['h2h', 'spreads', 'totals']); // Use correct method
          if (props.length > 0) {
            const { error } = await supabase
              .from('raw_props')
              .insert(props);
            
            if (!error) {
              console.log(`✅ Stored ${props.length} ${sport} props`);
              totalOddsProps += props.length;
            }
          }
        }
        
        console.log(`✅ Total Odds API props: ${totalOddsProps}`);
      } catch (error) {
        console.error('Odds API error:', error);
      }
    } else {
      console.log('⚠️ No Odds API key found');
    }
    
    // Get final count
    const { count: finalCount } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date().toISOString().split('T')[0] + 'T00:00:00Z');
    
    console.log('\n📊 FEED AGENT RESULTS:');
    console.log(`• Props before: ${existingCount || 0}`);
    console.log(`• Props after: ${finalCount || 0}`);
    console.log(`• New props added: ${(finalCount || 0) - (existingCount || 0)}`);
    
    // Show sample props
    const { data: sampleProps } = await supabase
      .from('raw_props')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (sampleProps && sampleProps.length > 0) {
      console.log('\n📋 Sample Props:');
      sampleProps.forEach((prop, i) => {
        console.log(`${i + 1}. ${prop.player_name || prop.team_name} ${prop.stat_type} ${prop.line} (${prop.sport})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Feed Agent Error:', error);
    throw error;
  }
}

// Run the professional processor after feed agent
async function runProfessionalProcessing() {
  console.log('\n💎 RUNNING PROFESSIONAL PROCESSING...');
  console.log('─'.repeat(60));
  
  try {
    const { professionalPropProcessor } = await import('../services/ProfessionalPropProcessor');
    
    const results = await professionalPropProcessor.processRawProps({
      max_batch_size: 50,
      auto_approve_threshold: 3.0
    });
    
    console.log(`✅ Professionally processed ${results.length} props`);
    console.log(`• CLV Tracked: ${results.filter(r => r.clv_tracking_id).length}`);
    console.log(`• Auto-Approved: ${results.filter(r => r.published).length}`);
    console.log(`• Average Score: ${results.reduce((sum, r) => sum + r.professionalScore, 0) / results.length || 0}`);
    
  } catch (error) {
    console.error('❌ Professional Processing Error:', error);
  }
}

async function main() {
  try {
    // Step 1: Run Feed Agent
    await runFeedAgent();
    
    // Step 2: Run Professional Processing
    await runProfessionalProcessing();
    
    console.log('\n✅ COMPLETE E2E PROCESSING FINISHED');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}