/* eslint-disable max-lines */
/**
 * Professional-Grade Devigging Service
 * Removes bookmaker margin (vig/juice) from all odds sources
 * This is THE fundamental requirement for sharp betting systems
 *
 * Phase 4 Enhancement: Book-specific vig patterns and favorite-longshot bias correction
 *
 * @module DeviggingService
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

export interface BookVigPattern {
  sportsbookId: string;
  sport: string;
  marketType: string;
  avgVig: number;
  favoriteOverround: number;
  longshotOverround: number;
  flbCoefficient: number; // Favorite-longshot bias coefficient
  recommendedMethod: 'multiplicative' | 'additive' | 'power' | 'shin' | 'wpo';
}

export interface BookContextDeviggingParams {
  overOdds: number;
  underOdds: number;
  sportsbook: string;
  sport: string;
  marketType?: string;
}

/**
 * Professional devigging service implementing multiple methods
 * Used by all sharp betting services (Unabated, OddsJam, etc.)
 *
 * Phase 4 Enhancement: Supports book-specific vig patterns and FLB correction
 */
export class DeviggingService {
  private static instance: DeviggingService;
  private supabase: SupabaseClient | null = null;

  // Cache for book vig patterns (refresh every 15 minutes)
  private vigPatternCache: Map<string, { pattern: BookVigPattern; cachedAt: number }> = new Map();
  private readonly VIG_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  // Default vig patterns by book type
  private readonly DEFAULT_VIG_PATTERNS: Record<string, Partial<BookVigPattern>> = {
    // Sharp books - low vig, minimal FLB
    pinnacle: { avgVig: 0.025, favoriteOverround: 0.001, longshotOverround: 0.001, flbCoefficient: 0.01, recommendedMethod: 'multiplicative' },
    circa: { avgVig: 0.035, favoriteOverround: 0.002, longshotOverround: 0.002, flbCoefficient: 0.015, recommendedMethod: 'multiplicative' },
    bookmaker: { avgVig: 0.030, favoriteOverround: 0.002, longshotOverround: 0.002, flbCoefficient: 0.015, recommendedMethod: 'multiplicative' },
    superbook: { avgVig: 0.035, favoriteOverround: 0.003, longshotOverround: 0.003, flbCoefficient: 0.02, recommendedMethod: 'multiplicative' },

    // Soft books - higher vig, more FLB
    draftkings: { avgVig: 0.0455, favoriteOverround: 0.015, longshotOverround: 0.020, flbCoefficient: 0.05, recommendedMethod: 'power' },
    fanduel: { avgVig: 0.0455, favoriteOverround: 0.015, longshotOverround: 0.020, flbCoefficient: 0.05, recommendedMethod: 'power' },
    betmgm: { avgVig: 0.0455, favoriteOverround: 0.018, longshotOverround: 0.025, flbCoefficient: 0.06, recommendedMethod: 'power' },
    caesars: { avgVig: 0.0455, favoriteOverround: 0.015, longshotOverround: 0.020, flbCoefficient: 0.05, recommendedMethod: 'power' },
    pointsbet: { avgVig: 0.050, favoriteOverround: 0.020, longshotOverround: 0.025, flbCoefficient: 0.06, recommendedMethod: 'power' },
    bovada: { avgVig: 0.050, favoriteOverround: 0.020, longshotOverround: 0.030, flbCoefficient: 0.07, recommendedMethod: 'power' },

    // Default for unknown books
    default: { avgVig: 0.0455, favoriteOverround: 0.015, longshotOverround: 0.020, flbCoefficient: 0.05, recommendedMethod: 'power' },
  };

  private constructor() {
    // Initialize Supabase client if credentials available
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  public static getInstance(): DeviggingService {
    if (!DeviggingService.instance) {
      DeviggingService.instance = new DeviggingService();
    }
    return DeviggingService.instance;
  }

  /**
   * Devig with book-specific adjustments (Phase 4)
   * Uses book-specific vig patterns and favorite-longshot bias correction
   */
  public async devigWithBookContext(params: BookContextDeviggingParams): Promise<{
    outcome1: DeviggingResult;
    outcome2: DeviggingResult;
    totalVig: number;
    deviggedEdge?: number;
    bookPattern?: BookVigPattern;
  }> {
    // Get book-specific vig pattern
    const vigPattern = await this.getBookVigPattern(
      params.sportsbook,
      params.sport,
      params.marketType || 'player_props'
    );

    // Apply book-specific devigging based on FLB characteristics
    if (vigPattern.flbCoefficient > 0.03) {
      // Significant FLB - use power method with correction
      return this.devigWithFLBCorrection(params, vigPattern);
    }

    // Low FLB (sharp books) - use standard multiplicative
    // Filter method to supported types (shin/wpo fall back to power)
    const method = ['multiplicative', 'additive', 'power'].includes(vigPattern.recommendedMethod)
      ? (vigPattern.recommendedMethod as 'multiplicative' | 'additive' | 'power')
      : 'power';
    const result = this.devigTwoWay(
      { odds1: params.overOdds, odds2: params.underOdds },
      method
    );

    return {
      ...result,
      bookPattern: vigPattern,
    };
  }

  /**
   * Devig with favorite-longshot bias correction
   * More accurate for soft books with significant FLB
   */
  // eslint-disable-next-line max-lines-per-function
  private devigWithFLBCorrection(
    params: BookContextDeviggingParams,
    vigPattern: BookVigPattern
  ): {
    outcome1: DeviggingResult;
    outcome2: DeviggingResult;
    totalVig: number;
    deviggedEdge?: number;
    bookPattern?: BookVigPattern;
  } {
    const prob1 = this.americanToImpliedProb(params.overOdds);
    const prob2 = this.americanToImpliedProb(params.underOdds);
    const totalImplied = prob1 + prob2;
    const vig = totalImplied - 1;

    // Determine which is the favorite (higher implied probability)
    const isFavorite1 = prob1 > prob2;

    // Calculate FLB-adjusted vig distribution
    // Favorites have more vig added, longshots have less
    const flbFactor = vigPattern.flbCoefficient;
    let vigAllocation1: number;
    let vigAllocation2: number;

    if (isFavorite1) {
      // Outcome 1 is favorite - gets more vig
      vigAllocation1 = (vig / 2) * (1 + flbFactor);
      vigAllocation2 = (vig / 2) * (1 - flbFactor);
    } else {
      // Outcome 2 is favorite - gets more vig
      vigAllocation1 = (vig / 2) * (1 - flbFactor);
      vigAllocation2 = (vig / 2) * (1 + flbFactor);
    }

    // Apply FLB-adjusted devigging
    let trueProb1 = prob1 - vigAllocation1;
    let trueProb2 = prob2 - vigAllocation2;

    // Ensure probabilities sum to 1 and are valid
    const sum = trueProb1 + trueProb2;
    trueProb1 = trueProb1 / sum;
    trueProb2 = trueProb2 / sum;

    // Clamp to valid range
    trueProb1 = Math.max(0.01, Math.min(0.99, trueProb1));
    trueProb2 = Math.max(0.01, Math.min(0.99, trueProb2));

    return {
      outcome1: {
        trueProb: trueProb1,
        fairOdds: this.probToAmericanOdds(trueProb1),
        totalVig: vig * 100,
        edge: 0,
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
      deviggedEdge: Math.max(0, trueProb1 - 0.5),
      bookPattern: vigPattern,
    };
  }

  /**
   * Pinnacle-specific devigging (most accurate)
   * Pinnacle has lowest vig (~2.5%) and minimal FLB
   */
  public devigPinnacle(overOdds: number, underOdds: number): {
    trueOverProb: number;
    trueUnderProb: number;
    vig: number;
  } {
    const prob1 = this.americanToImpliedProb(overOdds);
    const prob2 = this.americanToImpliedProb(underOdds);
    const totalImplied = prob1 + prob2;
    const vig = totalImplied - 1;

    // Pinnacle has minimal FLB, use pure multiplicative
    const trueOverProb = prob1 / totalImplied;
    const trueUnderProb = prob2 / totalImplied;

    return {
      trueOverProb,
      trueUnderProb,
      vig,
    };
  }

  /**
   * Get book-specific vig pattern
   * Checks database first, falls back to defaults
   */
  public async getBookVigPattern(
    sportsbookId: string,
    sport: string,
    marketType: string = 'player_props'
  ): Promise<BookVigPattern> {
    const cacheKey = `${sportsbookId}:${sport}:${marketType}`;
    const cached = this.vigPatternCache.get(cacheKey);

    // Return cached if still valid
    if (cached && Date.now() - cached.cachedAt < this.VIG_CACHE_TTL) {
      return cached.pattern;
    }

    // Try to fetch from database
    if (this.supabase) {
      try {
        const { data } = await this.supabase
          .from('book_vig_analysis')
          .select('*')
          .eq('sportsbook_id', sportsbookId.toLowerCase())
          .eq('sport', sport)
          .eq('market_type', marketType)
          .order('calculated_at', { ascending: false })
          .limit(1)
          .single();

        if (data) {
          const pattern: BookVigPattern = {
            sportsbookId: data.sportsbook_id,
            sport: data.sport,
            marketType: data.market_type,
            avgVig: data.avg_vig,
            favoriteOverround: data.favorite_overround || 0,
            longshotOverround: data.longshot_overround || 0,
            flbCoefficient: data.flb_coefficient || 0,
            recommendedMethod: data.recommended_method || 'multiplicative',
          };

          this.vigPatternCache.set(cacheKey, { pattern, cachedAt: Date.now() });
          return pattern;
        }
      } catch {
        // Fall through to default
      }
    }

    // Use default pattern
    const defaultPattern = this.getDefaultVigPatternSync(sportsbookId, sport, marketType);
    this.vigPatternCache.set(cacheKey, { pattern: defaultPattern, cachedAt: Date.now() });
    return defaultPattern;
  }

  /**
   * Get default vig pattern synchronously
   */
  private getDefaultVigPatternSync(
    sportsbookId: string,
    sport: string,
    marketType: string
  ): BookVigPattern {
    const bookKey = sportsbookId.toLowerCase();
    const defaultConfig = this.DEFAULT_VIG_PATTERNS[bookKey] || this.DEFAULT_VIG_PATTERNS.default;

    return {
      sportsbookId: bookKey,
      sport,
      marketType,
      avgVig: defaultConfig.avgVig || 0.0455,
      favoriteOverround: defaultConfig.favoriteOverround || 0.015,
      longshotOverround: defaultConfig.longshotOverround || 0.020,
      flbCoefficient: defaultConfig.flbCoefficient || 0.05,
      recommendedMethod: defaultConfig.recommendedMethod || 'multiplicative',
    };
  }

  /**
   * Clear vig pattern cache
   */
  public clearVigPatternCache(): void {
    this.vigPatternCache.clear();
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
      case 'multiplicative': {
        // Most common method - proportionally reduce probabilities
        trueProb1 = prob1 / totalImplied;
        trueProb2 = prob2 / totalImplied;
        break;
      }

      case 'additive': {
        // Alternative method - subtract vig equally
        const vigPerOutcome = vig / 2;
        trueProb1 = prob1 - vigPerOutcome;
        trueProb2 = prob2 - vigPerOutcome;
        break;
      }

      case 'power': {
        // Advanced method - uses power function (more accurate for favorites)
        const k = Math.log(totalImplied) / Math.log(2);
        trueProb1 = Math.pow(prob1, 1/k) / (Math.pow(prob1, 1/k) + Math.pow(prob2, 1/k));
        trueProb2 = 1 - trueProb1;
        break;
      }
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

  private shinFunction(z: number, probs: number[], _totalImplied: number): number {
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