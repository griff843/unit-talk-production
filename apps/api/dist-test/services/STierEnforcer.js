"use strict";
/**
 * S-Tier Enforcement Service
 * Enforces strict S-tier thresholds with EV/CLV/Steam validation gates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sTierEnforcer = void 0;
const logger_1 = require("../utils/logger");
const supabaseClient_1 = require("./supabaseClient");
class STierEnforcer {
    constructor() {
        // S-tier requirements (production-grade thresholds)
        this.REQUIREMENTS = {
            minExpectedValue: 0.05, // 5% minimum EV
            minCLVThreshold: 15, // 15+ BPS positive CLV
            maxNegativeCLVAllowed: -3, // -3 BPS max negative
            minConfidenceScore: 0.75, // 75% confidence
            minProfessionalScore: 85, // 85+ professional professional_score
            requiresPositiveSteam: true, // Must have steam
            minSteamStrength: 20, // 20+ BPS steam
            maxCounterSteam: -10, // -10 BPS max counter
            maxDrawdownRisk: 0.15, // 15% max drawdown
            minKellyFraction: 0.05, // 5% min Kelly
            maxKellyFraction: 0.25, // 25% max Kelly
            minMarketDepth: 10000, // $10K depth
            maxMarketImpact: 0.05, // 5% max impact
            requiresSharpMoney: true // Sharp money required
        };
        this.logger = (0, logger_1.createLogger)('STierEnforcer');
    }
    static getInstance() {
        if (!STierEnforcer.instance) {
            STierEnforcer.instance = new STierEnforcer();
        }
        return STierEnforcer.instance;
    }
    /**
     * Main S-tier validation and enforcement
     */
    async enforceSTierStandards(pick) {
        this.logger.info('Enforcing S-tier standards', {
            pickId: pick.id,
            currentTier: pick.tier,
            professionalScore: pick.professional_score
        });
        const violations = [];
        // Core threshold validations
        await this.validateCoreThresholds(pick, violations);
        // EV/CLV validation
        await this.validateEVCLV(pick, violations);
        // Steam validation
        const steamAnalysis = await this.validateSteam(pick, violations);
        // Risk assessment
        const riskAssessment = await this.assessRisk(pick, violations);
        // Market validation
        const marketValidation = await this.validateMarket(pick, violations);
        // Determine enforcement action
        const enforcement = this.determineEnforcement(pick, violations);
        const validation = {
            pickId: pick.id,
            tier: pick.tier,
            passed: violations.filter(v => v.severity === 'critical').length === 0,
            enforced: enforcement.enforced,
            violations,
            adjustedTier: enforcement.adjustedTier,
            reasoning: enforcement.reasoning,
            riskAssessment,
            marketValidation,
            steamAnalysis
        };
        // Store validation result
        await this.storeValidation(validation);
        // Take enforcement action if needed
        if (enforcement.enforced && enforcement.adjustedTier && enforcement.adjustedTier !== pick.tier) {
            await this.applyTierAdjustment(pick, enforcement.adjustedTier, enforcement.reasoning);
        }
        this.logger.info('S-tier enforcement completed', {
            pickId: pick.id,
            passed: validation.passed,
            enforced: validation.enforced,
            violations: violations.length,
            adjustedTier: validation.adjustedTier
        });
        return validation;
    }
    /**
     * Validate core S-tier thresholds
     */
    async validateCoreThresholds(pick, violations) {
        const req = this.REQUIREMENTS;
        // Expected Value check
        if (pick.expected_value < req.minExpectedValue) {
            violations.push({
                rule: 'min_expected_value',
                severity: 'critical',
                value: pick.expected_value,
                threshold: req.minExpectedValue,
                message: `EV ${(pick.expected_value * 100).toFixed(1)}% below ${(req.minExpectedValue * 100)}% S-tier minimum`,
                autoCorrect: false
            });
        }
        // Confidence professional_score check
        if (pick.confidence < req.minConfidenceScore) {
            violations.push({
                rule: 'min_confidence',
                severity: 'critical',
                value: pick.confidence,
                threshold: req.minConfidenceScore,
                message: `Confidence ${(pick.confidence * 100).toFixed(1)}% below ${(req.minConfidenceScore * 100)}% S-tier minimum`,
                autoCorrect: false
            });
        }
        // Professional professional_score check
        if (pick.professional_score < req.minProfessionalScore) {
            violations.push({
                rule: 'min_professional_score',
                severity: 'critical',
                value: pick.professional_score,
                threshold: req.minProfessionalScore,
                message: `Professional professional_score ${pick.professional_score} below ${req.minProfessionalScore} S-tier minimum`,
                autoCorrect: false
            });
        }
    }
    /**
     * Validate EV and CLV requirements
     */
    async validateEVCLV(pick, violations) {
        const req = this.REQUIREMENTS;
        // CLV tracking validation
        if (pick.clv_tracking) {
            const clvBps = pick.clv_tracking.current_clv_bps || 0;
            // Positive CLV requirement
            if (clvBps < req.minCLVThreshold) {
                violations.push({
                    rule: 'min_clv_threshold',
                    severity: 'critical',
                    value: clvBps,
                    threshold: req.minCLVThreshold,
                    message: `CLV ${clvBps} BPS below ${req.minCLVThreshold} BPS S-tier minimum`,
                    autoCorrect: false
                });
            }
            // Negative CLV tolerance
            if (clvBps < req.maxNegativeCLVAllowed) {
                violations.push({
                    rule: 'max_negative_clv',
                    severity: 'critical',
                    value: clvBps,
                    threshold: req.maxNegativeCLVAllowed,
                    message: `CLV ${clvBps} BPS exceeds ${req.maxNegativeCLVAllowed} BPS negative tolerance`,
                    autoCorrect: false
                });
            }
        }
        else {
            // Missing CLV tracking is critical for S-tier
            violations.push({
                rule: 'missing_clv_tracking',
                severity: 'critical',
                value: 0,
                threshold: 1,
                message: 'S-tier picks must have active CLV tracking',
                autoCorrect: true
            });
        }
    }
    /**
     * Validate steam requirements
     */
    async validateSteam(pick, violations) {
        const req = this.REQUIREMENTS;
        const steamData = await this.getSteamData(pick.prop_id);
        if (req.requiresPositiveSteam) {
            if (!steamData || steamData.strength < req.minSteamStrength) {
                violations.push({
                    rule: 'min_steam_strength',
                    severity: 'major',
                    value: steamData?.strength || 0,
                    threshold: req.minSteamStrength,
                    message: `Steam strength ${steamData?.strength || 0} BPS below ${req.minSteamStrength} BPS requirement`,
                    autoCorrect: false
                });
            }
            if (steamData && steamData.direction === 'against' && steamData.strength > Math.abs(req.maxCounterSteam)) {
                violations.push({
                    rule: 'max_counter_steam',
                    severity: 'major',
                    value: -steamData.strength,
                    threshold: req.maxCounterSteam,
                    message: `Counter-steam ${steamData.strength} BPS exceeds ${Math.abs(req.maxCounterSteam)} BPS tolerance`,
                    autoCorrect: false
                });
            }
        }
        return steamData || {
            strength: 0,
            direction: 'neutral',
            volume: 0,
            timeframe: '1h',
            sustainability: 0,
            qualityScore: 0
        };
    }
    /**
     * Assess risk factors
     */
    async assessRisk(pick, violations) {
        const req = this.REQUIREMENTS;
        // Kelly fraction validation
        const kellyFraction = pick.kelly_fraction || this.calculateKellyFraction(pick);
        if (kellyFraction < req.minKellyFraction) {
            violations.push({
                rule: 'min_kelly_fraction',
                severity: 'major',
                value: kellyFraction,
                threshold: req.minKellyFraction,
                message: `Kelly fraction ${(kellyFraction * 100).toFixed(1)}% below ${(req.minKellyFraction * 100)}% minimum`,
                autoCorrect: true
            });
        }
        if (kellyFraction > req.maxKellyFraction) {
            violations.push({
                rule: 'max_kelly_fraction',
                severity: 'major',
                value: kellyFraction,
                threshold: req.maxKellyFraction,
                message: `Kelly fraction ${(kellyFraction * 100).toFixed(1)}% exceeds ${(req.maxKellyFraction * 100)}% maximum`,
                autoCorrect: true
            });
        }
        // Calculate expected drawdown
        const expectedDrawdown = this.calculateExpectedDrawdown(pick);
        if (expectedDrawdown > req.maxDrawdownRisk) {
            violations.push({
                rule: 'max_drawdown_risk',
                severity: 'major',
                value: expectedDrawdown,
                threshold: req.maxDrawdownRisk,
                message: `Expected drawdown ${(expectedDrawdown * 100).toFixed(1)}% exceeds ${(req.maxDrawdownRisk * 100)}% limit`,
                autoCorrect: false
            });
        }
        return {
            expectedDrawdown,
            kellyFraction,
            portfolioImpact: this.calculatePortfolioImpact(pick),
            correlationRisk: this.calculateCorrelationRisk(pick),
            liquidityRisk: this.calculateLiquidityRisk(pick),
            overallRisk: this.classifyOverallRisk(expectedDrawdown, kellyFraction)
        };
    }
    /**
     * Validate market conditions
     */
    async validateMarket(pick, violations) {
        const req = this.REQUIREMENTS;
        const marketData = await this.getMarketData(pick.prop_id);
        if (marketData.depth < req.minMarketDepth) {
            violations.push({
                rule: 'min_market_depth',
                severity: 'minor',
                value: marketData.depth,
                threshold: req.minMarketDepth,
                message: `Market depth $${marketData.depth.toLocaleString()} below $${req.minMarketDepth.toLocaleString()} minimum`,
                autoCorrect: false
            });
        }
        if (marketData.impact > req.maxMarketImpact) {
            violations.push({
                rule: 'max_market_impact',
                severity: 'major',
                value: marketData.impact,
                threshold: req.maxMarketImpact,
                message: `Market impact ${(marketData.impact * 100).toFixed(1)}% exceeds ${(req.maxMarketImpact * 100)}% maximum`,
                autoCorrect: false
            });
        }
        if (req.requiresSharpMoney && !marketData.sharpMoneyPresent) {
            violations.push({
                rule: 'requires_sharp_money',
                severity: 'minor',
                value: marketData.institutionalFlow,
                threshold: 0.5,
                message: 'S-tier picks require sharp money confirmation',
                autoCorrect: false
            });
        }
        return marketData;
    }
    /**
     * Determine enforcement action
     */
    determineEnforcement(pick, violations) {
        const criticalViolations = violations.filter(v => v.severity === 'critical');
        const majorViolations = violations.filter(v => v.severity === 'major');
        if (pick.tier !== 'S') {
            return {
                enforced: false,
                reasoning: 'Pick is not S-tier, no enforcement needed'
            };
        }
        // Critical violations = immediate downgrade
        if (criticalViolations.length > 0) {
            return {
                enforced: true,
                adjustedTier: 'A',
                reasoning: `Downgraded from S to A: ${criticalViolations.length} critical violation(s) - ${criticalViolations.map(v => v.rule).join(', ')}`
            };
        }
        // Multiple major violations = downgrade
        if (majorViolations.length >= 3) {
            return {
                enforced: true,
                adjustedTier: 'A',
                reasoning: `Downgraded from S to A: ${majorViolations.length} major violations exceed threshold`
            };
        }
        return {
            enforced: false,
            reasoning: `S-tier standards maintained: ${violations.length} minor violations within tolerance`
        };
    }
    /**
     * Apply tier adjustment
     */
    async applyTierAdjustment(pick, newTier, reasoning) {
        try {
            await supabaseClient_1.supabaseClient
                .from('unified_picks')
                .update({
                tier: newTier,
                tier_adjustment_reason: reasoning,
                tier_adjusted_at: new Date().toISOString(),
                adjusted_by: 'STierEnforcer'
            })
                .eq('id', pick.id);
            this.logger.info('Tier adjustment applied', {
                pickId: pick.id,
                oldTier: pick.tier,
                newTier,
                reasoning
            });
        }
        catch (error) {
            this.logger.error('Failed to apply tier adjustment', { error, pickId: pick.id });
        }
    }
    /**
     * Store validation result
     */
    async storeValidation(validation) {
        try {
            await supabaseClient_1.supabaseClient
                .from('stier_validations')
                .insert({
                pick_id: validation.pickId,
                tier: validation.tier,
                passed: validation.passed,
                enforced: validation.enforced,
                violations: validation.violations,
                adjusted_tier: validation.adjustedTier,
                reasoning: validation.reasoning,
                risk_assessment: validation.riskAssessment,
                market_validation: validation.marketValidation,
                steam_analysis: validation.steamAnalysis,
                created_at: new Date().toISOString()
            });
        }
        catch (error) {
            this.logger.error('Failed to store S-tier validation', { error, pickId: validation.pickId });
        }
    }
    /**
     * Helper methods for calculations
     */
    calculateKellyFraction(pick) {
        if (!pick.expected_value || !pick.confidence)
            return 0;
        const edge = pick.expected_value;
        const odds = pick.odds || -110;
        const impliedProbability = Math.abs(odds) / (Math.abs(odds) + 100);
        // Kelly = (edge * confidence) / variance
        return Math.max(0, (edge * pick.confidence) / (impliedProbability * (1 - impliedProbability)));
    }
    calculateExpectedDrawdown(pick) {
        const volatility = pick.variance || 0.2;
        const kellyFraction = pick.kelly_fraction || this.calculateKellyFraction(pick);
        // Simplified drawdown calculation
        return volatility * kellyFraction * 2.5;
    }
    calculatePortfolioImpact(pick) {
        // Placeholder - would calculate based on portfolio size and bet size
        return 0.1;
    }
    calculateCorrelationRisk(pick) {
        // Placeholder - would analyze correlations with other positions
        return 0.05;
    }
    calculateLiquidityRisk(pick) {
        // Placeholder - would assess liquidity conditions
        return 0.02;
    }
    classifyOverallRisk(drawdown, kellyFraction) {
        if (drawdown > 0.25 || kellyFraction > 0.3)
            return 'extreme';
        if (drawdown > 0.15 || kellyFraction > 0.25)
            return 'high';
        if (drawdown > 0.1 || kellyFraction > 0.15)
            return 'medium';
        return 'low';
    }
    async getSteamData(propId) {
        try {
            const { data } = await supabaseClient_1.supabaseClient
                .from('steam_tracking')
                .select('*')
                .eq('prop_id', propId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            if (!data)
                return null;
            return {
                strength: data.strength || 0,
                direction: data.direction || 'neutral',
                volume: data.volume || 0,
                timeframe: data.timeframe || '1h',
                sustainability: data.sustainability || 0,
                qualityScore: data.quality_score || 0
            };
        }
        catch (error) {
            this.logger.error('Failed to get steam data', { error, propId });
            return null;
        }
    }
    async getMarketData(propId) {
        try {
            const { data } = await supabaseClient_1.supabaseClient
                .from('market_data')
                .select('*')
                .eq('prop_id', propId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            return {
                depth: data?.depth || 5000,
                impact: data?.impact || 0.03,
                efficiency: data?.efficiency || 0.85,
                sharpMoneyPresent: data?.sharp_money_present || false,
                institutionalFlow: data?.institutional_flow || 0.3,
                retailPercentage: data?.retail_percentage || 0.7,
                qualityScore: data?.quality_score || 0.75
            };
        }
        catch (error) {
            this.logger.error('Failed to get market data', { error, propId });
            return {
                depth: 5000,
                impact: 0.03,
                efficiency: 0.85,
                sharpMoneyPresent: false,
                institutionalFlow: 0.3,
                retailPercentage: 0.7,
                qualityScore: 0.75
            };
        }
    }
    /**
     * Get S-tier enforcement statistics
     */
    async getEnforcementStats(timeframe = 'day') {
        // Implementation would query stier_validations table
        return {
            totalValidations: 0,
            stierPicks: 0,
            downgrades: 0,
            violationTypes: {},
            avgConfidence: 0,
            avgEV: 0,
            avgCLV: 0
        };
    }
}
exports.sTierEnforcer = STierEnforcer.getInstance();
