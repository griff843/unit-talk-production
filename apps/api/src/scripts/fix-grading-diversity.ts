#!/usr/bin/env tsx

/**
 * Fix grading system - replace hardcoded values with proper professional grading
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../utils/getEnv';
import { ProfessionalPropProcessor } from '../services/ProfessionalPropProcessor';

const logger = {
  info: (...args: any[]) => console.log('[INFO ]', ...args),
  warn: (...args: any[]) => console.log('[WARN ]', ...args),
  error: (...args: any[]) => console.log('[ERROR]', ...args),
  success: (...args: any[]) => console.log('[✅  ]', ...args),
};

async function fixGradingDiversity() {
  try {
    const env = getEnv();
    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );

    logger.info('🔧 FIXING GRADING SYSTEM - REMOVING HARDCODED VALUES');
    logger.info('=' .repeat(60));

    // Step 1: Check current unified_picks for hardcoded patterns
    logger.info('📊 Analyzing current unified_picks for hardcoded patterns...');
    
    const { data: currentPicks } = await supabase
      .from('unified_picks')
      .select('id, odds, stake, confidence, selection, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (currentPicks && currentPicks.length > 0) {
      const uniqueOdds = [...new Set(currentPicks.map(p => p.odds))];
      const uniqueStakes = [...new Set(currentPicks.map(p => p.stake))];
      const uniqueConf = [...new Set(currentPicks.map(p => p.confidence))];

      logger.info(`🔍 Current diversity analysis:`);
      logger.info(`   Unique odds: ${uniqueOdds.length} (${uniqueOdds.join(', ')})`);
      logger.info(`   Unique stakes: ${uniqueStakes.length} (${uniqueStakes.join(', ')})`);
      logger.info(`   Unique confidences: ${uniqueConf.length} (${uniqueConf.join(', ')})`);

      if (uniqueOdds.length === 1 && uniqueOdds[0] === -110) {
        logger.warn('❌ CONFIRMED: All odds are hardcoded to -110');
      }
      if (uniqueStakes.length === 1 && uniqueStakes[0] === 100) {
        logger.warn('❌ CONFIRMED: All stakes are hardcoded to $100');
      }
      if (uniqueConf.length <= 2) {
        logger.warn('❌ CONFIRMED: Confidence values are oversimplified');
      }
    }

    // Step 2: Clear existing hardcoded picks
    logger.info('\\n🗑️  Clearing hardcoded picks from unified_picks...');
    
    const { error: deleteError, count: deletedCount } = await supabase
      .from('unified_picks')
      .delete()
      .eq('stake', 100) // Remove hardcoded $100 stakes
      .in('odds', [-110]) // Remove hardcoded -110 odds
      .in('confidence', [25, 85]); // Remove oversimplified confidence

    if (deleteError) {
      logger.error('Error clearing hardcoded picks:', deleteError);
    } else {
      logger.success(`✅ Cleared ${deletedCount || 0} hardcoded picks`);
    }

    // Step 3: Reset raw_props promoted status
    logger.info('\\n🔄 Resetting raw_props promotion status...');
    
    const { error: resetError, count: resetCount } = await supabase
      .from('raw_props')
      .update({ 
        promoted_to_picks: false,
        promoted_at: null,
        processed_at: null 
      })
      .not('tier', 'is', null) // Only reset graded props
      .eq('promoted_to_picks', true);

    if (resetError) {
      logger.error('Error resetting promotion status:', resetError);
    } else {
      logger.success(`✅ Reset promotion status for ${resetCount || 0} props`);
    }

    // Step 4: Initialize Professional Prop Processor
    logger.info('\\n🎯 Initializing Professional Prop Processor...');
    
    const processor = ProfessionalPropProcessor.getInstance();
    
    // Step 5: Process props through REAL professional pipeline
    logger.info('\\n🏆 Processing props through REAL professional grading...');
    logger.info('This will generate diverse scores based on:');
    logger.info('   • Actual odds devigging');
    logger.info('   • CLV tracking');
    logger.info('   • Professional scoring (45+ factors)');
    logger.info('   • Kelly fraction sizing');
    logger.info('   • Risk assessment');

    const results = await processor.processRawProps({
      max_batch_size: 10, // Start small to verify diversity
      auto_approve_threshold: 3.0
    });

    logger.info(`\\n📊 Professional processing completed: ${results.length} props processed`);

    // Step 6: Verify diversity in new picks
    logger.info('\\n🔍 Verifying diversity in new professional picks...');
    
    const { data: newPicks } = await supabase
      .from('unified_picks')
      .select('odds, stake, confidence, edge_score, tier_when_placed')
      .order('created_at', { ascending: false })
      .limit(10);

    if (newPicks && newPicks.length > 0) {
      const newUniqueOdds = [...new Set(newPicks.map(p => p.odds))];
      const newUniqueStakes = [...new Set(newPicks.map(p => p.stake))];
      const newUniqueConf = [...new Set(newPicks.map(p => p.confidence))];

      logger.success('\\n🎉 NEW PROFESSIONAL GRADING DIVERSITY:');
      logger.success(`   Unique odds: ${newUniqueOdds.length} values`);
      logger.success(`   Unique stakes: ${newUniqueStakes.length} values`);
      logger.success(`   Unique confidences: ${newUniqueConf.length} values`);

      logger.info('\\n📊 Sample of professional picks:');
      newPicks.slice(0, 5).forEach((pick, i) => {
        logger.info(`${i+1}. Odds: ${pick.odds}, Stake: $${pick.stake}, Confidence: ${pick.confidence}%, Tier: ${pick.tier_when_placed}`);
      });

      if (newUniqueOdds.length > 1 && newUniqueConf.length > 2) {
        logger.success('\\n🏆 SUCCESS: Grading system now produces diverse scores!');
      } else {
        logger.warn('\\n⚠️  WARNING: Still seeing limited diversity - check professional processor');
      }
    }

    // Step 7: Recommendations
    logger.info('\\n' + '='.repeat(60));
    logger.info('📋 GRADING SYSTEM FIX RECOMMENDATIONS:');
    logger.info('='.repeat(60));
    logger.info('✅ 1. Remove all hardcoded values from batch scripts');
    logger.info('✅ 2. Use ProfessionalPropProcessor for ALL pick creation');
    logger.info('✅ 3. Enable devigging for accurate odds calculation');
    logger.info('✅ 4. Use Kelly sizing for stake calculation');
    logger.info('✅ 5. Professional confidence scoring (not 25/85 binary)');
    logger.info('\\n🎯 Next: Run this fix, then process more props through professional pipeline');

  } catch (error) {
    logger.error('❌ Failed to fix grading diversity:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  fixGradingDiversity()
    .then(() => {
      console.log('\\n✅ Grading system diversity fix completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\\n❌ Fix failed:', error);
      process.exit(1);
    });
}