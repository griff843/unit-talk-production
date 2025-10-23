import 'dotenv/config';
import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics, HealthStatus } from '../BaseAgent/types';
export declare class AlertAgent extends BaseAgent {
    private alertMetrics;
    private rateLimiter;
    private eventSubscriptionManager;
    private ticketStateManager;
    private eventDrivenProcessor;
    private hedgeDetectionEngine;
    private discordRichEmbeds;
    private readonly RATE_LIMITS;
    constructor(config: BaseAgentConfig, deps: BaseAgentDependencies);
    protected initialize(): Promise<void>;
    /**
     * Initialize sophisticated event-driven components
     */
    private initializeSophisticatedComponents;
    /**
     * Start sophisticated metrics collection
     */
    private startSophisticatedMetricsCollection;
    /**
     * Update sophisticated component metrics
     */
    private updateSophisticatedMetrics;
    protected cleanup(): Promise<void>;
    protected collectMetrics(): Promise<BaseMetrics>;
    checkHealth(): Promise<HealthStatus>;
    startMetricsServer(): Promise<void>;
    private enforceRateLimit;
    private isAlertAlreadySent;
    protected process(): Promise<void>;
    /**
     * Check if AlertAgent is running in event-driven mode
     */
    isEventDrivenMode(): boolean;
    /**
     * Get event subscription status for monitoring
     */
    getEventSubscriptionStatus(): Promise<any>;
    /**
     * Monitor both live and scheduled picks for posting
     */
    monitorPicksForPosting(): Promise<void>;
    /**
     * Monitor unified_picks table for live picks and post immediately
     */
    monitorLivePicks(): Promise<void>;
    /**
     * Post individual live pick to Discord immediately
     */
    postLivePick(pickData: any): Promise<void>;
    /**
     * Route pick to appropriate Discord thread based on capper and game context
     */
    private routeToThread;
    /**
     * Format Discord embed for live picks with urgency indicators
     */
    private formatLivePickEmbed;
    /**
     * Update pick with Discord posting information
     */
    private updatePickWithDiscordInfo;
    /**
     * Notify VIP users for high-tier picks
     */
    private notifyVIPUsers;
    /**
     * Log pick for manual posting when automated posting fails
     */
    private logPickForManualPosting;
    /**
     * Monitor for scheduled picks (10 AM EST batch posting)
     */
    monitorScheduledPicks(): Promise<void>;
    /**
     * Post scheduled pick with batch formatting
     */
    private postScheduledPick;
    /**
     * Format Discord embed for scheduled picks (less urgent styling)
     */
    private formatScheduledPickEmbed;
    /**
     * Initialize a ticket in the state management system
     */
    initializeTicket(ticketId: string, ticketType: 'single' | 'parlay' | 'round_robin', legs: Array<{
        player_name: string;
        stat_type: string;
        line: number;
        odds: number;
        game_start_time: string;
    }>, exposureUnits?: number): Promise<any>;
    /**
     * Update leg outcome and trigger state transitions
     */
    updateLegOutcome(ticketId: string, legIndex: number, outcome: 'hit' | 'miss' | 'void'): Promise<any>;
    /**
     * Get ticket state
     */
    getTicketState(ticketId: string): Promise<any>;
    /**
     * Force state transition (admin function)
     */
    forceStateTransition(ticketId: string, newState: 'OPEN' | 'LIVE' | 'SWEAT' | 'HEDGE_WINDOW' | 'DONE', reason: string): Promise<any>;
    /**
     * Get sophisticated processing metrics
     */
    getSophisticatedMetrics(): any;
    /**
     * Get health status with sophisticated components
     */
    getSophisticatedHealthStatus(): Promise<any>;
    /**
     * Test sophisticated alert generation
     */
    testSophisticatedAlert(alertType: 'steam' | 'hedge' | 'arbitrage' | 'live_ticket'): Promise<void>;
    /**
     * Manual hedge opportunity detection
     */
    detectHedgeOpportunities(propId: string): Promise<any[]>;
    /**
     * Check if running in sophisticated event-driven mode
     */
    isSophisticatedMode(): boolean;
}
//# sourceMappingURL=index.d.ts.map