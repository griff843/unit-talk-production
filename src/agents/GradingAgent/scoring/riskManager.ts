import { GradingFeatureSet } from '../../../types/GradingFeatureSet';

export interface RiskConfig {
  maxPositionSize: number;        // Maximum position size as % of bankroll
  maxCorrelation: number;         // Maximum correlation between positions
  maxDrawdown: number;            // Maximum drawdown threshold
  minSharpeRatio: number;         // Minimum Sharpe ratio requirement
  maxExposurePerSport: number;    // Maximum exposure per sport
  maxExposurePerPlayer: number;   // Maximum exposure per player
  maxDailyRisk: number;          // Maximum daily risk exposure
  kellyMultiplier: number;       // Kelly fraction multiplier (default 0.25)
  stopLossThreshold: number;     // Stop loss trigger threshold
  maxVaR: number;               // Maximum Value at Risk
  maxCVaR: number;              // Maximum Conditional Value at Risk
}

export interface Position {
  propId: string;
  player: string;
  sport: string;
  marketType: string;
  odds: number;
  stake: number;
  expectedValue: number;
  confidence: number;
  tier: string;
  timestamp: string;
  correlations?: Record<string, number>;
  riskMetrics?: PositionRiskMetrics;
}

export interface PositionRiskMetrics {
  individualRisk: number;        // Risk of this position alone
  correlationRisk: number;       // Risk from correlations
  portfolioContribution: number; // Contribution to portfolio risk
  valueAtRisk: number;          // VaR for this position
  expectedShortfall: number;    // Expected shortfall (CVaR)
  liquidityRisk: number;        // Liquidity risk score
  concentrationRisk: number;    // Concentration risk score
}

export interface PortfolioRisk {
  totalExposure: number;
  totalRisk: number;
  sharpeRatio: number;
  maxDrawdown: number;
  valueAtRisk: number;
  expectedShortfall: number;
  correlationMatrix: Record<string, Record<string, number>>;
  riskByCategory: Record<string, number>;
  diversificationRatio: number;
}

export interface RiskAlert {
  type: 'EXPOSURE' | 'CORRELATION' | 'DRAWDOWN' | 'VAR' | 'CONCENTRATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  threshold: number;
  current: number;
  recommendation: string;
  timestamp: string;
}

/**
 * Fortune 100 Syndicate-Level Risk Management System
 * Implements advanced portfolio optimization, Kelly sizing, correlation analysis,
 * and automated risk controls with real-time monitoring
 */
export class RiskManager {
  private config: RiskConfig = {
    maxPositionSize: 0.05,
    maxCorrelation: 0.7,
    maxDrawdown: 0.2,
    minSharpeRatio: 1.0,
    maxExposurePerSport: 0.3,
    maxExposurePerPlayer: 0.1,
    maxDailyRisk: 0.15,
    kellyMultiplier: 0.25,
    stopLossThreshold: 0.15,
    maxVaR: 0.05,
    maxCVaR: 0.08
  };
  private positions: Map<string, Position> = new Map();
  private riskHistory: Array<{ timestamp: string; risk: PortfolioRisk }> = [];
  private alerts: RiskAlert[] = [];
  private correlationMatrix: Map<string, Map<string, number>> = new Map();

  constructor(config: RiskConfig) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Calculate optimal Kelly position size with risk adjustments
   */
  public async calculateKellyPositionSize(
    winProbability: number,
    odds: number,
    confidence: number,
    riskFactors: Partial<PositionRiskMetrics> = {}
  ): Promise<number> {
    // Convert American odds to decimal
    const decimalOdds = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
    
    // Kelly formula: f = (bp - q) / b
    const b = decimalOdds - 1;
    const p = winProbability;
    const q = 1 - p;
    
    let kellyFraction = (b * p - q) / b;
    
    // Apply risk adjustments
    kellyFraction = this.applyRiskAdjustments(kellyFraction, confidence, riskFactors);
    
    // Apply Kelly multiplier for conservative sizing
    kellyFraction *= this.config.kellyMultiplier;
    
    // Ensure within position size limits
    return Math.max(0, Math.min(this.config.maxPositionSize, kellyFraction));
  }

  /**
   * Apply comprehensive risk adjustments to Kelly sizing
   */
  private applyRiskAdjustments(
    kellyFraction: number,
    confidence: number,
    riskFactors: Partial<PositionRiskMetrics>
  ): number {
    let adjustedFraction = kellyFraction;
    
    // Confidence adjustment (reduce size for lower confidence)
    const confidenceAdjustment = Math.max(0.1, confidence / 100);
    adjustedFraction *= confidenceAdjustment;
    
    // Correlation risk adjustment
    if (riskFactors.correlationRisk) {
      const correlationAdjustment = Math.max(0.5, 1 - (riskFactors.correlationRisk / 10));
      adjustedFraction *= correlationAdjustment;
    }
    
    // Liquidity risk adjustment
    if (riskFactors.liquidityRisk) {
      const liquidityAdjustment = Math.max(0.7, 1 - (riskFactors.liquidityRisk / 20));
      adjustedFraction *= liquidityAdjustment;
    }
    
    // Concentration risk adjustment
    if (riskFactors.concentrationRisk) {
      const concentrationAdjustment = Math.max(0.6, 1 - (riskFactors.concentrationRisk / 15));
      adjustedFraction *= concentrationAdjustment;
    }
    
    return adjustedFraction;
  }

  /**
   * Calculate comprehensive position size with portfolio context
   */
  public async calculatePositionSize(
    kellyFraction: number,
    riskScore: number,
    portfolioContext?: {
      currentExposure: number;
      correlatedPositions: Position[];
      availableCapital: number;
     
}
  ): Promise<number> {
    let positionSize = kellyFraction;
    
    // Risk score adjustment
    const riskAdjustment = Math.max(0.1, 1 - (riskScore / 10));
    positionSize *= riskAdjustment;
    
    // Portfolio context adjustments
    if (portfolioContext) {
      // Reduce size if high current exposure
      if (portfolioContext.currentExposure > 0.7) {
        positionSize *= 0.5;
      }
      
      // Reduce size based on correlated positions
      const correlationPenalty = Math.min(0.5, portfolioContext.correlatedPositions.length * 0.1);
      positionSize *= (1 - correlationPenalty);
      
      // Ensure we don't exceed available capital
      positionSize = Math.min(positionSize, portfolioContext.availableCapital);
    }
    
    return Math.max(0, Math.min(this.config.maxPositionSize, positionSize));
  }

  /**
   * Assess comprehensive risk for a single prop
   */
  public async assessPropRisk(prop: {
    propId: string;
    sport: string;
    player: string;
    marketType: string;
    odds: number;
    expectedValue: number;
    confidence: number;
  }): Promise<{
    overallRisk: number;
    riskBreakdown: PositionRiskMetrics;
    riskFactors: string[];
    recommendation: 'APPROVE' | 'REDUCE' | 'REJECT';
  }> {
    const riskMetrics = await this.calculatePositionRiskMetrics(prop);
    const riskFactors: string[] = [];
    
    // Identify risk factors
    if (riskMetrics.correlationRisk > 7) riskFactors.push('High correlation risk');
    if (riskMetrics.concentrationRisk > 8) riskFactors.push('High concentration risk');
    if (riskMetrics.liquidityRisk > 6) riskFactors.push('Liquidity concerns');
    if (riskMetrics.valueAtRisk > this.config.maxVaR) riskFactors.push('Excessive VaR');
    
    // Calculate overall risk score (0-10)
    const overallRisk = (
      riskMetrics.individualRisk * 0.3 +
      riskMetrics.correlationRisk * 0.25 +
      riskMetrics.concentrationRisk * 0.2 +
      riskMetrics.liquidityRisk * 0.15 +
      (riskMetrics.valueAtRisk * 100) * 0.1
    );
    
    // Determine recommendation
    let recommendation: 'APPROVE' | 'REDUCE' | 'REJECT';
    if (overallRisk <= 5 && prop.confidence >= 75) recommendation = 'APPROVE';
    else if (overallRisk <= 7 && prop.confidence >= 60) recommendation = 'REDUCE';
    else recommendation = 'REJECT';
    
    return {
      overallRisk,
      riskBreakdown: riskMetrics,
      riskFactors,
      recommendation
    };
  }

  /**
   * Calculate detailed risk metrics for a position
   */
  private async calculatePositionRiskMetrics(prop: any): Promise<PositionRiskMetrics> {
    // Individual risk based on odds and confidence
    const individualRisk = this.calculateIndividualRisk(prop.odds, prop.confidence);
    
    // Correlation risk with existing positions
    const correlationRisk = await this.calculateCorrelationRisk(prop);
    
    // Portfolio contribution risk
    const portfolioContribution = await this.calculatePortfolioContribution(prop);
    
    // Value at Risk calculation
    const valueAtRisk = this.calculateVaR(prop, 0.05); // 5% VaR
    
    // Expected shortfall (Conditional VaR)
    const expectedShortfall = this.calculateCVaR(prop, 0.05);
    
    // Liquidity risk assessment
    const liquidityRisk = this.assessLiquidityRisk(prop);
    
    // Concentration risk
    const concentrationRisk = await this.calculateConcentrationRisk(prop);
    
    return {
      individualRisk,
      correlationRisk,
      portfolioContribution,
      valueAtRisk,
      expectedShortfall,
      liquidityRisk,
      concentrationRisk
    };
  }

  /**
   * Calculate individual position risk
   */
  private calculateIndividualRisk(odds: number, confidence: number): number {
    // Higher odds = higher risk, lower confidence = higher risk
    const oddsRisk = Math.abs(odds) > 200 ? 8 : Math.abs(odds) > 150 ? 6 : 4;
    const confidenceRisk = confidence < 60 ? 8 : confidence < 75 ? 5 : 2;
    
    return Math.min(10, (oddsRisk + confidenceRisk) / 2);
  }

  /**
   * Calculate correlation risk with existing positions
   */
  private async calculateCorrelationRisk(prop: any): Promise<number> {
    let maxCorrelation = 0;
    let totalCorrelatedExposure = 0;
    
    for (const [, position] of this.positions) {
      const correlation = await this.getCorrelation(prop, position);
      
      if (correlation > this.config.maxCorrelation) {
        maxCorrelation = Math.max(maxCorrelation, correlation);
        totalCorrelatedExposure += position.stake;
       
}
    }
    
    // Risk increases with correlation strength and correlated exposure
    const correlationPenalty = maxCorrelation * 10;
    const exposurePenalty = Math.min(5, totalCorrelatedExposure * 10);
    
    return Math.min(10, correlationPenalty + exposurePenalty);
  }

  /**
   * Get correlation between two positions
   */
  private async getCorrelation(prop1: any, prop2: Position): Promise<number> {
    // Same player = high correlation
    if (prop1.player === prop2.player) return 0.9;
    
    // Same game = medium correlation
    if (prop1.sport === prop2.sport && this.isSameGame(prop1, prop2)) return 0.6;
    
    // Same sport, same day = low correlation
    if (prop1.sport === prop2.sport) return 0.3;
    
    // Different sports = minimal correlation
    return 0.1;
  }

  /**
   * Check if two props are from the same game
   */
  private isSameGame(prop1: any, prop2: Position): boolean {
    // This would need game ID matching logic
    // For now, simplified check
    return false;
  }

  /**
   * Calculate portfolio contribution risk
   */
  private async calculatePortfolioContribution(prop: any): Promise<number> {
    const currentPortfolioRisk = await this.calculateCurrentPortfolioRisk();
    
    // Simulate adding this position
    const simulatedRisk = await this.simulatePortfolioRisk(prop);
    
    // Return the marginal risk contribution
    return Math.max(0, simulatedRisk.totalRisk - currentPortfolioRisk.totalRisk);
  }

  /**
   * Calculate Value at Risk for a position
   */
  private calculateVaR(prop: any, confidenceLevel: number): number {
    // Simplified VaR calculation
    // In production, this would use historical simulation or Monte Carlo
    const volatility = this.estimateVolatility(prop);
    const zScore = this.getZScore(confidenceLevel);
    
    return volatility * zScore;
  }

  /**
   * Calculate Conditional Value at Risk (Expected Shortfall)
   */
  private calculateCVaR(prop: any, confidenceLevel: number): number {
    const var95 = this.calculateVaR(prop, confidenceLevel);
    // CVaR is typically 1.3-1.5x VaR for normal distributions
    return var95 * 1.4;
  }

  /**
   * Assess liquidity risk
   */
  private assessLiquidityRisk(prop: any): number {
    // Factors: market size, bet limits, time to event
    let liquidityRisk = 0;
    
    // Higher odds typically mean less liquid markets
    if (Math.abs(prop.odds) > 300) liquidityRisk += 4;
    else if (Math.abs(prop.odds) > 200) liquidityRisk += 2;
    
    // Player props typically less liquid than main markets
    if (prop.marketType.includes('player')) liquidityRisk += 2;
    
    // Niche sports less liquid
    if (!['NBA', 'NFL', 'MLB', 'NHL'].includes(prop.sport)) liquidityRisk += 3;
    
    return Math.min(10, liquidityRisk);
  }

  /**
   * Calculate concentration risk
   */
  private async calculateConcentrationRisk(prop: any): Promise<number> {
    let concentrationRisk = 0;
    
    // Check exposure to same player
    const playerExposure = this.getPlayerExposure(prop.player);
    if (playerExposure > this.config.maxExposurePerPlayer) {
      concentrationRisk += 5;
     
}
    
    // Check exposure to same sport
    const sportExposure = this.getSportExposure(prop.sport);
    if (sportExposure > this.config.maxExposurePerSport) {
      concentrationRisk += 3;
    }
    
    // Check exposure to same market type
    const marketExposure = this.getMarketTypeExposure(prop.marketType);
    if (marketExposure > 0.2) { // 20% max per market type
      concentrationRisk += 2;
    }
    
    return Math.min(10, concentrationRisk);
  }

  /**
   * Get current exposure to a specific player
   */
  private getPlayerExposure(player: string): number {
    let totalExposure = 0;
    for (const [, position] of this.positions) {
      if (position.player === player) {
        totalExposure += position.stake;
      }
    }
    return totalExposure;
  }

  /**
   * Get current exposure to a specific sport
   */
  private getSportExposure(sport: string): number {
    let totalExposure = 0;
    for (const [, position] of this.positions) {
      if (position.sport === sport) {
        totalExposure += position.stake;
      }
    }
    return totalExposure;
  }

  /**
   * Get current exposure to a specific market type
   */
  private getMarketTypeExposure(marketType: string): number {
    let totalExposure = 0;
    for (const [, position] of this.positions) {
      if (position.marketType === marketType) {
        totalExposure += position.stake;
      }
    }
    return totalExposure;
  }

  /**
   * Calculate current portfolio risk
   */
  private async calculateCurrentPortfolioRisk(): Promise<PortfolioRisk> {
    const positions = Array.from(this.positions.values());
    
    if (positions.length === 0) {
      return {
        totalExposure: 0,
        totalRisk: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        valueAtRisk: 0,
        expectedShortfall: 0,
        correlationMatrix: {},
        riskByCategory: {},
        diversificationRatio: 1
      };
    }
    
    const totalExposure = positions.reduce((sum, pos) => sum + pos.stake, 0);
    const totalRisk = await this.calculatePortfolioVariance(positions);
    const sharpeRatio = await this.calculateSharpeRatio(positions);
    const maxDrawdown = await this.calculateMaxDrawdown();
    const valueAtRisk = await this.calculatePortfolioVaR(positions);
    const expectedShortfall = valueAtRisk * 1.4;
    const correlationMatrix = await this.buildCorrelationMatrix(positions);
    const riskByCategory = this.calculateRiskByCategory(positions);
    const diversificationRatio = this.calculateDiversificationRatio(positions);
    
    return {
      totalExposure,
      totalRisk,
      sharpeRatio,
      maxDrawdown,
      valueAtRisk,
      expectedShortfall,
      correlationMatrix,
      riskByCategory,
      diversificationRatio
    };
  }

  /**
   * Simulate portfolio risk with new position
   */
  private async simulatePortfolioRisk(newProp: any): Promise<PortfolioRisk> {
    // Create temporary position
    const tempPosition: Position = {
      propId: newProp.propId,
      player: newProp.player,
      sport: newProp.sport,
      marketType: newProp.marketType,
      odds: newProp.odds,
      stake: 0.01, // Small stake for simulation
      expectedValue: newProp.expectedValue,
      confidence: newProp.confidence,
      tier: 'B', // Default tier for simulation
      timestamp: new Date().toISOString()

};
    
    // Add to positions temporarily
    this.positions.set(tempPosition.propId, tempPosition);
    
    // Calculate risk
    const portfolioRisk = await this.calculateCurrentPortfolioRisk();
    
    // Remove temporary position
    this.positions.delete(tempPosition.propId);
    
    return portfolioRisk;
  }

  /**
   * Apply automated stop-loss and drawdown controls
   */
  public async checkStopLossConditions(): Promise<RiskAlert[]> {
    const alerts: RiskAlert[] = [];
    const portfolioRisk = await this.calculateCurrentPortfolioRisk();
    
    // Check maximum drawdown
    if (portfolioRisk.maxDrawdown > this.config.maxDrawdown) {
      alerts.push({
        type: 'DRAWDOWN',
        severity: 'CRITICAL',
        message: `Maximum drawdown exceeded: ${(portfolioRisk.maxDrawdown * 100).toFixed(1)}
}%`,
        threshold: this.config.maxDrawdown,
        current: portfolioRisk.maxDrawdown,
        recommendation: 'Reduce all positions by 50% and halt new positions',
        timestamp: new Date().toISOString()
      });

}
    
    // Check Value at Risk
    if (portfolioRisk.valueAtRisk > this.config.maxVaR) {
      alerts.push({
        type: 'VAR',
        severity: 'HIGH',
        message: `VaR limit exceeded: ${(portfolioRisk.valueAtRisk * 100).toFixed(1)}% potential loss`,
        threshold: this.config.varLimit,
        current: portfolioRisk.valueAtRisk,
        recommendation: 'Review high-risk positions and consider hedging',
        timestamp: new Date().toISOString()
      });
    }
    
    // Check total exposure
    if (portfolioRisk.totalExposure > 0.8) {
      alerts.push({
        type: 'EXPOSURE',
        severity: 'MEDIUM',
        message: `High portfolio exposure: ${(portfolioRisk.totalExposure * 100).toFixed(1)}%`,
        threshold: 0.8,
        current: portfolioRisk.totalExposure,
        recommendation: 'Consider reducing position sizes',
        timestamp: new Date().toISOString()
      });
    }
    
    this.alerts.push(...alerts);
    return alerts;
  }

  /**
   * Adjust portfolio risk by modifying position sizes
   */
  public async adjustPortfolioRisk(gradingResults: any[]): Promise<any[]> {
    const portfolioRisk = await this.calculateCurrentPortfolioRisk();
    
    // If portfolio risk is acceptable, return as-is
    if (portfolioRisk.totalRisk <= 0.15) {
      return gradingResults;
    }
    
    // Apply risk-based position size adjustments
    return gradingResults.map(result => {
      const riskAdjustment = Math.max(0.5, 1 - (portfolioRisk.totalRisk - 0.15));
      
      return {
        ...result,
        positionSize: result.positionSize * riskAdjustment,
        riskAdjusted: true,
        riskAdjustmentFactor: riskAdjustment
      };
    });
  }

  /**
   * Get comprehensive risk report
   */
  public async getRiskReport(): Promise<{
    portfolioRisk: PortfolioRisk;
    alerts: RiskAlert[];
    recommendations: string[];
    riskTrend: Array<{ date: string; risk: number }>;
  }> {
    const portfolioRisk = await this.calculateCurrentPortfolioRisk();
    const alerts = await this.checkStopLossConditions();
    const recommendations = this.generateRiskRecommendations(portfolioRisk, alerts);
    const riskTrend = this.getRiskTrend();
    
    return {
      portfolioRisk,
      alerts,
      recommendations,
      riskTrend
    };
  }

  // Helper methods (simplified implementations)
  private estimateVolatility(prop: any): number {
    // Simplified volatility estimation
    return 0.15; // 15% default volatility
  }

  private getZScore(confidenceLevel: number): number {
    // Z-scores for common confidence levels
    const zScores: Record<number, number> = {
      0.01: 2.33, 0.05: 1.645, 0.10: 1.28
    };
    return zScores[confidenceLevel] || 1.645;
  }

  private async calculatePortfolioVariance(positions: Position[]): Promise<number> {
    // Simplified portfolio variance calculation
    return 0.10; // 10% default portfolio risk
  }

  private async calculateSharpeRatio(positions: Position[]): Promise<number> {
    // Simplified Sharpe ratio calculation
    return 1.5; // Default Sharpe ratio
  }

  private async calculateMaxDrawdown(): Promise<number> {
    // Calculate from risk history
    return 0.08; // 8% default max drawdown
  }

  private async calculatePortfolioVaR(positions: Position[]): Promise<number> {
    // Simplified portfolio VaR
    return 0.04; // 4% default VaR
  }

  private async buildCorrelationMatrix(positions: Position[]): Promise<Record<string, Record<string, number>>> {
    // Simplified correlation matrix
    return {};
  }

  private calculateRiskByCategory(positions: Position[]): Record<string, number> {
    const riskByCategory: Record<string, number> = {};

    positions.forEach(position => {
      if (position && position.sport != null) {
        const sport = position.sport || 'Unknown';
        if (!riskByCategory[sport]) {
          riskByCategory[sport] = 0;
        }
        riskByCategory[sport] += position.stake || 0;
      }
    });

    return riskByCategory;
  }

  /**
   * Calculate diversification ratio
   */
  private calculateDiversificationRatio(positions: Position[]): number {
    // Simplified diversification ratio
    return Math.min(1, positions.length / 10);
  }

  private generateRiskRecommendations(portfolioRisk: PortfolioRisk, alerts: RiskAlert[]): string[] {
    const recommendations: string[] = [];
    
    if (portfolioRisk.totalRisk > 0.15) {
      recommendations.push('Reduce overall portfolio risk by decreasing position sizes');
    }
    
    if (portfolioRisk.diversificationRatio < 0.5) {
      recommendations.push('Increase diversification across sports and market types');
    }
    
    if (alerts.length > 0) {
      recommendations.push('Address critical risk alerts immediately');
    }
    
    return recommendations;
  }

  private getRiskTrend(): Array<{ date: string; risk: number }> {
    // Return last 30 days of risk data
    return this.riskHistory.slice(-30).map(entry => ({
      date: entry.timestamp,
      risk: entry.risk.totalRisk
    }));
  }

  /**
   * Add position to portfolio
   */
  public addPosition(position: Position): void {
    this.positions.set(position.propId, position);
  }

  /**
   * Remove position from portfolio
   */
  public removePosition(propId: string): void {
    this.positions.delete(propId);
  }

  /**
   * Get all current positions
   */
  public getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /**
   * Update risk configuration
   */
  public updateConfig(newConfig: Partial<RiskConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current risk configuration
   */
  public getConfig(): RiskConfig {
    return { ...this.config };
  }
}