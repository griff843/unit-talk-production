/**
 * Portfolio Optimizer
 *
 * Professional-grade portfolio optimization engine implementing Kelly-Markowitz hybrid approach.
 * Combines Kelly criterion optimal sizing with modern portfolio theory for risk-adjusted
 * portfolio construction and rebalancing.
 */
import { Position, RiskProfile, PortfolioConfig, OptimizationResult, RebalanceAction, OptimizationConstraints } from '../types';
export interface OptimizationInput {
    positions: Position[];
    targetFunction: 'SHARPE' | 'RETURN' | 'RISK' | 'KELLY';
    constraints: OptimizationConstraints;
    riskBudget: number;
    timeHorizon: number;
}
export interface MarkowitzInput {
    expectedReturns: number[];
    covarianceMatrix: number[][];
    riskAversion: number;
}
export interface KellyInput {
    winProbabilities: number[];
    odds: number[];
    correlations: number[][];
    bankroll: number;
}
export declare class PortfolioOptimizer {
    private logger;
    private config;
    private riskProfile;
    private optimizationCache;
    private readonly CACHE_TTL;
    private optimizationStats;
    constructor(config: PortfolioConfig, riskProfile: RiskProfile);
    /**
     * Optimize portfolio using specified objective
     */
    optimize(positions: Position[], targetFunction?: 'SHARPE' | 'RETURN' | 'RISK' | 'KELLY'): Promise<OptimizationResult>;
    /**
     * Calculate optimal Kelly weights for portfolio
     */
    calculateKellyOptimalWeights(positions: Position[]): Promise<number[]>;
    /**
     * Calculate Markowitz optimal weights
     */
    calculateMarkowitzWeights(positions: Position[]): Promise<number[]>;
    /**
     * Generate rebalancing recommendations
     */
    generateRebalancingRecommendations(positions: Position[], targetWeights: number[]): Promise<RebalanceAction[]>;
    /**
     * Run optimization based on target function
     */
    private runOptimization;
    /**
     * Kelly criterion optimization
     */
    private optimizeKelly;
    /**
     * Sharpe ratio optimization
     */
    private optimizeSharpe;
    /**
     * Return optimization
     */
    private optimizeReturn;
    /**
     * Risk minimization optimization
     */
    private optimizeRisk;
    /**
     * Solve Kelly optimization for correlated bets
     */
    private solveKellyOptimization;
    /**
     * Solve Markowitz optimization
     */
    private solveMarkowitzOptimization;
    /**
     * Combine Kelly and Markowitz weights
     */
    private combineKellyMarkowitz;
    /**
     * Construct optimized portfolio from weights
     */
    private constructOptimizedPortfolio;
    private validateOptimizationInput;
    private createOptimizationConstraints;
    private calculateCurrentPortfolio;
    private calculateImprovements;
    private generateRebalanceActions;
    private estimateRebalancingCost;
    private validateOptimizationResult;
    private extractKellyParameters;
    private extractMarkowitzParameters;
    private calculateExpectedReturns;
    private buildSimpleCorrelationMatrix;
    private buildCovarianceMatrix;
    private calculateCorrelationAdjustment;
    private oddsToNetPayoff;
    private oddsToWinProbability;
    private generateOptimizationReason;
    private calculateOptimizedPortfolioMetrics;
    private calculatePortfolioRisk;
    private calculateSharpeRatio;
    private calculateDiversificationRatio;
    private getOptimizationMethodology;
    private generateCacheKey;
    private updateOptimizationStats;
    private createFallbackOptimization;
    /**
     * Update risk profile
     */
    updateRiskProfile(newProfile: RiskProfile): void;
    /**
     * Get optimization statistics
     */
    getOptimizationStatistics(): any;
}
//# sourceMappingURL=PortfolioOptimizer.d.ts.map