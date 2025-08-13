#!/usr/bin/env tsx

/**
 * Process all high-tier props into unified_picks with proper constraint handling
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../utils/getEnv';

const logger = {
  info: (...args: any[]) => console.log('[INFO ]', ...args),
  warn: (...args: any[]) => console.log('[WARN ]', ...args),
  error: (...args: any[]) => console.log('[ERROR]', ...args),
};

async function processAllHighTierProps() {
  try {
    const env = getEnv();
    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );

    logger.info('🏆 Processing ALL high-tier props into unified_picks...');

    // Get all high-tier props that haven't been promoted
    const { data: highTierProps, error: propsError } = await supabase
      .from('raw_props')
      .select('id, player_name, stat_type, sport, tier, confidence, edge_score, promoted_to_picks, over_odds, under_odds, line, created_at')
      .in('tier', ['S', 'A'])  // High-tier props only
      .or('promoted_to_picks.is.null,promoted_to_picks.eq.false')  // Not yet promoted
      .order('tier', { ascending: true }) // S-tier first, then A-tier
      .order('edge_score', { ascending: false }); // Highest edge scores first

    if (propsError) {
      logger.error('Error fetching high-tier props:', propsError);
      return;
    }

    logger.info(`🎯 Found ${highTierProps?.length || 0} high-tier props to process`);

    if (!highTierProps || highTierProps.length === 0) {
      logger.info('No high-tier props found to process');
      return;
    }

    // Get system user
    const { data: users } = await supabase
      .from('users')
      .select('id, username')
      .limit(1);

    if (!users || users.length === 0) {
      logger.error('❌ No users found in database');
      return;
    }

    const systemUser = users[0];
    logger.info(`👤 Using system user: ${systemUser.username} (${systemUser.id})`);

    // Process in batches to avoid overwhelming the system
    const BATCH_SIZE = 25;
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < highTierProps.length; i += BATCH_SIZE) {
      const batch = highTierProps.slice(i, i + BATCH_SIZE);
      logger.info(`📦 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(highTierProps.length/BATCH_SIZE)} (${batch.length} props)...`);

      for (const prop of batch) {
        try {
          // Create proper selection text
          const selection = `${prop.player_name} ${prop.stat_type}`;
          
          // Use proper confidence value - handle constraint violation
          // The constraint likely expects confidence to be between 0 and 100
          let confidenceValue = prop.confidence;
          if (confidenceValue === 0 || confidenceValue === 1) {
            // Convert boolean-like confidence to percentage
            confidenceValue = confidenceValue === 1 ? 85 : 25; // High vs low confidence
          }
          
          // Ensure confidence is within valid range
          confidenceValue = Math.max(1, Math.min(100, confidenceValue || 75));

          // Calculate proper odds and payout
          const odds = prop.over_odds || prop.under_odds || -110;
          const stake = 100;
          const decimalOdds = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
          const potentialPayout = stake * decimalOdds;

          const { data: newPick, error: insertError } = await supabase
            .from('unified_picks')
            .insert({
              user_id: systemUser.id,
              pick_type: 'single',
              selection: selection,
              odds: odds,
              stake: stake,
              potential_payout: Math.round(potentialPayout * 100) / 100, // Round to 2 decimals
              sport: prop.sport,
              confidence: confidenceValue,
              tier_when_placed: prop.tier,
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (insertError) {
            logger.error(`❌ Failed to create pick for ${prop.player_name} ${prop.stat_type}:`, {
              error: insertError.message,
              confidence: confidenceValue,
              tier: prop.tier
            });
            errorCount++;
          } else {
            logger.info(`✅ Created ${prop.tier}-tier pick: ${selection} (confidence: ${confidenceValue})`);
            successCount++;

            // Mark prop as promoted
            await supabase
              .from('raw_props')
              .update({ 
                promoted_to_picks: true,
                promoted_at: new Date().toISOString(),
                processed_at: new Date().toISOString()
              })
              .eq('id', prop.id);
          }

          processedCount++;
        } catch (error) {
          logger.error(`❌ Error processing prop ${prop.id}:`, error);
          errorCount++;
          processedCount++;
        }
      }

      // Brief pause between batches
      if (i + BATCH_SIZE < highTierProps.length) {
        logger.info('⏳ Pausing 1 second between batches...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Final results
    const { count: totalUnifiedPicks } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true });

    logger.info('\n' + '='.repeat(60));
    logger.info('🏆 HIGH-TIER PROPS PROCESSING COMPLETE');
    logger.info('='.repeat(60));
    logger.info(`📊 Total processed: ${processedCount}`);
    logger.info(`✅ Successfully created: ${successCount} picks`);
    logger.info(`❌ Errors: ${errorCount}`);
    logger.info(`📈 Total unified_picks in database: ${totalUnifiedPicks}`);
    logger.info(`🎯 Success rate: ${Math.round((successCount/processedCount)*100)}%`);

    // Show sample of what was created
    const { data: sampleResults } = await supabase
      .from('unified_picks')
      .select('selection, sport, confidence, tier_when_placed, odds, potential_payout')
      .order('created_at', { ascending: false })
      .limit(10);

    if (sampleResults && sampleResults.length > 0) {
      logger.info('\n📋 Sample created picks:');
      console.table(sampleResults);
    }

    // Show tier breakdown
    const { data: tierBreakdown } = await supabase
      .from('unified_picks')
      .select('tier_when_placed')
      .not('tier_when_placed', 'is', null);

    if (tierBreakdown) {
      const tierCounts = tierBreakdown.reduce((acc: any, pick: any) => {
        acc[pick.tier_when_placed] = (acc[pick.tier_when_placed] || 0) + 1;
        return acc;
      }, {});

      logger.info('\n🏅 Tier breakdown of created picks:');
      Object.entries(tierCounts).forEach(([tier, count]) => {
        logger.info(`   ${tier}-tier: ${count} picks`);
      });
    }

  } catch (error) {
    logger.error('❌ Processing failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  processAllHighTierProps()
    .then(() => {
      console.log('\n✅ All high-tier props processing completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Processing failed:', error);
      process.exit(1);
    });
}