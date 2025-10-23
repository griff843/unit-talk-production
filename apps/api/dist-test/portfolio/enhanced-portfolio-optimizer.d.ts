import { PortfolioConfig, PortfolioPosition, OptimizationResult } from '../types/portfolio';
export declare class EnhancedPortfolioOptimizer {
    private logger;
    private monitoring;
    private config;
    private positions;
    private optimizationHistory;
    constructor(config: PortfolioConfig);
    private initializeOptimizer;
    addPosition(position: PortfolioPosition): Promise<void>;
    removePosition(positionId: string): Promise<void>;
    optimizePortfolio(): Promise<OptimizationResult>;
    private calculatePortfolioMetrics;
    private calculateDiversification;
    private calculateCorrelations;
    private calculatePositionCorrelation;
    private calculateSectorExposure;
    private calculateSportExposure;
    private applyOptimizationStrategy;
    private determineOptimizationStrategy;
    private applyRiskParityOptimization;
    private applyMeanVarianceOptimization;
    private applyKellyCriterionOptimization;
    private applyBlackLittermanOptimization;
    private applyConservativeOptimization;
    private getMarketView;
    private updatePositions;
    private rebalancePortfolio;
    private executeRebalancing;
    private executeTrade;
    private monitorPortfolioPerformance;
    private reportOptimizationMetrics;
    private validatePosition;
    private checkPortfolioConstraints;
    private getTotalValue;
    getPortfolioSummary(): Promise<any>;
}
//# sourceMappingURL=enhanced-portfolio-optimizer.d.ts.map