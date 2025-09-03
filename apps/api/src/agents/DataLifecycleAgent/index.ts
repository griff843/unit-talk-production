import { redisCache } from '../../cache/enhanced-cache';
import { withCircuitBreaker } from '../../services/enhanced-circuit-breaker';
import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics } from '../BaseAgent/types';

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

interface ArchiveOperation {
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
 * - Hot Tier (raw_props): Current day props for live betting
 * - Warm Tier (raw_props_recent): Last 30 days for analytics  
 * - Cold Tier (raw_props_historical): 30+ days for backtesting
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
      hotTierDays: parseInt(process.env.HOT_TIER_RETENTION_DAYS || '1'),      // 1 day in hot
      warmTierDays: parseInt(process.env.WARM_TIER_RETENTION_DAYS || '30'),   // 30 days in warm
      coldTierDays: parseInt(process.env.COLD_TIER_RETENTION_DAYS || '365'),  // 1 year in cold
      compressionEnabled: process.env.COMPRESSION_ENABLED === 'true',
      autoDeleteEnabled: process.env.AUTO_DELETE_ENABLED === 'true',
      batchSize: parseInt(process.env.ARCHIVE_BATCH_SIZE || '10000')
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
      
      // 2. Archive hot tier to warm tier (raw_props -> raw_props_recent)
      await this.archiveHotToWarm();
      
      // 3. Archive warm tier to cold tier (raw_props_recent -> raw_props_historical)
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
        this.getTableCount('raw_props'),
        this.getTableCount('raw_props_recent'),
        this.getTableCount('raw_props_historical')
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
    this.logger.info('🔥➡️💧 Archiving hot tier to warm tier...');

    const cutoffDate = this.calculateCutoffDate(this.retentionPolicy.hotTierDays);
    
    const operation: ArchiveOperation = {
      sourceTable: 'raw_props',
      targetTable: 'raw_props_recent',
      recordsToMove: 0,
      cutoffDate
    };

    try {
      // Count records to archive
      operation.recordsToMove = await this.countRecordsToArchive('raw_props', cutoffDate);
      
      if (operation.recordsToMove === 0) {
        this.logger.info('ℹ️ No hot tier records to archive');
        return;
      }

      this.logger.info(`📦 Archiving ${operation.recordsToMove} records from hot to warm tier`);

      // Move records in batches to avoid blocking
      let movedRecords = 0;
      while (movedRecords < operation.recordsToMove) {
        const batchSize = Math.min(this.retentionPolicy.batchSize, operation.recordsToMove - movedRecords);
        
        await this.moveRecordsBatched(
          operation.sourceTable,
          operation.targetTable,
          cutoffDate,
          batchSize
        );
        
        movedRecords += batchSize;
        
        // Small delay between batches to avoid overwhelming database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.lifecycleMetrics.propsArchived += operation.recordsToMove;
      
      this.logger.info(`✅ Hot to warm archiving complete: ${operation.recordsToMove} records moved`);

    } catch (error) {
      this.logger.error('❌ Failed to archive hot to warm tier', {
        error: error instanceof Error ? error.message : 'Unknown error',
        operation
      });
      throw error;
    }
  }

  private async archiveWarmToCold(): Promise<void> {
    this.logger.info('💧➡️🧊 Archiving warm tier to cold tier...');

    const cutoffDate = this.calculateCutoffDate(this.retentionPolicy.warmTierDays);
    
    const operation: ArchiveOperation = {
      sourceTable: 'raw_props_recent',
      targetTable: 'raw_props_historical',
      recordsToMove: 0,
      cutoffDate
    };

    try {
      operation.recordsToMove = await this.countRecordsToArchive('raw_props_recent', cutoffDate);
      
      if (operation.recordsToMove === 0) {
        this.logger.info('ℹ️ No warm tier records to archive');
        return;
      }

      this.logger.info(`📦 Archiving ${operation.recordsToMove} records from warm to cold tier`);

      let movedRecords = 0;
      while (movedRecords < operation.recordsToMove) {
        const batchSize = Math.min(this.retentionPolicy.batchSize, operation.recordsToMove - movedRecords);
        
        await this.moveRecordsBatched(
          operation.sourceTable,
          operation.targetTable,
          cutoffDate,
          batchSize
        );
        
        movedRecords += batchSize;
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.lifecycleMetrics.propsArchived += operation.recordsToMove;
      
      this.logger.info(`✅ Warm to cold archiving complete: ${operation.recordsToMove} records moved`);

    } catch (error) {
      this.logger.error('❌ Failed to archive warm to cold tier', {
        error: error instanceof Error ? error.message : 'Unknown error',
        operation
      });
      throw error;
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

  private async moveRecordsBatched(
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
    const checks = [];

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