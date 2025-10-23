"use strict";
/**
 * Test Data Generator for Syndicate-Grade Testing
 *
 * Generates realistic test data for comprehensive testing scenarios:
 * - Realistic prop submissions with proper market distribution
 * - Market data updates with temporal patterns
 * - User picks with statistical accuracy
 * - Complex scenarios for failure testing
 * - High-volume data streams for performance testing
 *
 * Data Generation Principles:
 * - Realistic market distributions and correlations
 * - Temporal patterns matching real betting markets
 * - Proper statistical distributions for odds and lines
 * - Edge cases and boundary conditions
 * - Reproducible data for consistent testing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestDataGenerator = void 0;
const crypto_1 = require("crypto");
class TestDataGenerator {
    constructor(config = {}) {
        // Realistic data constants
        this.SPORTS = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'EPL', 'UEFA', 'UFC', 'Tennis'];
        this.MARKETS = ['player_props', 'game_props', 'team_props', 'futures', 'live_betting'];
        this.BOOKS = ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'PointsBet', 'Barstool', 'WynnBET'];
        this.STAT_TYPES = [
            'rushing_yards', 'receiving_yards', 'passing_yards', 'touchdowns',
            'points', 'assists', 'rebounds', 'steals', 'blocks',
            'hits', 'home_runs', 'rbis', 'stolen_bases',
            'goals', 'saves', 'shots_on_goal', 'assists'
        ];
        this.config = {
            realismLevel: 'realistic',
            temporalPatterns: true,
            sportDistribution: {
                'NFL': 0.25, 'NBA': 0.20, 'MLB': 0.15, 'NHL': 0.10,
                'NCAAF': 0.10, 'NCAAB': 0.08, 'EPL': 0.07, 'UFC': 0.03, 'Tennis': 0.02
            },
            marketDistribution: {
                'player_props': 0.45, 'game_props': 0.25, 'team_props': 0.15,
                'futures': 0.10, 'live_betting': 0.05
            },
            ...config
        };
        // Initialize pseudo-random generator for reproducible tests
        if (config.randomSeed) {
            let seed = config.randomSeed;
            this.random = () => {
                seed = (seed * 9301 + 49297) % 233280;
                return seed / 233280;
            };
        }
        else {
            this.random = Math.random;
        }
        this.sportDistribution = this.config.sportDistribution;
        this.marketDistribution = this.config.marketDistribution;
        this.bookDistribution = {
            'DraftKings': 0.22, 'FanDuel': 0.20, 'BetMGM': 0.15, 'Caesars': 0.12,
            'PointsBet': 0.10, 'Barstool': 0.08, 'WynnBET': 0.08, 'Others': 0.05
        };
    }
    /**
     * Generate realistic props for performance testing
     */
    generateRealisticProps(count, options = {}) {
        const props = [];
        for (let i = 0; i < count; i++) {
            const sport = this.selectFromDistribution(this.sportDistribution);
            const market = this.selectFromDistribution(this.marketDistribution);
            const book = this.selectFromDistribution(this.bookDistribution);
            const statType = this.selectRandomFromArray(this.getStatTypesForSport(sport));
            const prop = {
                id: `${options.prefix || 'test-prop'}-${i}-${(0, crypto_1.randomUUID)()}`,
                sport,
                market,
                book,
                stat_type: statType,
                player_name: this.generatePlayerName(sport),
                team: this.generateTeamName(sport),
                opponent: this.generateTeamName(sport),
                game_time: this.generateGameTime(sport, options.timeDistribution),
                line: this.generateRealisticLine(statType, sport),
                over_odds: this.generateRealisticOdds('over'),
                under_odds: this.generateRealisticOdds('under'),
                created_at: new Date().toISOString(),
                // Professional features metadata
                steam_potential: this.random() * 10,
                volume_indicator: this.random() * 100,
                market_efficiency: this.random(),
                historical_performance: this.random(),
                // Market context
                opening_line: 0, // Will be calculated
                line_movement: this.generateLineMovement(),
                market_size: this.generateMarketSize(sport, market),
                competition_level: this.generateCompetitionLevel(sport)
            };
            // Calculate opening line with realistic movement
            prop.opening_line = prop.line - prop.line_movement;
            // Add complexity for professional testing
            if (options.complexityMix === 'professional') {
                prop.professional_metadata = this.generateProfessionalMetadata(prop);
            }
            props.push(prop);
        }
        return props;
    }
    /**
     * Generate realistic pick submission for integration testing
     */
    generateRealisticPickSubmission(config) {
        const sport = config.sport || this.selectFromDistribution(this.sportDistribution);
        const pickType = config.pickType || this.selectFromDistribution(this.marketDistribution);
        const book = this.selectFromDistribution(this.bookDistribution);
        const submission = {
            id: config.submissionId || (0, crypto_1.randomUUID)(),
            user_id: config.userId || 'test-user',
            submission_type: 'smart_form',
            // Pick details
            pick_type: pickType,
            sport,
            book,
            player_name: this.generatePlayerName(sport),
            stat_type: this.selectRandomFromArray(this.getStatTypesForSport(sport)),
            line: this.generateRealisticLine(pickType, sport),
            pick_side: this.random() > 0.5 ? 'over' : 'under',
            odds: this.generateRealisticOdds(this.random() > 0.5 ? 'over' : 'under'),
            // Game context
            game_time: this.generateGameTime(sport),
            team: this.generateTeamName(sport),
            opponent: this.generateTeamName(sport),
            // User context
            confidence: config.confidence || this.selectRandomFromArray(['low', 'medium', 'high']),
            reasoning: this.generatePickReasoning(config.confidence),
            // Professional features configuration
            professional_features: config.professionalFeatures || {
                steamDetection: true,
                clvTracking: true,
                timingAnalysis: true,
                volumeAnalysis: true,
                movementTracking: true,
                bookmakerAnalysis: true,
                marketEfficiency: true,
                advancedMetrics: true
            },
            // Metadata
            submitted_at: new Date().toISOString(),
            ip_address: this.generateIPAddress(),
            user_agent: 'TestDataGenerator/1.0',
            // Edge cases and biases
            ...(config.includeBias && this.generateBiasFactors()),
            ...(config.includeEdgeCases && this.generateEdgeCaseFactors())
        };
        return submission;
    }
    /**
     * Generate market data update for real-time testing
     */
    generateMarketDataUpdate(config = {}) {
        const sport = config.sport || this.selectFromDistribution(this.sportDistribution);
        const updateType = config.updateType || this.selectRandomFromArray([
            'odds_change', 'line_movement', 'volume_update', 'injury_news', 'weather_update'
        ]);
        const update = {
            id: `market-update-${(0, crypto_1.randomUUID)()}`,
            type: updateType,
            sport,
            timestamp: Date.now(),
            // Market identifiers
            prop_id: `prop-${(0, crypto_1.randomUUID)()}`,
            book: this.selectFromDistribution(this.bookDistribution),
            market: this.selectFromDistribution(this.marketDistribution),
            // Update data
            previous_value: this.generateMarketValue(updateType),
            new_value: this.generateMarketValue(updateType),
            change_magnitude: this.generateChangeMagnitude(config.significance),
            // Context
            volume_change: this.generateVolumeChange(),
            market_sentiment: this.generateMarketSentiment(),
            impact_score: this.generateImpactScore(config.significance),
            // Correlations
            ...(config.includeCorrelations && {
                correlated_updates: this.generateCorrelatedUpdates(sport, updateType)
            }),
            // Professional insights
            professional_metadata: {
                steam_indicator: this.random() * 10,
                sharp_money_indicator: this.random(),
                public_money_percentage: this.random(),
                market_efficiency_score: this.random(),
                volatility_index: this.random() * 100
            }
        };
        return update;
    }
    /**
     * Generate continuous props stream for load testing
     */
    createContinuousLoadStream(propsPerSecond, durationMs) {
        return new Promise((resolve) => {
            const interval = 1000 / propsPerSecond;
            let count = 0;
            const maxCount = Math.floor((durationMs / 1000) * propsPerSecond);
            const streamInterval = setInterval(() => {
                if (count >= maxCount) {
                    clearInterval(streamInterval);
                    resolve();
                    return;
                }
                // Generate and emit prop
                const prop = this.generateRealisticProps(1, {
                    prefix: 'load-stream',
                    timeDistribution: 'realistic'
                })[0];
                // Emit to processing pipeline (would be implemented by caller)
                this.emitPropToStream(prop);
                count++;
            }, interval);
        });
    }
    /**
     * Generate complex pick for grading validation
     */
    generateComplexPickForGrading(options = {}) {
        const sport = options.sport || 'NFL';
        const market = options.market || 'player_props';
        const complexPick = {
            id: `complex-pick-${(0, crypto_1.randomUUID)()}`,
            sport,
            market,
            complexity: options.complexity || 'high',
            // Core pick data
            player_name: this.generatePlayerName(sport),
            stat_type: this.selectRandomFromArray(this.getStatTypesForSport(sport)),
            line: this.generateRealisticLine(market, sport),
            odds: this.generateRealisticOdds('over'),
            book: this.selectFromDistribution(this.bookDistribution),
            // Historical context (if requested)
            ...(options.historicalData && {
                historical_performance: this.generateHistoricalPerformance(sport),
                seasonal_trends: this.generateSeasonalTrends(sport),
                head_to_head_stats: this.generateHeadToHeadStats()
            }),
            // Market context (if requested)
            ...(options.marketContext && {
                market_dynamics: this.generateMarketDynamics(),
                competitive_landscape: this.generateCompetitiveLandscape(),
                public_sentiment: this.generatePublicSentiment()
            }),
            // Professional grading inputs
            professional_inputs: {
                steam_data: this.generateSteamData(),
                clv_context: this.generateCLVContext(),
                timing_factors: this.generateTimingFactors(),
                volume_patterns: this.generateVolumePatterns(),
                movement_history: this.generateMovementHistory(),
                bookmaker_patterns: this.generateBookmakerPatterns(),
                efficiency_metrics: this.generateEfficiencyMetrics(),
                advanced_indicators: this.generateAdvancedIndicators()
            },
            created_at: new Date().toISOString()
        };
        return complexPick;
    }
    /**
     * Generate picks for failure testing scenarios
     */
    generatePicksForFailureTesting(count) {
        const picks = [];
        for (let i = 0; i < count; i++) {
            const pick = {
                id: `failure-test-pick-${i}-${(0, crypto_1.randomUUID)()}`,
                sport: this.selectFromDistribution(this.sportDistribution),
                market: this.selectFromDistribution(this.marketDistribution),
                // Add failure scenarios
                failure_scenarios: this.generateFailureScenarios(i),
                // Standard pick data
                ...this.generateStandardPickData(),
                // Test metadata
                test_index: i,
                failure_probability: this.calculateFailureProbability(i),
                recovery_expectations: this.generateRecoveryExpectations(i)
            };
            picks.push(pick);
        }
        return picks;
    }
    /**
     * Generate user pick for activity simulation
     */
    generateUserPick() {
        return {
            id: `user-pick-${(0, crypto_1.randomUUID)()}`,
            user_id: `user-${Math.floor(this.random() * 1000)}`,
            sport: this.selectFromDistribution(this.sportDistribution),
            market: this.selectFromDistribution(this.marketDistribution),
            // Pick details
            player_name: this.generatePlayerName(),
            stat_type: this.selectRandomFromArray(this.STAT_TYPES),
            line: this.generateRealisticLine(),
            pick_side: this.random() > 0.5 ? 'over' : 'under',
            odds: this.generateRealisticOdds(),
            // User behavior
            confidence: this.selectRandomFromArray(['low', 'medium', 'high']),
            stake: this.generateStake(),
            created_at: new Date().toISOString()
        };
    }
    // Helper methods for data generation
    selectFromDistribution(distribution) {
        const rand = this.random();
        let cumulative = 0;
        for (const [key, probability] of Object.entries(distribution)) {
            cumulative += probability;
            if (rand <= cumulative) {
                return key;
            }
        }
        return Object.keys(distribution)[0]; // Fallback
    }
    selectRandomFromArray(array) {
        return array[Math.floor(this.random() * array.length)];
    }
    getStatTypesForSport(sport) {
        const sportStatTypes = {
            'NFL': ['rushing_yards', 'receiving_yards', 'passing_yards', 'touchdowns'],
            'NBA': ['points', 'assists', 'rebounds', 'steals', 'blocks'],
            'MLB': ['hits', 'home_runs', 'rbis', 'stolen_bases'],
            'NHL': ['goals', 'saves', 'shots_on_goal', 'assists'],
            'EPL': ['goals', 'assists', 'shots_on_target', 'tackles']
        };
        return sportStatTypes[sport] || this.STAT_TYPES;
    }
    generatePlayerName(sport) {
        const firstNames = ['John', 'Mike', 'Chris', 'David', 'James', 'Robert', 'William', 'Richard'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
        const firstName = this.selectRandomFromArray(firstNames);
        const lastName = this.selectRandomFromArray(lastNames);
        return `${firstName} ${lastName}`;
    }
    generateTeamName(sport) {
        const teams = {
            'NFL': ['Patriots', 'Cowboys', 'Packers', 'Steelers', 'Chiefs', 'Ravens', 'Bills', '49ers'],
            'NBA': ['Lakers', 'Warriors', 'Celtics', 'Heat', 'Bucks', 'Nets', 'Suns', 'Nuggets'],
            'MLB': ['Yankees', 'Dodgers', 'Red Sox', 'Giants', 'Cardinals', 'Cubs', 'Astros', 'Braves'],
            'NHL': ['Bruins', 'Rangers', 'Kings', 'Blackhawks', 'Penguins', 'Capitals', 'Lightning', 'Avalanche']
        };
        const teamList = teams[sport || 'NFL'] || teams['NFL'];
        return this.selectRandomFromArray(teamList);
    }
    generateGameTime(sport, distribution) {
        const now = new Date();
        let gameTime;
        if (distribution === 'peak_hours') {
            // Generate times during peak betting hours
            const peakHours = [13, 16, 20, 21]; // 1pm, 4pm, 8pm, 9pm
            const hour = this.selectRandomFromArray(peakHours);
            gameTime = new Date(now.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000); // Next 7 days
            gameTime.setHours(hour, 0, 0, 0);
        }
        else {
            // Random time in next 48 hours
            gameTime = new Date(now.getTime() + this.random() * 48 * 60 * 60 * 1000);
        }
        return gameTime;
    }
    generateRealisticLine(statType, sport) {
        const lineRanges = {
            'rushing_yards': [40, 120],
            'receiving_yards': [30, 100],
            'passing_yards': [200, 350],
            'touchdowns': [0.5, 2.5],
            'points': [15, 35],
            'assists': [4, 12],
            'rebounds': [6, 15],
            'hits': [0.5, 2.5],
            'home_runs': [0.5, 1.5],
            'goals': [0.5, 2.5]
        };
        const [min, max] = lineRanges[statType || 'points'] || [10, 50];
        const line = min + this.random() * (max - min);
        // Round to appropriate precision
        if (line < 5) {
            return Math.round(line * 2) / 2; // Round to 0.5
        }
        else {
            return Math.round(line);
        }
    }
    generateRealisticOdds(side) {
        // Generate realistic American odds
        const baseOdds = -110; // Standard vig
        const variation = Math.floor(this.random() * 40) - 20; // ±20 variation
        return baseOdds + variation;
    }
    generateLineMovement() {
        // Generate realistic line movement (-5 to +5 units)
        return (this.random() - 0.5) * 10;
    }
    generateMarketSize(sport, market) {
        const sizes = ['small', 'medium', 'large', 'massive'];
        const weights = [0.1, 0.3, 0.4, 0.2]; // Most markets are medium/large
        return this.selectFromDistribution(Object.fromEntries(sizes.map((size, i) => [size, weights[i]])));
    }
    generateCompetitionLevel(sport) {
        const levels = ['recreational', 'semi-pro', 'professional', 'elite'];
        const weights = [0.2, 0.3, 0.4, 0.1];
        return this.selectFromDistribution(Object.fromEntries(levels.map((level, i) => [level, weights[i]])));
    }
    generateProfessionalMetadata(prop) {
        return {
            sharp_money_indicator: this.random(),
            public_money_percentage: this.random(),
            market_efficiency_score: this.random(),
            volatility_index: this.random() * 100,
            correlation_factors: this.generateCorrelationFactors(),
            risk_assessment: this.generateRiskAssessment()
        };
    }
    generatePickReasoning(confidence) {
        const reasons = [
            'Strong historical performance in similar matchups',
            'Favorable weather conditions expected',
            'Key player injury to opponent',
            'Team motivation factors',
            'Statistical edge identified',
            'Market overreaction to recent news',
            'Sharp money movement detected',
            'Public betting creating value'
        ];
        return this.selectRandomFromArray(reasons);
    }
    generateBiasFactors() {
        return {
            recency_bias: this.random(),
            availability_bias: this.random(),
            confirmation_bias: this.random(),
            overconfidence_bias: this.random()
        };
    }
    generateEdgeCaseFactors() {
        return {
            extreme_weather: this.random() > 0.9,
            last_minute_injury: this.random() > 0.95,
            referee_assignment: this.random() > 0.8,
            venue_change: this.random() > 0.99
        };
    }
    generateMarketValue(updateType) {
        const valueRanges = {
            'odds_change': [-150, +150],
            'line_movement': [-5, +5],
            'volume_update': [0, 1000000],
            'injury_news': [0, 10],
            'weather_update': [0, 100]
        };
        const [min, max] = valueRanges[updateType] || [0, 100];
        return min + this.random() * (max - min);
    }
    generateChangeMagnitude(significance) {
        const magnitudeMap = {
            'low': 0.1 + this.random() * 0.2,
            'normal': 0.2 + this.random() * 0.4,
            'high': 0.5 + this.random() * 0.5
        };
        return magnitudeMap[significance || 'normal'];
    }
    generateVolumeChange() {
        return (this.random() - 0.5) * 200; // ±100% change
    }
    generateMarketSentiment() {
        const sentiments = ['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish'];
        return this.selectRandomFromArray(sentiments);
    }
    generateImpactScore(significance) {
        const baseScore = significance === 'high' ? 7 : significance === 'normal' ? 4 : 2;
        return baseScore + this.random() * 3;
    }
    generateCorrelatedUpdates(sport, updateType) {
        // Generate 0-3 correlated updates
        const count = Math.floor(this.random() * 4);
        const updates = [];
        for (let i = 0; i < count; i++) {
            updates.push({
                prop_id: `correlated-${(0, crypto_1.randomUUID)()}`,
                sport,
                correlation_strength: this.random(),
                correlation_type: this.selectRandomFromArray(['positive', 'negative', 'inverse'])
            });
        }
        return updates;
    }
    generateHistoricalPerformance(sport) {
        return {
            last_5_games: Array.from({ length: 5 }, () => this.random() * 100),
            season_average: 20 + this.random() * 30,
            career_average: 18 + this.random() * 25,
            vs_opponent: 15 + this.random() * 35
        };
    }
    generateSeasonalTrends(sport) {
        return {
            early_season: this.random(),
            mid_season: this.random(),
            late_season: this.random(),
            playoff_performance: this.random()
        };
    }
    generateHeadToHeadStats() {
        return {
            wins: Math.floor(this.random() * 10),
            losses: Math.floor(this.random() * 10),
            avg_performance: this.random() * 50,
            last_meeting: new Date(Date.now() - this.random() * 365 * 24 * 60 * 60 * 1000)
        };
    }
    generateMarketDynamics() {
        return {
            liquidity_level: this.random(),
            bid_ask_spread: this.random() * 10,
            market_depth: this.random() * 1000,
            price_discovery_efficiency: this.random()
        };
    }
    generateCompetitiveLandscape() {
        return {
            book_count: Math.floor(this.random() * 10) + 3,
            price_variance: this.random() * 20,
            market_leader: this.selectFromDistribution(this.bookDistribution),
            arbitrage_opportunities: this.random() > 0.8
        };
    }
    generatePublicSentiment() {
        return {
            sentiment_score: this.random() * 2 - 1, // -1 to +1
            volume_indicator: this.random(),
            social_media_buzz: this.random(),
            expert_consensus: this.random()
        };
    }
    generateSteamData() {
        return {
            steam_score: this.random() * 10,
            sharp_indicator: this.random(),
            reverse_line_movement: this.random() > 0.8,
            volume_spike: this.random() * 200
        };
    }
    generateCLVContext() {
        return {
            opening_line: this.generateRealisticLine(),
            current_line: this.generateRealisticLine(),
            projected_closing: this.generateRealisticLine(),
            clv_potential: this.random() * 10 - 5
        };
    }
    generateTimingFactors() {
        return {
            time_to_game: this.random() * 168, // Hours
            optimal_bet_time: this.random() * 24,
            news_cycle_position: this.random(),
            market_maturity: this.random()
        };
    }
    generateVolumePatterns() {
        return {
            current_volume: this.random() * 100000,
            average_volume: this.random() * 80000,
            volume_trend: this.selectRandomFromArray(['increasing', 'decreasing', 'stable']),
            sharp_volume_percentage: this.random() * 30
        };
    }
    generateMovementHistory() {
        const history = [];
        let currentLine = this.generateRealisticLine();
        for (let i = 0; i < 24; i++) { // 24 hours of movement
            const change = (this.random() - 0.5) * 2; // ±1 unit change
            currentLine += change;
            history.push({
                timestamp: Date.now() - (24 - i) * 60 * 60 * 1000,
                line: currentLine,
                volume: this.random() * 10000,
                direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
            });
        }
        return history;
    }
    generateBookmakerPatterns() {
        return {
            lead_book: this.selectFromDistribution(this.bookDistribution),
            follower_books: this.selectRandomFromArray(Object.keys(this.bookDistribution)).slice(0, 3),
            price_leadership: this.random(),
            response_time_avg: this.random() * 300 // seconds
        };
    }
    generateEfficiencyMetrics() {
        return {
            price_efficiency: this.random(),
            information_incorporation: this.random(),
            arbitrage_frequency: this.random() * 10,
            market_impact_score: this.random() * 100
        };
    }
    generateAdvancedIndicators() {
        return {
            fractal_dimension: this.random() * 2,
            hurst_exponent: this.random(),
            volatility_clustering: this.random(),
            mean_reversion_strength: this.random()
        };
    }
    generateFailureScenarios(index) {
        const allScenarios = [
            'network_timeout',
            'database_connection_failure',
            'steam_service_unavailable',
            'clv_calculation_error',
            'timing_analysis_timeout',
            'volume_data_corruption',
            'movement_tracking_failure',
            'bookmaker_api_rate_limit',
            'market_efficiency_timeout',
            'advanced_metrics_overflow'
        ];
        // Select 1-3 failure scenarios based on index
        const scenarioCount = (index % 3) + 1;
        const scenarios = [];
        for (let i = 0; i < scenarioCount; i++) {
            const scenario = allScenarios[(index + i) % allScenarios.length];
            scenarios.push(scenario);
        }
        return scenarios;
    }
    generateStandardPickData() {
        return {
            sport: this.selectFromDistribution(this.sportDistribution),
            market: this.selectFromDistribution(this.marketDistribution),
            book: this.selectFromDistribution(this.bookDistribution),
            player_name: this.generatePlayerName(),
            stat_type: this.selectRandomFromArray(this.STAT_TYPES),
            line: this.generateRealisticLine(),
            odds: this.generateRealisticOdds()
        };
    }
    calculateFailureProbability(index) {
        // Vary failure probability based on test index
        return 0.1 + (index % 10) * 0.05; // 10% to 55% failure probability
    }
    generateRecoveryExpectations(index) {
        return {
            max_retry_attempts: 3 + (index % 3),
            expected_fallbacks: Math.floor(this.random() * 3),
            recovery_time_threshold: 5000 + this.random() * 10000
        };
    }
    generateCorrelationFactors() {
        return {
            player_correlations: this.random(),
            game_correlations: this.random(),
            weather_correlations: this.random(),
            market_correlations: this.random()
        };
    }
    generateRiskAssessment() {
        return {
            volatility_risk: this.random(),
            liquidity_risk: this.random(),
            counterparty_risk: this.random(),
            regulatory_risk: this.random()
        };
    }
    generateIPAddress() {
        return `${Math.floor(this.random() * 255)}.${Math.floor(this.random() * 255)}.${Math.floor(this.random() * 255)}.${Math.floor(this.random() * 255)}`;
    }
    generateStake() {
        // Generate stake between $10 and $1000
        return 10 + this.random() * 990;
    }
    emitPropToStream(prop) {
        // This would be implemented by the caller to handle streaming
        // For now, just log or store in memory
        console.log(`Stream prop: ${prop.id}`);
    }
}
exports.TestDataGenerator = TestDataGenerator;
exports.default = TestDataGenerator;
