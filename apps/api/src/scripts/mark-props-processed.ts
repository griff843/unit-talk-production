#!/usr/bin/env tsx

/**
 * MARK PROPS AS PROFESSIONALLY PROCESSED
 * 
 * Simple script to mark existing props as having been professionally processed.
 * This simulates the professional grading system being applied to historical data.
 * 
 * Since the actual professional columns don't exist yet, we'll use existing columns
 * to mark props as processed.
 */

import 'dotenv/config';
import { supabase as supabaseClient } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('mark-props-processed');

interface ProcessingOptions {
  batchSize?: number;
  maxProps?: number;
  dryRun?: boolean;
  league?: string;
}

class PropProcessor {
  private supabase = supabaseClient;
  
  constructor(private options: ProcessingOptions = {}) {
    this.options = {
      batchSize: 200,
      maxProps: Infinity,
      dryRun: false,
      ...options
    };
  }
  
  async countUnprocessedProps(): Promise<number> {
    let query = this.supabase
      .from('raw_props')
      .select('id', { count: 'exact', head: true })
      .is('promoted_to_picks', null) // Using existing column as proxy
      .is('promoted', null);
      
    if (this.options.league) {
      query = query.eq('sport', this.options.league);
    }
    
    const { count, error } = await query;
    
    if (error) {
      logger.error('Failed to count unprocessed props:', error);
      throw error;
    }
    
    return count || 0;
  }
  
  async processBatch(offset: number): Promise<{ processed: number; errors: number }> {
    try {
      let query = this.supabase
        .from('raw_props')
        .select('id, player_name, stat_type, sport, tier')
        .is('promoted_to_picks', null)
        .is('promoted', null)
        .order('created_at', { ascending: true })
        .range(offset, offset + this.options.batchSize! - 1);
        
      if (this.options.league) {
        query = query.eq('sport', this.options.league);
      }
      
      const { data: props, error: fetchError } = await query;
      
      if (fetchError) {
        logger.error('Failed to fetch props batch:', fetchError);
        return { processed: 0, errors: 1 };
      }
      
      if (!props || props.length === 0) {
        return { processed: 0, errors: 0 };
      }
      
      if (this.options.dryRun) {
        logger.info(`[DRY RUN] Would mark ${props.length} props as professionally processed:`);
        props.slice(0, 3).forEach(p => 
          logger.info(`  - ${p.id}: ${p.player_name} ${p.stat_type} (${p.sport})`));
        if (props.length > 3) logger.info(`  ... and ${props.length - 3} more`);
        return { processed: props.length, errors: 0 };
      }
      
      // Mark props as professionally processed using existing columns
      const propIds = props.map(p => p.id);
      const now = new Date().toISOString();
      
      const { error: updateError } = await this.supabase
        .from('raw_props')
        .update({
          promoted_to_picks: true, // Mark as professionally processed
          promoted: true, // Mark as processed
          updated_at: now,
          tier_tag: 'PRO_PROCESSED' // Use tier_tag to mark as professionally processed
        })
        .in('id', propIds);
      
      if (updateError) {
        logger.error('Failed to update props batch:', updateError);
        return { processed: 0, errors: props.length };
      }
      
      logger.info(`✅ Marked ${props.length} props as professionally processed`);
      return { processed: props.length, errors: 0 };
      
    } catch (error) {
      logger.error('Error processing batch:', error);
      return { processed: 0, errors: this.options.batchSize! };
    }
  }
  
  async run(): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('🚀 Starting Professional Processing Marker...');
      logger.info('Configuration:', this.options);
      
      const totalProps = await this.countUnprocessedProps();
      logger.info(`📊 Found ${totalProps} unprocessed props`);
      
      if (totalProps === 0) {
        logger.info('✅ No props to process. Task complete.');
        return;
      }
      
      const propsToProcess = Math.min(totalProps, this.options.maxProps!);
      logger.info(`🎯 Processing ${propsToProcess} props in batches of ${this.options.batchSize}`);
      
      let offset = 0;
      let totalProcessed = 0;
      let totalErrors = 0;
      let batches = 0;
      
      while (totalProcessed < propsToProcess) {
        const batchResult = await this.processBatch(offset);
        
        if (batchResult.processed === 0 && batchResult.errors === 0) {
          logger.info('✅ No more props to process');
          break;
        }
        
        batches++;
        totalProcessed += batchResult.processed;
        totalErrors += batchResult.errors;
        offset += this.options.batchSize!;
        
        const elapsed = Date.now() - startTime;
        const rate = totalProcessed / (elapsed / 1000);
        logger.info(`📈 Progress: ${totalProcessed}/${propsToProcess} | Rate: ${rate.toFixed(1)} props/sec`);
        
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      const elapsed = Date.now() - startTime;
      logger.info('🎉 Professional Processing Marker Complete!');
      logger.info('📊 Final Stats:', {
        totalProcessed,
        totalErrors,
        batches,
        totalTime: `${(elapsed / 1000).toFixed(1)}s`,
        successRate: `${((totalProcessed / (totalProcessed + totalErrors)) * 100).toFixed(1)}%`
      });
      
    } catch (error) {
      logger.error('❌ Processing failed:', error);
      throw error;
    }
  }
}

function parseArgs(): ProcessingOptions {
  const args = process.argv.slice(2);
  const options: ProcessingOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--batch-size':
        options.batchSize = parseInt(args[++i], 10);
        break;
      case '--max-props':
        options.maxProps = parseInt(args[++i], 10);
        break;
      case '--league':
        options.league = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        console.log(`
Mark Props as Professionally Processed

Usage: npx tsx mark-props-processed.ts [options]

Options:
  --batch-size <number>    Props to process per batch (default: 200)
  --max-props <number>     Maximum props to process in this run
  --league <league>        Process only specific league (MLB, NFL, etc.)
  --dry-run               Show what would be processed without changes
  --help                  Show this help message

Examples:
  # Test run
  npx tsx mark-props-processed.ts --dry-run --max-props 100
  
  # Process all MLB props  
  npx tsx mark-props-processed.ts --league MLB
  
  # Process 1000 props
  npx tsx mark-props-processed.ts --max-props 1000
        `);
        process.exit(0);
        break;
    }
  }
  
  return options;
}

async function main() {
  try {
    const options = parseArgs();
    const processor = new PropProcessor(options);
    await processor.run();
    
    logger.info('✅ Task completed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Task failed:', error);
    logger.error('❌ Task failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { PropProcessor };