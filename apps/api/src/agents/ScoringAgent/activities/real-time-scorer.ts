/**
 * Real-Time Scorer Activity
 *
 * Automatically scores new props as they arrive from the 60-second polling system.
 * Integrates Enhanced45FactorEngine for comprehensive time-series analysis.
 *
 * Flow:
 * 1. Subscribe to new raw_props INSERTs (alert_mode = true)
 * 2. Normalize prop to market_props format
 * 3. Compute time-series features (line movement, player form, CLV)
 * 4. Score through Enhanced45FactorEngine (45 factors)
 * 5. Auto-approve S/A tier picks to promotion_queue
 * 6. Trigger Discord alerts for S-tier picks
 */

import { SupabaseClient } from '@supabase/supabase-js';

import { FeatureStoreService } from '../../../services/FeatureStoreService';
import { GradingFeatureSet } from '../../../types/GradingFeatureSet';
import { createLogger } from '../../../utils/logger';
import { Enhanced45FactorEngine, Enhanced45FactorResult } from '../scoring/Enhanced45FactorEngine';
import { FeatureStoreIntegration } from '../scoring/FeatureStoreIntegration';
import { MaterialChangeDetector } from '../scoring/MaterialChangeDetector';

const logger = createLogger('RealTimeScorer');

export interface RealTimeScoringConfig {
  autoApprove: boolean;
  autoApproveTiers: string[];
  discordAlertsEnabled: boolean;
  discordChannelId: string;
  timeSeriesLookbackDays: number;
  minDataPoints: number;
}

export interface NewPropEvent {
  id: string;
  sport: string;
  player_name: string;
  stat_type: string;
  line: number;
  odds: number;
  over_odds?: number;
  under_odds?: number;
  game_date: string;
  team?: string;
  opponent?: string;
  bookmaker_key?: string;
  external_prop_id?: string;
  metadata: any;
  created_at: string;
}

export interface ScoringResult {
  propId: string;
  scored: boolean;
  tier?: string;
  professionalScore?: number;
  autoApproved?: boolean;
  discordAlertSent?: boolean;
  error?: string;
  processingTimeMs: number;
}

export class RealTimeScorer {
  private supabase: SupabaseClient;
  private config: RealTimeScoringConfig;
  private enhanced45Engine?: Enhanced45FactorEngine;
  private featureStore?: FeatureStoreIntegration;
  private changeDetector?: MaterialChangeDetector;
  private isInitialized: boolean = false;
  private subscriptionChannel?: any;

  constructor(supabase: SupabaseClient, config: Partial<RealTimeScoringConfig> = {}) {
    this.supabase = supabase;
    this.config = {
      autoApprove: config.autoApprove ?? true,
      autoApproveTiers: config.autoApproveTiers ?? ['S', 'A'],
      discordAlertsEnabled: config.discordAlertsEnabled ?? true,
      discordChannelId: config.discordChannelId ?? (process.env.DISCORD_PREMIUM_CHANNEL_ID || ''),
      timeSeriesLookbackDays: config.timeSeriesLookbackDays ?? 14,
      minDataPoints: config.minDataPoints ?? 5,
    };
  }

  /**
   * Initialize Enhanced45FactorEngine and start listening for new props
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('RealTimeScorer already initialized');
      return;
    }

    logger.info('Initializing RealTimeScorer with Enhanced45FactorEngine');

    try {
      // Initialize Enhanced45Factor scoring system
      const featureStoreService = new FeatureStoreService();
      this.featureStore = new FeatureStoreIntegration(featureStoreService);
      this.changeDetector = new MaterialChangeDetector();
      this.enhanced45Engine = new Enhanced45FactorEngine(this.featureStore, this.changeDetector);

      // Set up material change event listeners
      this.changeDetector.on('materialChange', this.handleMaterialChange.bind(this));
      this.changeDetector.on('criticalChange', this.handleCriticalChange.bind(this));

      // Subscribe to new prop events
      await this.subscribeToNewProps();

      this.isInitialized = true;
      logger.info('✅ RealTimeScorer initialized successfully', {
        autoApprove: this.config.autoApprove,
        autoApproveTiers: this.config.autoApproveTiers,
        discordAlertsEnabled: this.config.discordAlertsEnabled,
      });
    } catch (error) {
      logger.error('❌ Failed to initialize RealTimeScorer', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Subscribe to raw_props INSERT events for real-time scoring
   */
  private async subscribeToNewProps(): Promise<void> {
    // Note: Supabase realtime requires proper setup in database
    // For now, we'll use polling approach which is more reliable
    logger.info('Setting up new prop polling (60-second intervals)');

    // Start polling for new unscored props
    this.startPolling();
  }

  /**
   * Poll for new unscored props every 60 seconds
   */
  private startPolling(): void {
    const pollInterval = 60000; // 60 seconds to align with ingestion

    const poll = async () => {
      try {
        const newProps = await this.fetchUnscoredProps();

        if (newProps.length > 0) {
          logger.info(`Found ${newProps.length} new props for real-time scoring`);

          // Process in parallel for maximum throughput
          const results = await Promise.all(newProps.map(prop => this.scoreNewProp(prop)));

          const successful = results.filter(r => r.scored).length;
          const autoApproved = results.filter(r => r.autoApproved).length;
          const alertsSent = results.filter(r => r.discordAlertSent).length;

          logger.info('Real-time scoring batch completed', {
            total: results.length,
            successful,
            autoApproved,
            alertsSent,
            avgProcessingTime:
              results.reduce((sum, r) => sum + r.processingTimeMs, 0) / results.length,
          });
        }
      } catch (error) {
        logger.error('Polling error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Schedule next poll
      setTimeout(poll, pollInterval);
    };

    // Start first poll
    setTimeout(poll, 1000); // Start after 1 second
  }

  /**
   * Fetch unscored props from the last polling cycle
   */
  private async fetchUnscoredProps(): Promise<NewPropEvent[]> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - 5); // Look back 5 minutes

      const { data, error } = await this.supabase
        .from('raw_props')
        .select('*')
        .is('professional_score', null)
        .gte('created_at', cutoffTime.toISOString())
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        logger.error('Failed to fetch unscored props', { error: error.message });
        return [];
      }

      return (data || []) as NewPropEvent[];
    } catch (error) {
      logger.error('Error fetching unscored props', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Score a new prop through Enhanced45FactorEngine
   */
  async scoreNewProp(prop: NewPropEvent): Promise<ScoringResult> {
    const startTime = Date.now();

    try {
      logger.info('Scoring new prop', {
        propId: prop.id,
        sport: prop.sport,
        player: prop.player_name,
        market: prop.stat_type,
      });

      // Step 1: Normalize to market_props format (if using dual-track pipeline)
      await this.normalizeToMarketProps(prop);

      // Step 2: Compute time-series features
      const timeSeriesFeatures = await this.computeTimeSeriesFeatures(prop);

      // Step 3: Build GradingFeatureSet for Enhanced45FactorEngine
      const features = this.buildGradingFeatures(prop, timeSeriesFeatures);

      // Step 4: Score through Enhanced45FactorEngine
      if (!this.enhanced45Engine) {
        throw new Error('Enhanced45FactorEngine not initialized');
      }

      // Convert GradingFeatureSet to Enhanced45FactorInput
      const enhanced45Input = {
        propId: prop.id,
        playerName: prop.player_name,
        statType: prop.stat_type,
        line: prop.line,
        overOdds: prop.over_odds,
        underOdds: prop.under_odds,
        sport: prop.sport,
        bookmaker: prop.bookmaker_key || 'unknown',
        gameDate: prop.game_date,
        features,
      };

      const scoringResult = await this.enhanced45Engine.calculate45FactorScore(enhanced45Input);

      // Step 5: Store scoring result
      await this.storeScoringResult(prop.id, scoringResult);

      // Step 6: Auto-approve if S/A tier
      let autoApproved = false;
      if (this.config.autoApprove && this.config.autoApproveTiers.includes(scoringResult.tier)) {
        autoApproved = await this.autoApproveToPromotionQueue(prop, scoringResult);
      }

      // Step 7: Send Discord alert for S-tier picks
      let discordAlertSent = false;
      if (this.config.discordAlertsEnabled && scoringResult.tier === 'S') {
        discordAlertSent = await this.sendDiscordAlert(prop, scoringResult);
      }

      const processingTimeMs = Date.now() - startTime;

      logger.info('✅ Prop scored successfully', {
        propId: prop.id,
        tier: scoringResult.tier,
        score: scoringResult.totalScore,
        autoApproved,
        discordAlertSent,
        processingTimeMs,
      });

      return {
        propId: prop.id,
        scored: true,
        tier: scoringResult.tier,
        professionalScore: scoringResult.totalScore,
        autoApproved,
        discordAlertSent,
        processingTimeMs,
      };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;

      logger.error('❌ Failed to score prop', {
        propId: prop.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs,
      });

      return {
        propId: prop.id,
        scored: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs,
      };
    }
  }

  /**
   * Normalize raw prop to market_props format (for dual-track pipeline)
   */
  private async normalizeToMarketProps(prop: NewPropEvent): Promise<void> {
    try {
      const marketProp = {
        id: prop.id, // Use same ID for simplicity
        sport: prop.sport,
        market: prop.stat_type,
        selection: prop.line > 0 ? 'over' : 'under',
        line: Math.abs(prop.line),
        odds: prop.odds,
        over_odds: prop.over_odds,
        under_odds: prop.under_odds,
        bookmaker_key: prop.bookmaker_key || 'unknown',
        external_prop_id: prop.external_prop_id || prop.id,
        player_name: prop.player_name,
        game_date: prop.game_date,
        team: prop.team,
        opponent: prop.opponent,
        metadata: prop.metadata || {},
        created_at: prop.created_at,
      };

      // Insert into market_props (upsert to handle duplicates)
      const { error } = await this.supabase.from('market_props').upsert(marketProp, {
        onConflict: 'bookmaker_key,external_prop_id',
        ignoreDuplicates: true,
      });

      if (error) {
        logger.warn('Failed to normalize to market_props', {
          propId: prop.id,
          error: error.message,
        });
      }
    } catch (error) {
      logger.warn('Error normalizing to market_props', {
        propId: prop.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Compute time-series features from historical data
   */
  private async computeTimeSeriesFeatures(prop: NewPropEvent): Promise<any> {
    try {
      // Feature 2: Line Movement Velocity
      const lineMovement = await this.computeLineMovementVelocity(
        prop.player_name,
        prop.stat_type,
        prop.sport
      );

      // Feature 3: Player Form
      const playerForm = await this.computePlayerForm(prop.player_name, prop.sport);

      // Feature 5: Closing Line Value Prediction
      const clvPrediction = await this.predictClosingLineValue(
        prop.player_name,
        prop.stat_type,
        prop.line,
        prop.sport
      );

      return {
        lineMovementVelocity: lineMovement.velocity,
        lineMovementDirection: lineMovement.direction,
        playerForm: playerForm.score,
        playerFormTrend: playerForm.trend,
        predictedCLV: clvPrediction.expectedCLV,
        clvConfidence: clvPrediction.confidence,
        historicalDataPoints: lineMovement.dataPoints,
      };
    } catch (error) {
      logger.warn('Failed to compute time-series features', {
        propId: prop.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return defaults if computation fails
      return {
        lineMovementVelocity: 0,
        lineMovementDirection: 'stable',
        playerForm: 50,
        playerFormTrend: 'stable',
        predictedCLV: 0,
        clvConfidence: 0.5,
        historicalDataPoints: 0,
      };
    }
  }

  /**
   * Compute line movement velocity from historical props
   */
  private async computeLineMovementVelocity(
    playerName: string,
    statType: string,
    sport: string
  ): Promise<{ velocity: number; direction: string; dataPoints: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.timeSeriesLookbackDays);

      const { data, error } = await this.supabase
        .from('raw_props')
        .select('line, created_at')
        .eq('player_name', playerName)
        .eq('stat_type', statType)
        .eq('sport', sport)
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: true })
        .limit(50);

      if (error || !data || data.length < this.config.minDataPoints) {
        return { velocity: 0, direction: 'stable', dataPoints: data?.length || 0 };
      }

      // Calculate velocity (change per hour)
      const lines = data.map(d => ({ line: d.line, time: new Date(d.created_at).getTime() }));
      const totalChange = lines[lines.length - 1].line - lines[0].line;
      const timeSpanHours = (lines[lines.length - 1].time - lines[0].time) / (1000 * 60 * 60);

      const velocity = timeSpanHours > 0 ? totalChange / timeSpanHours : 0;
      const direction = velocity > 0.5 ? 'rising' : velocity < -0.5 ? 'falling' : 'stable';

      return { velocity, direction, dataPoints: data.length };
    } catch (error) {
      logger.warn('Error computing line movement velocity', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { velocity: 0, direction: 'stable', dataPoints: 0 };
    }
  }

  /**
   * Compute player form from recent performance
   */
  private async computePlayerForm(
    playerName: string,
    sport: string
  ): Promise<{ score: number; trend: string }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7); // Last 7 days

      const { data, error } = await this.supabase
        .from('unified_picks')
        .select('result, professional_score')
        .eq('player_name', playerName)
        .eq('sport', sport)
        .gte('game_date', cutoffDate.toISOString())
        .not('result', 'is', null)
        .order('game_date', { ascending: false })
        .limit(10);

      if (error || !data || data.length === 0) {
        return { score: 50, trend: 'stable' }; // Default neutral form
      }

      // Calculate win rate and score trend
      const wins = data.filter(d => d.result === 'win').length;
      const winRate = wins / data.length;
      const avgScore = data.reduce((sum, d) => sum + (d.professional_score || 50), 0) / data.length;

      // Recent vs older comparison for trend
      const recentWins = data.slice(0, 5).filter(d => d.result === 'win').length;
      const recentWinRate = recentWins / Math.min(5, data.length);

      const trend =
        recentWinRate > winRate + 0.1
          ? 'improving'
          : recentWinRate < winRate - 0.1
            ? 'declining'
            : 'stable';

      const formScore = winRate * 50 + avgScore * 0.5;

      return { score: formScore, trend };
    } catch (error) {
      logger.warn('Error computing player form', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { score: 50, trend: 'stable' };
    }
  }

  /**
   * Predict closing line value based on line movement patterns
   */
  private async predictClosingLineValue(
    playerName: string,
    statType: string,
    currentLine: number,
    sport: string
  ): Promise<{ expectedCLV: number; confidence: number }> {
    try {
      // Simple heuristic: analyze historical closing line movements
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.timeSeriesLookbackDays);

      const { data, error } = await this.supabase
        .from('raw_props')
        .select('line, metadata')
        .eq('player_name', playerName)
        .eq('stat_type', statType)
        .eq('sport', sport)
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      if (error || !data || data.length < this.config.minDataPoints) {
        return { expectedCLV: 0, confidence: 0.3 };
      }

      // Calculate average line movement from open to close
      const lineMovements = data
        .filter(d => d.metadata?.opening_line && d.metadata?.closing_line)
        .map(d => d.metadata.closing_line - d.metadata.opening_line);

      if (lineMovements.length === 0) {
        return { expectedCLV: 0, confidence: 0.3 };
      }

      const avgMovement = lineMovements.reduce((sum, m) => sum + m, 0) / lineMovements.length;
      const confidence = Math.min(lineMovements.length / 10, 1); // More data = higher confidence

      return { expectedCLV: avgMovement, confidence };
    } catch (error) {
      logger.warn('Error predicting CLV', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { expectedCLV: 0, confidence: 0.3 };
    }
  }

  /**
   * Build GradingFeatureSet for Enhanced45FactorEngine
   */
  private buildGradingFeatures(prop: NewPropEvent, timeSeriesFeatures: any): GradingFeatureSet {
    return {
      propId: prop.id,
      date: prop.game_date.split('T')[0],
      sport: prop.sport,
      league: this.extractLeague(prop.sport),
      player: prop.player_name,
      marketType: prop.stat_type,
      odds: prop.odds,
      market: {
        type: prop.stat_type,
        odds: prop.odds,
        line: prop.line,
      },

      // Time-series features
      lineMovement: timeSeriesFeatures.lineMovementVelocity,
      playerForm: timeSeriesFeatures.playerForm,
      closingLineValue: timeSeriesFeatures.predictedCLV,

      // Standard features with defaults
      expectedValue: 0, // Computed by engine
      matchupRating: 50,
      sharpMoney: 50,
      marketIntelligence: 50,
      volumeProfile: 50,
      injuryImpact: 0,
      weatherImpact: 0,
      playerFatigue: 0,
      venueAdvantage: 0,
      refereeImpact: 0,
      paceImpact: 0,
      motivationalFactors: 0,
      correlationRisk: 0,
      volatility: 5,
      portfolioImpact: 0,

      // Metadata
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'real_time_scorer',
      confidence: 50,
      dataQuality: {
        completeness: 0.95,
        outlierScore: 0.95,
        consistencyScore: 0.95,
        dataValidationScore: 0.95,
      },
    };
  }

  /**
   * Extract league from sport
   */
  private extractLeague(sport: string): string {
    const leagueMap: Record<string, string> = {
      nfl: 'NFL',
      nba: 'NBA',
      mlb: 'MLB',
      nhl: 'NHL',
      ncaaf: 'NCAAF',
      ncaab: 'NCAAB',
    };
    return leagueMap[sport.toLowerCase()] || sport.toUpperCase();
  }

  /**
   * Store scoring result to scored_props table
   */
  private async storeScoringResult(propId: string, result: Enhanced45FactorResult): Promise<void> {
    try {
      const scoredProp = {
        prop_ref: propId,
        professional_score: result.totalScore,
        tier: result.tier,
        confidence: result.confidence,
        edge: result.expectedValue,
        prob_win: result.confidence,
        kelly_fraction: result.kellyFraction,
        clv_pct: 0, // To be updated after close
        risk_adjusted_score: result.riskAdjustedScore,
        sharpe_ratio: result.sharpeRatio,
        max_drawdown: result.maxDrawdown,
        model_agreement: result.modelAgreement,
        data_quality: result.dataQuality,
        factor_scores: result.factorScores,
        factor_weights: result.factorWeights,
        category_breakdown: {
          market: result.marketScore,
          player: result.playerScore,
          matchup: result.matchupScore,
          price: result.priceScore,
          meta: result.metaScore,
        },
        processing_time_ms: result.processingTimeMs,
        features_retrieved_ms: result.featuresRetrievedMs,
        version: result.version,
        config_used: result.configUsed,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await this.supabase
        .from('scored_props')
        .upsert(scoredProp, { onConflict: 'prop_ref' });

      if (error) {
        logger.error('Failed to store scoring result', {
          propId,
          error: error.message,
        });
      }
    } catch (error) {
      logger.error('Error storing scoring result', {
        propId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Auto-approve S/A tier picks to promotion_queue
   */
  private async autoApproveToPromotionQueue(
    prop: NewPropEvent,
    scoringResult: Enhanced45FactorResult
  ): Promise<boolean> {
    try {
      const promotionEntry = {
        prop_ref: prop.id,
        source: 'market',
        status: 'approved',
        priority: scoringResult.tier === 'S' ? 'high' : 'medium',
        tier: scoringResult.tier,
        professional_score: scoringResult.totalScore,
        edge: scoringResult.expectedValue,
        confidence: scoringResult.confidence,
        auto_approved: true,
        approved_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      const { error } = await this.supabase.from('promotion_queue').insert(promotionEntry);

      if (error) {
        logger.error('Failed to auto-approve to promotion_queue', {
          propId: prop.id,
          error: error.message,
        });
        return false;
      }

      logger.info('✅ Auto-approved to promotion_queue', {
        propId: prop.id,
        tier: scoringResult.tier,
        score: scoringResult.totalScore,
      });

      return true;
    } catch (error) {
      logger.error('Error auto-approving to promotion_queue', {
        propId: prop.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Send Discord alert for S-tier picks
   */
  private async sendDiscordAlert(
    prop: NewPropEvent,
    scoringResult: Enhanced45FactorResult
  ): Promise<boolean> {
    try {
      // Format Discord message
      const message = this.formatDiscordMessage(prop, scoringResult);

      // Store alert in database (AlertAgent will pick it up)
      const { error } = await this.supabase.from('pending_alerts').insert({
        type: 'discord',
        priority: 'high',
        channel_id: this.config.discordChannelId,
        content: message,
        metadata: {
          propId: prop.id,
          tier: scoringResult.tier,
          score: scoringResult.totalScore,
        },
        created_at: new Date().toISOString(),
      });

      if (error) {
        logger.error('Failed to queue Discord alert', {
          propId: prop.id,
          error: error.message,
        });
        return false;
      }

      logger.info('✅ Discord alert queued', {
        propId: prop.id,
        tier: scoringResult.tier,
      });

      return true;
    } catch (error) {
      logger.error('Error sending Discord alert', {
        propId: prop.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Format Discord message for S-tier pick
   */
  private formatDiscordMessage(prop: NewPropEvent, result: Enhanced45FactorResult): string {
    const pickSide = prop.line > 0 ? 'Over' : 'Under';
    const line = Math.abs(prop.line);

    return `⭐ **S-TIER PICK** ⭐

**${prop.player_name}** - ${prop.stat_type}
${pickSide} ${line} @ ${this.formatOdds(prop.odds)}

**Score**: ${Math.round(result.totalScore)}/100
**Edge**: ${(result.expectedValue * 100).toFixed(2)}%
**Confidence**: ${Math.round(result.confidence * 100)}%
**Kelly**: ${(result.kellyFraction * 100).toFixed(2)}%

**Professional Features**:
• Market Score: ${Math.round(result.marketScore)}/100
• Player Form: ${Math.round(result.playerScore)}/100
• Matchup: ${Math.round(result.matchupScore)}/100
• Price Value: ${Math.round(result.priceScore)}/100

**Game**: ${prop.team} vs ${prop.opponent}
**Date**: ${new Date(prop.game_date).toLocaleDateString()}

*Generated by Enhanced45FactorEngine - 45 factors analyzed*`;
  }

  /**
   * Format American odds
   */
  private formatOdds(odds: number): string {
    return odds > 0 ? `+${odds}` : `${odds}`;
  }

  /**
   * Handle material change events
   */
  private async handleMaterialChange(change: any): Promise<void> {
    logger.info('📊 Material change detected', {
      propId: change.propId,
      changeType: change.changeType,
      severity: change.severity,
    });

    // Re-score if high severity
    if (change.severity === 'high' || change.severity === 'critical') {
      // Fetch prop and re-score
      const { data: prop } = await this.supabase
        .from('raw_props')
        .select('*')
        .eq('id', change.propId)
        .single();

      if (prop) {
        await this.scoreNewProp(prop as NewPropEvent);
      }
    }
  }

  /**
   * Handle critical change events
   */
  private async handleCriticalChange(change: any): Promise<void> {
    logger.warn('🚨 Critical material change detected', {
      propId: change.propId,
      changeType: change.changeType,
      impact: change.impact,
    });

    // Force immediate re-scoring
    await this.handleMaterialChange(change);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.subscriptionChannel) {
      await this.supabase.removeChannel(this.subscriptionChannel);
    }

    if (this.changeDetector) {
      this.changeDetector.shutdown();
    }

    logger.info('✅ RealTimeScorer cleanup completed');
  }
}
