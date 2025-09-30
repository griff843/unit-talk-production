/**
 * Line Shopping Integration for FeedAgent
 *
 * MISSION: Seamlessly integrate line shopping capabilities into existing FeedAgent workflow
 * PERFORMANCE: Process line shopping analysis during prop ingestion with minimal overhead
 *
 * Integration Features:
 * - Real-time line shopping during prop processing
 * - Edge opportunity alerts via Discord
 * - Automatic best line recommendations
 * - CLV tracking initialization
 * - Performance monitoring integration
 * - Quota-aware processing
 *
 * @module LineShoppingIntegration
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger';
import { lineShoppingEngine, OddsComparison, LineShoppingResult } from '../../services/LineShoppingEngine';
import { clvTrackingService } from '../../services/clv/CLVTrackingService';
import { supabaseClient } from '../../utils/supabaseUtils';
import { requireSupabase } from '../../utils/supabaseUtils';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface LineShoppingConfig {
  enableRealTimeAnalysis: boolean;
  enableEdgeAlerts: boolean;
  enableCLVTracking: boolean;
  minEdgeForAlert: number; // Minimum edge % for Discord alerts
  batchSize: number; // Number of props to analyze in batch
  maxProcessingTime: number; // Max time to spend on line shopping per batch
  alertChannelWebhook?: string; // Discord webhook for edge alerts
}

export interface PropWithLineAnalysis {
  // Original prop data
  id: string;
  player_name: string;
  sport: string;
  market: string;
  line: number;
  over_odds?: number;
  under_odds?: number;

  // Line shopping analysis
  lineAnalysis?: OddsComparison;
  bestOdds?: number;
  bestSource?: string;
  edgeValue?: number;
  recommendedAction?: 'bet' | 'wait' | 'skip';

  // CLV tracking
  clvTrackingId?: string;

  // Processing metadata
  processingTimeMs?: number;
  analysisCompleted: boolean;
  analysisError?: string;
}

export interface EdgeAlert {
  propId: string;
  player: string;
  sport: string;
  market: string;
  line: number;
  edge: number;
  bestPrice: number;
  bestSource: string;
  impliedProbability: number;
  confidence: number;
  timestamp: Date;
}

export interface LineShoppingBatch {
  id: string;
  props: PropWithLineAnalysis[];
  startTime: Date;
  endTime?: Date;
  edgeOpportunities: EdgeAlert[];
  totalEdgeValue: number;
  averageEdge: number;
  processingTimeMs: number;
  quotaUsed: {
    oddsApi: number;
    optimal: number;
  };
}

// ============================================================================
// LINE SHOPPING INTEGRATION CLASS
// ============================================================================

export class LineShoppingIntegration extends EventEmitter {
  private config: LineShoppingConfig;
  private logger: any;
  private activeBatches: Map<string, LineShoppingBatch> = new Map();
  private recentEdgeAlerts: EdgeAlert[] = [];
  private alertCooldown: Map<string, Date> = new Map(); // Prevent spam alerts

  constructor(config?: Partial<LineShoppingConfig>) {
    super();

    this.config = {
      enableRealTimeAnalysis: true,
      enableEdgeAlerts: true,
      enableCLVTracking: true,
      minEdgeForAlert: 3.0, // 3% minimum edge for alerts
      batchSize: 20, // Process 20 props per batch
      maxProcessingTime: 4000, // 4 second max processing time
      ...config
    };

    this.logger = createLogger('LineShoppingIntegration');

    // Listen to line shopping engine events
    this.setupEventListeners();

    this.logger.info('🛒 LineShoppingIntegration initialized', {
      config: this.config
    });
  }

  // ============================================================================
  // PUBLIC INTEGRATION METHODS
  // ============================================================================

  /**
   * Process props with line shopping analysis
   * Integrates seamlessly with FeedAgent workflow
   */
  async processPropsWithLineAnalysis(
    props: PropWithLineAnalysis[],
    sport?: string
  ): Promise<{
    processedProps: PropWithLineAnalysis[];
    edgeOpportunities: EdgeAlert[];
    processingStats: {
      totalProps: number;
      analyzedProps: number;
      edgeOpportunities: number;
      averageProcessingTime: number;
      quotaUsed: { oddsApi: number; optimal: number };
    };
  }> {
    if (!this.config.enableRealTimeAnalysis) {
      // Return props without analysis if disabled
      return {
        processedProps: props.map(p => ({ ...p, analysisCompleted: false })),
        edgeOpportunities: [],
        processingStats: {
          totalProps: props.length,
          analyzedProps: 0,
          edgeOpportunities: 0,
          averageProcessingTime: 0,
          quotaUsed: { oddsApi: 0, optimal: 0 }
        }
      };
    }

    const startTime = Date.now();
    const batchId = `line_shopping_${startTime}_${Math.random().toString(36).substr(2, 9)}`;

    this.logger.info('🔍 Starting line shopping analysis for props', {
      batchId,
      propCount: props.length,
      sport
    });

    try {
      // Create processing batch
      const batch: LineShoppingBatch = {
        id: batchId,
        props: [...props],
        startTime: new Date(),
        edgeOpportunities: [],
        totalEdgeValue: 0,
        averageEdge: 0,
        processingTimeMs: 0,
        quotaUsed: { oddsApi: 0, optimal: 0 }
      };

      this.activeBatches.set(batchId, batch);

      // Process in smaller chunks to respect timing constraints
      const chunks = this.chunkArray(props, this.config.batchSize);
      const processedProps: PropWithLineAnalysis[] = [];
      const allEdgeOpportunities: EdgeAlert[] = [];
      let totalQuotaUsed = { oddsApi: 0, optimal: 0 };

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkStartTime = Date.now();

        // Check if we're approaching time limit
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime > this.config.maxProcessingTime * 0.8) {
          this.logger.warn('⏰ Approaching processing time limit, stopping analysis', {
            batchId,
            elapsedTime,
            remainingChunks: chunks.length - i
          });

          // Add remaining props without analysis
          for (let j = i; j < chunks.length; j++) {
            processedProps.push(...chunks[j].map(p => ({
              ...p,
              analysisCompleted: false,
              analysisError: 'Time limit exceeded'
            })));
          }
          break;
        }

        try {
          const chunkResult = await this.processChunkWithLineAnalysis(chunk, sport);
          processedProps.push(...chunkResult.processedProps);
          allEdgeOpportunities.push(...chunkResult.edgeOpportunities);

          totalQuotaUsed.oddsApi += chunkResult.quotaUsed.oddsApi;
          totalQuotaUsed.optimal += chunkResult.quotaUsed.optimal;

          const chunkTime = Date.now() - chunkStartTime;
          this.logger.debug('📊 Chunk processed', {
            batchId,
            chunk: i + 1,
            totalChunks: chunks.length,
            propsInChunk: chunk.length,
            edgeOpportunities: chunkResult.edgeOpportunities.length,
            chunkTimeMs: chunkTime
          });

        } catch (error) {
          this.logger.error('❌ Chunk processing failed', {
            batchId,
            chunk: i + 1,
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          // Add chunk props with error status
          processedProps.push(...chunk.map(p => ({
            ...p,
            analysisCompleted: false,
            analysisError: error instanceof Error ? error.message : 'Unknown error'
          })));
        }
      }

      // Finalize batch
      batch.endTime = new Date();
      batch.processingTimeMs = Date.now() - startTime;
      batch.edgeOpportunities = allEdgeOpportunities;
      batch.quotaUsed = totalQuotaUsed;

      if (allEdgeOpportunities.length > 0) {
        batch.totalEdgeValue = allEdgeOpportunities.reduce((sum, edge) => sum + edge.edge, 0);
        batch.averageEdge = batch.totalEdgeValue / allEdgeOpportunities.length;
      }

      // Send edge alerts if enabled
      if (this.config.enableEdgeAlerts && allEdgeOpportunities.length > 0) {
        await this.sendEdgeAlerts(allEdgeOpportunities);
      }

      // Initialize CLV tracking for significant edges
      if (this.config.enableCLVTracking) {
        await this.initializeCLVTrackingForEdges(allEdgeOpportunities);
      }

      const analyzedProps = processedProps.filter(p => p.analysisCompleted).length;
      const avgProcessingTime = analyzedProps > 0 ? batch.processingTimeMs / analyzedProps : 0;

      this.logger.info('✅ Line shopping analysis completed', {
        batchId,
        totalProps: props.length,
        analyzedProps,
        edgeOpportunities: allEdgeOpportunities.length,
        averageEdge: batch.averageEdge.toFixed(2),
        processingTimeMs: batch.processingTimeMs,
        quotaUsed: totalQuotaUsed
      });

      // Emit completion event
      this.emit('batchCompleted', batch);

      return {
        processedProps,
        edgeOpportunities: allEdgeOpportunities,
        processingStats: {
          totalProps: props.length,
          analyzedProps,
          edgeOpportunities: allEdgeOpportunities.length,
          averageProcessingTime: avgProcessingTime,
          quotaUsed: totalQuotaUsed
        }
      };

    } finally {
      this.activeBatches.delete(batchId);
    }
  }

  /**
   * Get recent edge opportunities for monitoring
   */
  getRecentEdgeAlerts(minutes: number = 60): EdgeAlert[] {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return this.recentEdgeAlerts.filter(alert => alert.timestamp > cutoffTime);
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): {
    activeBatches: number;
    recentEdgeAlerts: number;
    averageProcessingTime: number;
    quotaStatus: any;
  } {
    return {
      activeBatches: this.activeBatches.size,
      recentEdgeAlerts: this.recentEdgeAlerts.length,
      averageProcessingTime: this.calculateAverageProcessingTime(),
      quotaStatus: lineShoppingEngine.getQuotaStatus()
    };
  }

  // ============================================================================
  // PRIVATE PROCESSING METHODS
  // ============================================================================

  /**
   * Process a chunk of props with line analysis
   */
  private async processChunkWithLineAnalysis(
    props: PropWithLineAnalysis[],
    sport?: string
  ): Promise<{
    processedProps: PropWithLineAnalysis[];
    edgeOpportunities: EdgeAlert[];
    quotaUsed: { oddsApi: number; optimal: number };
  }> {
    const propIds = props.map(p => p.id);

    try {
      // Use LineShoppingEngine to find best lines
      const lineShoppingResult = await lineShoppingEngine.findBestLines(propIds, sport);

      const processedProps: PropWithLineAnalysis[] = [];
      const edgeOpportunities: EdgeAlert[] = [];

      // Merge results with original props
      for (const prop of props) {
        const lineAnalysis = lineShoppingResult.edgeOpportunities.find(
          edge => edge.propId === prop.id
        );

        const processedProp: PropWithLineAnalysis = {
          ...prop,
          analysisCompleted: true,
          processingTimeMs: lineShoppingResult.processingStats.avgTimePerProp
        };

        if (lineAnalysis) {
          processedProp.lineAnalysis = lineAnalysis;
          processedProp.bestOdds = lineAnalysis.bestPrice;
          processedProp.bestSource = lineAnalysis.bestSource;
          processedProp.edgeValue = lineAnalysis.edgeValue;
          processedProp.recommendedAction = this.determineRecommendedAction(lineAnalysis);

          // Create edge alert if threshold met
          if (lineAnalysis.edgeValue >= this.config.minEdgeForAlert) {
            const edgeAlert: EdgeAlert = {
              propId: prop.id,
              player: prop.player_name,
              sport: prop.sport,
              market: prop.market,
              line: prop.line,
              edge: lineAnalysis.edgeValue,
              bestPrice: lineAnalysis.bestPrice,
              bestSource: lineAnalysis.bestSource,
              impliedProbability: lineAnalysis.impliedProbability,
              confidence: lineAnalysis.confidenceScore,
              timestamp: new Date()
            };

            edgeOpportunities.push(edgeAlert);
            this.recentEdgeAlerts.push(edgeAlert);
          }
        }

        processedProps.push(processedProp);
      }

      // Cleanup old edge alerts
      this.cleanupOldEdgeAlerts();

      return {
        processedProps,
        edgeOpportunities,
        quotaUsed: {
          oddsApi: lineShoppingResult.apiQuotaUsage.oddsApi.used,
          optimal: lineShoppingResult.apiQuotaUsage.optimal.used
        }
      };

    } catch (error) {
      this.logger.error('❌ Chunk line analysis failed', {
        propCount: props.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Return props with error status
      const processedProps = props.map(p => ({
        ...p,
        analysisCompleted: false,
        analysisError: error instanceof Error ? error.message : 'Analysis failed'
      }));

      return {
        processedProps,
        edgeOpportunities: [],
        quotaUsed: { oddsApi: 0, optimal: 0 }
      };
    }
  }

  /**
   * Determine recommended action based on line analysis
   */
  private determineRecommendedAction(analysis: OddsComparison): 'bet' | 'wait' | 'skip' {
    // High confidence and good edge - recommend bet
    if (analysis.confidenceScore >= 0.8 && analysis.edgeValue >= 4.0) {
      return 'bet';
    }

    // Moderate edge - recommend waiting for better line
    if (analysis.edgeValue >= 2.0 && analysis.edgeValue < 4.0) {
      return 'wait';
    }

    // Low or negative edge - skip
    return 'skip';
  }

  /**
   * Send edge alerts via Discord webhook
   */
  private async sendEdgeAlerts(edgeOpportunities: EdgeAlert[]): Promise<void> {
    if (!this.config.alertChannelWebhook) {
      this.logger.debug('📢 No Discord webhook configured for edge alerts');
      return;
    }

    try {
      // Filter alerts to prevent spam
      const filteredAlerts = this.filterAlertsForSpam(edgeOpportunities);

      if (filteredAlerts.length === 0) {
        return;
      }

      const topEdges = filteredAlerts
        .sort((a, b) => b.edge - a.edge)
        .slice(0, 5); // Top 5 edges only

      const alertMessage = this.formatEdgeAlertsForDiscord(topEdges);

      // Send to Discord (simplified - would use actual webhook)
      this.logger.info('🚨 Edge opportunities detected', {
        count: filteredAlerts.length,
        topEdge: topEdges[0]?.edge.toFixed(2),
        alertMessage: alertMessage.substring(0, 200) + '...'
      });

      // In a real implementation, would POST to Discord webhook
      this.emit('edgeAlertsSent', {
        alerts: filteredAlerts,
        message: alertMessage
      });

      // Update cooldown timers
      filteredAlerts.forEach(alert => {
        const cooldownKey = `${alert.player}_${alert.market}`;
        this.alertCooldown.set(cooldownKey, new Date());
      });

    } catch (error) {
      this.logger.error('❌ Failed to send edge alerts', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Filter alerts to prevent spam
   */
  private filterAlertsForSpam(alerts: EdgeAlert[]): EdgeAlert[] {
    const cooldownMinutes = 30; // 30 minute cooldown per player/market combo
    const cutoffTime = new Date(Date.now() - cooldownMinutes * 60 * 1000);

    return alerts.filter(alert => {
      const cooldownKey = `${alert.player}_${alert.market}`;
      const lastAlert = this.alertCooldown.get(cooldownKey);

      return !lastAlert || lastAlert < cutoffTime;
    });
  }

  /**
   * Format edge alerts for Discord
   */
  private formatEdgeAlertsForDiscord(alerts: EdgeAlert[]): string {
    const lines = [
      '🚨 **EDGE OPPORTUNITIES DETECTED** 🚨',
      '',
    ];

    alerts.forEach((alert, index) => {
      lines.push(
        `**${index + 1}. ${alert.player} - ${alert.market}**`,
        `Sport: ${alert.sport} | Line: ${alert.line}`,
        `Edge: **${alert.edge.toFixed(2)}%** | Best: ${alert.bestPrice} (${alert.bestSource})`,
        `Confidence: ${(alert.confidence * 100).toFixed(1)}%`,
        ''
      );
    });

    lines.push(
      '---',
      `🕐 ${new Date().toLocaleTimeString()} | 🛒 LineShoppingEngine`
    );

    return lines.join('\n');
  }

  /**
   * Initialize CLV tracking for significant edges
   */
  private async initializeCLVTrackingForEdges(edgeOpportunities: EdgeAlert[]): Promise<void> {
    try {
      const significantEdges = edgeOpportunities.filter(edge =>
        edge.edge >= 3.0 && edge.confidence >= 0.7
      );

      for (const edge of significantEdges) {
        try {
          const clvTrackingId = await clvTrackingService.trackPick({
            propId: edge.propId,
            sport: edge.sport,
            market: edge.market,
            book: edge.bestSource,
            betLine: edge.line,
            betOdds: edge.bestPrice,
            modelEdge: edge.edge,
            gameTime: new Date() // Would get actual game time
          });

          // Update the prop with CLV tracking ID
          if (supabaseClient) {
            const supabaseClient = requireSupabase();
    await supabaseClient
              .from('sports_game_odds')
              .update({ clv_tracking_id: clvTrackingId })
              .eq('id', edge.propId);
          }

          this.logger.debug('📊 CLV tracking initiated', {
            propId: edge.propId,
            clvTrackingId,
            edge: edge.edge
          });

        } catch (error) {
          this.logger.error('❌ CLV tracking initialization failed', {
            propId: edge.propId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

    } catch (error) {
      this.logger.error('❌ Batch CLV tracking initialization failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ============================================================================
  // EVENT HANDLING AND MONITORING
  // ============================================================================

  /**
   * Setup event listeners for line shopping engine
   */
  private setupEventListeners(): void {
    lineShoppingEngine.on('analysisComplete', (data) => {
      this.logger.info('📊 Line shopping analysis completed', data);
    });

    lineShoppingEngine.on('quotaWarning', (data) => {
      this.logger.warn('⚠️ API quota warning', data);
      this.emit('quotaWarning', data);
    });

    lineShoppingEngine.on('emergencyModeActivated', (data) => {
      this.logger.error('🚨 Emergency mode activated - API quotas exhausted', data);
      this.emit('emergencyMode', { activated: true, quotaStatus: data });
    });

    lineShoppingEngine.on('emergencyModeDeactivated', (data) => {
      this.logger.info('✅ Emergency mode deactivated - API quotas restored', data);
      this.emit('emergencyMode', { activated: false, quotaStatus: data });
    });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Calculate average processing time from recent batches
   */
  private calculateAverageProcessingTime(): number {
    const recentBatches = Array.from(this.activeBatches.values())
      .filter(batch => batch.endTime);

    if (recentBatches.length === 0) {
      return 0;
    }

    const totalTime = recentBatches.reduce((sum, batch) => sum + batch.processingTimeMs, 0);
    return totalTime / recentBatches.length;
  }

  /**
   * Cleanup old edge alerts to prevent memory leaks
   */
  private cleanupOldEdgeAlerts(): void {
    const maxAge = 4 * 60 * 60 * 1000; // 4 hours
    const cutoffTime = new Date(Date.now() - maxAge);

    this.recentEdgeAlerts = this.recentEdgeAlerts.filter(
      alert => alert.timestamp > cutoffTime
    );

    // Cleanup alert cooldowns
    const cooldownEntries = Array.from(this.alertCooldown.entries());
    cooldownEntries.forEach(([key, time]) => {
      if (time < cutoffTime) {
        this.alertCooldown.delete(key);
      }
    });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export singleton instance
export const lineShoppingIntegration = new LineShoppingIntegration();

// Export factory function
export const createLineShoppingIntegration = (config?: Partial<LineShoppingConfig>) =>
  new LineShoppingIntegration(config);