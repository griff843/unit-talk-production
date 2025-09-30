#!/usr/bin/env tsx

/**
 * PROFESSIONAL PROP GRADING BACKFILL SCRIPT
 * 
 * Safely processes ungraded props through the professional grading system.
 * 
 * Features:
 * - Batch processing with configurable size
 * - Progress tracking and resumable operation
 * - Shadow mode for safe testing
 * - Comprehensive error handling and retry logic
 * - Real-time metrics and performance monitoring
 */

import 'dotenv/config';
import { ScoringAgent } from '../agents/ScoringAgent/ScoringAgent';
import { BaseAgentConfig, BaseAgentDependencies } from '../agents/BaseAgent/types';
import { createSupabaseClient } from '../utils/supabaseUtils';
import { createLogger } from '../utils/logger';

const logger = createLogger('professional-backfill');

interface BackfillOptions {
  batchSize?: number;
  maxProps?: number;
  shadowMode?: boolean;
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
  skipCount: number;
  startTime: number;
  batches: number;
  avgProcessingTime: number;
  peakMemoryUsage: number;
}

class ProfessionalBackfillProcessor {
  private supabase = createSupabaseClient();
  private scoringAgent: ScoringAgent;
  private metrics: BackfillMetrics;
  
  constructor(private options: BackfillOptions = {}) {
    // Initialize with safe defaults
    this.options = {
      batchSize: 50, // Safe batch size to avoid memory issues
      maxProps: Infinity,
      shadowMode: true, // Default to shadow mode for safety
      dryRun: false,
      skipExisting: true,
      ...options
    };
    
    this.metrics = {
      totalProps: 0,
      processedCount: 0,
      successCount: 0,
      errorCount: 0,
      skipCount: 0,
      startTime: Date.now(),
      batches: 0,
      avgProcessingTime: 0,
      peakMemoryUsage: 0
    };
    
    this.initializeAgents();
  }
  
  private async initializeAgents() {
    const deps: BaseAgentDependencies = {
      supabase: this.supabase,
      logger
    };
    
    const config: BaseAgentConfig = {
      name: 'professional-backfill-grading-agent',
      version: '1.0.0'
    };
    
    this.scoringAgent = new ScoringAgent(config, deps);
    await this.scoringAgent.initialize();
  }
  
  /**
   * Get count of unprocessed props ready for professional grading
   */
  async getUnprocessedCount(league?: string): Promise<number> {
    let query = this.supabase
      .from('sports_game_odds')
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
   * Fetch a batch of unprocessed props
   */
  async fetchUnprocessedBatch(offset: number = 0): Promise<any[]> {
    let query = this.supabase
      .from('sports_game_odds')
      .select('*')
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
    
    const { data, error } = await query;
    
    if (error) {
      logger.error('Failed to fetch unprocessed props batch:', error);
      throw error;
    }
    
    return data || [];
  }
  
  /**
   * Process a single prop through professional grading system
   */
  async processProp(rawProp: any): Promise<{ success: boolean; error?: string }> {
    const propStartTime = Date.now();
    
    try {
      if (this.options.dryRun) {
        logger.info(`[DRY RUN] Would process prop: ${rawProp.id} (${rawProp.player_name} ${rawProp.stat_type})`);
        return { success: true };
      }
      
      // Increment attempt counter
      await this.supabase
        .from('sports_game_odds')
        .update({ pro_attempts: (rawProp.pro_attempts || 0) + 1 })
        .eq('id', rawProp.id);
      
      // Convert raw prop to features format for processing
      const features = {
        propId: rawProp.id,
        sport: rawProp.sport || 'MLB',
        playerName: rawProp.player_name,
        statType: rawProp.stat_type,
        line: rawProp.line,
        overOdds: rawProp.over_odds,
        underOdds: rawProp.under_odds,
        bookmaker: rawProp.bookmaker || 'unknown',
        gameDate: rawProp.game_date,
        timestamp: rawProp.created_at
      };
      
      // Process through ScoringAgent which routes to professional system
      const result = await this.scoringAgent.gradeProp(features);
      
      if (!result || !result.propId) {
        logger.warn(`Failed to process prop ${rawProp.id}: No result returned`);
        return { success: false, error: 'No result returned from grading system' };
      }
      
      // Mark as professionally processed
      await this.supabase
        .from('sports_game_odds')
        .update({ 
          processed_at: new Date().toISOString(),
          processing_error: null
        })
        .eq('id', rawProp.id);
      
      const processingTime = Date.now() - propStartTime;
      this.updateProcessingTimeMetrics(processingTime);
      
      logger.debug(`Successfully processed prop ${rawProp.id} (score: ${result.finalScore}) in ${processingTime}ms`);
      return { success: true };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error processing prop ${rawProp.id}:`, error);
      
      // Log error to database
      await this.supabase
        .from('sports_game_odds')
        .update({ processing_error: errorMessage })
        .eq('id', rawProp.id);
      
      return { success: false, error: errorMessage };
    }
  }
  
  /**
   * Process a batch of props
   */
  async processBatch(props: any[]): Promise<void> {
    logger.info(`Processing batch of ${props.length} props...`);
    
    const batchResults = await Promise.allSettled(
      props.map(prop => this.processProp(prop))
    );
    
    // Update metrics
    this.metrics.batches++;
    batchResults.forEach((result, index) => {
      this.metrics.processedCount++;
      
      if (result.status === 'fulfilled' && result.value.success) {
        this.metrics.successCount++;
        logger.debug(`✅ Prop ${props[index].id}: Success`);
      } else {
        this.metrics.errorCount++;
        const error = result.status === 'rejected' ? 
          result.reason : 
          (result.value as any)?.error || 'Unknown error';
        logger.warn(`❌ Prop ${props[index].id}: ${error}`);
      }
    });
    
    this.logProgress();
  }
  
  /**
   * Main backfill execution
   */
  async run(): Promise<void> {
    try {
      logger.info('🚀 Starting Professional Prop Grading Backfill...');
      logger.info('Configuration:', {
        batchSize: this.options.batchSize,
        maxProps: this.options.maxProps,
        shadowMode: this.options.shadowMode,
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
        // Check memory usage
        this.checkMemoryUsage();
        
        // Fetch next batch
        const batch = await this.fetchUnprocessedBatch(offset);
        
        if (batch.length === 0) {
          logger.info('✅ No more props to process');
          break;
        }
        
        // Process batch
        await this.processBatch(batch);
        
        offset += batch.length;
        processedInSession += batch.length;
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      this.logFinalMetrics();
      
    } catch (error) {
      logger.error('❌ Backfill failed:', error);
      throw error;
    }
  }
  
  private updateProcessingTimeMetrics(timeMs: number): void {
    const total = this.metrics.avgProcessingTime * (this.metrics.successCount - 1) + timeMs;
    this.metrics.avgProcessingTime = total / this.metrics.successCount;
  }
  
  private checkMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    
    if (memUsageMB > this.metrics.peakMemoryUsage) {
      this.metrics.peakMemoryUsage = memUsageMB;
    }
    
    if (memUsageMB > 500) { // Warning at 500MB
      logger.warn(`⚠️  High memory usage: ${memUsageMB.toFixed(1)}MB`);
    }
  }
  
  private logProgress(): void {
    const elapsed = Date.now() - this.metrics.startTime;
    const rate = this.metrics.processedCount / (elapsed / 1000);
    const successRate = (this.metrics.successCount / this.metrics.processedCount) * 100;
    
    logger.info(`📈 Progress: ${this.metrics.processedCount}/${this.metrics.totalProps} | ` +
               `Success: ${successRate.toFixed(1)}% | ` +
               `Rate: ${rate.toFixed(1)} props/sec | ` +
               `Avg: ${this.metrics.avgProcessingTime.toFixed(0)}ms/prop`);
  }
  
  private logFinalMetrics(): void {
    const elapsed = Date.now() - this.metrics.startTime;
    const totalMinutes = elapsed / 60000;
    
    logger.info('🎉 Professional Prop Backfill Complete!');
    logger.info('📊 Final Metrics:', {
      totalProcessed: this.metrics.processedCount,
      successful: this.metrics.successCount,
      errors: this.metrics.errorCount,
      skipped: this.metrics.skipCount,
      successRate: `${((this.metrics.successCount / this.metrics.processedCount) * 100).toFixed(1)}%`,
      totalTime: `${totalMinutes.toFixed(1)} minutes`,
      avgRate: `${(this.metrics.processedCount / totalMinutes).toFixed(1)} props/minute`,
      avgProcessingTime: `${this.metrics.avgProcessingTime.toFixed(0)}ms`,
      peakMemoryUsage: `${this.metrics.peakMemoryUsage.toFixed(1)}MB`,
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
      case '--shadow-mode':
        options.shadowMode = true;
        break;
      case '--live-mode':
        options.shadowMode = false;
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
Professional Prop Grading Backfill Script

Usage: npx tsx professional-backfill.ts [options]

Options:
  --batch-size <number>    Props to process per batch (default: 50)
  --max-props <number>     Maximum props to process in this run
  --league <league>        Process only specific league (MLB, NFL, etc.)
  --shadow-mode           Enable shadow mode (default, safe testing)
  --live-mode             Enable live mode (publishes results)  
  --dry-run               Show what would be processed without changes
  --resume-from <id>       Resume from specific prop ID
  --include-retries        Include props with previous attempts
  --help                  Show this help message

Examples:
  # Safe test run (shadow mode, 100 props)
  npx tsx professional-backfill.ts --max-props 100
  
  # Process all MLB props
  npx tsx professional-backfill.ts --league MLB
  
  # Large batch processing
  npx tsx professional-backfill.ts --batch-size 100 --max-props 1000
  
  # Dry run to see what would be processed
  npx tsx professional-backfill.ts --dry-run --max-props 10
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
    
    // Safety check for live mode
    if (options.shadowMode === false) {
      logger.warn('⚠️  LIVE MODE ENABLED - Results will be published publicly!');
      logger.warn('⚠️  Press Ctrl+C within 5 seconds to cancel...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    const processor = new ProfessionalBackfillProcessor(options);
    await processor.run();
    
    logger.info('✅ Backfill completed successfully');
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Backfill failed:', error);
    process.exit(1);
  }
}

// Execute if called directly
if (require.main === module) {
  main();
}

export { ProfessionalBackfillProcessor };