import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Logger } from '../../shared/logger/types';
import { withCircuitBreaker } from '../../services/enhanced-circuit-breaker';
import { TicketStateManager } from './TicketStateManager';
import { HedgeDetectionEngine } from './HedgeDetectionEngine';
import { CacheFirstUnifiedPicksService } from '../../services/CacheFirstUnifiedPicksService';

// Performance targets and configuration
interface EventProcessorConfig {
  maxLatencyMs: number; // Target: <1000ms
  batchSize: number;
  processingTimeoutMs: number;
  maxConcurrentEvents: number;
  retryAttempts: number;
  circuitBreakerThreshold: number;
}

interface PropTickEvent {
  id: string;
  prop_id: string;
  player_name: string;
  sport: string;
  stat_type: string;
  line: number;
  over_odds?: number;
  under_odds?: number;
  book: string;
  steam_detected: boolean;
  sharp_money_indicator: boolean;
  line_movement: number;
  odds_movement: number;
  tick_timestamp: string;
  time_to_game: number;
  implied_probability?: number;
  public_percentage?: number;
  confidence_level: number;
}

interface ProcessedEvent {
  event: PropTickEvent;
  processingStartTime: number;
  alertOpportunities: AlertOpportunity[];
  hedgeOpportunities: HedgeOpportunity[];
  ticketStateUpdates: string[];
}

interface AlertOpportunity {
  type: 'steam' | 'line_movement' | 'injury' | 'sharp_money' | 'arbitrage';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  confidence: number;
  player_name: string;
  stat_type: string;
  trigger_data: Record<string, any>;
  expires_at: string;
}

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

interface EventProcessingMetrics {
  totalEventsProcessed: number;
  averageLatencyMs: number;
  p99LatencyMs: number;
  alertsGenerated: number;
  hedgeOpportunitiesFound: number;
  circuitBreakerTrips: number;
  errorRate: number;
  throughputPerSecond: number;
}

export class EventDrivenProcessor {
  private supabase: SupabaseClient;
  private logger: Logger;
  private config: EventProcessorConfig;
  private ticketStateManager: TicketStateManager;
  private hedgeDetectionEngine: HedgeDetectionEngine;
  private cacheFirstService: CacheFirstUnifiedPicksService;
  
  // Performance tracking
  private metrics: EventProcessingMetrics = {
    totalEventsProcessed: 0,
    averageLatencyMs: 0,
    p99LatencyMs: 0,
    alertsGenerated: 0,
    hedgeOpportunitiesFound: 0,
    circuitBreakerTrips: 0,
    errorRate: 0,
    throughputPerSecond: 0
  };
  
  // Event processing infrastructure
  private realtimeSubscription: RealtimeChannel | null = null;
  private processingQueue: Map<string, PropTickEvent> = new Map();
  private activeProcessing: Set<string> = new Set();
  private deduplicationCache: Map<string, number> = new Map(); // event_id -> timestamp
  private latencyBuffer: number[] = [];
  private lastThroughputCalculation = Date.now();
  private eventsInLastSecond = 0;

  // Circuit breaker and rate limiting
  private isHealthy = true;
  private consecutiveErrors = 0;
  private _lastHealthCheck = Date.now();

  constructor(
    supabase: SupabaseClient,
    logger: Logger,
    ticketStateManager: TicketStateManager,
    config?: Partial<EventProcessorConfig>
  ) {
    this.supabase = supabase;
    this.logger = logger;
    this.ticketStateManager = ticketStateManager;
    this.hedgeDetectionEngine = new HedgeDetectionEngine(supabase, logger);
    this.cacheFirstService = CacheFirstUnifiedPicksService.getInstance();
    
    this.config = {
      maxLatencyMs: 1000, // <1 second target
      batchSize: 50,
      processingTimeoutMs: 800, // Leave buffer for network
      maxConcurrentEvents: 100,
      retryAttempts: 2,
      circuitBreakerThreshold: 5,
      ...config
    };

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Initialize real-time subscriptions to prop_ticks_hot
   */
  async initialize(): Promise<void> {
    this.logger.info('🚀 Initializing EventDrivenProcessor with <1s latency target');

    await this.setupRealtimeSubscriptions();
    await this.startMetricsCollection();
    
    this.logger.info('✅ EventDrivenProcessor initialized', {
      maxLatencyMs: this.config.maxLatencyMs,
      batchSize: this.config.batchSize,
      maxConcurrentEvents: this.config.maxConcurrentEvents
    });
  }

  /**
   * Setup real-time subscriptions to cache tables only
   */
  private async setupRealtimeSubscriptions(): Promise<void> {
    try {
      // Subscribe to unified_picks changes for cache-first processing
      this.realtimeSubscription = this.supabase
        .channel('unified-picks-cache-processor')
        .on('postgres_changes', {
          event: '*', // Listen to all changes
          schema: 'public',
          table: 'unified_picks',
          // Filter for high-value picks only
          filter: 'tier=in.("S-tier","A-tier")'
        }, this.handleUnifiedPickEvent.bind(this))
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            this.logger.info('✅ Real-time unified_picks cache subscription established');
          } else if (status === 'CHANNEL_ERROR') {
            this.logger.error('❌ Unified_picks subscription failed');
            this.metrics.circuitBreakerTrips++;
          }
        });

      // Setup fallback polling for missed events
      this.startFallbackPolling();

    } catch (error) {
      this.logger.error('Failed to setup realtime subscriptions', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Handle incoming unified pick events with <1 second processing
   */
  private async handleUnifiedPickEvent(payload: any): Promise<void> {
    const startTime = Date.now();
    const pickData = payload.new || payload.old;

    if (!pickData) {
      this.logger.warn('Received empty unified pick event payload');
      return;
    }

    try {
      // Convert unified pick to PropTickEvent-like structure for processing
      const event: PropTickEvent = {
        id: pickData.id,
        prop_id: pickData.id,
        player_name: pickData.player_name || 'Unknown',
        sport: pickData.league || 'UNKNOWN',
        stat_type: pickData.bet_type || 'unknown',
        line: pickData.line || 0,
        over_odds: pickData.odds,
        under_odds: pickData.odds,
        book: pickData.source || 'cache',
        steam_detected: pickData.tier === 'S-tier',
        sharp_money_indicator: ['S-tier', 'A-tier'].includes(pickData.tier),
        line_movement: 0, // Will be calculated from cache data
        odds_movement: 0,
        tick_timestamp: pickData.created_at || new Date().toISOString(),
        time_to_game: this.calculateTimeToGame(pickData),
        implied_probability: this.calculateImpliedProbability(pickData.odds),
        public_percentage: 50, // Default
        confidence_level: this.mapTierToConfidence(pickData.tier)
      };

      // Process the event
      await this.handlePropTickEvent(event, startTime);

    } catch (error) {
      this.logger.error('Failed to process unified pick event', {
        pickId: pickData.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle incoming prop tick events with <1 second processing
   */
  private async handlePropTickEvent(event: PropTickEvent, startTime?: number): Promise<void> {
    if (!startTime) startTime = Date.now();
    
    try {
      // Deduplication check
      if (this.isDuplicateEvent(event)) {
        this.logger.debug('Skipping duplicate event', { eventId: event.id });
        return;
      }

      // Immediate processing for critical events
      if (this.isCriticalEvent(event)) {
        await this.processCriticalEvent(event, startTime);
      } else {
        // Queue for batch processing
        this.queueEvent(event);
      }

      // Update metrics
      this.updateLatencyMetrics(startTime);
      this.metrics.totalEventsProcessed++;

    } catch (error) {
      this.handleProcessingError(error, event);
    }
  }

  /**
   * Process critical events immediately (steam, sharp money, large line movements)
   */
  private async processCriticalEvent(event: PropTickEvent, startTime: number): Promise<void> {
    const eventId = `${event.prop_id}-${event.tick_timestamp}`;
    
    if (this.activeProcessing.has(eventId)) {
      return; // Already processing
    }
    
    this.activeProcessing.add(eventId);
    
    try {
      const processed = await this.processEvent(event, startTime);
      
      // Immediate alert generation for critical events
      if (processed.alertOpportunities.length > 0) {
        await this.generateImmediateAlerts(processed);
      }

      // Check for hedge opportunities
      if (processed.hedgeOpportunities.length > 0) {
        await this.processHedgeOpportunities(processed.hedgeOpportunities);
      }

      // Update ticket states if needed
      if (processed.ticketStateUpdates.length > 0) {
        await this.updateTicketStates(processed.ticketStateUpdates, event);
      }

      const processingTime = Date.now() - startTime;
      this.logger.info('⚡ Critical event processed', {
        eventId,
        processingTimeMs: processingTime,
        alertsGenerated: processed.alertOpportunities.length,
        hedgeOpportunities: processed.hedgeOpportunities.length
      });

    } finally {
      this.activeProcessing.delete(eventId);
    }
  }

  /**
   * Core event processing logic
   */
  private async processEvent(event: PropTickEvent, startTime: number): Promise<ProcessedEvent> {
    const processed: ProcessedEvent = {
      event,
      processingStartTime: startTime,
      alertOpportunities: [],
      hedgeOpportunities: [],
      ticketStateUpdates: []
    };

    // Analyze for steam moves
    if (event.steam_detected || event.sharp_money_indicator) {
      processed.alertOpportunities.push(await this.analyzeSteamMove(event));
    }

    // Analyze significant line movements
    if (Math.abs(event.line_movement) >= 0.5) {
      processed.alertOpportunities.push(await this.analyzeLineMovement(event));
    }

    // Check for arbitrage opportunities
    const arbitrageOpps = await this.checkArbitrageOpportunities(event);
    processed.alertOpportunities.push(...arbitrageOpps);

    // Detect hedge opportunities for existing tickets
    const hedgeOpps = await this.hedgeDetectionEngine.analyzeHedgeOpportunities(event);
    processed.hedgeOpportunities.push(...hedgeOpps);

    // Identify tickets that need state updates
    processed.ticketStateUpdates = await this.identifyTicketStateUpdates(event);

    return processed;
  }

  /**
   * Analyze steam move for alert opportunity
   */
  private async analyzeSteamMove(event: PropTickEvent): Promise<AlertOpportunity> {
    const confidence = this.calculateSteamConfidence(event);
    
    return {
      type: 'steam',
      priority: confidence > 0.8 ? 'urgent' : 'high',
      confidence,
      player_name: event.player_name,
      stat_type: event.stat_type,
      trigger_data: {
        steam_detected: event.steam_detected,
        sharp_money_indicator: event.sharp_money_indicator,
        line_movement: event.line_movement,
        odds_movement: event.odds_movement,
        time_to_game: event.time_to_game,
        book: event.book
      },
      expires_at: new Date(Date.now() + (5 * 60 * 1000)).toISOString() // 5 minutes
    };
  }

  /**
   * Analyze line movement for alert opportunity
   */
  private async analyzeLineMovement(event: PropTickEvent): Promise<AlertOpportunity> {
    const movementMagnitude = Math.abs(event.line_movement);
    const confidence = Math.min(movementMagnitude * 0.4, 0.95);
    
    return {
      type: 'line_movement',
      priority: movementMagnitude > 1.0 ? 'urgent' : 'high',
      confidence,
      player_name: event.player_name,
      stat_type: event.stat_type,
      trigger_data: {
        line_movement: event.line_movement,
        odds_movement: event.odds_movement,
        movement_direction: event.line_movement > 0 ? 'up' : 'down',
        time_to_game: event.time_to_game,
        public_percentage: event.public_percentage
      },
      expires_at: new Date(Date.now() + (10 * 60 * 1000)).toISOString() // 10 minutes
    };
  }

  /**
   * Check for arbitrage opportunities using cached data
   */
  private async checkArbitrageOpportunities(event: PropTickEvent): Promise<AlertOpportunity[]> {
    const opportunities: AlertOpportunity[] = [];

    try {
      // For cache-first operation, we use the cache.book_quotes table
      // to find arbitrage opportunities across different books
      const { data: cachedQuotes, error } = await this.supabase
        .from('cache.book_quotes')
        .select('*')
        .eq('player_name', event.player_name)
        .eq('stat_type', event.stat_type)
        .neq('book', event.book)
        .gte('last_updated', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .order('last_updated', { ascending: false })
        .limit(10);

      if (error || !cachedQuotes) {
        return opportunities;
      }

      for (const quote of cachedQuotes) {
        // Convert cached quote to tick format for compatibility
        const tick = {
          ...quote,
          tick_timestamp: quote.last_updated,
          over_odds: quote.over_odds || quote.odds,
          under_odds: quote.under_odds || quote.odds,
          line: quote.line
        };

        const arbOpportunity = this.calculateArbitrageOpportunity(event, tick);
        
        if (arbOpportunity && arbOpportunity.profit > 0.02) { // 2% minimum profit
          opportunities.push({
            type: 'arbitrage',
            priority: 'urgent',
            confidence: 0.9,
            player_name: event.player_name,
            stat_type: event.stat_type,
            trigger_data: {
              book_a: event.book,
              book_b: tick.book,
              line_a: event.line,
              line_b: tick.line,
              odds_a: event.over_odds || event.under_odds,
              odds_b: tick.over_odds || tick.under_odds,
              profit_percentage: arbOpportunity.profit,
              stake_distribution: arbOpportunity.stakes
            },
            expires_at: new Date(Date.now() + (2 * 60 * 1000)).toISOString() // 2 minutes
          });
        }
      }

    } catch (error) {
      this.logger.error('Error checking arbitrage opportunities', {
        propId: event.prop_id,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return opportunities;
  }

  /**
   * Calculate arbitrage opportunity between two ticks
   */
  private calculateArbitrageOpportunity(
    tick1: PropTickEvent, 
    tick2: PropTickEvent
  ): { profit: number; stakes: { book1: number; book2: number } } | null {
    // Simplified arbitrage calculation
    // In production, this would be more sophisticated
    
    const odds1 = tick1.over_odds || tick1.under_odds || 0;
    const odds2 = tick2.over_odds || tick2.under_odds || 0;
    
    if (odds1 <= 0 || odds2 <= 0) return null;
    
    const prob1 = odds1 > 0 ? 100 / (odds1 + 100) : Math.abs(odds1) / (Math.abs(odds1) + 100);
    const prob2 = odds2 > 0 ? 100 / (odds2 + 100) : Math.abs(odds2) / (Math.abs(odds2) + 100);
    
    const totalProb = prob1 + prob2;
    
    if (totalProb >= 1) return null; // No arbitrage
    
    const profit = (1 / totalProb) - 1;
    
    return {
      profit,
      stakes: {
        book1: prob1 / totalProb,
        book2: prob2 / totalProb
      }
    };
  }

  /**
   * Identify tickets that need state updates based on prop tick
   */
  private async identifyTicketStateUpdates(event: PropTickEvent): Promise<string[]> {
    const ticketIds: string[] = [];
    
    try {
      // Find tickets with legs matching this prop
      const { data: matchingLegs, error } = await this.supabase
        .from('ticket_legs')
        .select('ticket_id')
        .eq('player_name', event.player_name)
        .eq('stat_type', event.stat_type)
        .in('outcome', ['pending'])
        .limit(50);

      if (error || !matchingLegs) {
        return ticketIds;
      }

      for (const leg of matchingLegs) {
        if (!ticketIds.includes(leg.ticket_id)) {
          ticketIds.push(leg.ticket_id);
        }
      }

    } catch (error) {
      this.logger.error('Error identifying ticket state updates', {
        event: event.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return ticketIds;
  }

  /**
   * Generate immediate alerts for critical events
   */
  private async generateImmediateAlerts(processed: ProcessedEvent): Promise<void> {
    for (const opportunity of processed.alertOpportunities) {
      try {
        await this.emitAlertEvent(opportunity);
        this.metrics.alertsGenerated++;
        
        this.logger.info('🚨 Immediate alert generated', {
          type: opportunity.type,
          priority: opportunity.priority,
          player: opportunity.player_name,
          confidence: opportunity.confidence
        });
        
      } catch (error) {
        this.logger.error('Failed to generate immediate alert', {
          opportunity: opportunity.type,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Process hedge opportunities
   */
  private async processHedgeOpportunities(opportunities: HedgeOpportunity[]): Promise<void> {
    for (const opportunity of opportunities) {
      try {
        await this.hedgeDetectionEngine.processHedgeOpportunity(opportunity);
        this.metrics.hedgeOpportunitiesFound++;
        
        this.logger.info('💰 Hedge opportunity processed', {
          type: opportunity.type,
          player: opportunity.player_name,
          profit: opportunity.guaranteed_profit,
          confidence: opportunity.confidence
        });
        
      } catch (error) {
        this.logger.error('Failed to process hedge opportunity', {
          opportunity: opportunity.type,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Update ticket states based on event
   */
  private async updateTicketStates(ticketIds: string[], event: PropTickEvent): Promise<void> {
    for (const ticketId of ticketIds) {
      try {
        // Check if ticket needs cashout value update
        await this.updateTicketCashoutValue(ticketId, event);
        
      } catch (error) {
        this.logger.error('Failed to update ticket state', {
          ticketId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Update ticket cashout value based on current market conditions
   */
  private async updateTicketCashoutValue(ticketId: string, event: PropTickEvent): Promise<void> {
    const ticketState = await this.ticketStateManager.getTicketState(ticketId);
    if (!ticketState) return;

    // Calculate new cashout value based on line movement
    // This would integrate with live odds APIs in production
    const newCashoutValue = this.calculateCashoutValue(ticketState, event);
    const evPercentage = (newCashoutValue / ticketState.potential_payout) * 100;

    if (evPercentage >= 65 && ticketState.state === 'SWEAT') {
      // Trigger hedge window
      await this.ticketStateManager.transitionToState(
        ticketId,
        'HEDGE_WINDOW' as any,
        'cashout_ev_threshold',
        { 
          cashout_ev_percentage: evPercentage,
          trigger_event: event.id 
        }
      );
    }
  }

  /**
   * Calculate current cashout value for a ticket
   */
  private calculateCashoutValue(ticketState: any, event: PropTickEvent): number {
    // Simplified cashout calculation
    // In production, this would use sophisticated pricing models
    const baseValue = ticketState.exposure_units;
    const lineMovementFactor = 1 + (event.line_movement * 0.1);
    
    return baseValue * lineMovementFactor;
  }

  // Utility Methods

  /**
   * Check if event is duplicate
   */
  private isDuplicateEvent(event: PropTickEvent): boolean {
    const eventKey = `${event.prop_id}-${event.tick_timestamp}`;
    const now = Date.now();
    
    if (this.deduplicationCache.has(eventKey)) {
      return true;
    }
    
    // Add to cache with 5-minute expiry
    this.deduplicationCache.set(eventKey, now);
    
    // Clean old entries
    if (this.deduplicationCache.size > 10000) {
      this.cleanDeduplicationCache();
    }
    
    return false;
  }

  /**
   * Check if event is critical (needs immediate processing)
   */
  private isCriticalEvent(event: PropTickEvent): boolean {
    return (
      event.steam_detected ||
      event.sharp_money_indicator ||
      Math.abs(event.line_movement) >= 1.0 ||
      event.time_to_game <= 60 || // Within 1 hour of game
      event.confidence_level >= 0.9
    );
  }

  /**
   * Queue event for batch processing
   */
  private queueEvent(event: PropTickEvent): void {
    const eventKey = `${event.prop_id}-${event.tick_timestamp}`;
    this.processingQueue.set(eventKey, event);
    
    // Process batch if queue is full
    if (this.processingQueue.size >= this.config.batchSize) {
      this.processBatch();
    }
  }

  /**
   * Process batch of queued events
   */
  private async processBatch(): Promise<void> {
    const events = Array.from(this.processingQueue.values());
    this.processingQueue.clear();
    
    this.logger.info('⚡ Processing event batch', { 
      batchSize: events.length 
    });
    
    const batchStartTime = Date.now();
    const promises = events.map(event => this.processEvent(event, batchStartTime));
    
    try {
      const results = await Promise.allSettled(promises);
      
      // Process successful results
      const successful = results
        .filter((result): result is PromiseFulfilledResult<ProcessedEvent> => 
          result.status === 'fulfilled')
        .map(result => result.value);
      
      // Generate alerts in batch
      await this.processBatchAlerts(successful);
      
    } catch (error) {
      this.logger.error('Batch processing failed', {
        batchSize: events.length,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Process alerts for batch of events
   */
  private async processBatchAlerts(processedEvents: ProcessedEvent[]): Promise<void> {
    const allOpportunities = processedEvents.flatMap(p => p.alertOpportunities);
    
    for (const opportunity of allOpportunities) {
      await this.emitAlertEvent(opportunity);
      this.metrics.alertsGenerated++;
    }
  }

  /**
   * Emit alert event to event system
   */
  private async emitAlertEvent(opportunity: AlertOpportunity): Promise<void> {
    await withCircuitBreaker.supabase(
      async () => {
        await this.supabase
          .from('events')
          .insert({
            event_type: `alert.${opportunity.type}.detected.v1`,
            aggregate_id: `${opportunity.player_name}-${opportunity.stat_type}`,
            aggregate_type: 'prop_alert',
            event_data: opportunity,
            idempotency_key: `alert-${opportunity.type}-${Date.now()}-${Math.random()}`,
            metadata: {
              source: 'EventDrivenProcessor',
              priority: opportunity.priority,
              confidence: opportunity.confidence
            }
          });
      },
      async () => {
        this.logger.warn('Failed to emit alert event, circuit breaker open', {
          type: opportunity.type
        });
      }
    );
  }

  // Performance and Monitoring

  /**
   * Update latency metrics
   */
  private updateLatencyMetrics(startTime: number): void {
    const latency = Date.now() - startTime;
    this.latencyBuffer.push(latency);
    
    // Keep only recent latencies for P99 calculation
    if (this.latencyBuffer.length > 1000) {
      this.latencyBuffer = this.latencyBuffer.slice(-1000);
    }
    
    // Update average
    const sum = this.latencyBuffer.reduce((a, b) => a + b, 0);
    this.metrics.averageLatencyMs = sum / this.latencyBuffer.length;
    
    // Update P99
    if (this.latencyBuffer.length >= 10) {
      const sorted = [...this.latencyBuffer].sort((a, b) => a - b);
      const p99Index = Math.floor(sorted.length * 0.99);
      this.metrics.p99LatencyMs = sorted[p99Index];
    }
  }

  /**
   * Calculate steam confidence score
   */
  private calculateSteamConfidence(event: PropTickEvent): number {
    let confidence = 0.5; // Base confidence
    
    if (event.steam_detected) confidence += 0.2;
    if (event.sharp_money_indicator) confidence += 0.2;
    if (Math.abs(event.line_movement) > 0.5) confidence += 0.1;
    if (event.time_to_game <= 120) confidence += 0.1; // Within 2 hours
    if (event.confidence_level > 0.8) confidence += 0.1;
    
    return Math.min(confidence, 0.95);
  }

  /**
   * Start fallback polling for missed events
   */
  private startFallbackPolling(): void {
    setInterval(async () => {
      await this.pollForMissedEvents();
    }, 30000); // Every 30 seconds
  }

  /**
   * Poll for any missed events
   */
  private async pollForMissedEvents(): Promise<void> {
    try {
      const { data: recentEvents, error } = await this.supabase
        .from('prop_ticks_hot')
        .select('*')
        .gte('tick_timestamp', new Date(Date.now() - 60000).toISOString())
        .or('steam_detected.eq.true,sharp_money_indicator.eq.true')
        .order('tick_timestamp', { ascending: false })
        .limit(20);

      if (error || !recentEvents) return;

      for (const event of recentEvents) {
        if (!this.isDuplicateEvent(event)) {
          await this.handlePropTickEvent({ new: event });
        }
      }

    } catch (error) {
      this.logger.error('Fallback polling failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Clean old deduplication cache entries
   */
  private cleanDeduplicationCache(): void {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    
    for (const [key, timestamp] of this.deduplicationCache.entries()) {
      if (timestamp < fiveMinutesAgo) {
        this.deduplicationCache.delete(key);
      }
    }
  }

  /**
   * Handle processing errors
   */
  private handleProcessingError(error: unknown, event: PropTickEvent): void {
    this.consecutiveErrors++;
    this.metrics.errorRate = this.consecutiveErrors / this.metrics.totalEventsProcessed;
    
    this.logger.error('Event processing failed', {
      eventId: event.id,
      propId: event.prop_id,
      error: error instanceof Error ? error.message : String(error),
      consecutiveErrors: this.consecutiveErrors
    });
    
    // Circuit breaker logic
    if (this.consecutiveErrors >= this.config.circuitBreakerThreshold) {
      this.isHealthy = false;
      this.metrics.circuitBreakerTrips++;
      
      // Reset after cooldown period
      setTimeout(() => {
        this.consecutiveErrors = 0;
        this.isHealthy = true;
      }, 60000); // 1 minute cooldown
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      this.checkHealthAndResetMetrics();
    }, 5000); // Every 5 seconds
  }

  /**
   * Check health and reset metrics periodically
   */
  private checkHealthAndResetMetrics(): void {
    const now = Date.now();
    
    // Calculate throughput
    if (now - this.lastThroughputCalculation >= 1000) {
      this.metrics.throughputPerSecond = this.eventsInLastSecond;
      this.eventsInLastSecond = 0;
      this.lastThroughputCalculation = now;
    }
    
    // Check SLO compliance
    if (this.metrics.p99LatencyMs > this.config.maxLatencyMs) {
      this.logger.warn('⚠️ SLO violation: P99 latency exceeds target', {
        p99LatencyMs: this.metrics.p99LatencyMs,
        targetMs: this.config.maxLatencyMs
      });
    }
    
    this._lastHealthCheck = now;
  }

  /**
   * Start metrics collection
   */
  private async startMetricsCollection(): Promise<void> {
    // Emit metrics every 30 seconds
    setInterval(() => {
      this.emitMetricsEvent();
    }, 30000);
  }

  /**
   * Emit metrics event for monitoring
   */
  private async emitMetricsEvent(): Promise<void> {
    try {
      await this.supabase
        .from('events')
        .insert({
          event_type: 'system.metrics.event_processor.v1',
          aggregate_id: 'event-driven-processor',
          aggregate_type: 'system',
          event_data: this.metrics,
          idempotency_key: `metrics-${Date.now()}`,
          metadata: {
            source: 'EventDrivenProcessor',
            component: 'performance_monitoring'
          }
        });

    } catch (error) {
      this.logger.error('Failed to emit metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): EventProcessingMetrics {
    return { ...this.metrics };
  }

  /**
   * Get health status
   */
  getHealthStatus(): { healthy: boolean; metrics: EventProcessingMetrics } {
    return {
      healthy: this.isHealthy,
      metrics: this.getMetrics()
    };
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup(): Promise<void> {
    this.logger.info('🧹 Cleaning up EventDrivenProcessor...');
    
    if (this.realtimeSubscription) {
      await this.realtimeSubscription.unsubscribe();
    }
    
    // Process any remaining queued events
    if (this.processingQueue.size > 0) {
      await this.processBatch();
    }
    
    this.processingQueue.clear();
    this.activeProcessing.clear();
    this.deduplicationCache.clear();
    
    this.logger.info('✅ EventDrivenProcessor cleanup complete');
  }

  // Helper methods for unified pick processing

  /**
   * Calculate time to game from pick data
   */
  private calculateTimeToGame(pickData: any): number {
    if (pickData.game_start_time) {
      const gameTime = new Date(pickData.game_start_time);
      const now = new Date();
      return Math.max(0, Math.floor((gameTime.getTime() - now.getTime()) / 60000)); // Minutes
    }
    return 120; // Default 2 hours
  }

  /**
   * Calculate implied probability from odds
   */
  private calculateImpliedProbability(odds: number): number {
    if (!odds) return 0.5;
    return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
  }

  /**
   * Map tier to confidence level
   */
  private mapTierToConfidence(tier: string): number {
    const tierMap: { [key: string]: number } = {
      'S-tier': 0.95,
      'A-tier': 0.85,
      'B-tier': 0.75,
      'C-tier': 0.65,
      'D-tier': 0.55
    };
    return tierMap[tier] || 0.5;
  }
}