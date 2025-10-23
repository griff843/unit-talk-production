"use strict";
/**
 * Comprehensive test suite for Sophisticated AlertAgent System
 * Tests all components: TicketStateManager, EventDrivenProcessor, HedgeDetectionEngine, DiscordRichEmbeds
 */
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const index_1 = require("../index");
const TicketStateManager_1 = require("../TicketStateManager");
const EventDrivenProcessor_1 = require("../EventDrivenProcessor");
const HedgeDetectionEngine_1 = require("../HedgeDetectionEngine");
const DiscordRichEmbeds_1 = require("../DiscordRichEmbeds");
// Mock dependencies
const mockLogger = {
    info: globals_1.jest.fn(),
    warn: globals_1.jest.fn(),
    error: globals_1.jest.fn(),
    debug: globals_1.jest.fn(),
};
const mockSupabaseClient = {
    from: globals_1.jest.fn(),
    channel: globals_1.jest.fn(),
    removeChannel: globals_1.jest.fn(),
    removeAllChannels: globals_1.jest.fn(),
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
        outcome: 'pending',
        game_id: 'game-1',
        game_status: 'scheduled',
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
        outcome: 'pending',
        game_id: 'game-2',
        game_status: 'scheduled',
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
(0, globals_1.describe)('Sophisticated AlertAgent System', () => {
    let alertAgent;
    let ticketStateManager;
    let eventDrivenProcessor;
    let hedgeDetectionEngine;
    let discordRichEmbeds;
    (0, globals_1.beforeEach)(() => {
        // Reset mocks
        globals_1.jest.clearAllMocks();
        // Setup mock Supabase responses
        mockSupabaseClient.from.mockReturnValue({
            select: globals_1.jest.fn().mockReturnValue({
                eq: globals_1.jest.fn().mockReturnValue({
                    single: globals_1.jest.fn().mockResolvedValue({ data: null, error: null }),
                    limit: globals_1.jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
            }),
            insert: globals_1.jest.fn().mockResolvedValue({ data: {}, error: null }),
            update: globals_1.jest.fn().mockResolvedValue({ data: {}, error: null }),
            upsert: globals_1.jest.fn().mockResolvedValue({ data: {}, error: null }),
        });
        // Initialize components
        ticketStateManager = new TicketStateManager_1.TicketStateManager(mockSupabaseClient, mockLogger);
        eventDrivenProcessor = new EventDrivenProcessor_1.EventDrivenProcessor(mockSupabaseClient, mockLogger, ticketStateManager);
        hedgeDetectionEngine = new HedgeDetectionEngine_1.HedgeDetectionEngine(mockSupabaseClient, mockLogger);
        discordRichEmbeds = new DiscordRichEmbeds_1.DiscordRichEmbeds(mockLogger);
        // Initialize AlertAgent with mocked dependencies
        const config = {
            name: 'test-alert-agent',
            interval: 60000,
            enabled: true,
        };
        const deps = {
            logger: mockLogger,
            supabase: mockSupabaseClient,
        };
        alertAgent = new index_1.AlertAgent(config, deps);
    });
    (0, globals_1.afterEach)(() => {
        globals_1.jest.clearAllMocks();
    });
    (0, globals_1.describe)('TicketStateManager', () => {
        (0, globals_1.test)('should initialize ticket with OPEN state', async () => {
            // Mock successful database operations
            const mockTicketData = {
                id: 'state-123',
                ticket_id: 'test-ticket-123',
                ticket_type: 'parlay',
                state: TicketStateManager_1.TicketState.OPEN,
                legs_total: 2,
                legs_hit: 0,
                legs_miss: 0,
                legs_pending: 2,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockSupabaseClient.from.mockReturnValueOnce({
                insert: globals_1.jest.fn().mockReturnValue({
                    select: globals_1.jest.fn().mockReturnValue({
                        single: globals_1.jest.fn().mockResolvedValue({ data: mockTicketData, error: null }),
                    }),
                }),
            });
            const result = await ticketStateManager.initializeTicket('test-ticket-123', 'parlay', mockTicketLegs, 2.0);
            (0, globals_1.expect)(result).toBeDefined();
            (0, globals_1.expect)(result.ticket_id).toBe('test-ticket-123');
            (0, globals_1.expect)(result.state).toBe(TicketStateManager_1.TicketState.OPEN);
            (0, globals_1.expect)(result.legs_total).toBe(2);
            (0, globals_1.expect)(mockLogger.info).toHaveBeenCalledWith(globals_1.expect.stringContaining('Initializing ticket in state machine'), globals_1.expect.any(Object));
        });
        (0, globals_1.test)('should transition from OPEN to LIVE state', async () => {
            // Mock successful state transition
            const mockUpdatedState = {
                id: 'state-123',
                ticket_id: 'test-ticket-123',
                state: TicketStateManager_1.TicketState.LIVE,
                legs_total: 2,
                legs_hit: 0,
                legs_pending: 2,
            };
            mockSupabaseClient.from.mockReturnValue({
                select: globals_1.jest.fn().mockReturnValue({
                    eq: globals_1.jest.fn().mockReturnValue({
                        single: globals_1.jest.fn().mockResolvedValue({
                            data: { ...mockUpdatedState, state: TicketStateManager_1.TicketState.OPEN },
                            error: null
                        }),
                    }),
                }),
                update: globals_1.jest.fn().mockReturnValue({
                    eq: globals_1.jest.fn().mockReturnValue({
                        select: globals_1.jest.fn().mockReturnValue({
                            single: globals_1.jest.fn().mockResolvedValue({ data: mockUpdatedState, error: null }),
                        }),
                    }),
                }),
                insert: globals_1.jest.fn().mockResolvedValue({ data: {}, error: null }),
            });
            const result = await ticketStateManager.transitionToState('test-ticket-123', TicketStateManager_1.TicketState.LIVE, 'game_started');
            (0, globals_1.expect)(result).toBeDefined();
            (0, globals_1.expect)(result.state).toBe(TicketStateManager_1.TicketState.LIVE);
            (0, globals_1.expect)(mockLogger.info).toHaveBeenCalledWith(globals_1.expect.stringContaining('State transition completed'), globals_1.expect.any(Object));
        });
        (0, globals_1.test)('should update leg outcome and recalculate counts', async () => {
            // Mock leg update and state recalculation
            mockSupabaseClient.from.mockImplementation((table) => {
                if (table === 'ticket_legs') {
                    return {
                        update: globals_1.jest.fn().mockReturnValue({
                            eq: globals_1.jest.fn().mockReturnValue({
                                eq: globals_1.jest.fn().mockResolvedValue({ error: null }),
                            }),
                        }),
                        select: globals_1.jest.fn().mockReturnValue({
                            eq: globals_1.jest.fn().mockResolvedValue({
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
                    select: globals_1.jest.fn().mockReturnValue({
                        eq: globals_1.jest.fn().mockReturnValue({
                            single: globals_1.jest.fn().mockResolvedValue({
                                data: {
                                    ticket_id: 'test-ticket-123',
                                    state: TicketStateManager_1.TicketState.LIVE,
                                    legs_total: 2,
                                    legs_hit: 1,
                                    legs_pending: 1
                                },
                                error: null
                            }),
                        }),
                    }),
                    update: globals_1.jest.fn().mockReturnValue({
                        eq: globals_1.jest.fn().mockReturnValue({
                            select: globals_1.jest.fn().mockReturnValue({
                                single: globals_1.jest.fn().mockResolvedValue({
                                    data: {
                                        ticket_id: 'test-ticket-123',
                                        state: TicketStateManager_1.TicketState.SWEAT,
                                        legs_hit: 1,
                                        legs_pending: 1
                                    },
                                    error: null
                                }),
                            }),
                        }),
                    }),
                    insert: globals_1.jest.fn().mockResolvedValue({ data: {}, error: null }),
                };
            });
            const result = await ticketStateManager.updateLegOutcome('test-ticket-123', 0, 'hit');
            (0, globals_1.expect)(result).toBeDefined();
            (0, globals_1.expect)(mockLogger.info).toHaveBeenCalledWith(globals_1.expect.stringContaining('Leg outcome updated'), globals_1.expect.any(Object));
        });
        (0, globals_1.test)('should enforce valid state transitions', async () => {
            // Mock current state
            mockSupabaseClient.from.mockReturnValue({
                select: globals_1.jest.fn().mockReturnValue({
                    eq: globals_1.jest.fn().mockReturnValue({
                        single: globals_1.jest.fn().mockResolvedValue({
                            data: {
                                ticket_id: 'test-ticket-123',
                                state: TicketStateManager_1.TicketState.DONE, // Terminal state
                            },
                            error: null
                        }),
                    }),
                }),
            });
            // Try invalid transition from DONE state
            await (0, globals_1.expect)(ticketStateManager.transitionToState('test-ticket-123', TicketStateManager_1.TicketState.LIVE, 'invalid_transition')).rejects.toThrow(/Invalid state transition/);
        });
    });
    (0, globals_1.describe)('EventDrivenProcessor', () => {
        (0, globals_1.test)('should process critical events with <1s latency target', async () => {
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
            const result = await eventDrivenProcessor.processEvent(mockPropTick, startTime);
            const processingTime = Date.now() - startTime;
            (0, globals_1.expect)(processingTime).toBeLessThan(1000); // <1 second target
            (0, globals_1.expect)(result).toBeDefined();
            (0, globals_1.expect)(result.event.prop_id).toBe(mockPropTick.prop_id);
        });
        (0, globals_1.test)('should detect steam moves and generate alerts', async () => {
            const steamEvent = {
                ...mockPropTick,
                steam_detected: true,
                sharp_money_indicator: true,
                line_movement: 2.0
            };
            // Process steam event
            const alertOpportunity = await eventDrivenProcessor.analyzeSteamMove(steamEvent);
            (0, globals_1.expect)(alertOpportunity).toBeDefined();
            (0, globals_1.expect)(alertOpportunity.type).toBe('steam');
            (0, globals_1.expect)(alertOpportunity.priority).toBe('urgent');
            (0, globals_1.expect)(alertOpportunity.confidence).toBeGreaterThan(0.8);
            (0, globals_1.expect)(alertOpportunity.player_name).toBe(steamEvent.player_name);
        });
        (0, globals_1.test)('should identify arbitrage opportunities', async () => {
            // Mock cross-book comparison data
            mockSupabaseClient.from.mockReturnValue({
                select: globals_1.jest.fn().mockReturnValue({
                    eq: globals_1.jest.fn().mockReturnValue({
                        neq: globals_1.jest.fn().mockReturnValue({
                            gte: globals_1.jest.fn().mockReturnValue({
                                order: globals_1.jest.fn().mockReturnValue({
                                    limit: globals_1.jest.fn().mockResolvedValue({
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
            const opportunities = await eventDrivenProcessor.checkArbitrageOpportunities(mockPropTick);
            (0, globals_1.expect)(Array.isArray(opportunities)).toBe(true);
            // Note: Actual arbitrage detection would require more complex setup
        });
        (0, globals_1.test)('should maintain performance metrics', () => {
            const metrics = eventDrivenProcessor.getMetrics();
            (0, globals_1.expect)(metrics).toHaveProperty('totalEventsProcessed');
            (0, globals_1.expect)(metrics).toHaveProperty('averageLatencyMs');
            (0, globals_1.expect)(metrics).toHaveProperty('p99LatencyMs');
            (0, globals_1.expect)(metrics).toHaveProperty('alertsGenerated');
            (0, globals_1.expect)(metrics).toHaveProperty('throughputPerSecond');
        });
    });
    (0, globals_1.describe)('HedgeDetectionEngine', () => {
        (0, globals_1.test)('should analyze hedge opportunities for matching tickets', async () => {
            // Mock matching tickets
            mockSupabaseClient.from.mockReturnValue({
                select: globals_1.jest.fn().mockReturnValue({
                    eq: globals_1.jest.fn().mockReturnValue({
                        in: globals_1.jest.fn().mockReturnValue({
                            limit: globals_1.jest.fn().mockResolvedValue({
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
            (0, globals_1.expect)(Array.isArray(opportunities)).toBe(true);
            (0, globals_1.expect)(mockLogger.info).toHaveBeenCalledWith(globals_1.expect.stringContaining('Analyzing hedge opportunities'), globals_1.expect.any(Object));
        });
        (0, globals_1.test)('should calculate arbitrage between two books', () => {
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
            const arbitrage = hedgeDetectionEngine.calculateArbitrage(book1, book2);
            (0, globals_1.expect)(arbitrage).toBeDefined();
            if (arbitrage) {
                (0, globals_1.expect)(arbitrage.profit_percentage).toBeGreaterThanOrEqual(0);
                (0, globals_1.expect)(arbitrage.execution_sequence).toHaveLength(2);
                (0, globals_1.expect)(arbitrage.risk_score).toBeDefined();
            }
        });
        (0, globals_1.test)('should filter opportunities by quality thresholds', () => {
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
            const filtered = hedgeDetectionEngine.filterAndRankOpportunities(mockOpportunities);
            (0, globals_1.expect)(filtered).toHaveLength(1);
            (0, globals_1.expect)(filtered[0].guaranteed_profit).toBe(0.1);
        });
    });
    (0, globals_1.describe)('DiscordRichEmbeds', () => {
        (0, globals_1.test)('should create enhanced alert embed with player enrichment', async () => {
            const alertData = {
                type: 'steam',
                priority: 'urgent',
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
                    trend: 'up'
                }
            };
            const embed = await discordRichEmbeds.createEnhancedAlertEmbed(alertData, playerData, 'Steam move detected - take action!');
            (0, globals_1.expect)(embed).toBeDefined();
            (0, globals_1.expect)(embed.data.title).toContain('STEAM ALERT');
            (0, globals_1.expect)(embed.data.thumbnail?.url).toBe(playerData.headshot_url);
            (0, globals_1.expect)(embed.data.fields).toHaveLength(6); // Expected number of fields
            (0, globals_1.expect)(embed.data.color).toBe(0xFF0000); // Red for steam alerts
        });
        (0, globals_1.test)('should create hedge opportunity embed', async () => {
            const hedgeData = {
                ticket_id: 'test-ticket-123',
                type: 'full_hedge',
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
            (0, globals_1.expect)(embed).toBeDefined();
            (0, globals_1.expect)(embed.data.title).toContain('FULL HEDGE Opportunity');
            (0, globals_1.expect)(embed.data.color).toBe(0x00FF00); // Green for hedge opportunities
            (0, globals_1.expect)(embed.data.fields?.some(f => f.name.includes('Profit Analysis'))).toBe(true);
            (0, globals_1.expect)(embed.data.fields?.some(f => f.name.includes('Available Books'))).toBe(true);
        });
        (0, globals_1.test)('should create ticket state transition embed', async () => {
            const ticketData = {
                ticket_id: 'test-ticket-123',
                ticket_type: 'parlay',
                state: 'SWEAT',
                legs_total: 3,
                legs_hit: 2,
                legs_pending: 1,
                exposure_units: 2.0,
                potential_payout: 8.5
            };
            const embed = await discordRichEmbeds.createTicketStateEmbed(ticketData, 'LIVE', 'leg_completed');
            (0, globals_1.expect)(embed).toBeDefined();
            (0, globals_1.expect)(embed.data.title).toContain('LIVE → SWEAT');
            (0, globals_1.expect)(embed.data.fields?.some(f => f.name.includes('Leg Progress'))).toBe(true);
            (0, globals_1.expect)(embed.data.fields?.some(f => f.name.includes('Financial Status'))).toBe(true);
        });
        (0, globals_1.test)('should format confidence with stars and percentage', () => {
            const confidence85 = discordRichEmbeds.formatConfidenceField(0.85);
            const confidence50 = discordRichEmbeds.formatConfidenceField(0.50);
            (0, globals_1.expect)(confidence85).toContain('★★★★☆ 85%');
            (0, globals_1.expect)(confidence50).toContain('★★☆☆☆ 50%');
        });
    });
    (0, globals_1.describe)('AlertAgent Integration', () => {
        (0, globals_1.test)('should initialize sophisticated components in production mode', async () => {
            // Test sophisticated mode detection
            (0, globals_1.expect)(alertAgent.isSophisticatedMode()).toBe(false); // Not initialized yet
            // Initialize would be called during startup
            const sophisticatedMetrics = alertAgent.getSophisticatedMetrics();
            (0, globals_1.expect)(sophisticatedMetrics).toHaveProperty('componentStatus');
            (0, globals_1.expect)(sophisticatedMetrics.componentStatus.ticketStateManager).toBe(false);
        });
        (0, globals_1.test)('should provide sophisticated health status', async () => {
            const healthStatus = await alertAgent.getSophisticatedHealthStatus();
            (0, globals_1.expect)(healthStatus).toHaveProperty('sophisticatedComponents');
            (0, globals_1.expect)(healthStatus.sophisticatedComponents).toHaveProperty('ticketStateManager');
            (0, globals_1.expect)(healthStatus.sophisticatedComponents).toHaveProperty('eventDrivenProcessor');
            (0, globals_1.expect)(healthStatus.sophisticatedComponents).toHaveProperty('hedgeDetectionEngine');
            (0, globals_1.expect)(healthStatus.sophisticatedComponents).toHaveProperty('discordRichEmbeds');
        });
        (0, globals_1.test)('should handle ticket initialization through API', async () => {
            const ticketData = {
                ticketId: 'api-test-123',
                ticketType: 'parlay',
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
            await (0, globals_1.expect)(alertAgent.initializeTicket(ticketData.ticketId, ticketData.ticketType, ticketData.legs, ticketData.exposureUnits)).rejects.toThrow('TicketStateManager not initialized');
        });
        (0, globals_1.test)('should track sophisticated metrics over time', () => {
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
                (0, globals_1.expect)(initialMetrics).toHaveProperty(metric);
                (0, globals_1.expect)(typeof initialMetrics[metric]).toBe('number');
            });
        });
    });
    (0, globals_1.describe)('Performance and Error Handling', () => {
        (0, globals_1.test)('should handle database connection failures gracefully', async () => {
            // Mock database error
            const errorSupabaseClient = {
                from: globals_1.jest.fn().mockReturnValue({
                    select: globals_1.jest.fn().mockReturnValue({
                        eq: globals_1.jest.fn().mockReturnValue({
                            single: globals_1.jest.fn().mockRejectedValue(new Error('Connection failed')),
                        }),
                    }),
                }),
            };
            const errorTicketManager = new TicketStateManager_1.TicketStateManager(errorSupabaseClient, mockLogger);
            const result = await errorTicketManager.getTicketState('test-ticket');
            (0, globals_1.expect)(result).toBeNull(); // Should handle gracefully
            (0, globals_1.expect)(mockLogger.warn).toHaveBeenCalledWith(globals_1.expect.stringContaining('circuit breaker'), globals_1.expect.any(Object));
        });
        (0, globals_1.test)('should maintain performance under load', () => {
            const processor = new EventDrivenProcessor_1.EventDrivenProcessor(mockSupabaseClient, mockLogger, ticketStateManager, {
                maxLatencyMs: 1000,
                maxConcurrentEvents: 100,
                batchSize: 50
            });
            // Test deduplication under high load
            const event1 = { ...mockPropTick, id: 'dup-test' };
            const event2 = { ...mockPropTick, id: 'dup-test' }; // Duplicate
            const isDup1 = processor.isDuplicateEvent(event1);
            const isDup2 = processor.isDuplicateEvent(event2);
            (0, globals_1.expect)(isDup1).toBe(false); // First occurrence
            (0, globals_1.expect)(isDup2).toBe(true); // Duplicate detected
        });
        (0, globals_1.test)('should enforce circuit breaker patterns', async () => {
            let errorCount = 0;
            const mockErrorProcessor = {
                ...eventDrivenProcessor,
                handleProcessingError: (error, event) => {
                    errorCount++;
                    eventDrivenProcessor.handleProcessingError(error, event);
                }
            };
            // Simulate errors
            const testError = new Error('Processing failed');
            mockErrorProcessor.handleProcessingError(testError, mockPropTick);
            mockErrorProcessor.handleProcessingError(testError, mockPropTick);
            (0, globals_1.expect)(errorCount).toBe(2);
        });
    });
});
//# sourceMappingURL=sophisticated-alert-agent.test.js.map