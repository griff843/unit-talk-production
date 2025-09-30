/**
 * Phase 9: Live Testing Dashboard
 *
 * Real-time dashboard interface for monitoring live testing performance,
 * risk metrics, financial reports, and system health.
 */

import { EventEmitter } from 'events';
import { Logger } from '../../shared/logger';
import { LivePerformanceTracker } from '../performance/LivePerformanceTracker';
import { LiveRiskMonitor } from '../risk/LiveRiskMonitor';
import { FinancialReportsSystem } from '../financial/FinancialReportsSystem';
import { EmergencySystem } from '../emergency/EmergencySystem';
import { LiveResultsStorage } from '../storage/LiveResultsStorage';
import {
  LiveTestingConfig,
  LiveMetrics,
  DashboardData,
  AlertData,
  ChartData,
  SystemStatus
} from '../types';

export class LiveTestingDashboard extends EventEmitter {
  private logger = new Logger('LiveTestingDashboard');

  // Core systems
  private performanceTracker: LivePerformanceTracker;
  private riskMonitor: LiveRiskMonitor;
  private financialReports: FinancialReportsSystem;
  private emergencySystem: EmergencySystem;
  private resultsStorage: LiveResultsStorage;

  // Dashboard state
  private config: LiveTestingConfig;
  private dashboardData: DashboardData;
  private updateInterval: NodeJS.Timeout;
  private alertHistory: AlertData[] = [];
  private connectedClients: Set<string> = new Set();

  constructor(
    config: LiveTestingConfig,
    performanceTracker: LivePerformanceTracker,
    riskMonitor: LiveRiskMonitor,
    financialReports: FinancialReportsSystem,
    emergencySystem: EmergencySystem,
    resultsStorage: LiveResultsStorage
  ) {
    super();

    this.config = config;
    this.performanceTracker = performanceTracker;
    this.riskMonitor = riskMonitor;
    this.financialReports = financialReports;
    this.emergencySystem = emergencySystem;
    this.resultsStorage = resultsStorage;

    this.initializeDashboard();
    this.setupEventHandlers();
  }

  // ========================================
  // Initialization
  // ========================================

  private initializeDashboard(): void {
    this.dashboardData = {
      systemStatus: {
        isRunning: true,
        currentPhase: this.config.currentPhase,
        uptime: 0,
        lastUpdate: new Date().toISOString(),
        healthStatus: 'HEALTHY',
        activeAlerts: 0
      },
      performance: {
        totalBets: 0,
        winRate: 0,
        roi: 0,
        clv: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        currentStreak: 0,
        streakType: 'NONE'
      },
      financial: {
        totalPnL: 0,
        dailyPnL: 0,
        weeklyPnL: 0,
        monthlyPnL: 0,
        totalStaked: 0,
        avgBetSize: 0,
        transactionCosts: 0,
        netROI: 0
      },
      risk: {
        overallRiskLevel: 'LOW',
        portfolioUtilization: 0,
        dailyRiskUsed: 0,
        dailyRiskLimit: 0,
        kellyCompliance: 100,
        correlationRisk: 0,
        activePositions: 0
      },
      charts: {
        pnlHistory: [],
        winRateHistory: [],
        clvHistory: [],
        riskMetrics: [],
        performanceByPhase: [],
        performanceBySport: []
      },
      recentActivity: [],
      alerts: [],
      phaseProgress: {
        currentPhase: this.config.currentPhase,
        betsCompleted: 0,
        betsRequired: 0,
        daysElapsed: 0,
        daysRequired: 0,
        successCriteria: {
          winRateTarget: false,
          clvTarget: false,
          systemReliability: false,
          riskManagement: false
        }
      }
    };

    this.logger.info('Dashboard initialized', {
      phase: this.config.currentPhase,
      updateInterval: 15000 // 15 seconds
    });
  }

  private setupEventHandlers(): void {
    // Performance tracker events
    this.performanceTracker.on('metricsUpdated', (metrics) => {
      this.updatePerformanceData(metrics);
    });

    this.performanceTracker.on('betTracked', (bet) => {
      this.addRecentActivity(`New bet placed: ${bet.sport} ${bet.market} - $${bet.stake}`);
    });

    this.performanceTracker.on('betResultUpdated', (bet) => {
      this.addRecentActivity(`Bet settled: ${bet.result} - P&L: $${bet.pnl?.toFixed(2)}`);
    });

    // Risk monitor events
    this.riskMonitor.on('riskAlert', (alert) => {
      this.handleRiskAlert(alert);
    });

    this.riskMonitor.on('emergencyTrigger', (trigger) => {
      this.handleEmergencyTrigger(trigger);
    });

    // Financial reports events
    this.financialReports.on('financialMetricsUpdated', (metrics) => {
      this.updateFinancialData(metrics);
    });

    // Emergency system events
    this.emergencySystem.on('emergencyStop', (data) => {
      this.handleEmergencyStop(data);
    });

    this.emergencySystem.on('bettingPaused', (data) => {
      this.handleBettingPaused(data);
    });

    this.logger.info('Event handlers configured');
  }

  // ========================================
  // Dashboard Data Updates
  // ========================================

  public startDashboard(): void {
    // Update dashboard data every 15 seconds
    this.updateInterval = setInterval(() => {
      this.updateAllData();
      this.broadcastUpdate();
    }, 15000);

    // Initial data load
    this.updateAllData();

    this.logger.info('Dashboard started', {
      updateInterval: 15000,
      connectedClients: this.connectedClients.size
    });
  }

  private async updateAllData(): Promise<void> {
    try {
      // Update system status
      await this.updateSystemStatus();

      // Update performance data
      const performanceMetrics = this.performanceTracker.getCurrentMetrics();
      this.updatePerformanceData(performanceMetrics);

      // Update financial data
      const financialMetrics = this.financialReports.getFinancialSummary();
      this.updateFinancialData({ realTimePnL: financialMetrics });

      // Update risk data
      const riskSummary = this.riskMonitor.getRiskSummary();
      this.updateRiskData(riskSummary);

      // Update charts
      await this.updateChartData();

      // Update phase progress
      this.updatePhaseProgress();

      // Update timestamp
      this.dashboardData.systemStatus.lastUpdate = new Date().toISOString();

    } catch (error) {
      this.logger.error('Failed to update dashboard data', {
        error: error.message
      });
    }
  }

  private async updateSystemStatus(): Promise<void> {
    const emergencyStatus = this.emergencySystem.getSystemStatus();
    const performanceSummary = this.performanceTracker.getPerformanceSummary();

    this.dashboardData.systemStatus = {
      isRunning: !emergencyStatus.emergencyMode && !emergencyStatus.bettingPaused,
      currentPhase: this.config.currentPhase,
      uptime: Date.now() - Date.parse(this.dashboardData.systemStatus.lastUpdate || new Date().toISOString()),
      lastUpdate: new Date().toISOString(),
      healthStatus: this.determineHealthStatus(emergencyStatus, performanceSummary),
      activeAlerts: emergencyStatus.unresolvedEventsCount + this.alertHistory.filter(a => !a.acknowledged).length
    };
  }

  private determineHealthStatus(emergencyStatus: any, performanceSummary: any): 'HEALTHY' | 'WARNING' | 'CRITICAL' {
    if (emergencyStatus.emergencyMode) return 'CRITICAL';
    if (emergencyStatus.bettingPaused) return 'WARNING';
    if (!performanceSummary.isPerformingWell) return 'WARNING';
    return 'HEALTHY';
  }

  private updatePerformanceData(metrics: LiveMetrics): void {
    this.dashboardData.performance = {
      totalBets: metrics.totalBets,
      winRate: metrics.currentWinRate,
      roi: metrics.currentROI,
      clv: metrics.currentCLV,
      sharpeRatio: metrics.sharpeRatio,
      maxDrawdown: metrics.maxDrawdown,
      currentStreak: Math.max(metrics.winStreak, metrics.lossStreak),
      streakType: metrics.winStreak > metrics.lossStreak ? 'WIN' :
                 metrics.lossStreak > metrics.winStreak ? 'LOSS' : 'NONE'
    };

    // Update performance history chart
    this.addToChart('winRateHistory', {
      timestamp: new Date().toISOString(),
      value: metrics.currentWinRate
    });

    this.addToChart('clvHistory', {
      timestamp: new Date().toISOString(),
      value: metrics.currentCLV
    });
  }

  private updateFinancialData(metrics: any): void {
    const financial = metrics.realTimePnL;

    this.dashboardData.financial = {
      totalPnL: financial.totalPnL,
      dailyPnL: financial.dailyPnL,
      weeklyPnL: financial.weeklyPnL,
      monthlyPnL: financial.monthlyPnL,
      totalStaked: this.performanceTracker.getCurrentMetrics().totalStaked,
      avgBetSize: this.performanceTracker.getCurrentMetrics().avgBetSize,
      transactionCosts: 0, // Would come from transaction cost analysis
      netROI: financial.roi
    };

    // Update P&L history chart
    this.addToChart('pnlHistory', {
      timestamp: new Date().toISOString(),
      value: financial.totalPnL
    });
  }

  private updateRiskData(riskSummary: any): void {
    this.dashboardData.risk = {
      overallRiskLevel: riskSummary.overallRiskLevel,
      portfolioUtilization: riskSummary.keyMetrics.utilizationRate,
      dailyRiskUsed: 0, // Would need to calculate from daily bets
      dailyRiskLimit: this.config.phases[this.config.currentPhase].maxDailyRisk,
      kellyCompliance: riskSummary.keyMetrics.kellyCompliance ? 100 : 0,
      correlationRisk: 0, // Would calculate from positions
      activePositions: this.performanceTracker.getCurrentMetrics().pending
    };

    // Update risk metrics chart
    this.addToChart('riskMetrics', {
      timestamp: new Date().toISOString(),
      value: riskSummary.keyMetrics.utilizationRate,
      category: riskSummary.overallRiskLevel
    });
  }

  private async updateChartData(): Promise<void> {
    try {
      // Update performance by phase
      const phasePerformance = await this.resultsStorage.getPerformanceByPhase();
      this.dashboardData.charts.performanceByPhase = phasePerformance.map(phase => ({
        phase: phase.phase,
        winRate: phase.winRate,
        roi: phase.roi,
        totalBets: phase.totalBets,
        netProfit: phase.netProfit
      }));

      // Update performance by sport
      const sportPerformance = await this.resultsStorage.getPerformanceBySport();
      this.dashboardData.charts.performanceBySport = sportPerformance.map(sport => ({
        sport: sport.sport,
        winRate: sport.winRate,
        roi: sport.roi,
        totalBets: sport.totalBets,
        netProfit: sport.netProfit,
        confidence: sport.confidence
      }));

    } catch (error) {
      this.logger.error('Failed to update chart data', {
        error: error.message
      });
    }
  }

  private updatePhaseProgress(): void {
    const currentPhaseConfig = this.config.phases[this.config.currentPhase];
    const performance = this.performanceTracker.getCurrentMetrics();
    const significance = this.performanceTracker.getStatisticalSignificance();

    this.dashboardData.phaseProgress = {
      currentPhase: this.config.currentPhase,
      betsCompleted: performance.totalBets,
      betsRequired: currentPhaseConfig.minBetsRequired,
      daysElapsed: Math.floor(this.dashboardData.systemStatus.uptime / (1000 * 60 * 60 * 24)),
      daysRequired: currentPhaseConfig.minTestingDays,
      successCriteria: {
        winRateTarget: performance.currentWinRate >= 0.55,
        clvTarget: performance.currentCLV >= 0.6,
        systemReliability: this.dashboardData.systemStatus.healthStatus === 'HEALTHY',
        riskManagement: this.dashboardData.risk.overallRiskLevel !== 'CRITICAL'
      }
    };
  }

  // ========================================
  // Event Handlers
  // ========================================

  private handleRiskAlert(alert: any): void {
    const alertData: AlertData = {
      id: `alert_${Date.now()}`,
      type: 'RISK',
      severity: alert.severity,
      message: alert.message,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      source: 'RiskMonitor'
    };

    this.alertHistory.push(alertData);
    this.dashboardData.alerts.unshift(alertData);

    // Keep only last 50 alerts in dashboard
    if (this.dashboardData.alerts.length > 50) {
      this.dashboardData.alerts = this.dashboardData.alerts.slice(0, 50);
    }

    this.addRecentActivity(`Risk Alert: ${alert.message}`);
    this.emit('alert', alertData);
  }

  private handleEmergencyTrigger(trigger: any): void {
    const alertData: AlertData = {
      id: `emergency_${Date.now()}`,
      type: 'EMERGENCY',
      severity: 'CRITICAL',
      message: `Emergency trigger: ${trigger.type}`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      source: 'EmergencySystem'
    };

    this.alertHistory.push(alertData);
    this.dashboardData.alerts.unshift(alertData);
    this.addRecentActivity(`EMERGENCY: ${trigger.type} activated`);

    this.emit('emergencyAlert', alertData);
  }

  private handleEmergencyStop(data: any): void {
    this.dashboardData.systemStatus.isRunning = false;
    this.dashboardData.systemStatus.healthStatus = 'CRITICAL';
    this.addRecentActivity(`EMERGENCY STOP: ${data.reason}`);
  }

  private handleBettingPaused(data: any): void {
    this.dashboardData.systemStatus.isRunning = false;
    this.dashboardData.systemStatus.healthStatus = 'WARNING';
    this.addRecentActivity(`Betting paused: ${data.reason}`);
  }

  // ========================================
  // Helper Methods
  // ========================================

  private addToChart(chartName: keyof ChartData, dataPoint: any): void {
    const chart = this.dashboardData.charts[chartName] as any[];
    chart.push(dataPoint);

    // Keep only last 100 data points
    if (chart.length > 100) {
      this.dashboardData.charts[chartName] = chart.slice(-100) as any;
    }
  }

  private addRecentActivity(activity: string): void {
    this.dashboardData.recentActivity.unshift({
      timestamp: new Date().toISOString(),
      message: activity
    });

    // Keep only last 20 activities
    if (this.dashboardData.recentActivity.length > 20) {
      this.dashboardData.recentActivity = this.dashboardData.recentActivity.slice(0, 20);
    }
  }

  // ========================================
  // Client Management
  // ========================================

  public addClient(clientId: string): void {
    this.connectedClients.add(clientId);
    this.logger.debug('Client connected', {
      clientId,
      totalClients: this.connectedClients.size
    });

    // Send initial data to new client
    this.emit('clientConnected', {
      clientId,
      initialData: this.dashboardData
    });
  }

  public removeClient(clientId: string): void {
    this.connectedClients.delete(clientId);
    this.logger.debug('Client disconnected', {
      clientId,
      totalClients: this.connectedClients.size
    });
  }

  private broadcastUpdate(): void {
    if (this.connectedClients.size > 0) {
      this.emit('dashboardUpdate', {
        data: this.dashboardData,
        timestamp: new Date().toISOString(),
        clients: Array.from(this.connectedClients)
      });
    }
  }

  // ========================================
  // Public API Methods
  // ========================================

  public getDashboardData(): DashboardData {
    return { ...this.dashboardData };
  }

  public getSystemStatus(): SystemStatus {
    return { ...this.dashboardData.systemStatus };
  }

  public getAlerts(acknowledgedOnly = false): AlertData[] {
    return this.alertHistory.filter(alert =>
      acknowledgedOnly ? alert.acknowledged : true
    );
  }

  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date().toISOString();

      // Update dashboard alerts
      const dashboardAlert = this.dashboardData.alerts.find(a => a.id === alertId);
      if (dashboardAlert) {
        dashboardAlert.acknowledged = true;
        dashboardAlert.acknowledgedAt = new Date().toISOString();
      }

      this.emit('alertAcknowledged', alert);
      return true;
    }
    return false;
  }

  public exportDashboardData(format: 'json' | 'csv' = 'json'): string {
    const exportData = {
      exportTime: new Date().toISOString(),
      systemStatus: this.dashboardData.systemStatus,
      performance: this.dashboardData.performance,
      financial: this.dashboardData.financial,
      risk: this.dashboardData.risk,
      phaseProgress: this.dashboardData.phaseProgress,
      alerts: this.getAlerts(),
      recentActivity: this.dashboardData.recentActivity,
      charts: this.dashboardData.charts
    };

    if (format === 'csv') {
      return this.convertDashboardDataToCSV(exportData);
    }

    return JSON.stringify(exportData, null, 2);
  }

  private convertDashboardDataToCSV(data: any): string {
    const sections = [];

    // System status
    sections.push('SYSTEM STATUS');
    sections.push('Metric,Value');
    sections.push(`Running,${data.systemStatus.isRunning}`);
    sections.push(`Phase,${data.systemStatus.currentPhase}`);
    sections.push(`Health,${data.systemStatus.healthStatus}`);
    sections.push(`Active Alerts,${data.systemStatus.activeAlerts}`);

    // Performance metrics
    sections.push('\n\nPERFORMANCE METRICS');
    sections.push('Metric,Value');
    sections.push(`Total Bets,${data.performance.totalBets}`);
    sections.push(`Win Rate,${(data.performance.winRate * 100).toFixed(2)}%`);
    sections.push(`ROI,${(data.performance.roi * 100).toFixed(2)}%`);
    sections.push(`CLV,${(data.performance.clv * 100).toFixed(2)}%`);
    sections.push(`Sharpe Ratio,${data.performance.sharpeRatio.toFixed(2)}`);

    // Financial metrics
    sections.push('\n\nFINANCIAL METRICS');
    sections.push('Metric,Value');
    sections.push(`Total P&L,$${data.financial.totalPnL.toFixed(2)}`);
    sections.push(`Daily P&L,$${data.financial.dailyPnL.toFixed(2)}`);
    sections.push(`Total Staked,$${data.financial.totalStaked.toFixed(2)}`);
    sections.push(`Average Bet Size,$${data.financial.avgBetSize.toFixed(2)}`);

    return sections.join('\n');
  }

  public generateDashboardReport(): {
    summary: string;
    recommendations: string[];
    alerts: AlertData[];
    keyMetrics: any;
  } {
    const performance = this.dashboardData.performance;
    const financial = this.dashboardData.financial;
    const risk = this.dashboardData.risk;
    const progress = this.dashboardData.phaseProgress;

    const summary = `
Live Testing Dashboard Report - ${new Date().toISOString()}

Current Phase: ${progress.currentPhase}
System Status: ${this.dashboardData.systemStatus.healthStatus}

Performance Summary:
- Total Bets: ${performance.totalBets}
- Win Rate: ${(performance.winRate * 100).toFixed(1)}% (Target: 55%+)
- ROI: ${(performance.roi * 100).toFixed(1)}%
- CLV: ${(performance.clv * 100).toFixed(1)}% (Target: 60%+)

Financial Summary:
- Total P&L: $${financial.totalPnL.toFixed(2)}
- Total Staked: $${financial.totalStaked.toFixed(2)}
- Net ROI: ${(financial.netROI * 100).toFixed(1)}%

Risk Summary:
- Risk Level: ${risk.overallRiskLevel}
- Portfolio Utilization: ${(risk.portfolioUtilization * 100).toFixed(1)}%
- Kelly Compliance: ${risk.kellyCompliance}%

Phase Progress:
- Bets: ${progress.betsCompleted}/${progress.betsRequired}
- Days: ${progress.daysElapsed}/${progress.daysRequired}
- Criteria Met: ${Object.values(progress.successCriteria).filter(Boolean).length}/4
    `.trim();

    const recommendations: string[] = [];

    // Generate recommendations based on current status
    if (performance.winRate < 0.55) {
      recommendations.push('Win rate below target - review bet selection criteria');
    }
    if (performance.clv < 0.6) {
      recommendations.push('CLV below target - improve line shopping and timing');
    }
    if (risk.overallRiskLevel !== 'LOW') {
      recommendations.push('Risk level elevated - consider reducing position sizes');
    }
    if (financial.netROI < 0) {
      recommendations.push('Negative ROI - review strategy and risk management');
    }

    return {
      summary,
      recommendations,
      alerts: this.getAlerts().slice(0, 10), // Last 10 alerts
      keyMetrics: {
        performance,
        financial,
        risk,
        progress
      }
    };
  }

  // ========================================
  // Cleanup
  // ========================================

  public stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.connectedClients.clear();
    this.logger.info('Dashboard stopped');
  }
}

// ========================================
// Supporting Interfaces
// ========================================

interface DashboardData {
  systemStatus: SystemStatus;
  performance: PerformanceData;
  financial: FinancialData;
  risk: RiskData;
  charts: ChartData;
  recentActivity: ActivityItem[];
  alerts: AlertData[];
  phaseProgress: PhaseProgressData;
}

interface SystemStatus {
  isRunning: boolean;
  currentPhase: string;
  uptime: number;
  lastUpdate: string;
  healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  activeAlerts: number;
}

interface PerformanceData {
  totalBets: number;
  winRate: number;
  roi: number;
  clv: number;
  sharpeRatio: number;
  maxDrawdown: number;
  currentStreak: number;
  streakType: 'WIN' | 'LOSS' | 'NONE';
}

interface FinancialData {
  totalPnL: number;
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  totalStaked: number;
  avgBetSize: number;
  transactionCosts: number;
  netROI: number;
}

interface RiskData {
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  portfolioUtilization: number;
  dailyRiskUsed: number;
  dailyRiskLimit: number;
  kellyCompliance: number;
  correlationRisk: number;
  activePositions: number;
}

interface ChartData {
  pnlHistory: Array<{ timestamp: string; value: number }>;
  winRateHistory: Array<{ timestamp: string; value: number }>;
  clvHistory: Array<{ timestamp: string; value: number }>;
  riskMetrics: Array<{ timestamp: string; value: number; category: string }>;
  performanceByPhase: Array<{ phase: string; winRate: number; roi: number; totalBets: number; netProfit: number }>;
  performanceBySport: Array<{ sport: string; winRate: number; roi: number; totalBets: number; netProfit: number; confidence: number }>;
}

interface ActivityItem {
  timestamp: string;
  message: string;
}

interface AlertData {
  id: string;
  type: 'RISK' | 'PERFORMANCE' | 'EMERGENCY' | 'SYSTEM';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  source: string;
}

interface PhaseProgressData {
  currentPhase: string;
  betsCompleted: number;
  betsRequired: number;
  daysElapsed: number;
  daysRequired: number;
  successCriteria: {
    winRateTarget: boolean;
    clvTarget: boolean;
    systemReliability: boolean;
    riskManagement: boolean;
  };
}

export { DashboardData, SystemStatus, AlertData, ChartData };