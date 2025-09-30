/**
 * Portfolio Optimizer
 *
 * Professional-grade portfolio optimization engine implementing Kelly-Markowitz hybrid approach.
 * Combines Kelly criterion optimal sizing with modern portfolio theory for risk-adjusted
 * portfolio construction and rebalancing.
 */

import { createLogger } from '../../utils/logger';
import {
  Position,
  RiskProfile,
  PortfolioConfig,
  OptimizationResult,
  OptimizedPortfolio,
  OptimizedPosition,
  RebalanceAction,
  ValidationResult,
  OptimizationConstraints
} from '../types';

export interface OptimizationInput {
  positions: Position[];
  targetFunction: 'SHARPE' | 'RETURN' | 'RISK' | 'KELLY';
  constraints: OptimizationConstraints;
  riskBudget: number;
  timeHorizon: number; // Days
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

export class PortfolioOptimizer {
  private logger = createLogger('PortfolioOptimizer');
  private config: PortfolioConfig;
  private riskProfile: RiskProfile;

  // Optimization cache and statistics
  private optimizationCache = new Map<string, { result: OptimizationResult; timestamp: number }>();
  private readonly CACHE_TTL = 600000; // 10 minutes

  // Optimization statistics
  private optimizationStats = {
    totalOptimizations: 0,
    avgImprovementSharpe: 0,
    avgImprovementReturn: 0,
    avgRiskReduction: 0,
    successRate: 0
  };

  constructor(config: PortfolioConfig, riskProfile: RiskProfile) {
    this.config = config;
    this.riskProfile = riskProfile;

    this.logger.info('Portfolio Optimizer initialized', {
      optimizationTarget: config.optimizationTarget,
      maxPositions: config.maxPositions,
      rebalanceFrequency: config.rebalanceFrequency
    });
  }

  /**
   * Optimize portfolio using specified objective
   */
  async optimize(
    positions: Position[],
    targetFunction: 'SHARPE' | 'RETURN' | 'RISK' | 'KELLY' = 'SHARPE'
  ): Promise<OptimizationResult> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(positions, targetFunction);
      const cached = this.optimizationCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        this.logger.debug('Returning cached optimization result', { cacheKey });
        return cached.result;
      }

      // Validate input
      const validation = this.validateOptimizationInput(positions);
      if (!validation.passed) {
        throw new Error(`Optimization validation failed: ${validation.message}`);
      }

      // Create optimization constraints
      const constraints = this.createOptimizationConstraints();

      // Calculate current portfolio metrics
      const currentPortfolio = await this.calculateCurrentPortfolio(positions);

      // Run optimization based on target function
      const optimizedPortfolio = await this.runOptimization({
        positions,
        targetFunction,
        constraints,
        riskBudget: this.riskProfile.bankroll * 0.15, // 15% risk budget
        timeHorizon: 30 // 30-day horizon
      });

      // Calculate improvements
      const improvements = this.calculateImprovements(currentPortfolio, optimizedPortfolio);

      // Generate rebalance actions
      const rebalanceActions = this.generateRebalanceActions(currentPortfolio, optimizedPortfolio);

      // Estimate rebalancing costs
      const estimatedCost = this.estimateRebalancingCost(rebalanceActions);

      // Validate optimization result
      const validationResults = await this.validateOptimizationResult(optimizedPortfolio, constraints);

      const result: OptimizationResult = {
        optimizationId: `opt-${Date.now()}`,
        targetFunction,
        currentPortfolio,
        optimizedPortfolio,
        riskReduction: improvements.riskReduction,
        returnImprovement: improvements.returnImprovement,
        sharpeImprovement: improvements.sharpeImprovement,
        rebalanceActions,
        estimatedCost,
        validationResults,
        optimizedAt: new Date().toISOString(),
        methodology: this.getOptimizationMethodology(targetFunction),
        constraints
      };

      // Cache result
      this.optimizationCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      // Update statistics
      this.updateOptimizationStats(result);

      this.logger.info('Portfolio optimization completed', {
        targetFunction,
        positionsCount: positions.length,
        sharpeImprovement: improvements.sharpeImprovement,
        riskReduction: improvements.riskReduction,
        rebalanceActions: rebalanceActions.length,
        processingTime: Date.now() - startTime
      });

      return result;

    } catch (error) {
      this.logger.error('Portfolio optimization failed', {
        targetFunction,
        positionsCount: positions.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return this.createFallbackOptimization(positions, targetFunction);
    }
  }

  /**
   * Calculate optimal Kelly weights for portfolio
   */
  async calculateKellyOptimalWeights(positions: Position[]): Promise<number[]> {
    if (positions.length === 0) return [];

    try {
      // Extract Kelly parameters
      const kellyInput = this.extractKellyParameters(positions);

      // Calculate optimal Kelly fractions for correlated bets
      const optimalFractions = await this.solveKellyOptimization(kellyInput);

      // Normalize to portfolio weights
      const totalFraction = optimalFractions.reduce((sum, frac) => sum + frac, 0);
      const weights = optimalFractions.map(frac => totalFraction > 0 ? frac / totalFraction : 0);

      return weights;

    } catch (error) {
      this.logger.error('Kelly weight calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Return equal weights as fallback
      return positions.map(() => 1 / positions.length);
    }
  }

  /**
   * Calculate Markowitz optimal weights
   */
  async calculateMarkowitzWeights(positions: Position[]): Promise<number[]> {
    if (positions.length === 0) return [];

    try {
      // Extract Markowitz parameters
      const markowitzInput = this.extractMarkowitzParameters(positions);

      // Solve quadratic optimization problem
      const optimalWeights = await this.solveMarkowitzOptimization(markowitzInput);

      return optimalWeights;

    } catch (error) {
      this.logger.error('Markowitz weight calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Return equal weights as fallback
      return positions.map(() => 1 / positions.length);
    }
  }

  /**
   * Generate rebalancing recommendations
   */
  async generateRebalancingRecommendations(
    positions: Position[],
    targetWeights: number[]
  ): Promise<RebalanceAction[]> {
    const actions: RebalanceAction[] = [];
    const totalValue = positions.reduce((sum, pos) => sum + pos.stake, 0);

    positions.forEach((position, index) => {
      const currentWeight = position.stake / totalValue;
      const targetWeight = targetWeights[index] || 0;
      const weightDifference = targetWeight - currentWeight;

      if (Math.abs(weightDifference) > 0.02) { // 2% threshold
        const targetStake = targetWeight * totalValue;
        const stakeChange = targetStake - position.stake;

        actions.push({
          positionId: position.id,
          action: stakeChange > 0 ? 'INCREASE' : 'DECREASE',
          currentStake: position.stake,
          newStake: targetStake,
          impact: Math.abs(stakeChange) / totalValue,
          priority: Math.abs(weightDifference) * 10 // Priority 1-10
        });
      }
    });

    return actions.sort((a, b) => b.priority - a.priority);
  }

  // ========================================
  // Private Optimization Methods
  // ========================================

  /**
   * Run optimization based on target function
   */
  private async runOptimization(input: OptimizationInput): Promise<OptimizedPortfolio> {
    switch (input.targetFunction) {
      case 'KELLY':
        return await this.optimizeKelly(input);
      case 'SHARPE':
        return await this.optimizeSharpe(input);
      case 'RETURN':
        return await this.optimizeReturn(input);
      case 'RISK':
        return await this.optimizeRisk(input);
      default:
        throw new Error(`Unsupported optimization target: ${input.targetFunction}`);
    }
  }

  /**
   * Kelly criterion optimization
   */
  private async optimizeKelly(input: OptimizationInput): Promise<OptimizedPortfolio> {
    const kellyWeights = await this.calculateKellyOptimalWeights(input.positions);
    return this.constructOptimizedPortfolio(input.positions, kellyWeights);
  }

  /**
   * Sharpe ratio optimization
   */
  private async optimizeSharpe(input: OptimizationInput): Promise<OptimizedPortfolio> {
    // Use Markowitz optimization with risk aversion parameter
    const markowitzWeights = await this.calculateMarkowitzWeights(input.positions);

    // Apply Kelly constraints to Markowitz weights
    const kellyWeights = await this.calculateKellyOptimalWeights(input.positions);
    const hybridWeights = this.combineKellyMarkowitz(kellyWeights, markowitzWeights, 0.7); // 70% Kelly, 30% Markowitz

    return this.constructOptimizedPortfolio(input.positions, hybridWeights);
  }

  /**
   * Return optimization
   */
  private async optimizeReturn(input: OptimizationInput): Promise<OptimizedPortfolio> {
    // Maximize expected return subject to risk constraints
    const expectedReturns = this.calculateExpectedReturns(input.positions);

    // Weight by expected return with risk penalties
    const weights = expectedReturns.map((ret, index) => {
      const position = input.positions[index];
      const riskPenalty = (position.riskMetrics?.individualRisk || 5) / 10;
      return Math.max(0, ret * (1 - riskPenalty));
    });

    // Normalize weights
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const normalizedWeights = weights.map(w => totalWeight > 0 ? w / totalWeight : 0);

    return this.constructOptimizedPortfolio(input.positions, normalizedWeights);
  }

  /**
   * Risk minimization optimization
   */
  private async optimizeRisk(input: OptimizationInput): Promise<OptimizedPortfolio> {
    // Minimize portfolio risk (variance)
    const riskScores = input.positions.map(pos => pos.riskMetrics?.individualRisk || 5);

    // Invert risk scores (lower risk = higher weight)
    const invertedRisk = riskScores.map(risk => Math.max(0.1, 10 - risk));

    // Normalize to weights
    const totalInvertedRisk = invertedRisk.reduce((sum, inv) => sum + inv, 0);
    const weights = invertedRisk.map(inv => totalInvertedRisk > 0 ? inv / totalInvertedRisk : 0);

    return this.constructOptimizedPortfolio(input.positions, weights);
  }

  /**
   * Solve Kelly optimization for correlated bets
   */
  private async solveKellyOptimization(input: KellyInput): Promise<number[]> {
    const n = input.winProbabilities.length;
    if (n === 0) return [];

    // For correlated Kelly, we need to solve: maximize sum(f_i * log(1 + f_i * b_i))
    // Subject to correlation constraints and fractional Kelly limits

    const optimalFractions: number[] = [];

    for (let i = 0; i < n; i++) {
      const p = input.winProbabilities[i];
      const b = this.oddsToNetPayoff(input.odds[i]);

      // Basic Kelly formula: f = (bp - q) / b
      let kelly = (b * p - (1 - p)) / b;

      // Apply fractional Kelly (25%)
      kelly *= 0.25;

      // Apply correlation adjustments
      const correlationAdjustment = this.calculateCorrelationAdjustment(i, input.correlations);
      kelly *= correlationAdjustment;

      // Ensure non-negative and within limits
      optimalFractions.push(Math.max(0, Math.min(0.05, kelly))); // Max 5% per bet
    }

    return optimalFractions;
  }

  /**
   * Solve Markowitz optimization
   */
  private async solveMarkowitzOptimization(input: MarkowitzInput): Promise<number[]> {
    const n = input.expectedReturns.length;
    if (n === 0) return [];

    // Simplified Markowitz: maximize return - (riskAversion/2) * variance
    // This is a quadratic programming problem, simplified here

    const weights: number[] = [];
    let totalWeight = 0;

    for (let i = 0; i < n; i++) {
      const expectedReturn = input.expectedReturns[i];
      const variance = input.covarianceMatrix[i][i] || 0.01;

      // Weight by risk-adjusted return
      const riskAdjustedReturn = expectedReturn - (input.riskAversion * variance / 2);
      const weight = Math.max(0, riskAdjustedReturn);

      weights.push(weight);
      totalWeight += weight;
    }

    // Normalize weights
    return weights.map(w => totalWeight > 0 ? w / totalWeight : 1 / n);
  }

  /**
   * Combine Kelly and Markowitz weights
   */
  private combineKellyMarkowitz(kellyWeights: number[], markowitzWeights: number[], kellyRatio: number): number[] {
    if (kellyWeights.length !== markowitzWeights.length) {
      return kellyWeights; // Fallback to Kelly if mismatch
    }

    return kellyWeights.map((kelly, index) => {
      const markowitz = markowitzWeights[index];
      return kelly * kellyRatio + markowitz * (1 - kellyRatio);
    });
  }

  /**
   * Construct optimized portfolio from weights
   */
  private constructOptimizedPortfolio(positions: Position[], weights: number[]): OptimizedPortfolio {
    const totalValue = positions.reduce((sum, pos) => sum + pos.stake, 0);

    const optimizedPositions: OptimizedPosition[] = positions.map((position, index) => {
      const currentWeight = position.stake / totalValue;
      const optimizedWeight = weights[index] || 0;
      const weightChange = optimizedWeight - currentWeight;

      const recommendedStake = optimizedWeight * totalValue;
      const stakeChange = recommendedStake - position.stake;

      return {
        positionId: position.id,
        currentWeight,
        optimizedWeight,
        weightChange,
        currentStake: position.stake,
        recommendedStake,
        stakeChange,
        reason: this.generateOptimizationReason(weightChange, position)
      };
    });

    // Calculate portfolio metrics
    const metrics = this.calculateOptimizedPortfolioMetrics(optimizedPositions, positions);

    return {
      positions: optimizedPositions,
      totalRisk: metrics.totalRisk,
      expectedReturn: metrics.expectedReturn,
      sharpeRatio: metrics.sharpeRatio,
      maxDrawdown: metrics.maxDrawdown,
      diversificationRatio: metrics.diversificationRatio
    };
  }

  // ========================================
  // Helper Methods
  // ========================================

  private validateOptimizationInput(positions: Position[]): ValidationResult {
    if (positions.length === 0) {
      return {
        check: 'positions_count',
        passed: false,
        value: 0,
        threshold: 1,
        severity: 'ERROR',
        message: 'No positions to optimize'
      };
    }

    if (positions.length > this.config.maxPositions) {
      return {
        check: 'max_positions',
        passed: false,
        value: positions.length,
        threshold: this.config.maxPositions,
        severity: 'ERROR',
        message: `Too many positions: ${positions.length} > ${this.config.maxPositions}`
      };
    }

    return {
      check: 'input_validation',
      passed: true,
      value: positions.length,
      threshold: this.config.maxPositions,
      severity: 'INFO',
      message: 'Input validation passed'
    };
  }

  private createOptimizationConstraints(): OptimizationConstraints {
    return {
      maxPositionWeight: 0.10,        // 10% max per position
      maxSectorWeight: 0.30,          // 30% max per sport
      minDiversification: 0.5,        // 50% minimum diversification
      maxTurnover: 0.25,              // 25% maximum turnover
      liquidityMinimum: 0.8           // 80% minimum liquidity
    };
  }

  private async calculateCurrentPortfolio(positions: Position[]): Promise<OptimizedPortfolio> {
    const totalValue = positions.reduce((sum, pos) => sum + pos.stake, 0);

    const currentPositions: OptimizedPosition[] = positions.map(position => {
      const weight = position.stake / totalValue;

      return {
        positionId: position.id,
        currentWeight: weight,
        optimizedWeight: weight,
        weightChange: 0,
        currentStake: position.stake,
        recommendedStake: position.stake,
        stakeChange: 0,
        reason: 'Current allocation'
      };
    });

    const metrics = this.calculateOptimizedPortfolioMetrics(currentPositions, positions);

    return {
      positions: currentPositions,
      totalRisk: metrics.totalRisk,
      expectedReturn: metrics.expectedReturn,
      sharpeRatio: metrics.sharpeRatio,
      maxDrawdown: metrics.maxDrawdown,
      diversificationRatio: metrics.diversificationRatio
    };
  }

  private calculateImprovements(current: OptimizedPortfolio, optimized: OptimizedPortfolio): {
    riskReduction: number;
    returnImprovement: number;
    sharpeImprovement: number;
  } {
    return {
      riskReduction: Math.max(0, current.totalRisk - optimized.totalRisk),
      returnImprovement: optimized.expectedReturn - current.expectedReturn,
      sharpeImprovement: optimized.sharpeRatio - current.sharpeRatio
    };
  }

  private generateRebalanceActions(current: OptimizedPortfolio, optimized: OptimizedPortfolio): RebalanceAction[] {
    const actions: RebalanceAction[] = [];

    current.positions.forEach((currentPos, index) => {
      const optimizedPos = optimized.positions[index];
      if (!optimizedPos) return;

      const stakeChange = optimizedPos.recommendedStake - currentPos.currentStake;

      if (Math.abs(stakeChange) > 10) { // $10 threshold
        actions.push({
          positionId: currentPos.positionId,
          action: stakeChange > 0 ? 'INCREASE' : 'DECREASE',
          currentStake: currentPos.currentStake,
          newStake: optimizedPos.recommendedStake,
          impact: Math.abs(stakeChange) / current.totalRisk,
          priority: Math.abs(optimizedPos.weightChange) * 10
        });
      }
    });

    return actions.sort((a, b) => b.priority - a.priority);
  }

  private estimateRebalancingCost(actions: RebalanceAction[]): number {
    // Estimate transaction costs (simplified)
    return actions.reduce((cost, action) => {
      const transactionCost = Math.abs(action.newStake - action.currentStake) * 0.001; // 0.1% cost
      return cost + transactionCost;
    }, 0);
  }

  private async validateOptimizationResult(
    portfolio: OptimizedPortfolio,
    constraints: OptimizationConstraints
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Check position weight constraints
    const maxWeight = Math.max(...portfolio.positions.map(p => p.optimizedWeight));
    results.push({
      check: 'max_position_weight',
      passed: maxWeight <= constraints.maxPositionWeight,
      value: maxWeight,
      threshold: constraints.maxPositionWeight,
      severity: maxWeight > constraints.maxPositionWeight ? 'ERROR' : 'INFO',
      message: `Maximum position weight: ${(maxWeight * 100).toFixed(1)}%`
    });

    // Check diversification
    results.push({
      check: 'diversification',
      passed: portfolio.diversificationRatio >= constraints.minDiversification,
      value: portfolio.diversificationRatio,
      threshold: constraints.minDiversification,
      severity: portfolio.diversificationRatio < constraints.minDiversification ? 'WARNING' : 'INFO',
      message: `Diversification ratio: ${(portfolio.diversificationRatio * 100).toFixed(1)}%`
    });

    return results;
  }

  private extractKellyParameters(positions: Position[]): KellyInput {
    return {
      winProbabilities: positions.map(pos => this.oddsToWinProbability(pos.odds) + (pos.expectedValue / 100)),
      odds: positions.map(pos => pos.odds),
      correlations: this.buildSimpleCorrelationMatrix(positions),
      bankroll: this.riskProfile.bankroll
    };
  }

  private extractMarkowitzParameters(positions: Position[]): MarkowitzInput {
    return {
      expectedReturns: this.calculateExpectedReturns(positions),
      covarianceMatrix: this.buildCovarianceMatrix(positions),
      riskAversion: this.riskProfile.riskTolerance === 'CONSERVATIVE' ? 5 :
                   this.riskProfile.riskTolerance === 'MODERATE' ? 3 : 1
    };
  }

  private calculateExpectedReturns(positions: Position[]): number[] {
    return positions.map(pos => pos.expectedValue / 100);
  }

  private buildSimpleCorrelationMatrix(positions: Position[]): number[][] {
    const n = positions.length;
    const matrix: number[][] = [];

    for (let i = 0; i < n; i++) {
      matrix[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          // Simplified correlation calculation
          const pos1 = positions[i];
          const pos2 = positions[j];

          if (pos1.player === pos2.player) matrix[i][j] = 0.95;
          else if (pos1.gameId === pos2.gameId) matrix[i][j] = 0.70;
          else if (pos1.sport === pos2.sport) matrix[i][j] = 0.30;
          else matrix[i][j] = 0.10;
        }
      }
    }

    return matrix;
  }

  private buildCovarianceMatrix(positions: Position[]): number[][] {
    const correlations = this.buildSimpleCorrelationMatrix(positions);
    const variances = positions.map(pos => Math.pow((pos.riskMetrics?.individualRisk || 5) / 100, 2));

    const n = positions.length;
    const covariance: number[][] = [];

    for (let i = 0; i < n; i++) {
      covariance[i] = [];
      for (let j = 0; j < n; j++) {
        const stdI = Math.sqrt(variances[i]);
        const stdJ = Math.sqrt(variances[j]);
        covariance[i][j] = correlations[i][j] * stdI * stdJ;
      }
    }

    return covariance;
  }

  private calculateCorrelationAdjustment(index: number, correlations: number[][]): number {
    const maxCorrelation = Math.max(...correlations[index].filter((_, i) => i !== index));
    return Math.max(0.5, 1 - maxCorrelation);
  }

  private oddsToNetPayoff(odds: number): number {
    return odds > 0 ? odds / 100 : 100 / Math.abs(odds);
  }

  private oddsToWinProbability(odds: number): number {
    return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
  }

  private generateOptimizationReason(weightChange: number, position: Position): string {
    if (Math.abs(weightChange) < 0.01) return 'Optimal allocation maintained';
    if (weightChange > 0.05) return 'High expected value - increase allocation';
    if (weightChange > 0.02) return 'Positive risk-adjusted return - moderate increase';
    if (weightChange < -0.05) return 'High risk or low return - reduce allocation';
    if (weightChange < -0.02) return 'Portfolio rebalancing - moderate reduction';
    return 'Minor adjustment for optimization';
  }

  private calculateOptimizedPortfolioMetrics(optimized: OptimizedPosition[], positions: Position[]): any {
    const totalStake = optimized.reduce((sum, pos) => sum + pos.recommendedStake, 0);
    const weightedReturn = optimized.reduce((sum, pos, index) => {
      const position = positions[index];
      return sum + (pos.optimizedWeight * (position.expectedValue / 100));
    }, 0);

    return {
      totalRisk: this.calculatePortfolioRisk(optimized, positions),
      expectedReturn: weightedReturn,
      sharpeRatio: this.calculateSharpeRatio(optimized, positions),
      maxDrawdown: 0.15, // Simplified
      diversificationRatio: this.calculateDiversificationRatio(optimized)
    };
  }

  private calculatePortfolioRisk(optimized: OptimizedPosition[], positions: Position[]): number {
    return optimized.reduce((risk, pos, index) => {
      const position = positions[index];
      const individualRisk = (position.riskMetrics?.individualRisk || 5) / 10;
      return risk + (pos.optimizedWeight * individualRisk);
    }, 0);
  }

  private calculateSharpeRatio(optimized: OptimizedPosition[], positions: Position[]): number {
    const totalReturn = optimized.reduce((sum, pos, index) => {
      return sum + (pos.optimizedWeight * (positions[index].expectedValue / 100));
    }, 0);

    const portfolioRisk = this.calculatePortfolioRisk(optimized, positions);
    return portfolioRisk > 0 ? totalReturn / portfolioRisk : 0;
  }

  private calculateDiversificationRatio(optimized: OptimizedPosition[]): number {
    const activePositions = optimized.filter(pos => pos.optimizedWeight > 0.01);
    const n = activePositions.length;
    const herfindahl = activePositions.reduce((sum, pos) => sum + Math.pow(pos.optimizedWeight, 2), 0);
    return n > 0 ? (1 - herfindahl) / (1 - 1/n) : 0;
  }

  private getOptimizationMethodology(targetFunction: string): string {
    switch (targetFunction) {
      case 'KELLY': return 'Kelly Criterion Optimization';
      case 'SHARPE': return 'Kelly-Markowitz Hybrid Optimization';
      case 'RETURN': return 'Expected Return Maximization';
      case 'RISK': return 'Risk Minimization';
      default: return 'Custom Optimization';
    }
  }

  private generateCacheKey(positions: Position[], targetFunction: string): string {
    const positionHash = positions
      .map(p => `${p.id}:${p.stake}`)
      .sort()
      .join('|')
      .substring(0, 100);

    return `opt-${targetFunction}-${positionHash}`;
  }

  private updateOptimizationStats(result: OptimizationResult): void {
    this.optimizationStats.totalOptimizations++;

    const count = this.optimizationStats.totalOptimizations;
    this.optimizationStats.avgImprovementSharpe =
      ((this.optimizationStats.avgImprovementSharpe * (count - 1)) + result.sharpeImprovement) / count;

    this.optimizationStats.avgImprovementReturn =
      ((this.optimizationStats.avgImprovementReturn * (count - 1)) + result.returnImprovement) / count;

    this.optimizationStats.avgRiskReduction =
      ((this.optimizationStats.avgRiskReduction * (count - 1)) + result.riskReduction) / count;
  }

  private createFallbackOptimization(positions: Position[], targetFunction: string): OptimizationResult {
    const currentPortfolio = {
      positions: positions.map(pos => ({
        positionId: pos.id,
        currentWeight: 1 / positions.length,
        optimizedWeight: 1 / positions.length,
        weightChange: 0,
        currentStake: pos.stake,
        recommendedStake: pos.stake,
        stakeChange: 0,
        reason: 'Fallback - equal weights'
      })),
      totalRisk: 5,
      expectedReturn: 0.05,
      sharpeRatio: 1.0,
      maxDrawdown: 0.15,
      diversificationRatio: 0.8
    };

    return {
      optimizationId: `fallback-${Date.now()}`,
      targetFunction,
      currentPortfolio,
      optimizedPortfolio: currentPortfolio,
      riskReduction: 0,
      returnImprovement: 0,
      sharpeImprovement: 0,
      rebalanceActions: [],
      estimatedCost: 0,
      validationResults: [],
      optimizedAt: new Date().toISOString(),
      methodology: 'Fallback Equal Weights',
      constraints: this.createOptimizationConstraints()
    };
  }

  /**
   * Update risk profile
   */
  updateRiskProfile(newProfile: RiskProfile): void {
    this.riskProfile = newProfile;
    this.optimizationCache.clear(); // Clear cache when profile changes
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStatistics(): any {
    return {
      ...this.optimizationStats,
      cacheSize: this.optimizationCache.size
    };
  }
}