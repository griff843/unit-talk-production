/**
 * Phase 9: Live Risk Monitor
 *
 * Real-time risk monitoring with Kelly sizing validation, portfolio risk management,
 * and emergency controls for live testing validation.
 */
import { EventEmitter } from 'events';
import { LiveRiskMonitor as ILiveRiskMonitor, RealTimeRisk, PortfolioRisk, KellyMonitor, EmergencyTrigger, LiveBet, LiveTestingConfig } from '../types';
import { ProfessionalFeaturesResult } from '../../professional/types';
export declare class LiveRiskMonitor extends EventEmitter implements ILiveRiskMonitor {
    private logger;
    realTimeRisk: RealTimeRisk;
    portfolioRisk: PortfolioRisk;
    kellyMonitoring: KellyMonitor;
    emergencyTriggers: EmergencyTrigger[];
    private config;
    private activeBets;
    private dailyStats;
    private monitoringInterval;
    private riskAlerts;
    constructor(config: LiveTestingConfig);
    private initializeRiskMetrics;
    private startRiskMonitoring;
    assessBetRisk(bet: LiveBet, professionalFeatures: ProfessionalFeaturesResult): {
        approved: boolean;
        riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        reasons: string[];
        kellyCompliant: boolean;
        recommendedStake?: number;
    };
    trackBet(bet: LiveBet): void;
    updateBetStatus(betId: string, status: string, pnl?: number): void;
    private validateKellySizing;
    private assessCorrelationRisk;
    private assessConcentrationRisk;
    private calculateOverallRiskLevel;
    private updateRiskMetrics;
    private updateRealTimeRisk;
    private updatePortfolioRisk;
    private updateKellyMonitoring;
    private checkRiskLimits;
    private updateEmergencyTriggers;
    private triggerEmergencyStop;
    private getDailyStats;
    private getGameKey;
    private getPlayerKey;
    private calculatePortfolioCorrelation;
    private determineOverallRiskLevel;
    private calculateDrawdown;
    private calculateSportDiversification;
    private calculateMarketDiversification;
    private calculateTemporalDiversification;
    getRiskSummary(): {
        overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        keyMetrics: {
            utilizationRate: number;
            currentDrawdown: number;
            kellyCompliance: number;
            activeAlerts: number;
        };
        recommendations: string[];
    };
    acknowledgeAlert(alertId: string): void;
    getEmergencyStatus(): {
        anyTriggered: boolean;
        triggers: EmergencyTrigger[];
        lastTrigger?: EmergencyTrigger;
    };
    stop(): void;
}
//# sourceMappingURL=LiveRiskMonitor.d.ts.map