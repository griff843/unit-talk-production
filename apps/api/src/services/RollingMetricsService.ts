/**
 * Rolling Metrics Watcher Service
 * Tracks Posted EV, Positive CLV%, Hit%, ROI with 7/30/lifetime rolling windows
 * Includes auto-learning feedback loops for performance optimization
 */

import { Logger, createLogger } from '../utils/logger';
import { supabaseClient } from './supabaseClient';
import { shadowWriteMetrics, isShadowMode } from '../shadow/ShadowMode';

export interface MetricsWindow {
  window: '7d' | '30d' | 'lifetime';
  startDate: Date;
  endDate: Date;
  totalPicks: number;
  completedPicks: number;
  metrics: WindowMetrics;
}

export interface WindowMetrics {
  // Core Performance Metrics
  postedEV: number;                    // Average posted expected value
  actualEV: number;                     // Actual realized expected value
  evDeviation: number;                  // Deviation from expected
  
  // CLV Metrics
  positiveCLVPercentage: number;       // % of picks with positive CLV
  averageCLV: number;                  // Average CLV in BPS
  clvCapture: number;                  // % of theoretical CLV captured
  
  // Hit Rate Metrics
  hitPercentage: number;                // Overall hit rate
  hitByTier: Record<string, number>;   // Hit rate by tier (S/A/B)
  hitBySport: Record<string, number>;  // Hit rate by sport
  
  // ROI Metrics
  roi: number;                          // Overall return on investment
  roiByTier: Record<string, number>;   // ROI by tier
  roiBySport: Record<string, number>;  // ROI by sport
  
  // Risk Metrics
  sharpeRatio: number;                  // Risk-adjusted returns
  maxDrawdown: number;                  // Maximum drawdown percentage
  winRate: number;                      // Win percentage
  avgWin: number;                       // Average win size
  avgLoss: number;                      // Average loss size
  profitFactor: number;                 // Gross profit / Gross loss
  
  // Kelly Metrics
  kellyAtRisk: number;                  // Portfolio at risk using Kelly
  kellyEfficiency: number;              // Actual vs optimal Kelly sizing
  kellyRegret: number;                  // Opportunity cost from suboptimal sizing
}

export interface SportMetrics {
  sport: string;
  windows: MetricsWindow[];
  trends: TrendAnalysis;
  adjustments: LearningAdjustment[];
}

export interface TrendAnalysis {
  evTrend: 'improving' | 'declining' | 'stable';
  clvTrend: 'improving' | 'declining' | 'stable';
  roiTrend: 'improving' | 'declining' | 'stable';
  confidence: number;
  momentum: number;
  volatility: number;
}

export interface LearningAdjustment {
  timestamp: Date;
  sport: string;
  adjustmentType: 'threshold' | 'weight' | 'filter' | 'sizing';
  parameter: string;
  oldValue: number;
  newValue: number;
  reason: string;
  expectedImpact: number;
  actualImpact?: number;
}

export interface PerformanceAlert {
  id: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'critical';
  type: 'underperformance' | 'overperformance' | 'anomaly' | 'threshold_breach';
  metric: string;
  window: '7d' | '30d' | 'lifetime';
  sport?: string;
  message: string;
  recommendedAction?: string;
  autoAdjustmentApplied?: boolean;
}

class RollingMetricsService {
  private static instance: RollingMetricsService;
  private logger: Logger;
  private metricsCache: Map<string, MetricsWindow[]> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  
  // Learning parameters
  private readonly LEARNING_CONFIG = {
    minSampleSize: 30,                   // Minimum picks for learning
    confidenceThreshold: 0.75,           // Minimum confidence for adjustments
    adjustmentRate: 0.1,                 // Maximum adjustment per iteration
    backtestWindow: 90,                  // Days to backtest adjustments
    performanceTarget: {
      minROI: 0.05,                      // 5% minimum ROI target
      minHitRate: 0.52,                  // 52% minimum hit rate
      maxDrawdown: 0.15,                 // 15% maximum drawdown
      minSharpe: 1.0                     // 1.0 minimum Sharpe ratio
    }
  };

  // Alert thresholds
  private readonly ALERT_THRESHOLDS = {
    evDeviation: 0.2,                    // 20% deviation from expected EV
    clvDecline: -10,                     // 10 BPS CLV decline
    roiDecline: -0.05,                   // 5% ROI decline
    drawdownLimit: 0.2,                  // 20% drawdown limit
    winRateMinimum: 0.48,                // 48% minimum win rate
    kellyEfficiencyMin: 0.7              // 70% Kelly efficiency minimum
  };

  private constructor() {
    this.logger = createLogger('RollingMetricsService');
    this.initializeService();
  }

  public static getInstance(): RollingMetricsService {
    if (!RollingMetricsService.instance) {
      RollingMetricsService.instance = new RollingMetricsService();
    }
    return RollingMetricsService.instance;
  }

  /**
   * Initialize the metrics service
   */
  private async initializeService(): Promise<void> {
    this.logger.info('Initializing Rolling Metrics Service');
    
    // Start continuous monitoring
    this.startMetricsMonitoring();
    
    // Load historical metrics
    await this.loadHistoricalMetrics();
    
    this.logger.info('Rolling Metrics Service initialized');
  }

  /**
   * Start continuous metrics monitoring
   */
  private startMetricsMonitoring(): void {
    // Update metrics every hour
    this.updateInterval = setInterval(async () => {
      await this.updateAllMetrics();
      await this.runLearningCycle();
      await this.checkPerformanceAlerts();
    }, 3600000); // 1 hour

    this.logger.info('Metrics monitoring started');
  }

  /**
   * Calculate metrics for a specific window
   */
  public async calculateMetricsForWindow(
    window: '7d' | '30d' | 'lifetime',
    sport?: string
  ): Promise<MetricsWindow> {
    const now = new Date();
    const startDate = this.getWindowStartDate(window, now);
    
    // Get picks for the window
    const picks = await this.getPicksForWindow(startDate, now, sport);
    
    // Calculate core metrics
    const metrics = await this.calculateWindowMetrics(picks);
    
    return {
      window,
      startDate,
      endDate: now,
      totalPicks: picks.length,
      completedPicks: picks.filter(p => p.status === 'settled').length,
      metrics
    };
  }

  /**
   * Calculate detailed metrics for a set of picks
   */
  private async calculateWindowMetrics(picks: any[]): Promise<WindowMetrics> {
    const settledPicks = picks.filter(p => p.status === 'settled');
    
    if (settledPicks.length === 0) {
      return this.getEmptyMetrics();
    }

    // Calculate EV metrics
    const evMetrics = this.calculateEVMetrics(settledPicks);
    
    // Calculate CLV metrics
    const clvMetrics = this.calculateCLVMetrics(settledPicks);
    
    // Calculate hit rate metrics
    const hitMetrics = this.calculateHitMetrics(settledPicks);
    
    // Calculate ROI metrics
    const roiMetrics = this.calculateROIMetrics(settledPicks);
    
    // Calculate risk metrics
    const riskMetrics = this.calculateRiskMetrics(settledPicks);
    
    // Calculate Kelly metrics
    const kellyMetrics = this.calculateKellyMetrics(settledPicks);

    return {
      // EV Metrics
      postedEV: evMetrics.postedEV,
      actualEV: evMetrics.actualEV,
      evDeviation: evMetrics.deviation,
      
      // CLV Metrics
      positiveCLVPercentage: clvMetrics.positivePercentage,
      averageCLV: clvMetrics.average,
      clvCapture: clvMetrics.capture,
      
      // Hit Rate Metrics
      hitPercentage: hitMetrics.overall,
      hitByTier: hitMetrics.byTier,
      hitBySport: hitMetrics.bySport,
      
      // ROI Metrics
      roi: roiMetrics.overall,
      roiByTier: roiMetrics.byTier,
      roiBySport: roiMetrics.bySport,
      
      // Risk Metrics
      sharpeRatio: riskMetrics.sharpe,
      maxDrawdown: riskMetrics.maxDrawdown,
      winRate: riskMetrics.winRate,
      avgWin: riskMetrics.avgWin,
      avgLoss: riskMetrics.avgLoss,
      profitFactor: riskMetrics.profitFactor,
      
      // Kelly Metrics
      kellyAtRisk: kellyMetrics.atRisk,
      kellyEfficiency: kellyMetrics.efficiency,
      kellyRegret: kellyMetrics.regret
    };
  }

  /**
   * Calculate EV metrics
   */
  private calculateEVMetrics(picks: any[]): {
    postedEV: number;
    actualEV: number;
    deviation: number;
  } {
    const postedEVs = picks.map(p => p.expected_value || 0);
    const actualReturns = picks.map(p => {
      if (p.result === 'won') {
        return (p.odds || -110) > 0 ? (p.odds / 100) : (100 / Math.abs(p.odds || 110));
      }
      return -1;
    });

    const postedEV = postedEVs.reduce((sum, devigged_edge) => sum + devigged_edge, 0) / picks.length;
    const actualEV = actualReturns.reduce((sum, ret) => sum + ret, 0) / picks.length;
    const deviation = Math.abs(actualEV - postedEV) / Math.abs(postedEV || 1);

    return { postedEV, actualEV, deviation };
  }

  /**
   * Calculate CLV metrics
   */
  private calculateCLVMetrics(picks: any[]): {
    positivePercentage: number;
    average: number;
    capture: number;
  } {
    const clvData = picks
      .filter(p => p.clv_tracking)
      .map(p => p.clv_tracking.current_clv_bps || 0);

    if (clvData.length === 0) {
      return { positivePercentage: 0, average: 0, capture: 0 };
    }

    const positiveCount = clvData.filter(clv => clv > 0).length;
    const positivePercentage = (positiveCount / clvData.length) * 100;
    const average = clvData.reduce((sum, clv) => sum + clv, 0) / clvData.length;
    
    // Calculate capture rate (actual CLV captured vs theoretical maximum)
    const theoreticalMax = picks
      .filter(p => p.clv_tracking?.max_clv_bps)
      .map(p => p.clv_tracking.max_clv_bps)
      .reduce((sum, max) => sum + max, 0) / picks.length;
    
    const capture = theoreticalMax > 0 ? (average / theoreticalMax) * 100 : 0;

    return { positivePercentage, average, capture };
  }

  /**
   * Calculate hit rate metrics
   */
  private calculateHitMetrics(picks: any[]): {
    overall: number;
    byTier: Record<string, number>;
    bySport: Record<string, number>;
  } {
    const wins = picks.filter(p => p.result === 'won').length;
    const overall = (wins / picks.length) * 100;

    // By tier
    const byTier: Record<string, number> = {};
    const tiers = ['S', 'A', 'B'];
    for (const tier of tiers) {
      const tierPicks = picks.filter(p => p.tier === tier);
      if (tierPicks.length > 0) {
        const tierWins = tierPicks.filter(p => p.result === 'won').length;
        byTier[tier] = (tierWins / tierPicks.length) * 100;
      }
    }

    // By sport
    const bySport: Record<string, number> = {};
    const sports = [...new Set(picks.map(p => p.sport))];
    for (const sport of sports) {
      const sportPicks = picks.filter(p => p.sport === sport);
      if (sportPicks.length > 0) {
        const sportWins = sportPicks.filter(p => p.result === 'won').length;
        bySport[sport] = (sportWins / sportPicks.length) * 100;
      }
    }

    return { overall, byTier, bySport };
  }

  /**
   * Calculate ROI metrics
   */
  private calculateROIMetrics(picks: any[]): {
    overall: number;
    byTier: Record<string, number>;
    bySport: Record<string, number>;
  } {
    const calculateROI = (picksSubset: any[]) => {
      const totalStaked = picksSubset.reduce((sum, p) => sum + (p.stake || 1), 0);
      const totalReturns = picksSubset.reduce((sum, p) => {
        if (p.result === 'won') {
          const odds = p.odds || -110;
          const payout = odds > 0 ? 
            (p.stake || 1) * (1 + odds / 100) : 
            (p.stake || 1) * (1 + 100 / Math.abs(odds));
          return sum + payout;
        }
        return sum;
      }, 0);
      
      return totalStaked > 0 ? ((totalReturns - totalStaked) / totalStaked) * 100 : 0;
    };

    const overall = calculateROI(picks);

    // By tier
    const byTier: Record<string, number> = {};
    const tiers = ['S', 'A', 'B'];
    for (const tier of tiers) {
      const tierPicks = picks.filter(p => p.tier === tier);
      if (tierPicks.length > 0) {
        byTier[tier] = calculateROI(tierPicks);
      }
    }

    // By sport
    const bySport: Record<string, number> = {};
    const sports = [...new Set(picks.map(p => p.sport))];
    for (const sport of sports) {
      const sportPicks = picks.filter(p => p.sport === sport);
      if (sportPicks.length > 0) {
        bySport[sport] = calculateROI(sportPicks);
      }
    }

    return { overall, byTier, bySport };
  }

  /**
   * Calculate risk metrics
   */
  private calculateRiskMetrics(picks: any[]): {
    sharpe: number;
    maxDrawdown: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
  } {
    // Sort picks by date for drawdown calculation
    const sortedPicks = [...picks].sort((a, b) => 
      new Date(a.settled_at).getTime() - new Date(b.settled_at).getTime()
    );

    // Calculate returns series
    const returns = sortedPicks.map(p => {
      if (p.result === 'won') {
        const odds = p.odds || -110;
        return odds > 0 ? odds / 100 : 100 / Math.abs(odds);
      }
      return -1;
    });

    // Calculate Sharpe ratio
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized

    // Calculate maximum drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;
    
    for (const ret of returns) {
      cumulative += ret;
      if (cumulative > peak) {
        peak = cumulative;
      }
      const drawdown = peak > 0 ? (peak - cumulative) / peak : 0;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    // Calculate win/loss metrics
    const wins = returns.filter(r => r > 0);
    const losses = returns.filter(r => r < 0);
    const winRate = (wins.length / returns.length) * 100;
    const avgWin = wins.length > 0 ? wins.reduce((sum, w) => sum + w, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, l) => sum + l, 0) / losses.length) : 0;
    
    const grossProfit = wins.reduce((sum, w) => sum + w, 0);
    const grossLoss = Math.abs(losses.reduce((sum, l) => sum + l, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    return {
      sharpe,
      maxDrawdown,
      winRate,
      avgWin,
      avgLoss,
      profitFactor
    };
  }

  /**
   * Calculate Kelly metrics
   */
  private calculateKellyMetrics(picks: any[]): {
    atRisk: number;
    efficiency: number;
    regret: number;
  } {
    // Calculate actual Kelly fractions used
    const actualKellys = picks.map(p => p.kelly_fraction || 0.1);
    const avgActualKelly = actualKellys.reduce((sum, k) => sum + k, 0) / picks.length;

    // Calculate optimal Kelly fractions
    const optimalKellys = picks.map(p => {
      const devigged_edge = p.expected_value || 0;
      const odds = p.odds || -110;
      const prob = p.confidence || 0.5;
      
      // Kelly formula: f = (p * b - q) / b
      // where p = probability of win, q = probability of loss, b = odds
      const b = odds > 0 ? odds / 100 : 100 / Math.abs(odds);
      const q = 1 - prob;
      const kelly = Math.max(0, Math.min(0.25, (prob * (1 + b) - 1) / b));
      
      return kelly;
    });
    
    const avgOptimalKelly = optimalKellys.reduce((sum, k) => sum + k, 0) / picks.length;

    // Calculate metrics
    const atRisk = avgActualKelly;
    const efficiency = avgOptimalKelly > 0 ? avgActualKelly / avgOptimalKelly : 0;
    
    // Calculate regret (opportunity cost from suboptimal sizing)
    const actualGrowth = picks.reduce((growth, p, i) => {
      const ret = p.result === 'won' ? 
        (p.odds > 0 ? p.odds / 100 : 100 / Math.abs(p.odds || 110)) : -1;
      return growth * (1 + actualKellys[i] * ret);
    }, 1);
    
    const optimalGrowth = picks.reduce((growth, p, i) => {
      const ret = p.result === 'won' ? 
        (p.odds > 0 ? p.odds / 100 : 100 / Math.abs(p.odds || 110)) : -1;
      return growth * (1 + optimalKellys[i] * ret);
    }, 1);
    
    const regret = optimalGrowth > actualGrowth ? 
      ((optimalGrowth - actualGrowth) / actualGrowth) * 100 : 0;

    return { atRisk, efficiency, regret };
  }

  /**
   * Run auto-learning cycle
   */
  private async runLearningCycle(): Promise<void> {
    this.logger.info('Running auto-learning cycle');

    try {
      // Get recent performance data
      const recentMetrics = await this.calculateMetricsForWindow('30d');
      
      // Check if we have enough data
      if (recentMetrics.completedPicks < this.LEARNING_CONFIG.minSampleSize) {
        this.logger.info('Insufficient data for learning cycle', {
          completedPicks: recentMetrics.completedPicks,
          required: this.LEARNING_CONFIG.minSampleSize
        });
        return;
      }

      // Analyze performance by sport
      const sports = await this.getActiveSports();
      for (const sport of sports) {
        await this.analyzeSportPerformance(sport);
      }

      // Apply global adjustments if needed
      await this.applyGlobalAdjustments(recentMetrics);

      this.logger.info('Learning cycle completed');
    } catch (error) {
      this.logger.error('Learning cycle failed', { error });
    }
  }

  /**
   * Analyze and adjust sport-specific parameters
   */
  private async analyzeSportPerformance(sport: string): Promise<void> {
    const metrics7d = await this.calculateMetricsForWindow('7d', sport);
    const metrics30d = await this.calculateMetricsForWindow('30d', sport);
    
    // Determine trend
    const trend = this.analyzeTrend(metrics7d, metrics30d);
    
    // Check if adjustments are needed
    if (trend.confidence < this.LEARNING_CONFIG.confidenceThreshold) {
      return; // Not confident enough to make adjustments
    }

    // Apply adjustments based on performance
    const adjustments: LearningAdjustment[] = [];

    // EV adjustment
    if (metrics30d.metrics.evDeviation > this.ALERT_THRESHOLDS.evDeviation) {
      const adjustment = this.createEVAdjustment(sport, metrics30d);
      if (adjustment) {
        adjustments.push(adjustment);
      }
    }

    // CLV adjustment
    if (metrics30d.metrics.averageCLV < this.ALERT_THRESHOLDS.clvDecline) {
      const adjustment = this.createCLVAdjustment(sport, metrics30d);
      if (adjustment) {
        adjustments.push(adjustment);
      }
    }

    // Kelly sizing adjustment
    if (metrics30d.metrics.kellyEfficiency < this.ALERT_THRESHOLDS.kellyEfficiencyMin) {
      const adjustment = this.createKellyAdjustment(sport, metrics30d);
      if (adjustment) {
        adjustments.push(adjustment);
      }
    }

    // Apply adjustments
    for (const adjustment of adjustments) {
      await this.applyAdjustment(adjustment);
    }
  }

  /**
   * Analyze trend between two metric windows
   */
  private analyzeTrend(recent: MetricsWindow, historical: MetricsWindow): TrendAnalysis {
    const evTrend = this.getTrendDirection(
      recent.metrics.actualEV,
      historical.metrics.actualEV
    );
    
    const clvTrend = this.getTrendDirection(
      recent.metrics.averageCLV,
      historical.metrics.averageCLV
    );
    
    const roiTrend = this.getTrendDirection(
      recent.metrics.roi,
      historical.metrics.roi
    );

    // Calculate confidence based on sample size and consistency
    const sampleSizeConfidence = Math.min(1, recent.completedPicks / 50);
    const trendConsistency = (evTrend === clvTrend && clvTrend === roiTrend) ? 1 : 0.7;
    const confidence = sampleSizeConfidence * trendConsistency;

    // Calculate momentum
    const evMomentum = Math.abs(recent.metrics.actualEV - historical.metrics.actualEV);
    const clvMomentum = Math.abs(recent.metrics.averageCLV - historical.metrics.averageCLV);
    const roiMomentum = Math.abs(recent.metrics.roi - historical.metrics.roi);
    const momentum = (evMomentum + clvMomentum / 100 + roiMomentum / 100) / 3;

    // Calculate volatility
    const volatility = recent.metrics.maxDrawdown;

    return {
      evTrend,
      clvTrend,
      roiTrend,
      confidence,
      momentum,
      volatility
    };
  }

  /**
   * Create EV adjustment
   */
  private createEVAdjustment(sport: string, metrics: MetricsWindow): LearningAdjustment | null {
    const deviation = metrics.metrics.evDeviation;
    if (deviation < 0.1) return null; // Within acceptable range

    const adjustmentFactor = Math.min(
      this.LEARNING_CONFIG.adjustmentRate,
      deviation * 0.5
    );

    return {
      timestamp: new Date(),
      sport,
      adjustmentType: 'threshold',
      parameter: 'min_expected_value',
      oldValue: 0.05, // Would get from config
      newValue: 0.05 * (1 + adjustmentFactor),
      reason: `EV deviation of ${(deviation * 100).toFixed(1)}% detected`,
      expectedImpact: adjustmentFactor
    };
  }

  /**
   * Create CLV adjustment
   */
  private createCLVAdjustment(sport: string, metrics: MetricsWindow): LearningAdjustment | null {
    const avgCLV = metrics.metrics.averageCLV;
    if (avgCLV > 10) return null; // Acceptable CLV

    const adjustmentFactor = Math.min(
      this.LEARNING_CONFIG.adjustmentRate,
      Math.abs(avgCLV - 15) / 100
    );

    return {
      timestamp: new Date(),
      sport,
      adjustmentType: 'threshold',
      parameter: 'min_clv_threshold',
      oldValue: 15,
      newValue: Math.max(10, 15 - (5 * adjustmentFactor)),
      reason: `Low average CLV of ${avgCLV.toFixed(1)} BPS`,
      expectedImpact: adjustmentFactor
    };
  }

  /**
   * Create Kelly sizing adjustment
   */
  private createKellyAdjustment(sport: string, metrics: MetricsWindow): LearningAdjustment | null {
    const efficiency = metrics.metrics.kellyEfficiency;
    if (efficiency > 0.8) return null; // Good efficiency

    const adjustmentFactor = Math.min(
      this.LEARNING_CONFIG.adjustmentRate,
      (1 - efficiency) * 0.5
    );

    return {
      timestamp: new Date(),
      sport,
      adjustmentType: 'sizing',
      parameter: 'kelly_fraction_multiplier',
      oldValue: 1.0,
      newValue: 1.0 * (1 - adjustmentFactor),
      reason: `Kelly efficiency of ${(efficiency * 100).toFixed(1)}%`,
      expectedImpact: adjustmentFactor
    };
  }

  /**
   * Apply an adjustment
   */
  private async applyAdjustment(adjustment: LearningAdjustment): Promise<void> {
    try {
      // Store adjustment in database
      await supabaseClient
        .from('learning_adjustments')
        .insert({
          timestamp: adjustment.timestamp.toISOString(),
          sport: adjustment.sport,
          adjustment_type: adjustment.adjustmentType,
          parameter: adjustment.parameter,
          old_value: adjustment.oldValue,
          new_value: adjustment.newValue,
          reason: adjustment.reason,
          expected_impact: adjustment.expectedImpact
        });

      // Apply to configuration (would update actual config)
      this.logger.info('Applied learning adjustment', {
        sport: adjustment.sport,
        parameter: adjustment.parameter,
        change: `${adjustment.oldValue} → ${adjustment.newValue}`
      });

    } catch (error) {
      this.logger.error('Failed to apply adjustment', { error, adjustment });
    }
  }

  /**
   * Apply global adjustments based on overall performance
   */
  private async applyGlobalAdjustments(metrics: MetricsWindow): Promise<void> {
    const targets = this.LEARNING_CONFIG.performanceTarget;
    
    // Check if global adjustments are needed
    const needsAdjustment = 
      metrics.metrics.roi < targets.minROI ||
      metrics.metrics.hitPercentage < targets.minHitRate * 100 ||
      metrics.metrics.maxDrawdown > targets.maxDrawdown ||
      metrics.metrics.sharpeRatio < targets.minSharpe;

    if (!needsAdjustment) {
      return;
    }

    // Generate performance alert
    await this.generatePerformanceAlert({
      severity: 'warning',
      type: 'underperformance',
      metric: 'global_performance',
      window: '30d',
      message: 'Overall performance below target thresholds',
      recommendedAction: 'Review and adjust global parameters'
    });
  }

  /**
   * Check for performance alerts
   */
  private async checkPerformanceAlerts(): Promise<void> {
    const metrics7d = await this.calculateMetricsForWindow('7d');
    const metrics30d = await this.calculateMetricsForWindow('30d');

    // Check EV deviation
    if (metrics7d.metrics.evDeviation > this.ALERT_THRESHOLDS.evDeviation) {
      await this.generatePerformanceAlert({
        severity: 'warning',
        type: 'anomaly',
        metric: 'ev_deviation',
        window: '7d',
        message: `EV deviation of ${(metrics7d.metrics.evDeviation * 100).toFixed(1)}% detected`
      });
    }

    // Check drawdown
    if (metrics30d.metrics.maxDrawdown > this.ALERT_THRESHOLDS.drawdownLimit) {
      await this.generatePerformanceAlert({
        severity: 'critical',
        type: 'threshold_breach',
        metric: 'max_drawdown',
        window: '30d',
        message: `Maximum drawdown of ${(metrics30d.metrics.maxDrawdown * 100).toFixed(1)}% exceeds limit`
      });
    }

    // Check win rate
    if (metrics30d.metrics.winRate < this.ALERT_THRESHOLDS.winRateMinimum) {
      await this.generatePerformanceAlert({
        severity: 'warning',
        type: 'underperformance',
        metric: 'win_rate',
        window: '30d',
        message: `Win rate of ${metrics30d.metrics.winRate.toFixed(1)}% below minimum threshold`
      });
    }
  }

  /**
   * Generate performance alert
   */
  private async generatePerformanceAlert(alert: Omit<PerformanceAlert, 'id' | 'timestamp'>): Promise<void> {
    const fullAlert: PerformanceAlert = {
      id: `alert_${Date.now()}`,
      timestamp: new Date(),
      ...alert
    };

    try {
      await supabaseClient
        .from('performance_alerts')
        .insert({
          id: fullAlert.id,
          timestamp: fullAlert.timestamp.toISOString(),
          severity: fullAlert.severity,
          type: fullAlert.type,
          metric: fullAlert.metric,
          window: fullAlert.window,
          sport: fullAlert.sport,
          message: fullAlert.message,
          recommended_action: fullAlert.recommendedAction,
          auto_adjustment_applied: fullAlert.autoAdjustmentApplied || false
        });

      this.logger.info('Performance alert generated', {
        severity: fullAlert.severity,
        type: fullAlert.type,
        metric: fullAlert.metric
      });
    } catch (error) {
      this.logger.error('Failed to generate performance alert', { error, alert });
    }
  }

  /**
   * Helper methods
   */
  private getWindowStartDate(window: '7d' | '30d' | 'lifetime', now: Date): Date {
    switch (window) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'lifetime':
        return new Date('2024-01-01'); // Or earliest date in system
    }
  }

  private async getPicksForWindow(startDate: Date, endDate: Date, sport?: string): Promise<any[]> {
    try {
      let query = supabaseClient
        .from('unified_picks')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (sport) {
        query = query.eq('sport', sport);
      }

      const { data } = await query;
      return data || [];
    } catch (error) {
      this.logger.error('Failed to get picks for window', { error });
      return [];
    }
  }

  private async getActiveSports(): Promise<string[]> {
    try {
      const { data } = await supabaseClient
        .from('unified_picks')
        .select('sport')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      return [...new Set(data?.map(p => p.sport) || [])];
    } catch (error) {
      this.logger.error('Failed to get active sports', { error });
      return [];
    }
  }

  private async loadHistoricalMetrics(): Promise<void> {
    // Load cached metrics from database
    try {
      const { data } = await supabaseClient
        .from('metrics_cache')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (data) {
        // Process and cache historical metrics
        this.logger.info('Loaded historical metrics', { count: data.length });
      }
    } catch (error) {
      this.logger.error('Failed to load historical metrics', { error });
    }
  }

  private async updateAllMetrics(): Promise<void> {
    const windows: Array<'7d' | '30d' | 'lifetime'> = ['7d', '30d', 'lifetime'];
    
    for (const window of windows) {
      const metrics = await this.calculateMetricsForWindow(window);
      
      // Cache metrics
      this.metricsCache.set(window, [
        metrics,
        ...(this.metricsCache.get(window) || []).slice(0, 23) // Keep 24 hours of history
      ]);

      // Store in database
      await this.storeMetrics(metrics);
    }
  }

  private async storeMetrics(metrics: MetricsWindow): Promise<void> {
    try {
      // Store in normal metrics table
      await supabaseClient
        .from('metrics_snapshots')
        .insert({
          window: metrics.window,
          start_date: metrics.startDate.toISOString(),
          end_date: metrics.endDate.toISOString(),
          total_picks: metrics.totalPicks,
          completed_picks: metrics.completedPicks,
          metrics: metrics.metrics,
          created_at: new Date().toISOString()
        });

      // If in shadow mode, also store in shadow metrics table
      if (isShadowMode()) {
        await shadowWriteMetrics({
          window: metrics.window,
          postedEv: metrics.metrics.postedEV,
          positiveCLVRate: metrics.metrics.positiveCLVPercentage,
          avgCLV: metrics.metrics.averageCLV,
          hitRate: metrics.metrics.hitPercentage,
          roi: metrics.metrics.roi,
          sharpe: metrics.metrics.sharpeRatio,
          kellyEfficiency: metrics.metrics.kellyEfficiency,
          maxDrawdown: metrics.metrics.maxDrawdown,
          picksCount: metrics.totalPicks,
          completedPicks: metrics.completedPicks,
          winRate: metrics.metrics.winRate,
          avgOdds: -110, // Would calculate from actual data
          profitFactor: metrics.metrics.profitFactor
        });
      }
    } catch (error) {
      this.logger.error('Failed to store metrics', { error });
    }
  }

  private getTrendDirection(recent: number, historical: number): 'improving' | 'declining' | 'stable' {
    const change = recent - historical;
    const changePercent = historical !== 0 ? Math.abs(change / historical) : 0;
    
    if (changePercent < 0.05) return 'stable';
    return change > 0 ? 'improving' : 'declining';
  }

  private getEmptyMetrics(): WindowMetrics {
    return {
      postedEV: 0,
      actualEV: 0,
      evDeviation: 0,
      positiveCLVPercentage: 0,
      averageCLV: 0,
      clvCapture: 0,
      hitPercentage: 0,
      hitByTier: {},
      hitBySport: {},
      roi: 0,
      roiByTier: {},
      roiBySport: {},
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      kellyAtRisk: 0,
      kellyEfficiency: 0,
      kellyRegret: 0
    };
  }

  /**
   * Public API methods
   */
  public async getMetrics(window: '7d' | '30d' | 'lifetime'): Promise<MetricsWindow> {
    return await this.calculateMetricsForWindow(window);
  }

  public async getSportMetrics(sport: string): Promise<SportMetrics> {
    const windows: MetricsWindow[] = [];
    
    for (const window of ['7d', '30d', 'lifetime'] as const) {
      const metrics = await this.calculateMetricsForWindow(window, sport);
      windows.push(metrics);
    }

    const trend = this.analyzeTrend(windows[0], windows[1]);
    
    // Get recent adjustments for this sport
    const { data: adjustments } = await supabaseClient
      .from('learning_adjustments')
      .select('*')
      .eq('sport', sport)
      .order('timestamp', { ascending: false })
      .limit(10);

    return {
      sport,
      windows,
      trends: trend,
      adjustments: adjustments || []
    };
  }

  public async getPerformanceSummary(): Promise<{
    current: MetricsWindow;
    trends: TrendAnalysis;
    alerts: PerformanceAlert[];
    recommendations: string[];
  }> {
    const current = await this.calculateMetricsForWindow('30d');
    const historical = await this.calculateMetricsForWindow('lifetime');
    const trends = this.analyzeTrend(current, historical);
    
    // Get recent alerts
    const { data: alerts } = await supabaseClient
      .from('performance_alerts')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10);

    // Generate recommendations
    const recommendations = this.generateRecommendations(current, trends);

    return {
      current,
      trends,
      alerts: alerts || [],
      recommendations
    };
  }

  private generateRecommendations(metrics: MetricsWindow, trends: TrendAnalysis): string[] {
    const recommendations: string[] = [];
    const targets = this.LEARNING_CONFIG.performanceTarget;

    if (metrics.metrics.roi < targets.minROI) {
      recommendations.push(`Increase minimum EV threshold to improve ROI (current: ${metrics.metrics.roi.toFixed(2)}%)`);
    }

    if (metrics.metrics.hitPercentage < targets.minHitRate * 100) {
      recommendations.push(`Review pick selection criteria to improve hit rate (current: ${metrics.metrics.hitPercentage.toFixed(1)}%)`);
    }

    if (metrics.metrics.maxDrawdown > targets.maxDrawdown) {
      recommendations.push(`Reduce position sizes to limit drawdown risk (current: ${(metrics.metrics.maxDrawdown * 100).toFixed(1)}%)`);
    }

    if (metrics.metrics.kellyEfficiency < 0.8) {
      recommendations.push(`Optimize position sizing closer to Kelly criterion (efficiency: ${(metrics.metrics.kellyEfficiency * 100).toFixed(1)}%)`);
    }

    if (trends.volatility > 0.2) {
      recommendations.push('Consider more conservative tier thresholds to reduce volatility');
    }

    return recommendations;
  }
}

export const rollingMetricsService = RollingMetricsService.getInstance();