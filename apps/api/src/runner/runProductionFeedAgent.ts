/**
 * Run Production FeedAgent - Populate ALL data with fixed Optimal integration
 * Clear broken data and repopulate with working odds
 */

import { randomUUID } from 'crypto';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

import { FeedAgent } from '../agents/FeedAgent';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function runProductionFeedAgent() {
  console.log('🚀 RUNNING PRODUCTION FEEDAGENT');
  console.log('='.repeat(50));

  const today = '2025-08-05';

  try {
    // Step 1: Clear old broken props data
    console.log('🧹 CLEARING OLD BROKEN PROPS DATA...');
    const { count: oldPropsCount } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .eq('game_date', today);

    console.log(`Found ${oldPropsCount || 0} existing props for today`);

    // Delete props with NULL odds (the broken ones)
    const { count: deletedCount } = await supabase
      .from('raw_props')
      .delete({ count: 'exact' })
      .eq('game_date', today)
      .or('over_odds.is.null,under_odds.is.null,over_odds.eq.0,under_odds.eq.0');

    console.log(`✅ Cleared ${deletedCount || 0} broken props with NULL/zero odds`);

    // Step 2: Create production FeedAgent
    console.log('\n🔧 CREATING PRODUCTION FEEDAGENT...');
    const config = {
      name: 'FeedAgent-Production',
      enabled: true,
      version: '1.0.0',
      logLevel: 'info',
      providers: {
        optimal: {
          name: 'Optimal',
          enabled: true,
          priority: 1,
        },
      },
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
          log: (level: string, message: string, ctx?: Record<string, unknown>) =>
            console.log(`[FeedAgent ${level}]`, message, ctx),
          setLevel: (level: string) => {},
          activity: (activityId: string, status: string, ctx?: Record<string, unknown>) =>
            console.log(`[FeedAgent Activity]`, activityId, status, ctx),
          child: (childContext?: Record<string, unknown>) => ({
            info: (...args: any[]) => console.log('[FeedAgent]', context, childContext, ...args),
            warn: (...args: any[]) => console.warn('[FeedAgent]', context, childContext, ...args),
            error: (...args: any[]) => console.error('[FeedAgent]', context, childContext, ...args),
            debug: (...args: any[]) =>
              console.log('[FeedAgent DEBUG]', context, childContext, ...args),
            log: (level: string, message: string, ctx?: Record<string, unknown>) =>
              console.log(`[FeedAgent ${level}]`, message, ctx),
            setLevel: (level: string) => {},
            activity: (activityId: string, status: string, ctx?: Record<string, unknown>) =>
              console.log(`[FeedAgent Activity]`, activityId, status, ctx),
            child: () => this,
          }),
        }),
        log: (level: string, message: string, ctx?: Record<string, unknown>) =>
          console.log(`[FeedAgent ${level}]`, message, ctx),
        setLevel: (level: string) => {},
        activity: (activityId: string, status: string, ctx?: Record<string, unknown>) =>
          console.log(`[FeedAgent Activity]`, activityId, status, ctx),
      },
    };

    const feedAgent = new FeedAgent(config, dependencies);

    // Health check
    const health = await feedAgent.checkHealth();
    console.log(`Agent health: ${health.status}`);

    if (health.status !== 'healthy') {
      throw new Error(`FeedAgent not healthy: ${JSON.stringify(health.details)}`);
    }

    // Step 3: Fetch ALL props with fixed integration
    console.log('\n⚡ FETCHING ALL PROPS WITH FIXED INTEGRATION...');
    const { fetchUnifiedData } = await import('../agents/FeedAgent/dataSourceRouter');

    // Fetch props for both MLB and WNBA
    const sports = ['MLB', 'WNBA'];
    let totalFetched = 0;
    let totalInserted = 0;

    for (const sport of sports) {
      console.log(`\n📡 Processing ${sport} props...`);

      const result = await fetchUnifiedData({
        sport,
        marketType: 'player-props',
        date: today,
      });

      console.log(`${sport}: Fetched ${result.data.length} props from ${result.source}`);
      totalFetched += result.data.length;

      if (result.data.length === 0) {
        console.log(`⚠️  No props for ${sport} - skipping`);
        continue;
      }

      // Verify odds quality
      const propsWithOdds = result.data.filter(
        prop => prop.over_odds && prop.under_odds && prop.over_odds !== 0 && prop.under_odds !== 0
      );

      const oddsQuality = (propsWithOdds.length / result.data.length) * 100;
      console.log(`${sport} odds quality: ${oddsQuality.toFixed(1)}%`);

      if (oddsQuality < 95) {
        console.log(`⚠️  ${sport} odds quality below 95% - investigating...`);
      }

      // Insert ALL props with proper format
      console.log(`💾 Inserting ${propsWithOdds.length} ${sport} props...`);

      const batchSize = 500; // Insert in batches
      for (let i = 0; i < propsWithOdds.length; i += batchSize) {
        const batch = propsWithOdds.slice(i, i + batchSize);

        const propsToInsert = batch.map(prop => ({
          id: randomUUID(),
          external_game_id: prop.external_game_id,
          game_id: null,
          player_name: prop.player_name,
          team: prop.team,
          stat_type: prop.stat_type,
          line: prop.line,
          over_odds: prop.over_odds,
          under_odds: prop.under_odds,
          provider: 'FeedAgent-Production',
          game_time: prop.game_time || new Date().toISOString(),
          scraped_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          game_date: today,
          sport: prop.sport,
          sport_key: prop.sport_key,
          matchup: prop.matchup,
          opponent: prop.opponent,
          source: 'production-feedagent',

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
          is_promoted: false,
        }));

        const { data: insertedBatch, error } = await supabase
          .from('raw_props')
          .insert(propsToInsert)
          .select('id');

        if (error) {
          console.error(`❌ Batch insert failed for ${sport}:`, error.message);
          throw error;
        }

        totalInserted += insertedBatch?.length || 0;
        console.log(
          `   Inserted batch ${Math.floor(i / batchSize) + 1}: ${insertedBatch?.length || 0} props`
        );
      }
    }

    console.log(`\n✅ PRODUCTION DATA POPULATION COMPLETE`);
    console.log(`📊 Total fetched: ${totalFetched} props`);
    console.log(`💾 Total inserted: ${totalInserted} props`);

    // Step 4: Final verification
    console.log('\n🔍 FINAL VERIFICATION...');

    const { count: finalPropsWithOdds } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .eq('game_date', today)
      .not('over_odds', 'is', null)
      .not('under_odds', 'is', null)
      .neq('over_odds', 0)
      .neq('under_odds', 0);

    const { count: finalTotalProps } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .eq('game_date', today);

    const { count: gamesCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('game_date', today);

    const finalOddsQuality =
      finalTotalProps && finalPropsWithOdds
        ? ((finalPropsWithOdds / finalTotalProps) * 100).toFixed(1)
        : '0.0';

    console.log(
      `✅ Final props with odds: ${finalPropsWithOdds || 0}/${finalTotalProps || 0} (${finalOddsQuality}%)`
    );
    console.log(`✅ Games available: ${gamesCount || 0}`);

    const success = (finalPropsWithOdds || 0) >= 1000 && parseFloat(finalOddsQuality) >= 95;

    if (success) {
      console.log('\n🎉 PRODUCTION FEEDAGENT SUCCESS!');
      console.log('✨ Database now has complete odds data');
      console.log('🚀 Ready for grading system');
    } else {
      console.log('\n❌ PRODUCTION FEEDAGENT ISSUES');
      console.log(`⚠️  Need 1000+ props with 95%+ odds quality`);
      console.log(`⚠️  Got ${finalPropsWithOdds || 0} props with ${finalOddsQuality}% quality`);
    }

    return success;
  } catch (error) {
    console.error('❌ Production FeedAgent failed:', error);
    throw error;
  }
}

runProductionFeedAgent()
  .then(success => {
    console.log(`\n${success ? '🎉 READY FOR GRADING SYSTEM' : '❌ STILL HAVE ISSUES'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Production FeedAgent failed:', error);
    process.exit(1);
  });
