import { PortfolioPositionType as PortfolioPosition, PredictionResult, SystemStatus } from '../types';
import { RiskMetrics } from '../types/risk';
export declare class SystemOrchestrator {
    private logger;
    private monitoring;
    private mlPipeline;
    private riskManager;
    private systemStatus;
    constructor();
    private initializeSystem;
    evaluatePosition(position: PortfolioPosition): Promise<{
        prediction: PredictionResult;
        risk: RiskMetrics;
        recommendation: string;
    }>;
    getSystemHealth(): Promise<SystemStatus>;
    private determineOverallStatus;
    private generateRecommendation;
    private initializeMonitoring;
    private initializeML;
    private initializeRisk;
}
//# sourceMappingURL=orchestrator.d.ts.map