import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../shared/logger/types';
import { withCircuitBreaker } from '../../services/enhanced-circuit-breaker';

// Ticket state machine definition
export enum TicketState {
  OPEN = 'OPEN',
  LIVE = 'LIVE', 
  SWEAT = 'SWEAT',
  HEDGE_WINDOW = 'HEDGE_WINDOW',
  DONE = 'DONE'
}

export enum TicketType {
  SINGLE = 'single',
  PARLAY = 'parlay',
  ROUND_ROBIN = 'round_robin'
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
  
  // Financial tracking
  exposure_units: number;
  potential_payout: number;
  cashout_value: number;
  cashout_ev_percentage: number;
  
  // State metadata
  state_entered_at: string;
  state_metadata: Record<string, any>;
  
  // Hedge recommendations
  hedge_recommendations: HedgeRecommendation[];
  
  // Timestamps
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

export class TicketStateManager {
  private supabase: SupabaseClient;
  private logger: Logger;
  
  // State transition rules
  private readonly VALID_TRANSITIONS: Record<TicketState, TicketState[]> = {
    [TicketState.OPEN]: [TicketState.LIVE, TicketState.DONE],
    [TicketState.LIVE]: [TicketState.SWEAT, TicketState.HEDGE_WINDOW, TicketState.DONE],
    [TicketState.SWEAT]: [TicketState.HEDGE_WINDOW, TicketState.DONE],
    [TicketState.HEDGE_WINDOW]: [TicketState.DONE],
    [TicketState.DONE]: [] // Terminal state
  };

  constructor(supabase: SupabaseClient, logger: Logger) {
    this.supabase = supabase;
    this.logger = logger;
  }

  /**
   * Initialize a new ticket in the state machine
   */
  async initializeTicket(
    ticketId: string, 
    ticketType: TicketType, 
    legs: TicketLeg[],
    exposureUnits: number = 1
  ): Promise<TicketStateData> {
    this.logger.info('🎫 Initializing ticket in state machine', {
      ticketId,
      ticketType,
      legsCount: legs.length,
      exposureUnits
    });

    const stateData: Omit<TicketStateData, 'id' | 'created_at' | 'updated_at'> = {
      ticket_id: ticketId,
      ticket_type: ticketType,
      state: TicketState.OPEN,
      legs_total: legs.length,
      legs_hit: 0,
      legs_miss: 0,
      legs_pending: legs.length,
      current_leg_index: 0,
      exposure_units: exposureUnits,
      potential_payout: this.calculatePotentialPayout(legs),
      cashout_value: 0,
      cashout_ev_percentage: 0,
      state_entered_at: new Date().toISOString(),
      state_metadata: {
        initialization_trigger: 'ticket_created',
        legs_data: legs.map(leg => ({
          leg_index: leg.leg_index,
          player: leg.player_name,
          market: leg.stat_type,
          line: leg.line,
          odds: leg.odds
        }))
      },
      hedge_recommendations: []
    };

    return await withCircuitBreaker.supabase(
      async () => {
        const { data, error } = await this.supabase
          .from('ticket_states')
          .insert(stateData)
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to initialize ticket state: ${error.message}`);
        }

        // Also insert legs into ticket_legs table
        const legsWithTicketId = legs.map(leg => ({
          ...leg,
          ticket_id: ticketId
        }));

        const { error: legsError } = await this.supabase
          .from('ticket_legs')
          .insert(legsWithTicketId);

        if (legsError) {
          this.logger.warn('Failed to insert ticket legs', { 
            ticketId, 
            error: legsError.message 
          });
        }

        // Emit state transition event
        await this.emitStateTransitionEvent(ticketId, null, TicketState.OPEN, 'ticket_initialized', {
          ticket_type: ticketType,
          legs_count: legs.length,
          exposure_units: exposureUnits
        });

        this.logger.info('✅ Ticket initialized in state machine', {
          ticketId,
          state: data.state,
          legsTotal: data.legs_total
        });

        return data;
      },
      async () => {
        throw new Error('Supabase circuit breaker open - cannot initialize ticket');
      }
    );
  }

  /**
   * Update leg outcome and potentially trigger state transitions
   */
  async updateLegOutcome(
    ticketId: string, 
    legIndex: number, 
    outcome: 'hit' | 'miss' | 'void'
  ): Promise<TicketStateData> {
    this.logger.info('🎯 Updating leg outcome', {
      ticketId,
      legIndex,
      outcome
    });

    return await withCircuitBreaker.supabase(
      async () => {
        // Get current ticket state
        const currentState = await this.getTicketState(ticketId);
        if (!currentState) {
          throw new Error(`Ticket state not found: ${ticketId}`);
        }

        // Update leg in database
        const { error: legUpdateError } = await this.supabase
          .from('ticket_legs')
          .update({ 
            outcome,
            updated_at: new Date().toISOString()
          })
          .eq('ticket_id', ticketId)
          .eq('leg_index', legIndex);

        if (legUpdateError) {
          throw new Error(`Failed to update leg outcome: ${legUpdateError.message}`);
        }

        // Recalculate leg counts
        const { data: legs, error: legsError } = await this.supabase
          .from('ticket_legs')
          .select('outcome')
          .eq('ticket_id', ticketId);

        if (legsError || !legs) {
          throw new Error(`Failed to fetch ticket legs: ${legsError?.message}`);
        }

        const legsHit = legs.filter(l => l.outcome === 'hit').length;
        const legsMiss = legs.filter(l => l.outcome === 'miss').length;
        const legsPending = legs.filter(l => l.outcome === 'pending').length;

        // Update ticket state counts
        const { data: updatedState, error: updateError } = await this.supabase
          .from('ticket_states')
          .update({
            legs_hit: legsHit,
            legs_miss: legsMiss,
            legs_pending: legsPending,
            updated_at: new Date().toISOString()
          })
          .eq('ticket_id', ticketId)
          .select()
          .single();

        if (updateError || !updatedState) {
          throw new Error(`Failed to update ticket state: ${updateError?.message}`);
        }

        // Check if state transition is needed
        const newState = await this.evaluateStateTransition(updatedState);
        
        this.logger.info('✅ Leg outcome updated', {
          ticketId,
          legIndex,
          outcome,
          legsHit,
          legsMiss,
          legsPending,
          newState: newState.state
        });

        return newState;
      },
      async () => {
        throw new Error('Supabase circuit breaker open - cannot update leg outcome');
      }
    );
  }

  /**
   * Get current ticket state
   */
  async getTicketState(ticketId: string): Promise<TicketStateData | null> {
    return await withCircuitBreaker.supabase(
      async () => {
        const { data, error } = await this.supabase
          .from('ticket_states')
          .select('*')
          .eq('ticket_id', ticketId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No rows returned
            return null;
          }
          throw new Error(`Failed to get ticket state: ${error.message}`);
        }

        return data;
      },
      async () => {
        this.logger.warn('Supabase circuit breaker open - returning null for ticket state');
        return null;
      }
    );
  }

  /**
   * Evaluate if state transition is needed and perform it
   */
  private async evaluateStateTransition(currentState: TicketStateData): Promise<TicketStateData> {
    const newState = this.determineNewState(currentState);
    
    if (newState === currentState.state) {
      return currentState; // No transition needed
    }

    return await this.transitionToState(currentState.ticket_id, newState, 'leg_outcome_update', {
      legs_hit: currentState.legs_hit,
      legs_miss: currentState.legs_miss,
      legs_pending: currentState.legs_pending
    });
  }

  /**
   * Determine what the new state should be based on current ticket data
   */
  private determineNewState(ticketState: TicketStateData): TicketState {
    const { state, legs_total, legs_hit, legs_miss, legs_pending, ticket_type } = ticketState;

    // Terminal conditions
    if (legs_miss > 0 && ticket_type === TicketType.PARLAY) {
      return TicketState.DONE; // Parlay is dead with any miss
    }

    if (legs_pending === 0) {
      return TicketState.DONE; // All legs completed
    }

    // For single bets
    if (ticket_type === TicketType.SINGLE) {
      if (legs_pending === 1 && this.isLegLive(ticketState)) {
        return TicketState.LIVE;
      }
      return state; // Stay in current state
    }

    // For parlays
    if (ticket_type === TicketType.PARLAY) {
      // Last leg of parlay
      if (legs_pending === 1 && legs_hit === legs_total - 1) {
        // Check if cashout EV is high enough for hedge window
        if (ticketState.cashout_ev_percentage >= 65) {
          return TicketState.HEDGE_WINDOW;
        }
        return TicketState.SWEAT;
      }

      // Multiple legs still pending but some are live
      if (legs_pending > 1 && this.hasLiveLeg(ticketState)) {
        return TicketState.LIVE;
      }

      // First leg starts - transition from OPEN to LIVE
      if (state === TicketState.OPEN && this.hasLiveLeg(ticketState)) {
        return TicketState.LIVE;
      }
    }

    return state; // No state change
  }

  /**
   * Check if any leg of the ticket is currently live
   */
  private hasLiveLeg(_ticketState: TicketStateData): boolean {
    // This would need to check actual game status from ticket_legs table
    // For now, return false as placeholder
    return false;
  }

  /**
   * Check if a specific leg is currently live
   */
  private isLegLive(_ticketState: TicketStateData): boolean {
    // This would need to check actual game status from ticket_legs table
    // For now, return false as placeholder
    return false;
  }

  /**
   * Perform state transition
   */
  async transitionToState(
    ticketId: string, 
    newState: TicketState, 
    trigger: string,
    metadata: Record<string, any> = {}
  ): Promise<TicketStateData> {
    const currentState = await this.getTicketState(ticketId);
    if (!currentState) {
      throw new Error(`Ticket state not found: ${ticketId}`);
    }

    // Validate transition
    if (!this.isValidTransition(currentState.state, newState)) {
      throw new Error(
        `Invalid state transition: ${currentState.state} -> ${newState} for ticket ${ticketId}`
      );
    }

    this.logger.info('🔄 Performing state transition', {
      ticketId,
      fromState: currentState.state,
      toState: newState,
      trigger
    });

    return await withCircuitBreaker.supabase(
      async () => {
        const { data: updatedState, error } = await this.supabase
          .from('ticket_states')
          .update({
            state: newState,
            state_entered_at: new Date().toISOString(),
            state_metadata: {
              ...currentState.state_metadata,
              last_transition: {
                from: currentState.state,
                to: newState,
                trigger,
                timestamp: new Date().toISOString(),
                metadata
              }
            },
            updated_at: new Date().toISOString()
          })
          .eq('ticket_id', ticketId)
          .select()
          .single();

        if (error || !updatedState) {
          throw new Error(`Failed to transition state: ${error?.message}`);
        }

        // Emit state transition event
        await this.emitStateTransitionEvent(
          ticketId, 
          currentState.state, 
          newState, 
          trigger, 
          metadata
        );

        // Handle state-specific actions
        await this.handleStateActions(updatedState);

        this.logger.info('✅ State transition completed', {
          ticketId,
          fromState: currentState.state,
          toState: newState,
          trigger
        });

        return updatedState;
      },
      async () => {
        throw new Error('Supabase circuit breaker open - cannot perform state transition');
      }
    );
  }

  /**
   * Check if a state transition is valid
   */
  private isValidTransition(fromState: TicketState, toState: TicketState): boolean {
    return this.VALID_TRANSITIONS[fromState]?.includes(toState) ?? false;
  }

  /**
   * Handle actions when entering specific states
   */
  private async handleStateActions(ticketState: TicketStateData): Promise<void> {
    switch (ticketState.state) {
      case TicketState.LIVE:
        await this.handleLiveState(ticketState);
        break;
      case TicketState.SWEAT:
        await this.handleSweatState(ticketState);
        break;
      case TicketState.HEDGE_WINDOW:
        await this.handleHedgeWindowState(ticketState);
        break;
      case TicketState.DONE:
        await this.handleDoneState(ticketState);
        break;
    }
  }

  /**
   * Handle LIVE state entry
   */
  private async handleLiveState(ticketState: TicketStateData): Promise<void> {
    this.logger.info('🔴 Entering LIVE state', { ticketId: ticketState.ticket_id });
    
    // Emit alert for live ticket monitoring
    await this.emitAlertEvent('live_ticket_alert', ticketState.ticket_id, {
      ticket_type: ticketState.ticket_type,
      legs_remaining: ticketState.legs_pending,
      exposure_units: ticketState.exposure_units,
      priority: 'high'
    });
  }

  /**
   * Handle SWEAT state entry
   */
  private async handleSweatState(ticketState: TicketStateData): Promise<void> {
    this.logger.info('😰 Entering SWEAT state', { ticketId: ticketState.ticket_id });
    
    // Emit high-priority alert for last leg sweat
    await this.emitAlertEvent('sweat_alert', ticketState.ticket_id, {
      ticket_type: ticketState.ticket_type,
      potential_payout: ticketState.potential_payout,
      exposure_units: ticketState.exposure_units,
      priority: 'urgent'
    });
  }

  /**
   * Handle HEDGE_WINDOW state entry
   */
  private async handleHedgeWindowState(ticketState: TicketStateData): Promise<void> {
    this.logger.info('💰 Entering HEDGE_WINDOW state', { ticketId: ticketState.ticket_id });
    
    // Generate hedge recommendations
    const hedgeRecommendations = await this.generateHedgeRecommendations(ticketState);
    
    // Update ticket with hedge recommendations
    await this.supabase
      .from('ticket_states')
      .update({ 
        hedge_recommendations: hedgeRecommendations,
        updated_at: new Date().toISOString()
      })
      .eq('ticket_id', ticketState.ticket_id);

    // Emit hedge opportunity alert
    await this.emitAlertEvent('hedge_opportunity', ticketState.ticket_id, {
      ticket_type: ticketState.ticket_type,
      cashout_ev_percentage: ticketState.cashout_ev_percentage,
      hedge_recommendations: hedgeRecommendations,
      priority: 'urgent'
    });
  }

  /**
   * Handle DONE state entry
   */
  private async handleDoneState(ticketState: TicketStateData): Promise<void> {
    this.logger.info('✅ Entering DONE state', { ticketId: ticketState.ticket_id });
    
    // Calculate final result
    const finalResult = ticketState.legs_miss > 0 ? 'loss' : 'win';
    
    // Emit completion alert
    await this.emitAlertEvent('ticket_completed', ticketState.ticket_id, {
      ticket_type: ticketState.ticket_type,
      final_result: finalResult,
      exposure_units: ticketState.exposure_units,
      legs_hit: ticketState.legs_hit,
      legs_miss: ticketState.legs_miss,
      priority: finalResult === 'win' ? 'high' : 'normal'
    });
  }

  /**
   * Generate hedge recommendations for HEDGE_WINDOW state
   */
  private async generateHedgeRecommendations(ticketState: TicketStateData): Promise<HedgeRecommendation[]> {
    // This would integrate with the HedgeDetectionEngine
    // For now, return empty array as placeholder
    this.logger.info('🔍 Generating hedge recommendations', { ticketId: ticketState.ticket_id });
    return [];
  }

  /**
   * Calculate potential payout from legs
   */
  private calculatePotentialPayout(legs: TicketLeg[]): number {
    if (legs.length === 1) {
      // Single bet
      const odds = legs[0].odds;
      return odds > 0 ? odds / 100 : Math.abs(odds) / 100;
    }

    // Parlay calculation
    let multiplier = 1;
    for (const leg of legs) {
      const decimalOdds = leg.odds > 0 ? (leg.odds / 100) + 1 : (100 / Math.abs(leg.odds)) + 1;
      multiplier *= decimalOdds;
    }
    
    return multiplier - 1; // Subtract original stake
  }

  /**
   * Emit state transition event
   */
  private async emitStateTransitionEvent(
    ticketId: string,
    fromState: TicketState | null,
    toState: TicketState,
    trigger: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      await this.supabase
        .from('events')
        .insert({
          event_type: 'ticket.state.transition.v1',
          aggregate_id: ticketId,
          aggregate_type: 'ticket',
          event_data: {
            from_state: fromState,
            to_state: toState,
            trigger,
            metadata,
            timestamp: new Date().toISOString()
          },
          idempotency_key: `state-transition-${ticketId}-${toState}-${Date.now()}`,
          metadata: {
            source: 'TicketStateManager',
            priority: this.getTransitionPriority(toState)
          }
        });

      this.logger.info('📡 State transition event emitted', {
        ticketId,
        fromState,
        toState,
        trigger
      });
    } catch (error) {
      this.logger.error('Failed to emit state transition event', {
        ticketId,
        fromState,
        toState,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Emit alert event
   */
  private async emitAlertEvent(
    alertType: string,
    ticketId: string,
    alertData: Record<string, any>
  ): Promise<void> {
    try {
      await this.supabase
        .from('events')
        .insert({
          event_type: `alert.${alertType}.v1`,
          aggregate_id: ticketId,
          aggregate_type: 'ticket',
          event_data: alertData,
          idempotency_key: `alert-${alertType}-${ticketId}-${Date.now()}`,
          metadata: {
            source: 'TicketStateManager',
            priority: alertData.priority || 'normal'
          }
        });

      this.logger.info('🚨 Alert event emitted', {
        alertType,
        ticketId,
        priority: alertData.priority
      });
    } catch (error) {
      this.logger.error('Failed to emit alert event', {
        alertType,
        ticketId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get priority level for state transitions
   */
  private getTransitionPriority(toState: TicketState): string {
    const priorities: Record<TicketState, string> = {
      [TicketState.OPEN]: 'normal',
      [TicketState.LIVE]: 'high',
      [TicketState.SWEAT]: 'urgent',
      [TicketState.HEDGE_WINDOW]: 'urgent',
      [TicketState.DONE]: 'high'
    };
    
    return priorities[toState] || 'normal';
  }

  /**
   * Get all tickets in a specific state
   */
  async getTicketsByState(state: TicketState, limit: number = 100): Promise<TicketStateData[]> {
    return await withCircuitBreaker.supabase(
      async () => {
        const { data, error } = await this.supabase
          .from('ticket_states')
          .select('*')
          .eq('state', state)
          .order('state_entered_at', { ascending: true })
          .limit(limit);

        if (error) {
          throw new Error(`Failed to get tickets by state: ${error.message}`);
        }

        return data || [];
      },
      async () => {
        this.logger.warn('Supabase circuit breaker open - returning empty array for tickets by state');
        return [];
      }
    );
  }

  /**
   * Force state transition (admin function)
   */
  async forceStateTransition(
    ticketId: string,
    newState: TicketState,
    reason: string
  ): Promise<TicketStateData> {
    this.logger.warn('⚠️ Forcing state transition', {
      ticketId,
      newState,
      reason
    });

    return await this.transitionToState(ticketId, newState, 'admin_force', {
      reason,
      forced_at: new Date().toISOString()
    });
  }
}