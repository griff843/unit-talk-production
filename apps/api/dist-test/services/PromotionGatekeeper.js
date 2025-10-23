"use strict";
/**
 * Promotion Gatekeeper Service
 * Manages pick promotion through Instant vs 10am lanes with comprehensive validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.promotionGatekeeper = void 0;
const logger_1 = require("../shared/logger");
const supabaseClient_1 = require("./supabaseClient");
const PublishGuard_1 = require("../promotion/PublishGuard");
class PromotionGatekeeper {
    constructor() {
        this.gates = new Map();
        // Default gate configurations
        this.DEFAULT_GATES = [
            {
                gateId: 'instant-s-tier',
                name: 'Instant S-Tier Gate',
                type: 'instant',
                priority: 1,
                enabled: true,
                requirements: {
                    minTier: 'S',
                    minConfidence: 0.75,
                    minProfessionalScore: 85,
                    minExpectedValue: 0.05, // 5% minimum EV
                    minCLVThreshold: 10, // 10 BPS minimum CLV
                    maxNegativeCLV: -5, // Allow small negative CLV
                    requiresSteam: false,
                    minSteamStrength: 0,
                    maxReverseSteam: -20,
                    maxCorrelation: 0.7,
                    maxPortfolioExposure: 0.25, // 25% max portfolio exposure
                    maxSingleGameExposure: 0.15, // 15% max single game
                    minTimeBeforeGame: 30, // 30 min minimum
                    maxTimeBeforeGame: 1440 // 24 hours maximum
                }
            },
            {
                gateId: '10am-premium',
                name: '10am Premium Release',
                type: 'scheduled',
                priority: 2,
                enabled: true,
                requirements: {
                    minTier: 'A',
                    minConfidence: 0.65,
                    minProfessionalScore: 75,
                    minExpectedValue: 0.03, // 3% minimum EV
                    minCLVThreshold: 5, // 5 BPS minimum CLV
                    maxNegativeCLV: -10,
                    requiresSteam: false,
                    minSteamStrength: 0,
                    maxReverseSteam: -30,
                    maxCorrelation: 0.8,
                    maxPortfolioExposure: 0.35,
                    maxSingleGameExposure: 0.20,
                    minTimeBeforeGame: 60, // 1 hour minimum
                    maxTimeBeforeGame: 2160 // 36 hours maximum
                }
            },
            {
                gateId: 'steam-hunter',
                name: 'Steam Detection Gate',
                type: 'instant',
                priority: 3,
                enabled: true,
                requirements: {
                    minTier: 'A',
                    minConfidence: 0.60,
                    minProfessionalScore: 70,
                    minExpectedValue: 0.02,
                    minCLVThreshold: 15, // Higher CLV for steam plays
                    maxNegativeCLV: 0, // No negative CLV for steam
                    requiresSteam: true,
                    minSteamStrength: 25, // Strong steam required
                    maxReverseSteam: -10,
                    maxCorrelation: 0.6,
                    maxPortfolioExposure: 0.20,
                    maxSingleGameExposure: 0.10,
                    minTimeBeforeGame: 15, // Quick steam plays
                    maxTimeBeforeGame: 360 // 6 hours max
                }
            }
        ];
        this.logger = new logger_1.Logger('PromotionGatekeeper');
        this.initializeGates();
    }
    static getInstance() {
        if (!PromotionGatekeeper.instance) {
            PromotionGatekeeper.instance = new PromotionGatekeeper();
        }
        return PromotionGatekeeper.instance;
    }
    /**
     * Initialize default gates
     */
    initializeGates() {
        this.DEFAULT_GATES.forEach(gate => {
            this.gates.set(gate.gateId, gate);
        });
        this.logger.info('Promotion gates initialized', {
            gateCount: this.gates.size,
            gates: Array.from(this.gates.keys())
        });
    }
    /**
     * Main promotion decision engine
     */
    async evaluatePromotion(pick) {
        const startTime = Date.now();
        this.logger.info('Evaluating pick for promotion', {
            pickId: pick.id,
            tier: pick.tier,
            confidence: pick.confidence,
            ev: pick.expectedValue
        });
        // Run all applicable gates
        const gateResults = [];
        let highestPriorityPassed = null;
        let totalRiskScore = 0;
        let blockerCount = 0;
        // Sort gates by priority
        const sortedGates = Array.from(this.gates.values())
            .filter(gate => gate.enabled)
            .sort((a, b) => a.priority - b.priority);
        for (const gate of sortedGates) {
            const result = await this.evaluateGate(pick, gate);
            gateResults.push(result);
            if (result.impact === 'blocking' && !result.passed) {
                blockerCount++;
            }
            totalRiskScore += this.calculateRiskContribution(result);
            if (result.passed && !highestPriorityPassed) {
                highestPriorityPassed = gate;
            }
        }
        // Make promotion decision
        const decision = this.makePromotionDecision(pick, gateResults, highestPriorityPassed, totalRiskScore, blockerCount);
        // Log decision
        const processingTime = Date.now() - startTime;
        this.logger.info('Promotion decision made', {
            pickId: pick.id,
            decision: decision.lane,
            approved: decision.approved,
            riskScore: decision.riskScore,
            confidence: decision.confidence,
            processingTimeMs: processingTime,
            gatesPassed: gateResults.filter(r => r.passed).length,
            blockers: blockerCount
        });
        // Store decision for audit trail
        await this.storePromotionDecision(pick, decision);
        // Handle promotion decision through publish guard (shadow mode aware)
        const publishResult = await PublishGuard_1.publishGuard.handlePromotionDecision({
            approved: decision.approved,
            lane: decision.lane === '10am' ? 'scheduled' : decision.lane === 'instant' ? 'instant' : 'rejected',
            reasons: this.extractReasons(gateResults),
            pick: pick,
            gateResults,
            riskScore: decision.riskScore
        }, {
            tier: pick.tier,
            isInstant: decision.lane === 'instant',
            groupKey: this.generateGroupKey(pick)
        });
        this.logger.info('Promotion handled by publish guard', {
            pickId: pick.id,
            published: publishResult.published,
            shadowLogged: publishResult.shadowLogged,
            channels: publishResult.channelsNotified
        });
        return decision;
    }
    /**
     * Evaluate single gate against pick
     */
    async evaluateGate(pick, gate) {
        const req = gate.requirements;
        const results = [];
        // Tier check
        const tierScore = this.getTierScore(pick.tier);
        const minTierScore = this.getTierScore(req.minTier);
        results.push({
            test: 'tier',
            passed: tierScore >= minTierScore,
            score: tierScore,
            threshold: minTierScore,
            weight: 20
        });
        // Confidence check
        results.push({
            test: 'confidence',
            passed: pick.confidence >= req.minConfidence,
            score: pick.confidence,
            threshold: req.minConfidence,
            weight: 15
        });
        // Professional score check
        results.push({
            test: 'professional_score',
            passed: pick.professionalScore >= req.minProfessionalScore,
            score: pick.professionalScore,
            threshold: req.minProfessionalScore,
            weight: 15
        });
        // Expected Value check
        results.push({
            test: 'expected_value',
            passed: pick.expectedValue >= req.minExpectedValue,
            score: pick.expectedValue,
            threshold: req.minExpectedValue,
            weight: 20
        });
        // CLV check
        if (pick.clvTracking) {
            const clvBps = pick.clvTracking.clvBps;
            results.push({
                test: 'clv_threshold',
                passed: clvBps >= req.minCLVThreshold,
                score: clvBps,
                threshold: req.minCLVThreshold,
                weight: 15
            });
            results.push({
                test: 'max_negative_clv',
                passed: clvBps >= req.maxNegativeCLV,
                score: clvBps,
                threshold: req.maxNegativeCLV,
                weight: 10
            });
        }
        // Steam check
        if (req.requiresSteam && pick.steamData) {
            const steamScore = pick.steamData.direction === 'for' ? pick.steamData.strength : -pick.steamData.strength;
            results.push({
                test: 'steam_strength',
                passed: steamScore >= req.minSteamStrength,
                score: steamScore,
                threshold: req.minSteamStrength,
                weight: 15
            });
        }
        // Timing check
        const minutesToGame = (pick.gameTime.getTime() - Date.now()) / (1000 * 60);
        results.push({
            test: 'timing_window',
            passed: minutesToGame >= req.minTimeBeforeGame && minutesToGame <= req.maxTimeBeforeGame,
            score: minutesToGame,
            threshold: req.minTimeBeforeGame,
            weight: 10
        });
        // Portfolio exposure check
        results.push({
            test: 'portfolio_exposure',
            passed: pick.portfolioExposure <= req.maxPortfolioExposure,
            score: 1 - pick.portfolioExposure, // Invert for scoring
            threshold: 1 - req.maxPortfolioExposure,
            weight: 15
        });
        // Calculate weighted score
        const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
        const weightedScore = results.reduce((sum, r) => {
            const normalizedScore = r.passed ? 1 : (r.score / r.threshold);
            return sum + (normalizedScore * r.weight);
        }, 0) / totalWeight;
        const overallPassed = results.every(r => r.passed);
        const failedTests = results.filter(r => !r.passed);
        return {
            gateId: gate.gateId,
            gateName: gate.name,
            passed: overallPassed,
            score: weightedScore * 100,
            threshold: 100,
            impact: this.getGateImpact(gate, failedTests.length),
            message: this.generateGateMessage(gate, overallPassed, failedTests)
        };
    }
    /**
     * Make final promotion decision
     */
    makePromotionDecision(pick, gateResults, highestPriorityGate, riskScore, blockerCount) {
        // Check for blocking failures
        if (blockerCount > 0) {
            return {
                approved: false,
                lane: 'reject',
                gateResults,
                reasoning: `Failed ${blockerCount} blocking gate(s). Pick does not meet minimum requirements.`,
                riskScore,
                confidence: 0,
                estimatedImpact: 0
            };
        }
        // No gates passed
        if (!highestPriorityGate) {
            return {
                approved: false,
                lane: 'hold',
                gateResults,
                reasoning: 'Pick did not pass any promotion gates. Holding for review.',
                riskScore,
                confidence: 0.2,
                estimatedImpact: 0
            };
        }
        // Determine lane based on highest priority gate
        let lane = 'hold';
        let scheduledTime;
        if (highestPriorityGate.type === 'instant') {
            lane = 'instant';
        }
        else if (highestPriorityGate.type === 'scheduled') {
            lane = '10am';
            // Schedule for next 10am
            scheduledTime = this.getNext10amSlot();
        }
        // Calculate confidence and impact
        const avgGateScore = gateResults.reduce((sum, r) => sum + r.score, 0) / gateResults.length;
        const confidence = Math.min(0.95, avgGateScore / 100);
        const estimatedImpact = this.calculateEstimatedImpact(pick, confidence);
        return {
            approved: true,
            lane,
            gateResults,
            reasoning: this.generateDecisionReasoning(highestPriorityGate, gateResults),
            scheduledTime,
            riskScore,
            confidence,
            estimatedImpact
        };
    }
    /**
     * Get tier numeric professional_score
     */
    getTierScore(tier) {
        switch (tier.toUpperCase()) {
            case 'S': return 4;
            case 'A': return 3;
            case 'B': return 2;
            case 'C': return 1;
            default: return 0;
        }
    }
    /**
     * Determine gate impact level
     */
    getGateImpact(gate, failedTestCount) {
        if (gate.gateId === 'instant-s-tier' || gate.gateId === 'steam-hunter') {
            return failedTestCount > 2 ? 'blocking' : 'warning';
        }
        return failedTestCount > 3 ? 'blocking' : 'warning';
    }
    /**
     * Generate human-readable gate message
     */
    generateGateMessage(gate, passed, failedTests) {
        if (passed) {
            return `✅ ${gate.name}: All requirements met`;
        }
        const failedTestNames = failedTests.map(t => t.test).join(', ');
        return `❌ ${gate.name}: Failed ${failedTests.length} requirement(s): ${failedTestNames}`;
    }
    /**
     * Calculate risk contribution from gate result
     */
    calculateRiskContribution(result) {
        const baseRisk = result.passed ? 0 : 10;
        const impactMultiplier = result.impact === 'blocking' ? 2 : result.impact === 'warning' ? 1 : 0.5;
        return baseRisk * impactMultiplier * (1 - result.score / 100);
    }
    /**
     * Get next 10am scheduled slot
     */
    getNext10amSlot() {
        const now = new Date();
        const next10am = new Date(now);
        next10am.setHours(10, 0, 0, 0);
        // If past 10am today, schedule for tomorrow
        if (now.getHours() >= 10) {
            next10am.setDate(next10am.getDate() + 1);
        }
        return next10am;
    }
    /**
     * Calculate estimated impact
     */
    calculateEstimatedImpact(pick, confidence) {
        const baseImpact = pick.expectedValue * 1000; // Convert to basis points
        const confidenceMultiplier = confidence;
        const tierMultiplier = this.getTierScore(pick.tier) / 4;
        return baseImpact * confidenceMultiplier * tierMultiplier;
    }
    /**
     * Generate decision reasoning
     */
    generateDecisionReasoning(gate, gateResults) {
        const passedGates = gateResults.filter(r => r.passed).length;
        const totalGates = gateResults.length;
        return `Approved via ${gate.name}. Passed ${passedGates}/${totalGates} gates with ${gate.type === 'instant' ? 'immediate' : '10am scheduled'} release.`;
    }
    /**
     * Store promotion decision for audit trail
     */
    async storePromotionDecision(pick, decision) {
        try {
            await supabaseClient_1.supabaseClient
                .from('promotion_decisions')
                .insert({
                pick_id: pick.id,
                prop_id: pick.propId,
                decision: decision.lane,
                approved: decision.approved,
                gate_results: decision.gateResults,
                reasoning: decision.reasoning,
                risk_score: decision.riskScore,
                confidence: decision.confidence,
                estimated_impact: decision.estimatedImpact,
                scheduled_time: decision.scheduledTime,
                created_at: new Date().toISOString()
            });
        }
        catch (error) {
            this.logger.error('Failed to store promotion decision', { error, pickId: pick.id });
        }
    }
    /**
     * Get gate configuration
     */
    getGate(gateId) {
        return this.gates.get(gateId);
    }
    /**
     * Update gate configuration
     */
    updateGate(gateId, updates) {
        const gate = this.gates.get(gateId);
        if (!gate)
            return false;
        const updatedGate = { ...gate, ...updates };
        this.gates.set(gateId, updatedGate);
        this.logger.info('Gate configuration updated', { gateId, updates });
        return true;
    }
    /**
     * Get all gate configurations
     */
    getAllGates() {
        return Array.from(this.gates.values());
    }
    /**
     * Get promotion statistics
     */
    async getPromotionStats(timeframe = 'day') {
        // Implementation would query promotion_decisions table
        // Placeholder for now
        return {
            totalEvaluated: 0,
            approved: 0,
            rejected: 0,
            instant: 0,
            scheduled: 0,
            avgRiskScore: 0,
            avgConfidence: 0,
            topGates: []
        };
    }
    /**
     * Extract rejection reasons from gate results for shadow logging
     */
    extractReasons(gateResults) {
        const reasons = [];
        gateResults.forEach(result => {
            if (!result.passed && result.impact === 'blocking') {
                reasons.push(`${result.gateName}: ${result.message}`);
            }
        });
        // If no blocking reasons, add general professional_score info
        if (reasons.length === 0) {
            const failedResults = gateResults.filter(r => !r.passed);
            if (failedResults.length > 0) {
                reasons.push(`Failed ${failedResults.length} gates`);
            }
        }
        return reasons.slice(0, 5); // Limit to 5 reasons
    }
    /**
     * Generate group key for pick batching
     */
    generateGroupKey(pick) {
        const gameDate = pick.gameTime.toISOString().split('T')[0];
        const sportKey = pick.sport.toLowerCase();
        return `${sportKey}_${gameDate}`;
    }
}
exports.promotionGatekeeper = PromotionGatekeeper.getInstance();
