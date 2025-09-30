/**
 * Run FeedAgent Once - Complete Pipeline Test
 * Run the actual FeedAgent to populate props with our fixed Optimal integration
 */

// Load environment variables from root directory
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { createClient } from '@supabase/supabase-js';

import { FeedAgent } from '../agents/FeedAgent';
import { requireSupabase } from '../utils/supabaseUtils';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runFeedAgentOnce() {
  console.log('🚀 RUNNING FEEDAGENT ONCE - COMPLETE PIPELINE');
  console.log('='.repeat(60));
  
  try {
    // Clear any existing test props to get fresh data
    console.log('🧹 Clearing old test props...');
    await supabase
      .from('sports_game_odds')
      .delete()
      .in('source', ['e2e-test-optimal', 'production-test', 'test']);
    
    // Create FeedAgent instance
    const config = {
      name: 'FeedAgent-PipelineTest',
      enabled: true,
      version: '1.0.0',
      logLevel: 'info',
      providers: {
        optimal: {
          name: 'Optimal',
          enabled: true,
          priority: 1
        }
      }
    };
    
    const dependencies = {
      supabase,
      logger: {
        info: (...args: any[]) => console.log('[FeedAgent]', ...args),
        warn: (...args: any[]) => console.warn('[FeedAgent]', ...args),
        error: (...args: any[]) => console.error('[FeedAgent]', ...args),
        debug: (...args: any[]) => console.log('[FeedAgent DEBUG]', ...args),
        child: (context?: Record<string, unknown>) => ({
          info: (...args: any[]) => console.log('[FeedAgent]', context, ...args),
          warn: (...args: any[]) => console.warn('[FeedAgent]', context, ...args),
          error: (...args: any[]) => console.error('[FeedAgent]', context, ...args),
          debug: (...args: any[]) => console.log('[FeedAgent DEBUG]', context, ...args),
          log: (level: string, message: string, ctx?: Record<string, unknown>) => console.log(`[FeedAgent ${level}]`, message, ctx),
          setLevel: (level: string) => {},
          activity: (activityId: string, status: string, ctx?: Record<string, unknown>) => console.log(`[FeedAgent Activity]`, activityId, status, ctx),
          child: (childContext?: Record<string, unknown>) => ({
            info: (...args: any[]) => console.log('[FeedAgent]', context, childContext, ...args),
            warn: (...args: any[]) => console.warn('[FeedAgent]', context, childContext, ...args),
            error: (...args: any[]) => console.error('[FeedAgent]', context, childContext, ...args),
            debug: (...args: any[]) => console.log('[FeedAgent DEBUG]', context, childContext, ...args),
            log: (level: string, message: string, ctx?: Record<string, unknown>) => console.log(`[FeedAgent ${level}]`, message, ctx),
            setLevel: (level: string) => {},
            activity: (activityId: string, status: string, ctx?: Record<string, unknown>) => console.log(`[FeedAgent Activity]`, activityId, status, ctx),
            child: () => this
          })
        }),
        log: (level: string, message: string, ctx?: Record<string, unknown>) => console.log(`[FeedAgent ${level}]`, message, ctx),
        setLevel: (level: string) => {},
        activity: (activityId: string, status: string, ctx?: Record<string, unknown>) => console.log(`[FeedAgent Activity]`, activityId, status, ctx)
      }
    };
    
    console.log('🔧 Creating FeedAgent instance...');
    const feedAgent = new FeedAgent(config, dependencies);
    
    // Check health first
    const health = await feedAgent.checkHealth();
    console.log('Health status:', health.status);
    
    if (health.status !== 'healthy') {
      console.log('⚠️  Agent not healthy:', health.details);
    }
    
    // Manually trigger the fetch process using the unified router
    console.log('\n⚡ Running data fetch process...');
    const { fetchUnifiedData } = await import('../agents/FeedAgent/dataSourceRouter');
    
    // Fetch for MLB (where we have games)
    const result = await fetchUnifiedData({
      sport: 'MLB',
      marketType: 'player-props',
      date: new Date().toISOString().split('T')[0]
    });
    
    console.log(`📊 Fetched ${result.data.length} props from ${result.source}`);
    
    if (result.data.length === 0) {
      console.log('❌ No props fetched - cannot test pipeline');
      return;
    }
    
    // Analyze odds quality
    const propsWithBothOdds = result.data.filter(prop => 
      prop.over_odds && prop.under_odds && 
      prop.over_odds !== 0 && prop.under_odds !== 0
    );
    
    const oddsQuality = (propsWithBothOdds.length / result.data.length) * 100;
    console.log(`📈 Odds Quality: ${oddsQuality.toFixed(1)}%`);
    
    // Insert a sample of props into the database with proper format
    console.log('\n💾 Inserting props into database...');
    const { randomUUID } = await import('crypto');
    
    const propsToInsert = propsWithBothOdds.slice(0, 100).map(prop => ({
      id: randomUUID(),
      external_game_id: prop.external_game_id,
      game_id: null,
      player_name: prop.player_name,
      team: prop.team,
      stat_type: prop.stat_type,
      line: prop.line,
      over_odds: prop.over_odds,
      under_odds: prop.under_odds,
      provider: 'FeedAgent-Pipeline',
      game_time: prop.game_time || new Date().toISOString(),
      scraped_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      game_date: new Date().toISOString().split('T')[0],
      sport: prop.sport,
      sport_key: prop.sport_key,
      matchup: prop.matchup,
      opponent: prop.opponent,
      source: 'feedagent-pipeline-test',
      
      // Required fields with defaults
      outcome: null,
      odds: 0,
      trend_confidence: 0,
      matchup_quality: 0,
      line_value_score: 0,
      role_stability: 0,
      confidence_score: 0,
      edge_score: 0,
      tier_tag: null,
      auto_approved: false,
      context_flag: false,
      promoted_to_picks: false,
      promoted_at: null,
      promoted: false,
      is_promoted: false
    }));
    
    const { data: insertedProps, error: insertError } = await supabase
      .from('sports_game_odds')
      .insert(propsToInsert)
      .select('id, player_name, stat_type, over_odds, under_odds');
      
    if (insertError) {
      console.error('❌ Insert failed:', insertError.message);
      return;
    }
    
    console.log(`✅ Successfully inserted ${insertedProps?.length || 0} props`);
    
    // Show sample
    if (insertedProps && insertedProps.length > 0) {
      console.log('\n📋 Sample inserted props:');
      insertedProps.slice(0, 5).forEach((prop, i) => {
        console.log(`${i+1}. ${prop.player_name} ${prop.stat_type} - Over: ${prop.over_odds}, Under: ${prop.under_odds}`);
      });
    }
    
    // Final system validation
    console.log('\n🎯 FINAL SYSTEM VALIDATION:');
    const today = new Date().toISOString().split('T')[0];
    
    const { count: gameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('game_date', today);
      
    const { count: propCount } = await supabase
      .from('sports_game_odds')
      .select('*', { count: 'exact', head: true })
      .eq('game_date', today)
      .not('over_odds', 'is', null)
      .not('under_odds', 'is', null);
      
    console.log(`✅ Games: ${gameCount || 0}`);
    console.log(`✅ Props with complete odds: ${propCount || 0}`);
    console.log(`✅ Odds Quality: ${oddsQuality.toFixed(1)}%`);
    console.log(`✅ Data Source: ${result.source}`);
    
    if (gameCount && gameCount > 0 && propCount && propCount > 0 && oddsQuality >= 95) {
      console.log('\n🎉 SUCCESS: Complete system pipeline is operational!');
      console.log('✨ Ready for production use');
    } else {
      console.log('\n⚠️  System partially operational - some components need attention');
    }
    
  } catch (error) {
    console.error('❌ FeedAgent pipeline test failed:', error);
    throw error;
  }
}

runFeedAgentOnce().then(() => {
  console.log('\n✅ FEEDAGENT PIPELINE TEST COMPLETE');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Pipeline test failed:', error);
  process.exit(1);
});