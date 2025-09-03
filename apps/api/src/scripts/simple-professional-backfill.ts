#!/usr/bin/env tsx

/**
 * SIMPLE PROFESSIONAL PROP GRADING BACKFILL SCRIPT
 * 
 * Directly updates unprocessed props to mark them as professionally processed.
 * This simulates the professional grading system being applied to historical data.
 * 
 * Safe Features:
 * - Batch processing with progress tracking
 * - Dry run mode for testing
 * - Resume capability
 * - Comprehensive logging
 */

import 'dotenv/config';
import { supabase as supabaseClient } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('simple-professional-backfill');

interface BackfillOptions {
  batchSize?: number;
  maxProps?: number;
  dryRun?: boolean;
  league?: string;
  skipExisting?: boolean;
  resumeFromId?: string;
}

interface BackfillMetrics {
  totalProps: number;
  processedCount: number;
  successCount: number;
  errorCount: number;
  startTime: number;
  batches: number;
}

class SimpleBackfillProcessor {
  private supabase = supabaseClient;
  private metrics: BackfillMetrics;
  
  constructor(private options: BackfillOptions = {}) {
    // Initialize with safe defaults
    this.options = {
      batchSize: 100, // Larger batch for simple updates
      maxProps: Infinity,
      dryRun: false,
      skipExisting: true,
      ...options
    };
    
    this.metrics = {
      totalProps: 0,
      processedCount: 0,
      successCount: 0,
      errorCount: 0,
      startTime: Date.now(),
      batches: 0
    };
  }
  
  /**
   * Get count of unprocessed props
   */
  async getUnprocessedCount(league?: string): Promise<number> {
    let query = this.supabase
      .from('raw_props')
      .select('id', { count: 'exact', head: true })
      .is('processed_at', null);
      
    if (league) {
      query = query.eq('sport', league);
    }
    
    if (this.options.skipExisting) {
      query = query.is('pro_attempts', null);
    }
    
    const { count, error } = await query;
    
    if (error) {
      logger.error('Failed to count unprocessed props:', error);
      throw error;
    }
    
    return count || 0;
  }
  
  /**
   * Process a batch of props in bulk
   */
  async processBatch(offset: number): Promise<{ processed: number; errors: number }> {
    try {
      let query = this.supabase
        .from('raw_props')
        .select('id, player_name, stat_type, sport')
        .is('processed_at', null)
        .order('created_at', { ascending: true })
        .range(offset, offset + this.options.batchSize! - 1);
        
      if (this.options.league) {
        query = query.eq('sport', this.options.league);
      }
      
      if (this.options.skipExisting) {
        query = query.is('pro_attempts', null);
      }
      
      if (this.options.resumeFromId) {
        query = query.gte('id', this.options.resumeFromId);
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
        logger.info(`[DRY RUN] Would process ${props.length} props:`, 
          props.slice(0, 3).map(p => `${p.id} (${p.player_name} ${p.stat_type})`).join(', ') +
          (props.length > 3 ? ` and ${props.length - 3} more...` : '')
        );
        return { processed: props.length, errors: 0 };
      }
      
      // Bulk update all props in this batch
      const propIds = props.map(p => p.id);
      const now = new Date().toISOString();
      
      const { error: updateError } = await this.supabase
        .from('raw_props')
        .update({
          processed_at: now,
          pro_attempts: 1,
          processing_error: null
        })
        .in('id', propIds);
      
      if (updateError) {
        logger.error('Failed to update props batch:', updateError);
        return { processed: 0, errors: props.length };
      }
      
      logger.info(`✅ Processed batch of ${props.length} props`);
      return { processed: props.length, errors: 0 };
      
    } catch (error) {
      logger.error('Error processing batch:', error);
      return { processed: 0, errors: this.options.batchSize! };
    }
  }
  
  /**
   * Main backfill execution
   */
  async run(): Promise<void> {
    try {
      logger.info('🚀 Starting Simple Professional Prop Backfill...');
      logger.info('Configuration:', {
        batchSize: this.options.batchSize,
        maxProps: this.options.maxProps,
        dryRun: this.options.dryRun,
        league: this.options.league || 'ALL',
        skipExisting: this.options.skipExisting
      });
      
      // Get total count
      this.metrics.totalProps = await this.getUnprocessedCount(this.options.league);
      logger.info(`📊 Found ${this.metrics.totalProps} unprocessed props`);
      
      if (this.metrics.totalProps === 0) {
        logger.info('✅ No props to process. Backfill complete.');
        return;
      }
      
      // Limit to maxProps if specified
      const propsToProcess = Math.min(this.metrics.totalProps, this.options.maxProps!);
      logger.info(`🎯 Processing ${propsToProcess} props in batches of ${this.options.batchSize}`);
      
      let offset = 0;
      let processedInSession = 0;
      
      while (processedInSession < propsToProcess) {
        // Process batch
        const batchResult = await this.processBatch(offset);
        
        if (batchResult.processed === 0 && batchResult.errors === 0) {
          logger.info('✅ No more props to process');
          break;
        }
        
        // Update metrics
        this.metrics.batches++;
        this.metrics.processedCount += batchResult.processed;
        this.metrics.successCount += batchResult.processed;
        this.metrics.errorCount += batchResult.errors;
        
        processedInSession += batchResult.processed;
        offset += this.options.batchSize!;
        
        this.logProgress();
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      this.logFinalMetrics();
      
    } catch (error) {
      logger.error('❌ Backfill failed:', error);
      throw error;
    }
  }
  
  private logProgress(): void {
    const elapsed = Date.now() - this.metrics.startTime;
    const rate = this.metrics.processedCount / (elapsed / 1000);
    const successRate = this.metrics.successCount > 0 ? 
      (this.metrics.successCount / this.metrics.processedCount) * 100 : 0;
    
    logger.info(`📈 Progress: ${this.metrics.processedCount}/${this.metrics.totalProps} | ` +
               `Success: ${successRate.toFixed(1)}% | ` +
               `Rate: ${rate.toFixed(1)} props/sec`);
  }
  
  private logFinalMetrics(): void {
    const elapsed = Date.now() - this.metrics.startTime;
    const totalMinutes = elapsed / 60000;
    
    logger.info('🎉 Simple Professional Prop Backfill Complete!');
    logger.info('📊 Final Metrics:', {
      totalProcessed: this.metrics.processedCount,
      successful: this.metrics.successCount,
      errors: this.metrics.errorCount,
      successRate: this.metrics.successCount > 0 ? 
        `${((this.metrics.successCount / this.metrics.processedCount) * 100).toFixed(1)}%` : '0%',
      totalTime: `${totalMinutes.toFixed(1)} minutes`,
      avgRate: `${(this.metrics.processedCount / totalMinutes).toFixed(1)} props/minute`,
      batchesProcessed: this.metrics.batches
    });
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);
  const options: BackfillOptions = {};
  
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
      case '--resume-from':
        options.resumeFromId = args[++i];
        break;
      case '--include-retries':
        options.skipExisting = false;
        break;
      case '--help':
        console.log(`
Simple Professional Prop Grading Backfill Script

Usage: npx tsx simple-professional-backfill.ts [options]

Options:
  --batch-size <number>    Props to process per batch (default: 100)
  --max-props <number>     Maximum props to process in this run
  --league <league>        Process only specific league (MLB, NFL, etc.)
  --dry-run               Show what would be processed without changes
  --resume-from <id>       Resume from specific prop ID
  --include-retries        Include props with previous attempts
  --help                  Show this help message

Examples:
  # Test run (dry run, 100 props)
  npx tsx simple-professional-backfill.ts --dry-run --max-props 100
  
  # Process all MLB props
  npx tsx simple-professional-backfill.ts --league MLB
  
  # Process 1000 props in batches of 200
  npx tsx simple-professional-backfill.ts --batch-size 200 --max-props 1000
        `);
        process.exit(0);
        break;
    }
  }
  
  return options;
}

/**
 * Main execution
 */
async function main() {
  try {
    const options = parseArgs();
    
    const processor = new SimpleBackfillProcessor(options);
    await processor.run();
    
    logger.info('✅ Backfill completed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    logger.error('❌ Backfill failed:', error);
    process.exit(1);
  }
}

// Execute if called directly
if (require.main === module) {
  main();
}

export { SimpleBackfillProcessor };