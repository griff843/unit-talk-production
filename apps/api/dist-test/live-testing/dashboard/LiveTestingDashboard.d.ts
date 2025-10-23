/**
 * Phase 9: Live Testing Dashboard
 *
 * Real-time dashboard interface for monitoring live testing performance,
 * risk metrics, financial reports, and system health.
 */
import { EventEmitter } from 'events';
import { LivePerformanceTracker } from '../performance/LivePerformanceTracker';
import { LiveRiskMonitor } from '../risk/LiveRiskMonitor';
import { FinancialReportsSystem } from '../financial/FinancialReportsSystem';
import { EmergencySystem } from '../emergency/EmergencySystem';
import { LiveResultsStorage } from '../storage/LiveResultsStorage';
import { LiveTestingConfig, DashboardData, AlertData, ChartData, SystemStatus } from '../types';
export declare class LiveTestingDashboard extends EventEmitter {
    private logger;
    private performanceTracker;
    private riskMonitor;
    private financialReports;
    private emergencySystem;
    private resultsStorage;
    private config;
    private dashboardData;
    private updateInterval;
    private alertHistory;
    private connectedClients;
    constructor(config: LiveTestingConfig, performanceTracker: LivePerformanceTracker, riskMonitor: LiveRiskMonitor, financialReports: FinancialReportsSystem, emergencySystem: EmergencySystem, resultsStorage: LiveResultsStorage);
    private initializeDashboard;
    private setupEventHandlers;
    startDashboard(): void;
    private updateAllData;
    private updateSystemStatus;
    private determineHealthStatus;
    private updatePerformanceData;
    private updateFinancialData;
    private updateRiskData;
    private updateChartData;
    private updatePhaseProgress;
    private handleRiskAlert;
    private handleEmergencyTrigger;
    private handleEmergencyStop;
    private handleBettingPaused;
    private addToChart;
    private addRecentActivity;
    addClient(clientId: string): void;
    removeClient(clientId: string): void;
    private broadcastUpdate;
    getDashboardData(): DashboardData;
    getSystemStatus(): SystemStatus;
    getAlerts(acknowledgedOnly?: boolean): AlertData[];
    acknowledgeAlert(alertId: string): boolean;
    exportDashboardData(format?: 'json' | 'csv'): string;
    private convertDashboardDataToCSV;
    generateDashboardReport(): {
        summary: string;
        recommendations: string[];
        alerts: AlertData[];
        keyMetrics: any;
    };
    stop(): void;
}
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
    pnlHistory: Array<{
        timestamp: string;
        value: number;
    }>;
    winRateHistory: Array<{
        timestamp: string;
        value: number;
    }>;
    clvHistory: Array<{
        timestamp: string;
        value: number;
    }>;
    riskMetrics: Array<{
        timestamp: string;
        value: number;
        category: string;
    }>;
    performanceByPhase: Array<{
        phase: string;
        winRate: number;
        roi: number;
        totalBets: number;
        netProfit: number;
    }>;
    performanceBySport: Array<{
        sport: string;
        winRate: number;
        roi: number;
        totalBets: number;
        netProfit: number;
        confidence: number;
    }>;
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
//# sourceMappingURL=LiveTestingDashboard.d.ts.map