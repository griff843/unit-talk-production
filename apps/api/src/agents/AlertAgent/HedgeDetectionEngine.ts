import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../shared/logger/types';
import { withCircuitBreaker } from '../../services/enhanced-circuit-breaker';
import { CacheFirstUnifiedPicksService } from '../../services/CacheFirstUnifiedPicksService';

// Advanced hedge detection interfaces
interface HedgeOpportunity {
  id?: string;
  type: 'full_hedge' | 'middle_opportunity' | 'freeroll';
  ticket_id: string;
  player_name: string;
  stat_type: string;
  
  // Original bet details
  original_line: number;
  original_odds: number;
  original_stake_units: number;
  
  // Hedge recommendation
  recommended_line: number;
  recommended_odds: number;
  recommended_stake_units: number;
  recommended_book: string;
  
  // Financial analysis
  guaranteed_profit: number;
  max_profit: number;
  risk_free_percentage: number;
  ev_improvement: number;
  
  // Execution details
  confidence: number;
  execution_window_seconds: number;
  books_available: string[];
  market_depth: MarketDepth;
  
  // Timing factors
  time_to_game: number;
  line_movement_velocity: number;
  opportunity_decay_rate: number;
  
  // Risk assessment
  counterparty_risk: number;
  liquidity_score: number;
  execution_complexity: 'simple' | 'moderate' | 'complex';
  
  created_at?: string;
  expires_at: string;
}

interface MarketDepth {
  book: string;
  available_liquidity: number;
  max_bet_limit: number;
  spread_width: number;
  volume_last_hour: number;
}

interface TicketLegData {
  ticket_id: string;
  leg_index: number;
  player_name: string;
  stat_type: string;
  line: number;
  odds: number;
  stake_units: number;
  outcome: 'pending' | 'hit' | 'miss' | 'void';
  game_start_time: string;
}

interface PropTickData {
  prop_id: string;
  player_name: string;
  stat_type: string;
  line: number;
  over_odds?: number;
  under_odds?: number;
  book: string;
  line_movement: number;
  steam_detected: boolean;
  sharp_money_indicator: boolean;
  time_to_game: number;
  tick_timestamp: string;
}

interface ArbitrageMatrix {
  player_name: string;
  stat_type: string;
  opportunities: BookOpportunity[];
  best_arbitrage: ArbitrageCalculation | null;
  middle_opportunities: MiddleOpportunity[];
}

interface BookOpportunity {
  book: string;
  line: number;
  over_odds: number;
  under_odds: number;
  liquidity_score: number;
  last_updated: string;
}

interface ArbitrageCalculation {
  profit_percentage: number;
  stake_distribution: { [book: string]: number };
  execution_sequence: ExecutionStep[];
  risk_score: number;
}

interface MiddleOpportunity {
  line_low: number;
  line_high: number;
  book_low: string;
  book_high: string;
  middle_range: number;
  profit_probability: number;
  expected_value: number;
}

interface ExecutionStep {
  order: number;
  book: string;
  bet_type: 'over' | 'under';
  line: number;
  odds: number;
  stake_amount: number;
  urgency: 'immediate' | 'normal' | 'delayed';
}

export class HedgeDetectionEngine {
  private supabase: SupabaseClient;
  private logger: Logger;
  private cacheFirstService: CacheFirstUnifiedPicksService;

  // Detection parameters
  private readonly MIN_PROFIT_THRESHOLD = 0.02; // 2% minimum profit
  private readonly _MAX_EXECUTION_WINDOW = 300; // 5 minutes
  private readonly MIN_CONFIDENCE_SCORE = 0.65;
  private readonly _BOOKS_COVERAGE = ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'PointsBet', 'BetRivers'];

  // Market analysis cache
  private marketDataCache: Map<string, BookOpportunity[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds

  constructor(supabase: SupabaseClient, logger: Logger) {
    this.supabase = supabase;
    this.logger = logger;
    this.cacheFirstService = CacheFirstUnifiedPicksService.getInstance();

    // Start cache cleanup interval
    setInterval(() => this.cleanupCache(), 60000); // Every minute
  }

  /**
   * Main entry point: Analyze hedge opportunities for incoming prop tick
   */
  async analyzeHedgeOpportunities(propTick: PropTickData): Promise<HedgeOpportunity[]> {
    const startTime = Date.now();
    const opportunities: HedgeOpportunity[] = [];

    try {
      this.logger.info('🔍 Analyzing hedge opportunities', {
        player: propTick.player_name,
        stat: propTick.stat_type,
        book: propTick.book,
        timeToGame: propTick.time_to_game
      });

      // Get all active tickets with legs matching this prop
      const matchingTickets = await this.getMatchingActiveTickets(propTick);

      if (matchingTickets.length === 0) {
        return opportunities;
      }

      // Build arbitrage matrix for this prop across all books
      const arbitrageMatrix = await this.buildArbitrageMatrix(propTick);

      // Analyze each matching ticket for hedge opportunities
      for (const ticket of matchingTickets) {
        const ticketOpportunities = await this.analyzeTicketHedgeOpportunities(
          ticket,
          propTick,
          arbitrageMatrix
        );
        opportunities.push(...ticketOpportunities);
      }

      // Filter and rank opportunities
      const qualityOpportunities = this.filterAndRankOpportunities(opportunities);

      const processingTime = Date.now() - startTime;
      this.logger.info('✅ Hedge analysis complete', {
        player: propTick.player_name,
        opportunitiesFound: qualityOpportunities.length,
        processingTimeMs: processingTime
      });

      return qualityOpportunities;

    } catch (error) {
      this.logger.error('❌ Hedge detection failed', {
        propTick: propTick.prop_id,
        error: error instanceof Error ? error.message : String(error)
      });
      return opportunities;
    }
  }

  /**
   * Get active tickets with legs matching the prop tick
   */
  private async getMatchingActiveTickets(propTick: PropTickData): Promise<TicketLegData[]> {
    return await withCircuitBreaker.supabase(
      async () => {
        const { data: matchingLegs, error } = await this.supabase
          .from('ticket_legs')
          .select(`
            ticket_id,
            leg_index,
            player_name,
            stat_type,
            line,
            odds,
            outcome,
            game_start_time,
            ticket_states!inner(exposure_units, state)
          `)
          .eq('player_name', propTick.player_name)
          .eq('stat_type', propTick.stat_type)
          .eq('outcome', 'pending')
          .in('ticket_states.state', ['LIVE', 'SWEAT'])
          .limit(100);

        if (error) {
          throw new Error(`Failed to get matching tickets: ${error.message}`);
        }

        return (matchingLegs || []).map(leg => ({
          ticket_id: leg.ticket_id,
          leg_index: leg.leg_index,
          player_name: leg.player_name,
          stat_type: leg.stat_type,
          line: leg.line,
          odds: leg.odds,
          stake_units: (leg as any).ticket_states.exposure_units,
          outcome: leg.outcome,
          game_start_time: leg.game_start_time
        }));
      },
      async () => {
        this.logger.warn('Circuit breaker open - returning empty matching tickets');
        return [];
      }
    );
  }

  /**
   * Build comprehensive arbitrage matrix across all books for this prop
   */
  private async buildArbitrageMatrix(propTick: PropTickData): Promise<ArbitrageMatrix> {
    const cacheKey = `${propTick.player_name}-${propTick.stat_type}`;
    
    // Check cache first
    if (this.isValidCacheEntry(cacheKey)) {
      const cachedData = this.marketDataCache.get(cacheKey)!;
      return this.processArbitrageMatrix(propTick, cachedData);
    }

    try {
      // Use cached book quotes instead of direct prop_ticks_hot access
      const { data: cachedQuotes, error } = await this.supabase
        .from('cache.book_quotes')
        .select('*')
        .eq('player_name', propTick.player_name)
        .eq('stat_type', propTick.stat_type)
        .gte('last_updated', new Date(Date.now() - 300000).toISOString()) // Last 5 minutes
        .order('last_updated', { ascending: false });

      if (error || !cachedQuotes) {
        throw new Error(`Failed to get cached quotes: ${error?.message}`);
      }

      // Group by book and get latest quote for each
      const bookOpportunities = this.processBookOpportunities(cachedQuotes);
      
      // Cache the results
      this.marketDataCache.set(cacheKey, bookOpportunities);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

      return this.processArbitrageMatrix(propTick, bookOpportunities);

    } catch (error) {
      this.logger.error('Failed to build arbitrage matrix', {
        prop: `${propTick.player_name}-${propTick.stat_type}`,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return empty matrix on error
      return {
        player_name: propTick.player_name,
        stat_type: propTick.stat_type,
        opportunities: [],
        best_arbitrage: null,
        middle_opportunities: []
      };
    }
  }

  /**
   * Process book opportunities from cached quote data
   */
  private processBookOpportunities(quotes: any[]): BookOpportunity[] {
    const bookMap = new Map<string, any>();

    // Get latest quote for each book
    for (const quote of quotes) {
      if (!bookMap.has(quote.book) ||
          new Date(quote.last_updated) > new Date(bookMap.get(quote.book).last_updated)) {
        bookMap.set(quote.book, quote);
      }
    }

    return Array.from(bookMap.values()).map(quote => ({
      book: quote.book,
      line: quote.line,
      over_odds: quote.over_odds || quote.odds || 0,
      under_odds: quote.under_odds || quote.odds || 0,
      liquidity_score: this.calculateLiquidityScore(quote),
      last_updated: quote.last_updated
    }));
  }

  /**
   * Calculate liquidity score for a book/market from cached data
   */
  private calculateLiquidityScore(quote: any): number {
    let score = 0.5; // Base score

    // Major books get higher scores
    if (['DraftKings', 'FanDuel', 'BetMGM'].includes(quote.book)) {
      score += 0.3;
    }

    // Recent updates get higher scores
    const updateTime = quote.last_updated || quote.tick_timestamp;
    const ageMinutes = (Date.now() - new Date(updateTime).getTime()) / 60000;
    if (ageMinutes < 1) score += 0.2;
    else if (ageMinutes < 5) score += 0.1;

    // High confidence data gets bonus (use confidence_level or infer from tier)
    const confidence = quote.confidence_level || (quote.tier === 'S-tier' ? 0.9 : 0.7);
    if (confidence > 0.8) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Process arbitrage matrix from book opportunities
   */
  private processArbitrageMatrix(propTick: PropTickData, bookOpportunities: BookOpportunity[]): ArbitrageMatrix {
    const matrix: ArbitrageMatrix = {
      player_name: propTick.player_name,
      stat_type: propTick.stat_type,
      opportunities: bookOpportunities,
      best_arbitrage: null,
      middle_opportunities: []
    };

    // Find best arbitrage opportunity
    matrix.best_arbitrage = this.findBestArbitrage(bookOpportunities);
    
    // Find middle opportunities
    matrix.middle_opportunities = this.findMiddleOpportunities(bookOpportunities);

    return matrix;
  }

  /**
   * Find best pure arbitrage opportunity
   */
  private findBestArbitrage(opportunities: BookOpportunity[]): ArbitrageCalculation | null {
    let bestArbitrage: ArbitrageCalculation | null = null;
    let bestProfit = 0;

    // Compare all book pairs for arbitrage
    for (let i = 0; i < opportunities.length; i++) {
      for (let j = i + 1; j < opportunities.length; j++) {
        const arb = this.calculateArbitrage(opportunities[i], opportunities[j]);
        
        if (arb && arb.profit_percentage > bestProfit && arb.profit_percentage > this.MIN_PROFIT_THRESHOLD) {
          bestArbitrage = arb;
          bestProfit = arb.profit_percentage;
        }
      }
    }

    return bestArbitrage;
  }

  /**
   * Calculate arbitrage between two book opportunities
   */
  private calculateArbitrage(book1: BookOpportunity, book2: BookOpportunity): ArbitrageCalculation | null {
    // Try over/under combinations
    const combinations = [
      { book1_side: 'over', book2_side: 'under', odds1: book1.over_odds, odds2: book2.under_odds },
      { book1_side: 'under', book2_side: 'over', odds1: book1.under_odds, odds2: book2.over_odds }
    ];

    let bestCalculation: ArbitrageCalculation | null = null;
    let bestProfit = 0;

    for (const combo of combinations) {
      if (combo.odds1 <= 0 || combo.odds2 <= 0) continue;

      const prob1 = this.oddsToImpliedProbability(combo.odds1);
      const prob2 = this.oddsToImpliedProbability(combo.odds2);
      const totalProb = prob1 + prob2;

      if (totalProb < 1) {
        const profitPercentage = (1 / totalProb) - 1;
        
        if (profitPercentage > bestProfit) {
          bestProfit = profitPercentage;
          bestCalculation = {
            profit_percentage: profitPercentage,
            stake_distribution: {
              [book1.book]: prob1 / totalProb,
              [book2.book]: prob2 / totalProb
            },
            execution_sequence: [
              {
                order: 1,
                book: book1.book,
                bet_type: combo.book1_side as 'over' | 'under',
                line: book1.line,
                odds: combo.odds1,
                stake_amount: prob1 / totalProb,
                urgency: 'immediate'
              },
              {
                order: 2,
                book: book2.book,
                bet_type: combo.book2_side as 'over' | 'under',
                line: book2.line,
                odds: combo.odds2,
                stake_amount: prob2 / totalProb,
                urgency: 'immediate'
              }
            ],
            risk_score: this.calculateRiskScore(book1, book2)
          };
        }
      }
    }

    return bestCalculation;
  }

  /**
   * Find middle betting opportunities
   */
  private findMiddleOpportunities(opportunities: BookOpportunity[]): MiddleOpportunity[] {
    const middles: MiddleOpportunity[] = [];

    // Find line differences that create middle opportunities
    for (let i = 0; i < opportunities.length; i++) {
      for (let j = i + 1; j < opportunities.length; j++) {
        const book1 = opportunities[i];
        const book2 = opportunities[j];
        
        const lineDiff = Math.abs(book1.line - book2.line);
        
        if (lineDiff >= 0.5) { // Meaningful line difference
          const middle = this.calculateMiddleOpportunity(book1, book2);
          if (middle && middle.expected_value > 0.05) { // 5% minimum EV
            middles.push(middle);
          }
        }
      }
    }

    return middles.sort((a, b) => b.expected_value - a.expected_value);
  }

  /**
   * Calculate middle opportunity between two books
   */
  private calculateMiddleOpportunity(book1: BookOpportunity, book2: BookOpportunity): MiddleOpportunity | null {
    const lineLow = Math.min(book1.line, book2.line);
    const lineHigh = Math.max(book1.line, book2.line);
    const middleRange = lineHigh - lineLow;

    if (middleRange < 0.5) return null;

    // Simplified middle calculation
    // In production, this would use more sophisticated probability models
    const profitProbability = this.estimateMiddleProbability(middleRange);
    const expectedValue = profitProbability * middleRange * 0.1; // Simplified EV

    return {
      line_low: lineLow,
      line_high: lineHigh,
      book_low: book1.line === lineLow ? book1.book : book2.book,
      book_high: book1.line === lineHigh ? book1.book : book2.book,
      middle_range: middleRange,
      profit_probability: profitProbability,
      expected_value: expectedValue
    };
  }

  /**
   * Analyze hedge opportunities for a specific ticket
   */
  private async analyzeTicketHedgeOpportunities(
    ticket: TicketLegData,
    propTick: PropTickData,
    arbitrageMatrix: ArbitrageMatrix
  ): Promise<HedgeOpportunity[]> {
    const opportunities: HedgeOpportunity[] = [];

    try {
      // Full hedge opportunity
      const fullHedge = await this.calculateFullHedge(ticket, propTick, arbitrageMatrix);
      if (fullHedge) opportunities.push(fullHedge);

      // Middle opportunities
      const middleOpportunities = await this.calculateMiddleHedges(ticket, propTick, arbitrageMatrix);
      opportunities.push(...middleOpportunities);

      // Freeroll opportunities
      const freerollOpportunity = await this.calculateFreeroll(ticket, propTick, arbitrageMatrix);
      if (freerollOpportunity) opportunities.push(freerollOpportunity);

    } catch (error) {
      this.logger.error('Failed to analyze ticket hedge opportunities', {
        ticketId: ticket.ticket_id,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return opportunities;
  }

  /**
   * Calculate full hedge opportunity
   */
  private async calculateFullHedge(
    ticket: TicketLegData,
    propTick: PropTickData,
    matrix: ArbitrageMatrix
  ): Promise<HedgeOpportunity | null> {
    // Find best book for opposite side of ticket's bet
    const ticketSide = this.determineBetSide(ticket.line, ticket.odds);
    const hedgeSide = ticketSide === 'over' ? 'under' : 'over';
    
    let bestHedgeBook: BookOpportunity | null = null;
    let bestHedgeValue = 0;

    for (const book of matrix.opportunities) {
      if (book.book === propTick.book) continue; // Different book required
      
      const hedgeOdds = hedgeSide === 'over' ? book.over_odds : book.under_odds;
      if (hedgeOdds <= 0) continue;
      
      const hedgeValue = this.calculateHedgeValue(ticket, hedgeOdds, book.line);
      if (hedgeValue > bestHedgeValue) {
        bestHedgeValue = hedgeValue;
        bestHedgeBook = book;
      }
    }

    if (!bestHedgeBook || bestHedgeValue < this.MIN_PROFIT_THRESHOLD) {
      return null;
    }

    const hedgeOdds = hedgeSide === 'over' ? bestHedgeBook.over_odds : bestHedgeBook.under_odds;
    const hedgeStake = this.calculateOptimalHedgeStake(ticket, hedgeOdds);
    
    return {
      type: 'full_hedge',
      ticket_id: ticket.ticket_id,
      player_name: ticket.player_name,
      stat_type: ticket.stat_type,
      
      original_line: ticket.line,
      original_odds: ticket.odds,
      original_stake_units: ticket.stake_units,
      
      recommended_line: bestHedgeBook.line,
      recommended_odds: hedgeOdds,
      recommended_stake_units: hedgeStake,
      recommended_book: bestHedgeBook.book,
      
      guaranteed_profit: bestHedgeValue * ticket.stake_units,
      max_profit: bestHedgeValue * ticket.stake_units,
      risk_free_percentage: (bestHedgeValue / ticket.stake_units) * 100,
      ev_improvement: bestHedgeValue,
      
      confidence: this.calculateHedgeConfidence(bestHedgeBook, propTick),
      execution_window_seconds: this.calculateExecutionWindow(propTick.time_to_game),
      books_available: [bestHedgeBook.book],
      market_depth: this.createMarketDepth(bestHedgeBook),
      
      time_to_game: propTick.time_to_game,
      line_movement_velocity: Math.abs(propTick.line_movement),
      opportunity_decay_rate: this.calculateDecayRate(propTick.time_to_game),
      
      counterparty_risk: this.assessCounterpartyRisk(bestHedgeBook.book),
      liquidity_score: bestHedgeBook.liquidity_score,
      execution_complexity: 'simple',
      
      expires_at: new Date(Date.now() + this.calculateExecutionWindow(propTick.time_to_game) * 1000).toISOString()
    };
  }

  /**
   * Calculate middle hedge opportunities
   */
  private async calculateMiddleHedges(
    ticket: TicketLegData,
    propTick: PropTickData,
    matrix: ArbitrageMatrix
  ): Promise<HedgeOpportunity[]> {
    const middleHedges: HedgeOpportunity[] = [];

    for (const middle of matrix.middle_opportunities) {
      if (middle.expected_value < 0.03) continue; // 3% minimum EV
      
      const opportunity = await this.convertMiddleToHedgeOpportunity(ticket, middle, propTick);
      if (opportunity) {
        middleHedges.push(opportunity);
      }
    }

    return middleHedges;
  }

  /**
   * Calculate freeroll opportunity
   */
  private async calculateFreeroll(
    ticket: TicketLegData,
    propTick: PropTickData,
    matrix: ArbitrageMatrix
  ): Promise<HedgeOpportunity | null> {
    // Look for opportunities where we can guarantee original stake back
    // while maintaining upside potential
    
    if (matrix.best_arbitrage && matrix.best_arbitrage.profit_percentage > 0.01) {
      // Convert arbitrage to freeroll structure
      return this.convertArbitrageToFreeroll(ticket, matrix.best_arbitrage, propTick);
    }

    return null;
  }

  // Utility Methods

  /**
   * Determine bet side (over/under) from line and odds
   */
  private determineBetSide(_line: number, odds: number): 'over' | 'under' {
    // Simplified logic - in production would need more sophisticated detection
    return odds > 0 ? 'over' : 'under';
  }

  /**
   * Calculate hedge value for a potential hedge bet
   */
  private calculateHedgeValue(ticket: TicketLegData, hedgeOdds: number, _hedgeLine: number): number {
    // Simplified hedge value calculation
    const originalImpliedProb = this.oddsToImpliedProbability(ticket.odds);
    const hedgeImpliedProb = this.oddsToImpliedProbability(hedgeOdds);
    
    return Math.max(0, (1 - originalImpliedProb - hedgeImpliedProb));
  }

  /**
   * Calculate optimal hedge stake
   */
  private calculateOptimalHedgeStake(ticket: TicketLegData, hedgeOdds: number): number {
    // Calculate stake that guarantees profit regardless of outcome
    const originalPayout = this.calculatePayout(ticket.odds, ticket.stake_units);
    const hedgeStake = originalPayout / this.calculatePayout(hedgeOdds, 1);
    
    return Math.round(hedgeStake * 100) / 100;
  }

  /**
   * Calculate hedge confidence score
   */
  private calculateHedgeConfidence(book: BookOpportunity, propTick: PropTickData): number {
    let confidence = 0.7; // Base confidence
    
    // Recent data gets higher confidence
    const ageMinutes = (Date.now() - new Date(book.last_updated).getTime()) / 60000;
    if (ageMinutes < 1) confidence += 0.2;
    else if (ageMinutes < 5) confidence += 0.1;
    
    // High liquidity books get bonus
    confidence += book.liquidity_score * 0.1;
    
    // Steam detection adds confidence
    if (propTick.steam_detected) confidence += 0.05;
    if (propTick.sharp_money_indicator) confidence += 0.05;
    
    return Math.min(confidence, 0.95);
  }

  /**
   * Calculate execution window based on time to game
   */
  private calculateExecutionWindow(timeToGameMinutes: number): number {
    if (timeToGameMinutes <= 60) return 120; // 2 minutes for games starting soon
    if (timeToGameMinutes <= 180) return 300; // 5 minutes for games starting in <3 hours
    return 600; // 10 minutes for games further out
  }

  /**
   * Calculate opportunity decay rate
   */
  private calculateDecayRate(timeToGameMinutes: number): number {
    // Opportunities decay faster as game time approaches
    if (timeToGameMinutes <= 30) return 0.05; // 5% per minute
    if (timeToGameMinutes <= 120) return 0.02; // 2% per minute
    return 0.01; // 1% per minute
  }

  /**
   * Create market depth object
   */
  private createMarketDepth(book: BookOpportunity): MarketDepth {
    return {
      book: book.book,
      available_liquidity: this.estimateLiquidity(book),
      max_bet_limit: this.getMaxBetLimit(book.book),
      spread_width: Math.abs(book.over_odds - book.under_odds),
      volume_last_hour: this.estimateVolume(book)
    };
  }

  /**
   * Convert middle opportunity to hedge opportunity
   */
  private async convertMiddleToHedgeOpportunity(
    _ticket: TicketLegData,
    _middle: MiddleOpportunity,
    _propTick: PropTickData
  ): Promise<HedgeOpportunity | null> {
    // Complex conversion logic would go here
    // For now, return simplified version
    return null;
  }

  /**
   * Convert arbitrage to freeroll opportunity
   */
  private convertArbitrageToFreeroll(
    _ticket: TicketLegData,
    _arbitrage: ArbitrageCalculation,
    _propTick: PropTickData
  ): HedgeOpportunity | null {
    // Complex conversion logic would go here
    // For now, return simplified version
    return null;
  }

  /**
   * Process hedge opportunity (save to database and emit events)
   */
  async processHedgeOpportunity(opportunity: HedgeOpportunity): Promise<void> {
    try {
      // Save to database
      const { data, error } = await this.supabase
        .from('hedge_recommendations')
        .insert({
          ticket_id: opportunity.ticket_id,
          type: opportunity.type,
          player_name: opportunity.player_name,
          stat_type: opportunity.stat_type,
          recommended_line: opportunity.recommended_line,
          recommended_odds: opportunity.recommended_odds,
          hedge_amount_units: opportunity.recommended_stake_units,
          expected_profit: opportunity.guaranteed_profit,
          confidence: opportunity.confidence,
          books_available: opportunity.books_available,
          expires_at: opportunity.expires_at,
          opportunity_score: opportunity.ev_improvement,
          risk_assessment: {
            counterparty_risk: opportunity.counterparty_risk,
            liquidity_score: opportunity.liquidity_score,
            execution_complexity: opportunity.execution_complexity
          },
          market_conditions: {
            time_to_game: opportunity.time_to_game,
            line_movement_velocity: opportunity.line_movement_velocity,
            opportunity_decay_rate: opportunity.opportunity_decay_rate
          }
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to save hedge opportunity: ${error.message}`);
      }

      // Emit hedge opportunity event
      await this.emitHedgeOpportunityEvent(data);

      this.logger.info('💰 Hedge opportunity processed and saved', {
        id: data.id,
        type: opportunity.type,
        ticketId: opportunity.ticket_id,
        expectedProfit: opportunity.guaranteed_profit
      });

    } catch (error) {
      this.logger.error('Failed to process hedge opportunity', {
        ticketId: opportunity.ticket_id,
        type: opportunity.type,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Emit hedge opportunity event
   */
  private async emitHedgeOpportunityEvent(hedgeData: any): Promise<void> {
    await this.supabase
      .from('events')
      .insert({
        event_type: 'alert.hedge.opportunity.detected.v1',
        aggregate_id: hedgeData.ticket_id,
        aggregate_type: 'hedge_opportunity',
        event_data: hedgeData,
        idempotency_key: `hedge-${hedgeData.id}-${Date.now()}`,
        metadata: {
          source: 'HedgeDetectionEngine',
          priority: hedgeData.confidence > 0.8 ? 'high' : 'normal'
        }
      });
  }

  /**
   * Filter and rank opportunities by quality
   */
  private filterAndRankOpportunities(opportunities: HedgeOpportunity[]): HedgeOpportunity[] {
    return opportunities
      .filter(opp => 
        opp.confidence >= this.MIN_CONFIDENCE_SCORE &&
        opp.guaranteed_profit > 0 &&
        opp.execution_window_seconds > 60
      )
      .sort((a, b) => {
        // Sort by risk-adjusted expected value
        const scoreA = a.guaranteed_profit * a.confidence * a.liquidity_score;
        const scoreB = b.guaranteed_profit * b.confidence * b.liquidity_score;
        return scoreB - scoreA;
      })
      .slice(0, 10); // Top 10 opportunities
  }

  // Helper utility methods

  private oddsToImpliedProbability(odds: number): number {
    return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
  }

  private calculatePayout(odds: number, stake: number): number {
    return odds > 0 ? stake * (odds / 100) : stake * (100 / Math.abs(odds));
  }

  private calculateRiskScore(book1: BookOpportunity, book2: BookOpportunity): number {
    return (book1.liquidity_score + book2.liquidity_score) / 2;
  }

  private estimateMiddleProbability(middleRange: number): number {
    // Simplified probability estimation
    return Math.min(middleRange * 0.2, 0.4);
  }

  private assessCounterpartyRisk(book: string): number {
    // Major books have lower risk
    const riskScores: { [key: string]: number } = {
      'DraftKings': 0.1,
      'FanDuel': 0.1,
      'BetMGM': 0.15,
      'Caesars': 0.2,
      'PointsBet': 0.25,
      'BetRivers': 0.3
    };
    return riskScores[book] || 0.4;
  }

  private estimateLiquidity(book: BookOpportunity): number {
    return book.liquidity_score * 10000; // Simplified
  }

  private getMaxBetLimit(book: string): number {
    const limits: { [key: string]: number } = {
      'DraftKings': 10000,
      'FanDuel': 10000,
      'BetMGM': 5000,
      'Caesars': 5000,
      'PointsBet': 3000,
      'BetRivers': 3000
    };
    return limits[book] || 1000;
  }

  private estimateVolume(book: BookOpportunity): number {
    return book.liquidity_score * 50; // Simplified
  }

  // Cache management

  private isValidCacheEntry(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    return expiry !== undefined && expiry > Date.now();
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (expiry <= now) {
        this.marketDataCache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
  }
}