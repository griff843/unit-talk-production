/**
 * Portfolio Risk Manager
 * Implements correlation limits, portfolio caps, and position sizing controls
 */

import { Logger, createLogger } from '../utils/logger';
import { supabaseClient } from './supabaseClient';

export interface PortfolioLimits {
  // Position Size Limits
  maxSinglePositionSize: number;      // 25% max single position
  maxDailyPortfolioRisk: number;      // 100% max daily portfolio risk
  maxGameExposure: number;            // 40% max exposure to single game
  maxPlayerExposure: number;          // 30% max exposure to single player
  
  // Correlation Limits
  maxCorrelationThreshold: number;    // 0.7 max correlation between positions
  maxCorrelatedPositions: number;     // Max 3 highly correlated positions
  maxSameGamePositions: number;       // Max 4 positions per game
  maxSamePlayerPositions: number;     // Max 2 positions per player
  
  // Portfolio Concentration
  maxSportConcentration: number;      // 60% max in single sport
  maxTierConcentration: number;       // 80% max in S-tier picks
  maxBookmakerExposure: number;       // 50% max with single bookmaker
  
  // Risk Budgets
  dailyVARLimit: number;              // 15% daily Value-at-Risk limit
  weeklyDrawdownLimit: number;        // 25% weekly max drawdown
  monthlyVolatilityLimit: number;     // 30% monthly volatility limit
}

export interface CorrelationAnalysis {
  pickId: string;
  correlatedPositions: CorrelatedPosition[];
  averageCorrelation: number;
  maxCorrelation: number;
  correlationRisk: 'low' | 'medium' | 'high' | 'extreme';
  diversificationScore: number;
}

export interface CorrelatedPosition {
  pickId: string;
  propId: string;
  correlation: number;
  positionSize: number;
  riskContribution: number;
  type: 'same_game' | 'same_player' | 'statistical' | 'market_driven';
}

export interface PortfolioRisk {
  totalPositions: number;
  totalRisk: number;
  var95: number;                      // 95% Value-at-Risk
  expectedDrawdown: number;
  diversificationRatio: number;
  concentrationRisk: number;
  liquidityRisk: number;
  overallRisk: 'low' | 'medium' | 'high' | 'extreme';
}

export interface PositionSizingDecision {
  pickId: string;
  recommendedSize: number;
  maxAllowedSize: number;
  actualSize: number;
  approved: boolean;
  limitingFactor: string;
  riskAdjustment: number;
  reasoning: string;
}

class PortfolioRiskManager {
  private static instance: PortfolioRiskManager;
  private logger: Logger;
  
  // Production-grade risk limits
  private readonly LIMITS: PortfolioLimits = {
    maxSinglePositionSize: 0.25,       // 25% max single position
    maxDailyPortfolioRisk: 1.0,        // 100% max daily risk (Kelly sizing)
    maxGameExposure: 0.40,             // 40% max single game
    maxPlayerExposure: 0.30,           // 30% max single player
    
    maxCorrelationThreshold: 0.70,     // 70% max correlation
    maxCorrelatedPositions: 3,         // Max 3 correlated
    maxSameGamePositions: 4,           // Max 4 per game
    maxSamePlayerPositions: 2,         // Max 2 per player
    
    maxSportConcentration: 0.60,       // 60% max sport concentration
    maxTierConcentration: 0.80,        // 80% max S-tier
    maxBookmakerExposure: 0.50,        // 50% max single book
    
    dailyVARLimit: 0.15,               // 15% daily VaR limit
    weeklyDrawdownLimit: 0.25,         // 25% weekly drawdown
    monthlyVolatilityLimit: 0.30       // 30% monthly volatility
  };

  private constructor() {
    this.logger = createLogger('PortfolioRiskManager');
  }

  public static getInstance(): PortfolioRiskManager {
    if (!PortfolioRiskManager.instance) {
      PortfolioRiskManager.instance = new PortfolioRiskManager();
    }
    return PortfolioRiskManager.instance;
  }

  /**
   * Main portfolio risk assessment and position sizing
   */
  public async assessPositionRisk(pick: any, requestedSize: number): Promise<PositionSizingDecision> {
    this.logger.info('Assessing position risk', {
      pickId: pick.id,
      requestedSize,
      tier: pick.tier
    });

    // Get current portfolio state
    const portfolio = await this.getCurrentPortfolio();
    
    // Analyze correlations
    const correlationAnalysis = await this.analyzeCorrelations(pick, portfolio);
    
    // Calculate portfolio risk impact
    const riskImpact = await this.calculateRiskImpact(pick, requestedSize, portfolio);
    
    // Determine position sizing
    const sizingDecision = await this.determinePositionSize(
      pick,
      requestedSize,
      correlationAnalysis,
      riskImpact,
      portfolio
    );

    // Store risk assessment
    await this.storeRiskAssessment(pick, sizingDecision, correlationAnalysis, riskImpact);

    this.logger.info('Position risk assessment completed', {
      pickId: pick.id,
      approved: sizingDecision.approved,
      recommendedSize: sizingDecision.recommendedSize,
      limitingFactor: sizingDecision.limitingFactor
    });

    return sizingDecision;
  }

  /**
   * Analyze correlations with existing positions
   */
  private async analyzeCorrelations(pick: any, portfolio: any[]): Promise<CorrelationAnalysis> {
    const correlatedPositions: CorrelatedPosition[] = [];
    let totalCorrelation = 0;
    let maxCorrelation = 0;

    for (const position of portfolio) {
      const correlation = await this.calculateCorrelation(pick, position);
      
      if (Math.abs(correlation) > 0.1) { // Only include meaningful correlations
        const type = this.determineCorrelationType(pick, position);
        
        correlatedPositions.push({
          pickId: position.id,
          propId: position.prop_id,
          correlation,
          positionSize: position.kelly_fraction || 0,
          riskContribution: Math.abs(correlation) * position.kelly_fraction,
          type
        });
        
        totalCorrelation += Math.abs(correlation);
        maxCorrelation = Math.max(maxCorrelation, Math.abs(correlation));
      }
    }

    const averageCorrelation = correlatedPositions.length > 0 
      ? totalCorrelation / correlatedPositions.length 
      : 0;

    const correlationRisk = this.classifyCorrelationRisk(maxCorrelation, correlatedPositions.length);
    const diversificationScore = this.calculateDiversificationScore(correlatedPositions);

    return {
      pickId: pick.id,
      correlatedPositions,
      averageCorrelation,
      maxCorrelation,
      correlationRisk,
      diversificationScore
    };
  }

  /**
   * Calculate correlation between two picks
   */
  private async calculateCorrelation(pick1: any, pick2: any): Promise<number> {
    // Same game correlation
    if (pick1.game_id === pick2.game_id) {
      return this.calculateSameGameCorrelation(pick1, pick2);
    }
    
    // Same player correlation
    if (pick1.player_name === pick2.player_name) {
      return 0.85; // High correlation for same player props
    }
    
    // Statistical correlation based on historical data
    return await this.calculateStatisticalCorrelation(pick1, pick2);
  }

  /**
   * Calculate same-game correlation
   */
  private calculateSameGameCorrelation(pick1: any, pick2: any): number {
    const prop1 = pick1.stat_type || '';
    const prop2 = pick2.stat_type || '';
    
    // Highly correlated prop types
    const highCorrelationPairs = [
      ['points', 'assists'],       // 0.7
      ['points', 'rebounds'],      // 0.6
      ['passing_yards', 'passing_tds'], // 0.8
      ['rushing_yards', 'rushing_tds'], // 0.75
      ['receiving_yards', 'receptions'] // 0.85
    ];
    
    for (const [type1, type2, correlation] of highCorrelationPairs) {
      if ((prop1 === type1 && prop2 === type2) || (prop1 === type2 && prop2 === type1)) {
        return (correlation as number) || 0.7;
      }
    }
    
    // Same player, different props
    if (pick1.player_name === pick2.player_name) {
      return 0.85;
    }
    
    // Different players, same game
    return 0.25;
  }

  /**
   * Calculate statistical correlation using historical data
   */
  private async calculateStatisticalCorrelation(pick1: any, pick2: any): Promise<number> {
    try {
      // Query historical correlation data
      const { data } = await supabaseClient
        .from('correlation_matrix')
        .select('correlation')
        .eq('prop1_type', pick1.stat_type)
        .eq('prop2_type', pick2.stat_type)
        .eq('sport', pick1.sport)
        .single();
        
      return data?.correlation || 0;
    } catch (error) {
      this.logger.error('Failed to get statistical correlation', { error });
      return 0;
    }
  }

  /**
   * Determine correlation type
   */
  private determineCorrelationType(pick1: any, pick2: any): 'same_game' | 'same_player' | 'statistical' | 'market_driven' {
    if (pick1.game_id === pick2.game_id) {
      return pick1.player_name === pick2.player_name ? 'same_player' : 'same_game';
    }
    
    if (pick1.player_name === pick2.player_name) {
      return 'same_player';
    }
    
    // Check for market-driven correlation (same odds movement patterns)
    if (pick1.steam_strength && pick2.steam_strength && 
        Math.sign(pick1.steam_strength) === Math.sign(pick2.steam_strength)) {
      return 'market_driven';
    }
    
    return 'statistical';
  }

  /**
   * Calculate risk impact of adding new position
   */
  private async calculateRiskImpact(pick: any, size: number, portfolio: any[]): Promise<PortfolioRisk> {
    const currentRisk = await this.calculateCurrentPortfolioRisk(portfolio);
    
    // Calculate new position risk
    const positionRisk = size * (pick.variance || 0.2);
    
    // Calculate correlation impact
    let correlationImpact = 0;
    for (const position of portfolio) {
      const correlation = await this.calculateCorrelation(pick, position);
      correlationImpact += correlation * size * position.kelly_fraction * (position.variance || 0.2);
    }
    
    const newTotalRisk = Math.sqrt(
      Math.pow(currentRisk.totalRisk, 2) + 
      Math.pow(positionRisk, 2) + 
      2 * correlationImpact
    );
    
    // Calculate VaR impact
    const newVar95 = newTotalRisk * 1.645; // 95% VaR multiplier
    
    return {
      totalPositions: portfolio.length + 1,
      totalRisk: newTotalRisk,
      var95: newVar95,
      expectedDrawdown: newTotalRisk * 0.5,
      diversificationRatio: currentRisk.totalRisk / newTotalRisk,
      concentrationRisk: this.calculateConcentrationRisk(pick, size, portfolio),
      liquidityRisk: this.calculateLiquidityRisk(pick, size),
      overallRisk: this.classifyOverallRisk(newVar95, newTotalRisk)
    };
  }

  /**
   * Determine optimal position size
   */
  private async determinePositionSize(
    pick: any,
    requestedSize: number,
    correlationAnalysis: CorrelationAnalysis,
    riskImpact: PortfolioRisk,
    portfolio: any[]
  ): Promise<PositionSizingDecision> {
    let maxAllowedSize = requestedSize;
    let limitingFactor = 'none';
    let approved = true;

    // Check single position limit
    if (requestedSize > this.LIMITS.maxSinglePositionSize) {
      maxAllowedSize = this.LIMITS.maxSinglePositionSize;
      limitingFactor = 'single_position_limit';
    }

    // Check correlation limits
    if (correlationAnalysis.maxCorrelation > this.LIMITS.maxCorrelationThreshold) {
      const correlationAdjustment = 1 - (correlationAnalysis.maxCorrelation - this.LIMITS.maxCorrelationThreshold);
      const correlationAdjustedSize = requestedSize * correlationAdjustment;
      
      if (correlationAdjustedSize < maxAllowedSize) {
        maxAllowedSize = correlationAdjustedSize;
        limitingFactor = 'correlation_limit';
      }
    }

    // Check game exposure limit
    const gameExposure = await this.calculateGameExposure(pick, maxAllowedSize, portfolio);
    if (gameExposure > this.LIMITS.maxGameExposure) {
      const gameAdjustedSize = (this.LIMITS.maxGameExposure - this.getCurrentGameExposure(pick, portfolio)) / 1;
      if (gameAdjustedSize < maxAllowedSize && gameAdjustedSize > 0) {
        maxAllowedSize = gameAdjustedSize;
        limitingFactor = 'game_exposure_limit';
      } else if (gameAdjustedSize <= 0) {
        approved = false;
        maxAllowedSize = 0;
        limitingFactor = 'game_exposure_exceeded';
      }
    }

    // Check portfolio VaR limit
    if (riskImpact.var95 > this.LIMITS.dailyVARLimit) {
      approved = false;
      limitingFactor = 'var_limit_exceeded';
    }

    // Apply Kelly fraction sizing
    const kellySize = this.calculateOptimalKellySize(pick);
    const recommendedSize = Math.min(maxAllowedSize, kellySize);

    const riskAdjustment = recommendedSize / requestedSize;

    return {
      pickId: pick.id,
      recommendedSize,
      maxAllowedSize,
      actualSize: approved ? recommendedSize : 0,
      approved,
      limitingFactor,
      riskAdjustment,
      reasoning: this.generateSizingReasoning(limitingFactor, correlationAnalysis, riskImpact)
    };
  }

  /**
   * Helper calculation methods
   */
  private async getCurrentPortfolio(): Promise<any[]> {
    try {
      const { data } = await supabaseClient
        .from('unified_picks')
        .select('*')
        .eq('status', 'active')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours
        
      return data || [];
    } catch (error) {
      this.logger.error('Failed to get current portfolio', { error });
      return [];
    }
  }

  private async calculateCurrentPortfolioRisk(portfolio: any[]): Promise<PortfolioRisk> {
    if (portfolio.length === 0) {
      return {
        totalPositions: 0,
        totalRisk: 0,
        var95: 0,
        expectedDrawdown: 0,
        diversificationRatio: 1,
        concentrationRisk: 0,
        liquidityRisk: 0,
        overallRisk: 'low'
      };
    }

    // Simplified portfolio risk calculation
    const totalRisk = Math.sqrt(
      portfolio.reduce((sum, pick) => {
        return sum + Math.pow((pick.kelly_fraction || 0.1) * (pick.variance || 0.2), 2);
      }, 0)
    );

    return {
      totalPositions: portfolio.length,
      totalRisk,
      var95: totalRisk * 1.645,
      expectedDrawdown: totalRisk * 0.5,
      diversificationRatio: 0.8,
      concentrationRisk: this.calculateCurrentConcentrationRisk(portfolio),
      liquidityRisk: 0.05,
      overallRisk: this.classifyOverallRisk(totalRisk * 1.645, totalRisk)
    };
  }

  private classifyCorrelationRisk(maxCorrelation: number, correlatedCount: number): 'low' | 'medium' | 'high' | 'extreme' {
    if (maxCorrelation > 0.8 || correlatedCount > this.LIMITS.maxCorrelatedPositions) return 'extreme';
    if (maxCorrelation > 0.7 || correlatedCount > 2) return 'high';
    if (maxCorrelation > 0.5 || correlatedCount > 1) return 'medium';
    return 'low';
  }

  private calculateDiversificationScore(correlatedPositions: CorrelatedPosition[]): number {
    if (correlatedPositions.length === 0) return 1.0;
    
    const avgCorrelation = correlatedPositions.reduce((sum, pos) => sum + Math.abs(pos.correlation), 0) / correlatedPositions.length;
    return Math.max(0, 1 - avgCorrelation);
  }

  private calculateConcentrationRisk(pick: any, size: number, portfolio: any[]): number {
    // Calculate sport concentration
    const sportExposure = portfolio
      .filter(p => p.sport === pick.sport)
      .reduce((sum, p) => sum + (p.kelly_fraction || 0), 0) + size;
    
    return Math.max(0, sportExposure - this.LIMITS.maxSportConcentration);
  }

  private calculateCurrentConcentrationRisk(portfolio: any[]): number {
    const sportExposures = portfolio.reduce((acc, pick) => {
      acc[pick.sport] = (acc[pick.sport] || 0) + (pick.kelly_fraction || 0);
      return acc;
    }, {} as Record<string, number>);

    const exposureValues = Object.values(sportExposures) as number[];
    const maxSportExposure = exposureValues.length > 0 ? Math.max(...exposureValues) : 0;
    return Math.max(0, maxSportExposure - this.LIMITS.maxSportConcentration);
  }

  private calculateLiquidityRisk(pick: any, size: number): number {
    // Simplified liquidity risk based on market depth
    const marketDepth = pick.market_depth || 10000;
    const requiredLiquidity = size * 10000; // Assume $10k per 1% position
    
    return Math.max(0, (requiredLiquidity - marketDepth) / marketDepth);
  }

  private async calculateGameExposure(pick: any, size: number, portfolio: any[]): Promise<number> {
    const currentGameExposure = this.getCurrentGameExposure(pick, portfolio);
    return currentGameExposure + size;
  }

  private getCurrentGameExposure(pick: any, portfolio: any[]): number {
    return portfolio
      .filter(p => p.game_id === pick.game_id)
      .reduce((sum, p) => sum + (p.kelly_fraction || 0), 0);
  }

  private calculateOptimalKellySize(pick: any): number {
    const edge = pick.expected_value || 0.05;
    const confidence = pick.confidence || 0.75;
    const variance = pick.variance || 0.2;
    
    // Kelly fraction with variance adjustment
    return Math.max(0.01, Math.min(0.25, (edge * confidence) / variance));
  }

  private classifyOverallRisk(var95: number, totalRisk: number): 'low' | 'medium' | 'high' | 'extreme' {
    if (var95 > 0.25 || totalRisk > 0.5) return 'extreme';
    if (var95 > 0.15 || totalRisk > 0.3) return 'high';
    if (var95 > 0.10 || totalRisk > 0.2) return 'medium';
    return 'low';
  }

  private generateSizingReasoning(
    limitingFactor: string,
    correlationAnalysis: CorrelationAnalysis,
    riskImpact: PortfolioRisk
  ): string {
    switch (limitingFactor) {
      case 'single_position_limit':
        return `Position size limited to ${(this.LIMITS.maxSinglePositionSize * 100)}% maximum single position limit`;
      case 'correlation_limit':
        return `Position size reduced due to ${correlationAnalysis.maxCorrelation.toFixed(2)} correlation with existing positions`;
      case 'game_exposure_limit':
        return `Position size limited due to game exposure approaching ${(this.LIMITS.maxGameExposure * 100)}% limit`;
      case 'var_limit_exceeded':
        return `Position rejected: would exceed ${(this.LIMITS.dailyVARLimit * 100)}% daily VaR limit`;
      case 'game_exposure_exceeded':
        return `Position rejected: would exceed maximum game exposure limit`;
      default:
        return `Position approved with Kelly-optimized sizing and risk controls`;
    }
  }

  private async storeRiskAssessment(
    pick: any,
    sizing: PositionSizingDecision,
    correlation: CorrelationAnalysis,
    risk: PortfolioRisk
  ): Promise<void> {
    try {
      await supabaseClient
        .from('portfolio_risk_assessments')
        .insert({
          pick_id: pick.id,
          sizing_decision: sizing,
          correlation_analysis: correlation,
          risk_impact: risk,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      this.logger.error('Failed to store risk assessment', { error, pickId: pick.id });
    }
  }

  /**
   * Get portfolio risk statistics
   */
  public async getPortfolioStats(): Promise<{
    totalPositions: number;
    totalRisk: number;
    currentVar95: number;
    topCorrelations: Array<{ pick1: string; pick2: string; correlation: number }>;
    concentrationByGame: Record<string, number>;
    concentrationBySport: Record<string, number>;
    riskDistribution: Record<string, number>;
  }> {
    const portfolio = await this.getCurrentPortfolio();
    const risk = await this.calculateCurrentPortfolioRisk(portfolio);
    
    return {
      totalPositions: portfolio.length,
      totalRisk: risk.totalRisk,
      currentVar95: risk.var95,
      topCorrelations: [], // Would calculate top correlations
      concentrationByGame: {}, // Would calculate game concentrations
      concentrationBySport: {}, // Would calculate sport concentrations
      riskDistribution: {} // Would calculate risk distribution
    };
  }
}

export const portfolioRiskManager = PortfolioRiskManager.getInstance();