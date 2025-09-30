/**
 * Phase 9: Live Performance Tracker
 *
 * Real-time tracking of win rates, CLV performance, and statistical significance
 * for live testing validation of the syndicate-level ML betting system.
 */

import { EventEmitter } from 'events';
import { Logger } from '../../shared/logger';
import {
  PerformanceTracker,
  LiveMetrics,
  HistoricalResults,
  CLVTracker,
  SignificanceTracker,
  LiveBet,
  CLVTrack,
  CLVAggregateMetrics,
  DailyResult,
  WeeklyResult,
  PhaseResult,
  SportResult,
  FeatureResult,
  SignificanceTest
} from '../types';
import { ProfessionalFeaturesResult } from '../../professional/types';

export class LivePerformanceTracker extends EventEmitter implements PerformanceTracker {
  private logger = new Logger('LivePerformanceTracker');

  // Core tracking data
  public realTimeMetrics: LiveMetrics;
  public historicalPerformance: HistoricalResults;
  public clvTracking: CLVTracker;
  public statisticalSignificance: SignificanceTracker;

  // Internal state
  private sessionStartTime: string;
  private liveBets: Map<string, LiveBet> = new Map();
  private updateInterval: NodeJS.Timeout;

  constructor() {
    super();
    this.sessionStartTime = new Date().toISOString();
    this.initializeMetrics();
    this.startRealTimeUpdates();
  }

  // ========================================
  // Initialization
  // ========================================

  private initializeMetrics(): void {
    this.realTimeMetrics = {
      sessionStartTime: this.sessionStartTime,
      currentWinRate: 0,
      currentROI: 0,
      currentCLV: 0,
      totalBets: 0,
      wins: 0,
      losses: 0,
      pending: 0,
      totalStaked: 0,
      totalReturns: 0,
      netProfit: 0,
      avgBetSize: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winStreak: 0,
      lossStreak: 0,
      professionalFeaturesWinRate: 0,
      steamDetectionAccuracy: 0,
      closingLinePredictionAccuracy: 0,
      optimalTimingSuccess: 0
    };

    this.historicalPerformance = {
      dailyResults: [],
      weeklyResults: [],
      byPhase: [],
      bySport: [],
      byFeature: []
    };

    this.clvTracking = {
      activeTracks: [],
      completedTracks: [],
      aggregateMetrics: {
        totalTracks: 0,
        positiveClvRate: 0,
        avgClv: 0,
        avgClvByFeature: {},
        clvDistribution: {
          positive: 0,
          neutral: 0,
          negative: 0
        },
        timeToLineMovement: 0
      }
    };

    this.statisticalSignificance = {
      sampleSize: 0,
      winRateSignificance: this.initializeSignificanceTest(),
      roiSignificance: this.initializeSignificanceTest(),
      clvSignificance: this.initializeSignificanceTest(),
      readyForProduction: false
    };
  }

  private initializeSignificanceTest(): SignificanceTest {
    return {
      statistic: 0,
      pValue: 1,
      confidenceInterval: [0, 0],
      significant: false,
      sampleSizeNeeded: 100, // Minimum sample size for statistical significance
      currentPower: 0
    };
  }

  // ========================================
  // Real-Time Updates
  // ========================================

  private startRealTimeUpdates(): void {
    // Update metrics every 5 seconds
    this.updateInterval = setInterval(() => {
      this.updateRealTimeMetrics();
      this.emit('metricsUpdated', this.realTimeMetrics);
    }, 5000);
  }

  private updateRealTimeMetrics(): void {
    const settledBets = Array.from(this.liveBets.values())
      .filter(bet => bet.status === 'SETTLED');

    const pendingBets = Array.from(this.liveBets.values())
      .filter(bet => bet.status === 'CONFIRMED' || bet.status === 'PENDING');

    // Basic metrics
    this.realTimeMetrics.totalBets = this.liveBets.size;
    this.realTimeMetrics.wins = settledBets.filter(bet => bet.result === 'WIN').length;
    this.realTimeMetrics.losses = settledBets.filter(bet => bet.result === 'LOSS').length;
    this.realTimeMetrics.pending = pendingBets.length;

    // Financial metrics
    this.realTimeMetrics.totalStaked = Array.from(this.liveBets.values())
      .reduce((sum, bet) => sum + bet.stake, 0);

    this.realTimeMetrics.totalReturns = settledBets
      .reduce((sum, bet) => sum + (bet.pnl || 0) + bet.stake, 0);

    this.realTimeMetrics.netProfit = settledBets
      .reduce((sum, bet) => sum + (bet.pnl || 0), 0);

    this.realTimeMetrics.avgBetSize = this.realTimeMetrics.totalBets > 0
      ? this.realTimeMetrics.totalStaked / this.realTimeMetrics.totalBets
      : 0;

    // Performance metrics
    if (settledBets.length > 0) {
      this.realTimeMetrics.currentWinRate = this.realTimeMetrics.wins / settledBets.length;
      this.realTimeMetrics.currentROI = this.realTimeMetrics.totalStaked > 0
        ? this.realTimeMetrics.netProfit / this.realTimeMetrics.totalStaked
        : 0;
    }

    // Calculate win/loss streaks
    this.calculateStreaks();

    // Calculate advanced metrics
    this.calculateAdvancedMetrics();

    // Update CLV metrics
    this.updateCLVMetrics();

    // Update statistical significance
    this.updateStatisticalSignificance();
  }

  // ========================================
  // Bet Tracking
  // ========================================

  public trackBet(bet: LiveBet): void {
    this.liveBets.set(bet.id, bet);

    // Create CLV tracking entry
    const clvTrack: CLVTrack = {
      betId: bet.id,
      propId: bet.propId,
      initialLine: bet.line,
      initialOdds: bet.odds,
      closingLine: bet.line, // Will be updated when available
      closingOdds: bet.odds, // Will be updated when available
      clv: 0, // Will be calculated when closing line is available
      clvCategory: 'NEUTRAL',
      timestamp: bet.placedAt,
      sport: bet.sport,
      market: bet.market,
      professionalFeatures: bet.professionalFeatures
    };

    this.clvTracking.activeTracks.push(clvTrack);

    this.logger.info('Started tracking bet', {
      betId: bet.id,
      sport: bet.sport,
      market: bet.market,
      stake: bet.stake,
      professionalScore: bet.professionalScore
    });

    this.emit('betTracked', bet);
  }

  public updateBetResult(betId: string, result: 'WIN' | 'LOSS' | 'PUSH', pnl: number): void {
    const bet = this.liveBets.get(betId);
    if (!bet) {
      this.logger.warn('Attempted to update unknown bet', { betId });
      return;
    }

    bet.result = result;
    bet.pnl = pnl;
    bet.roi = pnl / bet.stake;
    bet.status = 'SETTLED';
    bet.settledAt = new Date().toISOString();

    this.logger.info('Bet result updated', {
      betId,
      result,
      pnl,
      roi: bet.roi
    });

    this.emit('betResultUpdated', bet);
  }

  public updateCLV(betId: string, closingLine: number, closingOdds: number): void {
    const clvTrack = this.clvTracking.activeTracks.find(track => track.betId === betId);
    if (!clvTrack) {
      this.logger.warn('CLV track not found for bet', { betId });
      return;
    }

    clvTrack.closingLine = closingLine;
    clvTrack.closingOdds = closingOdds;
    clvTrack.clv = this.calculateCLVValue(clvTrack.initialOdds, closingOdds);
    clvTrack.clvCategory = this.categorizeCLV(clvTrack.clv);

    // Move to completed tracks
    const index = this.clvTracking.activeTracks.findIndex(track => track.betId === betId);
    if (index !== -1) {
      this.clvTracking.activeTracks.splice(index, 1);
      this.clvTracking.completedTracks.push(clvTrack);
    }

    this.logger.info('CLV updated for bet', {
      betId,
      initialOdds: clvTrack.initialOdds,
      closingOdds,
      clv: clvTrack.clv,
      category: clvTrack.clvCategory
    });

    this.emit('clvUpdated', clvTrack);
  }

  // ========================================
  // Advanced Calculations
  // ========================================

  private calculateStreaks(): void {
    const settledBets = Array.from(this.liveBets.values())
      .filter(bet => bet.status === 'SETTLED')
      .sort((a, b) => new Date(a.settledAt!).getTime() - new Date(b.settledAt!).getTime());

    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;

    for (let i = settledBets.length - 1; i >= 0; i--) {
      const bet = settledBets[i];

      if (bet.result === 'WIN') {
        currentWinStreak++;
        currentLossStreak = 0;
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
      } else if (bet.result === 'LOSS') {
        currentLossStreak++;
        currentWinStreak = 0;
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
      }
    }

    this.realTimeMetrics.winStreak = currentWinStreak;
    this.realTimeMetrics.lossStreak = currentLossStreak;
  }

  private calculateAdvancedMetrics(): void {
    const settledBets = Array.from(this.liveBets.values())
      .filter(bet => bet.status === 'SETTLED');

    if (settledBets.length < 2) return;

    // Calculate Sharpe ratio
    const returns = settledBets.map(bet => bet.roi || 0);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const returnVariance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const returnStdDev = Math.sqrt(returnVariance);

    this.realTimeMetrics.sharpeRatio = returnStdDev > 0 ? avgReturn / returnStdDev : 0;

    // Calculate max drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;

    for (const bet of settledBets) {
      runningPnL += bet.pnl || 0;
      peak = Math.max(peak, runningPnL);
      const drawdown = (peak - runningPnL) / Math.max(peak, 1);
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    this.realTimeMetrics.maxDrawdown = maxDrawdown;

    // Professional features accuracy
    this.calculateProfessionalFeaturesAccuracy();
  }

  private calculateProfessionalFeaturesAccuracy(): void {
    const settledBets = Array.from(this.liveBets.values())
      .filter(bet => bet.status === 'SETTLED' && bet.professionalFeatures);

    if (settledBets.length === 0) return;

    // Professional features win rate
    const professionalWins = settledBets.filter(bet => bet.result === 'WIN').length;
    this.realTimeMetrics.professionalFeaturesWinRate = professionalWins / settledBets.length;

    // Steam detection accuracy
    const steamBets = settledBets.filter(bet =>
      bet.professionalFeatures.steamDetection.steamDetected
    );
    if (steamBets.length > 0) {
      const steamWins = steamBets.filter(bet => bet.result === 'WIN').length;
      this.realTimeMetrics.steamDetectionAccuracy = steamWins / steamBets.length;
    }

    // Closing line prediction accuracy (based on CLV)
    const completedCLVTracks = this.clvTracking.completedTracks;
    if (completedCLVTracks.length > 0) {
      const positiveCLV = completedCLVTracks.filter(track => track.clv > 0).length;
      this.realTimeMetrics.closingLinePredictionAccuracy = positiveCLV / completedCLVTracks.length;
    }

    // Optimal timing success (based on professional timing feature)
    const timingBets = settledBets.filter(bet =>
      bet.professionalFeatures.optimalTiming.timingRecommendation.action === 'BET_NOW'
    );
    if (timingBets.length > 0) {
      const timingWins = timingBets.filter(bet => bet.result === 'WIN').length;
      this.realTimeMetrics.optimalTimingSuccess = timingWins / timingBets.length;
    }
  }

  private updateCLVMetrics(): void {
    const completed = this.clvTracking.completedTracks;

    this.clvTracking.aggregateMetrics.totalTracks = completed.length;

    if (completed.length > 0) {
      const positiveCLV = completed.filter(track => track.clv > 0).length;
      this.clvTracking.aggregateMetrics.positiveClvRate = positiveCLV / completed.length;

      this.clvTracking.aggregateMetrics.avgClv =
        completed.reduce((sum, track) => sum + track.clv, 0) / completed.length;

      // Update CLV distribution
      this.clvTracking.aggregateMetrics.clvDistribution = {
        positive: completed.filter(track => track.clv > 0.02).length,
        neutral: completed.filter(track => track.clv >= -0.02 && track.clv <= 0.02).length,
        negative: completed.filter(track => track.clv < -0.02).length
      };

      // Update current CLV for real-time metrics
      this.realTimeMetrics.currentCLV = this.clvTracking.aggregateMetrics.avgClv;
    }
  }

  private calculateCLVValue(initialOdds: number, closingOdds: number): number {
    // Convert odds to implied probability and calculate CLV
    const initialProb = this.oddsToImpliedProbability(initialOdds);
    const closingProb = this.oddsToImpliedProbability(closingOdds);

    return (closingProb - initialProb) / initialProb;
  }

  private oddsToImpliedProbability(odds: number): number {
    if (odds > 0) {
      return 100 / (odds + 100);
    } else {
      return Math.abs(odds) / (Math.abs(odds) + 100);
    }
  }

  private categorizeCLV(clv: number): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' {
    if (clv > 0.02) return 'POSITIVE';  // > 2% CLV
    if (clv < -0.02) return 'NEGATIVE'; // < -2% CLV
    return 'NEUTRAL';
  }

  // ========================================
  // Statistical Significance Testing
  // ========================================

  private updateStatisticalSignificance(): void {
    const settledBets = Array.from(this.liveBets.values())
      .filter(bet => bet.status === 'SETTLED');

    this.statisticalSignificance.sampleSize = settledBets.length;

    if (settledBets.length >= 30) { // Minimum sample for normal approximation
      this.statisticalSignificance.winRateSignificance = this.calculateWinRateSignificance(settledBets);
      this.statisticalSignificance.roiSignificance = this.calculateROISignificance(settledBets);
      this.statisticalSignificance.clvSignificance = this.calculateCLVSignificance();

      // Determine if ready for production
      this.statisticalSignificance.readyForProduction = this.isReadyForProduction();
    }
  }

  private calculateWinRateSignificance(settledBets: LiveBet[]): SignificanceTest {
    const wins = settledBets.filter(bet => bet.result === 'WIN').length;
    const n = settledBets.length;
    const winRate = wins / n;
    const expectedWinRate = 0.55; // Target win rate

    // Z-test for proportion
    const p0 = expectedWinRate;
    const standardError = Math.sqrt((p0 * (1 - p0)) / n);
    const zScore = (winRate - p0) / standardError;
    const pValue = this.calculateZTestPValue(zScore);

    return {
      statistic: zScore,
      pValue,
      confidenceInterval: this.calculateConfidenceInterval(winRate, standardError),
      significant: pValue < 0.05 && winRate >= expectedWinRate,
      sampleSizeNeeded: this.calculateRequiredSampleSize(expectedWinRate, 0.8, 0.05),
      currentPower: this.calculateStatisticalPower(n, winRate, expectedWinRate)
    };
  }

  private calculateROISignificance(settledBets: LiveBet[]): SignificanceTest {
    const rois = settledBets.map(bet => bet.roi || 0);
    const avgROI = rois.reduce((sum, roi) => sum + roi, 0) / rois.length;
    const expectedROI = 0.05; // Target 5% ROI

    const variance = rois.reduce((sum, roi) => sum + Math.pow(roi - avgROI, 2), 0) / rois.length;
    const standardError = Math.sqrt(variance / rois.length);
    const tScore = (avgROI - expectedROI) / standardError;
    const pValue = this.calculateTTestPValue(tScore, rois.length - 1);

    return {
      statistic: tScore,
      pValue,
      confidenceInterval: this.calculateConfidenceInterval(avgROI, standardError),
      significant: pValue < 0.05 && avgROI >= expectedROI,
      sampleSizeNeeded: this.calculateRequiredSampleSize(expectedROI, 0.8, 0.05),
      currentPower: this.calculateStatisticalPower(rois.length, avgROI, expectedROI)
    };
  }

  private calculateCLVSignificance(): SignificanceTest {
    const completedTracks = this.clvTracking.completedTracks;
    if (completedTracks.length === 0) return this.initializeSignificanceTest();

    const positiveCLV = completedTracks.filter(track => track.clv > 0).length;
    const clvRate = positiveCLV / completedTracks.length;
    const expectedCLVRate = 0.6; // Target 60% positive CLV

    const standardError = Math.sqrt((expectedCLVRate * (1 - expectedCLVRate)) / completedTracks.length);
    const zScore = (clvRate - expectedCLVRate) / standardError;
    const pValue = this.calculateZTestPValue(zScore);

    return {
      statistic: zScore,
      pValue,
      confidenceInterval: this.calculateConfidenceInterval(clvRate, standardError),
      significant: pValue < 0.05 && clvRate >= expectedCLVRate,
      sampleSizeNeeded: this.calculateRequiredSampleSize(expectedCLVRate, 0.8, 0.05),
      currentPower: this.calculateStatisticalPower(completedTracks.length, clvRate, expectedCLVRate)
    };
  }

  private isReadyForProduction(): boolean {
    const winRateReady = this.statisticalSignificance.winRateSignificance.significant;
    const roiReady = this.statisticalSignificance.roiSignificance.significant;
    const clvReady = this.statisticalSignificance.clvSignificance.significant;
    const sampleSizeReady = this.statisticalSignificance.sampleSize >= 100;

    return winRateReady && roiReady && clvReady && sampleSizeReady;
  }

  // ========================================
  // Statistical Helper Methods
  // ========================================

  private calculateZTestPValue(zScore: number): number {
    // Simplified p-value calculation for z-test
    return 2 * (1 - this.normalCDF(Math.abs(zScore)));
  }

  private calculateTTestPValue(tScore: number, degreesOfFreedom: number): number {
    // Simplified p-value calculation for t-test
    // In practice, you'd use a t-distribution table or library
    return 2 * (1 - this.normalCDF(Math.abs(tScore)));
  }

  private normalCDF(x: number): number {
    // Approximation of normal CDF
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Approximation of error function
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  private calculateConfidenceInterval(mean: number, standardError: number): [number, number] {
    const zCritical = 1.96; // 95% confidence interval
    const margin = zCritical * standardError;
    return [mean - margin, mean + margin];
  }

  private calculateRequiredSampleSize(expectedValue: number, power: number, alpha: number): number {
    // Simplified sample size calculation
    // In practice, you'd use more sophisticated power analysis
    const zAlpha = 1.96; // for alpha = 0.05
    const zBeta = 0.84;  // for power = 0.8

    return Math.ceil(Math.pow(zAlpha + zBeta, 2) * expectedValue * (1 - expectedValue) / Math.pow(0.05, 2));
  }

  private calculateStatisticalPower(n: number, observedValue: number, expectedValue: number): number {
    // Simplified power calculation
    if (n === 0) return 0;

    const effect = Math.abs(observedValue - expectedValue);
    const standardError = Math.sqrt(expectedValue * (1 - expectedValue) / n);
    const zScore = effect / standardError;

    return this.normalCDF(zScore);
  }

  // ========================================
  // Historical Performance Methods
  // ========================================

  public generateDailyReport(date: string): DailyResult {
    const dayBets = Array.from(this.liveBets.values())
      .filter(bet => bet.placedAt.startsWith(date) && bet.status === 'SETTLED');

    if (dayBets.length === 0) {
      return {
        date,
        totalBets: 0,
        winRate: 0,
        roi: 0,
        clv: 0,
        netProfit: 0,
        drawdown: 0,
        sharpeRatio: 0
      };
    }

    const wins = dayBets.filter(bet => bet.result === 'WIN').length;
    const totalStaked = dayBets.reduce((sum, bet) => sum + bet.stake, 0);
    const netProfit = dayBets.reduce((sum, bet) => sum + (bet.pnl || 0), 0);
    const clvTracks = this.clvTracking.completedTracks
      .filter(track => track.timestamp.startsWith(date));
    const avgCLV = clvTracks.length > 0
      ? clvTracks.reduce((sum, track) => sum + track.clv, 0) / clvTracks.length
      : 0;

    return {
      date,
      totalBets: dayBets.length,
      winRate: wins / dayBets.length,
      roi: totalStaked > 0 ? netProfit / totalStaked : 0,
      clv: avgCLV,
      netProfit,
      drawdown: this.calculateDayDrawdown(dayBets),
      sharpeRatio: this.calculateDaySharpeRatio(dayBets)
    };
  }

  private calculateDayDrawdown(dayBets: LiveBet[]): number {
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;

    for (const bet of dayBets) {
      runningPnL += bet.pnl || 0;
      peak = Math.max(peak, runningPnL);
      const drawdown = peak > 0 ? (peak - runningPnL) / peak : 0;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    return maxDrawdown;
  }

  private calculateDaySharpeRatio(dayBets: LiveBet[]): number {
    if (dayBets.length < 2) return 0;

    const returns = dayBets.map(bet => bet.roi || 0);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    return stdDev > 0 ? avgReturn / stdDev : 0;
  }

  // ========================================
  // Public Methods
  // ========================================

  public getCurrentMetrics(): LiveMetrics {
    return { ...this.realTimeMetrics };
  }

  public getHistoricalPerformance(): HistoricalResults {
    return { ...this.historicalPerformance };
  }

  public getCLVMetrics(): CLVAggregateMetrics {
    return { ...this.clvTracking.aggregateMetrics };
  }

  public getStatisticalSignificance(): SignificanceTracker {
    return { ...this.statisticalSignificance };
  }

  public getPerformanceSummary(): {
    isPerformingWell: boolean;
    readyForProduction: boolean;
    keyMetrics: {
      winRate: number;
      roi: number;
      clv: number;
      sampleSize: number;
    };
    alerts: string[];
  } {
    const alerts: string[] = [];

    // Check win rate
    if (this.realTimeMetrics.currentWinRate < 0.55 && this.realTimeMetrics.totalBets > 20) {
      alerts.push(`Win rate ${(this.realTimeMetrics.currentWinRate * 100).toFixed(1)}% below target 55%`);
    }

    // Check CLV
    if (this.clvTracking.aggregateMetrics.positiveClvRate < 0.6 && this.clvTracking.aggregateMetrics.totalTracks > 10) {
      alerts.push(`Positive CLV rate ${(this.clvTracking.aggregateMetrics.positiveClvRate * 100).toFixed(1)}% below target 60%`);
    }

    // Check drawdown
    if (this.realTimeMetrics.maxDrawdown > 0.1) {
      alerts.push(`Max drawdown ${(this.realTimeMetrics.maxDrawdown * 100).toFixed(1)}% exceeds 10% limit`);
    }

    const isPerformingWell = alerts.length === 0 &&
      this.realTimeMetrics.currentWinRate >= 0.55 &&
      this.realTimeMetrics.currentROI > 0;

    return {
      isPerformingWell,
      readyForProduction: this.statisticalSignificance.readyForProduction,
      keyMetrics: {
        winRate: this.realTimeMetrics.currentWinRate,
        roi: this.realTimeMetrics.currentROI,
        clv: this.realTimeMetrics.currentCLV,
        sampleSize: this.statisticalSignificance.sampleSize
      },
      alerts
    };
  }

  // ========================================
  // Cleanup
  // ========================================

  public stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.logger.info('Live performance tracker stopped');
  }
}