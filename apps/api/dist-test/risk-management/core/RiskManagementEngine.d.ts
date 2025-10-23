/**
 * Risk Management Engine
 *
 * Central orchestrator for all risk management functions in the Unit Talk platform.
 * Integrates Kelly sizing, correlation analysis, portfolio optimization, and automated controls.
 */
import { RiskProfile, Position, PortfolioRisk, RiskAlert, KellyResult, RiskMetrics, OptimizationResult, RiskManagementConfig, RiskControlAction, PositionRisk } from '../types';
export interface PropRiskAssessment {
    propId: string;
    overallRisk: number;
    riskBreakdown: PositionRisk;
    riskFactors: string[];
    kellyResult: KellyResult;
    recommendation: 'APPROVE' | 'REDUCE' | 'REJECT';
    suggestedStake: number;
    maxStake: number;
    warnings: string[];
    correlationRisk: number;
    portfolioImpact: number;
}
export declare class RiskManagementEngine {
    private logger;
    private kellySizing;
    private correlationManager;
    private portfolioOptimizer;
    private automatedControls;
    private metricsCalculator;
    private riskProfile;
    private positions;
    private activeAlerts;
    constructor(config: RiskManagementConfig, riskProfile: RiskProfile);
    /**
     * Comprehensive risk assessment for a single prop
     */
    assessPropRisk(prop: {
        propId: string;
        sport: string;
        player: string;
        marketType: string;
        odds: number;
        line?: number;
        expectedValue: number;
        confidence: number;
        winProbability: number;
        gameId?: string;
        gameTime: string;
    }): Promise<PropRiskAssessment>;
    /**
     * Add position to portfolio and update risk metrics
     */
    addPosition(position: Position): Promise<void>;
    /**
     * Remove position from portfolio
     */
    removePosition(positionId: string): Promise<void>;
    /**
     * Get comprehensive portfolio risk analysis
     */
    getPortfolioRisk(): Promise<PortfolioRisk>;
    /**
     * Get all active risk alerts
     */
    getActiveAlerts(): RiskAlert[];
    /**
     * Optimize portfolio for better risk-adjusted returns
     */
    optimizePortfolio(objective?: 'SHARPE' | 'RETURN' | 'RISK' | 'KELLY'): Promise<OptimizationResult>;
    /**
     * Execute risk control action
     */
    executeRiskControl(action: RiskControlAction): Promise<void>;
    /**
     * Update risk profile
     */
    updateRiskProfile(newProfile: Partial<RiskProfile>): void;
    /**
     * Get current risk profile
     */
    getRiskProfile(): RiskProfile;
    /**
     * Get all positions
     */
    getPositions(): Position[];
    /**
     * Get risk metrics for portfolio
     */
    getRiskMetrics(): Promise<RiskMetrics>;
    private calculatePositionRisk;
    private calculateIndividualRisk;
    private assessLiquidityRisk;
    private assessTimingRisk;
    private calculatePositionConcentrationRisk;
    private assessPortfolioImpact;
    private applyRiskLimits;
    private identifyRiskFactors;
    private calculateOverallRisk;
    private createFallbackAssessment;
    private checkRiskAlerts;
    private getSportExposure;
    private getPlayerExposure;
    private getGameExposure;
    private calculateHoursToGame;
    private calculateTotalExposure;
    private calculateTotalRisk;
    private calculateDiversificationRatio;
    private calculateExposureBreakdown;
    private calculateConcentrationRisk;
    private calculateHerfindahlIndex;
    private calculateConcentrationFactor;
    private calculatePerformanceMetrics;
    private createEmptyPortfolioRisk;
}
//# sourceMappingURL=RiskManagementEngine.d.ts.map