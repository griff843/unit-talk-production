/**
 * Professional-Grade Devigging Service
 * Removes bookmaker margin (vig/juice) from all odds sources
 * This is THE fundamental requirement for sharp betting systems
 * 
 * @module DeviggingService
 */

export interface DeviggingResult {
  trueProb: number;          // True probability after vig removal
  fairOdds: number;          // Fair American odds (-110 -> -100)
  totalVig: number;          // Total vig percentage
  edge: number;              // Edge vs market (positive = value)
  impliedProbability: number; // Original implied probability with vig
}

export interface TwoWayMarket {
  odds1: number;  // American odds for outcome 1
  odds2: number;  // American odds for outcome 2
}

export interface MultiWayMarket {
  odds: number[]; // Array of American odds for all outcomes
}

/**
 * Professional devigging service implementing multiple methods
 * Used by all sharp betting services (Unabated, OddsJam, etc.)
 */
export class DeviggingService {
  private static instance: DeviggingService;

  private constructor() {}

  public static getInstance(): DeviggingService {
    if (!DeviggingService.instance) {
      DeviggingService.instance = new DeviggingService();
    }
    return DeviggingService.instance;
  }

  /**
   * Convert American odds to implied probability
   */
  private americanToImpliedProb(americanOdds: number): number {
    if (americanOdds > 0) {
      return 100 / (americanOdds + 100);
    } else {
      return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
    }
  }

  /**
   * Convert probability back to American odds
   */
  private probToAmericanOdds(probability: number): number {
    if (probability >= 0.5) {
      return -Math.round((probability * 100) / (1 - probability));
    } else {
      return Math.round((100 - probability * 100) / probability);
    }
  }

  /**
   * Devig two-way market using multiplicative method
   * This is the industry standard for two-outcome markets
   */
  public devigTwoWay(market: TwoWayMarket, method: 'multiplicative' | 'additive' | 'power' = 'multiplicative'): {
    outcome1: DeviggingResult;
    outcome2: DeviggingResult;
    totalVig: number;
    deviggedEdge?: number; // Added for compatibility with existing code
  } {
    const prob1 = this.americanToImpliedProb(market.odds1);
    const prob2 = this.americanToImpliedProb(market.odds2);
    const totalImplied = prob1 + prob2;
    const vig = totalImplied - 1;

    let trueProb1: number;
    let trueProb2: number;

    switch (method) {
      case 'multiplicative':
        // Most common method - proportionally reduce probabilities
        trueProb1 = prob1 / totalImplied;
        trueProb2 = prob2 / totalImplied;
        break;

      case 'additive':
        // Alternative method - subtract vig equally
        const vigPerOutcome = vig / 2;
        trueProb1 = prob1 - vigPerOutcome;
        trueProb2 = prob2 - vigPerOutcome;
        break;

      case 'power':
        // Advanced method - uses power function (more accurate for favorites)
        const k = Math.log(totalImplied) / Math.log(2);
        trueProb1 = Math.pow(prob1, 1/k) / (Math.pow(prob1, 1/k) + Math.pow(prob2, 1/k));
        trueProb2 = 1 - trueProb1;
        break;
    }

    return {
      outcome1: {
        trueProb: trueProb1,
        fairOdds: this.probToAmericanOdds(trueProb1),
        totalVig: vig * 100,
        edge: 0, // Will be calculated when comparing to model
        impliedProbability: prob1
      },
      outcome2: {
        trueProb: trueProb2,
        fairOdds: this.probToAmericanOdds(trueProb2),
        totalVig: vig * 100,
        edge: 0,
        impliedProbability: prob2
      },
      totalVig: vig * 100,
      // Calculate simple edge for outcome1 (over) for compatibility
      deviggedEdge: Math.max(0, trueProb1 - 0.5)
    };
  }

  /**
   * Devig multi-way market (3+ outcomes)
   * Used for futures, props with multiple outcomes
   */
  public devigMultiWay(market: MultiWayMarket, method: 'multiplicative' | 'shin' = 'multiplicative'): {
    outcomes: DeviggingResult[];
    totalVig: number;
  } {
    const probabilities = market.odds.map(odds => this.americanToImpliedProb(odds));
    const totalImplied = probabilities.reduce((sum, prob) => sum + prob, 0);
    const vig = totalImplied - 1;

    let trueProbabilities: number[];

    if (method === 'multiplicative') {
      // Standard proportional reduction
      trueProbabilities = probabilities.map(prob => prob / totalImplied);
    } else {
      // Shin method - accounts for favorite-longshot bias
      trueProbabilities = this.shinDevigging(probabilities);
    }

    const outcomes = trueProbabilities.map((trueProb, index) => ({
      trueProb,
      fairOdds: this.probToAmericanOdds(trueProb),
      totalVig: vig * 100,
      edge: 0,
      impliedProbability: probabilities[index]
    }));

    return {
      outcomes,
      totalVig: vig * 100
    };
  }

  /**
   * Shin devigging method - advanced technique for multi-way markets
   * Accounts for favorite-longshot bias in bookmaker odds
   */
  private shinDevigging(probabilities: number[]): number[] {
    const n = probabilities.length;
    const totalImplied = probabilities.reduce((sum, p) => sum + p, 0);
    
    // Solve for z using Newton-Raphson method
    let z = (totalImplied - 1) / (n - 1);
    for (let i = 0; i < 10; i++) {
      const f = this.shinFunction(z, probabilities, totalImplied);
      const fPrime = this.shinDerivative(z, probabilities);
      z = z - f / fPrime;
    }

    // Calculate true probabilities
    return probabilities.map(p => {
      const discriminant = Math.pow(z, 2) + 4 * (1 - z) * p;
      return (Math.sqrt(discriminant) - z) / (2 * (1 - z));
    });
  }

  private shinFunction(z: number, probs: number[], totalImplied: number): number {
    const sum = probs.reduce((acc, p) => {
      const discriminant = Math.pow(z, 2) + 4 * (1 - z) * p;
      return acc + (Math.sqrt(discriminant) - z) / (2 * (1 - z));
    }, 0);
    return sum - 1;
  }

  private shinDerivative(z: number, probs: number[]): number {
    return probs.reduce((acc, p) => {
      const discriminant = Math.pow(z, 2) + 4 * (1 - z) * p;
      const term1 = z / Math.sqrt(discriminant) - 1;
      const term2 = 2 * (1 - z);
      const term3 = (Math.sqrt(discriminant) - z) * 2;
      const term4 = Math.pow(2 * (1 - z), 2);
      return acc + term1 / term2 + term3 / term4;
    }, 0);
  }

  /**
   * Devig exchange odds (back/lay)
   * Exchanges have different vig structure
   */
  public devigExchange(backOdds: number, layOdds: number, commission: number = 0.02): DeviggingResult {
    // Convert decimal odds to probability
    const backProb = 1 / backOdds;
    const layProb = 1 - (1 / layOdds);
    
    // Account for commission
    const effectiveBackProb = backProb * (1 - commission);
    const effectiveLayProb = layProb * (1 - commission);
    
    // True probability is midpoint
    const trueProb = (effectiveBackProb + effectiveLayProb) / 2;
    
    return {
      trueProb,
      fairOdds: this.probToAmericanOdds(trueProb),
      totalVig: ((1 / effectiveBackProb + 1 / (1 - effectiveLayProb)) - 1) * 100,
      edge: 0,
      impliedProbability: backProb
    };
  }

  /**
   * Devig live/in-play odds with time decay adjustment
   * Live odds have higher vig and time-based adjustments
   */
  public devigLive(
    market: TwoWayMarket, 
    gameProgress: number, // 0-1 (0 = start, 1 = end)
    baseVigMultiplier: number = 1.5 // Live typically has 50% higher vig
  ): {
    outcome1: DeviggingResult;
    outcome2: DeviggingResult;
    totalVig: number;
  } {
    // First devig normally
    const devigged = this.devigTwoWay(market);
    
    // Adjust for live betting characteristics
    const timeAdjustment = 1 + (gameProgress * 0.2); // Up to 20% adjustment late game
    const liveVigMultiplier = baseVigMultiplier * timeAdjustment;
    
    // Recalculate with live adjustments
    const adjustedVig = devigged.totalVig * liveVigMultiplier;
    
    return {
      ...devigged,
      totalVig: adjustedVig
    };
  }

  /**
   * Calculate edge given model probability and devigged market
   * This is the KEY calculation for finding value
   */
  public calculateEdge(
    modelProb: number, 
    marketOdds: number,
    includeKellyMultiplier: boolean = true
  ): {
    edge: number;
    expectedValue: number;
    kellyFraction: number;
    hasValue: boolean;
  } {
    // Devig the market odds (assuming two-way for now)
    const oppositeOdds = modelProb > 0.5 ? 100 / (1 - modelProb) - 100 : -100 * (1 - modelProb) / modelProb;
    const market = { odds1: marketOdds, odds2: oppositeOdds };
    const devigged = this.devigTwoWay(market);
    
    const marketProb = devigged.outcome1.trueProb;
    const edge = modelProb - marketProb;
    
    // Calculate expected value
    const decimalOdds = marketOdds > 0 ? (marketOdds / 100) + 1 : (100 / Math.abs(marketOdds)) + 1;
    const expectedValue = (modelProb * decimalOdds) - 1;
    
    // Kelly calculation
    const kellyFraction = expectedValue > 0 ? expectedValue / (decimalOdds - 1) : 0;
    
    return {
      edge: edge * 100, // As percentage
      expectedValue: expectedValue * 100,
      kellyFraction: includeKellyMultiplier ? kellyFraction * 0.25 : kellyFraction, // 1/4 Kelly
      hasValue: edge > 0.02 // 2% minimum edge threshold
    };
  }

  /**
   * Batch devig multiple markets efficiently
   */
  public devigBatch(markets: Array<{
    id: string;
    type: 'two-way' | 'multi-way';
    odds: number[];
  }>): Map<string, DeviggingResult[]> {
    const results = new Map<string, DeviggingResult[]>();
    
    for (const market of markets) {
      if (market.type === 'two-way' && market.odds.length === 2) {
        const devigged = this.devigTwoWay({
          odds1: market.odds[0],
          odds2: market.odds[1]
        });
        results.set(market.id, [devigged.outcome1, devigged.outcome2]);
      } else {
        const devigged = this.devigMultiWay({ odds: market.odds });
        results.set(market.id, devigged.outcomes);
      }
    }
    
    return results;
  }
}

// Export singleton instance
export const deviggingService = DeviggingService.getInstance();