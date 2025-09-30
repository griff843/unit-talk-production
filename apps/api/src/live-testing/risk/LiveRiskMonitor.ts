/**
 * Phase 9: Live Risk Monitor
 *
 * Real-time risk monitoring with Kelly sizing validation, portfolio risk management,
 * and emergency controls for live testing validation.
 */

import { EventEmitter } from 'events';
import { Logger } from '../../shared/logger';
import {
  LiveRiskMonitor as ILiveRiskMonitor,
  RealTimeRisk,
  PortfolioRisk,
  KellyMonitor,
  EmergencyTrigger,
  RiskAlert,
  KellyPosition,
  KellyViolation,
  LiveBet,
  LiveTestingConfig
} from '../types';
import { ProfessionalFeaturesResult } from '../../professional/types';

export class LiveRiskMonitor extends EventEmitter implements ILiveRiskMonitor {
  private logger = new Logger('LiveRiskMonitor');

  public realTimeRisk: RealTimeRisk;
  public portfolioRisk: PortfolioRisk;
  public kellyMonitoring: KellyMonitor;
  public emergencyTriggers: EmergencyTrigger[];

  private config: LiveTestingConfig;
  private activeBets: Map<string, LiveBet> = new Map();
  private dailyStats: Map<string, DailyRiskStats> = new Map();
  private monitoringInterval: NodeJS.Timeout;
  private riskAlerts: RiskAlert[] = [];

  constructor(config: LiveTestingConfig) {
    super();
    this.config = config;
    this.initializeRiskMetrics();
    this.startRiskMonitoring();
  }

  // ========================================
  // Initialization
  // ========================================

  private initializeRiskMetrics(): void {
    this.realTimeRisk = {
      currentExposure: 0,
      maxExposure: this.config.globalLimits.maxTestingBankroll,
      utilizationRate: 0,
      dailyStaked: 0,
      dailyLimit: this.config.globalLimits.maxDailyRisk,
      dailyBetsPlaced: 0,
      dailyBetLimit: 50, // Maximum 50 bets per day
      sameGameExposure: {},
      samePlayerExposure: {},
      sameSportExposure: {},
      portfolioCorrelation: 0,
      riskLevel: 'LOW',
      activeAlerts: []
    };

    this.portfolioRisk = {
      totalValue: this.config.globalLimits.maxTestingBankroll,
      var95: 0,
      expectedShortfall: 0,
      maxDrawdown: 0,
      currentDrawdown: 0,
      avgKellyFraction: 0,
      maxKellyFraction: this.config.globalLimits.maxKellyFraction,
      kellyViolations: 0,
      sportDiversification: 0,
      marketDiversification: 0,
      temporalDiversification: 0
    };

    this.kellyMonitoring = {
      currentPositions: [],
      avgKellyFraction: 0,
      maxKellyFraction: this.config.globalLimits.maxKellyFraction,
      kellyViolations: [],
      optimalSizing: true
    };

    this.emergencyTriggers = [
      {
        type: 'STOP_LOSS',
        threshold: 0.1, // 10% drawdown
        currentValue: 0,
        triggered: false,
        action: 'EMERGENCY_STOP'
      },
      {
        type: 'MAX_DRAWDOWN',
        threshold: 0.15, // 15% max drawdown
        currentValue: 0,
        triggered: false,
        action: 'PAUSE_BETTING'
      },
      {
        type: 'SYSTEM_ERROR',
        threshold: 5, // 5 consecutive errors
        currentValue: 0,
        triggered: false,
        action: 'PAUSE_BETTING'
      }
    ];
  }

  private startRiskMonitoring(): void {
    // Update risk metrics every 10 seconds
    this.monitoringInterval = setInterval(() => {
      this.updateRiskMetrics();
      this.checkRiskLimits();
      this.updateEmergencyTriggers();
      this.emit('riskMetricsUpdated', {
        realTimeRisk: this.realTimeRisk,
        portfolioRisk: this.portfolioRisk,
        kellyMonitoring: this.kellyMonitoring
      });
    }, 10000);
  }

  // ========================================
  // Bet Tracking and Risk Assessment
  // ========================================

  public assessBetRisk(
    bet: LiveBet,
    professionalFeatures: ProfessionalFeaturesResult
  ): {
    approved: boolean;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reasons: string[];
    kellyCompliant: boolean;
    recommendedStake?: number;
  } {
    const reasons: string[] = [];
    let approved = true;
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

    // Check basic limits
    if (bet.stake > this.config.globalLimits.maxSingleBet) {
      approved = false;
      reasons.push(`Bet size $${bet.stake} exceeds limit $${this.config.globalLimits.maxSingleBet}`);
      riskLevel = 'CRITICAL';
    }

    // Check daily limits
    const today = new Date().toISOString().split('T')[0];
    const dailyStats = this.getDailyStats(today);

    if (dailyStats.totalStaked + bet.stake > this.config.globalLimits.maxDailyRisk) {
      approved = false;
      reasons.push(`Daily risk limit would be exceeded`);
      riskLevel = 'CRITICAL';
    }

    if (dailyStats.betCount >= 50) { // Daily bet limit
      approved = false;
      reasons.push(`Daily bet limit exceeded`);
      riskLevel = 'HIGH';
    }

    // Check Kelly criterion compliance
    const kellyCompliant = this.validateKellySizing(bet, professionalFeatures);
    if (!kellyCompliant.valid) {
      if (kellyCompliant.severity === 'HIGH') {
        approved = false;
        riskLevel = 'HIGH';
      } else {
        riskLevel = 'MEDIUM';
      }
      reasons.push(kellyCompliant.reason);
    }

    // Check correlation limits
    const correlationRisk = this.assessCorrelationRisk(bet);
    if (correlationRisk.excessive) {
      approved = false;
      reasons.push(correlationRisk.reason);
      riskLevel = 'HIGH';
    }

    // Check portfolio concentration
    const concentrationRisk = this.assessConcentrationRisk(bet);
    if (concentrationRisk.excessive) {
      if (concentrationRisk.severity === 'HIGH') {
        approved = false;
      }
      reasons.push(concentrationRisk.reason);
      riskLevel = Math.max(riskLevel, concentrationRisk.severity) as any;
    }

    // Determine overall risk level
    if (reasons.length === 0) {
      riskLevel = this.calculateOverallRiskLevel(bet, professionalFeatures);
    }

    return {
      approved,
      riskLevel,
      reasons,
      kellyCompliant: kellyCompliant.valid,
      recommendedStake: kellyCompliant.recommendedStake
    };
  }

  public trackBet(bet: LiveBet): void {
    this.activeBets.set(bet.id, bet);

    // Create Kelly position
    const kellyPosition: KellyPosition = {
      betId: bet.id,
      edge: bet.professionalFeatures.riskAdjustedEdge,
      kellyFraction: bet.kellyFraction,
      actualFraction: bet.stake / this.portfolioRisk.totalValue,
      optimalStake: bet.kellyFraction * this.portfolioRisk.totalValue,
      actualStake: bet.stake,
      deviationReason: bet.kellyFraction * this.portfolioRisk.totalValue !== bet.stake
        ? 'Risk management adjustment'
        : undefined
    };

    this.kellyMonitoring.currentPositions.push(kellyPosition);

    // Update daily stats
    const today = new Date().toISOString().split('T')[0];
    const dailyStats = this.getDailyStats(today);
    dailyStats.totalStaked += bet.stake;
    dailyStats.betCount += 1;
    dailyStats.exposureByGame[this.getGameKey(bet)] = (dailyStats.exposureByGame[this.getGameKey(bet)] || 0) + bet.stake;
    dailyStats.exposureBySport[bet.sport] = (dailyStats.exposureBySport[bet.sport] || 0) + bet.stake;

    this.logger.info('Bet tracked for risk monitoring', {
      betId: bet.id,
      stake: bet.stake,
      kellyFraction: bet.kellyFraction,
      sport: bet.sport,
      dailyExposure: dailyStats.totalStaked
    });

    this.emit('betTracked', bet);
  }

  public updateBetStatus(betId: string, status: string, pnl?: number): void {
    const bet = this.activeBets.get(betId);
    if (!bet) return;

    bet.status = status as any;
    if (pnl !== undefined) {
      bet.pnl = pnl;
      bet.roi = pnl / bet.stake;
    }

    // Update portfolio value if settled
    if (status === 'SETTLED' && pnl !== undefined) {
      this.portfolioRisk.totalValue += pnl;
    }

    this.emit('betStatusUpdated', bet);
  }

  // ========================================
  // Kelly Criterion Validation
  // ========================================

  private validateKellySizing(
    bet: LiveBet,
    professionalFeatures: ProfessionalFeaturesResult
  ): {
    valid: boolean;
    reason: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    recommendedStake: number;
  } {
    const edge = professionalFeatures.riskAdjustedEdge;
    const kellyCriterion = professionalFeatures.kellyFraction;
    const optimalStake = kellyCriterion * this.portfolioRisk.totalValue;
    const actualFraction = bet.stake / this.portfolioRisk.totalValue;

    // Check if Kelly fraction exceeds limits
    if (kellyCriterion > this.config.globalLimits.maxKellyFraction) {
      const violation: KellyViolation = {
        betId: bet.id,
        timestamp: new Date().toISOString(),
        recommendedFraction: kellyCriterion,
        actualFraction,
        reason: `Kelly fraction ${kellyCriterion.toFixed(3)} exceeds limit ${this.config.globalLimits.maxKellyFraction}`,
        severity: 'HIGH'
      };

      this.kellyMonitoring.kellyViolations.push(violation);
      this.kellyMonitoring.optimalSizing = false;

      return {
        valid: false,
        reason: violation.reason,
        severity: 'HIGH',
        recommendedStake: this.config.globalLimits.maxKellyFraction * this.portfolioRisk.totalValue
      };
    }

    // Check for significant deviations from optimal Kelly sizing
    const deviationPercent = Math.abs(actualFraction - kellyCriterion) / kellyCriterion;

    if (deviationPercent > 0.5) { // More than 50% deviation
      const violation: KellyViolation = {
        betId: bet.id,
        timestamp: new Date().toISOString(),
        recommendedFraction: kellyCriterion,
        actualFraction,
        reason: `Bet size deviates ${(deviationPercent * 100).toFixed(1)}% from optimal Kelly sizing`,
        severity: deviationPercent > 1.0 ? 'HIGH' : 'MEDIUM'
      };

      this.kellyMonitoring.kellyViolations.push(violation);

      return {
        valid: deviationPercent <= 1.0,
        reason: violation.reason,
        severity: violation.severity,
        recommendedStake: optimalStake
      };
    }

    return {
      valid: true,
      reason: 'Kelly sizing within acceptable range',
      severity: 'LOW',
      recommendedStake: optimalStake
    };
  }

  // ========================================
  // Correlation and Concentration Risk
  // ========================================

  private assessCorrelationRisk(bet: LiveBet): {
    excessive: boolean;
    reason: string;
    correlationScore: number;
  } {
    const gameKey = this.getGameKey(bet);
    const playerKey = this.getPlayerKey(bet);

    // Check same-game exposure
    let sameGameExposure = 0;
    let samePlayerExposure = 0;
    let sameSportExposure = 0;

    for (const existingBet of this.activeBets.values()) {
      if (existingBet.status === 'CONFIRMED' || existingBet.status === 'PENDING') {
        if (this.getGameKey(existingBet) === gameKey) {
          sameGameExposure += existingBet.stake;
        }
        if (playerKey && this.getPlayerKey(existingBet) === playerKey) {
          samePlayerExposure += existingBet.stake;
        }
        if (existingBet.sport === bet.sport) {
          sameSportExposure += existingBet.stake;
        }
      }
    }

    // Check correlation limits
    const maxSameGame = this.config.globalLimits.maxDailyRisk * 0.3; // Max 30% of daily limit per game
    const maxSamePlayer = this.config.globalLimits.maxDailyRisk * 0.2; // Max 20% per player
    const maxSameSport = this.config.globalLimits.maxDailyRisk * 0.6; // Max 60% per sport

    if (sameGameExposure + bet.stake > maxSameGame) {
      return {
        excessive: true,
        reason: `Same-game exposure would exceed limit: $${sameGameExposure + bet.stake} > $${maxSameGame}`,
        correlationScore: (sameGameExposure + bet.stake) / maxSameGame
      };
    }

    if (playerKey && samePlayerExposure + bet.stake > maxSamePlayer) {
      return {
        excessive: true,
        reason: `Same-player exposure would exceed limit: $${samePlayerExposure + bet.stake} > $${maxSamePlayer}`,
        correlationScore: (samePlayerExposure + bet.stake) / maxSamePlayer
      };
    }

    if (sameSportExposure + bet.stake > maxSameSport) {
      return {
        excessive: true,
        reason: `Same-sport exposure would exceed limit: $${sameSportExposure + bet.stake} > $${maxSameSport}`,
        correlationScore: (sameSportExposure + bet.stake) / maxSameSport
      };
    }

    // Calculate overall correlation score
    const correlationScore = Math.max(
      sameGameExposure / maxSameGame,
      (playerKey ? samePlayerExposure / maxSamePlayer : 0),
      sameSportExposure / maxSameSport
    );

    return {
      excessive: false,
      reason: 'Correlation risk within acceptable limits',
      correlationScore
    };
  }

  private assessConcentrationRisk(bet: LiveBet): {
    excessive: boolean;
    reason: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  } {
    const portfolioPercentage = bet.stake / this.portfolioRisk.totalValue;

    // Single bet concentration limits
    if (portfolioPercentage > 0.05) { // > 5% of portfolio
      return {
        excessive: true,
        reason: `Single bet represents ${(portfolioPercentage * 100).toFixed(1)}% of portfolio`,
        severity: 'HIGH'
      };
    }

    if (portfolioPercentage > 0.025) { // > 2.5% of portfolio
      return {
        excessive: false,
        reason: `Single bet represents ${(portfolioPercentage * 100).toFixed(1)}% of portfolio (medium concentration)`,
        severity: 'MEDIUM'
      };
    }

    return {
      excessive: false,
      reason: 'Concentration risk acceptable',
      severity: 'LOW'
    };
  }

  // ========================================
  // Risk Level Calculation
  // ========================================

  private calculateOverallRiskLevel(
    bet: LiveBet,
    professionalFeatures: ProfessionalFeaturesResult
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    let riskScore = 0;

    // Kelly fraction risk (0-3 points)
    if (bet.kellyFraction > 0.2) riskScore += 3;
    else if (bet.kellyFraction > 0.1) riskScore += 2;
    else if (bet.kellyFraction > 0.05) riskScore += 1;

    // Professional score risk (0-2 points)
    if (professionalFeatures.overallProfessionalScore < 65) riskScore += 2;
    else if (professionalFeatures.overallProfessionalScore < 75) riskScore += 1;

    // Portfolio concentration risk (0-2 points)
    const concentration = bet.stake / this.portfolioRisk.totalValue;
    if (concentration > 0.03) riskScore += 2;
    else if (concentration > 0.02) riskScore += 1;

    // Correlation risk (0-2 points)
    const correlationRisk = this.assessCorrelationRisk(bet);
    if (correlationRisk.correlationScore > 0.8) riskScore += 2;
    else if (correlationRisk.correlationScore > 0.6) riskScore += 1;

    // Market risk (0-1 point)
    if (bet.sport === 'TENNIS' || bet.market.includes('Live')) riskScore += 1;

    // Determine risk level
    if (riskScore >= 7) return 'CRITICAL';
    if (riskScore >= 5) return 'HIGH';
    if (riskScore >= 3) return 'MEDIUM';
    return 'LOW';
  }

  // ========================================
  // Risk Monitoring and Updates
  // ========================================

  private updateRiskMetrics(): void {
    this.updateRealTimeRisk();
    this.updatePortfolioRisk();
    this.updateKellyMonitoring();
  }

  private updateRealTimeRisk(): void {
    const activeBets = Array.from(this.activeBets.values())
      .filter(bet => bet.status === 'CONFIRMED' || bet.status === 'PENDING');

    // Calculate current exposure
    this.realTimeRisk.currentExposure = activeBets.reduce((sum, bet) => sum + bet.stake, 0);
    this.realTimeRisk.utilizationRate = this.realTimeRisk.currentExposure / this.realTimeRisk.maxExposure;

    // Update daily stats
    const today = new Date().toISOString().split('T')[0];
    const dailyStats = this.getDailyStats(today);
    this.realTimeRisk.dailyStaked = dailyStats.totalStaked;
    this.realTimeRisk.dailyBetsPlaced = dailyStats.betCount;

    // Update exposure tracking
    this.realTimeRisk.sameGameExposure = {};
    this.realTimeRisk.samePlayerExposure = {};
    this.realTimeRisk.sameSportExposure = {};

    for (const bet of activeBets) {
      const gameKey = this.getGameKey(bet);
      const playerKey = this.getPlayerKey(bet);

      this.realTimeRisk.sameGameExposure[gameKey] =
        (this.realTimeRisk.sameGameExposure[gameKey] || 0) + bet.stake;

      if (playerKey) {
        this.realTimeRisk.samePlayerExposure[playerKey] =
          (this.realTimeRisk.samePlayerExposure[playerKey] || 0) + bet.stake;
      }

      this.realTimeRisk.sameSportExposure[bet.sport] =
        (this.realTimeRisk.sameSportExposure[bet.sport] || 0) + bet.stake;
    }

    // Calculate portfolio correlation
    this.realTimeRisk.portfolioCorrelation = this.calculatePortfolioCorrelation(activeBets);

    // Determine risk level
    this.realTimeRisk.riskLevel = this.determineOverallRiskLevel();
  }

  private updatePortfolioRisk(): void {
    const settledBets = Array.from(this.activeBets.values())
      .filter(bet => bet.status === 'SETTLED');

    if (settledBets.length > 0) {
      // Calculate VaR and Expected Shortfall
      const returns = settledBets.map(bet => bet.roi || 0);
      returns.sort((a, b) => a - b);

      const var95Index = Math.floor(returns.length * 0.05);
      this.portfolioRisk.var95 = returns[var95Index] || 0;

      const tailReturns = returns.slice(0, var95Index);
      this.portfolioRisk.expectedShortfall = tailReturns.length > 0
        ? tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length
        : 0;

      // Calculate drawdown
      const { maxDrawdown, currentDrawdown } = this.calculateDrawdown(settledBets);
      this.portfolioRisk.maxDrawdown = maxDrawdown;
      this.portfolioRisk.currentDrawdown = currentDrawdown;
    }

    // Update Kelly metrics
    this.portfolioRisk.avgKellyFraction = this.kellyMonitoring.avgKellyFraction;
    this.portfolioRisk.kellyViolations = this.kellyMonitoring.kellyViolations.length;

    // Calculate diversification metrics
    this.portfolioRisk.sportDiversification = this.calculateSportDiversification();
    this.portfolioRisk.marketDiversification = this.calculateMarketDiversification();
    this.portfolioRisk.temporalDiversification = this.calculateTemporalDiversification();
  }

  private updateKellyMonitoring(): void {
    if (this.kellyMonitoring.currentPositions.length > 0) {
      this.kellyMonitoring.avgKellyFraction =
        this.kellyMonitoring.currentPositions.reduce((sum, pos) => sum + pos.kellyFraction, 0) /
        this.kellyMonitoring.currentPositions.length;

      this.kellyMonitoring.maxKellyFraction = Math.max(
        ...this.kellyMonitoring.currentPositions.map(pos => pos.kellyFraction)
      );

      // Check if all positions are optimally sized
      this.kellyMonitoring.optimalSizing = this.kellyMonitoring.currentPositions.every(pos =>
        Math.abs(pos.actualFraction - pos.kellyFraction) / pos.kellyFraction < 0.1
      );
    }
  }

  // ========================================
  // Risk Limit Checking
  // ========================================

  private checkRiskLimits(): void {
    const newAlerts: RiskAlert[] = [];

    // Check exposure limits
    if (this.realTimeRisk.utilizationRate > 0.9) {
      newAlerts.push({
        id: `exposure_${Date.now()}`,
        type: 'EXPOSURE_LIMIT',
        severity: 'HIGH',
        message: `Portfolio utilization at ${(this.realTimeRisk.utilizationRate * 100).toFixed(1)}%`,
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    }

    // Check correlation risk
    const maxCorrelation = Math.max(...Object.values(this.realTimeRisk.sameGameExposure));
    if (maxCorrelation > this.config.globalLimits.maxDailyRisk * 0.25) {
      newAlerts.push({
        id: `correlation_${Date.now()}`,
        type: 'CORRELATION_RISK',
        severity: 'MEDIUM',
        message: `High same-game exposure: $${maxCorrelation}`,
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    }

    // Check drawdown
    if (this.portfolioRisk.currentDrawdown > 0.08) {
      newAlerts.push({
        id: `drawdown_${Date.now()}`,
        type: 'DRAWDOWN',
        severity: this.portfolioRisk.currentDrawdown > 0.1 ? 'CRITICAL' : 'HIGH',
        message: `Current drawdown: ${(this.portfolioRisk.currentDrawdown * 100).toFixed(1)}%`,
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    }

    // Check Kelly violations
    const recentViolations = this.kellyMonitoring.kellyViolations
      .filter(v => Date.now() - new Date(v.timestamp).getTime() < 3600000); // Last hour

    if (recentViolations.length > 3) {
      newAlerts.push({
        id: `kelly_${Date.now()}`,
        type: 'KELLY_VIOLATION',
        severity: 'MEDIUM',
        message: `${recentViolations.length} Kelly violations in last hour`,
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    }

    // Add new alerts
    for (const alert of newAlerts) {
      this.riskAlerts.push(alert);
      this.realTimeRisk.activeAlerts.push(alert);
      this.emit('riskAlert', alert);
    }
  }

  private updateEmergencyTriggers(): void {
    // Update stop loss trigger
    const stopLossTrigger = this.emergencyTriggers.find(t => t.type === 'STOP_LOSS');
    if (stopLossTrigger) {
      stopLossTrigger.currentValue = this.portfolioRisk.currentDrawdown;
      if (!stopLossTrigger.triggered && stopLossTrigger.currentValue >= stopLossTrigger.threshold) {
        this.triggerEmergencyStop(stopLossTrigger);
      }
    }

    // Update max drawdown trigger
    const drawdownTrigger = this.emergencyTriggers.find(t => t.type === 'MAX_DRAWDOWN');
    if (drawdownTrigger) {
      drawdownTrigger.currentValue = this.portfolioRisk.maxDrawdown;
      if (!drawdownTrigger.triggered && drawdownTrigger.currentValue >= drawdownTrigger.threshold) {
        this.triggerEmergencyStop(drawdownTrigger);
      }
    }
  }

  private triggerEmergencyStop(trigger: EmergencyTrigger): void {
    trigger.triggered = true;

    this.logger.error('Emergency trigger activated', {
      triggerType: trigger.type,
      threshold: trigger.threshold,
      currentValue: trigger.currentValue,
      action: trigger.action
    });

    this.emit('emergencyTrigger', trigger);

    // Create critical alert
    const alert: RiskAlert = {
      id: `emergency_${Date.now()}`,
      type: trigger.type,
      severity: 'CRITICAL',
      message: `Emergency ${trigger.type} triggered: ${trigger.currentValue} >= ${trigger.threshold}`,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };

    this.riskAlerts.push(alert);
    this.realTimeRisk.activeAlerts.push(alert);
  }

  // ========================================
  // Helper Methods
  // ========================================

  private getDailyStats(date: string): DailyRiskStats {
    if (!this.dailyStats.has(date)) {
      this.dailyStats.set(date, {
        date,
        totalStaked: 0,
        betCount: 0,
        exposureByGame: {},
        exposureBySport: {},
        riskEvents: []
      });
    }
    return this.dailyStats.get(date)!;
  }

  private getGameKey(bet: LiveBet): string {
    // Extract game identifier from market
    return `${bet.sport}_${bet.market.split(' ')[0]}`;
  }

  private getPlayerKey(bet: LiveBet): string | null {
    // Extract player name if this is a player prop
    if (bet.market.includes(' - ')) {
      return bet.market.split(' - ')[0];
    }
    return null;
  }

  private calculatePortfolioCorrelation(bets: LiveBet[]): number {
    // Simplified correlation calculation
    const sportsCount = new Set(bets.map(bet => bet.sport)).size;
    const totalBets = bets.length;

    if (totalBets <= 1) return 0;

    // Calculate concentration-based correlation
    const sportCounts = bets.reduce((acc, bet) => {
      acc[bet.sport] = (acc[bet.sport] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const maxConcentration = Math.max(...Object.values(sportCounts)) / totalBets;
    return maxConcentration;
  }

  private determineOverallRiskLevel(): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    let riskScore = 0;

    // Utilization risk
    if (this.realTimeRisk.utilizationRate > 0.8) riskScore += 3;
    else if (this.realTimeRisk.utilizationRate > 0.6) riskScore += 2;
    else if (this.realTimeRisk.utilizationRate > 0.4) riskScore += 1;

    // Correlation risk
    if (this.realTimeRisk.portfolioCorrelation > 0.7) riskScore += 2;
    else if (this.realTimeRisk.portfolioCorrelation > 0.5) riskScore += 1;

    // Drawdown risk
    if (this.portfolioRisk.currentDrawdown > 0.08) riskScore += 2;
    else if (this.portfolioRisk.currentDrawdown > 0.05) riskScore += 1;

    // Alert count
    const criticalAlerts = this.realTimeRisk.activeAlerts.filter(a => a.severity === 'CRITICAL').length;
    const highAlerts = this.realTimeRisk.activeAlerts.filter(a => a.severity === 'HIGH').length;

    if (criticalAlerts > 0) riskScore += 3;
    else if (highAlerts > 1) riskScore += 2;
    else if (highAlerts > 0) riskScore += 1;

    if (riskScore >= 6) return 'CRITICAL';
    if (riskScore >= 4) return 'HIGH';
    if (riskScore >= 2) return 'MEDIUM';
    return 'LOW';
  }

  private calculateDrawdown(settledBets: LiveBet[]): { maxDrawdown: number; currentDrawdown: number } {
    let peak = 0;
    let maxDrawdown = 0;
    let currentValue = 0;

    for (const bet of settledBets) {
      currentValue += bet.pnl || 0;
      peak = Math.max(peak, currentValue);
      const drawdown = peak > 0 ? (peak - currentValue) / peak : 0;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    const currentDrawdown = peak > 0 ? (peak - currentValue) / peak : 0;
    return { maxDrawdown, currentDrawdown };
  }

  private calculateSportDiversification(): number {
    const activeBets = Array.from(this.activeBets.values())
      .filter(bet => bet.status === 'CONFIRMED' || bet.status === 'PENDING');

    if (activeBets.length === 0) return 1;

    const sportCounts = activeBets.reduce((acc, bet) => {
      acc[bet.sport] = (acc[bet.sport] || 0) + bet.stake;
      return acc;
    }, {} as Record<string, number>);

    const totalStaked = Object.values(sportCounts).reduce((sum, stake) => sum + stake, 0);
    const sportWeights = Object.values(sportCounts).map(stake => stake / totalStaked);

    // Calculate Herfindahl-Hirschman Index (lower = more diversified)
    const hhi = sportWeights.reduce((sum, weight) => sum + weight * weight, 0);
    return 1 - hhi; // Convert to diversification score (higher = more diversified)
  }

  private calculateMarketDiversification(): number {
    const activeBets = Array.from(this.activeBets.values())
      .filter(bet => bet.status === 'CONFIRMED' || bet.status === 'PENDING');

    if (activeBets.length === 0) return 1;

    const marketTypes = new Set(activeBets.map(bet => bet.market.split(' ')[1] || 'other'));
    return Math.min(marketTypes.size / 5, 1); // Normalize to max of 5 different market types
  }

  private calculateTemporalDiversification(): number {
    const activeBets = Array.from(this.activeBets.values())
      .filter(bet => bet.status === 'CONFIRMED' || bet.status === 'PENDING');

    if (activeBets.length === 0) return 1;

    const hourCounts = activeBets.reduce((acc, bet) => {
      const hour = new Date(bet.placedAt).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const uniqueHours = Object.keys(hourCounts).length;
    return Math.min(uniqueHours / 12, 1); // Normalize to max spread across 12 hours
  }

  // ========================================
  // Public Methods
  // ========================================

  public getRiskSummary(): {
    overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    keyMetrics: {
      utilizationRate: number;
      currentDrawdown: number;
      kellyCompliance: number;
      activeAlerts: number;
    };
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    if (this.realTimeRisk.utilizationRate > 0.7) {
      recommendations.push('Consider reducing position sizes to lower portfolio utilization');
    }

    if (this.portfolioRisk.currentDrawdown > 0.05) {
      recommendations.push('Monitor drawdown closely, consider reducing risk');
    }

    if (!this.kellyMonitoring.optimalSizing) {
      recommendations.push('Review bet sizing to improve Kelly criterion compliance');
    }

    if (this.realTimeRisk.portfolioCorrelation > 0.6) {
      recommendations.push('Increase sport/market diversification to reduce correlation risk');
    }

    return {
      overallRiskLevel: this.realTimeRisk.riskLevel,
      keyMetrics: {
        utilizationRate: this.realTimeRisk.utilizationRate,
        currentDrawdown: this.portfolioRisk.currentDrawdown,
        kellyCompliance: this.kellyMonitoring.optimalSizing ? 1 : 0,
        activeAlerts: this.realTimeRisk.activeAlerts.length
      },
      recommendations
    };
  }

  public acknowledgeAlert(alertId: string): void {
    const alert = this.riskAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alertAcknowledged', alert);
    }
  }

  public getEmergencyStatus(): {
    anyTriggered: boolean;
    triggers: EmergencyTrigger[];
    lastTrigger?: EmergencyTrigger;
  } {
    const triggered = this.emergencyTriggers.filter(t => t.triggered);
    return {
      anyTriggered: triggered.length > 0,
      triggers: this.emergencyTriggers,
      lastTrigger: triggered[triggered.length - 1]
    };
  }

  // ========================================
  // Cleanup
  // ========================================

  public stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.logger.info('Live risk monitor stopped');
  }
}

// Supporting interface
interface DailyRiskStats {
  date: string;
  totalStaked: number;
  betCount: number;
  exposureByGame: Record<string, number>;
  exposureBySport: Record<string, number>;
  riskEvents: string[];
}