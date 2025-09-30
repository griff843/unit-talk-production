/**
 * Steam Detection Engine
 * Feature 1 of 8 Professional Capper Features
 *
 * Real-time steam move detection with volume correlation
 * Monitor line movements >2 points within 5 minutes
 * Correlate with betting volume and sharp money indicators
 * Integration with Optimal API and Odds API data streams
 */

import { EventEmitter } from 'events';
import type {
  SteamDetectionEngine as ISteamDetectionEngine,
  SteamDetectionConfig,
  SteamDetectionInput,
  SteamAnalysisResult,
  SteamMonitoringState,
  SteamDetectionMetrics,
  SteamEvent,
  SteamPropState,
  SteamHistoryFilters,
  EngineHealthStatus,
  LineDataPoint,
  VolumeDataPoint,
  SharpIndicator,
  SteamActionRecommendation
} from '../types/steam-detection';
import { createLogger } from '../../utils/logger';

export class SteamDetectionEngine extends EventEmitter implements ISteamDetectionEngine {
  private logger: any;
  private config: SteamDetectionConfig;
  private monitoringState: SteamMonitoringState;
  private steamHistory: SteamEvent[] = [];
  private isProcessing = false;

  constructor(config?: Partial<SteamDetectionConfig>) {
    super();
    this.logger = createLogger('SteamDetectionEngine');

    // Default configuration
    this.config = {
      minLineMovement: 2.0,
      timeWindow: 5, // 5 minutes
      volumeCorrelationThreshold: 0.7,
      reverseLineMovementWeight: 0.3,
      volumeSpikeWeight: 0.25,
      bookmakerReactionWeight: 0.25,
      crossBookConsensusWeight: 0.2,
      enabledBooks: ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'PointsBet', 'Barstool'],
      updateFrequency: 30, // 30 seconds
      minVolume: 1000, // Minimum $1000 in volume
      sportSpecificThresholds: {
        NFL: { sport: 'NFL', lineMovementMultiplier: 1.5, volumeMultiplier: 2.0, steamFrequency: 0.15, falsePositiveRate: 0.1 },
        NBA: { sport: 'NBA', lineMovementMultiplier: 1.2, volumeMultiplier: 1.5, steamFrequency: 0.25, falsePositiveRate: 0.15 },
        MLB: { sport: 'MLB', lineMovementMultiplier: 1.0, volumeMultiplier: 1.0, steamFrequency: 0.10, falsePositiveRate: 0.08 },
        NHL: { sport: 'NHL', lineMovementMultiplier: 1.3, volumeMultiplier: 1.3, steamFrequency: 0.12, falsePositiveRate: 0.12 },
        NCAAF: { sport: 'NCAAF', lineMovementMultiplier: 2.0, volumeMultiplier: 1.8, steamFrequency: 0.20, falsePositiveRate: 0.18 }
      },
      ...config
    };

    this.initializeMonitoringState();
    this.logger.info('🔥 Steam Detection Engine initialized', {
      config: {
        minLineMovement: this.config.minLineMovement,
        timeWindow: this.config.timeWindow,
        enabledBooks: this.config.enabledBooks.length,
        sports: Object.keys(this.config.sportSpecificThresholds)
      }
    });
  }

  private initializeMonitoringState(): void {
    this.monitoringState = {
      activeProps: new Map(),
      recentSteams: [],
      systemLoad: 0,
      config: this.config,
      lastConfigUpdate: new Date().toISOString(),
      metrics: {
        totalDetections: 0,
        truePositives: 0,
        falsePositives: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        avgDetectionLatency: 0,
        earlyDetectionRate: 0,
        avgSteamEdge: 0,
        steamBetSuccess: 0,
        avgCLV: 0,
        marketsMonitored: 0,
        steamEventsPerDay: 0,
        avgSteamSize: 0,
        sportMetrics: {}
      },
      lastMetricsUpdate: new Date().toISOString(),
      health: {
        status: 'HEALTHY',
        dataFeed: true,
        volumeFeed: true,
        processingLatency: 0,
        errors: []
      }
    };
  }

  /**
   * Core steam detection algorithm
   */
  async detectSteam(input: SteamDetectionInput): Promise<SteamAnalysisResult> {
    const startTime = Date.now();
    this.logger.debug('🔍 Analyzing potential steam move', {
      propId: input.propId,
      sport: input.sport,
      currentLine: input.currentLine,
      dataPoints: input.lineHistory.length
    });

    try {
      // 1. Analyze line movement patterns
      const lineMovementAnalysis = this.analyzeLineMovement(input);

      // 2. Analyze volume correlation
      const volumeCorrelation = this.analyzeVolumeCorrelation(input);

      // 3. Detect sharp money indicators
      const sharpIndicators = this.detectSharpMoneyIndicators(input, lineMovementAnalysis, volumeCorrelation);

      // 4. Calculate historical context
      const historicalContext = await this.getHistoricalContext(input);

      // 5. Generate predictions
      const predictions = this.generatePredictions(input, lineMovementAnalysis, volumeCorrelation);

      // 6. Calculate overall steam score
      const steamScore = this.calculateSteamScore(lineMovementAnalysis, volumeCorrelation, sharpIndicators);

      // 7. Determine steam detection
      const steamDetected = this.determineSteamDetection(steamScore, input.sport);

      // 8. Generate actionable recommendation
      const recommendation = this.generateRecommendation(
        steamDetected,
        steamScore,
        lineMovementAnalysis,
        predictions,
        input
      );

      const processingTime = Date.now() - startTime;

      const result: SteamAnalysisResult = {
        steamDetected,
        steamScore,
        confidence: this.calculateConfidence(steamScore, sharpIndicators, historicalContext),
        severity: this.determineSeverity(steamScore, lineMovementAnalysis.totalMovement),
        lineMovement: lineMovementAnalysis,
        volumeCorrelation,
        sharpIndicators,
        historicalSteam: historicalContext,
        predictions,
        recommendation
      };

      // Update monitoring state if actively monitoring this prop
      if (this.monitoringState.activeProps.has(input.propId)) {
        this.updatePropState(input.propId, result);
      }

      // Emit steam detection event
      if (steamDetected) {
        this.emit('steamDetected', {
          propId: input.propId,
          score: steamScore,
          severity: result.severity,
          result
        });

        this.logger.info('🔥 STEAM DETECTED', {
          propId: input.propId,
          sport: input.sport,
          steamScore: steamScore.toFixed(1),
          lineMovement: lineMovementAnalysis.totalMovement,
          confidence: result.confidence,
          recommendation: recommendation.action,
          processingTime: `${processingTime}ms`
        });
      }

      // Update metrics
      this.updateMetrics(result, processingTime);

      return result;

    } catch (error) {
      this.logger.error('❌ Steam detection failed', {
        propId: input.propId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  }

  /**
   * Analyze line movement patterns
   */
  private analyzeLineMovement(input: SteamDetectionInput) {
    const sportConfig = this.config.sportSpecificThresholds[input.sport] ||
                       this.config.sportSpecificThresholds['MLB']; // Default to MLB

    const adjustedMinMovement = this.config.minLineMovement * sportConfig.lineMovementMultiplier;

    // Calculate movement within time window
    const cutoffTime = new Date(Date.now() - this.config.timeWindow * 60 * 1000);
    const recentHistory = input.lineHistory.filter(point =>
      new Date(point.timestamp) > cutoffTime
    );

    if (recentHistory.length < 2) {
      return {
        totalMovement: 0,
        timeToMove: 0,
        accelerationRate: 0,
        consistency: 0
      };
    }

    // Calculate total movement
    const firstPoint = recentHistory[0];
    const lastPoint = recentHistory[recentHistory.length - 1];
    const totalMovement = Math.abs(lastPoint.line - firstPoint.line);

    // Calculate time to move
    const timeToMove = (new Date(lastPoint.timestamp).getTime() -
                       new Date(firstPoint.timestamp).getTime()) / (1000 * 60); // minutes

    // Calculate acceleration (change in rate of movement)
    let accelerationRate = 0;
    if (recentHistory.length >= 3) {
      const midPoint = recentHistory[Math.floor(recentHistory.length / 2)];
      const firstHalfRate = Math.abs(midPoint.line - firstPoint.line) /
                           ((new Date(midPoint.timestamp).getTime() - new Date(firstPoint.timestamp).getTime()) / (1000 * 60));
      const secondHalfRate = Math.abs(lastPoint.line - midPoint.line) /
                            ((new Date(lastPoint.timestamp).getTime() - new Date(midPoint.timestamp).getTime()) / (1000 * 60));
      accelerationRate = secondHalfRate - firstHalfRate;
    }

    // Calculate cross-book consistency
    const bookMovements = new Map<string, number>();
    recentHistory.forEach(point => {
      if (!bookMovements.has(point.bookmaker)) {
        bookMovements.set(point.bookmaker, 0);
      }
    });

    // Group by bookmaker and calculate individual movements
    const bookSpecificMovements: number[] = [];
    for (const book of this.config.enabledBooks) {
      const bookHistory = recentHistory.filter(p => p.bookmaker === book);
      if (bookHistory.length >= 2) {
        const bookMovement = Math.abs(bookHistory[bookHistory.length - 1].line - bookHistory[0].line);
        bookSpecificMovements.push(bookMovement);
      }
    }

    // Consistency is 1 - (standard deviation / mean)
    let consistency = 0;
    if (bookSpecificMovements.length > 1) {
      const mean = bookSpecificMovements.reduce((sum, mov) => sum + mov, 0) / bookSpecificMovements.length;
      const variance = bookSpecificMovements.reduce((sum, mov) => sum + Math.pow(mov - mean, 2), 0) / bookSpecificMovements.length;
      const stdDev = Math.sqrt(variance);
      consistency = mean > 0 ? Math.max(0, 1 - (stdDev / mean)) : 0;
    }

    return {
      totalMovement,
      timeToMove,
      accelerationRate,
      consistency
    };
  }

  /**
   * Analyze volume correlation with line movement
   */
  private analyzeVolumeCorrelation(input: SteamDetectionInput) {
    const cutoffTime = new Date(Date.now() - this.config.timeWindow * 60 * 1000);
    const recentVolume = input.volumeHistory.filter(point =>
      new Date(point.timestamp) > cutoffTime
    );

    if (recentVolume.length === 0) {
      return {
        correlation: 0,
        volumeIncrease: 0,
        sharpMoneyPercentage: 0,
        publicMoneyPercentage: 0
      };
    }

    // Calculate volume increase
    const currentVolume = recentVolume.reduce((sum, point) => sum + point.volume, 0);
    const baselineTime = new Date(Date.now() - this.config.timeWindow * 2 * 60 * 1000);
    const baselineVolume = input.volumeHistory
      .filter(point => new Date(point.timestamp) > baselineTime && new Date(point.timestamp) <= cutoffTime)
      .reduce((sum, point) => sum + point.volume, 0);

    const volumeIncrease = baselineVolume > 0 ?
      ((currentVolume - baselineVolume) / baselineVolume) * 100 : 0;

    // Calculate sharp vs public money
    const sharpVolume = recentVolume
      .filter(point => point.isSharpMoney)
      .reduce((sum, point) => sum + point.volume, 0);
    const totalVolume = recentVolume.reduce((sum, point) => sum + point.volume, 0);

    const sharpMoneyPercentage = totalVolume > 0 ? (sharpVolume / totalVolume) * 100 : 0;
    const publicMoneyPercentage = 100 - sharpMoneyPercentage;

    // Calculate correlation between volume and line movement
    // This would require more sophisticated statistical analysis
    // For now, use a simplified heuristic
    const correlation = Math.min(1, (volumeIncrease / 100) * (sharpMoneyPercentage / 100));

    return {
      correlation,
      volumeIncrease,
      sharpMoneyPercentage,
      publicMoneyPercentage
    };
  }

  /**
   * Detect sharp money indicators
   */
  private detectSharpMoneyIndicators(
    input: SteamDetectionInput,
    lineMovement: any,
    volumeCorrelation: any
  ) {
    // 1. Reverse line movement (line moves opposite to public money)
    const reverseLineMovement: SharpIndicator = {
      detected: volumeCorrelation.publicMoneyPercentage > 60 && lineMovement.totalMovement > 1,
      score: Math.min(100, (volumeCorrelation.publicMoneyPercentage - 50) * 2),
      confidence: lineMovement.consistency,
      evidence: [],
      weight: this.config.reverseLineMovementWeight
    };

    if (reverseLineMovement.detected) {
      reverseLineMovement.evidence.push(
        `Line moved ${lineMovement.totalMovement} points despite ${volumeCorrelation.publicMoneyPercentage.toFixed(1)}% public money`
      );
    }

    // 2. Volume spike detection
    const volumeSpike: SharpIndicator = {
      detected: volumeCorrelation.volumeIncrease > 200,
      score: Math.min(100, volumeCorrelation.volumeIncrease / 2),
      confidence: Math.min(1, volumeCorrelation.volumeIncrease / 500),
      evidence: [],
      weight: this.config.volumeSpikeWeight
    };

    if (volumeSpike.detected) {
      volumeSpike.evidence.push(
        `Volume increased by ${volumeCorrelation.volumeIncrease.toFixed(1)}% in ${this.config.timeWindow} minutes`
      );
    }

    // 3. Bookmaker reaction analysis
    const bookmakerReaction: SharpIndicator = {
      detected: input.bookmakerData.some(data =>
        data.action === 'LIMIT_REDUCE' || data.action === 'SUSPEND'
      ),
      score: input.bookmakerData.filter(data =>
        data.action === 'LIMIT_REDUCE' || data.action === 'SUSPEND'
      ).length * 25,
      confidence: 0.8,
      evidence: [],
      weight: this.config.bookmakerReactionWeight
    };

    if (bookmakerReaction.detected) {
      const reactions = input.bookmakerData.filter(data =>
        data.action === 'LIMIT_REDUCE' || data.action === 'SUSPEND'
      );
      bookmakerReaction.evidence.push(
        `${reactions.length} bookmaker(s) reduced limits or suspended betting`
      );
    }

    // 4. Cross-book consensus
    const crossBookConsensus: SharpIndicator = {
      detected: lineMovement.consistency > 0.8 && lineMovement.totalMovement > 1,
      score: lineMovement.consistency * 100,
      confidence: lineMovement.consistency,
      evidence: [],
      weight: this.config.crossBookConsensusWeight
    };

    if (crossBookConsensus.detected) {
      crossBookConsensus.evidence.push(
        `${(lineMovement.consistency * 100).toFixed(1)}% consensus across multiple books`
      );
    }

    // Calculate overall sharp score
    const overallSharpScore =
      (reverseLineMovement.score * reverseLineMovement.weight) +
      (volumeSpike.score * volumeSpike.weight) +
      (bookmakerReaction.score * bookmakerReaction.weight) +
      (crossBookConsensus.score * crossBookConsensus.weight);

    return {
      reverseLineMovement,
      volumeSpike,
      bookmakerReaction,
      crossBookConsensus,
      overallSharpScore
    };
  }

  /**
   * Get historical context for similar events
   */
  private async getHistoricalContext(input: SteamDetectionInput) {
    // This would query historical database in a real implementation
    // For now, return simulated historical data
    const similarEvents = this.steamHistory.filter(event =>
      event.sport === input.sport &&
      Math.abs(event.lineMovement - Math.abs(input.currentLine - (input.lineHistory[0]?.line || input.currentLine))) < 2
    );

    return {
      similarSteamEvents: similarEvents.length,
      avgSteamSuccess: similarEvents.length > 0 ?
        similarEvents.filter(e => e.finalResult === 'WIN').length / similarEvents.length : 0.5,
      playerSteamHistory: 0.15, // Would be calculated from DB
      marketSteamHistory: 0.20  // Would be calculated from DB
    };
  }

  /**
   * Generate predictions about future line movement
   */
  private generatePredictions(
    input: SteamDetectionInput,
    lineMovement: any,
    volumeCorrelation: any
  ) {
    // Predict continued movement based on acceleration and volume
    const continuedMovement = Math.min(1,
      (lineMovement.accelerationRate / 2) + (volumeCorrelation.correlation * 0.5)
    );

    // Predict reversal probability (contrarian indicator)
    const reversalProbability = Math.max(0,
      0.3 - (lineMovement.consistency * 0.2) - (volumeCorrelation.sharpMoneyPercentage / 100 * 0.1)
    );

    // Estimate final line
    const finalLineEstimate = input.currentLine +
      (lineMovement.totalMovement * (1 + lineMovement.accelerationRate));

    // Time to stabilize (when movement will stop)
    const timeToStabilize = Math.max(5, 30 - (lineMovement.accelerationRate * 10));

    return {
      continuedMovement,
      reversalProbability,
      finalLineEstimate,
      timeToStabilize
    };
  }

  /**
   * Calculate overall steam score
   */
  private calculateSteamScore(
    lineMovement: any,
    volumeCorrelation: any,
    sharpIndicators: any
  ): number {
    const sportConfig = this.config.sportSpecificThresholds['MLB']; // Default

    // Base score from line movement
    const movementScore = Math.min(50, (lineMovement.totalMovement / this.config.minLineMovement) * 25);

    // Volume correlation score
    const volumeScore = volumeCorrelation.correlation * 25;

    // Sharp indicators score (already weighted)
    const sharpScore = sharpIndicators.overallSharpScore * 0.25;

    // Time factor (faster movement = higher score)
    const timeFactor = lineMovement.timeToMove > 0 ?
      Math.min(25, (this.config.timeWindow / lineMovement.timeToMove) * 10) : 0;

    return Math.min(100, movementScore + volumeScore + sharpScore + timeFactor);
  }

  /**
   * Determine if steam is detected based on score and sport
   */
  private determineSteamDetection(steamScore: number, sport: string): boolean {
    const sportConfig = this.config.sportSpecificThresholds[sport] ||
                       this.config.sportSpecificThresholds['MLB'];

    // Dynamic threshold based on sport's false positive rate
    const threshold = 60 + (sportConfig.falsePositiveRate * 20);

    return steamScore >= threshold;
  }

  /**
   * Calculate confidence in steam detection
   */
  private calculateConfidence(
    steamScore: number,
    sharpIndicators: any,
    historicalContext: any
  ): number {
    // Base confidence from score
    const scoreConfidence = steamScore / 100;

    // Confidence from sharp indicators
    const sharpConfidence = sharpIndicators.overallSharpScore / 100;

    // Historical success rate
    const historicalConfidence = historicalContext.avgSteamSuccess;

    // Weight the factors
    return (scoreConfidence * 0.4) + (sharpConfidence * 0.4) + (historicalConfidence * 0.2);
  }

  /**
   * Determine steam severity
   */
  private determineSeverity(steamScore: number, lineMovement: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (steamScore >= 90 && lineMovement >= 5) return 'CRITICAL';
    if (steamScore >= 80 && lineMovement >= 3) return 'HIGH';
    if (steamScore >= 70 && lineMovement >= 2) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Generate actionable recommendation
   */
  private generateRecommendation(
    steamDetected: boolean,
    steamScore: number,
    lineMovement: any,
    predictions: any,
    input: SteamDetectionInput
  ): SteamActionRecommendation {
    if (!steamDetected) {
      return {
        action: 'AVOID_STEAM',
        reasoning: 'No significant steam detected',
        urgency: 'NO_ACTION',
        optimalEntryWindow: {
          start: new Date().toISOString(),
          end: new Date().toISOString(),
          reasoning: 'No action required'
        },
        steamRisk: {
          falsePositiveRisk: 0.8,
          reversalRisk: 0.3,
          continuedrMovementRisk: 0.2,
          overallRisk: 'LOW'
        },
        steamEdge: {
          currentEdge: 0,
          peakEdge: 0,
          expectedEdge: 0,
          edgeDecayRate: 0
        }
      };
    }

    // Determine action based on steam characteristics
    let action: 'BET_IMMEDIATELY' | 'MONITOR_CLOSELY' | 'WAIT_FOR_STABILITY' | 'AVOID_STEAM';
    let urgency: 'IMMEDIATE' | 'SOON' | 'MONITOR' | 'NO_ACTION';

    if (steamScore >= 85 && lineMovement.accelerationRate > 0) {
      action = 'BET_IMMEDIATELY';
      urgency = 'IMMEDIATE';
    } else if (steamScore >= 70) {
      action = 'MONITOR_CLOSELY';
      urgency = 'SOON';
    } else if (predictions.continuedMovement > 0.7) {
      action = 'MONITOR_CLOSELY';
      urgency = 'MONITOR';
    } else {
      action = 'WAIT_FOR_STABILITY';
      urgency = 'MONITOR';
    }

    // Calculate optimal entry window
    const currentTime = new Date();
    const windowStart = new Date(currentTime.getTime() + (urgency === 'IMMEDIATE' ? 0 : 2 * 60 * 1000));
    const windowEnd = new Date(currentTime.getTime() + predictions.timeToStabilize * 60 * 1000);

    // Calculate edge estimates
    const currentEdge = Math.max(0, steamScore / 100 * 0.15); // Max 15% edge
    const peakEdge = currentEdge * (1 + predictions.continuedMovement * 0.5);
    const expectedEdge = action === 'BET_IMMEDIATELY' ? currentEdge : peakEdge * 0.8;
    const edgeDecayRate = expectedEdge / predictions.timeToStabilize;

    return {
      action,
      reasoning: this.generateReasoningText(action, steamScore, lineMovement, predictions),
      urgency,
      optimalEntryWindow: {
        start: windowStart.toISOString(),
        end: windowEnd.toISOString(),
        reasoning: `Optimal window based on ${action.toLowerCase()} strategy`
      },
      steamRisk: {
        falsePositiveRisk: Math.max(0.05, 1 - (steamScore / 100)),
        reversalRisk: predictions.reversalProbability,
        continuedrMovementRisk: 1 - predictions.continuedMovement,
        overallRisk: steamScore >= 80 ? 'LOW' : steamScore >= 60 ? 'MEDIUM' : 'HIGH'
      },
      steamEdge: {
        currentEdge,
        peakEdge,
        expectedEdge,
        edgeDecayRate
      }
    };
  }

  /**
   * Generate reasoning text for recommendation
   */
  private generateReasoningText(
    action: string,
    steamScore: number,
    lineMovement: any,
    predictions: any
  ): string {
    switch (action) {
      case 'BET_IMMEDIATELY':
        return `Strong steam detected (score: ${steamScore.toFixed(1)}) with ${lineMovement.totalMovement} point movement and positive acceleration. Act immediately to capture maximum edge.`;

      case 'MONITOR_CLOSELY':
        return `Moderate steam detected (score: ${steamScore.toFixed(1)}). Monitor for continued movement or stabilization before acting.`;

      case 'WAIT_FOR_STABILITY':
        return `Weak steam signal. Wait for line stabilization or stronger confirmation before considering action.`;

      case 'AVOID_STEAM':
      default:
        return 'No significant steam detected or high risk of false positive.';
    }
  }

  /**
   * Update monitoring state for a prop
   */
  private updatePropState(propId: string, result: SteamAnalysisResult): void {
    const propState = this.monitoringState.activeProps.get(propId);
    if (propState) {
      propState.lastAnalysis = result;
      propState.analysisHistory.push(result);
      propState.lastUpdate = new Date().toISOString();

      if (result.steamDetected) {
        propState.steamStatus = 'STEAM_DETECTED';
      }
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(result: SteamAnalysisResult, processingTime: number): void {
    this.monitoringState.metrics.totalDetections++;

    if (result.steamDetected) {
      // This would be updated later when we know if it was a true positive
      this.monitoringState.metrics.truePositives++;
    }

    // Update processing latency
    this.monitoringState.health.processingLatency =
      (this.monitoringState.health.processingLatency + processingTime) / 2;
  }

  /**
   * Start monitoring a prop for steam
   */
  startMonitoring(propId: string): void {
    if (!this.monitoringState.activeProps.has(propId)) {
      const propState: SteamPropState = {
        propId,
        startMonitoring: new Date().toISOString(),
        currentLine: 0,
        initialLine: 0,
        totalMovement: 0,
        lastUpdate: new Date().toISOString(),
        steamStatus: 'MONITORING',
        lastAnalysis: {} as SteamAnalysisResult,
        lineHistory: [],
        volumeHistory: [],
        analysisHistory: []
      };

      this.monitoringState.activeProps.set(propId, propState);
      this.logger.info(`📊 Started monitoring prop ${propId} for steam`);
    }
  }

  /**
   * Stop monitoring a prop
   */
  stopMonitoring(propId: string): void {
    if (this.monitoringState.activeProps.has(propId)) {
      this.monitoringState.activeProps.delete(propId);
      this.logger.info(`🛑 Stopped monitoring prop ${propId}`);
    }
  }

  /**
   * Get current monitoring state
   */
  getMonitoringState(): SteamMonitoringState {
    return { ...this.monitoringState };
  }

  /**
   * Update engine configuration
   */
  updateConfig(config: Partial<SteamDetectionConfig>): void {
    this.config = { ...this.config, ...config };
    this.monitoringState.config = this.config;
    this.monitoringState.lastConfigUpdate = new Date().toISOString();

    this.logger.info('⚙️ Steam detection configuration updated', {
      updatedFields: Object.keys(config)
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): SteamDetectionConfig {
    return { ...this.config };
  }

  /**
   * Get performance metrics
   */
  getMetrics(): SteamDetectionMetrics {
    return { ...this.monitoringState.metrics };
  }

  /**
   * Get steam history with optional filters
   */
  getSteamHistory(filters?: SteamHistoryFilters): SteamEvent[] {
    let filteredHistory = [...this.steamHistory];

    if (filters) {
      if (filters.sport) {
        filteredHistory = filteredHistory.filter(event => event.sport === filters.sport);
      }

      if (filters.market) {
        filteredHistory = filteredHistory.filter(event => event.market === filters.market);
      }

      if (filters.dateRange) {
        const start = new Date(filters.dateRange.start);
        const end = new Date(filters.dateRange.end);
        filteredHistory = filteredHistory.filter(event => {
          const eventDate = new Date(event.startTime);
          return eventDate >= start && eventDate <= end;
        });
      }

      if (filters.severity) {
        filteredHistory = filteredHistory.filter(event =>
          filters.severity!.includes(event.severity)
        );
      }

      if (filters.confirmed !== undefined) {
        filteredHistory = filteredHistory.filter(event => event.confirmed === filters.confirmed);
      }

      if (filters.minLineMovement !== undefined) {
        filteredHistory = filteredHistory.filter(event =>
          event.lineMovement >= filters.minLineMovement!
        );
      }

      if (filters.maxLineMovement !== undefined) {
        filteredHistory = filteredHistory.filter(event =>
          event.lineMovement <= filters.maxLineMovement!
        );
      }
    }

    return filteredHistory;
  }

  /**
   * Check engine health status
   */
  async checkHealth(): Promise<EngineHealthStatus> {
    const health: EngineHealthStatus = {
      status: 'HEALTHY',
      lastUpdate: new Date().toISOString(),
      checks: {
        dataConnectivity: this.monitoringState.health.dataFeed,
        processingSpeed: this.monitoringState.health.processingLatency < 1000,
        memoryUsage: process.memoryUsage().heapUsed < 500 * 1024 * 1024, // 500MB
        errorRate: this.monitoringState.health.errors.length < 10
      },
      warnings: [],
      errors: [...this.monitoringState.health.errors]
    };

    // Determine overall status
    const failedChecks = Object.values(health.checks).filter(check => !check).length;

    if (failedChecks === 0) {
      health.status = 'HEALTHY';
    } else if (failedChecks <= 2) {
      health.status = 'DEGRADED';
      health.warnings.push(`${failedChecks} health checks failing`);
    } else {
      health.status = 'UNHEALTHY';
      health.errors.push(`${failedChecks} critical health checks failing`);
    }

    return health;
  }
}