import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../shared/logger/types';
interface HedgeOpportunity {
    id?: string;
    type: 'full_hedge' | 'middle_opportunity' | 'freeroll';
    ticket_id: string;
    player_name: string;
    stat_type: string;
    original_line: number;
    original_odds: number;
    original_stake_units: number;
    recommended_line: number;
    recommended_odds: number;
    recommended_stake_units: number;
    recommended_book: string;
    guaranteed_profit: number;
    max_profit: number;
    risk_free_percentage: number;
    ev_improvement: number;
    confidence: number;
    execution_window_seconds: number;
    books_available: string[];
    market_depth: MarketDepth;
    time_to_game: number;
    line_movement_velocity: number;
    opportunity_decay_rate: number;
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
export declare class HedgeDetectionEngine {
    private supabase;
    private logger;
    private readonly MIN_PROFIT_THRESHOLD;
    private readonly MAX_EXECUTION_WINDOW;
    private readonly MIN_CONFIDENCE_SCORE;
    private readonly BOOKS_COVERAGE;
    private marketDataCache;
    private cacheExpiry;
    private readonly CACHE_TTL;
    constructor(supabase: SupabaseClient, logger: Logger);
    /**
     * Main entry point: Analyze hedge opportunities for incoming prop tick
     */
    analyzeHedgeOpportunities(propTick: PropTickData): Promise<HedgeOpportunity[]>;
    /**
     * Get active tickets with legs matching the prop tick
     */
    private getMatchingActiveTickets;
    /**
     * Build comprehensive arbitrage matrix across all books for this prop
     */
    private buildArbitrageMatrix;
    /**
     * Process book opportunities from raw tick data
     */
    private processBookOpportunities;
    /**
     * Calculate liquidity score for a book/market
     */
    private calculateLiquidityScore;
    /**
     * Process arbitrage matrix from book opportunities
     */
    private processArbitrageMatrix;
    /**
     * Find best pure arbitrage opportunity
     */
    private findBestArbitrage;
    /**
     * Calculate arbitrage between two book opportunities
     */
    private calculateArbitrage;
    /**
     * Find middle betting opportunities
     */
    private findMiddleOpportunities;
    /**
     * Calculate middle opportunity between two books
     */
    private calculateMiddleOpportunity;
    /**
     * Analyze hedge opportunities for a specific ticket
     */
    private analyzeTicketHedgeOpportunities;
    /**
     * Calculate full hedge opportunity
     */
    private calculateFullHedge;
    /**
     * Calculate middle hedge opportunities
     */
    private calculateMiddleHedges;
    /**
     * Calculate freeroll opportunity
     */
    private calculateFreeroll;
    /**
     * Determine bet side (over/under) from line and odds
     */
    private determineBetSide;
    /**
     * Calculate hedge value for a potential hedge bet
     */
    private calculateHedgeValue;
    /**
     * Calculate optimal hedge stake
     */
    private calculateOptimalHedgeStake;
    /**
     * Calculate hedge confidence score
     */
    private calculateHedgeConfidence;
    /**
     * Calculate execution window based on time to game
     */
    private calculateExecutionWindow;
    /**
     * Calculate opportunity decay rate
     */
    private calculateDecayRate;
    /**
     * Create market depth object
     */
    private createMarketDepth;
    /**
     * Convert middle opportunity to hedge opportunity
     */
    private convertMiddleToHedgeOpportunity;
    /**
     * Convert arbitrage to freeroll opportunity
     */
    private convertArbitrageToFreeroll;
    /**
     * Process hedge opportunity (save to database and emit events)
     */
    processHedgeOpportunity(opportunity: HedgeOpportunity): Promise<void>;
    /**
     * Emit hedge opportunity event
     */
    private emitHedgeOpportunityEvent;
    /**
     * Filter and rank opportunities by quality
     */
    private filterAndRankOpportunities;
    private oddsToImpliedProbability;
    private calculatePayout;
    private calculateRiskScore;
    private estimateMiddleProbability;
    private assessCounterpartyRisk;
    private estimateLiquidity;
    private getMaxBetLimit;
    private estimateVolume;
    private isValidCacheEntry;
    private cleanupCache;
}
export {};
//# sourceMappingURL=HedgeDetectionEngine.d.ts.map