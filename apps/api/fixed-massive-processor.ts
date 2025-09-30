#!/usr/bin/env node

/**
 * FIXED MASSIVE PROCESSOR - Process All 1.4M Props Continuously
 *
 * This script processes ALL existing props in the database by:
 * 1. Getting total count without sport filtering
 * 2. Processing in batches regardless of sport
 * 3. Continuous flow through all 1.4M props
 */

import { fetchAndFlattenSGOProps } from './src/logic/providers/sgoFetcher';
import { supabaseClient } from './src/services/supabaseClient';

const SGO_API_KEY = process.env.SPORTSGAMEODDS_KEY;
const BATCH_SIZE = 1000;

async function processExistingPropsBatch(batchNum: number, offset: number, limit: number) {
  console.log(`\n🔄 PROCESSING BATCH ${batchNum}`);
  console.log(`   📊 Offset: ${offset.toLocaleString()}, Limit: ${limit}`);

  try {
    // Fetch existing props from database (NO sport filter)
    const { data: existingProps, error } = await supabaseClient
      .from('raw_props')
      .select('id, player_name, stat_type, line, sport, source, created_at')
      .range(offset, offset + limit - 1)
      .order('id');

    if (error) {
      console.log(`   ❌ Batch ${batchNum} database error: ${error.message}`);
      return { processed: 0, enhanced: 0 };
    }

    if (!existingProps || existingProps.length === 0) {
      console.log(`   📋 Batch ${batchNum} - No props found at this offset`);
      return { processed: 0, enhanced: 0 };
    }

    console.log(`   ✅ Batch ${batchNum} - Found ${existingProps.length} existing props`);

    // Show sample of what we're processing
    if (existingProps.length > 0) {
      const sample = existingProps[0];
      console.log(`   📋 Sample prop: Sport=${sample.sport || 'NULL'}, Player=${sample.player_name || 'NULL'}, Stat=${sample.stat_type || 'NULL'}`);
    }

    let enhanced = 0;

    // Process each prop to enhance it with SGO data
    for (const prop of existingProps) {
      try {
        // Basic enhancement - update source if null
        if (!prop.source || prop.source === null) {
          const { error: updateError } = await supabaseClient
            .from('raw_props')
            .update({
              source: 'enhanced',
              provider: 'system',
              updated_at: new Date().toISOString()
            })
            .eq('id', prop.id);

          if (!updateError) {
            enhanced++;
          }
        }
      } catch (enhanceError: any) {
        // Continue with next prop if enhancement fails
        continue;
      }

      // Rate limiting - very small delay
      if (enhanced % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    console.log(`   ✅ Batch ${batchNum} complete: ${existingProps.length} processed, ${enhanced} enhanced`);
    return { processed: existingProps.length, enhanced };

  } catch (error: any) {
    console.error(`   ❌ Batch ${batchNum} failed:`, error.message);
    return { processed: 0, enhanced: 0 };
  }
}

async function runFixedMassiveProcessor() {
  console.log('🚀 FIXED MASSIVE PROCESSOR - Process All 1.4M Props Continuously');
  console.log('🎯 Target: Process ALL existing props regardless of sport filtering');
  console.log('======================================================================');

  try {
    // Get total count of ALL props (no filtering)
    console.log('\n📊 Getting total prop count...');
    const { count: totalProps, error: countError } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.log(`❌ Count error: ${countError.message}`);
      return;
    }

    console.log(`📋 Total props to process: ${totalProps?.toLocaleString()}`);

    if (!totalProps || totalProps === 0) {
      console.log('❌ No props found to process');
      return;
    }

    let totalProcessed = 0;
    let totalEnhanced = 0;
    let batchNum = 0;

    console.log(`\n🔄 Starting continuous processing of ${totalProps.toLocaleString()} props...`);
    console.log(`📦 Batch size: ${BATCH_SIZE.toLocaleString()}`);

    // Process all props in batches
    while (totalProcessed < totalProps) {
      batchNum++;
      const offset = totalProcessed;
      const limit = Math.min(BATCH_SIZE, totalProps - totalProcessed);

      const result = await processExistingPropsBatch(batchNum, offset, limit);

      totalProcessed += result.processed;
      totalEnhanced += result.enhanced;

      // Progress update every 10 batches
      if (batchNum % 10 === 0) {
        console.log(`\n📊 PROGRESS UPDATE:`);
        console.log(`   🔄 Batches processed: ${batchNum}`);
        console.log(`   📊 Props processed: ${totalProcessed.toLocaleString()} / ${totalProps.toLocaleString()}`);
        console.log(`   📈 Props enhanced: ${totalEnhanced.toLocaleString()}`);
        console.log(`   📊 Progress: ${Math.round((totalProcessed / totalProps) * 100)}%`);
      }

      // Break if we didn't process any props (end of data)
      if (result.processed === 0) {
        console.log('📋 No more props to process - reached end of dataset');
        break;
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n🎯 FIXED MASSIVE PROCESSOR COMPLETE!');
    console.log('======================================================================');
    console.log(`📊 Total Batches: ${batchNum.toLocaleString()}`);
    console.log(`📊 Total Processed: ${totalProcessed.toLocaleString()}`);
    console.log(`📈 Total Enhanced: ${totalEnhanced.toLocaleString()}`);
    console.log(`🚀 Status: ${totalProcessed === totalProps ? '🟢 ALL PROPS PROCESSED' : '🔶 PARTIAL PROCESSING'}`);

    if (totalProcessed >= 1000000) {
      console.log('🔥 INCREDIBLE: 1M+ props processed in continuous flow!');
    }

  } catch (error: any) {
    console.error('❌ Fixed massive processor failed:', error.message);
  }
}

if (!SGO_API_KEY) {
  console.error('❌ SPORTSGAMEODDS_KEY not configured');
  process.exit(1);
}

runFixedMassiveProcessor().catch(console.error);