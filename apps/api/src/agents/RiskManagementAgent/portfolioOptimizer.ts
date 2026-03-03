import { redisCache } from '../../cache/enhanced-cache';
import { Logger } from '../../shared/logger/types';

interface OptimizationParams {
  targetRisk: number;
  targetReturn: number;
  maxPositions: number;
  minPosition: number;
  maxPosition: number;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  optimizationMethod: 'markowitz' | 'black_litterman' | 'risk_parity' | 'kelly';
}

interface Position {
  id: string;
  gameId: string;
  betType: string;
  stake: number;
  odds: number;
  expectedValue: number;
  volatility: number;
  correlation: Map<string, number>;
  expectedReturn: number;
  riskContribution: number;
}

interface OptimizationResult {
  optimizedWeights: Map<string, number>;
  expectedReturn: number;
  expectedRisk: number;
  sharpeRatio: number;
  diversificationRatio: number;
  concentrationRisk: number;
  recommendations: OptimizationRecommendation[];
  efficientFrontier?: EfficientFrontierPoint[];
}

interface OptimizationRecommendation {
  positionId: string;
  currentWeight: number;
  recommendedWeight: number;
  action: 'increase' | 'decrease' | 'close' | 'maintain';
  reason: string;
  impact: {
    riskChange: number;
    returnChange: number;
    diversificationChange: number;
  };
  priority: 'high' | 'medium' | 'low';
}

interface EfficientFrontierPoint {
  risk: number;
  return: number;
  weights: Map<string, number>;
  sharpeRatio: number;
}

interface PortfolioConstraints {
  maxWeight: number;
  minWeight: number;
  sectorConstraints: Map<string, number>;
  correlationLimit: number;
  liquidityConstraint: number;
  drawdownLimit: number;
}

export class PortfolioOptimizer {
  private readonly logger: Logger;
  private optimizationHistory: Map<string, OptimizationResult[]> = new Map();
  private correlationMatrix: Map<string, Map<string, number>> = new Map();
  private riskModels: Map<string, any> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.info('🎯 Initializing PortfolioOptimizer');

    await this.loadRiskModels();
    await this.loadCorrelationData();
    await this.loadOptimizationHistory();

    this.logger.info('✅ PortfolioOptimizer initialized');
  }

  async optimizePortfolio(
    positions: Position[],
    constraints: PortfolioConstraints,
    params: OptimizationParams,
    totalCapital: number
  ): Promise<OptimizationResult> {
    this.logger.info('🎯 Optimizing portfolio', {
      positionCount: positions.length,
      totalCapital,
      method: params.optimizationMethod,
    });

    try {
      // Validate inputs
      await this.validateInputs(positions, constraints, params);

      // Calculate expected returns and covariance matrix
      const expectedReturns = await this.calculateExpectedReturns(positions);
      const covarianceMatrix = await this.calculateCovarianceMatrix(positions);

      // Apply optimization method
      let result: OptimizationResult;

      switch (params.optimizationMethod) {
        case 'markowitz':
          result = await this.markowitzOptimization(
            positions,
            expectedReturns,
            covarianceMatrix,
            constraints,
            params
          );
          break;
        case 'black_litterman':
          result = await this.blackLittermanOptimization(
            positions,
            expectedReturns,
            covarianceMatrix,
            constraints,
            params
          );
          break;
        case 'risk_parity':
          result = await this.riskParityOptimization(positions, covarianceMatrix, constraints);
          break;
        case 'kelly':
          result = await this.kellyCriterionOptimization(
            positions,
            expectedReturns,
            covarianceMatrix,
            constraints
          );
          break;
        default:
          throw new Error(`Unknown optimization method: ${params.optimizationMethod}`);
      }

      // Generate recommendations
      result.recommendations = await this.generateRecommendations(positions, result, totalCapital);

      // Calculate efficient frontier
      if (params.optimizationMethod === 'markowitz') {
        result.efficientFrontier = await this.calculateEfficientFrontier(
          positions,
          expectedReturns,
          covarianceMatrix,
          constraints
        );
      }

      // Store optimization result
      await this.storeOptimizationResult(result);

      this.logger.info('✅ Portfolio optimization completed', {
        expectedReturn: result.expectedReturn,
        expectedRisk: result.expectedRisk,
        sharpeRatio: result.sharpeRatio,
        recommendations: result.recommendations.length,
      });

      return result;
    } catch (error) {
      this.logger.error('❌ Portfolio optimization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async optimizePositionSizing(
    positions: Position[],
    bankroll: number,
    riskTolerance: number
  ): Promise<Map<string, number>> {
    this.logger.info('💰 Optimizing position sizing', {
      positions: positions.length,
      bankroll,
      riskTolerance,
    });

    const optimalSizes = new Map<string, number>();

    try {
      for (const position of positions) {
        const kellyFraction = await this.calculateKellyFraction(position);
        const adjustedFraction = this.adjustForRiskTolerance(kellyFraction, riskTolerance);
        const optimalSize = Math.min(adjustedFraction * bankroll, bankroll * 0.05); // Max 5% per position

        optimalSizes.set(position.id, optimalSize);
      }

      // Ensure total allocation doesn't exceed limits
      const totalAllocation = Array.from(optimalSizes.values()).reduce(
        (sum, size) => sum + size,
        0
      );
      const maxAllocation = bankroll * 0.8; // Max 80% allocation

      if (totalAllocation > maxAllocation) {
        const scaleFactor = maxAllocation / totalAllocation;
        for (const [positionId, size] of optimalSizes) {
          optimalSizes.set(positionId, size * scaleFactor);
        }
      }

      return optimalSizes;
    } catch (error) {
      this.logger.error('❌ Position sizing optimization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async calculateEfficientFrontier(
    positions: Position[],
    expectedReturns: number[],
    covarianceMatrix: number[][],
    constraints: PortfolioConstraints,
    numPoints: number = 50
  ): Promise<EfficientFrontierPoint[]> {
    const frontierPoints: EfficientFrontierPoint[] = [];

    // Calculate minimum variance portfolio
    const minVarWeights = await this.calculateMinVarianceWeights(covarianceMatrix, constraints);
    const minVarReturn = this.calculatePortfolioReturn(minVarWeights, expectedReturns);
    const minVarRisk = Math.sqrt(this.calculatePortfolioVariance(minVarWeights, covarianceMatrix));

    // Calculate maximum return portfolio
    const maxReturnWeights = await this.calculateMaxReturnWeights(expectedReturns, constraints);
    const maxReturn = this.calculatePortfolioReturn(maxReturnWeights, expectedReturns);

    // Generate frontier points
    for (let i = 0; i < numPoints; i++) {
      const targetReturn = minVarReturn + (maxReturn - minVarReturn) * (i / (numPoints - 1));

      try {
        const weights = await this.optimizeForTargetReturn(
          expectedReturns,
          covarianceMatrix,
          targetReturn,
          constraints
        );

        const risk = Math.sqrt(this.calculatePortfolioVariance(weights, covarianceMatrix));
        const portfolioReturn = this.calculatePortfolioReturn(weights, expectedReturns);
        const sharpeRatio = risk > 0 ? portfolioReturn / risk : 0;

        frontierPoints.push({
          risk,
          return: portfolioReturn,
          weights: new Map(weights.map((w, idx) => [positions[idx].id, w])),
          sharpeRatio,
        });
      } catch (error) {
        // Skip points that can't be optimized
        continue;
      }
    }

    return frontierPoints.sort((a, b) => a.risk - b.risk);
  }

  // Private Optimization Methods
  private async markowitzOptimization(
    positions: Position[],
    expectedReturns: number[],
    covarianceMatrix: number[][],
    constraints: PortfolioConstraints,
    params: OptimizationParams
  ): Promise<OptimizationResult> {
    // Mean-variance optimization
    const weights = await this.optimizeForSharpeRatio(
      expectedReturns,
      covarianceMatrix,
      constraints
    );

    const expectedReturn = this.calculatePortfolioReturn(weights, expectedReturns);
    const expectedRisk = Math.sqrt(this.calculatePortfolioVariance(weights, covarianceMatrix));
    const sharpeRatio = expectedRisk > 0 ? expectedReturn / expectedRisk : 0;
    const diversificationRatio = await this.calculateDiversificationRatio(
      weights,
      covarianceMatrix
    );
    const concentrationRisk = this.calculateConcentrationRisk(weights);

    return {
      optimizedWeights: new Map(weights.map((w, idx) => [positions[idx].id, w])),
      expectedReturn,
      expectedRisk,
      sharpeRatio,
      diversificationRatio,
      concentrationRisk,
      recommendations: [],
    };
  }

  private async blackLittermanOptimization(
    positions: Position[],
    expectedReturns: number[],
    covarianceMatrix: number[][],
    constraints: PortfolioConstraints,
    params: OptimizationParams
  ): Promise<OptimizationResult> {
    // Black-Litterman model with investor views
    const marketWeights = await this.getMarketCapWeights(positions);
    const tau = 0.025; // Scaling factor
    const riskAversion = 3.0; // Risk aversion coefficient

    // Calculate implied equilibrium returns
    const impliedReturns = this.calculateImpliedReturns(
      marketWeights,
      covarianceMatrix,
      riskAversion
    );

    // Apply investor views (simplified - would normally get from external source)
    const adjustedReturns = await this.applyInvestorViews(impliedReturns, positions);

    // Calculate posterior distribution
    const posteriorReturns = this.calculatePosteriorReturns(
      impliedReturns,
      adjustedReturns,
      covarianceMatrix,
      tau
    );

    // Optimize with posterior returns
    const weights = await this.optimizeForSharpeRatio(
      posteriorReturns,
      covarianceMatrix,
      constraints
    );

    const expectedReturn = this.calculatePortfolioReturn(weights, posteriorReturns);
    const expectedRisk = Math.sqrt(this.calculatePortfolioVariance(weights, covarianceMatrix));
    const sharpeRatio = expectedRisk > 0 ? expectedReturn / expectedRisk : 0;
    const diversificationRatio = await this.calculateDiversificationRatio(
      weights,
      covarianceMatrix
    );
    const concentrationRisk = this.calculateConcentrationRisk(weights);

    return {
      optimizedWeights: new Map(weights.map((w, idx) => [positions[idx].id, w])),
      expectedReturn,
      expectedRisk,
      sharpeRatio,
      diversificationRatio,
      concentrationRisk,
      recommendations: [],
    };
  }

  private async riskParityOptimization(
    positions: Position[],
    covarianceMatrix: number[][],
    constraints: PortfolioConstraints
  ): Promise<OptimizationResult> {
    // Risk parity: equal risk contribution from each position
    const weights = await this.calculateRiskParityWeights(covarianceMatrix, constraints);

    // Use historical returns for return calculation
    const expectedReturns = await this.getHistoricalReturns(positions);

    const expectedReturn = this.calculatePortfolioReturn(weights, expectedReturns);
    const expectedRisk = Math.sqrt(this.calculatePortfolioVariance(weights, covarianceMatrix));
    const sharpeRatio = expectedRisk > 0 ? expectedReturn / expectedRisk : 0;
    const diversificationRatio = await this.calculateDiversificationRatio(
      weights,
      covarianceMatrix
    );
    const concentrationRisk = this.calculateConcentrationRisk(weights);

    return {
      optimizedWeights: new Map(weights.map((w, idx) => [positions[idx].id, w])),
      expectedReturn,
      expectedRisk,
      sharpeRatio,
      diversificationRatio,
      concentrationRisk,
      recommendations: [],
    };
  }

  private async kellyCriterionOptimization(
    positions: Position[],
    expectedReturns: number[],
    covarianceMatrix: number[][],
    constraints: PortfolioConstraints
  ): Promise<OptimizationResult> {
    // Kelly criterion for optimal position sizing
    const weights = new Array(positions.length).fill(0);

    for (let i = 0; i < positions.length; i++) {
      const position = positions[i];
      const kellyFraction = await this.calculateKellyFraction(position);

      // Apply constraints
      weights[i] = Math.min(Math.max(kellyFraction, constraints.minWeight), constraints.maxWeight);
    }

    // Normalize weights
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    if (totalWeight > 1) {
      for (let i = 0; i < weights.length; i++) {
        weights[i] /= totalWeight;
      }
    }

    const expectedReturn = this.calculatePortfolioReturn(weights, expectedReturns);
    const expectedRisk = Math.sqrt(this.calculatePortfolioVariance(weights, covarianceMatrix));
    const sharpeRatio = expectedRisk > 0 ? expectedReturn / expectedRisk : 0;
    const diversificationRatio = await this.calculateDiversificationRatio(
      weights,
      covarianceMatrix
    );
    const concentrationRisk = this.calculateConcentrationRisk(weights);

    return {
      optimizedWeights: new Map(weights.map((w, idx) => [positions[idx].id, w])),
      expectedReturn,
      expectedRisk,
      sharpeRatio,
      diversificationRatio,
      concentrationRisk,
      recommendations: [],
    };
  }

  // Helper Methods
  private async calculateExpectedReturns(positions: Position[]): Promise<number[]> {
    return positions.map(position => {
      // Convert odds to implied probability and calculate expected return
      const impliedProbability = 1 / position.odds;
      const winProbability = impliedProbability * (1 + position.expectedValue); // Adjust for edge
      return winProbability * (position.odds - 1) - (1 - winProbability);
    });
  }

  private async calculateCovarianceMatrix(positions: Position[]): Promise<number[][]> {
    const n = positions.length;
    const matrix: number[][] = Array(n)
      .fill(null)
      .map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          // Variance (diagonal)
          matrix[i][j] = Math.pow(positions[i].volatility, 2);
        } else {
          // Covariance (off-diagonal)
          const correlation = positions[i].correlation.get(positions[j].id) || 0;
          matrix[i][j] = correlation * positions[i].volatility * positions[j].volatility;
        }
      }
    }

    return matrix;
  }

  private async calculateKellyFraction(position: Position): Promise<number> {
    const p = 1 / position.odds + position.expectedValue; // Win probability
    const b = position.odds - 1; // Net odds

    // Kelly fraction: f = (bp - q) / b = (p * b - (1-p)) / b
    const kellyFraction = (p * b - (1 - p)) / b;

    // Apply safety margin (fractional Kelly)
    return Math.max(0, kellyFraction * 0.25); // Use 25% of Kelly
  }

  private adjustForRiskTolerance(kellyFraction: number, riskTolerance: number): number {
    // Adjust Kelly fraction based on risk tolerance (0-1 scale)
    return kellyFraction * riskTolerance;
  }

  private async optimizeForSharpeRatio(
    expectedReturns: number[],
    covarianceMatrix: number[][],
    constraints: PortfolioConstraints
  ): Promise<number[]> {
    // Simplified optimization using equal weights as starting point
    // In production, this would use proper quadratic programming
    const n = expectedReturns.length;
    const weights = new Array(n).fill(1 / n);

    // Apply constraints
    for (let i = 0; i < n; i++) {
      weights[i] = Math.min(Math.max(weights[i], constraints.minWeight), constraints.maxWeight);
    }

    // Normalize
    const sum = weights.reduce((acc, w) => acc + w, 0);
    return weights.map(w => w / sum);
  }

  private calculatePortfolioReturn(weights: number[], expectedReturns: number[]): number {
    return weights.reduce((sum, weight, i) => sum + weight * expectedReturns[i], 0);
  }

  private calculatePortfolioVariance(weights: number[], covarianceMatrix: number[][]): number {
    let variance = 0;
    const n = weights.length;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        variance += weights[i] * weights[j] * covarianceMatrix[i][j];
      }
    }

    return variance;
  }

  private async calculateDiversificationRatio(
    weights: number[],
    covarianceMatrix: number[][]
  ): Promise<number> {
    // Diversification ratio = weighted average volatility / portfolio volatility
    const portfolioVolatility = Math.sqrt(
      this.calculatePortfolioVariance(weights, covarianceMatrix)
    );
    const weightedAvgVolatility = weights.reduce(
      (sum, weight, i) => sum + weight * Math.sqrt(covarianceMatrix[i][i]),
      0
    );

    return portfolioVolatility > 0 ? weightedAvgVolatility / portfolioVolatility : 1;
  }

  private calculateConcentrationRisk(weights: number[]): number {
    // Herfindahl-Hirschman Index
    return weights.reduce((sum, weight) => sum + weight * weight, 0);
  }

  private async generateRecommendations(
    positions: Position[],
    result: OptimizationResult,
    totalCapital: number
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    for (let i = 0; i < positions.length; i++) {
      const position = positions[i];
      const currentWeight = position.stake / totalCapital;
      const recommendedWeight = result.optimizedWeights.get(position.id) || 0;
      const weightDifference = Math.abs(recommendedWeight - currentWeight);

      if (weightDifference > 0.01) {
        // 1% threshold
        let action: 'increase' | 'decrease' | 'close' | 'maintain';

        if (recommendedWeight > currentWeight * 1.1) {
          action = 'increase';
        } else if (recommendedWeight < currentWeight * 0.9) {
          action = recommendedWeight < 0.005 ? 'close' : 'decrease';
        } else {
          action = 'maintain';
        }

        recommendations.push({
          positionId: position.id,
          currentWeight,
          recommendedWeight,
          action,
          reason: this.generateRecommendationReason(action, weightDifference),
          impact: {
            riskChange: (recommendedWeight - currentWeight) * position.volatility,
            returnChange: (recommendedWeight - currentWeight) * position.expectedReturn,
            diversificationChange: 0, // Would calculate actual impact
          },
          priority: weightDifference > 0.05 ? 'high' : weightDifference > 0.02 ? 'medium' : 'low',
        });
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private generateRecommendationReason(action: string, weightDifference: number): string {
    const reasons = {
      increase: `Increase position by ${(weightDifference * 100).toFixed(1)}% to improve risk-adjusted returns`,
      decrease: `Decrease position by ${(weightDifference * 100).toFixed(1)}% to reduce concentration risk`,
      close: 'Close position to eliminate negative expected value',
      maintain: 'Position is optimally sized',
    };

    return reasons[action as keyof typeof reasons] || 'Optimize position sizing';
  }

  // Stub methods for complex calculations
  private async calculateMinVarianceWeights(
    covarianceMatrix: number[][],
    constraints: PortfolioConstraints
  ): Promise<number[]> {
    // Simplified - would use proper optimization
    const n = covarianceMatrix.length;
    return new Array(n).fill(1 / n);
  }

  private async calculateMaxReturnWeights(
    expectedReturns: number[],
    constraints: PortfolioConstraints
  ): Promise<number[]> {
    // Simplified - would find position with highest expected return
    const maxReturnIndex = expectedReturns.indexOf(Math.max(...expectedReturns));
    const weights = new Array(expectedReturns.length).fill(0);
    weights[maxReturnIndex] = 1;
    return weights;
  }

  private async optimizeForTargetReturn(
    expectedReturns: number[],
    covarianceMatrix: number[][],
    targetReturn: number,
    constraints: PortfolioConstraints
  ): Promise<number[]> {
    // Simplified - would use proper constrained optimization
    const n = expectedReturns.length;
    return new Array(n).fill(1 / n);
  }

  private async getMarketCapWeights(positions: Position[]): Promise<number[]> {
    // Simplified - would get actual market cap data
    const n = positions.length;
    return new Array(n).fill(1 / n);
  }

  private calculateImpliedReturns(
    marketWeights: number[],
    covarianceMatrix: number[][],
    riskAversion: number
  ): number[] {
    // Implied returns = risk_aversion * covariance_matrix * market_weights
    const n = marketWeights.length;
    const impliedReturns = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        impliedReturns[i] += riskAversion * covarianceMatrix[i][j] * marketWeights[j];
      }
    }

    return impliedReturns;
  }

  private async applyInvestorViews(
    impliedReturns: number[],
    positions: Position[]
  ): Promise<number[]> {
    // Simplified - would incorporate actual investor views
    return impliedReturns.map((ret, i) => ret + positions[i].expectedValue * 0.1);
  }

  private calculatePosteriorReturns(
    impliedReturns: number[],
    adjustedReturns: number[],
    covarianceMatrix: number[][],
    tau: number
  ): number[] {
    // Simplified Bayesian update
    return impliedReturns.map((ret, i) => (ret + adjustedReturns[i]) / 2);
  }

  private async calculateRiskParityWeights(
    covarianceMatrix: number[][],
    constraints: PortfolioConstraints
  ): Promise<number[]> {
    // Simplified risk parity calculation
    const n = covarianceMatrix.length;
    const weights = new Array(n);

    // Start with equal weights
    for (let i = 0; i < n; i++) {
      weights[i] = 1 / Math.sqrt(covarianceMatrix[i][i]); // Inverse volatility
    }

    // Normalize
    const sum = weights.reduce((acc, w) => acc + w, 0);
    return weights.map(w => w / sum);
  }

  private async getHistoricalReturns(positions: Position[]): Promise<number[]> {
    // Would get actual historical returns
    return positions.map(p => p.expectedReturn);
  }

  private async validateInputs(
    positions: Position[],
    constraints: PortfolioConstraints,
    params: OptimizationParams
  ): Promise<void> {
    if (positions.length === 0) {
      throw new Error('No positions provided for optimization');
    }

    if (positions.length > params.maxPositions) {
      throw new Error(`Too many positions: ${positions.length} > ${params.maxPositions}`);
    }

    // Additional validation logic...
  }

  private async storeOptimizationResult(result: OptimizationResult): Promise<void> {
    const resultData = {
      timestamp: new Date().toISOString(),
      expectedReturn: result.expectedReturn,
      expectedRisk: result.expectedRisk,
      sharpeRatio: result.sharpeRatio,
      recommendationCount: result.recommendations.length,
    };

    await redisCache.set(
      `optimization:result:${Date.now()}`,
      JSON.stringify(resultData),
      3600 // 1 hour TTL
    );
  }

  private async loadRiskModels(): Promise<void> {
    // Load risk models for different asset classes
    const models = {
      single_game: { volatility: 0.4, correlation_decay: 0.1 },
      same_sport: { correlation_factor: 0.3, volatility_adjustment: 1.2 },
      cross_sport: { correlation_factor: 0.05, volatility_adjustment: 1.0 },
    };

    for (const [modelName, model] of Object.entries(models)) {
      this.riskModels.set(modelName, model);
    }
  }

  private async loadCorrelationData(): Promise<void> {
    // Load correlation data between different bet types/games
    try {
      const cached = await redisCache.get('optimization:correlations');
      if (cached) {
        const correlationData = JSON.parse(cached);
        this.correlationMatrix = new Map(correlationData);
      }
    } catch (error) {
      this.logger.warn('⚠️ Failed to load correlation data, using defaults');
    }
  }

  private async loadOptimizationHistory(): Promise<void> {
    try {
      const cachedHistory = await redisCache.getPattern('optimization:history:*');

      for (const [key, data] of cachedHistory) {
        const userId = key.split(':').pop();
        if (userId) {
          const history = JSON.parse(data);
          this.optimizationHistory.set(userId, history);
        }
      }

      this.logger.info(`📋 Loaded optimization history for ${this.optimizationHistory.size} users`);
    } catch (error) {
      this.logger.warn('⚠️ Failed to load optimization history from cache');
    }
  }

  async isHealthy(): Promise<boolean> {
    return this.riskModels.size > 0;
  }

  async cleanup(): Promise<void> {
    // Save optimization history
    for (const [userId, history] of this.optimizationHistory) {
      await redisCache.set(
        `optimization:history:${userId}`,
        JSON.stringify(history),
        86400 // 24 hours TTL
      );
    }

    this.optimizationHistory.clear();
    this.correlationMatrix.clear();
    this.riskModels.clear();

    this.logger.info('🧹 PortfolioOptimizer cleanup completed');
  }
}
