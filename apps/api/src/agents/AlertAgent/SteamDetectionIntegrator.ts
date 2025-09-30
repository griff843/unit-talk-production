/**
 * Steam Detection Integrator
 * Bridges the Steam Detection Engine with AlertAgent workflow
 *
 * Responsibilities:
 * - Initialize and configure Steam Detection Engine
 * - Process steam detection results
 * - Generate Discord alerts for steam moves
 * - Store steam detection data in database
 * - Integrate with existing AlertAgent metrics
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger';
import { SteamDetectionEngine } from '../../professional/engines/SteamDetectionEngine';
import type {
  SteamDetectionConfig,
  SteamDetectionInput,
  SteamAnalysisResult,
  SteamDetectionMetrics
} from '../../professional/types/steam-detection';
import { supabaseClient } from '../../utils/supabaseUtils';
import { withCircuitBreaker } from '../../services/enhanced-circuit-breaker';
import { requireSupabase } from '../../utils/supabaseUtils';

export interface SteamIntegratorConfig {
  enabled: boolean;
  processingIntervalMs: number;
  alertThreshold: number;
  minLineMovement: number;
  timeWindow: number;
  enabledSports: string[];
  discordChannelId?: string;
}

export interface SteamIntegratorMetrics {
  steamMovesDetected: number;
  alertsGenerated: number;
  processingLatency: number;
  lastProcessingTime: number;
  steamEngineHealth: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
}

export class SteamDetectionIntegrator extends EventEmitter {
  private logger: any;
  private config: SteamIntegratorConfig;
  private steamEngine: SteamDetectionEngine;
  private metrics: SteamIntegratorMetrics;
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<SteamIntegratorConfig>) {
    super();

    this.logger = createLogger('SteamDetectionIntegrator');

    this.config = {
      enabled: true,
      processingIntervalMs: 30000, // 30 seconds
      alertThreshold: 70, // Steam score threshold for alerts
      minLineMovement: 2.0,
      timeWindow: 5,
      enabledSports: ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF'],
      ...config
    };

    this.metrics = {
      steamMovesDetected: 0,
      alertsGenerated: 0,
      processingLatency: 0,
      lastProcessingTime: 0,
      steamEngineHealth: 'HEALTHY'
    };

    // Initialize Steam Detection Engine
    this.steamEngine = new SteamDetectionEngine({
      minLineMovement: this.config.minLineMovement,
      timeWindow: this.config.timeWindow,
      enabledBooks: ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'PointsBet', 'Barstool'],
      updateFrequency: 30
    });

    this.logger.info('🔥 Steam Detection Integrator initialized', {
      config: this.config,
      alertThreshold: this.config.alertThreshold,
      enabledSports: this.config.enabledSports
    });
  }

  /**
   * Initialize and start steam detection monitoring
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('🔇 Steam detection disabled by configuration');
      return;
    }

    try {
      this.logger.info('🚀 Starting steam detection monitoring...');

      // Set up event listeners for steam detection
      this.steamEngine.on('steamDetected', this.handleSteamDetected.bind(this));

      // Start periodic processing
      this.startPeriodicProcessing();

      this.logger.info('✅ Steam detection monitoring started successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize steam detection', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Start periodic steam detection processing
   */
  private startPeriodicProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(async () => {
      if (this.isProcessing) {
        this.logger.debug('⏳ Steam detection already in progress, skipping this cycle');
        return;
      }

      await this.processPropTicks();
    }, this.config.processingIntervalMs);

    this.logger.info('⏰ Periodic steam detection processing started', {
      intervalMs: this.config.processingIntervalMs
    });
  }

  /**
   * Process prop ticks for steam detection
   */
  private async processPropTicks(): Promise<void> {
    const startTime = Date.now();
    this.isProcessing = true;

    try {
      const correlationId = `steam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      this.logger.debug('🔍 Processing prop ticks for steam detection', { correlationId });

      // Fetch recent prop tick data
      const recentTicks = await this.fetchRecentPropTicks();

      if (recentTicks.length === 0) {
        this.logger.debug('No recent prop ticks found');
        return;
      }

      // Group ticks by prop for analysis
      const propGroups = this.groupTicksByProp(recentTicks);

      let steamDetectionsCount = 0;

      // Analyze each prop for steam
      for (const [propId, ticks] of propGroups) {
        try {
          const steamInput = await this.buildSteamDetectionInput(propId, ticks);
          if (!steamInput) continue;

          const analysisResult = await this.steamEngine.detectSteam(steamInput);

          if (analysisResult.steamDetected && analysisResult.steamScore >= this.config.alertThreshold) {
            steamDetectionsCount++;
            await this.processSteamDetection(propId, analysisResult, correlationId);
          }

        } catch (error) {
          this.logger.warn('⚠️ Error analyzing prop for steam', {
            propId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const processingTime = Date.now() - startTime;
      this.metrics.processingLatency = processingTime;
      this.metrics.lastProcessingTime = Date.now();
      this.metrics.steamMovesDetected += steamDetectionsCount;

      this.logger.info('✅ Steam detection processing complete', {
        correlationId,
        propsAnalyzed: propGroups.size,
        steamDetections: steamDetectionsCount,
        processingTimeMs: processingTime
      });

    } catch (error) {
      this.logger.error('❌ Steam detection processing failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Fetch recent cached prop tick data for steam analysis (cache-only)
   */
  private async fetchRecentPropTicks(): Promise<any[]> {
    return await withCircuitBreaker.supabase(async () => {
      const cutoffTime = new Date(Date.now() - this.config.timeWindow * 60000);

      // Use cached book quotes instead of direct prop_ticks_hot access
      const supabaseClient = requireSupabase();
      const { data, error } = await supabaseClient
        .from('cache.book_quotes')
        .select(`
          prop_id,
          last_updated,
          line,
          over_odds,
          under_odds,
          volume,
          book,
          player_name,
          stat_type,
          steam_detected,
          sharp_money_indicator
        `)
        .gte('last_updated', cutoffTime.toISOString())
        .order('last_updated', { ascending: false })
        .limit(5000);

      if (error) {
        throw new Error(`Failed to fetch cached quotes: ${error.message}`);
      }

      // Convert cached quotes to tick format for compatibility
      const tickData = (data || []).map(quote => ({
        prop_id: quote.prop_id,
        tick_timestamp: quote.last_updated,
        line: quote.line,
        odds_over: quote.over_odds,
        odds_under: quote.under_odds,
        volume: quote.volume || 0,
        book: quote.book,
        market_type: 'cached',
        player_name: quote.player_name,
        stat_type: quote.stat_type,
        steam_detected: quote.steam_detected || false,
        sharp_money_indicator: quote.sharp_money_indicator || false
      }));

      this.logger.debug('Fetched cached prop tick data for steam analysis', {
        count: tickData.length,
        timeWindow: this.config.timeWindow
      });

      return tickData;
    }, async () => {
      this.logger.warn('Circuit breaker open, returning empty cached tick data');
      return [];
    });
  }

  /**
   * Group ticks by prop ID
   */
  private groupTicksByProp(ticks: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();

    for (const tick of ticks) {
      if (!groups.has(tick.prop_id)) {
        groups.set(tick.prop_id, []);
      }
      groups.get(tick.prop_id)!.push(tick);
    }

    return groups;
  }

  /**
   * Build steam detection input from prop ticks
   */
  private async buildSteamDetectionInput(propId: string, ticks: any[]): Promise<SteamDetectionInput | null> {
    try {
      // Get prop metadata
      const propData = await this.getPropMetadata(propId);
      if (!propData) {
        return null;
      }

      // Sort ticks chronologically
      ticks.sort((a, b) => new Date(a.tick_timestamp).getTime() - new Date(b.tick_timestamp).getTime());

      // Build line history
      const lineHistory = ticks.map(tick => ({
        timestamp: tick.tick_timestamp,
        line: tick.line,
        odds: tick.odds_over || tick.odds_under || 0,
        bookmaker: tick.book,
        volume: tick.volume || 0
      }));

      // Build volume history
      const volumeHistory = ticks.map(tick => ({
        timestamp: tick.tick_timestamp,
        volume: tick.volume || 0,
        side: 'OVER' as 'OVER' | 'UNDER',
        bookmaker: tick.book,
        isSharpMoney: this.detectSharpMoney(tick)
      }));

      return {
        propId,
        sport: propData.sport || 'UNKNOWN',
        market: propData.stat_type || 'unknown',
        currentLine: ticks[ticks.length - 1]?.line || 0,
        lineHistory,
        volumeHistory,
        bookmakerData: this.extractBookmakerData(ticks)
      };

    } catch (error) {
      this.logger.error('Failed to build steam detection input', {
        propId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get prop metadata from cached data
   */
  private async getPropMetadata(propId: string): Promise<any> {
    try {
      // Try to get metadata from cache.book_quotes first (cache-first approach)
      const supabaseClient = requireSupabase();
      const { data, error } = await supabaseClient
        .from('cache.book_quotes')
        .select('sport, stat_type, player_name, league')
        .eq('prop_id', propId)
        .order('last_updated', { ascending: false })
        .limit(1)
        .single();

      if (data && !error) {
        return {
          sport: data.sport || data.league,
          stat_type: data.stat_type,
          player_name: data.player_name
        };
      }

      // Fallback to unified_picks if not found in cache
      const { data: pickData, error: pickError } = await supabaseClient
        .from('unified_picks')
        .select('league, bet_type, player_name')
        .eq('id', propId)
        .single();

      if (pickError) {
        this.logger.warn('Failed to get prop metadata from cache and unified_picks', {
          propId,
          cacheError: error?.message,
          pickError: pickError.message
        });
        return null;
      }

      return {
        sport: pickData.league,
        stat_type: pickData.bet_type,
        player_name: pickData.player_name
      };

    } catch (error) {
      this.logger.error('Error fetching prop metadata', {
        propId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Simple sharp money detection heuristic
   */
  private detectSharpMoney(tick: any): boolean {
    // Heuristic: large volume with good odds movement
    const volume = tick.volume || 0;
    return volume > 5000; // Simplified logic
  }

  /**
   * Extract bookmaker data for analysis
   */
  private extractBookmakerData(ticks: any[]): any[] {
    return ticks.map(tick => ({
      bookmaker: tick.book,
      action: 'NORMAL', // Would be enhanced with real bookmaker action detection
      timestamp: tick.tick_timestamp
    }));
  }

  /**
   * Process a steam detection result
   */
  private async processSteamDetection(
    propId: string,
    result: SteamAnalysisResult,
    correlationId: string
  ): Promise<void> {
    try {
      this.logger.info('🔥 Processing steam detection', {
        propId,
        steamScore: result.steamScore,
        severity: result.severity,
        correlationId
      });

      // Store steam detection in database
      await this.storeSteamDetection(propId, result);

      // Generate Discord alert
      await this.generateSteamAlert(propId, result, correlationId);

      this.metrics.alertsGenerated++;

      // Emit event for other systems
      this.emit('steamProcessed', {
        propId,
        result,
        correlationId
      });

    } catch (error) {
      this.logger.error('Failed to process steam detection', {
        propId,
        correlationId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Store steam detection in ops.alert_events (cache-aware)
   */
  private async storeSteamDetection(propId: string, result: SteamAnalysisResult): Promise<void> {
    try {
      const supabaseClient = requireSupabase();

      // Store in ops.alert_events with proper deduplication
      const dedupeKey = `steam_${propId}_${result.steamScore}_${Date.now()}`;

      const { error: alertError } = await supabaseClient
        .from('ops.alert_events')
        .insert({
          alert_type: 'steam_detection',
          prop_id: propId,
          dedupe_key: dedupeKey,
          status: 'detected',
          alert_data: {
            propId,
            steamScore: result.steamScore,
            lineMovement: result.lineMovement.totalMovement,
            volumeIncrease: result.volumeCorrelation.volumeIncrease,
            confidence: result.confidence,
            severity: result.severity,
            timeWindowMinutes: 5,
            source: 'cache-first-steam-detection-engine',
            recommendation: result.recommendation
          },
          created_at: new Date().toISOString()
        });

      if (alertError) {
        this.logger.warn('Failed to store steam alert event', {
          propId,
          error: alertError.message
        });
      }

      // Also store in steam_moves for historical tracking (fallback)
      try {
        const { error: steamError } = await supabaseClient
          .from('steam_moves')
          .insert({
            prop_id: propId, // Use propId directly in cache-first approach
            line_change: result.lineMovement.totalMovement,
            volume_delta: result.volumeCorrelation.volumeIncrease,
            confidence_score: result.confidence,
            source: 'cache-first-steam-detection-engine',
            previous_line: result.lineMovement.previousLine || null,
            new_line: result.lineMovement.currentLine || result.lineMovement.totalMovement,
            time_window_minutes: 5,
            significance_level: result.severity.toLowerCase()
          });

        if (steamError) {
          this.logger.debug('Steam_moves insert failed (expected in cache-first mode)', {
            propId,
            error: steamError.message
          });
        }
      } catch (steamStoreError) {
        // Ignore steam_moves storage errors in cache-first mode
        this.logger.debug('Steam_moves storage skipped in cache-first mode', { propId });
      }

      this.logger.debug('✅ Steam detection stored in ops.alert_events', { propId, dedupeKey });
    } catch (error) {
      this.logger.error('Failed to store steam detection', {
        propId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Generate Discord alert for steam detection
   */
  private async generateSteamAlert(
    propId: string,
    result: SteamAnalysisResult,
    correlationId: string
  ): Promise<void> {
    try {
      // Import Discord integration
      const { sendDiscordAlert } = await import('./integrations/discord');
      const { buildAlertEmbed } = await import('./embedBuilder');

      const propData = await this.getPropMetadata(propId);

      const alertData = {
        id: `steam-${propId}`,
        prop_id: propId,
        player_name: propData?.player_name || 'Unknown Player',
        bet_type: 'steam_alert',
        league: propData?.sport || 'UNKNOWN',
        tier: 'S-tier', // Steam alerts are always high priority
        steam_score: result.steamScore,
        severity: result.severity,
        line_movement: result.lineMovement.totalMovement,
        confidence: result.confidence,
        recommendation: result.recommendation.action
      };

      const alertMessage = `🔥 STEAM DETECTED!\n` +
        `Player: ${alertData.player_name}\n` +
        `Steam Score: ${result.steamScore.toFixed(1)}/100\n` +
        `Line Movement: ${result.lineMovement.totalMovement.toFixed(1)} points\n` +
        `Confidence: ${(result.confidence * 100).toFixed(1)}%\n` +
        `Severity: ${result.severity}\n` +
        `Recommendation: ${result.recommendation.action}`;

      const embed = buildAlertEmbed(alertData, alertMessage);

      // Add steam-specific styling
      embed.setTitle(`🔥 STEAM ALERT: ${result.severity}`)
        .setColor(0xFF6B35) // Orange-red for steam alerts
        .addFields([
          { name: 'Steam Score', value: `${result.steamScore.toFixed(1)}/100`, inline: true },
          { name: 'Movement', value: `${result.lineMovement.totalMovement.toFixed(1)} pts`, inline: true },
          { name: 'Confidence', value: `${(result.confidence * 100).toFixed(1)}%`, inline: true }
        ]);

      await sendDiscordAlert(embed);

      this.logger.info('✅ Steam alert sent to Discord', {
        propId,
        steamScore: result.steamScore,
        correlationId
      });

    } catch (error) {
      this.logger.error('Failed to generate steam alert', {
        propId,
        correlationId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle steam detection events from engine
   */
  private async handleSteamDetected(event: any): Promise<void> {
    this.logger.info('🔥 Steam detection event received', {
      propId: event.propId,
      score: event.score,
      severity: event.severity
    });

    // Additional processing can be added here
    this.emit('alertGenerated', {
      type: 'steam',
      propId: event.propId,
      score: event.score,
      severity: event.severity
    });
  }

  /**
   * Get current metrics
   */
  getMetrics(): SteamIntegratorMetrics {
    return { ...this.metrics };
  }

  /**
   * Get steam engine metrics
   */
  async getSteamEngineMetrics(): Promise<SteamDetectionMetrics> {
    return this.steamEngine.getMetrics();
  }

  /**
   * Get steam engine health status
   */
  async checkSteamEngineHealth(): Promise<any> {
    return await this.steamEngine.checkHealth();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SteamIntegratorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('⚙️ Steam integrator configuration updated', {
      updatedFields: Object.keys(newConfig)
    });
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup(): Promise<void> {
    this.logger.info('🧹 Steam Detection Integrator cleanup initiated...');

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Remove all listeners
    this.removeAllListeners();
    this.steamEngine.removeAllListeners();

    this.logger.info('✅ Steam Detection Integrator cleanup complete');
  }
}