"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HedgeDetectionEngine = void 0;
const enhanced_circuit_breaker_1 = require("../../services/enhanced-circuit-breaker");
class HedgeDetectionEngine {
    constructor(supabase, logger) {
        // Detection parameters
        this.MIN_PROFIT_THRESHOLD = 0.02; // 2% minimum profit
        this.MAX_EXECUTION_WINDOW = 300; // 5 minutes
        this.MIN_CONFIDENCE_SCORE = 0.65;
        this.BOOKS_COVERAGE = ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'PointsBet', 'BetRivers'];
        // Market analysis cache
        this.marketDataCache = new Map();
        this.cacheExpiry = new Map();
        this.CACHE_TTL = 30000; // 30 seconds
        this.supabase = supabase;
        this.logger = logger;
        // Start cache cleanup interval
        setInterval(() => this.cleanupCache(), 60000); // Every minute
    }
    /**
     * Main entry point: Analyze hedge opportunities for incoming prop tick
     */
    async analyzeHedgeOpportunities(propTick) {
        const startTime = Date.now();
        const opportunities = [];
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
                const ticketOpportunities = await this.analyzeTicketHedgeOpportunities(ticket, propTick, arbitrageMatrix);
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
        }
        catch (error) {
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
    async getMatchingActiveTickets(propTick) {
        return await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
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
                stake_units: leg.ticket_states.exposure_units,
                outcome: leg.outcome,
                game_start_time: leg.game_start_time
            }));
        }, async () => {
            this.logger.warn('Circuit breaker open - returning empty matching tickets');
            return [];
        });
    }
    /**
     * Build comprehensive arbitrage matrix across all books for this prop
     */
    async buildArbitrageMatrix(propTick) {
        const cacheKey = `${propTick.player_name}-${propTick.stat_type}`;
        // Check cache first
        if (this.isValidCacheEntry(cacheKey)) {
            const cachedData = this.marketDataCache.get(cacheKey);
            return this.processArbitrageMatrix(propTick, cachedData);
        }
        try {
            // Get recent ticks across all books for this prop
            const { data: recentTicks, error } = await this.supabase
                .from('prop_ticks_hot')
                .select('*')
                .eq('player_name', propTick.player_name)
                .eq('stat_type', propTick.stat_type)
                .gte('tick_timestamp', new Date(Date.now() - 300000).toISOString()) // Last 5 minutes
                .order('tick_timestamp', { ascending: false });
            if (error || !recentTicks) {
                throw new Error(`Failed to get recent ticks: ${error?.message}`);
            }
            // Group by book and get latest tick for each
            const bookOpportunities = this.processBookOpportunities(recentTicks);
            // Cache the results
            this.marketDataCache.set(cacheKey, bookOpportunities);
            this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);
            return this.processArbitrageMatrix(propTick, bookOpportunities);
        }
        catch (error) {
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
     * Process book opportunities from raw tick data
     */
    processBookOpportunities(ticks) {
        const bookMap = new Map();
        // Get latest tick for each book
        for (const tick of ticks) {
            if (!bookMap.has(tick.book) ||
                new Date(tick.tick_timestamp) > new Date(bookMap.get(tick.book).tick_timestamp)) {
                bookMap.set(tick.book, tick);
            }
        }
        return Array.from(bookMap.values()).map(tick => ({
            book: tick.book,
            line: tick.line,
            over_odds: tick.over_odds || 0,
            under_odds: tick.under_odds || 0,
            liquidity_score: this.calculateLiquidityScore(tick),
            last_updated: tick.tick_timestamp
        }));
    }
    /**
     * Calculate liquidity score for a book/market
     */
    calculateLiquidityScore(tick) {
        let score = 0.5; // Base score
        // Major books get higher scores
        if (['DraftKings', 'FanDuel', 'BetMGM'].includes(tick.book)) {
            score += 0.3;
        }
        // Recent updates get higher scores
        const ageMinutes = (Date.now() - new Date(tick.tick_timestamp).getTime()) / 60000;
        if (ageMinutes < 1)
            score += 0.2;
        else if (ageMinutes < 5)
            score += 0.1;
        // High confidence data gets bonus
        if (tick.confidence_level > 0.8)
            score += 0.1;
        return Math.min(score, 1.0);
    }
    /**
     * Process arbitrage matrix from book opportunities
     */
    processArbitrageMatrix(propTick, bookOpportunities) {
        const matrix = {
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
    findBestArbitrage(opportunities) {
        let bestArbitrage = null;
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
    calculateArbitrage(book1, book2) {
        // Try over/under combinations
        const combinations = [
            { book1_side: 'over', book2_side: 'under', odds1: book1.over_odds, odds2: book2.under_odds },
            { book1_side: 'under', book2_side: 'over', odds1: book1.under_odds, odds2: book2.over_odds }
        ];
        let bestCalculation = null;
        let bestProfit = 0;
        for (const combo of combinations) {
            if (combo.odds1 <= 0 || combo.odds2 <= 0)
                continue;
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
                                bet_type: combo.book1_side,
                                line: book1.line,
                                odds: combo.odds1,
                                stake_amount: prob1 / totalProb,
                                urgency: 'immediate'
                            },
                            {
                                order: 2,
                                book: book2.book,
                                bet_type: combo.book2_side,
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
    findMiddleOpportunities(opportunities) {
        const middles = [];
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
    calculateMiddleOpportunity(book1, book2) {
        const lineLow = Math.min(book1.line, book2.line);
        const lineHigh = Math.max(book1.line, book2.line);
        const middleRange = lineHigh - lineLow;
        if (middleRange < 0.5)
            return null;
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
    async analyzeTicketHedgeOpportunities(ticket, propTick, arbitrageMatrix) {
        const opportunities = [];
        try {
            // Full hedge opportunity
            const fullHedge = await this.calculateFullHedge(ticket, propTick, arbitrageMatrix);
            if (fullHedge)
                opportunities.push(fullHedge);
            // Middle opportunities
            const middleOpportunities = await this.calculateMiddleHedges(ticket, propTick, arbitrageMatrix);
            opportunities.push(...middleOpportunities);
            // Freeroll opportunities
            const freerollOpportunity = await this.calculateFreeroll(ticket, propTick, arbitrageMatrix);
            if (freerollOpportunity)
                opportunities.push(freerollOpportunity);
        }
        catch (error) {
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
    async calculateFullHedge(ticket, propTick, matrix) {
        // Find best book for opposite side of ticket's bet
        const ticketSide = this.determineBetSide(ticket.line, ticket.odds);
        const hedgeSide = ticketSide === 'over' ? 'under' : 'over';
        let bestHedgeBook = null;
        let bestHedgeValue = 0;
        for (const book of matrix.opportunities) {
            if (book.book === propTick.book)
                continue; // Different book required
            const hedgeOdds = hedgeSide === 'over' ? book.over_odds : book.under_odds;
            if (hedgeOdds <= 0)
                continue;
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
    async calculateMiddleHedges(ticket, propTick, matrix) {
        const middleHedges = [];
        for (const middle of matrix.middle_opportunities) {
            if (middle.expected_value < 0.03)
                continue; // 3% minimum EV
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
    async calculateFreeroll(ticket, propTick, matrix) {
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
    determineBetSide(line, odds) {
        // Simplified logic - in production would need more sophisticated detection
        return odds > 0 ? 'over' : 'under';
    }
    /**
     * Calculate hedge value for a potential hedge bet
     */
    calculateHedgeValue(ticket, hedgeOdds, hedgeLine) {
        // Simplified hedge value calculation
        const originalImpliedProb = this.oddsToImpliedProbability(ticket.odds);
        const hedgeImpliedProb = this.oddsToImpliedProbability(hedgeOdds);
        return Math.max(0, (1 - originalImpliedProb - hedgeImpliedProb));
    }
    /**
     * Calculate optimal hedge stake
     */
    calculateOptimalHedgeStake(ticket, hedgeOdds) {
        // Calculate stake that guarantees profit regardless of outcome
        const originalPayout = this.calculatePayout(ticket.odds, ticket.stake_units);
        const hedgeStake = originalPayout / this.calculatePayout(hedgeOdds, 1);
        return Math.round(hedgeStake * 100) / 100;
    }
    /**
     * Calculate hedge confidence score
     */
    calculateHedgeConfidence(book, propTick) {
        let confidence = 0.7; // Base confidence
        // Recent data gets higher confidence
        const ageMinutes = (Date.now() - new Date(book.last_updated).getTime()) / 60000;
        if (ageMinutes < 1)
            confidence += 0.2;
        else if (ageMinutes < 5)
            confidence += 0.1;
        // High liquidity books get bonus
        confidence += book.liquidity_score * 0.1;
        // Steam detection adds confidence
        if (propTick.steam_detected)
            confidence += 0.05;
        if (propTick.sharp_money_indicator)
            confidence += 0.05;
        return Math.min(confidence, 0.95);
    }
    /**
     * Calculate execution window based on time to game
     */
    calculateExecutionWindow(timeToGameMinutes) {
        if (timeToGameMinutes <= 60)
            return 120; // 2 minutes for games starting soon
        if (timeToGameMinutes <= 180)
            return 300; // 5 minutes for games starting in <3 hours
        return 600; // 10 minutes for games further out
    }
    /**
     * Calculate opportunity decay rate
     */
    calculateDecayRate(timeToGameMinutes) {
        // Opportunities decay faster as game time approaches
        if (timeToGameMinutes <= 30)
            return 0.05; // 5% per minute
        if (timeToGameMinutes <= 120)
            return 0.02; // 2% per minute
        return 0.01; // 1% per minute
    }
    /**
     * Create market depth object
     */
    createMarketDepth(book) {
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
    async convertMiddleToHedgeOpportunity(ticket, middle, propTick) {
        // Complex conversion logic would go here
        // For now, return simplified version
        return null;
    }
    /**
     * Convert arbitrage to freeroll opportunity
     */
    convertArbitrageToFreeroll(ticket, arbitrage, propTick) {
        // Complex conversion logic would go here
        // For now, return simplified version
        return null;
    }
    /**
     * Process hedge opportunity (save to database and emit events)
     */
    async processHedgeOpportunity(opportunity) {
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
        }
        catch (error) {
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
    async emitHedgeOpportunityEvent(hedgeData) {
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
    filterAndRankOpportunities(opportunities) {
        return opportunities
            .filter(opp => opp.confidence >= this.MIN_CONFIDENCE_SCORE &&
            opp.guaranteed_profit > 0 &&
            opp.execution_window_seconds > 60)
            .sort((a, b) => {
            // Sort by risk-adjusted expected value
            const scoreA = a.guaranteed_profit * a.confidence * a.liquidity_score;
            const scoreB = b.guaranteed_profit * b.confidence * b.liquidity_score;
            return scoreB - scoreA;
        })
            .slice(0, 10); // Top 10 opportunities
    }
    // Helper utility methods
    oddsToImpliedProbability(odds) {
        return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
    }
    calculatePayout(odds, stake) {
        return odds > 0 ? stake * (odds / 100) : stake * (100 / Math.abs(odds));
    }
    calculateRiskScore(book1, book2) {
        return (book1.liquidity_score + book2.liquidity_score) / 2;
    }
    estimateMiddleProbability(middleRange) {
        // Simplified probability estimation
        return Math.min(middleRange * 0.2, 0.4);
    }
    assessCounterpartyRisk(book) {
        // Major books have lower risk
        const riskScores = {
            'DraftKings': 0.1,
            'FanDuel': 0.1,
            'BetMGM': 0.15,
            'Caesars': 0.2,
            'PointsBet': 0.25,
            'BetRivers': 0.3
        };
        return riskScores[book] || 0.4;
    }
    estimateLiquidity(book) {
        return book.liquidity_score * 10000; // Simplified
    }
    getMaxBetLimit(book) {
        const limits = {
            'DraftKings': 10000,
            'FanDuel': 10000,
            'BetMGM': 5000,
            'Caesars': 5000,
            'PointsBet': 3000,
            'BetRivers': 3000
        };
        return limits[book] || 1000;
    }
    estimateVolume(book) {
        return book.liquidity_score * 50; // Simplified
    }
    // Cache management
    isValidCacheEntry(key) {
        const expiry = this.cacheExpiry.get(key);
        return expiry !== undefined && expiry > Date.now();
    }
    cleanupCache() {
        const now = Date.now();
        for (const [key, expiry] of this.cacheExpiry.entries()) {
            if (expiry <= now) {
                this.marketDataCache.delete(key);
                this.cacheExpiry.delete(key);
            }
        }
    }
}
exports.HedgeDetectionEngine = HedgeDetectionEngine;
