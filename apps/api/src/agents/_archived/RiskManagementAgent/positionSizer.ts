import { redisCache } from '../../cache/enhanced-cache';
import { Logger } from '../../shared/logger/types';

interface Position {
  id: string;
  userId: string;
  gameId: string;
  betType: string;
  stake: number;
  odds: number;
  expectedValue: number;
  volatility: number;
  correlation: Map<string, number>;
  riskContribution: number;
  timestamp: Date;
}

interface RiskLimits {
  maxSinglePosition: number;
  maxDailyExposure: number;
  maxCorrelatedExposure: number;
  maxDrawdownThreshold: number;
  minBankrollReserve: number;
  concentrationLimit: number;
}

interface PositionSizingParams {
  method: 'kelly' | 'fixed_percentage' | 'volatility_scaled' | 'risk_parity' | 'adaptive';
  riskTolerance: number;
  maxPositionSize: number;
  targetVolatility: number;
  correlationAdjustment: boolean;
  dynamicSizing: boolean;
}

interface OptimizedPosition {
  positionId: string;
  currentSize: number;
  recommendedSize: number;
  sizingRatio: number;
  reason: string;
  changeRequired: boolean;
  riskImpact: number;
  expectedReturnImpact: number;
  priority: 'high' | 'medium' | 'low';
}

interface PortfolioOptimization {
  positions: OptimizedPosition[];
  totalRecommendedExposure: number;
  riskReduction: number;
  expectedReturnChange: number;
  diversificationImprovement: number;
  correlationAdjustments: CorrelationAdjustment[];
}

interface CorrelationAdjustment {
  positionPair: string[];
  correlationLevel: number;
  recommendedAdjustment: number;
  impact: string;
}

interface KellyCalculation {
  kellyFraction: number;
  adjustedFraction: number;
  confidence: number;
  riskAdjustment: number;
  correlationAdjustment: number;
}

export class PositionSizer {
  private readonly logger: Logger;
  private sizingHistory: Map<string, any[]> = new Map();
  private bankrollTracking: Map<string, number[]> = new Map();
  private correlationMatrix: Map<string, Map<string, number>> = new Map();
  private volatilityModels: Map<string, any> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.info('🎯 Initializing PositionSizer');

    await this.loadSizingHistory();
    await this.loadBankrollTracking();
    await this.loadVolatilityModels();
    await this.loadCorrelationData();

    this.logger.info('✅ PositionSizer initialized');
  }

  async optimizePortfolio(
    positions: Position[],
    limits: RiskLimits,
    bankroll: number,
    params?: PositionSizingParams
  ): Promise<PortfolioOptimization> {
    this.logger.info('🎯 Optimizing portfolio position sizes', {
      positionCount: positions.length,
      bankroll,
      method: params?.method || 'kelly',
    });

    try {
      const defaultParams: PositionSizingParams = {
        method: 'kelly',
        riskTolerance: 0.25,
        maxPositionSize: 0.05,
        targetVolatility: 0.15,
        correlationAdjustment: true,
        dynamicSizing: true,
        ...params,
      };

      // Calculate optimal sizes for each position
      const optimizedPositions: OptimizedPosition[] = [];

      for (const position of positions) {
        const optimizedPos = await this.optimizePosition(
          position,
          positions,
          bankroll,
          limits,
          defaultParams
        );
        optimizedPositions.push(optimizedPos);
      }

      // Apply portfolio-level constraints
      const portfolioOptimization = await this.applyPortfolioConstraints(
        optimizedPositions,
        bankroll,
        limits
      );

      // Calculate correlation adjustments
      const correlationAdjustments = await this.calculateCorrelationAdjustments(
        positions,
        portfolioOptimization.positions
      );

      // Apply dynamic risk scaling
      if (defaultParams.dynamicSizing) {
        await this.applyDynamicScaling(portfolioOptimization.positions, bankroll);
      }

      const result: PortfolioOptimization = {
        positions: portfolioOptimization.positions,
        totalRecommendedExposure: portfolioOptimization.totalExposure,
        riskReduction: await this.calculateRiskReduction(
          positions,
          portfolioOptimization.positions
        ),
        expectedReturnChange: await this.calculateExpectedReturnChange(
          positions,
          portfolioOptimization.positions
        ),
        diversificationImprovement: await this.calculateDiversificationImprovement(
          positions,
          portfolioOptimization.positions
        ),
        correlationAdjustments,
      };

      // Store optimization results
      await this.storeSizingDecision(positions[0]?.userId || 'unknown', result);

      this.logger.info('✅ Portfolio optimization completed', {
        positionsOptimized: result.positions.length,
        riskReduction: result.riskReduction,
        totalExposure: result.totalRecommendedExposure,
      });

      return result;
    } catch (error) {
      this.logger.error('❌ Portfolio optimization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async calculateOptimalSize(
    position: Position,
    bankroll: number,
    riskTolerance: number = 0.25
  ): Promise<number> {
    this.logger.debug('💰 Calculating optimal position size', {
      positionId: position.id,
      currentStake: position.stake,
      bankroll,
    });

    try {
      // Calculate Kelly Criterion
      const kellyCalculation = await this.calculateKellyFraction(position);

      // Apply risk tolerance adjustment
      const adjustedKelly = kellyCalculation.kellyFraction * riskTolerance;

      // Calculate volatility-scaled size
      const volatilityScaledSize = await this.calculateVolatilityScaledSize(
        position,
        bankroll,
        0.15 // Target 15% volatility
      );

      // Take the more conservative of the two
      const conservativeSize = Math.min(adjustedKelly * bankroll, volatilityScaledSize);

      // Apply position limits
      const maxSize = bankroll * 0.05; // 5% max position size
      const optimalSize = Math.min(conservativeSize, maxSize);

      return Math.max(0, optimalSize);
    } catch (error) {
      this.logger.error('❌ Failed to calculate optimal size', {
        positionId: position.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return position.stake; // Return current stake as fallback
    }
  }

  async calculateKellyFraction(position: Position): Promise<KellyCalculation> {
    const p = this.calculateWinProbability(position);
    const b = position.odds - 1; // Net odds

    // Basic Kelly formula: f = (bp - q) / b
    const q = 1 - p;
    const kellyFraction = (b * p - q) / b;

    // Apply confidence adjustment based on data quality
    const confidence = await this.calculateConfidence(position);
    const confidenceAdjustment = confidence * 0.8 + 0.2; // 20-100% of Kelly

    // Apply risk adjustment for bet type volatility
    const riskAdjustment = this.calculateRiskAdjustment(position);

    // Apply correlation adjustment
    const correlationAdjustment = await this.calculateCorrelationAdjustment(position);

    const adjustedFraction = Math.max(
      0,
      kellyFraction * confidenceAdjustment * riskAdjustment * correlationAdjustment
    );

    return {
      kellyFraction,
      adjustedFraction,
      confidence,
      riskAdjustment,
      correlationAdjustment,
    };
  }

  async sizeNewPosition(
    proposedPosition: Omit<Position, 'id' | 'stake'>,
    existingPositions: Position[],
    bankroll: number,
    limits: RiskLimits
  ): Promise<number> {
    this.logger.info('🆕 Sizing new position', {
      betType: proposedPosition.betType,
      gameId: proposedPosition.gameId,
      existingPositions: existingPositions.length,
    });

    try {
      // Create temporary position for calculations
      const tempPosition: Position = {
        ...proposedPosition,
        id: 'temp_position',
        stake: 0,
        correlation: new Map(),
      };

      // Calculate base position size
      const baseSize = await this.calculateOptimalSize(tempPosition, bankroll, 0.25);

      // Check portfolio-level constraints
      const currentExposure = existingPositions.reduce((sum, pos) => sum + pos.stake, 0);
      const proposedExposure = currentExposure + baseSize;

      // Respect daily exposure limit
      const maxAdditionalExposure = bankroll * limits.maxDailyExposure - currentExposure;
      if (maxAdditionalExposure <= 0) {
        this.logger.warn('⚠️ Daily exposure limit reached', {
          currentExposure: currentExposure / bankroll,
          limit: limits.maxDailyExposure,
        });
        return 0;
      }

      // Check correlation constraints
      const correlationAdjustedSize = await this.adjustForCorrelations(
        tempPosition,
        existingPositions,
        Math.min(baseSize, maxAdditionalExposure),
        limits
      );

      // Apply concentration limits
      const concentrationAdjustedSize = await this.adjustForConcentration(
        tempPosition,
        existingPositions,
        correlationAdjustedSize,
        limits
      );

      const finalSize = Math.max(0, concentrationAdjustedSize);

      this.logger.info('✅ New position sized', {
        baseSize,
        finalSize,
        adjustmentRatio: baseSize > 0 ? finalSize / baseSize : 0,
      });

      return finalSize;
    } catch (error) {
      this.logger.error('❌ Failed to size new position', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  // Private Methods
  private async optimizePosition(
    position: Position,
    allPositions: Position[],
    bankroll: number,
    limits: RiskLimits,
    params: PositionSizingParams
  ): Promise<OptimizedPosition> {
    let recommendedSize: number;
    let reason: string;

    switch (params.method) {
      case 'kelly':
        const kellyCalc = await this.calculateKellyFraction(position);
        recommendedSize = kellyCalc.adjustedFraction * bankroll;
        reason = `Kelly Criterion (${(kellyCalc.kellyFraction * 100).toFixed(1)}% adjusted to ${(kellyCalc.adjustedFraction * 100).toFixed(1)}%)`;
        break;

      case 'fixed_percentage':
        recommendedSize = bankroll * params.riskTolerance;
        reason = `Fixed percentage (${(params.riskTolerance * 100).toFixed(1)}% of bankroll)`;
        break;

      case 'volatility_scaled':
        recommendedSize = await this.calculateVolatilityScaledSize(
          position,
          bankroll,
          params.targetVolatility
        );
        reason = `Volatility scaled (target ${(params.targetVolatility * 100).toFixed(1)}% volatility)`;
        break;

      case 'risk_parity':
        recommendedSize = await this.calculateRiskParitySize(position, allPositions, bankroll);
        reason = 'Risk parity allocation';
        break;

      case 'adaptive':
        recommendedSize = await this.calculateAdaptiveSize(
          position,
          allPositions,
          bankroll,
          params
        );
        reason = 'Adaptive sizing based on market conditions';
        break;

      default:
        recommendedSize = position.stake;
        reason = 'No adjustment (unknown method)';
    }

    // Apply position limits
    const maxSize = bankroll * Math.min(params.maxPositionSize, limits.maxSinglePosition);
    recommendedSize = Math.min(recommendedSize, maxSize);

    // Apply correlation adjustments if enabled
    if (params.correlationAdjustment) {
      const correlationFactor = await this.getCorrelationAdjustmentFactor(position, allPositions);
      recommendedSize *= correlationFactor;

      if (correlationFactor < 1) {
        reason += ` (reduced ${((1 - correlationFactor) * 100).toFixed(1)}% for correlation)`;
      }
    }

    const sizingRatio = position.stake > 0 ? recommendedSize / position.stake : 1;
    const changeRequired = Math.abs(sizingRatio - 1) > 0.1; // 10% threshold

    return {
      positionId: position.id,
      currentSize: position.stake,
      recommendedSize,
      sizingRatio,
      reason,
      changeRequired,
      riskImpact: await this.calculateRiskImpact(position, recommendedSize - position.stake),
      expectedReturnImpact: await this.calculateReturnImpact(
        position,
        recommendedSize - position.stake
      ),
      priority: this.determinePriority(sizingRatio, position.riskContribution),
    };
  }

  private calculateWinProbability(position: Position): number {
    // Convert odds to implied probability and adjust for expected value
    const impliedProbability = 1 / position.odds;
    const adjustedProbability = impliedProbability * (1 + position.expectedValue);
    return Math.min(0.95, Math.max(0.05, adjustedProbability));
  }

  private async calculateConfidence(position: Position): Promise<number> {
    // This would analyze data quality, sample size, model accuracy, etc.
    // For now, return a confidence based on bet type and expected value magnitude

    const baseConfidence = 0.7;
    const evConfidence = Math.min(0.3, Math.abs(position.expectedValue) * 2);
    const typeConfidence = this.getBetTypeConfidence(position.betType);

    return Math.min(0.95, baseConfidence + evConfidence + typeConfidence);
  }

  private calculateRiskAdjustment(position: Position): number {
    // Higher volatility = lower position size
    const volatilityPenalty = Math.min(0.5, position.volatility);
    return Math.max(0.5, 1 - volatilityPenalty);
  }

  private async calculateCorrelationAdjustment(position: Position): Promise<number> {
    // This would analyze correlation with existing positions
    // For now, return a basic adjustment based on correlation data
    return 0.9; // 10% reduction for correlation risk
  }

  private getBetTypeConfidence(betType: string): number {
    const confidenceMap: Record<string, number> = {
      moneyline: 0.15,
      spread: 0.1,
      total: 0.1,
      prop: 0.05,
      live: 0.02,
      exotic: 0.0,
    };

    return confidenceMap[betType] || 0.05;
  }

  private async calculateVolatilityScaledSize(
    position: Position,
    bankroll: number,
    targetVolatility: number
  ): Promise<number> {
    // Size position to contribute target volatility to portfolio
    const positionVolatility = position.volatility;
    if (positionVolatility <= 0) return bankroll * 0.01; // 1% minimum

    const targetContribution = targetVolatility / Math.sqrt(252); // Daily target
    const scalingFactor = targetContribution / positionVolatility;

    return bankroll * Math.min(scalingFactor, 0.05); // Max 5% of bankroll
  }

  private async calculateRiskParitySize(
    position: Position,
    allPositions: Position[],
    bankroll: number
  ): Promise<number> {
    // Equal risk contribution from each position
    if (allPositions.length === 0) return bankroll * 0.02;

    const targetRiskContribution = 1 / allPositions.length;
    const positionVolatility = position.volatility;

    if (positionVolatility <= 0) return bankroll * 0.01;

    // Size inversely proportional to volatility
    const riskParityWeight = targetRiskContribution / positionVolatility;
    return bankroll * Math.min(riskParityWeight, 0.05);
  }

  private async calculateAdaptiveSize(
    position: Position,
    allPositions: Position[],
    bankroll: number,
    params: PositionSizingParams
  ): Promise<number> {
    // Combine multiple sizing methods with adaptive weights
    const kellySize = (await this.calculateKellyFraction(position)).adjustedFraction * bankroll;
    const volatilitySize = await this.calculateVolatilityScaledSize(
      position,
      bankroll,
      params.targetVolatility
    );
    const riskParitySize = await this.calculateRiskParitySize(position, allPositions, bankroll);

    // Dynamic weights based on market conditions and position characteristics
    const kellyWeight = this.getAdaptiveWeight('kelly', position);
    const volatilityWeight = this.getAdaptiveWeight('volatility', position);
    const riskParityWeight = this.getAdaptiveWeight('risk_parity', position);

    const totalWeight = kellyWeight + volatilityWeight + riskParityWeight;

    return (
      (kellySize * kellyWeight +
        volatilitySize * volatilityWeight +
        riskParitySize * riskParityWeight) /
      totalWeight
    );
  }

  private getAdaptiveWeight(method: string, position: Position): number {
    // This would analyze current market conditions, position characteristics, etc.
    const baseWeights = {
      kelly: 0.5,
      volatility: 0.3,
      risk_parity: 0.2,
    };

    return baseWeights[method as keyof typeof baseWeights] || 0.1;
  }

  private async getCorrelationAdjustmentFactor(
    position: Position,
    allPositions: Position[]
  ): Promise<number> {
    if (allPositions.length <= 1) return 1.0;

    let totalCorrelation = 0;
    let correlationCount = 0;

    for (const otherPosition of allPositions) {
      if (otherPosition.id === position.id) continue;

      const correlation = await this.getPositionCorrelation(position, otherPosition);
      totalCorrelation += Math.abs(correlation);
      correlationCount++;
    }

    const avgCorrelation = correlationCount > 0 ? totalCorrelation / correlationCount : 0;

    // Reduce size based on average correlation
    return Math.max(0.5, 1 - avgCorrelation * 0.5);
  }

  private async getPositionCorrelation(pos1: Position, pos2: Position): Promise<number> {
    // Same game = high correlation
    if (pos1.gameId === pos2.gameId) return 0.8;

    // Same sport, same day = medium correlation
    if (this.isSameSport(pos1, pos2) && this.isSameDay(pos1, pos2)) return 0.4;

    // Same sport, different day = low correlation
    if (this.isSameSport(pos1, pos2)) return 0.2;

    // Different sports = minimal correlation
    return 0.05;
  }

  private isSameSport(pos1: Position, pos2: Position): boolean {
    return pos1.betType.split('_')[0] === pos2.betType.split('_')[0];
  }

  private isSameDay(pos1: Position, pos2: Position): boolean {
    const day1 = pos1.timestamp.toDateString();
    const day2 = pos2.timestamp.toDateString();
    return day1 === day2;
  }

  private async applyPortfolioConstraints(
    optimizedPositions: OptimizedPosition[],
    bankroll: number,
    limits: RiskLimits
  ): Promise<{ positions: OptimizedPosition[]; totalExposure: number }> {
    let totalExposure = optimizedPositions.reduce((sum, pos) => sum + pos.recommendedSize, 0);
    const maxExposure = bankroll * limits.maxDailyExposure;

    // Scale down if total exposure exceeds limit
    if (totalExposure > maxExposure) {
      const scaleFactor = maxExposure / totalExposure;

      for (const position of optimizedPositions) {
        position.recommendedSize *= scaleFactor;
        position.reason += ` (scaled ${(scaleFactor * 100).toFixed(1)}% for portfolio limit)`;
      }

      totalExposure = maxExposure;
    }

    return { positions: optimizedPositions, totalExposure };
  }

  private async calculateCorrelationAdjustments(
    originalPositions: Position[],
    optimizedPositions: OptimizedPosition[]
  ): Promise<CorrelationAdjustment[]> {
    const adjustments: CorrelationAdjustment[] = [];

    for (let i = 0; i < originalPositions.length; i++) {
      for (let j = i + 1; j < originalPositions.length; j++) {
        const pos1 = originalPositions[i];
        const pos2 = originalPositions[j];
        const correlation = await this.getPositionCorrelation(pos1, pos2);

        if (correlation > 0.5) {
          const opt1 = optimizedPositions.find(op => op.positionId === pos1.id);
          const opt2 = optimizedPositions.find(op => op.positionId === pos2.id);

          if (opt1 && opt2) {
            const avgAdjustment = (opt1.sizingRatio + opt2.sizingRatio) / 2;

            adjustments.push({
              positionPair: [pos1.id, pos2.id],
              correlationLevel: correlation,
              recommendedAdjustment: avgAdjustment,
              impact: correlation > 0.7 ? 'High correlation risk' : 'Medium correlation risk',
            });
          }
        }
      }
    }

    return adjustments;
  }

  private async applyDynamicScaling(
    positions: OptimizedPosition[],
    bankroll: number
  ): Promise<void> {
    // Apply dynamic scaling based on recent performance and market conditions
    const performanceScaling = await this.getPerformanceScaling();
    const marketConditionScaling = await this.getMarketConditionScaling();

    const totalScaling = performanceScaling * marketConditionScaling;

    if (totalScaling !== 1.0) {
      for (const position of positions) {
        position.recommendedSize *= totalScaling;
        position.reason += ` (dynamic scaling ${(totalScaling * 100).toFixed(1)}%)`;
      }
    }
  }

  private async getPerformanceScaling(): Promise<number> {
    // This would analyze recent performance to scale position sizes
    // Good performance = increase sizes, poor performance = decrease sizes
    return 1.0; // Neutral for now
  }

  private async getMarketConditionScaling(): Promise<number> {
    // This would analyze market volatility, liquidity, etc.
    // High volatility = smaller positions, stable markets = normal sizing
    return 1.0; // Neutral for now
  }

  private async adjustForCorrelations(
    position: Position,
    existingPositions: Position[],
    baseSize: number,
    limits: RiskLimits
  ): Promise<number> {
    let correlatedExposure = 0;

    for (const existingPos of existingPositions) {
      const correlation = await this.getPositionCorrelation(position, existingPos);
      if (correlation > 0.3) {
        correlatedExposure += existingPos.stake * correlation;
      }
    }

    const maxCorrelatedExposure =
      limits.maxCorrelatedExposure * (await this.getUserBankroll(position.userId));
    const availableCorrelatedCapacity = Math.max(0, maxCorrelatedExposure - correlatedExposure);

    return Math.min(baseSize, availableCorrelatedCapacity);
  }

  private async adjustForConcentration(
    position: Position,
    existingPositions: Position[],
    baseSize: number,
    limits: RiskLimits
  ): Promise<number> {
    // Group positions by asset class (sport/bet type)
    const assetClassExposure = this.calculateAssetClassExposure(position, existingPositions);
    const bankroll = await this.getUserBankroll(position.userId);
    const maxConcentration = bankroll * limits.concentrationLimit;

    const availableConcentrationCapacity = Math.max(0, maxConcentration - assetClassExposure);

    return Math.min(baseSize, availableConcentrationCapacity);
  }

  private calculateAssetClassExposure(position: Position, existingPositions: Position[]): number {
    const positionAssetClass = this.getAssetClass(position);

    return existingPositions
      .filter(pos => this.getAssetClass(pos) === positionAssetClass)
      .reduce((sum, pos) => sum + pos.stake, 0);
  }

  private getAssetClass(position: Position): string {
    // Group by sport and bet type category
    const sport = position.betType.split('_')[0];
    const category = position.betType.includes('prop') ? 'prop' : 'main';
    return `${sport}_${category}`;
  }

  private async getUserBankroll(userId: string): Promise<number> {
    const cached = await redisCache.get(`user:bankroll:${userId}`);
    return cached ? parseFloat(cached) : 1000; // Default bankroll
  }

  private async calculateRiskReduction(
    originalPositions: Position[],
    optimizedPositions: OptimizedPosition[]
  ): Promise<number> {
    // Simplified risk reduction calculation
    const originalRisk = originalPositions.reduce((sum, pos) => sum + pos.riskContribution, 0);
    const optimizedRisk = optimizedPositions.reduce(
      (sum, pos) => sum + (pos.recommendedSize / 1000) * 0.05,
      0
    ); // Simplified risk calculation

    return Math.max(0, (originalRisk - optimizedRisk) / originalRisk);
  }

  private async calculateExpectedReturnChange(
    originalPositions: Position[],
    optimizedPositions: OptimizedPosition[]
  ): Promise<number> {
    // Calculate change in expected returns from optimization
    let returnChange = 0;

    for (const optimized of optimizedPositions) {
      const original = originalPositions.find(p => p.id === optimized.positionId);
      if (original) {
        const sizeChange = optimized.recommendedSize - original.stake;
        returnChange += sizeChange * original.expectedValue;
      }
    }

    return returnChange;
  }

  private async calculateDiversificationImprovement(
    originalPositions: Position[],
    optimizedPositions: OptimizedPosition[]
  ): Promise<number> {
    // Measure improvement in diversification from optimization
    // This would calculate the diversification ratio before and after
    return 0.05; // 5% improvement placeholder
  }

  private async calculateRiskImpact(position: Position, sizeChange: number): Promise<number> {
    return sizeChange * position.volatility * 0.1; // Simplified risk impact
  }

  private async calculateReturnImpact(position: Position, sizeChange: number): Promise<number> {
    return sizeChange * position.expectedValue;
  }

  private determinePriority(
    sizingRatio: number,
    riskContribution: number
  ): 'high' | 'medium' | 'low' {
    const changeAmount = Math.abs(sizingRatio - 1);

    if (changeAmount > 0.5 || riskContribution > 0.1) return 'high';
    if (changeAmount > 0.2 || riskContribution > 0.05) return 'medium';
    return 'low';
  }

  private async storeSizingDecision(
    userId: string,
    optimization: PortfolioOptimization
  ): Promise<void> {
    const history = this.sizingHistory.get(userId) || [];
    history.push({
      timestamp: new Date(),
      optimization,
      positionCount: optimization.positions.length,
      totalExposure: optimization.totalRecommendedExposure,
    });

    // Keep only last 30 decisions
    if (history.length > 30) {
      history.shift();
    }

    this.sizingHistory.set(userId, history);

    // Cache the decision
    await redisCache.set(
      `position_sizer:decision:${userId}:${Date.now()}`,
      JSON.stringify(optimization),
      86400 // 24 hours TTL
    );
  }

  private async loadSizingHistory(): Promise<void> {
    try {
      const cachedHistory = await redisCache.getPattern('position_sizer:history:*');

      for (const [key, data] of cachedHistory) {
        const userId = key.split(':').pop();
        if (userId) {
          const history = JSON.parse(data);
          this.sizingHistory.set(userId, history);
        }
      }

      this.logger.info(`📋 Loaded sizing history for ${this.sizingHistory.size} users`);
    } catch (error) {
      this.logger.warn('⚠️ Failed to load sizing history from cache');
    }
  }

  private async loadBankrollTracking(): Promise<void> {
    // Load bankroll tracking data for dynamic sizing
    const defaultTracking = [1000, 1050, 1020, 1080, 1040]; // Sample bankroll history
    this.bankrollTracking.set('default', defaultTracking);
  }

  private async loadVolatilityModels(): Promise<void> {
    const models = {
      moneyline: { base_volatility: 0.3, adjustment_factor: 1.0 },
      spread: { base_volatility: 0.35, adjustment_factor: 1.1 },
      total: { base_volatility: 0.32, adjustment_factor: 1.05 },
      prop: { base_volatility: 0.45, adjustment_factor: 1.3 },
      live: { base_volatility: 0.55, adjustment_factor: 1.5 },
    };

    for (const [betType, model] of Object.entries(models)) {
      this.volatilityModels.set(betType, model);
    }
  }

  private async loadCorrelationData(): Promise<void> {
    // Load correlation data between different bet types and games
    try {
      const cached = await redisCache.get('position_sizer:correlations');
      if (cached) {
        const correlationData = JSON.parse(cached);
        this.correlationMatrix = new Map(correlationData);
      }
    } catch (error) {
      this.logger.warn('⚠️ Failed to load correlation data, using defaults');
    }
  }

  async isHealthy(): Promise<boolean> {
    return this.volatilityModels.size > 0;
  }

  async cleanup(): Promise<void> {
    // Save sizing history
    for (const [userId, history] of this.sizingHistory) {
      await redisCache.set(
        `position_sizer:history:${userId}`,
        JSON.stringify(history),
        86400 // 24 hours TTL
      );
    }

    this.sizingHistory.clear();
    this.bankrollTracking.clear();
    this.correlationMatrix.clear();
    this.volatilityModels.clear();

    this.logger.info('🧹 PositionSizer cleanup completed');
  }
}
