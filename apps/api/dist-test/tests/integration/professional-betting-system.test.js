"use strict";
/**
 * Professional Betting System Integration Tests
 *
 * Tests the complete integration between:
 * - Devigging Service
 * - CLV Tracking Service
 * - Feedback Loop Service
 * - CLV Alert Service
 * - Professional Betting Scheduler
 *
 * This ensures all professional features work together as intended.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const CLVAlertService_1 = require("../../services/alerts/CLVAlertService");
const CLVTrackingService_1 = require("../../services/clv/CLVTrackingService");
const DeviggingService_1 = require("../../services/devigging/DeviggingService");
const FeedbackLoopService_1 = require("../../services/feedback/FeedbackLoopService");
const ProfessionalBettingScheduler_1 = require("../../services/schedulers/ProfessionalBettingScheduler");
const supabaseClient_1 = require("../../services/supabaseClient");
(0, globals_1.describe)('Professional Betting System Integration', () => {
    let deviggingService;
    let clvTrackingService;
    let feedbackLoopService;
    let clvAlertService;
    let scheduler;
    // Test data
    const testUserId = '550e8400-e29b-41d4-a716-446655440000';
    const testPropId = 'test-prop-001';
    (0, globals_1.beforeAll)(async () => {
        // Initialize services
        deviggingService = DeviggingService_1.DeviggingService.getInstance();
        clvTrackingService = CLVTrackingService_1.CLVTrackingService.getInstance();
        feedbackLoopService = FeedbackLoopService_1.FeedbackLoopService.getInstance();
        clvAlertService = CLVAlertService_1.CLVAlertService.getInstance();
        scheduler = ProfessionalBettingScheduler_1.ProfessionalBettingScheduler.getInstance();
        // Clean up any existing test data
        await cleanupTestData();
    });
    (0, globals_1.afterAll)(async () => {
        // Clean up test data
        await cleanupTestData();
        // Stop scheduler if running
        scheduler.stop();
    });
    (0, globals_1.beforeEach)(async () => {
        // Set up fresh test environment for each test
        await setupTestData();
    });
    (0, globals_1.afterEach)(async () => {
        // Clean up after each test
        await cleanupTestData();
    });
    (0, globals_1.describe)('Devigging Service Integration', () => {
        (0, globals_1.test)('should correctly devig two-way market odds', () => {
            const market = {
                odds1: -110,
                odds2: -110
            };
            const result = deviggingService.devigTwoWay(market);
            // Standard -110/-110 market should have ~4.5% vig
            (0, globals_1.expect)(result.totalVig).toBeCloseTo(4.5, 1);
            (0, globals_1.expect)(result.outcome1.trueProb + result.outcome2.trueProb).toBeCloseTo(1.0, 3);
            (0, globals_1.expect)(result.outcome1.trueProb).toBeCloseTo(0.5, 2);
            (0, globals_1.expect)(result.outcome2.trueProb).toBeCloseTo(0.5, 2);
        });
        (0, globals_1.test)('should handle three-way markets correctly', () => {
            const market = {
                odds: [150, 300, 400] // Favorite, Underdog, Longshot
            };
            const result = deviggingService.devigMultiWay(market);
            (0, globals_1.expect)(result.totalVig).toBeGreaterThan(0);
            (0, globals_1.expect)(result.outcomes).toHaveLength(3);
            const totalProb = result.outcomes.reduce((sum, outcome) => sum + outcome.trueProb, 0);
            (0, globals_1.expect)(totalProb).toBeCloseTo(1.0, 3);
            // Favorite should have highest probability
            (0, globals_1.expect)(result.outcomes[0].trueProb).toBeGreaterThan(result.outcomes[1].trueProb);
            (0, globals_1.expect)(result.outcomes[1].trueProb).toBeGreaterThan(result.outcomes[2].trueProb);
        });
        (0, globals_1.test)('should calculate edge correctly using devigged odds', () => {
            const modelProb = 0.55; // Our model thinks 55% chance
            const marketOdds = -110; // Market implies ~52.4% after devig
            const edge = deviggingService.calculateEdge(modelProb, marketOdds, false);
            // Should be positive edge since our model > devigged market
            (0, globals_1.expect)(edge).toBeGreaterThan(0);
        });
    });
    (0, globals_1.describe)('CLV Tracking Integration', () => {
        (0, globals_1.test)('should track a complete pick lifecycle', async () => {
            const pickData = {
                propId: testPropId,
                userId: testUserId,
                sport: 'NFL',
                market: 'player_props',
                book: 'DraftKings',
                openingLine: 10.5,
                openingOdds: -110,
                betLine: 10.5,
                betOdds: -110,
                gameTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
                modelEdge: 2.5
            };
            // 1. Track initial pick
            await clvTrackingService.trackPick(pickData);
            // 2. Update closing line (simulate line movement)
            const clvEntry = await clvTrackingService.updateClosingLine(testPropId, 11.0, // Line moved up
            -120 // Odds got worse
            );
            // 3. Verify CLV calculation
            (0, globals_1.expect)(clvEntry.clv).toBeGreaterThan(0); // We beat the closing line
            (0, globals_1.expect)(clvEntry.beatsClosing).toBe(true);
            (0, globals_1.expect)(clvEntry.clvPercentage).toBeGreaterThan(0);
        });
        (0, globals_1.test)('should aggregate CLV stats correctly', async () => {
            // Create multiple test picks with known CLV
            const picks = [
                { propId: 'pick-1', clv: 2.5, sport: 'NFL', book: 'DraftKings' },
                { propId: 'pick-2', clv: -1.0, sport: 'NFL', book: 'DraftKings' },
                { propId: 'pick-3', clv: 3.0, sport: 'NBA', book: 'FanDuel' },
                { propId: 'pick-4', clv: 1.5, sport: 'NBA', book: 'FanDuel' }
            ];
            // Insert test picks
            for (const pick of picks) {
                await supabaseClient_1.supabaseClient.from('clv_tracking').insert({
                    prop_id: pick.propId,
                    user_id: testUserId,
                    sport: pick.sport,
                    market: 'player_props',
                    book: pick.book,
                    bet_line: 10.5,
                    bet_odds: -110,
                    closing_line: 10.5,
                    closing_odds: -110,
                    game_time: new Date(),
                    clv: pick.clv,
                    clv_percentage: pick.clv,
                    beats_closing: pick.clv > 0
                });
            }
            // Get stats
            const stats = await clvTrackingService.getCLVStats({
                startDate: new Date(Date.now() - 24 * 60 * 60 * 1000)
            });
            (0, globals_1.expect)(stats.totalBets).toBe(4);
            (0, globals_1.expect)(stats.clvPositive).toBe(3); // 3 positive CLV picks
            (0, globals_1.expect)(stats.avgCLVPercentage).toBeCloseTo(1.5, 1); // (2.5 - 1.0 + 3.0 + 1.5) / 4
            // Check sport breakdown
            (0, globals_1.expect)(stats.byBook.get('DraftKings')?.count).toBe(2);
            (0, globals_1.expect)(stats.byBook.get('FanDuel')?.count).toBe(2);
        });
    });
    (0, globals_1.describe)('Feedback Loop Integration', () => {
        (0, globals_1.test)('should adjust weights based on CLV performance', async () => {
            // Create test data with specific feature performance
            await setupTestGradedProps();
            // Run feedback loop
            const results = await feedbackLoopService.runFeedbackLoop();
            (0, globals_1.expect)(results.weightAdjustments).toBeDefined();
            (0, globals_1.expect)(results.bookAdjustments).toBeDefined();
            (0, globals_1.expect)(results.marketAdjustments).toBeDefined();
            (0, globals_1.expect)(results.prunedFeatures).toBeDefined();
            // Verify adjustments were applied
            (0, globals_1.expect)(results.weightAdjustments.length).toBeGreaterThanOrEqual(0);
            (0, globals_1.expect)(results.bookAdjustments.length).toBeGreaterThan(0);
        });
        (0, globals_1.test)('should update sportsbook weights based on performance', async () => {
            // Insert test CLV data showing DraftKings > FanDuel performance
            await supabaseClient_1.supabaseClient.from('clv_tracking').insert([
                {
                    prop_id: 'dk-1',
                    user_id: testUserId,
                    sport: 'NFL',
                    market: 'player_props',
                    book: 'DraftKings',
                    bet_line: 10.5,
                    bet_odds: -110,
                    game_time: new Date(),
                    clv_percentage: 3.0, // Excellent CLV
                    beats_closing: true
                },
                {
                    prop_id: 'fd-1',
                    user_id: testUserId,
                    sport: 'NFL',
                    market: 'player_props',
                    book: 'FanDuel',
                    bet_line: 10.5,
                    bet_odds: -110,
                    game_time: new Date(),
                    clv_percentage: -2.0, // Poor CLV
                    beats_closing: false
                }
            ]);
            const results = await feedbackLoopService.runFeedbackLoop();
            const dkPerf = results.bookAdjustments.find(b => b.book === 'DraftKings');
            const fdPerf = results.bookAdjustments.find(b => b.book === 'FanDuel');
            // DraftKings should get higher weight due to better CLV
            if (dkPerf && fdPerf) {
                (0, globals_1.expect)(dkPerf.suggestedWeight).toBeGreaterThan(fdPerf.suggestedWeight);
            }
        });
    });
    (0, globals_1.describe)('CLV Alert System Integration', () => {
        (0, globals_1.test)('should trigger alerts when CLV drops below thresholds', async () => {
            // Set up poor CLV performance
            const poorPicks = Array.from({ length: 30 }, (_, i) => ({
                prop_id: `poor-pick-${i}`,
                user_id: testUserId,
                sport: 'NFL',
                market: 'player_props',
                book: 'DraftKings',
                bet_line: 10.5,
                bet_odds: -110,
                game_time: new Date(),
                bet_time: new Date(Date.now() - i * 60 * 60 * 1000), // Spread over hours
                clv_percentage: -3.0, // Consistently poor CLV
                beats_closing: false
            }));
            await supabaseClient_1.supabaseClient.from('clv_tracking').insert(poorPicks);
            // Run CLV monitoring
            await clvAlertService.monitorCLV();
            // Check for alerts
            const alerts = await clvAlertService.getActiveAlerts();
            const criticalAlerts = alerts.filter(a => a.level === 'critical');
            (0, globals_1.expect)(criticalAlerts.length).toBeGreaterThan(0);
        });
        (0, globals_1.test)('should not spam duplicate alerts', async () => {
            // Run monitoring twice
            await clvAlertService.monitorCLV();
            await clvAlertService.monitorCLV();
            const alerts = await clvAlertService.getActiveAlerts();
            // Should not have duplicate alerts for same issue
            const uniqueMessages = new Set(alerts.map(a => a.message));
            (0, globals_1.expect)(uniqueMessages.size).toBe(alerts.length);
        });
    });
    (0, globals_1.describe)('Scheduler Integration', () => {
        (0, globals_1.test)('should start and stop scheduler without errors', () => {
            (0, globals_1.expect)(() => {
                scheduler.start();
                scheduler.stop();
            }).not.toThrow();
        });
        (0, globals_1.test)('should manually trigger tasks', async () => {
            await (0, globals_1.expect)(scheduler.triggerTask('clv_monitoring')).resolves.not.toThrow();
            await (0, globals_1.expect)(scheduler.triggerTask('feedback_loop')).resolves.not.toThrow();
            await (0, globals_1.expect)(scheduler.triggerTask('health_check')).resolves.not.toThrow();
        });
        (0, globals_1.test)('should provide scheduler status', () => {
            const status = scheduler.getStatus();
            (0, globals_1.expect)(status).toHaveProperty('isRunning');
            (0, globals_1.expect)(status).toHaveProperty('scheduledTasks');
            (0, globals_1.expect)(status).toHaveProperty('lastRunTimes');
        });
    });
    (0, globals_1.describe)('End-to-End Professional Flow', () => {
        (0, globals_1.test)('should complete full professional betting cycle', async () => {
            // 1. Devig market odds
            const market = { odds1: -108, odds2: -112 };
            const devigged = deviggingService.devigTwoWay(market);
            (0, globals_1.expect)(devigged.totalVig).toBeGreaterThan(0);
            (0, globals_1.expect)(devigged.totalVig).toBeLessThan(5); // Reasonable vig
            // 2. Track pick with opening odds
            const pickData = {
                propId: testPropId,
                userId: testUserId,
                sport: 'NFL',
                market: 'player_props',
                book: 'DraftKings',
                openingLine: 10.5,
                openingOdds: -108,
                betLine: 10.5,
                betOdds: -108,
                gameTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
                modelEdge: deviggingService.calculateEdge(0.54, -108, false).edge // Use devigged edge
            };
            await clvTrackingService.trackPick(pickData);
            // 3. Simulate line movement (closing line worse)
            await clvTrackingService.updateClosingLine(testPropId, 10.5, -115);
            // 4. Get CLV stats
            const stats = await clvTrackingService.getCLVStats({
                startDate: new Date(Date.now() - 60 * 60 * 1000)
            });
            (0, globals_1.expect)(stats.totalBets).toBe(1);
            (0, globals_1.expect)(stats.clvPositive).toBe(1); // Should beat closing line
            // 5. Run feedback loop (should process the CLV data)
            const feedback = await feedbackLoopService.runFeedbackLoop();
            (0, globals_1.expect)(feedback).toBeDefined();
            (0, globals_1.expect)(feedback.bookAdjustments.some(b => b.book === 'DraftKings')).toBe(true);
            // 6. Check monitoring doesn't trigger alerts (good CLV)
            await clvAlertService.monitorCLV();
            const alerts = await clvAlertService.getActiveAlerts();
            // Should not have critical alerts with positive CLV
            const criticalAlerts = alerts.filter(a => a.level === 'critical');
            (0, globals_1.expect)(criticalAlerts.length).toBe(0);
        });
    });
    // Helper functions
    async function cleanupTestData() {
        const tables = [
            'clv_tracking',
            'clv_alerts',
            'feedback_loop_history',
            'graded_props'
        ];
        for (const table of tables) {
            await supabaseClient_1.supabaseClient
                .from(table)
                .delete()
                .like('prop_id', 'test-%')
                .or(`prop_id.like.poor-pick-%,prop_id.like.pick-%,prop_id.like.dk-%,prop_id.like.fd-%`);
        }
    }
    async function setupTestData() {
        // Insert test user if needed (most tests need this)
        await supabaseClient_1.supabaseClient
            .from('users')
            .upsert({
            id: testUserId,
            username: 'test-user',
            discord_id: '123456789',
            tier: 'premium'
        }, { onConflict: 'id' });
    }
    async function setupTestGradedProps() {
        // Create test grading_status props with CLV data for feedback loop testing
        const testProps = [
            {
                id: 'graded-1',
                prop_id: 'test-graded-1',
                user_id: testUserId,
                sport: 'NFL',
                market: 'player_props',
                created_at: new Date().toISOString(),
                feature_contributions: {
                    'volume_score': 0.15,
                    'matchup_score': 0.25,
                    'trend_score': 0.20,
                    'line_value_score': 0.40
                }
            }
        ];
        await supabaseClient_1.supabaseClient.from('graded_props').insert(testProps);
        // Add corresponding CLV data
        const clvData = [
            {
                prop_id: 'test-graded-1',
                user_id: testUserId,
                sport: 'NFL',
                market: 'player_props',
                book: 'DraftKings',
                bet_line: 10.5,
                bet_odds: -110,
                game_time: new Date(),
                clv_percentage: 2.5,
                beats_closing: true
            }
        ];
        await supabaseClient_1.supabaseClient.from('clv_tracking').insert(clvData);
    }
});
//# sourceMappingURL=professional-betting-system.test.js.map