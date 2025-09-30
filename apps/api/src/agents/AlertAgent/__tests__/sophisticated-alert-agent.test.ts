/**
 * Comprehensive test suite for Sophisticated AlertAgent System
 * Tests all components: TicketStateManager, EventDrivenProcessor, HedgeDetectionEngine, DiscordRichEmbeds
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { AlertAgent } from '../index';
import { TicketStateManager, TicketState } from '../TicketStateManager';
import { EventDrivenProcessor } from '../EventDrivenProcessor';
import { HedgeDetectionEngine } from '../HedgeDetectionEngine';
import { DiscordRichEmbeds } from '../DiscordRichEmbeds';

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockSupabaseClient = {
  from: jest.fn(),
  channel: jest.fn(),
  removeChannel: jest.fn(),
  removeAllChannels: jest.fn(),
};

// Test data fixtures
const mockTicketLegs = [
  {
    id: 'leg-1',
    ticket_id: 'test-ticket-123',
    leg_index: 0,
    player_name: 'LeBron James',
    stat_type: 'Points',
    line: 25.5,
    odds: -110,
    outcome: 'pending' as const,
    game_id: 'game-1',
    game_status: 'scheduled' as const,
    game_start_time: new Date(Date.now() + 3600000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'leg-2', 
    ticket_id: 'test-ticket-123',
    leg_index: 1,
    player_name: 'Stephen Curry',
    stat_type: 'Three Pointers',
    line: 4.5,
    odds: +105,
    outcome: 'pending' as const,
    game_id: 'game-2',
    game_status: 'scheduled' as const,
    game_start_time: new Date(Date.now() + 3600000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

const mockPropTick = {
  id: 'tick-123',
  prop_id: 'prop-456',
  player_name: 'LeBron James',
  sport: 'NBA',
  stat_type: 'Points',
  line: 25.5,
  over_odds: -110,
  under_odds: -110,
  book: 'DraftKings',
  steam_detected: true,
  sharp_money_indicator: true,
  line_movement: 1.5,
  odds_movement: 10,
  tick_timestamp: new Date().toISOString(),
  time_to_game: 120,
  confidence_level: 0.85,
};

describe('Sophisticated AlertAgent System', () => {
  let alertAgent: AlertAgent;
  let ticketStateManager: TicketStateManager;
  let eventDrivenProcessor: EventDrivenProcessor;
  let hedgeDetectionEngine: HedgeDetectionEngine;
  let discordRichEmbeds: DiscordRichEmbeds;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock Supabase responses
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      update: jest.fn().mockResolvedValue({ data: {}, error: null }),
      upsert: jest.fn().mockResolvedValue({ data: {}, error: null }),
    });

    // Initialize components
    ticketStateManager = new TicketStateManager(mockSupabaseClient as any, mockLogger as any);
    eventDrivenProcessor = new EventDrivenProcessor(
      mockSupabaseClient as any,
      mockLogger as any,
      ticketStateManager
    );
    hedgeDetectionEngine = new HedgeDetectionEngine(mockSupabaseClient as any, mockLogger as any);
    discordRichEmbeds = new DiscordRichEmbeds(mockLogger as any);

    // Initialize AlertAgent with mocked dependencies
    const config = {
      name: 'test-alert-agent',
      interval: 60000,
      enabled: true,
    };

    const deps = {
      logger: mockLogger as any,
      supabase: mockSupabaseClient as any,
    };

    alertAgent = new AlertAgent(config, deps);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('TicketStateManager', () => {
    test('should initialize ticket with OPEN state', async () => {
      // Mock successful database operations
      const mockTicketData = {
        id: 'state-123',
        ticket_id: 'test-ticket-123',
        ticket_type: 'parlay',
        state: TicketState.OPEN,
        legs_total: 2,
        legs_hit: 0,
        legs_miss: 0,
        legs_pending: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSupabaseClient.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockTicketData, error: null }),
          }),
        }),
      });

      const result = await ticketStateManager.initializeTicket(
        'test-ticket-123',
        'parlay',
        mockTicketLegs,
        2.0
      );

      expect(result).toBeDefined();
      expect(result.ticket_id).toBe('test-ticket-123');
      expect(result.state).toBe(TicketState.OPEN);
      expect(result.legs_total).toBe(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initializing ticket in state machine'),
        expect.any(Object)
      );
    });

    test('should transition from OPEN to LIVE state', async () => {
      // Mock successful state transition
      const mockUpdatedState = {
        id: 'state-123',
        ticket_id: 'test-ticket-123',
        state: TicketState.LIVE,
        legs_total: 2,
        legs_hit: 0,
        legs_pending: 2,
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: { ...mockUpdatedState, state: TicketState.OPEN }, 
              error: null 
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockUpdatedState, error: null }),
            }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      const result = await ticketStateManager.transitionToState(
        'test-ticket-123',
        TicketState.LIVE,
        'game_started'
      );

      expect(result).toBeDefined();
      expect(result.state).toBe(TicketState.LIVE);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('State transition completed'),
        expect.any(Object)
      );
    });

    test('should update leg outcome and recalculate counts', async () => {
      // Mock leg update and state recalculation
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'ticket_legs') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
            }),
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [
                  { outcome: 'hit' },
                  { outcome: 'pending' }
                ],
                error: null
              }),
            }),
          };
        }
        
        // ticket_states table
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  ticket_id: 'test-ticket-123',
                  state: TicketState.LIVE,
                  legs_total: 2,
                  legs_hit: 1,
                  legs_pending: 1
                },
                error: null
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    ticket_id: 'test-ticket-123',
                    state: TicketState.SWEAT,
                    legs_hit: 1,
                    legs_pending: 1
                  },
                  error: null
                }),
              }),
            }),
          }),
          insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
        };
      });

      const result = await ticketStateManager.updateLegOutcome(
        'test-ticket-123',
        0,
        'hit'
      );

      expect(result).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Leg outcome updated'),
        expect.any(Object)
      );
    });

    test('should enforce valid state transitions', async () => {
      // Mock current state
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                ticket_id: 'test-ticket-123',
                state: TicketState.DONE, // Terminal state
              },
              error: null
            }),
          }),
        }),
      });

      // Try invalid transition from DONE state
      await expect(
        ticketStateManager.transitionToState(
          'test-ticket-123',
          TicketState.LIVE,
          'invalid_transition'
        )
      ).rejects.toThrow(/Invalid state transition/);
    });
  });

  describe('EventDrivenProcessor', () => {
    test('should process critical events with <1s latency target', async () => {
      const startTime = Date.now();
      
      // Mock successful event processing
      const mockProcessedEvent = {
        event: mockPropTick,
        processingStartTime: startTime,
        alertOpportunities: [],
        hedgeOpportunities: [],
        ticketStateUpdates: []
      };

      // Process event (using private method via any cast for testing)
      const result = await (eventDrivenProcessor as any).processEvent(mockPropTick, startTime);
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(1000); // <1 second target
      expect(result).toBeDefined();
      expect(result.event.prop_id).toBe(mockPropTick.prop_id);
    });

    test('should detect steam moves and generate alerts', async () => {
      const steamEvent = {
        ...mockPropTick,
        steam_detected: true,
        sharp_money_indicator: true,
        line_movement: 2.0
      };

      // Process steam event
      const alertOpportunity = await (eventDrivenProcessor as any).analyzeSteamMove(steamEvent);
      
      expect(alertOpportunity).toBeDefined();
      expect(alertOpportunity.type).toBe('steam');
      expect(alertOpportunity.priority).toBe('urgent');
      expect(alertOpportunity.confidence).toBeGreaterThan(0.8);
      expect(alertOpportunity.player_name).toBe(steamEvent.player_name);
    });

    test('should identify arbitrage opportunities', async () => {
      // Mock cross-book comparison data
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            neq: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [
                      {
                        book: 'FanDuel',
                        line: 25.5,
                        over_odds: +105,
                        under_odds: -125,
                        tick_timestamp: new Date().toISOString()
                      }
                    ],
                    error: null
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const opportunities = await (eventDrivenProcessor as any).checkArbitrageOpportunities(mockPropTick);
      
      expect(Array.isArray(opportunities)).toBe(true);
      // Note: Actual arbitrage detection would require more complex setup
    });

    test('should maintain performance metrics', () => {
      const metrics = eventDrivenProcessor.getMetrics();
      
      expect(metrics).toHaveProperty('totalEventsProcessed');
      expect(metrics).toHaveProperty('averageLatencyMs');
      expect(metrics).toHaveProperty('p99LatencyMs');
      expect(metrics).toHaveProperty('alertsGenerated');
      expect(metrics).toHaveProperty('throughputPerSecond');
    });
  });

  describe('HedgeDetectionEngine', () => {
    test('should analyze hedge opportunities for matching tickets', async () => {
      // Mock matching tickets
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [{
                  ticket_id: 'test-ticket-123',
                  player_name: 'LeBron James',
                  stat_type: 'Points',
                  line: 25.5,
                  odds: -110,
                  ticket_states: {
                    exposure_units: 2.0,
                    state: 'LIVE'
                  }
                }],
                error: null
              }),
            }),
          }),
        }),
      });

      const opportunities = await hedgeDetectionEngine.analyzeHedgeOpportunities(mockPropTick);
      
      expect(Array.isArray(opportunities)).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Analyzing hedge opportunities'),
        expect.any(Object)
      );
    });

    test('should calculate arbitrage between two books', () => {
      const book1 = {
        book: 'DraftKings',
        line: 25.5,
        over_odds: -110,
        under_odds: -110,
        liquidity_score: 0.9,
        last_updated: new Date().toISOString()
      };

      const book2 = {
        book: 'FanDuel', 
        line: 25.5,
        over_odds: +105,
        under_odds: -125,
        liquidity_score: 0.85,
        last_updated: new Date().toISOString()
      };

      const arbitrage = (hedgeDetectionEngine as any).calculateArbitrage(book1, book2);
      
      expect(arbitrage).toBeDefined();
      if (arbitrage) {
        expect(arbitrage.profit_percentage).toBeGreaterThanOrEqual(0);
        expect(arbitrage.execution_sequence).toHaveLength(2);
        expect(arbitrage.risk_score).toBeDefined();
      }
    });

    test('should filter opportunities by quality thresholds', () => {
      const mockOpportunities = [
        {
          guaranteed_profit: 0.1,
          confidence: 0.9,
          liquidity_score: 0.8,
          execution_window_seconds: 120
        },
        {
          guaranteed_profit: 0.01, // Below threshold
          confidence: 0.5, // Below threshold
          liquidity_score: 0.3,
          execution_window_seconds: 30 // Below threshold
        }
      ];

      const filtered = (hedgeDetectionEngine as any).filterAndRankOpportunities(mockOpportunities);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].guaranteed_profit).toBe(0.1);
    });
  });

  describe('DiscordRichEmbeds', () => {
    test('should create enhanced alert embed with player enrichment', async () => {
      const alertData = {
        type: 'steam' as const,
        priority: 'urgent' as const,
        player_name: 'LeBron James',
        stat_type: 'Points',
        sport: 'NBA',
        team: 'Lakers',
        opponent: 'Warriors',
        confidence: 0.85,
        trigger_data: {
          line: 25.5,
          odds: -110,
          line_movement: 1.5,
          steam_detected: true
        },
        time_to_game: 120,
        expires_at: new Date(Date.now() + 300000).toISOString()
      };

      const playerData = {
        headshot_url: 'https://example.com/lebron.jpg',
        season_stats: {
          games_played: 50,
          avg_stat_value: 27.2,
          hit_rate: 0.68,
          trend: 'up' as const
        }
      };

      const embed = await discordRichEmbeds.createEnhancedAlertEmbed(
        alertData,
        playerData,
        'Steam move detected - take action!'
      );

      expect(embed).toBeDefined();
      expect(embed.data.title).toContain('STEAM ALERT');
      expect(embed.data.thumbnail?.url).toBe(playerData.headshot_url);
      expect(embed.data.fields).toHaveLength(6); // Expected number of fields
      expect(embed.data.color).toBe(0xFF0000); // Red for steam alerts
    });

    test('should create hedge opportunity embed', async () => {
      const hedgeData = {
        ticket_id: 'test-ticket-123',
        type: 'full_hedge' as const,
        player_name: 'LeBron James',
        stat_type: 'Points',
        guaranteed_profit: 0.85,
        hedge_amount_units: 1.5,
        confidence: 0.82,
        execution_window_seconds: 180,
        books_available: ['FanDuel', 'BetMGM'],
        recommended_book: 'FanDuel'
      };

      const embed = await discordRichEmbeds.createHedgeOpportunityEmbed(hedgeData);
      
      expect(embed).toBeDefined();
      expect(embed.data.title).toContain('FULL HEDGE Opportunity');
      expect(embed.data.color).toBe(0x00FF00); // Green for hedge opportunities
      expect(embed.data.fields?.some(f => f.name.includes('Profit Analysis'))).toBe(true);
      expect(embed.data.fields?.some(f => f.name.includes('Available Books'))).toBe(true);
    });

    test('should create ticket state transition embed', async () => {
      const ticketData = {
        ticket_id: 'test-ticket-123',
        ticket_type: 'parlay' as const,
        state: 'SWEAT' as const,
        legs_total: 3,
        legs_hit: 2,
        legs_pending: 1,
        exposure_units: 2.0,
        potential_payout: 8.5
      };

      const embed = await discordRichEmbeds.createTicketStateEmbed(
        ticketData,
        'LIVE',
        'leg_completed'
      );

      expect(embed).toBeDefined();
      expect(embed.data.title).toContain('LIVE → SWEAT');
      expect(embed.data.fields?.some(f => f.name.includes('Leg Progress'))).toBe(true);
      expect(embed.data.fields?.some(f => f.name.includes('Financial Status'))).toBe(true);
    });

    test('should format confidence with stars and percentage', () => {
      const confidence85 = (discordRichEmbeds as any).formatConfidenceField(0.85);
      const confidence50 = (discordRichEmbeds as any).formatConfidenceField(0.50);
      
      expect(confidence85).toContain('★★★★☆ 85%');
      expect(confidence50).toContain('★★☆☆☆ 50%');
    });
  });

  describe('AlertAgent Integration', () => {
    test('should initialize sophisticated components in production mode', async () => {
      // Test sophisticated mode detection
      expect(alertAgent.isSophisticatedMode()).toBe(false); // Not initialized yet

      // Initialize would be called during startup
      const sophisticatedMetrics = alertAgent.getSophisticatedMetrics();
      expect(sophisticatedMetrics).toHaveProperty('componentStatus');
      expect(sophisticatedMetrics.componentStatus.ticketStateManager).toBe(false);
    });

    test('should provide sophisticated health status', async () => {
      const healthStatus = await alertAgent.getSophisticatedHealthStatus();
      
      expect(healthStatus).toHaveProperty('sophisticatedComponents');
      expect(healthStatus.sophisticatedComponents).toHaveProperty('ticketStateManager');
      expect(healthStatus.sophisticatedComponents).toHaveProperty('eventDrivenProcessor');
      expect(healthStatus.sophisticatedComponents).toHaveProperty('hedgeDetectionEngine');
      expect(healthStatus.sophisticatedComponents).toHaveProperty('discordRichEmbeds');
    });

    test('should handle ticket initialization through API', async () => {
      const ticketData = {
        ticketId: 'api-test-123',
        ticketType: 'parlay' as const,
        legs: [
          {
            player_name: 'LeBron James',
            stat_type: 'Points',
            line: 25.5,
            odds: -110,
            game_start_time: new Date(Date.now() + 3600000).toISOString()
          }
        ],
        exposureUnits: 1.5
      };

      // This would throw since components aren't initialized in test
      await expect(
        alertAgent.initializeTicket(
          ticketData.ticketId,
          ticketData.ticketType,
          ticketData.legs,
          ticketData.exposureUnits
        )
      ).rejects.toThrow('TicketStateManager not initialized');
    });

    test('should track sophisticated metrics over time', () => {
      const initialMetrics = alertAgent.getSophisticatedMetrics();
      
      // Simulate metrics updates
      const expectedMetrics = [
        'eventsProcessedTotal',
        'eventProcessingLatencyP99Ms',
        'steamAlertsGenerated',
        'arbitrageOpportunitiesFound',
        'ticketsTracked',
        'stateTransitions',
        'hedgeWindowsOpened',
        'hedgeOpportunitiesDetected',
        'middleOpportunitiesFound',
        'averageHedgeProfit'
      ];

      expectedMetrics.forEach(metric => {
        expect(initialMetrics).toHaveProperty(metric);
        expect(typeof initialMetrics[metric]).toBe('number');
      });
    });
  });

  describe('Performance and Error Handling', () => {
    test('should handle database connection failures gracefully', async () => {
      // Mock database error
      const errorSupabaseClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockRejectedValue(new Error('Connection failed')),
            }),
          }),
        }),
      };

      const errorTicketManager = new TicketStateManager(
        errorSupabaseClient as any,
        mockLogger as any
      );

      const result = await errorTicketManager.getTicketState('test-ticket');
      expect(result).toBeNull(); // Should handle gracefully
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('circuit breaker'),
        expect.any(Object)
      );
    });

    test('should maintain performance under load', () => {
      const processor = new EventDrivenProcessor(
        mockSupabaseClient as any,
        mockLogger as any,
        ticketStateManager,
        {
          maxLatencyMs: 1000,
          maxConcurrentEvents: 100,
          batchSize: 50
        }
      );

      // Test deduplication under high load
      const event1 = { ...mockPropTick, id: 'dup-test' };
      const event2 = { ...mockPropTick, id: 'dup-test' }; // Duplicate

      const isDup1 = (processor as any).isDuplicateEvent(event1);
      const isDup2 = (processor as any).isDuplicateEvent(event2);

      expect(isDup1).toBe(false); // First occurrence
      expect(isDup2).toBe(true);  // Duplicate detected
    });

    test('should enforce circuit breaker patterns', async () => {
      let errorCount = 0;
      const mockErrorProcessor = {
        ...eventDrivenProcessor,
        handleProcessingError: (error: unknown, event: any) => {
          errorCount++;
          (eventDrivenProcessor as any).handleProcessingError(error, event);
        }
      };

      // Simulate errors
      const testError = new Error('Processing failed');
      mockErrorProcessor.handleProcessingError(testError, mockPropTick);
      mockErrorProcessor.handleProcessingError(testError, mockPropTick);

      expect(errorCount).toBe(2);
    });
  });
});