import { redisCache } from '../../cache/enhanced-cache';
import { withCircuitBreaker } from '../../services/enhanced-circuit-breaker';
import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics } from '../BaseAgent/types';
import { requireSupabase } from '../../utils/supabaseUtils';

interface DataLifecycleMetrics extends BaseMetrics {
  propsArchived: number;
  propsCompressed: number;
  propsDeleted: number;
  storageReclaimed: number;
  archiveLatencyMs: number;
  hotTierSize: number;
  warmTierSize: number;
  coldTierSize: number;
  lastArchiveRun: string;
  retentionPolicyViolations: number;
}

interface RetentionPolicy {
  hotTierDays: number;        // Keep in raw_props for N days
  warmTierDays: number;       // Keep in raw_props_recent for N days  
  coldTierDays: number;       // Keep in raw_props_historical for N days
  compressionEnabled: boolean;
  autoDeleteEnabled: boolean;
  batchSize: number;
}

interface _ArchiveOperation {
  sourceTable: string;
  targetTable: string;
  recordsToMove: number;
  cutoffDate: string;
  compressionRatio?: number;
}

/**
 * DataLifecycleAgent
 * 
 * Enterprise-grade data lifecycle management for sports betting props.
 * Implements hot-warm-cold storage tiers following SaaS best practices.
 * 
 * Architecture:
 * - Hot Tier (prop_ticks_hot): Real-time tick data for 7-14 days
 * - Warm Tier (features_daily_agg): Feature store for 30 days
 * - Cold Tier (prop_ticks_archive): Parquet exports for long-term storage
 * 
 * Similar to data management used by:
 * - Stripe (transaction archiving)
 * - Snowflake (time-travel data)
 * - AWS RDS (automated lifecycle policies)
 */
export class DataLifecycleAgent extends BaseAgent {
  private lifecycleMetrics: DataLifecycleMetrics;
  private retentionPolicy: RetentionPolicy;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
    
    this.lifecycleMetrics = {
      ...this.metrics,
      propsArchived: 0,
      propsCompressed: 0,
      propsDeleted: 0,
      storageReclaimed: 0,
      archiveLatencyMs: 0,
      hotTierSize: 0,
      warmTierSize: 0,
      coldTierSize: 0,
      lastArchiveRun: new Date().toISOString(),
      retentionPolicyViolations: 0
    };

    // Enterprise retention policy (configurable via environment)
    this.retentionPolicy = {
      hotTierDays: parseInt(process.env.HOT_TIER_RETENTION_DAYS || '7'),      // 7 days in hot (prop_ticks_hot)
      warmTierDays: parseInt(process.env.WARM_TIER_RETENTION_DAYS || '30'),   // 30 days in warm (features_daily_agg)
      coldTierDays: parseInt(process.env.COLD_TIER_RETENTION_DAYS || '365'),  // 1 year in cold (prop_ticks_archive)
      compressionEnabled: process.env.COMPRESSION_ENABLED === 'true',
      autoDeleteEnabled: process.env.AUTO_DELETE_ENABLED === 'true',
      batchSize: parseInt(process.env.ARCHIVE_BATCH_SIZE || '1000')
    };
  }

  protected async initialize(): Promise<void> {
    this.logger.info('🗄️ DataLifecycleAgent initializing...');
    
    // Ensure historical tables exist
    await this.ensureHistoricalTablesExist();
    
    // Load previous metrics
    await this.loadLifecycleMetrics();
    
    // Validate retention policy
    await this.validateRetentionPolicy();
    
    this.logger.info('✅ DataLifecycleAgent initialized', {
      retentionPolicy: this.retentionPolicy,
      currentMetrics: {
        hotTier: this.lifecycleMetrics.hotTierSize,
        warmTier: this.lifecycleMetrics.warmTierSize,
        coldTier: this.lifecycleMetrics.coldTierSize
      }
    });
  }

  protected async process(): Promise<void> {
    this.logger.info('🔄 Running data lifecycle management cycle...');
    
    const cycleStartTime = Date.now();

    try {
      // 1. Analyze current data distribution
      await this.analyzeDataDistribution();
      
      // 2. Archive hot tier to warm tier (prop_ticks_hot -> features_daily_agg)
      await this.archiveHotToWarm();
      
      // 3. Archive warm tier to cold tier (features_daily_agg -> prop_ticks_archive)
      await this.archiveWarmToCold();
      
      // 4. Compress cold tier data (if enabled)
      if (this.retentionPolicy.compressionEnabled) {
        await this.compressHistoricalData();
      }
      
      // 5. Delete expired data (if enabled)
      if (this.retentionPolicy.autoDeleteEnabled) {
        await this.deleteExpiredData();
      }
      
      // 6. Update tier sizes and metrics
      await this.updateTierMetrics();
      
      // 7. Generate lifecycle insights
      await this.generateLifecycleInsights();

    } catch (error) {
      this.logger.error('❌ Error in data lifecycle cycle', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }

    const cycleTime = Date.now() - cycleStartTime;
    this.lifecycleMetrics.archiveLatencyMs = cycleTime;
    this.lifecycleMetrics.lastArchiveRun = new Date().toISOString();

    this.logger.info('✅ Data lifecycle cycle completed', {
      cycleTimeMs: cycleTime,
      propsArchived: this.lifecycleMetrics.propsArchived,
      storageReclaimed: this.lifecycleMetrics.storageReclaimed,
      tierSizes: {
        hot: this.lifecycleMetrics.hotTierSize,
        warm: this.lifecycleMetrics.warmTierSize,
        cold: this.lifecycleMetrics.coldTierSize
      }
    });
  }

  // Core Archiving Methods
  private async analyzeDataDistribution(): Promise<void> {
    this.logger.info('📊 Analyzing current data distribution...');

    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Cannot analyze data distribution without Supabase');
      return;
    }

    try {
      // Get current tier sizes
      const [hotCount, warmCount, coldCount] = await Promise.all([
        this.getTableCount('prop_ticks_hot'),
        this.getTableCount('features_daily_agg'),
        this.getTableCount('prop_ticks_archive')
      ]);

      this.lifecycleMetrics.hotTierSize = hotCount;
      this.lifecycleMetrics.warmTierSize = warmCount;
      this.lifecycleMetrics.coldTierSize = coldCount;

      // Check for retention policy violations
      const violations = await this.checkRetentionViolations();
      this.lifecycleMetrics.retentionPolicyViolations = violations;

      this.logger.info('📈 Data distribution analysis complete', {
        hotTier: hotCount,
        warmTier: warmCount,
        coldTier: coldCount,
        violations: violations,
        totalRecords: hotCount + warmCount + coldCount
      });

    } catch (error) {
      this.logger.error('❌ Failed to analyze data distribution', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async archiveHotToWarm(): Promise<void> {
    this.logger.info('🔥➡️💧 Archiving HOT tier to WARM tier...');

    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Cannot archive without Supabase');
      return;
    }

    try {
      const cutoffDate = this.calculateCutoffDate(this.retentionPolicy.hotTierDays);
      
      this.logger.info(`📦 Archiving prop_ticks_hot data older than ${cutoffDate}`);

      // Use our SQL function to archive HOT -> WARM
      const { data, error } = await withCircuitBreaker.supabase(
        async () => await this.requireSupabase().rpc('archive_hot_to_warm', {
          p_cutoff_date: cutoffDate
        }),
        async (): Promise<{data: number; error: null; count: null; status: number; statusText: string}> => {
          this.logger.warn('⚠️ Failed to archive HOT to WARM, circuit breaker open');
          return {
            data: 0,
            error: null,
            count: null,
            status: 200,
            statusText: 'OK'
          };
        }
      );

      if (error) throw error;

      const recordsProcessed = data || 0;
      this.lifecycleMetrics.propsArchived += recordsProcessed;
      
      this.logger.info(`✅ HOT to WARM archiving complete: ${recordsProcessed} props processed`);

    } catch (error) {
      this.logger.error('❌ Failed to archive HOT to WARM tier', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async archiveWarmToCold(): Promise<void> {
    this.logger.info('💧➡️🧊 Archiving WARM tier to COLD tier...');

    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Cannot archive without Supabase');
      return;
    }

    try {
      const cutoffDate = this.calculateCutoffDate(this.retentionPolicy.warmTierDays);
      
      this.logger.info(`📦 Archiving features_daily_agg data older than ${cutoffDate}`);

      // Use our SQL function to archive WARM -> COLD
      const { data, error } = await withCircuitBreaker.supabase(
        async () => await this.requireSupabase().rpc('archive_warm_to_cold', {
          p_cutoff_date: cutoffDate
        }),
        async (): Promise<{data: null; error: null; count: null; status: number; statusText: string}> => {
          this.logger.warn('⚠️ Failed to archive WARM to COLD, circuit breaker open');
          return {
            data: null,
            error: null,
            count: null,
            status: 200,
            statusText: 'OK'
          };
        }
      );

      if (error) throw error;

      const archiveId = data;
      if (archiveId) {
        this.logger.info(`✅ WARM to COLD archiving complete: archive ID ${archiveId}`);
        
        // TODO: Trigger Parquet export job here
        await this.triggerParquetExport(archiveId);
      } else {
        this.logger.info('ℹ️ No WARM tier records to archive');
      }

    } catch (error) {
      this.logger.error('❌ Failed to archive WARM to COLD tier', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async triggerParquetExport(archiveId: string): Promise<void> {
    this.logger.info(`📊 Triggering Parquet export for archive ${archiveId}`);
    
    try {
      // In production, this would trigger a background job to:
      // 1. Export features_daily_agg data to Parquet format
      // 2. Compress using Snappy or GZIP
      // 3. Upload to S3/Cloud Storage
      // 4. Update archive record with file path and compression ratio
      
      // For now, just log the export request
      await redisCache.set(
        `parquet_export:${archiveId}`,
        JSON.stringify({
          archiveId,
          status: 'pending',
          requestedAt: new Date().toISOString()
        }),
        3600 * 24 // 24 hour TTL
      );

      this.logger.info(`✅ Parquet export queued for archive ${archiveId}`);
      
    } catch (error) {
      this.logger.error(`❌ Failed to trigger Parquet export for ${archiveId}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async compressHistoricalData(): Promise<void> {
    this.logger.info('🗜️ Compressing historical data...');

    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Cannot compress data without Supabase');
      return;
    }

    try {
      // PostgreSQL VACUUM and compression
      await withCircuitBreaker.supabase(
        async () => {
          // Run VACUUM to reclaim space and update statistics
          await this.requireSupabase().rpc('vacuum_table', { table_name: 'raw_props_historical' });
          
          // Analyze table for query optimization
          await this.requireSupabase().rpc('analyze_table', { table_name: 'raw_props_historical' });
        },
        async () => {
          this.logger.warn('⚠️ Failed to compress historical data, circuit breaker open');
        }
      );

      this.lifecycleMetrics.propsCompressed++;
      this.logger.info('✅ Historical data compression complete');

    } catch (error) {
      this.logger.error('❌ Failed to compress historical data', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async deleteExpiredData(): Promise<void> {
    this.logger.info('🗑️ Deleting expired data...');

    const expiredCutoff = this.calculateCutoffDate(this.retentionPolicy.coldTierDays);
    
    try {
      if (!this.hasSupabase()) {
        this.logger.warn('⚠️ Cannot delete expired data without Supabase');
        return;
      }

      const expiredCount = await this.countRecordsToArchive('raw_props_historical', expiredCutoff);
      
      if (expiredCount === 0) {
        this.logger.info('ℹ️ No expired data to delete');
        return;
      }

      this.logger.warn(`🚨 Deleting ${expiredCount} expired records (older than ${this.retentionPolicy.coldTierDays} days)`);

      // Delete in batches
      let deletedRecords = 0;
      while (deletedRecords < expiredCount) {
        const batchSize = Math.min(this.retentionPolicy.batchSize, expiredCount - deletedRecords);
        
        await withCircuitBreaker.supabase(
          async () => {
            const { error } = await this.requireSupabase()
              .from('raw_props_historical')
              .delete()
              .lt('game_date', expiredCutoff)
              .limit(batchSize);

            if (error) throw error;
          },
          async () => {
            this.logger.warn('⚠️ Failed to delete batch, circuit breaker open');
          }
        );
        
        deletedRecords += batchSize;
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      this.lifecycleMetrics.propsDeleted += expiredCount;
      this.logger.info(`✅ Expired data deletion complete: ${expiredCount} records deleted`);

    } catch (error) {
      this.logger.error('❌ Failed to delete expired data', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Helper Methods
  private async ensureHistoricalTablesExist(): Promise<void> {
    this.logger.info('🏗️ Ensuring historical tables exist...');

    if (!this.hasSupabase()) {
      this.logger.warn('⚠️ Cannot create tables without Supabase');
      return;
    }

    try {
      // Create raw_props_recent table (if not exists)
      await withCircuitBreaker.supabase(
        async () => {
          await this.requireSupabase().rpc('create_table_if_not_exists', {
            table_name: 'raw_props_recent',
            table_schema: `
              CREATE TABLE IF NOT EXISTS raw_props_recent (
                LIKE raw_props INCLUDING ALL
              );
              
              CREATE INDEX IF NOT EXISTS idx_raw_props_recent_game_date 
              ON raw_props_recent(game_date);
              
              CREATE INDEX IF NOT EXISTS idx_raw_props_recent_scraped_at 
              ON raw_props_recent(scraped_at);
            `
          });
        },
        async () => {
          this.logger.warn('⚠️ Failed to create raw_props_recent table');
        }
      );

      // Create raw_props_historical table (if not exists)
      await withCircuitBreaker.supabase(
        async () => {
          await this.requireSupabase().rpc('create_table_if_not_exists', {
            table_name: 'raw_props_historical',
            table_schema: `
              CREATE TABLE IF NOT EXISTS raw_props_historical (
                LIKE raw_props INCLUDING ALL
              );
              
              CREATE INDEX IF NOT EXISTS idx_raw_props_historical_game_date 
              ON raw_props_historical(game_date);
              
              CREATE INDEX IF NOT EXISTS idx_raw_props_historical_player_name 
              ON raw_props_historical(player_name);
            `
          });
        },
        async () => {
          this.logger.warn('⚠️ Failed to create raw_props_historical table');
        }
      );

      this.logger.info('✅ Historical tables verified/created');

    } catch (error) {
      this.logger.error('❌ Failed to ensure historical tables exist', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private calculateCutoffDate(daysBack: number): string {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    return cutoff.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  private async getTableCount(tableName: string): Promise<number> {
    if (!this.hasSupabase()) return 0;

    try {
      const { count, error } = await this.requireSupabase()
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        this.logger.warn(`⚠️ Failed to count ${tableName}:`, error.message);
        return 0;
      }

      return count || 0;
    } catch (error) {
      this.logger.warn(`⚠️ Failed to count ${tableName}:`, error);
      return 0;
    }
  }

  private async countRecordsToArchive(tableName: string, cutoffDate: string): Promise<number> {
    if (!this.hasSupabase()) return 0;

    try {
      const { count, error } = await this.requireSupabase()
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .lt('game_date', cutoffDate);

      if (error) {
        this.logger.warn(`⚠️ Failed to count records to archive from ${tableName}:`, error.message);
        return 0;
      }

      return count || 0;
    } catch (error) {
      this.logger.warn(`⚠️ Failed to count records to archive from ${tableName}:`, error);
      return 0;
    }
  }

  private async _moveRecordsBatched(
    sourceTable: string,
    targetTable: string,
    cutoffDate: string,
    batchSize: number
  ): Promise<void> {
    if (!this.hasSupabase()) return;

    await withCircuitBreaker.supabase(
      async () => {
        // 1. Select records to move
        const { data: recordsToMove, error: selectError } = await this.requireSupabase()
          .from(sourceTable)
          .select('*')
          .lt('game_date', cutoffDate)
          .limit(batchSize);

        if (selectError) throw selectError;
        if (!recordsToMove || recordsToMove.length === 0) return;

        // 2. Insert into target table
        const { error: insertError } = await this.requireSupabase()
          .from(targetTable)
          .insert(recordsToMove);

        if (insertError) throw insertError;

        // 3. Delete from source table
        const recordIds = recordsToMove.map(record => record.id);
        const { error: deleteError } = await this.requireSupabase()
          .from(sourceTable)
          .delete()
          .in('id', recordIds);

        if (deleteError) throw deleteError;
      },
      async () => {
        this.logger.warn(`⚠️ Failed to move batch from ${sourceTable} to ${targetTable}`);
      }
    );
  }

  private async checkRetentionViolations(): Promise<number> {
    let violations = 0;

    try {
      // Check if hot tier has old data
      const hotViolations = await this.countRecordsToArchive(
        'raw_props',
        this.calculateCutoffDate(this.retentionPolicy.hotTierDays)
      );

      // Check if warm tier has old data
      const warmViolations = await this.countRecordsToArchive(
        'raw_props_recent',
        this.calculateCutoffDate(this.retentionPolicy.warmTierDays)
      );

      violations = hotViolations + warmViolations;

      if (violations > 0) {
        this.logger.warn(`⚠️ Retention policy violations detected: ${violations} records`);
      }

    } catch (error) {
      this.logger.error('❌ Failed to check retention violations', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return violations;
  }

  private async updateTierMetrics(): Promise<void> {
    try {
      const [hotCount, warmCount, coldCount] = await Promise.all([
        this.getTableCount('raw_props'),
        this.getTableCount('raw_props_recent'),
        this.getTableCount('raw_props_historical')
      ]);

      this.lifecycleMetrics.hotTierSize = hotCount;
      this.lifecycleMetrics.warmTierSize = warmCount;
      this.lifecycleMetrics.coldTierSize = coldCount;

    } catch (error) {
      this.logger.error('❌ Failed to update tier metrics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async validateRetentionPolicy(): Promise<void> {
    if (this.retentionPolicy.hotTierDays >= this.retentionPolicy.warmTierDays) {
      throw new Error('Hot tier retention must be less than warm tier retention');
    }

    if (this.retentionPolicy.warmTierDays >= this.retentionPolicy.coldTierDays) {
      throw new Error('Warm tier retention must be less than cold tier retention');
    }

    this.logger.info('✅ Retention policy validated', this.retentionPolicy);
  }

  private async loadLifecycleMetrics(): Promise<void> {
    try {
      const cached = await redisCache.get('lifecycle:metrics');
      if (cached) {
        const previousMetrics = JSON.parse(cached);
        this.lifecycleMetrics = { ...this.lifecycleMetrics, ...previousMetrics };
      }
    } catch (error) {
      this.logger.warn('⚠️ Failed to load previous lifecycle metrics');
    }
  }

  private async generateLifecycleInsights(): Promise<void> {
    const insights = {
      retentionPolicy: this.retentionPolicy,
      tierDistribution: {
        hot: this.lifecycleMetrics.hotTierSize,
        warm: this.lifecycleMetrics.warmTierSize,
        cold: this.lifecycleMetrics.coldTierSize,
        total: this.lifecycleMetrics.hotTierSize + this.lifecycleMetrics.warmTierSize + this.lifecycleMetrics.coldTierSize
      },
      archivingStats: {
        propsArchived: this.lifecycleMetrics.propsArchived,
        propsCompressed: this.lifecycleMetrics.propsCompressed,
        propsDeleted: this.lifecycleMetrics.propsDeleted,
        storageReclaimed: this.lifecycleMetrics.storageReclaimed
      },
      performanceMetrics: {
        lastArchiveLatency: this.lifecycleMetrics.archiveLatencyMs,
        retentionViolations: this.lifecycleMetrics.retentionPolicyViolations
      },
      timestamp: new Date().toISOString()
    };

    // Cache insights for monitoring dashboard
    await redisCache.set(
      'lifecycle:insights',
      JSON.stringify(insights),
      3600 // 1 hour TTL
    );

    // Cache metrics for next run
    await redisCache.set(
      'lifecycle:metrics',
      JSON.stringify(this.lifecycleMetrics),
      86400 // 24 hours TTL
    );

    this.logger.info('📊 Lifecycle insights generated', {
      totalRecords: insights.tierDistribution.total,
      hotTierPercent: (insights.tierDistribution.hot / insights.tierDistribution.total * 100).toFixed(1),
      archivingEfficiency: this.lifecycleMetrics.archiveLatencyMs < 60000 ? 'excellent' : 'needs_optimization'
    });
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('🧹 DataLifecycleAgent cleanup...');
    
    // Save final metrics
    await redisCache.set(
      'lifecycle:metrics',
      JSON.stringify(this.lifecycleMetrics),
      86400
    );
    
    this.logger.info('✅ DataLifecycleAgent cleanup complete');
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    return {
      ...this.lifecycleMetrics,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  public async checkHealth(): Promise<any> {
    const checks: Array<{ component: string; status: string; details?: any }> = [];

    // Check if retention policy is being followed
    checks.push({
      component: 'retention_policy',
      status: this.lifecycleMetrics.retentionPolicyViolations === 0 ? 'healthy' : 'degraded'
    });

    // Check archiving performance
    checks.push({
      component: 'archiving_performance',
      status: this.lifecycleMetrics.archiveLatencyMs < 300000 ? 'healthy' : 'degraded' // 5 minutes max
    });

    // Check tier balance
    const totalRecords = this.lifecycleMetrics.hotTierSize + this.lifecycleMetrics.warmTierSize + this.lifecycleMetrics.coldTierSize;
    const hotTierPercent = totalRecords > 0 ? (this.lifecycleMetrics.hotTierSize / totalRecords) : 0;
    
    checks.push({
      component: 'tier_balance',
      status: hotTierPercent < 0.1 ? 'healthy' : 'degraded' // Hot tier should be <10% of total
    });

    const healthyComponents = checks.filter(c => c.status === 'healthy').length;
    const overallStatus = healthyComponents === checks.length ? 'healthy' : 
                         healthyComponents >= checks.length / 2 ? 'degraded' : 'unhealthy';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      details: {
        checks,
        metrics: this.lifecycleMetrics,
        retentionPolicy: this.retentionPolicy,
        tierDistribution: {
          hot: this.lifecycleMetrics.hotTierSize,
          warm: this.lifecycleMetrics.warmTierSize,
          cold: this.lifecycleMetrics.coldTierSize,
          hotTierPercent: (hotTierPercent * 100).toFixed(1) + '%'
        }
      }
    };
  }
}