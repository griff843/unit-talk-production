#!/usr/bin/env npx tsx
/**
 * INGEST PROPS TO DATABASE - FeedAgent Workflow
 * Properly persists SGO props to raw_props table using FeedAgent
 */

import { FeedAgent } from '../src/agents/FeedAgent';
import { loadBaseAgentDependencies } from '../src/agents/BaseAgent/loadDeps';
import { supabaseClient } from '../src/services/supabaseClient';

async function ingestPropsToDatabase() {
  console.log('🔄 INGESTING PROPS TO DATABASE - FEEDAGENT WORKFLOW');
  console.log('✅ Using actual FeedAgent class with database persistence');
  console.log('=' .repeat(80));

  try {
    // Load dependencies for the FeedAgent
    console.log('\n🔧 Loading FeedAgent dependencies...');
    const deps = await loadBaseAgentDependencies();

    // Create FeedAgent configuration with SGO provider
    const feedAgentConfig = {
      name: 'FeedAgent',
      version: '1.0.0',
      enabled: true,
      schedule: 'manual',
      logLevel: 'info',
      metrics: { enabled: true },
      health: { enabled: true },
      retry: {
        maxRetries: 3,
        backoffMs: 2000,
        maxBackoffMs: 5000,
      },
      feedConfig: {
        name: 'FeedAgent',
        enabled: true,
        version: '1.0.0',
        logLevel: 'info',
        metrics: { enabled: true },
        retryConfig: {
          maxRetries: 3,
          backoffMs: 1000,
          maxBackoffMs: 30000
        },
        providers: {
          sgo: {
            name: 'SportsGameOdds',
            enabled: true,
            apiKey: process.env.SGO_API_KEY,
            baseUrl: 'https://api.sportsgameodds.com/v1',
            rateLimit: { requestsPerMinute: 60 }
          }
        },
        dedupeConfig: {
          checkInterval: 300,
          ttlHours: 24
        }
      }
    };

    // Create and initialize FeedAgent
    console.log('🤖 Creating FeedAgent instance...');
    const feedAgent = new FeedAgent(feedAgentConfig, deps);

    // Check initial database state
    console.log('\n📊 Checking initial database state...');
    const { data: initialCount, error: countError } = await supabaseClient
      .from('raw_props')
      .select('id', { count: 'exact' })
      .gte('created_at', new Date().toISOString().split('T')[0]);

    if (countError) {
      console.error('❌ Database check failed:', countError);
      return;
    }

    const initialTotal = initialCount?.length || 0;
    console.log(`📋 Current raw_props today: ${initialTotal}`);

    // Run FeedAgent ingestion process
    console.log('\n🚀 Running FeedAgent ingestion workflow...');
    console.log('   - This will fetch props from SGO API');
    console.log('   - Apply unified data source routing');
    console.log('   - Process through HOT/WARM/COLD architecture');
    console.log('   - Persist to raw_props table with deduplication');

    await feedAgent.run();

    // Check final database state
    console.log('\n📊 Checking final database state...');
    const { data: finalCount, error: finalCountError } = await supabaseClient
      .from('raw_props')
      .select('id', { count: 'exact' })
      .gte('created_at', new Date().toISOString().split('T')[0]);

    if (finalCountError) {
      console.error('❌ Final database check failed:', finalCountError);
      return;
    }

    const finalTotal = finalCount?.length || 0;
    const newPropsIngested = finalTotal - initialTotal;

    console.log('\n🎉 FEEDAGENT INGESTION COMPLETE');
    console.log('=' .repeat(80));
    console.log(`📊 Results:`);
    console.log(`   - Initial props today: ${initialTotal}`);
    console.log(`   - Final props today: ${finalTotal}`);
    console.log(`   - New props ingested: ${newPropsIngested}`);
    console.log(`✅ Status: ${newPropsIngested > 0 ? 'SUCCESS - Props persisted to database' : 'NO NEW PROPS (likely duplicates)'}`);

    // Verify some sample data
    if (newPropsIngested > 0) {
      console.log('\n🔍 Sample of newly ingested props:');
      const { data: sampleProps } = await supabaseClient
        .from('raw_props')
        .select('player_name, stat_type, line, over_odds, under_odds, sport')
        .gte('created_at', new Date().toISOString().split('T')[0])
        .order('created_at', { ascending: false })
        .limit(5);

      sampleProps?.forEach((prop, i) => {
        console.log(`   ${i+1}. ${prop.player_name} - ${prop.stat_type} ${prop.line} (${prop.sport})`);
        console.log(`      Over: ${prop.over_odds}, Under: ${prop.under_odds}`);
      });
    }

    console.log('\n✅ FeedAgent ingestion workflow completed successfully!');
    console.log('📋 Props are now available in raw_props table for ScoringAgent processing');

  } catch (error) {
    console.error('❌ FeedAgent ingestion failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  ingestPropsToDatabase().catch(console.error);
}

export { ingestPropsToDatabase };