/**
 * NormalizerAgent - Raw Props to Unified Picks Normalization
 *
 * Purpose: Convert raw_props → unified_picks with bookmaker normalization
 * - Idempotent UPSERT on external_prop_id
 * - Derive odds from over_odds/under_odds intelligently
 * - Normalize selection across bookmakers
 * - Handle edge cases: missing odds, non-player markets, american odds
 * - Batch-friendly (100+ props/sec target)
 */

import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, HealthStatus, BaseMetrics } from '../BaseAgent/types';
import { SupabaseClient } from '@supabase/supabase-js';
import { logger as baseLogger } from '../../shared/logger';

const logger = baseLogger;

export interface RawProp {
  id: string;
  external_id: string;
  game_id?: string;
  sport: string;
  market: string;
  player_name?: string;
  team?: string;
  opponent?: string;
  game_date: string;
  over_odds?: number;
  under_odds?: number;
  line?: number;
  selection?: string;
  bookmaker_key: string;
  raw_data?: any;
  ingested_at?: string;
}

export interface UnifiedPick {
  external_prop_id: string;
  external_game_id?: string;
  sport: string;
  market: string;
  selection: string;
  line?: number;
  odds?: number;
  player_name?: string;
  team?: string;
  opponent?: string;
  game_date: string;
  bookmaker_key: string;
  metadata?: any;
  workflow_stage: string;
  status: string;
}

export interface NormalizerMetrics {
  totalProcessed: number;
  successfulNormalizations: number;
  failedNormalizations: number;
  duplicatesSkipped: number;
  avgProcessingTimeMs: number;
}

export class NormalizerAgent extends BaseAgent {
  private metrics: NormalizerMetrics = {
    totalProcessed: 0,
    successfulNormalizations: 0,
    failedNormalizations: 0,
    duplicatesSkipped: 0,
    avgProcessingTimeMs: 0
  };

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
  }

  protected async initialize(): Promise<void> {
    logger.info('🔄 Initializing NormalizerAgent...');

    // Validate database connection
    const { error } = await this.supabase!
      .from('raw_props')
      .select('id')
      .limit(1);

    if (error) {
      throw new Error(`Database connectivity check failed: ${error.message}`);
    }

    logger.info('✅ NormalizerAgent initialization complete');
  }

  protected async process(): Promise<void> {
    logger.info('🔄 Processing raw props for normalization...');

    try {
      // Fetch unprocessed raw props
      const rawProps = await this.fetchUnprocessedRawProps();

      if (rawProps.length === 0) {
        logger.info('No raw props to normalize');
        return;
      }

      logger.info(`📊 Found ${rawProps.length} raw props to normalize`);

      // Normalize in batches
      const batchSize = 100;
      for (let i = 0; i < rawProps.length; i += batchSize) {
        const batch = rawProps.slice(i, i + batchSize);
        await this.normalizeBatch(batch);
      }

      logger.info(`✅ Normalized ${this.metrics.successfulNormalizations} props successfully`);

    } catch (error) {
      logger.error('Failed to process raw props', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  protected async cleanup(): Promise<void> {
    logger.info('🧹 NormalizerAgent cleanup...');
    logger.info('📈 Final metrics:', this.metrics);
  }

  public async checkHealth(): Promise<HealthStatus> {
    const errorRate = this.metrics.failedNormalizations / Math.max(this.metrics.totalProcessed, 1);
    const status = errorRate > 0.1 ? 'unhealthy' : errorRate > 0.05 ? 'degraded' : 'healthy';

    return {
      status,
      timestamp: new Date().toISOString(),
      details: {
        errorRate,
        metrics: this.metrics
      }
    };
  }

  public async collectMetrics(): Promise<BaseMetrics> {
    return {
      agentName: 'NormalizerAgent',
      successCount: this.metrics.successfulNormalizations,
      errorCount: this.metrics.failedNormalizations,
      warningCount: this.metrics.duplicatesSkipped,
      processingTimeMs: this.metrics.avgProcessingTimeMs,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  /**
   * Fetch raw props that haven't been normalized yet
   */
  private async fetchUnprocessedRawProps(): Promise<RawProp[]> {
    const { data, error } = await this.supabase!
      .from('raw_props')
      .select('*')
      .is('normalized_at', null)  // Not yet normalized
      .gte('ingested_at', new Date(Date.now() - 3600000).toISOString())  // Last hour
      .order('ingested_at', { ascending: true })
      .limit(1000);

    if (error) {
      throw new Error(`Failed to fetch raw props: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Normalize a batch of raw props
   */
  private async normalizeBatch(rawProps: RawProp[]): Promise<void> {
    const startTime = Date.now();

    try {
      const normalized = rawProps.map(raw => this.normalizeRawProp(raw)).filter(Boolean);

      if (normalized.length === 0) {
        return;
      }

      // Upsert into unified_picks (idempotent)
      const { data, error } = await this.supabase!
        .from('unified_picks')
        .upsert(normalized, {
          onConflict: 'external_prop_id',
          ignoreDuplicates: false
        })
        .select('id');

      if (error) {
        logger.error('Failed to upsert normalized picks', { error: error.message });
        this.metrics.failedNormalizations += rawProps.length;
        return;
      }

      // Mark raw props as normalized
      const rawPropIds = rawProps.map(r => r.id);
      await this.supabase!
        .from('raw_props')
        .update({ normalized_at: new Date().toISOString() })
        .in('id', rawPropIds);

      this.metrics.totalProcessed += rawProps.length;
      this.metrics.successfulNormalizations += normalized.length;
      this.metrics.duplicatesSkipped += rawProps.length - normalized.length;

      const duration = Date.now() - startTime;
      this.metrics.avgProcessingTimeMs =
        (this.metrics.avgProcessingTimeMs * (this.metrics.totalProcessed - rawProps.length) + duration) /
        this.metrics.totalProcessed;

      logger.info(`✅ Batch normalized: ${normalized.length}/${rawProps.length} props in ${duration}ms`);

    } catch (error) {
      logger.error('Batch normalization failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.metrics.failedNormalizations += rawProps.length;
    }
  }

  /**
   * Normalize a single raw prop
   */
  private normalizeRawProp(raw: RawProp): UnifiedPick | null {
    try {
      // Determine selection and odds
      const selection = this.normalizeSelection(raw);
      const odds = this.deriveOdds(raw, selection);

      if (!odds) {
        logger.warn('Could not derive odds', { propId: raw.external_id });
        return null;
      }

      return {
        external_prop_id: raw.external_id,
        external_game_id: raw.game_id,
        sport: raw.sport.toUpperCase(),
        market: this.normalizeMarket(raw.market),
        selection,
        line: raw.line,
        odds,
        player_name: raw.player_name,
        team: raw.team,
        opponent: raw.opponent,
        game_date: raw.game_date,
        bookmaker_key: raw.bookmaker_key,
        metadata: {
          raw_id: raw.id,
          source: 'normalizer',
          raw_selection: raw.selection,
          over_odds: raw.over_odds,
          under_odds: raw.under_odds,
          normalized_at: new Date().toISOString()
        },
        workflow_stage: 'normalized',
        status: 'pending'
      };

    } catch (error) {
      logger.error('Failed to normalize raw prop', {
        propId: raw.external_id,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Normalize selection across bookmaker formats
   */
  private normalizeSelection(raw: RawProp): string {
    if (!raw.selection) {
      // Default to over if no selection specified
      return 'over';
    }

    const sel = raw.selection.toLowerCase().trim();

    // Map to standard values
    if (['over', 'yes', 'true', 'o', '+'].includes(sel)) {
      return 'over';
    }

    if (['under', 'no', 'false', 'u', '-'].includes(sel)) {
      return 'under';
    }

    // Pass through as-is for other markets (moneyline, spread, etc.)
    return raw.selection;
  }

  /**
   * Derive odds from over_odds/under_odds based on selection
   */
  private deriveOdds(raw: RawProp, selection: string): number | null {
    // Case 1: Selection is 'over', use over_odds
    if (selection === 'over') {
      return raw.over_odds || null;
    }

    // Case 2: Selection is 'under', use under_odds
    if (selection === 'under') {
      return raw.under_odds || null;
    }

    // Case 3: Use best available odds
    if (raw.over_odds && raw.under_odds) {
      return Math.max(raw.over_odds, raw.under_odds);
    }

    // Case 4: Use whatever is available
    return raw.over_odds || raw.under_odds || null;
  }

  /**
   * Normalize market names
   */
  private normalizeMarket(market: string): string {
    const normalized = market.toLowerCase().trim()
      .replace(/_/g, ' ')
      .replace(/-/g, ' ');

    // Map common variations
    const marketMap: Record<string, string> = {
      'points': 'player_points',
      'pts': 'player_points',
      'rebounds': 'player_rebounds',
      'rebs': 'player_rebounds',
      'assists': 'player_assists',
      'ast': 'player_assists',
      'threes': 'player_threes',
      '3pt': 'player_threes',
      'strikeouts': 'pitcher_strikeouts',
      'k': 'pitcher_strikeouts',
      'passing yards': 'passing_yards',
      'rushing yards': 'rushing_yards',
      'receiving yards': 'receiving_yards'
    };

    return marketMap[normalized] || market;
  }

  /**
   * Process latest raw props (called by scheduler)
   */
  public async processLatest(): Promise<void> {
    await this.run();
  }

  /**
   * Process specific batch (for manual triggers)
   */
  public async processBatch(batchId: string): Promise<void> {
    logger.info(`🔄 Processing batch: ${batchId}`);

    const { data, error } = await this.supabase!
      .from('raw_props')
      .select('*')
      .eq('batch_id', batchId)
      .is('normalized_at', null);

    if (error) {
      throw new Error(`Failed to fetch batch: ${error.message}`);
    }

    if (data && data.length > 0) {
      await this.normalizeBatch(data);
    }
  }
}

// Export for testing
export { logger };
