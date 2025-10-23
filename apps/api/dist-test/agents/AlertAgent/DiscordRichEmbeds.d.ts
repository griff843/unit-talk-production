import { EmbedBuilder } from 'discord.js';
import { Logger } from '../../shared/logger/types';
interface EnhancedAlertData {
    type: 'steam' | 'line_movement' | 'injury' | 'hedge' | 'middle' | 'arbitrage' | 'live_ticket' | 'sweat';
    priority: 'urgent' | 'high' | 'medium' | 'low';
    player_name: string;
    stat_type: string;
    sport: string;
    team?: string;
    opponent?: string;
    game_time?: string;
    confidence: number;
    trigger_data: Record<string, any>;
    units?: number;
    potential_payout?: number;
    hedge_amount?: number;
    profit_potential?: number;
    time_to_game: number;
    expires_at: string;
}
interface PlayerEnrichmentData {
    headshot_url?: string;
    team_logo_url?: string;
    opponent_logo_url?: string;
    season_stats?: {
        games_played: number;
        avg_stat_value: number;
        hit_rate: number;
        trend: 'up' | 'down' | 'stable';
    };
    injury_status?: {
        status: 'healthy' | 'questionable' | 'doubtful' | 'out';
        injury_type?: string;
        last_update: string;
    };
}
interface HedgeOpportunityEmbed {
    ticket_id: string;
    type: 'full_hedge' | 'middle_opportunity' | 'freeroll';
    player_name: string;
    stat_type: string;
    guaranteed_profit: number;
    hedge_amount_units: number;
    confidence: number;
    execution_window_seconds: number;
    books_available: string[];
    recommended_book: string;
}
interface TicketStateEmbed {
    ticket_id: string;
    ticket_type: 'single' | 'parlay' | 'round_robin';
    state: 'OPEN' | 'LIVE' | 'SWEAT' | 'HEDGE_WINDOW' | 'DONE';
    legs_total: number;
    legs_hit: number;
    legs_pending: number;
    exposure_units: number;
    potential_payout: number;
    cashout_ev_percentage?: number;
}
export declare class DiscordRichEmbeds {
    private logger;
    private readonly ALERT_COLORS;
    private readonly EMOJIS;
    constructor(logger: Logger);
    /**
     * Create enhanced alert embed with player enrichment
     */
    createEnhancedAlertEmbed(alertData: EnhancedAlertData, playerData?: PlayerEnrichmentData, advice?: string): Promise<EmbedBuilder>;
    /**
     * Create hedge opportunity embed
     */
    createHedgeOpportunityEmbed(hedgeData: HedgeOpportunityEmbed, playerData?: PlayerEnrichmentData): Promise<EmbedBuilder>;
    /**
     * Create ticket state transition embed
     */
    createTicketStateEmbed(ticketData: TicketStateEmbed, fromState?: string, trigger?: string): Promise<EmbedBuilder>;
    /**
     * Create batch alert summary embed
     */
    createBatchAlertEmbed(alerts: EnhancedAlertData[], title?: string): Promise<EmbedBuilder>;
    /**
     * Build enhanced description with game context
     */
    private buildEnhancedDescription;
    /**
     * Format selection field with enhanced information
     */
    private formatSelectionField;
    /**
     * Add alert-specific fields based on type
     */
    private addAlertSpecificFields;
    /**
     * Format steam movement field
     */
    private formatSteamField;
    /**
     * Format line movement field
     */
    private formatLineMovementField;
    /**
     * Format injury field
     */
    private formatInjuryField;
    /**
     * Format arbitrage field
     */
    private formatArbitrageField;
    /**
     * Format financial field
     */
    private formatFinancialField;
    /**
     * Format confidence field with visual indicators
     */
    private formatConfidenceField;
    /**
     * Format timing field
     */
    private formatTimingField;
    /**
     * Format advice text
     */
    private formatAdvice;
    /**
     * Format season stats
     */
    private formatSeasonStats;
    /**
     * Format injury status
     */
    private formatInjuryStatus;
    /**
     * Build footer text
     */
    private buildFooterText;
    /**
     * Format alert type title
     */
    private formatAlertTypeTitle;
    /**
     * Format hedge type title
     */
    private formatHedgeTypeTitle;
    /**
     * Get color for ticket state
     */
    private getStateColor;
    /**
     * Get injury emoji
     */
    private getInjuryEmoji;
    /**
     * Create progress bar for ticket legs
     */
    private createProgressBar;
    /**
     * Get state-specific advice
     */
    private getStateAdvice;
    /**
     * Group alerts by type for batch display
     */
    private groupAlertsByType;
}
export {};
//# sourceMappingURL=DiscordRichEmbeds.d.ts.map