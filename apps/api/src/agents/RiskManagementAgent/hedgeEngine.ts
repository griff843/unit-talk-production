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

interface HedgeOpportunity {
  id: string;
  type: 'direct_hedge' | 'correlation_hedge' | 'portfolio_hedge' | 'insurance_hedge';
  originalPosition: string;
  hedgeInstrument: HedgeInstrument;
  effectiveness: number;
  cost: number;
  riskReduction: number;
  returnImpact: number;
  timeDecay: number;
  recommendation: HedgeRecommendation;
  priority: 'high' | 'medium' | 'low';
  expirationTime: Date;
}

interface HedgeInstrument {
  type: 'opposite_bet' | 'correlated_bet' | 'insurance_bet' | 'spread_adjustment';
  gameId?: string;
  betType: string;
  suggestedStake: number;
  suggestedOdds: number;
  description: string;
  availability: 'high' | 'medium' | 'low';
  liquidityScore: number;
}

interface HedgeRecommendation {
  action: 'hedge_now' | 'hedge_conditional' | 'monitor' | 'no_hedge';
  reason: string;
  conditions?: string[];
  triggerEvents?: string[];
  timeframe: string;
  confidence: number;
}

interface HedgeAnalysis {
  portfolioRisk: number;
  hedgeOpportunities: HedgeOpportunity[];
  totalPotentialRiskReduction: number;
  recommendedHedges: HedgeOpportunity[];
  hedgingCost: number;
  netBenefit: number;
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
}

interface MarketConditions {
  volatility: number;
  liquidity: number;
  spread: number;
  momentum: number;
  timeToEvent: number;
  marketSentiment: 'bullish' | 'bearish' | 'neutral';
}

interface HedgePerformance {
  hedgeId: string;
  effectiveness: number;
  cost: number;
  actualRiskReduction: number;
  returnImpact: number;
  accuracy: number;
  lessons: string[];
}

export class HedgeEngine {
  private readonly logger: Logger;
  private hedgeHistory: Map<string, HedgeOpportunity[]> = new Map();
  private marketData: Map<string, MarketConditions> = new Map();
  private hedgePerformance: Map<string, HedgePerformance[]> = new Map();
  private hedgeStrategies: Map<string, any> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.info('🛡️ Initializing HedgeEngine');
    
    await this.loadHedgeStrategies();
    await this.loadMarketData();
    await this.loadHedgeHistory();
    await this.loadPerformanceData();
    
    this.logger.info('✅ HedgeEngine initialized');
  }

  async identifyHedgeOpportunities(
    positions: Position[],
    correlations: Map<string, number>
  ): Promise<HedgeOpportunity[]> {
    
    this.logger.info('🔍 Identifying hedge opportunities', {
      positionCount: positions.length,
      correlationPairs: correlations.size
    });

    try {
      const opportunities: HedgeOpportunity[] = [];

      // 1. Direct hedging opportunities
      const directHedges = await this.identifyDirectHedges(positions);
      opportunities.push(...directHedges);

      // 2. Correlation-based hedges
      const correlationHedges = await this.identifyCorrelationHedges(positions, correlations);
      opportunities.push(...correlationHedges);

      // 3. Portfolio-level hedges
      const portfolioHedges = await this.identifyPortfolioHedges(positions);
      opportunities.push(...portfolioHedges);

      // 4. Insurance hedges for high-risk positions
      const insuranceHedges = await this.identifyInsuranceHedges(positions);
      opportunities.push(...insuranceHedges);

      // 5. Dynamic hedges based on market conditions
      const dynamicHedges = await this.identifyDynamicHedges(positions);
      opportunities.push(...dynamicHedges);

      // Filter and rank opportunities
      const viableOpportunities = await this.filterViableOpportunities(opportunities);
      const rankedOpportunities = await this.rankOpportunities(viableOpportunities);

      this.logger.info('✅ Hedge opportunities identified', {
        totalOpportunities: opportunities.length,
        viableOpportunities: viableOpportunities.length,
        highPriority: rankedOpportunities.filter(h => h.priority === 'high').length
      });

      // Cache opportunities
      await this.cacheHedgeOpportunities(positions[0]?.userId || 'unknown', rankedOpportunities);

      return rankedOpportunities;

    } catch (error) {
      this.logger.error('❌ Failed to identify hedge opportunities', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  async analyzeHedgingNeed(
    positions: Position[],
    riskTolerance: number = 0.1
  ): Promise<HedgeAnalysis> {
    
    this.logger.info('📊 Analyzing hedging need', {
      positionCount: positions.length,
      riskTolerance
    });

    try {
      // Calculate portfolio risk
      const portfolioRisk = await this.calculatePortfolioRisk(positions);
      
      // Identify all hedge opportunities
      const correlations = await this.calculateCorrelations(positions);
      const hedgeOpportunities = await this.identifyHedgeOpportunities(positions, correlations);
      
      // Select recommended hedges based on risk tolerance
      const recommendedHedges = await this.selectOptimalHedges(
        hedgeOpportunities,
        portfolioRisk,
        riskTolerance
      );

      // Calculate metrics
      const totalPotentialRiskReduction = recommendedHedges
        .reduce((sum, hedge) => sum + hedge.riskReduction, 0);
      
      const hedgingCost = recommendedHedges
        .reduce((sum, hedge) => sum + hedge.cost, 0);
      
      const netBenefit = totalPotentialRiskReduction - hedgingCost;

      const analysis: HedgeAnalysis = {
        portfolioRisk,
        hedgeOpportunities,
        totalPotentialRiskReduction,
        recommendedHedges,
        hedgingCost,
        netBenefit,
        riskProfile: this.determineRiskProfile(portfolioRisk, riskTolerance)
      };

      this.logger.info('✅ Hedge analysis completed', {
        portfolioRisk: portfolioRisk.toFixed(3),
        opportunities: hedgeOpportunities.length,
        recommended: recommendedHedges.length,
        netBenefit: netBenefit.toFixed(3)
      });

      return analysis;

    } catch (error) {
      this.logger.error('❌ Failed to analyze hedging need', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        portfolioRisk: 0,
        hedgeOpportunities: [],
        totalPotentialRiskReduction: 0,
        recommendedHedges: [],
        hedgingCost: 0,
        netBenefit: 0,
        riskProfile: 'moderate'
      };
    }
  }

  async executeHedgeRecommendation(
    hedgeOpportunity: HedgeOpportunity,
    userId: string
  ): Promise<boolean> {
    
    this.logger.info('⚡ Executing hedge recommendation', {
      hedgeId: hedgeOpportunity.id,
      type: hedgeOpportunity.type,
      userId
    });

    try {
      // Validate hedge is still viable
      const isViable = await this.validateHedgeViability(hedgeOpportunity);
      if (!isViable) {
        this.logger.warn('⚠️ Hedge no longer viable', { hedgeId: hedgeOpportunity.id });
        return false;
      }

      // Check user permissions and limits
      const canExecute = await this.checkExecutionPermissions(hedgeOpportunity, userId);
      if (!canExecute) {
        this.logger.warn('⚠️ Cannot execute hedge - permission denied', { hedgeId: hedgeOpportunity.id });
        return false;
      }

      // Execute the hedge (this would integrate with actual trading/betting systems)
      const executionResult = await this.executeHedge(hedgeOpportunity, userId);
      
      if (executionResult) {
        // Record execution for performance tracking
        await this.recordHedgeExecution(hedgeOpportunity, userId);
        
        this.logger.info('✅ Hedge executed successfully', {
          hedgeId: hedgeOpportunity.id,
          type: hedgeOpportunity.type
        });
      }

      return executionResult;

    } catch (error) {
      this.logger.error('❌ Failed to execute hedge', {
        hedgeId: hedgeOpportunity.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async monitorActiveHedges(userId: string): Promise<HedgeOpportunity[]> {
    this.logger.info('👁️ Monitoring active hedges', { userId });

    try {
      const activeHedges = await this.getActiveHedges(userId);
      const updatedHedges: HedgeOpportunity[] = [];

      for (const hedge of activeHedges) {
        // Update hedge effectiveness based on current market conditions
        const updatedHedge = await this.updateHedgeEffectiveness(hedge);
        
        // Check if hedge should be adjusted or closed
        if (await this.shouldAdjustHedge(updatedHedge)) {
          updatedHedge.recommendation = await this.generateAdjustmentRecommendation(updatedHedge);
        }

        updatedHedges.push(updatedHedge);
      }

      // Cache updated hedge data
      await this.cacheActiveHedges(userId, updatedHedges);

      return updatedHedges;

    } catch (error) {
      this.logger.error('❌ Failed to monitor active hedges', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  // Private Methods - Hedge Identification
  private async identifyDirectHedges(positions: Position[]): Promise<HedgeOpportunity[]> {
    const directHedges: HedgeOpportunity[] = [];

    for (const position of positions) {
      // Only hedge high-risk or high-value positions
      if (position.riskContribution > 0.1 || position.stake > 500) {
        const hedgeOpportunity = await this.createDirectHedge(position);
        if (hedgeOpportunity) {
          directHedges.push(hedgeOpportunity);
        }
      }
    }

    return directHedges;
  }

  private async createDirectHedge(position: Position): Promise<HedgeOpportunity | null> {
    const hedgeInstrument = await this.findOppositeHedge(position);
    if (!hedgeInstrument) return null;

    const effectiveness = await this.calculateHedgeEffectiveness(position, hedgeInstrument);
    const cost = await this.calculateHedgeCost(position, hedgeInstrument);
    const riskReduction = effectiveness * position.riskContribution;

    return {
      id: `direct_${position.id}_${Date.now()}`,
      type: 'direct_hedge',
      originalPosition: position.id,
      hedgeInstrument,
      effectiveness,
      cost,
      riskReduction,
      returnImpact: -cost,
      timeDecay: await this.calculateTimeDecay(position),
      recommendation: await this.generateDirectHedgeRecommendation(effectiveness, cost),
      priority: this.determinePriority(effectiveness, cost, riskReduction),
      expirationTime: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
  }

  private async findOppositeHedge(position: Position): Promise<HedgeInstrument | null> {
    // Find the opposite bet for the same game
    const oppositeHedge: HedgeInstrument = {
      type: 'opposite_bet',
      gameId: position.gameId,
      betType: this.getOppositeBetType(position.betType),
      suggestedStake: position.stake * 0.8, // Partial hedge
      suggestedOdds: await this.getOppositeOdds(position),
      description: `Opposite ${position.betType} for ${position.gameId}`,
      availability: 'high',
      liquidityScore: 0.8
    };

    return oppositeHedge;
  }

  private getOppositeBetType(betType: string): string {
    // Map bet types to their opposites
    const oppositeMap: Record<string, string> = {
      'moneyline_home': 'moneyline_away',
      'moneyline_away': 'moneyline_home',
      'spread_over': 'spread_under',
      'spread_under': 'spread_over',
      'total_over': 'total_under',
      'total_under': 'total_over'
    };

    return oppositeMap[betType] || `opposite_${betType}`;
  }

  private async getOppositeOdds(position: Position): Promise<number> {
    // This would fetch real market odds for the opposite bet
    // For now, calculate based on original odds
    const impliedProbability = 1 / position.odds;
    const oppositeImpliedProbability = 1 - impliedProbability;
    return 1 / oppositeImpliedProbability;
  }

  private async identifyCorrelationHedges(
    positions: Position[],
    correlations: Map<string, number>
  ): Promise<HedgeOpportunity[]> {
    
    const correlationHedges: HedgeOpportunity[] = [];

    // Find highly correlated position pairs
    for (const [pairKey, correlation] of correlations) {
      if (correlation > 0.7) {
        const [pos1Id, pos2Id] = pairKey.split('_');
        const pos1 = positions.find(p => p.id === pos1Id);
        const pos2 = positions.find(p => p.id === pos2Id);

        if (pos1 && pos2) {
          const hedge = await this.createCorrelationHedge(pos1, pos2, correlation);
          if (hedge) {
            correlationHedges.push(hedge);
          }
        }
      }
    }

    return correlationHedges;
  }

  private async createCorrelationHedge(
    pos1: Position,
    pos2: Position,
    correlation: number
  ): Promise<HedgeOpportunity | null> {
    
    // Create hedge to reduce correlation risk
    const hedgeInstrument: HedgeInstrument = {
      type: 'correlated_bet',
      gameId: pos1.gameId !== pos2.gameId ? undefined : pos1.gameId,
      betType: `negative_correlation_${pos1.betType}_${pos2.betType}`,
      suggestedStake: Math.min(pos1.stake, pos2.stake) * 0.3,
      suggestedOdds: 2.0, // Estimated
      description: `Hedge to reduce correlation between ${pos1.id} and ${pos2.id}`,
      availability: 'medium',
      liquidityScore: 0.6
    };

    const effectiveness = correlation * 0.8; // High correlation = high hedge effectiveness
    const cost = hedgeInstrument.suggestedStake * 0.05; // 5% cost
    const riskReduction = (pos1.riskContribution + pos2.riskContribution) * effectiveness * 0.5;

    return {
      id: `correlation_${pos1.id}_${pos2.id}_${Date.now()}`,
      type: 'correlation_hedge',
      originalPosition: `${pos1.id},${pos2.id}`,
      hedgeInstrument,
      effectiveness,
      cost,
      riskReduction,
      returnImpact: -cost,
      timeDecay: 0.05, // Low time decay for correlation hedges
      recommendation: await this.generateCorrelationHedgeRecommendation(correlation, effectiveness),
      priority: correlation > 0.8 ? 'high' : 'medium',
      expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };
  }

  private async identifyPortfolioHedges(positions: Position[]): Promise<HedgeOpportunity[]> {
    if (positions.length < 3) return []; // Need multiple positions for portfolio hedge

    const totalExposure = positions.reduce((sum, pos) => sum + pos.stake, 0);
    const totalRisk = positions.reduce((sum, pos) => sum + pos.riskContribution, 0);

    // Only suggest portfolio hedge if total risk is high
    if (totalRisk < 0.2) return [];

    const hedgeInstrument: HedgeInstrument = {
      type: 'insurance_bet',
      betType: 'portfolio_insurance',
      suggestedStake: totalExposure * 0.1, // 10% of total exposure
      suggestedOdds: 1.5,
      description: 'Portfolio-wide insurance hedge',
      availability: 'medium',
      liquidityScore: 0.5
    };

    const effectiveness = 0.7;
    const cost = hedgeInstrument.suggestedStake * 0.1;
    const riskReduction = totalRisk * effectiveness;

    return [{
      id: `portfolio_${Date.now()}`,
      type: 'portfolio_hedge',
      originalPosition: positions.map(p => p.id).join(','),
      hedgeInstrument,
      effectiveness,
      cost,
      riskReduction,
      returnImpact: -cost,
      timeDecay: 0.02,
      recommendation: await this.generatePortfolioHedgeRecommendation(totalRisk, effectiveness),
      priority: totalRisk > 0.3 ? 'high' : 'medium',
      expirationTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
    }];
  }

  private async identifyInsuranceHedges(positions: Position[]): Promise<HedgeOpportunity[]> {
    const insuranceHedges: HedgeOpportunity[] = [];

    for (const position of positions) {
      // Insurance for high-value, high-risk positions
      if (position.stake > 1000 && position.riskContribution > 0.15) {
        const hedge = await this.createInsuranceHedge(position);
        if (hedge) {
          insuranceHedges.push(hedge);
        }
      }
    }

    return insuranceHedges;
  }

  private async createInsuranceHedge(position: Position): Promise<HedgeOpportunity | null> {
    const hedgeInstrument: HedgeInstrument = {
      type: 'insurance_bet',
      gameId: position.gameId,
      betType: `insurance_${position.betType}`,
      suggestedStake: position.stake * 0.2, // 20% insurance
      suggestedOdds: 2.5,
      description: `Insurance hedge for high-value position ${position.id}`,
      availability: 'medium',
      liquidityScore: 0.7
    };

    const effectiveness = 0.8;
    const cost = hedgeInstrument.suggestedStake * 0.15;
    const riskReduction = position.riskContribution * effectiveness;

    return {
      id: `insurance_${position.id}_${Date.now()}`,
      type: 'insurance_hedge',
      originalPosition: position.id,
      hedgeInstrument,
      effectiveness,
      cost,
      riskReduction,
      returnImpact: -cost,
      timeDecay: await this.calculateTimeDecay(position),
      recommendation: await this.generateInsuranceHedgeRecommendation(position, effectiveness),
      priority: 'high',
      expirationTime: new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 hours
    };
  }

  private async identifyDynamicHedges(positions: Position[]): Promise<HedgeOpportunity[]> {
    // Dynamic hedges based on market conditions and volatility
    const dynamicHedges: HedgeOpportunity[] = [];
    
    for (const position of positions) {
      const marketConditions = await this.getMarketConditions(position.gameId);
      
      // High volatility or adverse market conditions trigger dynamic hedges
      if (marketConditions.volatility > 0.3 || marketConditions.momentum < -0.2) {
        const hedge = await this.createDynamicHedge(position, marketConditions);
        if (hedge) {
          dynamicHedges.push(hedge);
        }
      }
    }

    return dynamicHedges;
  }

  private async createDynamicHedge(
    position: Position,
    marketConditions: MarketConditions
  ): Promise<HedgeOpportunity | null> {
    
    const hedgeSize = position.stake * Math.min(0.5, marketConditions.volatility);
    
    const hedgeInstrument: HedgeInstrument = {
      type: 'spread_adjustment',
      gameId: position.gameId,
      betType: `dynamic_hedge_${position.betType}`,
      suggestedStake: hedgeSize,
      suggestedOdds: 1.8,
      description: `Dynamic hedge based on market volatility (${(marketConditions.volatility * 100).toFixed(1)}%)`,
      availability: 'high',
      liquidityScore: marketConditions.liquidity
    };

    const effectiveness = Math.min(0.9, marketConditions.volatility * 2);
    const cost = hedgeSize * 0.08;
    const riskReduction = position.riskContribution * effectiveness;

    return {
      id: `dynamic_${position.id}_${Date.now()}`,
      type: 'portfolio_hedge',
      originalPosition: position.id,
      hedgeInstrument,
      effectiveness,
      cost,
      riskReduction,
      returnImpact: -cost,
      timeDecay: marketConditions.timeToEvent / 24, // Higher time decay closer to event
      recommendation: await this.generateDynamicHedgeRecommendation(marketConditions, effectiveness),
      priority: marketConditions.volatility > 0.4 ? 'high' : 'medium',
      expirationTime: new Date(Date.now() + 6 * 60 * 60 * 1000) // 6 hours
    };
  }

  // Helper Methods
  private async calculatePortfolioRisk(positions: Position[]): Promise<number> {
    return positions.reduce((sum, pos) => sum + pos.riskContribution, 0);
  }

  private async calculateCorrelations(positions: Position[]): Promise<Map<string, number>> {
    const correlations = new Map<string, number>();
    
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const pos1 = positions[i];
        const pos2 = positions[j];
        const correlation = await this.calculatePairwiseCorrelation(pos1, pos2);
        correlations.set(`${pos1.id}_${pos2.id}`, correlation);
      }
    }
    
    return correlations;
  }

  private async calculatePairwiseCorrelation(pos1: Position, pos2: Position): Promise<number> {
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

  private async calculateHedgeEffectiveness(
    position: Position,
    hedgeInstrument: HedgeInstrument
  ): Promise<number> {
    
    let baseEffectiveness = 0.7; // Default effectiveness
    
    // Adjust based on hedge type
    switch (hedgeInstrument.type) {
      case 'opposite_bet':
        baseEffectiveness = 0.9; // Very effective
        break;
      case 'correlated_bet':
        baseEffectiveness = 0.6; // Moderately effective
        break;
      case 'insurance_bet':
        baseEffectiveness = 0.8; // Highly effective
        break;
      case 'spread_adjustment':
        baseEffectiveness = 0.5; // Partially effective
        break;
    }
    
    // Adjust for liquidity and availability
    const liquidityAdjustment = hedgeInstrument.liquidityScore;
    const availabilityAdjustment = hedgeInstrument.availability === 'high' ? 1.0 :
                                  hedgeInstrument.availability === 'medium' ? 0.8 : 0.6;
    
    return baseEffectiveness * liquidityAdjustment * availabilityAdjustment;
  }

  private async calculateHedgeCost(
    position: Position,
    hedgeInstrument: HedgeInstrument
  ): Promise<number> {
    
    // Base cost as percentage of hedge stake
    let baseCost = 0.05; // 5% base cost
    
    // Adjust based on availability and liquidity
    if (hedgeInstrument.availability === 'low') baseCost *= 2;
    if (hedgeInstrument.liquidityScore < 0.5) baseCost *= 1.5;
    
    // Calculate absolute cost
    return hedgeInstrument.suggestedStake * baseCost;
  }

  private async calculateTimeDecay(position: Position): Promise<number> {
    // Time decay increases as we get closer to the event
    const timeToEvent = this.getTimeToEvent(position);
    const hoursToEvent = timeToEvent / (60 * 60 * 1000);
    
    if (hoursToEvent > 48) return 0.01; // Low decay for distant events
    if (hoursToEvent > 24) return 0.02; // Medium decay
    if (hoursToEvent > 12) return 0.05; // Higher decay
    if (hoursToEvent > 2) return 0.1;   // High decay
    return 0.2; // Very high decay for imminent events
  }

  private getTimeToEvent(position: Position): number {
    // This would get actual event time from game data
    // For now, assume events are within 24 hours
    return 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  private async getMarketConditions(gameId: string): Promise<MarketConditions> {
    const cached = this.marketData.get(gameId);
    if (cached) return cached;

    // Default market conditions
    const conditions: MarketConditions = {
      volatility: 0.2,
      liquidity: 0.8,
      spread: 0.05,
      momentum: 0.0,
      timeToEvent: 24 * 60 * 60 * 1000,
      marketSentiment: 'neutral'
    };

    this.marketData.set(gameId, conditions);
    return conditions;
  }

  private async filterViableOpportunities(opportunities: HedgeOpportunity[]): Promise<HedgeOpportunity[]> {
    return opportunities.filter(hedge => {
      // Filter out ineffective or too expensive hedges
      const benefitCostRatio = hedge.riskReduction / hedge.cost;
      return hedge.effectiveness > 0.3 && benefitCostRatio > 1.5;
    });
  }

  private async rankOpportunities(opportunities: HedgeOpportunity[]): Promise<HedgeOpportunity[]> {
    return opportunities.sort((a, b) => {
      // Sort by priority first, then by benefit-cost ratio
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      const aBenefit = a.riskReduction / a.cost;
      const bBenefit = b.riskReduction / b.cost;
      return bBenefit - aBenefit;
    });
  }

  private async selectOptimalHedges(
    opportunities: HedgeOpportunity[],
    portfolioRisk: number,
    riskTolerance: number
  ): Promise<HedgeOpportunity[]> {
    
    const selected: HedgeOpportunity[] = [];
    let remainingRisk = portfolioRisk;
    let totalCost = 0;
    const maxCost = portfolioRisk * 0.3; // Max 30% of risk value for hedging
    
    for (const opportunity of opportunities) {
      // Only add hedge if it improves risk-adjusted returns
      const benefitCostRatio = opportunity.riskReduction / opportunity.cost;
      
      if (benefitCostRatio > 2.0 && 
          totalCost + opportunity.cost <= maxCost &&
          remainingRisk > riskTolerance) {
        
        selected.push(opportunity);
        remainingRisk -= opportunity.riskReduction;
        totalCost += opportunity.cost;
      }
    }
    
    return selected;
  }

  private determineRiskProfile(portfolioRisk: number, riskTolerance: number): 'conservative' | 'moderate' | 'aggressive' {
    const riskRatio = portfolioRisk / riskTolerance;
    
    if (riskRatio > 3) return 'conservative';
    if (riskRatio > 1.5) return 'moderate';
    return 'aggressive';
  }

  private determinePriority(effectiveness: number, cost: number, riskReduction: number): 'high' | 'medium' | 'low' {
    const benefitCostRatio = riskReduction / cost;
    
    if (effectiveness > 0.8 && benefitCostRatio > 3) return 'high';
    if (effectiveness > 0.6 && benefitCostRatio > 2) return 'medium';
    return 'low';
  }

  // Recommendation Generation Methods
  private async generateDirectHedgeRecommendation(effectiveness: number, cost: number): Promise<HedgeRecommendation> {
    const benefitCostRatio = effectiveness / (cost / 100); // Normalize cost
    
    if (benefitCostRatio > 3) {
      return {
        action: 'hedge_now',
        reason: 'High effectiveness, low cost hedge available',
        timeframe: 'immediate',
        confidence: 0.9
      };
    } else if (benefitCostRatio > 1.5) {
      return {
        action: 'hedge_conditional',
        reason: 'Good hedge opportunity with reasonable cost',
        conditions: ['Market conditions remain stable'],
        timeframe: 'within 2 hours',
        confidence: 0.7
      };
    } else {
      return {
        action: 'monitor',
        reason: 'Hedge available but cost may be too high',
        timeframe: 'monitor for better opportunities',
        confidence: 0.5
      };
    }
  }

  private async generateCorrelationHedgeRecommendation(correlation: number, effectiveness: number): Promise<HedgeRecommendation> {
    if (correlation > 0.8 && effectiveness > 0.7) {
      return {
        action: 'hedge_now',
        reason: 'High correlation risk requires immediate hedging',
        timeframe: 'immediate',
        confidence: 0.85
      };
    } else {
      return {
        action: 'hedge_conditional',
        reason: 'Moderate correlation risk, hedge if correlation increases',
        conditions: ['Correlation remains above 0.7'],
        timeframe: 'within 4 hours',
        confidence: 0.6
      };
    }
  }

  private async generatePortfolioHedgeRecommendation(totalRisk: number, effectiveness: number): Promise<HedgeRecommendation> {
    if (totalRisk > 0.3) {
      return {
        action: 'hedge_now',
        reason: 'Portfolio risk exceeds safe limits',
        timeframe: 'immediate',
        confidence: 0.8
      };
    } else {
      return {
        action: 'monitor',
        reason: 'Portfolio risk manageable, monitor for changes',
        timeframe: 'continuous monitoring',
        confidence: 0.6
      };
    }
  }

  private async generateInsuranceHedgeRecommendation(position: Position, effectiveness: number): Promise<HedgeRecommendation> {
    return {
      action: 'hedge_conditional',
      reason: `High-value position (${position.stake}) needs insurance`,
      conditions: ['Position remains above risk threshold'],
      timeframe: 'within 1 hour',
      confidence: 0.75
    };
  }

  private async generateDynamicHedgeRecommendation(marketConditions: MarketConditions, effectiveness: number): Promise<HedgeRecommendation> {
    if (marketConditions.volatility > 0.4) {
      return {
        action: 'hedge_now',
        reason: 'High market volatility requires immediate hedging',
        timeframe: 'immediate',
        confidence: 0.8
      };
    } else {
      return {
        action: 'monitor',
        reason: 'Moderate volatility, monitor market conditions',
        triggerEvents: ['Volatility increase', 'Negative momentum'],
        timeframe: 'continuous monitoring',
        confidence: 0.6
      };
    }
  }

  // Execution and Monitoring Methods
  private async validateHedgeViability(hedge: HedgeOpportunity): Promise<boolean> {
    // Check if hedge is still viable (odds available, liquidity sufficient, etc.)
    return Date.now() < hedge.expirationTime.getTime() && hedge.effectiveness > 0.3;
  }

  private async checkExecutionPermissions(hedge: HedgeOpportunity, userId: string): Promise<boolean> {
    // Check user permissions, available funds, risk limits, etc.
    return true; // Simplified for now
  }

  private async executeHedge(hedge: HedgeOpportunity, userId: string): Promise<boolean> {
    // This would integrate with actual trading/betting systems
    this.logger.info('💼 Executing hedge (simulated)', {
      hedgeId: hedge.id,
      type: hedge.type,
      stake: hedge.hedgeInstrument.suggestedStake
    });
    
    return true; // Simulated success
  }

  private async recordHedgeExecution(hedge: HedgeOpportunity, userId: string): Promise<void> {
    const execution = {
      hedgeId: hedge.id,
      userId,
      executionTime: new Date(),
      type: hedge.type,
      stake: hedge.hedgeInstrument.suggestedStake,
      expectedEffectiveness: hedge.effectiveness,
      expectedCost: hedge.cost
    };

    await redisCache.set(
      `hedge:execution:${hedge.id}`,
      JSON.stringify(execution),
      86400 // 24 hours TTL
    );
  }

  private async getActiveHedges(userId: string): Promise<HedgeOpportunity[]> {
    const cached = await redisCache.get(`hedge:active:${userId}`);
    return cached ? JSON.parse(cached) : [];
  }

  private async updateHedgeEffectiveness(hedge: HedgeOpportunity): Promise<HedgeOpportunity> {
    // Update effectiveness based on current market conditions
    const currentConditions = await this.getMarketConditions(hedge.hedgeInstrument.gameId || 'default');
    
    // Adjust effectiveness based on time decay and market changes
    hedge.effectiveness *= (1 - hedge.timeDecay);
    hedge.effectiveness *= (1 + currentConditions.volatility * 0.1); // Volatility can increase effectiveness
    
    return hedge;
  }

  private async shouldAdjustHedge(hedge: HedgeOpportunity): Promise<boolean> {
    // Check if hedge should be adjusted based on changing conditions
    return hedge.effectiveness < 0.4 || hedge.cost > hedge.riskReduction * 2;
  }

  private async generateAdjustmentRecommendation(hedge: HedgeOpportunity): Promise<HedgeRecommendation> {
    return {
      action: 'monitor',
      reason: 'Hedge effectiveness declining, consider adjustment',
      conditions: ['Monitor market conditions', 'Consider closing if effectiveness drops below 30%'],
      timeframe: 'within 2 hours',
      confidence: 0.6
    };
  }

  private async cacheHedgeOpportunities(userId: string, opportunities: HedgeOpportunity[]): Promise<void> {
    await redisCache.set(
      `hedge:opportunities:${userId}`,
      JSON.stringify(opportunities),
      1800 // 30 minutes TTL
    );
  }

  private async cacheActiveHedges(userId: string, hedges: HedgeOpportunity[]): Promise<void> {
    await redisCache.set(
      `hedge:active:${userId}`,
      JSON.stringify(hedges),
      3600 // 1 hour TTL
    );
  }

  private async loadHedgeStrategies(): Promise<void> {
    const strategies = {
      direct_hedge: { effectiveness_factor: 0.9, cost_factor: 0.05, time_decay: 0.1 },
      correlation_hedge: { effectiveness_factor: 0.6, cost_factor: 0.08, time_decay: 0.05 },
      portfolio_hedge: { effectiveness_factor: 0.7, cost_factor: 0.1, time_decay: 0.02 },
      insurance_hedge: { effectiveness_factor: 0.8, cost_factor: 0.15, time_decay: 0.05 }
    };

    for (const [strategyName, strategy] of Object.entries(strategies)) {
      this.hedgeStrategies.set(strategyName, strategy);
    }
  }

  private async loadMarketData(): Promise<void> {
    // Load current market conditions for games
    const defaultConditions: MarketConditions = {
      volatility: 0.2,
      liquidity: 0.8,
      spread: 0.05,
      momentum: 0.0,
      timeToEvent: 24 * 60 * 60 * 1000,
      marketSentiment: 'neutral'
    };

    this.marketData.set('default', defaultConditions);
  }

  private async loadHedgeHistory(): Promise<void> {
    try {
      const cachedHistory = await redisCache.getPattern('hedge:history:*');
      
      for (const [key, data] of cachedHistory) {
        const userId = key.split(':').pop();
        if (userId) {
          const history = JSON.parse(data);
          this.hedgeHistory.set(userId, history);
        }
      }

      this.logger.info(`📋 Loaded hedge history for ${this.hedgeHistory.size} users`);
    } catch (error) {
      this.logger.warn('⚠️ Failed to load hedge history from cache');
    }
  }

  private async loadPerformanceData(): Promise<void> {
    // Load hedge performance data for continuous improvement
    const defaultPerformance: HedgePerformance[] = [{
      hedgeId: 'sample',
      effectiveness: 0.75,
      cost: 0.08,
      actualRiskReduction: 0.12,
      returnImpact: -0.08,
      accuracy: 0.8,
      lessons: ['Higher effectiveness in volatile markets', 'Cost increased with low liquidity']
    }];

    this.hedgePerformance.set('default', defaultPerformance);
  }

  async isHealthy(): Promise<boolean> {
    return this.hedgeStrategies.size > 0;
  }

  async cleanup(): Promise<void> {
    // Save hedge history
    for (const [userId, history] of this.hedgeHistory) {
      await redisCache.set(
        `hedge:history:${userId}`,
        JSON.stringify(history),
        86400 // 24 hours TTL
      );
    }

    this.hedgeHistory.clear();
    this.marketData.clear();
    this.hedgePerformance.clear();
    this.hedgeStrategies.clear();
    
    this.logger.info('🧹 HedgeEngine cleanup completed');
  }
}