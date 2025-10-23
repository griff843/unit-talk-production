import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../shared/logger/types';
export declare enum TicketState {
    OPEN = "OPEN",
    LIVE = "LIVE",
    SWEAT = "SWEAT",
    HEDGE_WINDOW = "HEDGE_WINDOW",
    DONE = "DONE"
}
export declare enum TicketType {
    SINGLE = "single",
    PARLAY = "parlay",
    ROUND_ROBIN = "round_robin"
}
export interface TicketLeg {
    id: string;
    ticket_id: string;
    leg_index: number;
    player_name: string;
    stat_type: string;
    line: number;
    odds: number;
    outcome: 'pending' | 'hit' | 'miss' | 'void';
    game_id: string;
    game_status: 'scheduled' | 'live' | 'final' | 'postponed';
    game_start_time: string;
    created_at: string;
    updated_at: string;
}
export interface TicketStateData {
    id: string;
    ticket_id: string;
    ticket_type: TicketType;
    state: TicketState;
    legs_total: number;
    legs_hit: number;
    legs_miss: number;
    legs_pending: number;
    current_leg_index: number;
    exposure_units: number;
    potential_payout: number;
    cashout_value: number;
    cashout_ev_percentage: number;
    state_entered_at: string;
    state_metadata: Record<string, any>;
    hedge_recommendations: HedgeRecommendation[];
    created_at: string;
    updated_at: string;
}
export interface HedgeRecommendation {
    id: string;
    type: 'full_hedge' | 'middle_opportunity' | 'freeroll';
    player_name: string;
    stat_type: string;
    recommended_line: number;
    recommended_odds: number;
    hedge_amount_units: number;
    expected_profit: number;
    confidence: number;
    books_available: string[];
    expires_at: string;
    created_at: string;
}
export interface StateTransitionEvent {
    ticket_id: string;
    from_state: TicketState;
    to_state: TicketState;
    trigger: string;
    metadata: Record<string, any>;
    timestamp: string;
}
export declare class TicketStateManager {
    private supabase;
    private logger;
    private readonly VALID_TRANSITIONS;
    constructor(supabase: SupabaseClient, logger: Logger);
    /**
     * Initialize a new ticket in the state machine
     */
    initializeTicket(ticketId: string, ticketType: TicketType, legs: TicketLeg[], exposureUnits?: number): Promise<TicketStateData>;
    /**
     * Update leg outcome and potentially trigger state transitions
     */
    updateLegOutcome(ticketId: string, legIndex: number, outcome: 'hit' | 'miss' | 'void'): Promise<TicketStateData>;
    /**
     * Get current ticket state
     */
    getTicketState(ticketId: string): Promise<TicketStateData | null>;
    /**
     * Evaluate if state transition is needed and perform it
     */
    private evaluateStateTransition;
    /**
     * Determine what the new state should be based on current ticket data
     */
    private determineNewState;
    /**
     * Check if any leg of the ticket is currently live
     */
    private hasLiveLeg;
    /**
     * Check if a specific leg is currently live
     */
    private isLegLive;
    /**
     * Perform state transition
     */
    transitionToState(ticketId: string, newState: TicketState, trigger: string, metadata?: Record<string, any>): Promise<TicketStateData>;
    /**
     * Check if a state transition is valid
     */
    private isValidTransition;
    /**
     * Handle actions when entering specific states
     */
    private handleStateActions;
    /**
     * Handle LIVE state entry
     */
    private handleLiveState;
    /**
     * Handle SWEAT state entry
     */
    private handleSweatState;
    /**
     * Handle HEDGE_WINDOW state entry
     */
    private handleHedgeWindowState;
    /**
     * Handle DONE state entry
     */
    private handleDoneState;
    /**
     * Generate hedge recommendations for HEDGE_WINDOW state
     */
    private generateHedgeRecommendations;
    /**
     * Calculate potential payout from legs
     */
    private calculatePotentialPayout;
    /**
     * Emit state transition event
     */
    private emitStateTransitionEvent;
    /**
     * Emit alert event
     */
    private emitAlertEvent;
    /**
     * Get priority level for state transitions
     */
    private getTransitionPriority;
    /**
     * Get all tickets in a specific state
     */
    getTicketsByState(state: TicketState, limit?: number): Promise<TicketStateData[]>;
    /**
     * Force state transition (admin function)
     */
    forceStateTransition(ticketId: string, newState: TicketState, reason: string): Promise<TicketStateData>;
}
//# sourceMappingURL=TicketStateManager.d.ts.map