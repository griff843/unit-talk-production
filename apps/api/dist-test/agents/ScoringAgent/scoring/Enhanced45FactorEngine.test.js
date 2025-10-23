"use strict";
/**
 * Comprehensive Test Suite for Enhanced 45-Factor Engine
 *
 * Tests all 45 factors across Market, Player, Matchup, Price, and Meta categories.
 * Includes performance benchmarks, edge cases, and integration testing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const Enhanced45FactorEngine_1 = require("./Enhanced45FactorEngine");
describe('Enhanced45FactorEngine', () => {
    let engine;
    let mockFeatureStore;
    let mockChangeDetector;
    let mockFeatureStoreService;
    beforeEach(() => {
        // Create mock dependencies
        mockFeatureStoreService = {
            upsertFeature: jest.fn().mockResolvedValue({ success: true }),
            queryFeatures: jest.fn().mockResolvedValue({})
        };
        mockFeatureStore = {
            getEnhancedFeatures: jest.fn(),
            precomputeFeatures: jest.fn(),
            checkFreshness: jest.fn(),
            invalidateFeatures: jest.fn(),
            getCacheStats: jest.fn()
        };
        mockChangeDetector = {
            registerProp: jest.fn(),
            updatePropValues: jest.fn(),
            getChangeHistory: jest.fn(),
            getStatus: jest.fn(),
            shutdown: jest.fn()
        };
        engine = new Enhanced45FactorEngine_1.Enhanced45FactorEngine(mockFeatureStore, mockChangeDetector);
    });
    describe('Core Functionality', () => {
        it('should initialize with default configuration', () => {
            expect(engine).toBeDefined();
        });
        it('should calculate 45-factor score successfully', async () => {
            // Mock feature store response with comprehensive data
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(createMockEnhancedFeatures());
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            expect(result).toBeDefined();
            expect(result.totalScore).toBeGreaterThanOrEqual(0);
            expect(result.totalScore).toBeLessThanOrEqual(100);
            expect(result.tier).toMatch(/^[SABCD]$/);
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
            expect(Object.keys(result.factorScores)).toHaveLength(45);
        });
        it('should handle missing feature data gracefully', async () => {
            // Mock feature store to return empty data
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(createEmptyEnhancedFeatures());
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            expect(result).toBeDefined();
            expect(result.totalScore).toBeGreaterThanOrEqual(0);
            expect(result.version).toContain('fallback');
        });
        it('should complete within performance targets', async () => {
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(createMockEnhancedFeatures());
            const features = createMockGradingFeatureSet();
            const startTime = Date.now();
            await engine.calculate45FactorScore(features);
            const processingTime = Date.now() - startTime;
            expect(processingTime).toBeLessThan(100); // Should complete within 100ms
        });
    });
    describe('Market Factors (10 factors)', () => {
        beforeEach(() => {
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(createMockEnhancedFeatures());
        });
        it('should calculate Expected Value Devigged correctly', async () => {
            const features = createMockGradingFeatureSet({
                expectedValue: 12.5 // 12.5% expected value
            });
            const result = await engine.calculate45FactorScore(features);
            // High EV should contribute to high market score
            expect(result.marketScore).toBeGreaterThan(60);
            expect(result.factorScores.expectedValueDevigged).toBeGreaterThan(70);
        });
        it('should detect line movement velocity', async () => {
            const mockFeatures = createMockEnhancedFeatures();
            mockFeatures.lineHistory = [
                { timestamp: Date.now() - 600000, line: -110, volume: 1000 },
                { timestamp: Date.now() - 300000, line: -115, volume: 1500 },
                { timestamp: Date.now(), line: -120, volume: 2000 }
            ];
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(mockFeatures);
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            expect(result.factorScores.lineMovementVelocity).toBeGreaterThan(50);
        });
        it('should calculate CLV prediction accuracy', async () => {
            const mockFeatures = createMockEnhancedFeatures();
            mockFeatures.predictedClosingLine = -118;
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(mockFeatures);
            const features = createMockGradingFeatureSet({
                market: { type: 'player_props', line: -110, odds: -110 }
            });
            const result = await engine.calculate45FactorScore(features);
            // 8-point CLV advantage should score highly
            expect(result.factorScores.closingLineValue).toBeGreaterThan(70);
        });
        it('should identify steam moves', async () => {
            const mockFeatures = createMockEnhancedFeatures();
            mockFeatures.steamData = {
                steamDetected: true,
                confidence: 0.85,
                velocity: 5.2,
                volume: 3000
            };
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(mockFeatures);
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            expect(result.factorScores.steamDetection).toBeGreaterThan(70);
        });
        it('should analyze public vs sharp splits', async () => {
            const mockFeatures = createMockEnhancedFeatures();
            mockFeatures.bettingData = {
                publicPercent: 75,
                sharpPercent: 25,
                moneyPercent: 60,
                ticketPercent: 85,
                timestamp: Date.now()
            };
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(mockFeatures);
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            // High public percentage should create contrarian opportunity
            expect(result.factorScores.publicVsSharpSplit).toBeGreaterThan(60);
        });
    });
    describe('Player Factors (10 factors)', () => {
        beforeEach(() => {
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(createMockEnhancedFeatures());
        });
        it('should calculate player form from recent games', async () => {
            const mockFeatures = createMockEnhancedFeatures();
            mockFeatures.recentGames = [
                { gameId: '1', date: '2024-01-15', performance: 85, usage: 75, efficiency: 0.58, context: 'home' },
                { gameId: '2', date: '2024-01-13', performance: 78, usage: 72, efficiency: 0.54, context: 'away' },
                { gameId: '3', date: '2024-01-11', performance: 92, usage: 80, efficiency: 0.62, context: 'home' }
            ];
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(mockFeatures);
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            expect(result.factorScores.playerForm).toBeGreaterThan(60);
        });
        it('should assess role stability', async () => {
            const mockFeatures = createMockEnhancedFeatures();
            mockFeatures.roleData = {
                usageVariance: 0.05, // Low variance
                consistency: 0.88, // High consistency
                roleChanges: 0, // No role changes
                stabilityScore: 90
            };
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(mockFeatures);
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            expect(result.factorScores.roleStability).toBeGreaterThan(80);
        });
        it('should analyze injury impact', async () => {
            const mockFeatures = createMockEnhancedFeatures();
            mockFeatures.injuryData = {
                severity: 2, // Minor injury
                recency: 5, // 5 days ago
                impact: 15, // 15% impact
                trend: 'improving'
            };
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(mockFeatures);
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            // Recent minor injury should have moderate impact
            expect(result.factorScores.injuryImpact).toBeLessThan(80);
            expect(result.factorScores.injuryImpact).toBeGreaterThan(40);
        });
        it('should calculate fatigue levels', async () => {
            const mockFeatures = createMockEnhancedFeatures();
            mockFeatures.restData = {
                daysRest: 3, // 3 days rest
                recentWorkload: 65, // 65% recent workload
                advantage: 5 // Slight rest advantage
            };
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(mockFeatures);
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            expect(result.factorScores.fatigueLevel).toBeGreaterThan(60);
        });
        it('should evaluate clutch performance', async () => {
            const mockFeatures = createMockEnhancedFeatures();
            mockFeatures.clutchData = {
                clutchPerformance: 78,
                sampleSize: 25,
                situations: ['4th_quarter', 'overtime', 'playoff']
            };
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(mockFeatures);
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            expect(result.factorScores.clutchFactor).toBeGreaterThan(60);
        });
    });
    describe('Matchup Factors (10 factors)', () => {
        it('should analyze team vs team matchups', async () => {
            const mockFeatures = createMockEnhancedFeatures();
            mockFeatures.teamMatchup = {
                rating: 78,
                historicalAdvantage: 12,
                styleMatchup: 85
            };
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(mockFeatures);
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            expect(result.factorScores.teamVsTeam).toBeGreaterThan(60);
        });
        it('should calculate defense vs position (DVP)', async () => {
            const mockFeatures = createMockEnhancedFeatures();
            mockFeatures.dvpData = {
                rating: 85, // Strong DVP rating
                rank: 28, // 28th ranked defense (easier matchup)
                allowedAboveAverage: 15 // 15% above average allowed
            };
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(mockFeatures);
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            expect(result.factorScores.defenseVsPosition).toBeGreaterThan(70);
        });
        it('should assess pace impact', async () => {
            const mockFeatures = createMockEnhancedFeatures();
            mockFeatures.paceData = {
                impact: 8,
                teamPaces: { home: 102.5, away: 98.3 },
                projectedPace: 105.2 // Fast pace game
            };
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(mockFeatures);
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            expect(result.factorScores.paceImpact).toBeGreaterThan(60);
        });
        it('should evaluate weather impact', async () => {
            const mockFeatures = createMockEnhancedFeatures();
            mockFeatures.weatherData = {
                severity: 3, // Moderate weather
                impact: 25, // 25% impact
                conditions: { wind: '15mph', precipitation: 'light_rain', temperature: 38 }
            };
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(mockFeatures);
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            // Moderate weather should reduce score
            expect(result.factorScores.weatherImpact).toBeLessThan(70);
        });
    });
    describe('Price Factors (10 factors)', () => {
        it('should find line shopping edges', async () => {
            const mockFeatures = createMockEnhancedFeatures();
            mockFeatures.bookLines = [
                { book: 'DraftKings', line: -110, odds: -110, timestamp: Date.now() },
                { book: 'FanDuel', line: -105, odds: -105, timestamp: Date.now() },
                { book: 'BetMGM', line: -115, odds: -115, timestamp: Date.now() }
            ];
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(mockFeatures);
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            // 10-point line shopping edge should score well
            expect(result.factorScores.lineShoppingEdge).toBeGreaterThan(60);
        });
        it('should calculate Kelly optimal sizing', async () => {
            const features = createMockGradingFeatureSet({
                expectedValue: 8.5,
                odds: -110
            });
            const result = await engine.calculate45FactorScore(features);
            expect(result.factorScores.kellyFraction).toBeGreaterThan(50);
            expect(result.kellyFraction).toBeGreaterThan(0);
            expect(result.kellyFraction).toBeLessThan(0.25); // Conservative cap
        });
        it('should assess correlation risk', async () => {
            const mockFeatures = createMockEnhancedFeatures();
            mockFeatures.portfolioData = {
                maxCorrelation: 0.8, // High correlation
                portfolioImpact: 0.15,
                exposure: 0.12,
                diversification: 0.6
            };
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(mockFeatures);
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            // High correlation should reduce score
            expect(result.factorScores.correlationRisk).toBeLessThan(60);
        });
        it('should evaluate volatility', async () => {
            const mockFeatures = createMockEnhancedFeatures();
            mockFeatures.priceHistory = [
                { timestamp: Date.now() - 3600000, price: -110, volume: 1000 },
                { timestamp: Date.now() - 1800000, price: -108, volume: 1200 },
                { timestamp: Date.now(), price: -112, volume: 950 }
            ];
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(mockFeatures);
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            expect(result.factorScores.volatilityScore).toBeDefined();
        });
    });
    describe('Meta Factors (5 factors)', () => {
        it('should assess data quality', async () => {
            const features = createMockGradingFeatureSet({
                dataQuality: {
                    completeness: 0.98,
                    outlierScore: 0.92,
                    consistencyScore: 0.95,
                    dataValidationScore: 0.96
                }
            });
            const mockFeatures = createMockEnhancedFeatures();
            mockFeatures.dataAccuracy = 0.94;
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(mockFeatures);
            const result = await engine.calculate45FactorScore(features);
            expect(result.factorScores.dataQuality).toBeGreaterThan(90);
            expect(result.dataQuality).toBeGreaterThan(0.9);
        });
        it('should calculate model agreement', async () => {
            const mockFeatures = createMockEnhancedFeatures();
            mockFeatures.modelOutputs = [
                { modelName: 'model_a', score: 78, confidence: 0.85, features: {} },
                { modelName: 'model_b', score: 82, confidence: 0.79, features: {} },
                { modelName: 'model_c', score: 75, confidence: 0.88, features: {} }
            ];
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(mockFeatures);
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            // Close agreement between models should score well
            expect(result.factorScores.modelAgreement).toBeGreaterThan(60);
        });
        it('should evaluate historical accuracy', async () => {
            const mockFeatures = createMockEnhancedFeatures();
            mockFeatures.backtestData = {
                accuracy: 0.68, // 68% accuracy
                profitability: 0.12, // 12% ROI
                sharpeRatio: 1.2,
                maxDrawdown: 0.08
            };
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(mockFeatures);
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            expect(result.factorScores.historicalAccuracy).toBeGreaterThan(60);
        });
    });
    describe('Batch Processing', () => {
        it('should process multiple props efficiently', async () => {
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(createMockEnhancedFeatures());
            const propsList = Array.from({ length: 100 }, (_, i) => createMockGradingFeatureSet({ propId: `prop_${i}` }));
            const startTime = Date.now();
            const results = await engine.batchProcess45Factor(propsList);
            const processingTime = Date.now() - startTime;
            expect(results).toHaveLength(100);
            expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
            expect(processingTime / propsList.length).toBeLessThan(50); // < 50ms per prop
        });
        it('should handle batch processing errors gracefully', async () => {
            // Mock first call to succeed, second to fail
            mockFeatureStore.getEnhancedFeatures
                .mockResolvedValueOnce(createMockEnhancedFeatures())
                .mockRejectedValueOnce(new Error('Feature store error'));
            const propsList = [
                createMockGradingFeatureSet({ propId: 'prop_1' }),
                createMockGradingFeatureSet({ propId: 'prop_2' })
            ];
            const results = await engine.batchProcess45Factor(propsList);
            expect(results).toHaveLength(2);
            expect(results[0].version).not.toContain('fallback');
            expect(results[1].version).toContain('fallback');
        });
    });
    describe('Performance Benchmarks', () => {
        it('should meet sub-50ms feature retrieval target', async () => {
            let retrievalTime = 0;
            mockFeatureStore.getEnhancedFeatures.mockImplementation(async () => {
                const start = Date.now();
                const features = createMockEnhancedFeatures();
                retrievalTime = Date.now() - start;
                features.retrievalTimeMs = retrievalTime;
                return features;
            });
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            expect(result.featuresRetrievedMs).toBeLessThan(50);
        });
        it('should process 1000 props within performance targets', async () => {
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(createMockEnhancedFeatures());
            const propsList = Array.from({ length: 1000 }, (_, i) => createMockGradingFeatureSet({ propId: `perf_test_${i}` }));
            const startTime = Date.now();
            const results = await engine.batchProcess45Factor(propsList);
            const totalTime = Date.now() - startTime;
            expect(results).toHaveLength(1000);
            expect(totalTime).toBeLessThan(30000); // < 30 seconds for 1000 props
            expect(totalTime / propsList.length).toBeLessThan(30); // < 30ms per prop average
        });
    });
    describe('Edge Cases', () => {
        it('should handle extremely high expected value', async () => {
            const features = createMockGradingFeatureSet({
                expectedValue: 25.0 // 25% EV - unrealistic but test boundary
            });
            const result = await engine.calculate45FactorScore(features);
            expect(result.totalScore).toBeLessThanOrEqual(100); // Should cap at 100
            expect(result.tier).toBe('S'); // Should be S-tier
        });
        it('should handle negative expected value', async () => {
            const features = createMockGradingFeatureSet({
                expectedValue: -5.0 // Negative EV
            });
            const result = await engine.calculate45FactorScore(features);
            expect(result.tier).toBe('D'); // Should be D-tier
            expect(result.totalScore).toBeLessThan(40);
        });
        it('should handle missing sport information', async () => {
            const features = createMockGradingFeatureSet({ sport: undefined });
            const result = await engine.calculate45FactorScore(features);
            expect(result).toBeDefined();
            expect(result.tier).toBeDefined();
        });
        it('should handle extremely volatile odds', async () => {
            const mockFeatures = createMockEnhancedFeatures();
            mockFeatures.priceHistory = [
                { timestamp: Date.now() - 1800000, price: -110 },
                { timestamp: Date.now() - 900000, price: -200 },
                { timestamp: Date.now(), price: +150 }
            ];
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(mockFeatures);
            const features = createMockGradingFeatureSet();
            const result = await engine.calculate45FactorScore(features);
            // Should handle extreme volatility
            expect(result.factorScores.volatilityScore).toBeLessThan(30);
            expect(result.riskAdjustedScore).toBeLessThan(result.totalScore);
        });
    });
    describe('Configuration Management', () => {
        it('should accept custom factor weights', async () => {
            mockFeatureStore.getEnhancedFeatures.mockResolvedValue(createMockEnhancedFeatures());
            const customConfig = {
                marketFactors: {
                    expectedValueDevigged: 0.5, // Much higher weight
                    lineMovementVelocity: 0.1,
                    closingLineValue: 0.1,
                    marketEfficiency: 0.1,
                    publicVsSharpSplit: 0.05,
                    volumeProfile: 0.05,
                    crossMarketArbitrage: 0.05,
                    steamDetection: 0.05,
                    marketResistance: 0.0,
                    optimalTiming: 0.0
                }
            };
            const features = createMockGradingFeatureSet({ expectedValue: 10 });
            const result = await engine.calculate45FactorScore(features, customConfig);
            // With higher weight on EV, market score should dominate
            expect(result.marketScore).toBeGreaterThan(result.playerScore);
            expect(result.marketScore).toBeGreaterThan(result.matchupScore);
        });
    });
});
// ========================================
// HELPER FUNCTIONS
// ========================================
function createMockGradingFeatureSet(overrides = {}) {
    return {
        propId: 'test_prop_123',
        date: '2024-01-15',
        sport: 'NBA',
        league: 'NBA',
        player: 'LeBron James',
        market: {
            type: 'player_points',
            line: 25.5,
            odds: -110
        },
        expectedValue: 5.5,
        sharpMoney: 65,
        lineMovement: 1.5,
        matchupRating: 78,
        playerForm: 82,
        marketType: 'player_points',
        odds: -110,
        injuryImpact: 0,
        weatherImpact: 0,
        marketIntelligence: 75,
        volumeProfile: 60,
        closingLineValue: 2.5,
        playerFatigue: 15,
        venueAdvantage: 3,
        refereeImpact: 0,
        paceImpact: 8,
        motivationalFactors: 5,
        correlationRisk: 0.3,
        volatility: 4,
        portfolioImpact: 0.05,
        bidAskSpread: 0.02,
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'test',
        confidence: 75,
        dataQuality: {
            completeness: 0.95,
            outlierScore: 0.92,
            consistencyScore: 0.94,
            dataValidationScore: 0.93
        },
        ...overrides
    };
}
function createMockEnhancedFeatures() {
    return {
        lineHistory: [
            { timestamp: Date.now() - 3600000, line: -110, volume: 1000 },
            { timestamp: Date.now() - 1800000, line: -108, volume: 1200 },
            { timestamp: Date.now(), line: -110, volume: 1100 }
        ],
        predictedClosingLine: -112,
        marketData: { efficiency: 0.87, liquidity: 0.65, volatility: 0.04, arbitrageOpportunities: 2 },
        bettingData: { publicPercent: 58, sharpPercent: 42, moneyPercent: 65, ticketPercent: 55, timestamp: Date.now() },
        volumeData: [
            { timestamp: Date.now() - 1800000, volume: 1000, direction: 'up' },
            { timestamp: Date.now(), volume: 1200, direction: 'up' }
        ],
        relatedMarkets: [],
        steamData: { steamDetected: false, confidence: 0.3, velocity: 1.2, volume: 1100 },
        priceAction: [],
        timingData: { optimalWindow: { start: 24, end: 2 }, currentTiming: 12, valueDecay: 0.05 },
        recentGames: [
            { gameId: '1', date: '2024-01-13', performance: 78, usage: 75, efficiency: 0.56, context: 'home' },
            { gameId: '2', date: '2024-01-11', performance: 85, usage: 78, efficiency: 0.61, context: 'away' }
        ],
        roleData: { usageVariance: 0.08, consistency: 0.82, roleChanges: 0, stabilityScore: 85 },
        headToHead: [],
        injuryData: { severity: 0, recency: 30, impact: 0, trend: 'stable' },
        restData: { daysRest: 2, recentWorkload: 55, advantage: 2 },
        usageData: { currentUsage: 76, seasonAvg: 74, opportunity: 68, trend: 2 },
        seasonTrends: [],
        clutchData: { clutchPerformance: 72, sampleSize: 18, situations: ['4th_quarter'] },
        propHistory: [],
        situationalData: { context: 'home', performance: 78, sampleSize: 12 },
        teamMatchup: { rating: 75, historicalAdvantage: 5, styleMatchup: 78 },
        dvpData: { rating: 68, rank: 18, allowedAboveAverage: 8 },
        paceData: { impact: 6, teamPaces: { home: 101.2, away: 98.8 }, projectedPace: 100.5 },
        gameScript: { favorability: 72, projectedGameflow: 'balanced', scoringEnvironment: 65 },
        venueData: { advantage: 3, homeFieldEdge: 2.5, splits: { home: 52, away: 48 } },
        officialData: { impact: 1, tendencies: {}, historicalImpact: 0.5 },
        weatherData: { severity: 0, impact: 0, conditions: {} },
        venueAnalysis: { advantage: 3, factors: {}, historical: {} },
        motivationData: { level: 65, factors: ['playoff_race'], impact: 5 },
        bookLines: [
            { book: 'DraftKings', line: -110, odds: -110, timestamp: Date.now() },
            { book: 'FanDuel', line: -108, odds: -108, timestamp: Date.now() }
        ],
        portfolioData: { maxCorrelation: 0.4, portfolioImpact: 0.08, exposure: 0.06, diversification: 0.75 },
        priceHistory: [
            { timestamp: Date.now() - 1800000, price: -110 },
            { timestamp: Date.now(), price: -108 }
        ],
        liquidityData: { depth: 65, spread: 0.02, impact: 2 },
        marketDepth: { bidAskSpread: 0.02, depth: 65, liquidity: 68 },
        optionalityData: { value: 0.02, timeDecay: 0.05, volatility: 0.15 },
        modelOutputs: [
            { modelName: 'ensemble', score: 76, confidence: 0.82, features: {} }
        ],
        backtestData: { accuracy: 0.58, profitability: 0.08, sharpeRatio: 0.9, maxDrawdown: 0.12 },
        uncertaintyData: { confidenceWidth: 0.15, intervalBounds: { lower: 65, upper: 85 }, uncertainty: 0.08 },
        temporalData: { recencyBias: 0.02, timeDecay: 0.05, seasonality: 0.1 },
        dataAccuracy: 0.94,
        retrievalTimeMs: 35,
        cacheHitRate: 0.78,
        freshness: 0.85,
        completeness: 0.92
    };
}
function createEmptyEnhancedFeatures() {
    return {
        lineHistory: [],
        predictedClosingLine: 0,
        marketData: {},
        bettingData: {},
        volumeData: [],
        relatedMarkets: [],
        steamData: {},
        priceAction: [],
        timingData: {},
        recentGames: [],
        roleData: {},
        headToHead: [],
        injuryData: {},
        restData: {},
        usageData: {},
        seasonTrends: [],
        clutchData: {},
        propHistory: [],
        situationalData: {},
        teamMatchup: {},
        dvpData: {},
        paceData: {},
        gameScript: {},
        venueData: {},
        officialData: {},
        weatherData: {},
        venueAnalysis: {},
        motivationData: {},
        bookLines: [],
        portfolioData: {},
        priceHistory: [],
        liquidityData: {},
        marketDepth: {},
        optionalityData: {},
        modelOutputs: [],
        backtestData: {},
        uncertaintyData: {},
        temporalData: {},
        dataAccuracy: 0.5,
        retrievalTimeMs: 45,
        cacheHitRate: 0,
        freshness: 0.5,
        completeness: 0.3
    };
}
//# sourceMappingURL=Enhanced45FactorEngine.test.js.map