import { Logger } from '../../shared/logger/types';

interface ParlayLeg {
  id: string;
  selection: string;
  odds: number;
  status: 'pending' | 'won' | 'lost' | 'pushed';
  result?: string;
  sport: string;
  gameId: string;
  betType: string;
  line?: number;
}

interface ParlayBet {
  id: string;
  userId: string;
  legs: ParlayLeg[];
  stake: number;
  potentialPayout: number;
  totalOdds: number;
  status: 'active' | 'won' | 'lost' | 'hedged';
  placedAt: Date;
}

interface HedgeOpportunity {
  parlayId: string;
  completedLegs: number;
  totalLegs: number;
  remainingLeg: ParlayLeg;
  currentValue: number;
  currentProfit: number;
  hedgeStake: number;
  hedgeSide: string;
  hedgeOdds: number;
  guaranteedProfit: number;
  maxPayout: number;
  hedgeEfficiency: number;
  recommendation: 'hedge_now' | 'wait' | 'let_ride';
  confidence: number;
}

interface HedgeCalculationResult {
  shouldHedge: boolean;
  hedgeOpportunity?: HedgeOpportunity;
  analysis: {
    profitWithHedge: number;
    profitWithoutHedge: number;
    riskWithHedge: number;
    riskWithoutHedge: number;
    breakEvenHedgeOdds: number;
    optimalHedgePercentage: number;
  };
}

export class ParlayHedgeCalculator {
  private readonly logger: Logger;
  private hedgeStrategies: Map<string, any> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeHedgeStrategies();
  }

  async calculateHedgeOpportunity(parlay: ParlayBet): Promise<HedgeCalculationResult> {
    this.logger.info('💰 Analyzing parlay hedge opportunity', {
      parlayId: parlay.id,
      totalLegs: parlay.legs.length,
      stake: parlay.stake,
    });

    try {
      // Count completed legs
      const completedLegs = parlay.legs.filter(leg => leg.status === 'won').length;
      const lostLegs = parlay.legs.filter(leg => leg.status === 'lost').length;

      // If any leg lost, no hedge opportunity
      if (lostLegs > 0) {
        return {
          shouldHedge: false,
          analysis: this.createEmptyAnalysis(),
        };
      }

      // Need at least 2 legs to have hit for hedge consideration
      if (completedLegs < 2) {
        return {
          shouldHedge: false,
          analysis: this.createEmptyAnalysis(),
        };
      }

      const remainingLegs = parlay.legs.filter(leg => leg.status === 'pending');

      // Must have exactly 1 remaining leg for hedge calculation
      if (remainingLegs.length !== 1) {
        return {
          shouldHedge: false,
          analysis: this.createEmptyAnalysis(),
        };
      }

      const remainingLeg = remainingLegs[0];
      const hedgeOpportunity = await this.calculateOptimalHedge(
        parlay,
        remainingLeg,
        completedLegs
      );

      if (!hedgeOpportunity) {
        return {
          shouldHedge: false,
          analysis: this.createEmptyAnalysis(),
        };
      }

      const analysis = await this.analyzeHedgeScenarios(parlay, hedgeOpportunity);

      this.logger.info('✅ Parlay hedge analysis completed', {
        parlayId: parlay.id,
        shouldHedge: hedgeOpportunity.guaranteedProfit > 0,
        guaranteedProfit: hedgeOpportunity.guaranteedProfit,
        hedgeStake: hedgeOpportunity.hedgeStake,
      });

      return {
        shouldHedge: hedgeOpportunity.guaranteedProfit > 0,
        hedgeOpportunity,
        analysis,
      };
    } catch (error) {
      this.logger.error('❌ Failed to calculate parlay hedge opportunity', {
        parlayId: parlay.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        shouldHedge: false,
        analysis: this.createEmptyAnalysis(),
      };
    }
  }

  async identifyActiveHedgeOpportunities(parlays: ParlayBet[]): Promise<HedgeOpportunity[]> {
    this.logger.info('🔍 Scanning for active parlay hedge opportunities', {
      totalParlays: parlays.length,
    });

    const opportunities: HedgeOpportunity[] = [];

    for (const parlay of parlays) {
      if (parlay.status === 'active') {
        const result = await this.calculateHedgeOpportunity(parlay);
        if (result.shouldHedge && result.hedgeOpportunity) {
          opportunities.push(result.hedgeOpportunity);
        }
      }
    }

    this.logger.info('📊 Hedge opportunity scan completed', {
      scannedParlays: parlays.length,
      opportunitiesFound: opportunities.length,
      highPriorityOpportunities: opportunities.filter(o => o.recommendation === 'hedge_now').length,
    });

    return opportunities.sort((a, b) => b.guaranteedProfit - a.guaranteedProfit);
  }

  async getHedgeRecommendation(parlay: ParlayBet): Promise<{
    action: 'hedge_now' | 'wait' | 'let_ride';
    reason: string;
    details?: HedgeOpportunity;
  }> {
    const result = await this.calculateHedgeOpportunity(parlay);

    if (!result.shouldHedge || !result.hedgeOpportunity) {
      return {
        action: 'let_ride',
        reason: 'No profitable hedge opportunity available',
      };
    }

    const hedge = result.hedgeOpportunity;

    if (hedge.guaranteedProfit > parlay.stake * 0.5) {
      return {
        action: 'hedge_now',
        reason: `Excellent hedge opportunity with $${hedge.guaranteedProfit.toFixed(2)} guaranteed profit`,
        details: hedge,
      };
    } else if (hedge.guaranteedProfit > parlay.stake * 0.2) {
      return {
        action: 'hedge_now',
        reason: `Good hedge opportunity with $${hedge.guaranteedProfit.toFixed(2)} guaranteed profit`,
        details: hedge,
      };
    } else if (hedge.guaranteedProfit > 0) {
      return {
        action: 'wait',
        reason: `Small profit potential ($${hedge.guaranteedProfit.toFixed(2)}), consider waiting for better odds`,
        details: hedge,
      };
    } else {
      return {
        action: 'let_ride',
        reason: 'No profitable hedge available at current odds',
      };
    }
  }

  private async calculateOptimalHedge(
    parlay: ParlayBet,
    remainingLeg: ParlayLeg,
    completedLegs: number
  ): Promise<HedgeOpportunity | null> {
    // Calculate current parlay value (what it's worth if the remaining leg hits)
    const currentValue = parlay.potentialPayout;

    // Get opposite side odds for the remaining leg
    const hedgeOdds = await this.getOppositeOdds(remainingLeg);
    if (!hedgeOdds) return null;

    // Calculate optimal hedge stake using the hedge formula
    // Let S = original stake, P = potential payout, H = hedge odds
    // Optimal hedge stake = P / (H + 1)
    const optimalHedgeStake = currentValue / (hedgeOdds + 1);

    // Calculate guaranteed profit
    // If parlay wins: profit = P - S - hedgeStake
    // If parlay loses: profit = hedgeStake * hedgeOdds - S
    // For guaranteed profit: P - S - hedgeStake = hedgeStake * hedgeOdds - S
    // Solving: hedgeStake = (P - S) / (hedgeOdds + 1)

    const hedgeStake = (currentValue - parlay.stake) / (hedgeOdds + 1);

    // Profit if parlay wins (and hedge loses)
    const profitIfParlayWins = currentValue - parlay.stake - hedgeStake;

    // Profit if parlay loses (and hedge wins)
    const profitIfParlayLoses = hedgeStake * hedgeOdds - parlay.stake;

    // Guaranteed profit is the minimum of both scenarios
    const guaranteedProfit = Math.min(profitIfParlayWins, profitIfParlayLoses);

    // Only recommend if there's actual profit
    if (guaranteedProfit <= 0) return null;

    const hedgeSide = this.getOpposingSelection(remainingLeg.selection, remainingLeg.betType);
    const hedgeEfficiency = guaranteedProfit / hedgeStake;

    return {
      parlayId: parlay.id,
      completedLegs,
      totalLegs: parlay.legs.length,
      remainingLeg,
      currentValue,
      currentProfit: currentValue - parlay.stake,
      hedgeStake: Math.round(hedgeStake * 100) / 100, // Round to cents
      hedgeSide,
      hedgeOdds,
      guaranteedProfit: Math.round(guaranteedProfit * 100) / 100,
      maxPayout: currentValue,
      hedgeEfficiency,
      recommendation: this.determineRecommendation(guaranteedProfit, parlay.stake, hedgeEfficiency),
      confidence: this.calculateConfidence(hedgeEfficiency, guaranteedProfit, parlay.stake),
    };
  }

  private async getOppositeOdds(leg: ParlayLeg): Promise<number | null> {
    // This would integrate with odds API to get real-time opposite odds
    // For now, we'll simulate based on the original odds and add some market variance

    try {
      // Convert American odds to decimal if needed
      let decimalOdds = leg.odds;
      if (leg.odds > 0) {
        decimalOdds = leg.odds / 100 + 1;
      } else {
        decimalOdds = 100 / Math.abs(leg.odds) + 1;
      }

      // Calculate implied probability
      const impliedProb = 1 / decimalOdds;

      // Get opposite probability (with some juice/vig)
      const oppositeProb = 1 - impliedProb;
      const vigAdjustedProb = oppositeProb * 0.95; // Account for 5% vig

      // Convert back to decimal odds
      const oppositeDecimalOdds = 1 / vigAdjustedProb;

      // Convert to American odds for display
      let americanOdds: number;
      if (oppositeDecimalOdds >= 2) {
        americanOdds = (oppositeDecimalOdds - 1) * 100;
      } else {
        americanOdds = -100 / (oppositeDecimalOdds - 1);
      }

      return Math.round(americanOdds);
    } catch (error) {
      this.logger.warn('⚠️ Failed to calculate opposite odds', {
        legId: leg.id,
        originalOdds: leg.odds,
      });
      return null;
    }
  }

  private getOpposingSelection(selection: string, betType: string): string {
    // Map selections to their opposites based on bet type
    const oppositeMap: Record<string, string> = {
      // Moneyline
      home: 'away',
      away: 'home',

      // Spread
      spread_home: 'spread_away',
      spread_away: 'spread_home',

      // Totals
      over: 'under',
      under: 'over',

      // Player props
      player_over: 'player_under',
      player_under: 'player_over',
    };

    const opposite = oppositeMap[selection.toLowerCase()];
    if (opposite) {
      return opposite;
    }

    // Generic opposite for unknown types
    if (selection.toLowerCase().includes('over')) {
      return selection.replace(/over/gi, 'under');
    } else if (selection.toLowerCase().includes('under')) {
      return selection.replace(/under/gi, 'over');
    }

    return `opposite_${selection}`;
  }

  private determineRecommendation(
    guaranteedProfit: number,
    originalStake: number,
    efficiency: number
  ): 'hedge_now' | 'wait' | 'let_ride' {
    const profitRatio = guaranteedProfit / originalStake;

    // Excellent hedge opportunity
    if (profitRatio > 0.5 && efficiency > 0.3) {
      return 'hedge_now';
    }

    // Good hedge opportunity
    if (profitRatio > 0.2 && efficiency > 0.15) {
      return 'hedge_now';
    }

    // Marginal hedge opportunity
    if (profitRatio > 0.05 && efficiency > 0.1) {
      return 'wait'; // Wait for better odds
    }

    return 'let_ride';
  }

  private calculateConfidence(efficiency: number, profit: number, stake: number): number {
    // Base confidence on hedge efficiency and profit ratio
    const profitRatio = profit / stake;

    let confidence = 0.5; // Base confidence

    // Increase confidence for high efficiency
    if (efficiency > 0.3) confidence += 0.3;
    else if (efficiency > 0.2) confidence += 0.2;
    else if (efficiency > 0.1) confidence += 0.1;

    // Increase confidence for good profit ratio
    if (profitRatio > 0.5) confidence += 0.2;
    else if (profitRatio > 0.2) confidence += 0.15;
    else if (profitRatio > 0.1) confidence += 0.05;

    return Math.min(0.95, confidence); // Cap at 95%
  }

  private async analyzeHedgeScenarios(parlay: ParlayBet, hedge: HedgeOpportunity) {
    const profitWithHedge = hedge.guaranteedProfit;
    const profitWithoutHedge = parlay.potentialPayout - parlay.stake;
    const riskWithHedge = 0; // Guaranteed profit means no risk
    const riskWithoutHedge = parlay.stake; // Could lose entire stake

    // Calculate break-even hedge odds
    const breakEvenHedgeOdds = (parlay.potentialPayout - parlay.stake) / hedge.hedgeStake;

    // Calculate optimal hedge percentage
    const optimalHedgePercentage = (hedge.hedgeStake / parlay.potentialPayout) * 100;

    return {
      profitWithHedge,
      profitWithoutHedge,
      riskWithHedge,
      riskWithoutHedge,
      breakEvenHedgeOdds,
      optimalHedgePercentage,
    };
  }

  private createEmptyAnalysis() {
    return {
      profitWithHedge: 0,
      profitWithoutHedge: 0,
      riskWithHedge: 0,
      riskWithoutHedge: 0,
      breakEvenHedgeOdds: 0,
      optimalHedgePercentage: 0,
    };
  }

  private initializeHedgeStrategies(): void {
    this.hedgeStrategies.set('conservative', {
      minProfitRatio: 0.1,
      minEfficiency: 0.15,
      maxHedgePercentage: 80,
    });

    this.hedgeStrategies.set('balanced', {
      minProfitRatio: 0.05,
      minEfficiency: 0.1,
      maxHedgePercentage: 70,
    });

    this.hedgeStrategies.set('aggressive', {
      minProfitRatio: 0.02,
      minEfficiency: 0.05,
      maxHedgePercentage: 90,
    });
  }

  async isHealthy(): Promise<boolean> {
    return this.hedgeStrategies.size > 0;
  }
}
