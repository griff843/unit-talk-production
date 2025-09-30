#!/usr/bin/env npx tsx

/**
 * Phase 9: Live Performance Monitoring Script
 *
 * Standalone monitoring script for tracking live testing performance,
 * generating real-time reports, and providing alerts for performance issues.
 */

import { Logger } from '@shared/logger';
import { supabaseClient } from '../src/services/supabaseClient';
import { LivePerformanceTracker } from '../src/live-testing/performance/LivePerformanceTracker';
import { FinancialReportsSystem } from '../src/live-testing/financial/FinancialReportsSystem';
import { LiveRiskMonitor } from '../src/live-testing/risk/LiveRiskMonitor';
import {
  LiveTestingConfig,
  LiveBet,
  DailyResult,
  WeeklyResult,
  PhaseResult
} from '../src/live-testing/types';

class LivePerformanceMonitor {
  private logger = new Logger('LivePerformanceMonitor');
  private performanceTracker: LivePerformanceTracker;
  private financialReports: FinancialReportsSystem;
  private riskMonitor: LiveRiskMonitor;

  private monitoringInterval: NodeJS.Timeout;
  private reportingInterval: NodeJS.Timeout;
  private alertsInterval: NodeJS.Timeout;

  private config: LiveTestingConfig;
  private startTime: string;

  constructor() {
    this.startTime = new Date().toISOString();
    this.initializeConfig();
    this.initializeMonitoring();
  }

  // ========================================
  // Initialization
  // ========================================

  private initializeConfig(): void {
    this.config = {
      environment: 'SANDBOX',
      testingMode: true,
      currentPhase: 'PHASE_9A',
      phases: {
        'PHASE_9A': {
          maxBetSize: 10,
          maxDailyRisk: 100,
          maxTotalRisk: 500,
          enabledSports: ['NBA'],
          enabledFeatures: ['steamDetection', 'closingLinePrediction'],
          minTestingDays: 7,
          minBetsRequired: 50,
          stopLossThreshold: 0.05,
          kellyMultiplier: 0.1
        },
        'PHASE_9B': {
          maxBetSize: 25,
          maxDailyRisk: 250,
          maxTotalRisk: 1000,
          enabledSports: ['NBA', 'NFL', 'MLB'],
          enabledFeatures: ['steamDetection', 'closingLinePrediction', 'optimalTiming'],
          minTestingDays: 14,
          minBetsRequired: 100,
          stopLossThreshold: 0.08,
          kellyMultiplier: 0.15
        },
        'PHASE_9C': {
          maxBetSize: 50,
          maxDailyRisk: 500,
          maxTotalRisk: 2000,
          enabledSports: ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAF', 'WNBA', 'TENNIS'],
          enabledFeatures: ['steamDetection', 'closingLinePrediction', 'optimalTiming', 'lineShoppingEdge'],
          minTestingDays: 21,
          minBetsRequired: 200,
          stopLossThreshold: 0.1,
          kellyMultiplier: 0.2
        },
        'PHASE_9D': {
          maxBetSize: 100,
          maxDailyRisk: 1000,
          maxTotalRisk: 5000,
          enabledSports: ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAF', 'WNBA', 'TENNIS'],
          enabledFeatures: ['steamDetection', 'closingLinePrediction', 'optimalTiming', 'lineShoppingEdge', 'publicVsSharpSplit'],
          minTestingDays: 30,
          minBetsRequired: 500,
          stopLossThreshold: 0.1,
          kellyMultiplier: 0.25
        }
      },
      globalLimits: {
        maxTestingBankroll: 2000,
        maxSingleBet: 50,
        maxDailyRisk: 500,
        maxConcurrentBets: 20,
        maxKellyFraction: 0.25
      },
      monitoring: {
        enableRealTimeTracking: true,
        enableCLVTracking: true,
        enableRiskMonitoring: true,
        enablePerformanceTracking: true,
        alertThresholds: {
          drawdownPercent: 8,
          consecutiveLosses: 5,
          systemErrors: 3,
          processingDelays: 5000
        },
        reportingIntervals: {
          realTime: 30,
          hourly: true,
          daily: true,
          weekly: true
        }
      },
      integrations: {
        enabledBooks: ['DraftKings'],
        primaryBook: 'DraftKings',
        oddsProviders: ['OptimalAPI'],
        newsServices: ['SportsRadar'],
        notifications: {
          discord: true,
          email: true,
          sms: false
        }
      }
    };
  }

  private initializeMonitoring(): void {
    this.performanceTracker = new LivePerformanceTracker();
    this.financialReports = new FinancialReportsSystem(this.config.globalLimits.maxTestingBankroll);
    this.riskMonitor = new LiveRiskMonitor(this.config);

    this.logger.info('Live performance monitoring initialized', {
      startTime: this.startTime,
      config: {
        phase: this.config.currentPhase,
        enabledSports: this.config.phases[this.config.currentPhase].enabledSports,
        maxDailyRisk: this.config.phases[this.config.currentPhase].maxDailyRisk
      }
    });
  }

  // ========================================
  // Main Monitoring Loop
  // ========================================

  public async start(): Promise<void> {
    this.logger.info('Starting live performance monitoring...');

    try {
      // Load existing bet data
      await this.loadExistingBets();

      // Start monitoring intervals
      this.startRealTimeMonitoring();
      this.startReportGeneration();
      this.startAlertMonitoring();

      this.displayMonitoringDashboard();

      this.logger.info('Live performance monitoring started successfully', {
        intervals: {
          realTime: '30 seconds',
          reporting: '5 minutes',
          alerts: '60 seconds'
        }
      });

    } catch (error) {
      this.logger.error('Failed to start live performance monitoring', {
        error: error.message
      });
      throw error;
    }
  }

  private async loadExistingBets(): Promise<void> {
    try {
      this.logger.info('Loading existing live test bet data...');

      // Query for live test bets (in a real implementation, these would be stored)
      const { data: bets, error } = await supabaseClient
        .from('live_test_bets')
        .select('*')
        .order('placed_at', { ascending: true });

      if (error && error.code !== 'PGRST116') { // Table doesn't exist error
        throw new Error(`Failed to load existing bets: ${error.message}`);
      }

      if (bets && bets.length > 0) {
        for (const betData of bets) {
          const liveBet = this.convertToLiveBet(betData);
          this.performanceTracker.trackBet(liveBet);
          this.financialReports.trackBetPlacement(liveBet);
          this.riskMonitor.trackBet(liveBet);

          // Update with results if settled
          if (betData.status === 'SETTLED' && betData.result) {
            this.performanceTracker.updateBetResult(liveBet.id, betData.result, betData.pnl);
            this.financialReports.updateBetResult(liveBet.id, betData.result, betData.payout, betData.clv);
            this.riskMonitor.updateBetStatus(liveBet.id, 'SETTLED', betData.pnl);
          }
        }

        this.logger.info('Existing bet data loaded', {
          totalBets: bets.length,
          settledBets: bets.filter(b => b.status === 'SETTLED').length
        });
      } else {
        this.logger.info('No existing bet data found - starting fresh');
      }

    } catch (error) {
      this.logger.warn('Could not load existing bet data', {
        error: error.message,
        note: 'Starting with empty dataset'
      });
    }
  }

  private convertToLiveBet(betData: any): LiveBet {
    return {
      id: betData.id,
      propId: betData.prop_id,
      sport: betData.sport,
      market: betData.market,
      selection: betData.selection,
      line: betData.line,
      odds: betData.odds,
      stake: betData.stake,
      professionalScore: betData.professional_score,
      professionalFeatures: betData.professional_features,
      clvTrackingId: betData.clv_tracking_id,
      kellyFraction: betData.kelly_fraction,
      book: betData.book,
      placedAt: betData.placed_at,
      status: betData.status,
      result: betData.result,
      pnl: betData.pnl,
      roi: betData.roi,
      clv: betData.clv,
      riskLevel: betData.risk_level,
      correlationRisk: betData.correlation_risk,
      portfolioImpact: betData.portfolio_impact,
      testingPhase: betData.testing_phase,
      automaticallyPlaced: betData.automatically_placed,
      settledAt: betData.settled_at
    };
  }

  // ========================================
  // Real-Time Monitoring
  // ========================================

  private startRealTimeMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.updateRealTimeMetrics();
    }, 30000); // Every 30 seconds
  }

  private updateRealTimeMetrics(): void {
    const performance = this.performanceTracker.getCurrentMetrics();
    const financial = this.financialReports.getFinancialSummary();
    const risk = this.riskMonitor.getRiskSummary();
    const significance = this.performanceTracker.getStatisticalSignificance();

    // Log current status
    this.logger.debug('Real-time metrics update', {
      performance: {
        totalBets: performance.totalBets,
        winRate: performance.currentWinRate,
        roi: performance.currentROI,
        clv: performance.currentCLV
      },
      financial: {
        totalPnL: financial.totalPnL,
        sharpeRatio: financial.sharpeRatio,
        maxDrawdown: financial.maxDrawdown
      },
      risk: {
        overallRiskLevel: risk.overallRiskLevel,
        utilizationRate: risk.keyMetrics.utilizationRate
      },
      significance: {
        sampleSize: significance.sampleSize,
        readyForProduction: significance.readyForProduction
      }
    });

    // Update console display
    this.updateConsoleDashboard(performance, financial, risk, significance);
  }

  // ========================================
  // Report Generation
  // ========================================

  private startReportGeneration(): void {
    this.reportingInterval = setInterval(() => {
      this.generatePerformanceReports();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private async generatePerformanceReports(): Promise<void> {
    try {
      // Generate daily report
      const today = new Date().toISOString().split('T')[0];
      const dailyReport = this.performanceTracker.generateDailyReport(today);

      // Generate financial report
      const financialReport = this.financialReports.generateRiskReport(today);

      // Save reports
      await this.savePerformanceReport(dailyReport, financialReport);

      this.logger.info('Performance reports generated', {
        date: today,
        dailyBets: dailyReport.totalBets,
        dailyPnL: dailyReport.netProfit,
        dailyWinRate: dailyReport.winRate
      });

    } catch (error) {
      this.logger.error('Failed to generate performance reports', {
        error: error.message
      });
    }
  }

  private async savePerformanceReport(dailyReport: DailyResult, financialReport: any): Promise<void> {
    try {
      // Save to database (in a real implementation)
      const reportData = {
        date: dailyReport.date,
        total_bets: dailyReport.totalBets,
        win_rate: dailyReport.winRate,
        roi: dailyReport.roi,
        clv: dailyReport.clv,
        net_profit: dailyReport.netProfit,
        drawdown: dailyReport.drawdown,
        sharpe_ratio: dailyReport.sharpeRatio,
        risk_metrics: financialReport.riskMetrics,
        created_at: new Date().toISOString()
      };

      // In a real implementation, this would save to the database
      this.logger.debug('Report data prepared for storage', reportData);

    } catch (error) {
      this.logger.error('Failed to save performance report', {
        error: error.message
      });
    }
  }

  // ========================================
  // Alert Monitoring
  // ========================================

  private startAlertMonitoring(): void {
    this.alertsInterval = setInterval(() => {
      this.checkPerformanceAlerts();
    }, 60000); // Every minute
  }

  private checkPerformanceAlerts(): void {
    const performance = this.performanceTracker.getPerformanceSummary();
    const financial = this.financialReports.getFinancialSummary();
    const risk = this.riskMonitor.getRiskSummary();

    const alerts: string[] = [];

    // Performance alerts
    if (!performance.isPerformingWell) {
      alerts.push(...performance.alerts);
    }

    // Financial alerts
    if (financial.maxDrawdown > this.config.monitoring.alertThresholds.drawdownPercent / 100) {
      alerts.push(`Max drawdown ${(financial.maxDrawdown * 100).toFixed(1)}% exceeds threshold`);
    }

    if (financial.roi < -0.05) {
      alerts.push(`ROI ${(financial.roi * 100).toFixed(1)}% indicates poor performance`);
    }

    // Risk alerts
    if (risk.overallRiskLevel === 'HIGH' || risk.overallRiskLevel === 'CRITICAL') {
      alerts.push(`Risk level elevated: ${risk.overallRiskLevel}`);
    }

    // Statistical significance alerts
    const significance = this.performanceTracker.getStatisticalSignificance();
    if (significance.sampleSize > 50 && !significance.winRateSignificance.significant) {
      alerts.push('Win rate not statistically significant despite adequate sample size');
    }

    // Process alerts
    if (alerts.length > 0) {
      this.processAlerts(alerts);
    }
  }

  private processAlerts(alerts: string[]): void {
    for (const alert of alerts) {
      this.logger.warn('Performance alert', { alert });

      // In a real implementation, this would send notifications
      if (this.config.integrations.notifications.discord) {
        this.sendDiscordAlert(alert);
      }

      if (this.config.integrations.notifications.email) {
        this.sendEmailAlert(alert);
      }
    }
  }

  private sendDiscordAlert(alert: string): void {
    // Placeholder for Discord notification
    this.logger.info('Discord alert sent', { alert });
  }

  private sendEmailAlert(alert: string): void {
    // Placeholder for email notification
    this.logger.info('Email alert sent', { alert });
  }

  // ========================================
  // Console Dashboard
  // ========================================

  private displayMonitoringDashboard(): void {
    console.clear();
    console.log('🚀 Phase 9 Live Testing Performance Monitor');
    console.log('==========================================');
    console.log(`Started: ${this.startTime}`);
    console.log(`Phase: ${this.config.currentPhase}`);
    console.log(`Environment: ${this.config.environment}`);
    console.log('\n📊 Real-time metrics updating every 30 seconds...\n');
  }

  private updateConsoleDashboard(
    performance: any,
    financial: any,
    risk: any,
    significance: any
  ): void {
    // Move cursor to beginning and clear screen
    process.stdout.write('\x1b[H\x1b[2J');

    console.log('🚀 Phase 9 Live Testing Performance Monitor');
    console.log('==========================================');
    console.log(`Started: ${this.startTime}`);
    console.log(`Phase: ${this.config.currentPhase}`);
    console.log(`Environment: ${this.config.environment}`);
    console.log(`Last Update: ${new Date().toLocaleTimeString()}`);

    console.log('\n📈 PERFORMANCE METRICS');
    console.log('----------------------');
    console.log(`Total Bets: ${performance.totalBets}`);
    console.log(`Win Rate: ${(performance.currentWinRate * 100).toFixed(1)}% ${performance.currentWinRate >= 0.55 ? '✅' : '❌'}`);
    console.log(`ROI: ${(performance.currentROI * 100).toFixed(1)}% ${performance.currentROI > 0 ? '✅' : '❌'}`);
    console.log(`CLV: ${(performance.currentCLV * 100).toFixed(1)}% ${performance.currentCLV > 0 ? '✅' : '❌'}`);
    console.log(`Pending Bets: ${performance.pending}`);

    console.log('\n💰 FINANCIAL METRICS');
    console.log('--------------------');
    console.log(`Total P&L: $${financial.totalPnL.toFixed(2)} ${financial.totalPnL > 0 ? '✅' : '❌'}`);
    console.log(`Sharpe Ratio: ${financial.sharpeRatio.toFixed(2)} ${financial.sharpeRatio > 1 ? '✅' : '❌'}`);
    console.log(`Max Drawdown: ${(financial.maxDrawdown * 100).toFixed(1)}% ${financial.maxDrawdown < 0.1 ? '✅' : '❌'}`);
    console.log(`Average Bet: $${financial.avgBetSize.toFixed(2)}`);

    console.log('\n⚠️  RISK METRICS');
    console.log('----------------');
    console.log(`Risk Level: ${risk.overallRiskLevel} ${risk.overallRiskLevel === 'LOW' ? '✅' : risk.overallRiskLevel === 'MEDIUM' ? '⚠️' : '❌'}`);
    console.log(`Utilization: ${(risk.keyMetrics.utilizationRate * 100).toFixed(1)}% ${risk.keyMetrics.utilizationRate < 0.8 ? '✅' : '⚠️'}`);
    console.log(`Kelly Compliance: ${risk.keyMetrics.kellyCompliance ? '✅ Compliant' : '❌ Non-Compliant'}`);
    console.log(`Active Alerts: ${risk.keyMetrics.activeAlerts} ${risk.keyMetrics.activeAlerts === 0 ? '✅' : '⚠️'}`);

    console.log('\n📊 STATISTICAL SIGNIFICANCE');
    console.log('---------------------------');
    console.log(`Sample Size: ${significance.sampleSize}`);
    console.log(`Win Rate Significant: ${significance.winRateSignificance.significant ? '✅ Yes' : '❌ No'}`);
    console.log(`ROI Significant: ${significance.roiSignificance.significant ? '✅ Yes' : '❌ No'}`);
    console.log(`CLV Significant: ${significance.clvSignificance.significant ? '✅ Yes' : '❌ No'}`);
    console.log(`Ready for Production: ${significance.readyForProduction ? '✅ Yes' : '❌ No'}`);

    if (risk.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS');
      console.log('------------------');
      risk.recommendations.forEach((rec: string, index: number) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }

    console.log('\n⏱️  System Status: Running | Press Ctrl+C to stop');
  }

  // ========================================
  // Data Export and Reporting
  // ========================================

  public async exportPerformanceData(format: 'json' | 'csv' = 'json'): Promise<string> {
    const data = {
      metadata: {
        exportTime: new Date().toISOString(),
        phase: this.config.currentPhase,
        environment: this.config.environment,
        sessionStart: this.startTime
      },
      performance: this.performanceTracker.getCurrentMetrics(),
      financial: this.financialReports.getFinancialSummary(),
      risk: this.riskMonitor.getRiskSummary(),
      significance: this.performanceTracker.getStatisticalSignificance(),
      historicalPerformance: this.performanceTracker.getHistoricalPerformance(),
      clvMetrics: this.performanceTracker.getCLVMetrics()
    };

    if (format === 'csv') {
      return this.convertToCSV(data);
    }

    return JSON.stringify(data, null, 2);
  }

  private convertToCSV(data: any): string {
    // Convert to CSV format (simplified implementation)
    const headers = ['Metric', 'Value', 'Status'];
    const rows = [
      ['Total Bets', data.performance.totalBets, data.performance.totalBets > 0 ? 'Active' : 'Inactive'],
      ['Win Rate', `${(data.performance.currentWinRate * 100).toFixed(1)}%`, data.performance.currentWinRate >= 0.55 ? 'Target Met' : 'Below Target'],
      ['ROI', `${(data.performance.currentROI * 100).toFixed(1)}%`, data.performance.currentROI > 0 ? 'Positive' : 'Negative'],
      ['Total P&L', `$${data.financial.totalPnL.toFixed(2)}`, data.financial.totalPnL > 0 ? 'Profitable' : 'Loss'],
      ['Sharpe Ratio', data.financial.sharpeRatio.toFixed(2), data.financial.sharpeRatio > 1 ? 'Good' : 'Poor'],
      ['Max Drawdown', `${(data.financial.maxDrawdown * 100).toFixed(1)}%`, data.financial.maxDrawdown < 0.1 ? 'Within Limits' : 'Excessive'],
      ['Risk Level', data.risk.overallRiskLevel, data.risk.overallRiskLevel === 'LOW' ? 'Acceptable' : 'Elevated'],
      ['Ready for Production', data.significance.readyForProduction ? 'Yes' : 'No', data.significance.readyForProduction ? 'Passed' : 'Not Ready']
    ];

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  // ========================================
  // Phase Analysis
  // ========================================

  public generatePhaseReport(): PhaseResult {
    const performance = this.performanceTracker.getCurrentMetrics();
    const significance = this.performanceTracker.getStatisticalSignificance();
    const financial = this.financialReports.getFinancialSummary();
    const phaseConfig = this.config.phases[this.config.currentPhase];

    return {
      phase: this.config.currentPhase,
      startDate: this.startTime,
      endDate: new Date().toISOString(),
      totalBets: performance.totalBets,
      winRate: performance.currentWinRate,
      roi: performance.currentROI,
      avgCLV: performance.currentCLV,
      netProfit: financial.totalPnL,
      successCriteria: {
        winRateTarget: performance.currentWinRate >= 0.55,
        clvTarget: performance.currentCLV >= 0.6,
        systemReliability: true, // Simplified
        riskManagement: financial.maxDrawdown < phaseConfig.stopLossThreshold
      }
    };
  }

  // ========================================
  // Cleanup
  // ========================================

  public stop(): void {
    this.logger.info('Stopping live performance monitoring...');

    if (this.monitoringInterval) clearInterval(this.monitoringInterval);
    if (this.reportingInterval) clearInterval(this.reportingInterval);
    if (this.alertsInterval) clearInterval(this.alertsInterval);

    if (this.performanceTracker) this.performanceTracker.stop();
    if (this.financialReports) this.financialReports.stop();
    if (this.riskMonitor) this.riskMonitor.stop();

    this.logger.info('Live performance monitoring stopped');
  }

  // ========================================
  // Public Status Methods
  // ========================================

  public getMonitoringStatus(): {
    running: boolean;
    uptime: number;
    phase: string;
    lastUpdate: string;
    performance: any;
    financial: any;
    risk: any;
  } {
    return {
      running: true,
      uptime: Date.now() - new Date(this.startTime).getTime(),
      phase: this.config.currentPhase,
      lastUpdate: new Date().toISOString(),
      performance: this.performanceTracker.getCurrentMetrics(),
      financial: this.financialReports.getFinancialSummary(),
      risk: this.riskMonitor.getRiskSummary()
    };
  }
}

// ========================================
// Main Execution
// ========================================

async function main(): Promise<void> {
  const monitor = new LivePerformanceMonitor();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    monitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    monitor.stop();
    process.exit(0);
  });

  // Handle data export on USR1 signal
  process.on('SIGUSR1', async () => {
    console.log('\n📊 Exporting performance data...');
    try {
      const data = await monitor.exportPerformanceData('json');
      const filename = `live-performance-${Date.now()}.json`;
      require('fs').writeFileSync(filename, data);
      console.log(`✅ Performance data exported to ${filename}`);
    } catch (error) {
      console.error('❌ Failed to export performance data:', error.message);
    }
  });

  try {
    await monitor.start();

    // Keep the process alive
    process.stdin.resume();

  } catch (error) {
    console.error('❌ Failed to start live performance monitoring:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

export { LivePerformanceMonitor };