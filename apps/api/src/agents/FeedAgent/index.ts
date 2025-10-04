import { createBaseAgentConfig } from '../BaseAgent/config';
import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, HealthStatus, BaseMetrics } from '../BaseAgent/types';

import { FeedAgentConfigSchema, FeedAgentConfig, FeedMetrics, RawProp } from './types';
import { normalizePublicProps, dedupePublicProps } from './utils';
import { lineShoppingIntegration, PropWithLineAnalysis } from './LineShoppingIntegration';

// NEW: Cache-first unified picks integration
import { CacheFirstUnifiedPicksService } from '../../services/CacheFirstUnifiedPicksService';
import { cachedOddsApiClient } from '../../services/cachedOddsApiClient';
import { UnifiedPick } from '../../db/unifiedPicksRepo';
import { parseCliArgs, validateCliArgs, createFeedAgentConfigFromCli, displayHelp } from '../../utils/cliArgs';
import { logger } from '../../shared/logger';
import { featureFlags, FeatureFlags } from '../../services/featureFlags';

/**
 * Create a proper FeedAgent configuration that extends BaseAgentConfig
 */
function createFeedAgentConfig(config: any): BaseAgentConfig & { feedConfig?: FeedAgentConfig } {
  // Create base config first
  const baseConfig = createBaseAgentConfig(config);

  // Try to parse feed-specific config, but don't fail if it's incomplete
  let feedConfig: FeedAgentConfig | undefined;
  try {
    feedConfig = FeedAgentConfigSchema.parse(config);
  } catch (error) {
    // If feed config validation fails, create a minimal valid config
    feedConfig = {
      name: config.name || 'FeedAgent',
      enabled: config.enabled ?? true,
      version: config.version || '1.0.0',
      logLevel: config.logLevel || 'info',
      metrics: { enabled: true },
      retryConfig: {
        maxRetries: 3,
        backoffMs: 1000,
        maxBackoffMs: 30000
      },
      providers: config.providers || {},
      dedupeConfig: {
        checkInterval: 300,
        ttlHours: 24
      }
    };
  }

  return { ...baseConfig, feedConfig };
}

/**
 * FeedAgent handles fetching, normalizing, and processing sports betting props
 * directly to unified_picks table using cache-first architecture.
 *
 * NEW FEATURES:
 * - Direct unified_picks writes (skips raw_props)
 * - Cache-first provider calls with Redis coordination
 * - CLI flags support (--rate, --batch, --sports, --books)
 * - Credit usage tracking and monitoring
 * - Workflow integration with processing stages
 * - Feature flag support for rollout phases
 */
export class FeedAgent extends BaseAgent {
  private feedMetrics: FeedMetrics;
  private fullConfig: FeedAgentConfig;

  // NEW: Cache-first services
  private unifiedPicksService: CacheFirstUnifiedPicksService;
  private cachedClient = cachedOddsApiClient;

  // NEW: CLI configuration support
  private cliConfig?: any;

  // NEW: Batch and workflow tracking
  private currentBatchId?: string;
  private processingPriority: number = 1;

  // NEW: Feature flags
  private flags: FeatureFlags;

  constructor(config: BaseAgentConfig | any, deps: BaseAgentDependencies) {
    // Handle CLI args if provided
    if (config.cliArgs) {
      const parsed = parseCliArgs(config.cliArgs);
      validateCliArgs(parsed.args);

      if (parsed.args.help) {
        displayHelp();
        process.exit(0);
      }

      config = { ...config, ...createFeedAgentConfigFromCli(parsed.args) };
    }

    // Create a proper configuration that works with BaseAgent
    const enhancedConfig = createFeedAgentConfig(config);
    super(enhancedConfig, deps);

    // Initialize cache-first services
    this.unifiedPicksService = CacheFirstUnifiedPicksService.getInstance();

    // Load feature flags
    this.flags = featureFlags.getFlags();

    // Use the feed-specific config if available, otherwise create defaults
    this.fullConfig = enhancedConfig.feedConfig || {
      name: enhancedConfig.name,
      enabled: enhancedConfig.enabled || true,
      version: enhancedConfig.version || '1.0.0',
      logLevel: 'info',
      metrics: { enabled: true },
      retryConfig: {
        maxRetries: 3,
        backoffMs: 1000,
        maxBackoffMs: 30000
      },
      providers: {},
      dedupeConfig: {
        checkInterval: 300,
        ttlHours: 24
      }
    };

    this.feedMetrics = {
      totalProps: 0,
      uniqueProps: 0,
      duplicates: 0,
      errors: 0,
      latencyMs: 0,
      providerStats: {
        SportsGameOdds: { success: 0, failed: 0, avgLatencyMs: 0 },
        OddsAPI: { success: 0, failed: 0, avgLatencyMs: 0 },
        Pinnacle: { success: 0, failed: 0, avgLatencyMs: 0 },
        Optimal: { success: 0, failed: 0, avgLatencyMs: 0 }
      }
    };
  }

  protected async initialize(): Promise<void> {
    this.logger.info('🚀 Initializing FeedAgent with cache-first unified_picks integration...');

    // Validate dependencies
    await this.validateDependencies();

    // Warm up caches if enabled
    if (this.fullConfig.cacheFirst !== false) {
      try {
        await this.cachedClient.warmupCache(this.fullConfig.sports, this.fullConfig.providers);
        await this.unifiedPicksService.warmupCache();
        this.logger.info('✅ Cache warmup completed');
      } catch (error) {
        this.logger.warn('⚠️ Cache warmup failed', { error: (error as Error).message });
      }
    }

    // Generate batch ID for this processing session
    this.currentBatchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.logger.info('✅ FeedAgent initialization complete', {
      batchId: this.currentBatchId,
      cacheEnabled: this.fullConfig.cacheFirst !== false,
      sports: this.fullConfig.sports || ['ALL'],
      batchSize: this.fullConfig.batchSize || 100,
      featureFlags: featureFlags.getRolloutConfig(),
      shadowMode: featureFlags.isShadowModeEnabled()
    });
  }

  protected async process(): Promise<void> {
    this.logger.info('🔄 Processing feed data with cache-first unified_picks writes...');

    try {
      // NEW: Process sports-based configuration instead of providers
      const sports = this.fullConfig.sports || ['NFL', 'NBA', 'MLB', 'NHL'];

      for (const sport of sports) {
        // Check feature flags
        if (!featureFlags.isSportEnabled(sport)) {
          this.logger.info(`⚠️ FEATURE FLAG: Sport ${sport} disabled, skipping`);
          continue;
        }

        if (this.fullConfig.dryRun) {
          this.logger.info(`🏃‍♂️ DRY RUN: Would process ${sport}`);
          continue;
        }

        // Check if we should use new unified picks approach
        if (featureFlags.shouldUseUnifiedPicksDirectWrite()) {
          await this.processSport(sport);
        } else {
          this.logger.info(`📛 FEATURE FLAG: Unified picks direct write disabled for ${sport}, using legacy processing`);
          // Could add fallback to legacy raw_props processing here
        }
      }

      // Record credit usage for monitoring
      await this.recordCreditUsage();

    } catch (error) {
      this.logger.error('Failed to process feed data', {
        err: error instanceof Error ? error.message : String(error),
        batchId: this.currentBatchId
      });
      throw error;
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('🧹 FeedAgent cleanup starting...');

    try {
      // Log final metrics
      this.logger.info('📈 Final processing metrics', {
        batchId: this.currentBatchId,
        metrics: this.feedMetrics,
        cacheMetrics: this.unifiedPicksService.getMetrics()
      });

      // Clear any temporary cache entries
      // (Production cache entries will expire naturally)

    } catch (error) {
      this.logger.warn('Cleanup warning', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    this.logger.info('✅ FeedAgent cleanup completed');
  }

  public async checkHealth(): Promise<HealthStatus> {
    try {
      const errorRate = this.feedMetrics.errors / Math.max(this.feedMetrics.totalProps, 1);
      const status = errorRate > 0.1 ? 'unhealthy' : errorRate > 0.05 ? 'degraded' : 'healthy';

      return {
        status,
        timestamp: new Date().toISOString(),
        details: {
          errorRate,
          metrics: this.feedMetrics
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: {
          err: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  public async collectMetrics(): Promise<BaseMetrics> {
    return {
      agentName: this.fullConfig.name,
      successCount: this.feedMetrics.totalProps - this.feedMetrics.errors,
      errorCount: this.feedMetrics.errors,
      warningCount: this.feedMetrics.duplicates,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  private async validateDependencies(): Promise<void> {
    // Check database connectivity
    if (!this.supabase) {
      throw new Error('Supabase client is required for FeedAgent');
    }
    const { error } = await this.supabase
      .from('sports_game_odds')
      .select('id')
      .limit(1);

    if (error) {
      throw new Error(`Database connectivity check failed: ${error.message}`);
    }
  }

  /**
   * NEW: Process a single sport using cache-first provider calls
   */
  private async processSport(sport: string): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.info(`🏀 Starting cache-first processing for ${sport}`);

      // Determine optimal provider for this sport
      const primarySource = this.getPrimarySource(sport);

      // Check if we should use cache-first approach
      const shouldUseCache = featureFlags.shouldUseCacheFirst();

      let result: any;

      if (shouldUseCache) {
        // NEW: Cache-first approach
        result = await this.cachedClient.getCachedData({
          source: primarySource,
          sport,
          market: 'player-props',
          params: {
            limit: this.fullConfig.batchSize || 100
          }
        });
      } else {
        // FALLBACK: Direct API call (legacy mode)
        this.logger.info(`📛 FEATURE FLAG: Cache-first disabled, using direct API calls`);

        // Import the legacy data source router
        const { fetchUnifiedData } = await import('./dataSourceRouter');

        result = await fetchUnifiedData({
          sport,
          marketType: 'player-props' as any,
          date: new Date().toISOString().split('T')[0]
        });
      }

      // Shadow mode: Compare both approaches if enabled
      if (featureFlags.isShadowModeEnabled() && shouldUseCache) {
        try {
          this.logger.info(`🕵️ SHADOW MODE: Running parallel legacy comparison for ${sport}`);

          // Run legacy approach in parallel
          const { fetchUnifiedData } = await import('./dataSourceRouter');
          const legacyResult = await fetchUnifiedData({
            sport,
            marketType: 'player-props' as any,
            date: new Date().toISOString().split('T')[0]
          });

          // Compare results
          this.compareShadowModeResults(result, legacyResult, sport);

        } catch (shadowError) {
          this.logger.warn(`⚠️ SHADOW MODE: Legacy comparison failed for ${sport}`, {
            error: shadowError instanceof Error ? shadowError.message : String(shadowError)
          });
        }
      }

      this.logger.info(`📊 ${sport}: Fetched ${Array.isArray(result.data) ? result.data.length : 1} props from ${result.source}`, {
        fromCache: result.fromCache,
        creditUsed: result.creditUsed,
        cacheKey: result.cacheKey.substring(0, 50) + '...'
      });

      if (Array.isArray(result.data) && result.data.length > 0) {
        // Transform to unified picks and process
        const unifiedPicks = await this.transformToUnifiedPicks(result.data, sport, result.source);

        // Process with deduplication and validation
        await this.processUnifiedPicks(unifiedPicks);
      }

      // Update provider stats
      this.updateProviderStats(result.source, Date.now() - startTime, result.creditUsed, !result.fromCache);

    } catch (error) {
      this.logger.error(`Sport processing failed: ${sport}`, {
        error: error instanceof Error ? error.message : String(error),
        batchId: this.currentBatchId
      });
      this.feedMetrics.errors++;
      throw error;
    }
  }

  /**
   * NEW: Transform raw props to UnifiedPick objects
   */
  private async transformToUnifiedPicks(rawData: any[], sport: string, source: string): Promise<UnifiedPick[]> {
    const picks: UnifiedPick[] = [];

    for (const rawProp of rawData) {
      try {
        // Create unified pick object
        const pick: UnifiedPick = {
          userId: 'system', // System-generated picks
          pickSource: 'promoted', // Coming from FeedAgent promotion
          pickType: 'single',
          outcome: this.determineOutcome(rawProp),
          line: parseFloat(String(rawProp.line)) || undefined,
          odds: parseFloat(String(rawProp.over_odds || rawProp.odds)) || undefined,
          confidence: this.calculateInitialConfidence(rawProp),

          // NEW: Workflow integration
          workflowStage: 'ingested',
          status: 'pending',
          published: false,

          // Metadata
          analysis: JSON.stringify({
            sport,
            source,
            playerName: rawProp.player_name,
            statType: rawProp.stat_type || rawProp.market,
            team: rawProp.team,
            opponent: rawProp.opponent,
            gameDate: rawProp.game_date,
            fetchedAt: new Date().toISOString(),
            batchId: this.currentBatchId
          }),

          groupKey: `${sport}_${rawProp.player_name}_${rawProp.stat_type || rawProp.market}_${this.currentBatchId}`,
          isInstant: true,
          placedAt: new Date().toISOString()
        };

        picks.push(pick);

      } catch (error) {
        this.logger.warn('Failed to transform raw prop to unified pick', {
          error: error instanceof Error ? error.message : String(error),
          rawProp: rawProp.id || 'unknown'
        });
      }
    }

    this.logger.info(`✅ Transformed ${picks.length}/${rawData.length} props to unified picks`);
    return picks;
  }

  /**
   * Determine outcome/direction for a prop
   */
  private determineOutcome(rawProp: any): string {
    // Default to 'over' unless we have specific logic
    if (rawProp.direction) {
      return rawProp.direction;
    }

    // Use better odds to determine direction
    const overOdds = parseFloat(String(rawProp.over_odds || rawProp.over)) || 0;
    const underOdds = parseFloat(String(rawProp.under_odds || rawProp.under)) || 0;

    if (overOdds > 0 && underOdds > 0) {
      return overOdds > underOdds ? 'under' : 'over';
    }

    if (overOdds < 0 && underOdds < 0) {
      return Math.abs(overOdds) < Math.abs(underOdds) ? 'over' : 'under';
    }

    return 'over'; // Default fallback
  }

  /**
   * Calculate initial confidence based on available data
   */
  private calculateInitialConfidence(rawProp: any): number {
    // Start with base confidence
    let confidence = 0.5;

    // Boost confidence for major sports
    const majorSports = ['NFL', 'NBA', 'MLB', 'NHL'];
    if (majorSports.includes(rawProp.sport?.toUpperCase())) {
      confidence += 0.1;
    }

    // Boost confidence if we have both sides of the bet
    if (rawProp.over_odds && rawProp.under_odds) {
      confidence += 0.1;
    }

    // Boost confidence for reasonable odds
    const odds = parseFloat(String(rawProp.over_odds || rawProp.odds)) || 0;
    if (odds >= -200 && odds <= 200) {
      confidence += 0.1;
    }

    return Math.min(0.95, Math.max(0.1, confidence));
  }

  /**
   * NEW: Process unified picks with cache coordination and deduplication
   */
  private async processUnifiedPicks(picks: UnifiedPick[]): Promise<void> {
    if (picks.length === 0) {
      this.logger.info('No unified picks to process');
      return;
    }

    this.logger.info(`🔄 Processing ${picks.length} unified picks with cache-first writes...`);
    const startTime = Date.now();

    try {
      // NEW: Deduplicate against existing unified picks
      const deduplicatedPicks = await this.deduplicateUnifiedPicks(picks);

      if (deduplicatedPicks.length === 0) {
        this.logger.info('✅ All picks were duplicates - no new data to process');
        return;
      }

      this.logger.info(`📋 After deduplication: ${deduplicatedPicks.length}/${picks.length} picks are new`);

      // Process in batches using cache-first service
      const batchSize = this.fullConfig.batchSize || 100;
      let totalProcessed = 0;
      let totalErrors = 0;

      for (let i = 0; i < deduplicatedPicks.length; i += batchSize) {
        const batch = deduplicatedPicks.slice(i, i + batchSize);

        try {
          // Process batch through cache-first service
          const results = await Promise.allSettled(
            batch.map(pick => this.unifiedPicksService.createPick({
              ...pick,
              // Add processing metadata
              analysis: JSON.stringify({
                ...(pick.analysis ? JSON.parse(pick.analysis) : {}),
                processingPriority: this.processingPriority,
                batchId: this.currentBatchId,
                processedAt: new Date().toISOString()
              })
            }))
          );

          // Count successes and failures
          const successful = results.filter(r => r.status === 'fulfilled').length;
          const failed = results.filter(r => r.status === 'rejected').length;

          totalProcessed += successful;
          totalErrors += failed;

          this.logger.info(`📦 Batch ${Math.floor(i / batchSize) + 1}: ${successful} created, ${failed} errors`);

          // Log errors for debugging
          results.forEach((result, index) => {
            if (result.status === 'rejected') {
              this.logger.warn('Pick creation failed', {
                batchIndex: index,
                error: result.reason instanceof Error ? result.reason.message : String(result.reason),
                pickId: batch[index]?.groupKey
              });
            }
          });

          // Small delay between batches to avoid overwhelming the system
          if (i + batchSize < deduplicatedPicks.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

        } catch (error) {
          this.logger.error('Batch processing failed', {
            batchStart: i,
            batchSize: batch.length,
            error: error instanceof Error ? error.message : String(error)
          });
          totalErrors += batch.length;
        }
      }

      // Update metrics
      this.feedMetrics.uniqueProps += totalProcessed;
      this.feedMetrics.duplicates += picks.length - deduplicatedPicks.length;
      this.feedMetrics.errors += totalErrors;
      this.feedMetrics.totalProps += picks.length;

      const duration = Date.now() - startTime;
      const picksPerSecond = Math.round((picks.length / duration) * 1000);

      this.logger.info(`✅ Unified picks processing complete in ${duration}ms (${picksPerSecond} picks/sec)`, {
        totalProcessed,
        totalErrors,
        duplicatesSkipped: picks.length - deduplicatedPicks.length,
        batchId: this.currentBatchId
      });

    } catch (error) {
      this.logger.error('❌ Unified picks processing failed', {
        error: error instanceof Error ? error.message : String(error),
        batchId: this.currentBatchId
      });
      throw error;
    }
  }

  /**
   * Process props with HOT storage architecture
   */
  private async processWithHotStorage(props: RawProp[]): Promise<any> {
    // Import and initialize HOT data integration
    const { HotDataIntegration } = await import('./HotDataIntegration');
    const hotDataIntegration = new HotDataIntegration(this.supabase!, this.logger, {
      batchSize: 500,
      maxParallelBatches: 5,
      hotTableEnabled: true,
      enableSteamDetection: true,
      enableMarketIntelligence: true
    });

    // Process props with dual write to raw_props and prop_ticks_hot
    return await hotDataIntegration.processPropsWithHotStorage(props);
  }

  /**
   * Process props with line shopping analysis
   */
  private async processWithLineShoppingAnalysis(props: PropWithLineAnalysis[]): Promise<any> {
    try {
      // Determine sport from props for optimization
      const sports = [...new Set(props.map(p => p.sport))];
      const primarySport = sports.length === 1 ? sports[0] : undefined;

      // Run line shopping analysis
      const result = await lineShoppingIntegration.processPropsWithLineAnalysis(props, primarySport);

      // Update processed props in database with line shopping results
      await this.updatePropsWithLineShoppingResults(result.processedProps);

      return result;

    } catch (error) {
      this.logger.error('❌ Line shopping analysis failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update props in database with line shopping results
   */
  private async updatePropsWithLineShoppingResults(processedProps: PropWithLineAnalysis[]): Promise<void> {
    if (!this.supabase) {
      return;
    }

    try {
      const updates = processedProps
        .filter(prop => prop.analysisCompleted && prop.lineAnalysis)
        .map(prop => ({
          id: prop.id,
          best_available_line: prop.bestOdds,
          best_book: prop.bestSource,
          ev_percent: prop.edgeValue,
          clv_tracking_id: prop.clvTrackingId,
          line_shopping_completed: true,
          line_shopping_timestamp: new Date().toISOString()
        }));

      if (updates.length === 0) {
        return;
      }

      // Batch update props with line shopping results
      const BATCH_SIZE = 100;
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);

        const { error } = await this.supabase
          .from('sports_game_odds')
          .upsert(batch, {
            onConflict: 'id',
            ignoreDuplicates: false
          });

        if (error) {
          this.logger.error('❌ Failed to update props with line shopping results', {
            batch: i / BATCH_SIZE + 1,
            error: error.message
          });
        }
      }

      this.logger.info(`📊 Updated ${updates.length} props with line shopping results`);

    } catch (error) {
      this.logger.error('❌ Failed to update props with line shopping results', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * NEW: Deduplicate unified picks against existing data
   */
  private async deduplicateUnifiedPicks(picks: UnifiedPick[]): Promise<UnifiedPick[]> {
    const deduplicatedPicks: UnifiedPick[] = [];
    const duplicateKeys = new Set<string>();

    for (const pick of picks) {
      // Create a deduplication key using external IDs for proper matching
      const dedupeKey = pick.externalPropId ||
                        `${pick.externalGameId}_${pick.market}_${pick.outcome}_${pick.line}`;

      if (duplicateKeys.has(dedupeKey)) {
        // Skip duplicate within current batch
        continue;
      }

      // Check against existing picks in database using proper filters
      try {
        const supabase = this.unifiedPicksService['supabase'];

        // Get bookmaker_key from metadata
        const bookmakerKey = pick.metadata?.bookmaker_key || 'unknown';

        // Query with proper filters: external IDs, market, AND bookmaker_key
        let query = supabase
          .from('unified_picks')
          .select('id')
          .eq('external_game_id', pick.externalGameId)
          .eq('market', pick.market)
          .eq('metadata->>bookmaker_key', bookmakerKey);  // CRITICAL: Include bookmaker

        // Add external_prop_id filter if it exists (for player props)
        if (pick.externalPropId) {
          query = query.eq('external_prop_id', pick.externalPropId);
        } else {
          // For non-player props, match on outcome and line
          query = query
            .eq('outcome', pick.outcome)
            .eq('line', pick.line);
        }

        const { data: existingPicks } = await query.limit(1);

        if (!existingPicks || existingPicks.length === 0) {
          duplicateKeys.add(dedupeKey);
          deduplicatedPicks.push(pick);
        }

      } catch (error) {
        // If deduplication check fails, include the pick to be safe
        this.logger.warn('Deduplication check failed, including pick', {
          error: error instanceof Error ? error.message : String(error),
          externalGameId: pick.externalGameId
        });

        duplicateKeys.add(dedupeKey);
        deduplicatedPicks.push(pick);
      }
    }

    return deduplicatedPicks;
  }

  /**
   * Get primary source for a sport based on routing logic
   */
  private getPrimarySource(sport: string): 'odds-api' | 'sgo-api' | 'optimal-api' {
    switch (sport.toUpperCase()) {
      case 'NCAAF':
      case 'NCAAB':
      case 'WNBA':
      case 'EPL':
      case 'ATP':
        return 'odds-api';

      default:
        return 'optimal-api'; // Optimal API is primary for major sports (NFL, NBA, MLB, NHL)
    }
  }

  /**
   * Update provider statistics
   */
  private updateProviderStats(source: string, latencyMs: number, creditsUsed: number, wasApiCall: boolean): void {
    const providerKey = source === 'sgo-api' ? 'SportsGameOdds' :
                       source === 'odds-api' ? 'OddsAPI' :
                       source === 'optimal-api' ? 'Optimal' : 'Unknown';

    if (this.feedMetrics.providerStats[providerKey]) {
      if (wasApiCall) {
        this.feedMetrics.providerStats[providerKey].success++;
      }
      this.feedMetrics.providerStats[providerKey].avgLatencyMs = latencyMs;
    }
  }

  /**
   * NEW: Record credit usage for monitoring
   */
  private async recordCreditUsage(): Promise<void> {
    try {
      const creditUsage = await this.cachedClient.getCreditUsage();

      this.logger.info('📊 Credit usage summary', {
        oddsApi: creditUsage.oddsApi,
        sgo: creditUsage.sgo.status,
        optimal: creditUsage.optimal.status,
        batchId: this.currentBatchId
      });

      // Store credit usage in database for monitoring
      if (this.supabase) {
        await this.supabase.from('ops_credit_usage').insert({
          batch_id: this.currentBatchId,
          odds_api_used: creditUsage.oddsApi.used,
          odds_api_remaining: creditUsage.oddsApi.remaining,
          sgo_status: creditUsage.sgo.status,
          optimal_status: creditUsage.optimal.status,
          recorded_at: new Date().toISOString()
        });
      }

    } catch (error) {
      this.logger.warn('Failed to record credit usage', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Compare shadow mode results between new and legacy approaches
   */
  private compareShadowModeResults(newResult: any, legacyResult: any, sport: string): void {
    const shadowConfig = featureFlags.getShadowModeConfig();

    if (!shadowConfig.enabled) return;

    try {
      const newCount = Array.isArray(newResult.data) ? newResult.data.length : 0;
      const legacyCount = Array.isArray(legacyResult.data) ? legacyResult.data.length : 0;

      const difference = Math.abs(newCount - legacyCount);
      const percentDiff = legacyCount > 0 ? (difference / legacyCount) * 100 : 0;

      const comparisonResult = {
        sport,
        newApproach: {
          count: newCount,
          source: newResult.source,
          fromCache: newResult.fromCache,
          creditUsed: newResult.creditUsed || 0
        },
        legacyApproach: {
          count: legacyCount,
          source: legacyResult.source,
          creditUsed: 1 // Legacy always uses API credits
        },
        difference: {
          absolute: difference,
          percentage: percentDiff
        },
        timestamp: new Date().toISOString(),
        batchId: this.currentBatchId
      };

      if (shadowConfig.logDifferences) {
        this.logger.info(`🔍 SHADOW MODE COMPARISON: ${sport}`, comparisonResult);
      }

      // Check if difference exceeds threshold
      if (percentDiff > (shadowConfig.maxDifferenceThreshold * 100)) {
        this.logger.warn(`⚠️ SHADOW MODE: Significant difference detected for ${sport}`, {
          percentDiff,
          threshold: shadowConfig.maxDifferenceThreshold * 100,
          ...comparisonResult
        });

        if (shadowConfig.failOnDifferences) {
          throw new Error(`Shadow mode validation failed: ${percentDiff}% difference exceeds threshold`);
        }
      } else {
        this.logger.debug(`✅ SHADOW MODE: Results within acceptable range for ${sport}`);
      }

      // Store comparison results for analysis
      if (this.supabase) {
        this.supabase.from('shadow_mode_comparisons').insert({
          sport,
          batch_id: this.currentBatchId,
          new_count: newCount,
          legacy_count: legacyCount,
          difference_percent: percentDiff,
          new_source: newResult.source,
          legacy_source: legacyResult.source,
          new_from_cache: newResult.fromCache || false,
          comparison_data: JSON.stringify(comparisonResult),
          created_at: new Date().toISOString()
        }).then(({ error }) => {
          if (error) {
            this.logger.warn('Failed to store shadow mode comparison', { error: error.message });
          }
        });
      }

    } catch (error) {
      this.logger.error('Shadow mode comparison failed', {
        sport,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

// Export Optimal integration
export { fetchOptimalProps, getRateLimitStatus } from './optimal';