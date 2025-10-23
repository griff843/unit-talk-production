"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromotionAgent = void 0;
const BaseAgent_1 = require("../BaseAgent");
const enhanced_circuit_breaker_1 = require("../../services/enhanced-circuit-breaker");
const enhanced_cache_1 = require("../../cache/enhanced-cache");
/**
 * PromotionAgent
 *
 * Applies strict tier criteria to move scored candidates into unified_picks.
 * Implements sophisticated risk management and portfolio optimization.
 *
 * Responsibilities:
 * - Apply S/A/B tier promotion criteria
 * - Perform risk assessment and correlation analysis
 * - Manage portfolio diversification
 * - Execute shadow decisions for audit trail
 * - Implement Kelly criterion position sizing
 * - Monitor promotion success rates
 *
 * Tier Promotion Criteria:
 * - S-tier: Score >= 85, Edge >= 8%, Kelly >= 0.03, Low Risk
 * - A-tier: Score >= 75, Edge >= 5%, Kelly >= 0.02, Med Risk
 * - B-tier: Score >= 65, Edge >= 3%, Kelly >= 0.01, Any Risk
 *
 * Risk Management:
 * - Maximum 3 correlated picks per tier
 * - Portfolio diversification requirements
 * - Exposure limits per sport/player/team
 * - Kelly fraction position sizing
 */
class PromotionAgent extends BaseAgent_1.BaseAgent {
    constructor(config, deps) {
        super(config, deps);
        this.promotionQueue = [];
        this.currentPortfolio = [];
        this.promotionMetrics = {
            ...this.metrics,
            candidatesEvaluated: 0,
            propsPromoted: 0,
            sTierPromotions: 0,
            aTierPromotions: 0,
            bTierPromotions: 0,
            rejectedForTier: 0,
            rejectedForEdge: 0,
            rejectedForKelly: 0,
            averagePromotionScore: 0,
            promotionLatencyMs: 0,
            shadowDecisions: 0,
            lastPromotionRun: new Date().toISOString()
        };
        // Tier promotion criteria (configurable via environment)
        this.tierCriteria = {
            S: {
                minScore: parseFloat(process.env.S_TIER_MIN_SCORE || '85'),
                minEdge: parseFloat(process.env.S_TIER_MIN_EDGE || '8'),
                minKelly: parseFloat(process.env.S_TIER_MIN_KELLY || '0.03'),
                maxRisk: parseFloat(process.env.S_TIER_MAX_RISK || '30'),
                requireSharpSignals: true,
                maxCorrelatedPicks: 2
            },
            A: {
                minScore: parseFloat(process.env.A_TIER_MIN_SCORE || '75'),
                minEdge: parseFloat(process.env.A_TIER_MIN_EDGE || '5'),
                minKelly: parseFloat(process.env.A_TIER_MIN_KELLY || '0.02'),
                maxRisk: parseFloat(process.env.A_TIER_MAX_RISK || '50'),
                requireSharpSignals: false,
                maxCorrelatedPicks: 3
            },
            B: {
                minScore: parseFloat(process.env.B_TIER_MIN_SCORE || '65'),
                minEdge: parseFloat(process.env.B_TIER_MIN_EDGE || '3'),
                minKelly: parseFloat(process.env.B_TIER_MIN_KELLY || '0.01'),
                maxRisk: parseFloat(process.env.B_TIER_MAX_RISK || '70'),
                requireSharpSignals: false,
                maxCorrelatedPicks: 4
            }
        };
    }
    async initialize() {
        this.logger.info('🚀 PromotionAgent initializing...');
        // Load current portfolio
        await this.loadCurrentPortfolio();
        // Load previous metrics
        await this.loadPromotionMetrics();
        // Subscribe to scoring completions
        await this.subscribeToScoringCompletions();
        this.logger.info('✅ PromotionAgent initialized', {
            tierCriteria: this.tierCriteria,
            portfolioSize: this.currentPortfolio.length,
            metrics: {
                totalPromoted: this.promotionMetrics.propsPromoted,
                avgScore: this.promotionMetrics.averagePromotionScore
            }
        });
    }
    async process() {
        this.logger.info('🎯 Running promotion cycle...');
        const cycleStartTime = Date.now();
        try {
            // 1. Fetch scored candidates
            const candidates = await this.fetchScoredCandidates();
            // 2. Evaluate promotion decisions
            const decisions = await this.evaluatePromotionDecisions(candidates);
            // 3. Execute promotions
            await this.executePromotions(decisions);
            // 4. Update portfolio
            await this.updatePortfolio();
            // 5. Log shadow decisions
            await this.logShadowDecisions(decisions);
            // 6. Update metrics
            await this.updatePromotionMetrics(decisions);
        }
        catch (error) {
            this.logger.error('❌ Error in promotion cycle', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
        const cycleTime = Date.now() - cycleStartTime;
        this.promotionMetrics.promotionLatencyMs = cycleTime;
        this.promotionMetrics.lastPromotionRun = new Date().toISOString();
        this.logger.info('✅ Promotion cycle completed', {
            cycleTimeMs: cycleTime,
            candidatesEvaluated: this.promotionMetrics.candidatesEvaluated,
            propsPromoted: this.promotionMetrics.propsPromoted,
            tierDistribution: {
                S: this.promotionMetrics.sTierPromotions,
                A: this.promotionMetrics.aTierPromotions,
                B: this.promotionMetrics.bTierPromotions
            }
        });
    }
    // Core Promotion Methods
    async fetchScoredCandidates() {
        this.logger.info('📊 Fetching scored candidates for promotion...');
        if (!this.hasSupabase()) {
            this.logger.warn('⚠️ Cannot fetch candidates without Supabase');
            return [];
        }
        try {
            // Get props with scores that haven't been promoted
            const { data: scoredProps, error } = await this.requireSupabase()
                .from('raw_props')
                .select('*')
                .not('professional_score', 'is', null)
                .not('devigged_edge', 'is', null)
                .not('kelly_fraction', 'is', null)
                .is('promoted_to_unified', null)
                .gte('scoring_timestamp', new Date(Date.now() - 86400000).toISOString()) // Last 24 hours
                .limit(500);
            if (error)
                throw error;
            if (!scoredProps || scoredProps.length === 0) {
                this.logger.info('ℹ️ No scored candidates found for promotion');
                return [];
            }
            // Convert to promotion candidates
            const candidates = scoredProps.map(prop => ({
                propId: prop.id,
                professionalScore: prop.professional_score,
                deviggedEdge: prop.devigged_edge,
                kellyFraction: prop.kelly_fraction,
                grade: prop.grade,
                confidence: prop.confidence_score || 0,
                featureContributions: prop.feature_contributions || {},
                reasoning: prop.reasoning || [],
                timestamp: new Date(prop.scoring_timestamp),
                rawProp: prop
            }));
            this.promotionMetrics.candidatesEvaluated += candidates.length;
            this.logger.info(`🔍 Found ${candidates.length} scored candidates`);
            return candidates;
        }
        catch (error) {
            this.logger.error('❌ Failed to fetch scored candidates', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
    }
    async evaluatePromotionDecisions(candidates) {
        if (candidates.length === 0)
            return [];
        this.logger.info(`⚖️ Evaluating ${candidates.length} promotion decisions...`);
        const decisions = [];
        for (const candidate of candidates) {
            try {
                const decision = await this.evaluateSingleCandidate(candidate);
                decisions.push(decision);
            }
            catch (error) {
                this.logger.error(`❌ Failed to evaluate candidate ${candidate.propId}`, {
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                // Create failed decision
                decisions.push({
                    propId: candidate.propId,
                    promote: false,
                    tier: null,
                    reasons: ['Evaluation failed'],
                    promotionScore: 0,
                    riskAssessment: this.getDefaultRiskAssessment(),
                    timestamp: new Date()
                });
            }
        }
        this.logger.info(`📈 Evaluated ${decisions.length} decisions`);
        return decisions;
    }
    async evaluateSingleCandidate(candidate) {
        // 1. Check basic tier qualification
        const tierQualification = this.checkTierQualification(candidate);
        // 2. Perform risk assessment
        const riskAssessment = await this.performRiskAssessment(candidate);
        // 3. Check portfolio constraints
        const portfolioCheck = await this.checkPortfolioConstraints(candidate, tierQualification);
        // 4. Calculate final promotion score
        const promotionScore = this.calculatePromotionScore(candidate, tierQualification, riskAssessment);
        // 5. Make promotion decision
        const promote = this.makePromotionDecision(tierQualification, riskAssessment, portfolioCheck, promotionScore);
        // 6. Generate reasoning
        const reasons = this.generatePromotionReasoning(candidate, tierQualification, riskAssessment, portfolioCheck, promote);
        return {
            propId: candidate.propId,
            promote,
            tier: promote ? tierQualification : null,
            reasons,
            promotionScore,
            riskAssessment,
            timestamp: new Date()
        };
    }
    checkTierQualification(candidate) {
        const { professionalScore, deviggedEdge, kellyFraction } = candidate;
        // Check S-tier
        const sCriteria = this.tierCriteria.S;
        if (professionalScore >= sCriteria.minScore &&
            deviggedEdge >= sCriteria.minEdge &&
            kellyFraction >= sCriteria.minKelly) {
            return 'S';
        }
        // Check A-tier
        const aCriteria = this.tierCriteria.A;
        if (professionalScore >= aCriteria.minScore &&
            deviggedEdge >= aCriteria.minEdge &&
            kellyFraction >= aCriteria.minKelly) {
            return 'A';
        }
        // Check B-tier
        const bCriteria = this.tierCriteria.B;
        if (professionalScore >= bCriteria.minScore &&
            deviggedEdge >= bCriteria.minEdge &&
            kellyFraction >= bCriteria.minKelly) {
            return 'B';
        }
        return null;
    }
    async performRiskAssessment(candidate) {
        // Calculate diversification score
        const diversificationScore = await this.calculateDiversificationScore(candidate);
        // Calculate correlation risk
        const correlationRisk = await this.calculateCorrelationRisk(candidate);
        // Calculate exposure risk
        const exposureRisk = await this.calculateExposureRisk(candidate);
        // Calculate portfolio impact
        const portfolioImpact = this.calculatePortfolioImpact(candidate);
        // Determine overall risk
        const overallRisk = this.determineOverallRisk(diversificationScore, correlationRisk, exposureRisk, portfolioImpact);
        return {
            diversificationScore,
            correlationRisk,
            exposureRisk,
            portfolioImpact,
            overallRisk
        };
    }
    async calculateDiversificationScore(candidate) {
        // Check sport diversification
        const sportCount = await this.getSportCount();
        const currentSportProps = await this.getCurrentSportPropsCount(candidate.rawProp.sport);
        // Reward diversification, penalize concentration
        const sportDiversification = Math.max(0, 100 - (currentSportProps / sportCount * 100));
        return sportDiversification;
    }
    async calculateCorrelationRisk(candidate) {
        // Check for correlated picks in current portfolio
        const correlatedPicks = await this.findCorrelatedPicks(candidate);
        // Higher correlation = higher risk
        return Math.min(100, correlatedPicks.length * 25);
    }
    async calculateExposureRisk(candidate) {
        // Check exposure to player/team
        const playerExposure = await this.getPlayerExposure(candidate.rawProp.player_name);
        const teamExposure = await this.getTeamExposure(candidate.rawProp.team_home, candidate.rawProp.team_away);
        // Calculate combined exposure risk
        return Math.min(100, (playerExposure + teamExposure) * 10);
    }
    calculatePortfolioImpact(candidate) {
        // Calculate how this pick would impact overall portfolio Kelly
        const portfolioKelly = this.currentPortfolio.reduce((sum, pick) => sum + (pick.kelly_fraction || 0), 0);
        const newPortfolioKelly = portfolioKelly + candidate.kellyFraction;
        // Penalize if total portfolio Kelly exceeds safe thresholds
        if (newPortfolioKelly > 0.25)
            return 100; // Very high risk
        if (newPortfolioKelly > 0.15)
            return 70; // High risk
        if (newPortfolioKelly > 0.10)
            return 40; // Medium risk
        return 20; // Low risk
    }
    determineOverallRisk(diversification, correlation, exposure, portfolio) {
        const avgRisk = (correlation + exposure + portfolio - diversification) / 3;
        if (avgRisk > 70)
            return 'high';
        if (avgRisk > 40)
            return 'medium';
        return 'low';
    }
    async checkPortfolioConstraints(candidate, tier) {
        if (!tier)
            return false;
        const criteria = this.tierCriteria[tier];
        // Check correlation constraints
        const correlatedCount = await this.getCorrelatedPicksCount(candidate, tier);
        if (correlatedCount >= criteria.maxCorrelatedPicks) {
            this.logger.info(`Portfolio constraint: Too many correlated ${tier}-tier picks`);
            return false;
        }
        // Check exposure limits
        const playerCount = await this.getPlayerPicksCount(candidate.rawProp.player_name, tier);
        if (playerCount >= 2) { // Max 2 picks per player per tier
            this.logger.info(`Portfolio constraint: Too many picks for player ${candidate.rawProp.player_name}`);
            return false;
        }
        return true;
    }
    calculatePromotionScore(candidate, tier, risk) {
        if (!tier)
            return 0;
        let score = candidate.professionalScore;
        // Apply tier bonus
        const tierBonus = { S: 15, A: 10, B: 5 }[tier];
        score += tierBonus;
        // Apply risk adjustment
        const riskPenalty = { low: 0, medium: -10, high: -25 }[risk.overallRisk];
        score += riskPenalty;
        // Apply edge bonus
        score += candidate.deviggedEdge;
        // Apply Kelly bonus
        score += candidate.kellyFraction * 100;
        return Math.min(100, Math.max(0, score));
    }
    makePromotionDecision(tier, risk, portfolioCheck, promotionScore) {
        if (!tier || !portfolioCheck)
            return false;
        // Minimum promotion score threshold
        const minPromotionScore = { S: 85, A: 75, B: 65 }[tier];
        if (promotionScore < minPromotionScore)
            return false;
        // Risk-based decision
        const criteria = this.tierCriteria[tier];
        const riskScore = (risk.correlationRisk + risk.exposureRisk + risk.portfolioImpact - risk.diversificationScore) / 3;
        return riskScore <= criteria.maxRisk;
    }
    generatePromotionReasoning(candidate, tier, risk, portfolioCheck, promote) {
        const reasons = [];
        if (promote) {
            reasons.push(`Promoted to ${tier}-tier`);
            reasons.push(`Score: ${candidate.professionalScore.toFixed(1)}`);
            reasons.push(`Edge: ${candidate.deviggedEdge.toFixed(2)}%`);
            reasons.push(`Kelly: ${(candidate.kellyFraction * 100).toFixed(2)}%`);
            reasons.push(`Risk: ${risk.overallRisk}`);
        }
        else {
            if (!tier) {
                reasons.push('Failed tier qualification');
            }
            else if (!portfolioCheck) {
                reasons.push('Failed portfolio constraints');
            }
            else {
                reasons.push(`Rejected due to ${risk.overallRisk} risk`);
            }
        }
        return reasons;
    }
    // Execution Methods
    async executePromotions(decisions) {
        const promotions = decisions.filter(d => d.promote);
        if (promotions.length === 0) {
            this.logger.info('ℹ️ No promotions to execute');
            return;
        }
        this.logger.info(`🚀 Executing ${promotions.length} promotions...`);
        for (const promotion of promotions) {
            try {
                await this.executeSinglePromotion(promotion);
                this.promotionMetrics.propsPromoted++;
                // Update tier counts
                if (promotion.tier === 'S')
                    this.promotionMetrics.sTierPromotions++;
                else if (promotion.tier === 'A')
                    this.promotionMetrics.aTierPromotions++;
                else if (promotion.tier === 'B')
                    this.promotionMetrics.bTierPromotions++;
            }
            catch (error) {
                this.logger.error(`❌ Failed to execute promotion for ${promotion.propId}`, {
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        this.logger.info(`✅ Executed ${promotions.length} promotions`);
    }
    async executeSinglePromotion(promotion) {
        if (!this.hasSupabase()) {
            throw new Error('Supabase not available');
        }
        await enhanced_circuit_breaker_1.withCircuitBreaker.supabase(async () => {
            // Get full prop data
            const { data: propData, error: fetchError } = await this.requireSupabase()
                .from('raw_props')
                .select('*')
                .eq('id', promotion.propId)
                .single();
            if (fetchError)
                throw fetchError;
            // Insert into unified_picks
            const pickData = {
                ...propData,
                tier: promotion.tier,
                promotion_score: promotion.promotionScore,
                risk_assessment: promotion.riskAssessment,
                promotion_reasons: promotion.reasons,
                promoted_at: promotion.timestamp,
                promoted_by: 'PromotionAgent',
                status: 'active'
            };
            const { error: insertError } = await this.requireSupabase()
                .from('unified_picks')
                .insert([pickData]);
            if (insertError)
                throw insertError;
            // Mark as promoted in raw_props
            const { error: updateError } = await this.requireSupabase()
                .from('raw_props')
                .update({
                promoted_to_unified: true,
                promotion_timestamp: promotion.timestamp
            })
                .eq('id', promotion.propId);
            if (updateError)
                throw updateError;
        }, async () => {
            this.logger.warn(`⚠️ Failed to promote ${promotion.propId}, circuit breaker open`);
        });
    }
    // Helper Methods
    async loadCurrentPortfolio() {
        if (!this.hasSupabase())
            return;
        try {
            const { data: portfolio } = await this.requireSupabase()
                .from('unified_picks')
                .select('*')
                .eq('status', 'active');
            this.currentPortfolio = portfolio || [];
        }
        catch (error) {
            this.logger.warn('⚠️ Failed to load current portfolio');
        }
    }
    async getSportCount() {
        const { data } = await this.requireSupabase()
            .from('unified_picks')
            .select('sport')
            .eq('status', 'active');
        return new Set(data?.map(p => p.sport) || []).size;
    }
    async getCurrentSportPropsCount(sport) {
        const { count } = await this.requireSupabase()
            .from('unified_picks')
            .select('*', { count: 'exact', head: true })
            .eq('sport', sport)
            .eq('status', 'active');
        return count || 0;
    }
    async findCorrelatedPicks(candidate) {
        // Find picks with same player, team, or game
        const { data } = await this.requireSupabase()
            .from('unified_picks')
            .select('*')
            .eq('status', 'active')
            .or(`player_name.eq.${candidate.rawProp.player_name},team_home.eq.${candidate.rawProp.team_home},team_away.eq.${candidate.rawProp.team_away}`);
        return data || [];
    }
    async getPlayerExposure(playerName) {
        const { count } = await this.requireSupabase()
            .from('unified_picks')
            .select('*', { count: 'exact', head: true })
            .eq('player_name', playerName)
            .eq('status', 'active');
        return count || 0;
    }
    async getTeamExposure(teamHome, teamAway) {
        const { count } = await this.requireSupabase()
            .from('unified_picks')
            .select('*', { count: 'exact', head: true })
            .or(`team_home.eq.${teamHome},team_away.eq.${teamAway}`)
            .eq('status', 'active');
        return count || 0;
    }
    async getCorrelatedPicksCount(candidate, tier) {
        const correlated = await this.findCorrelatedPicks(candidate);
        return correlated.filter(pick => pick.tier === tier).length;
    }
    async getPlayerPicksCount(playerName, tier) {
        const { count } = await this.requireSupabase()
            .from('unified_picks')
            .select('*', { count: 'exact', head: true })
            .eq('player_name', playerName)
            .eq('tier', tier)
            .eq('status', 'active');
        return count || 0;
    }
    getDefaultRiskAssessment() {
        return {
            diversificationScore: 50,
            correlationRisk: 50,
            exposureRisk: 50,
            portfolioImpact: 50,
            overallRisk: 'medium'
        };
    }
    // Monitoring and Updates
    async updatePortfolio() {
        await this.loadCurrentPortfolio();
    }
    async logShadowDecisions(decisions) {
        const shadowDecisions = decisions.filter(d => d.shadowDecision);
        if (shadowDecisions.length > 0) {
            this.promotionMetrics.shadowDecisions += shadowDecisions.length;
            // Log for audit trail
            for (const decision of shadowDecisions) {
                await enhanced_cache_1.redisCache.set(`shadow:promotion:${decision.propId}`, JSON.stringify(decision), 86400 * 7 // 7 days retention
                );
            }
        }
    }
    async subscribeToScoringCompletions() {
        if (!this.hasSupabase())
            return;
        // Subscribe to scoring completions
        this.requireSupabase()
            .channel('scoring-completions')
            .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'raw_props',
            filter: 'professional_score=not.is.null'
        }, (payload) => {
            // Add to promotion queue if meets basic criteria
            if (payload.new.professional_score >= 65) { // Minimum B-tier score
                this.promotionQueue.push({
                    propId: payload.new.id,
                    professionalScore: payload.new.professional_score,
                    deviggedEdge: payload.new.devigged_edge,
                    kellyFraction: payload.new.kelly_fraction,
                    grade: payload.new.grade,
                    confidence: payload.new.confidence_score || 0,
                    featureContributions: payload.new.feature_contributions || {},
                    reasoning: payload.new.reasoning || [],
                    timestamp: new Date(),
                    rawProp: payload.new
                });
            }
        })
            .subscribe();
    }
    async loadPromotionMetrics() {
        try {
            const cached = await enhanced_cache_1.redisCache.get('promotion:metrics');
            if (cached) {
                const previousMetrics = JSON.parse(cached);
                this.promotionMetrics = { ...this.promotionMetrics, ...previousMetrics };
            }
        }
        catch (error) {
            this.logger.warn('⚠️ Failed to load previous promotion metrics');
        }
    }
    async updatePromotionMetrics(decisions) {
        if (decisions.length > 0) {
            const promotions = decisions.filter(d => d.promote);
            const totalScore = promotions.reduce((sum, d) => sum + d.promotionScore, 0);
            this.promotionMetrics.averagePromotionScore = promotions.length > 0 ?
                totalScore / promotions.length : 0;
        }
        await enhanced_cache_1.redisCache.set('promotion:metrics', JSON.stringify(this.promotionMetrics), 86400 // 24 hours TTL
        );
    }
    // Cleanup and Health
    async cleanup() {
        this.logger.info('🧹 PromotionAgent cleanup...');
        // Save final metrics
        await this.updatePromotionMetrics([]);
        // Process remaining queue items
        if (this.promotionQueue.length > 0) {
            const decisions = await this.evaluatePromotionDecisions(this.promotionQueue);
            await this.executePromotions(decisions);
        }
        this.logger.info('✅ PromotionAgent cleanup complete');
    }
    async collectMetrics() {
        return {
            ...this.promotionMetrics,
            memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
        };
    }
    async checkHealth() {
        const checks = [];
        // Check promotion latency
        checks.push({
            component: 'promotion_latency',
            status: this.promotionMetrics.promotionLatencyMs < 60000 ? 'healthy' : 'degraded'
        });
        // Check promotion rate
        const promotionRate = this.promotionMetrics.candidatesEvaluated > 0 ?
            this.promotionMetrics.propsPromoted / this.promotionMetrics.candidatesEvaluated : 0;
        checks.push({
            component: 'promotion_rate',
            status: promotionRate > 0.1 && promotionRate < 0.8 ? 'healthy' : 'degraded'
        });
        // Check queue size
        checks.push({
            component: 'queue_size',
            status: this.promotionQueue.length < 100 ? 'healthy' : 'degraded'
        });
        const healthyComponents = checks.filter(c => c.status === 'healthy').length;
        const overallStatus = healthyComponents === checks.length ? 'healthy' :
            healthyComponents >= checks.length / 2 ? 'degraded' : 'unhealthy';
        return {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            details: {
                checks,
                metrics: this.promotionMetrics,
                queueSize: this.promotionQueue.length,
                portfolioSize: this.currentPortfolio.length,
                tierCriteria: this.tierCriteria
            }
        };
    }
}
exports.PromotionAgent = PromotionAgent;
