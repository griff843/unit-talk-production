/**
 * Syndicate Master Controller
 * Phase 10: Complete Syndicate-Level Betting Intelligence System
 *
 * Orchestrates all syndicate components for professional-grade betting operations
 * Manages 1000+ daily props with 55%+ win rate and 5-8% monthly ROI
 * Provides Fortune 100-grade infrastructure and monitoring
 */
import { EventEmitter } from 'events';
interface SyndicateSystemStatus {
    operational: boolean;
    components: {
        scaling: 'HEALTHY' | 'DEGRADED' | 'FAILED';
        monitoring: 'HEALTHY' | 'DEGRADED' | 'FAILED';
        analytics: 'HEALTHY' | 'DEGRADED' | 'FAILED';
        operations: 'HEALTHY' | 'DEGRADED' | 'FAILED';
    };
    performance: {
        dailyPropsProcessed: number;
        currentWinRate: number;
        monthlyROI: number;
        systemUptime: number;
    };
    alerts: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
}
interface SyndicateMetrics {
    business: {
        totalPicks: number;
        winRate: number;
        monthlyROI: number;
        totalPnL: number;
        averageStake: number;
    };
    performance: {
        avgProcessingTime: number;
        peakThroughput: number;
        systemUptime: number;
        errorRate: number;
    };
    risk: {
        maxDrawdown: number;
        valueAtRisk: number;
        portfolioExposure: number;
        correlationRisk: number;
    };
}
export declare class SyndicateController extends EventEmitter {
    private config;
    private scalingEngine;
    private monitoringSystem;
    private analyticsDashboard;
    private operationsCenter;
    private redis;
    private dbPool;
    private isInitialized;
    private systemStatus;
    private statusUpdateInterval;
    constructor(config: SyndicateConfig);
    /**
     * Initialize complete syndicate system
     */
    private initializeSyndicateSystem;
    /**
     * Initialize core infrastructure components
     */
    private initializeInfrastructure;
    /**
     * Initialize all syndicate components
     */
    private initializeComponents;
    /**
     * Setup communication between components
     */
    private setupComponentCommunication;
    /**
     * Start comprehensive system monitoring
     */
    private startSystemMonitoring;
    /**
     * Process high-volume prop batch through syndicate system
     */
    processSyndicateBatch(props: any[]): Promise<{
        batchId: string;
        processed: number;
        successful: number;
        failed: number;
        performance: {
            avgProcessingTime: number;
            peakThroughput: number;
        };
        businessMetrics: {
            estimatedProfitability: number;
            riskScore: number;
            qualityScore: number;
        };
    }>;
    /**
     * Get comprehensive syndicate system status
     */
    getSystemStatus(): Promise<SyndicateSystemStatus>;
    /**
     * Get detailed syndicate metrics
     */
    getSyndicateMetrics(): Promise<SyndicateMetrics>;
    /**
     * Generate executive report
     */
    generateExecutiveReport(format?: 'PDF' | 'EXCEL' | 'JSON'): Promise<any>;
    /**
     * Execute operational procedure
     */
    executeOperationalProcedure(procedureId: string, parameters?: Record<string, any>): Promise<any>;
    /**
     * Activate disaster recovery
     */
    activateDisasterRecovery(scenarioId: string): Promise<void>;
    /**
     * Update system status from all components
     */
    private updateSystemStatus;
    private checkComponentHealth;
    private getPerformanceMetrics;
    private getAlertCounts;
    private calculateBatchBusinessMetrics;
    private calculateBatchRiskScore;
    private calculateCorrelationRisk;
    private calculateConcentrationRisk;
    private calculateLiquidityRisk;
    private updateAnalyticsWithBatch;
    private storeBatchResults;
    private calculateBusinessMetrics;
    private calculatePerformanceMetrics;
    private calculateRiskMetrics;
    /**
     * Graceful shutdown of entire syndicate system
     */
    shutdown(): Promise<void>;
}
export declare const ProductionSyndicateConfig: SyndicateConfig;
export declare const syndicateSystem: SyndicateController;
export {};
//# sourceMappingURL=SyndicateController.d.ts.map