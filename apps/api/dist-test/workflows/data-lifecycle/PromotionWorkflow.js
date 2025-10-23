"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromotionWorkflow = PromotionWorkflow;
exports.ScheduledPromotionWorkflow = ScheduledPromotionWorkflow;
exports.ExpressPromotionWorkflow = ExpressPromotionWorkflow;
const workflow_1 = require("@temporalio/workflow");
const wf = __importStar(require("@temporalio/workflow"));
// Configure activities for promotion management
const activities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '8 minutes',
    heartbeatTimeout: '1 minute',
    scheduleToStartTimeout: '20 seconds'
});
/**
 * PromotionWorkflow - Professional Pick Promotion Engine
 *
 * Applies strict tier criteria to move scored candidates into unified_picks
 * with sophisticated risk management and portfolio optimization.
 *
 * Tier Criteria:
 * - S-tier: Score >= 85, Edge >= 8%, Kelly >= 0.03, Confidence >= 85% (Elite)
 * - A-tier: Score >= 75, Edge >= 5%, Kelly >= 0.02, Confidence >= 80% (Strong)
 * - B-tier: Score >= 65, Edge >= 3%, Kelly >= 0.01, Confidence >= 75% (Good)
 * - C-tier: Score >= 55, Edge >= 1%, Kelly >= 0.005, Confidence >= 70% (Marginal)
 *
 * Risk Management:
 * - Portfolio correlation limits
 * - Exposure limits per game/player/sport
 * - Kelly criterion position sizing
 * - Dynamic risk adjustment
 */
async function PromotionWorkflow(params) {
    const startTime = Date.now();
    const workflowId = wf.workflowInfo().workflowId;
    // Initialize result tracking
    let result = {
        success: false,
        candidatesProcessed: 0,
        promotedCount: 0,
        rejectedCount: 0,
        tierDistribution: { S: 0, A: 0, B: 0, C: 0 },
        portfolioMetrics: {
            totalExposure: 0,
            totalKelly: 0,
            correlationScore: 0,
            diversificationIndex: 0
        },
        alerts: [],
        duration: 0,
        errors: []
    };
    try {
        wf.log.info('🚀 PromotionWorkflow started', {
            workflowId,
            params,
            scheduledAt: new Date().toISOString()
        });
        // ================================
        // 1. PARAMETER SETUP
        // ================================
        const minGrade = params.minGrade || 'B';
        const minScore = params.minScore || 65;
        const minEdge = params.minEdge || 0.03;
        const minKellyFraction = params.minKellyFraction || 0.01;
        const batchSize = params.batchSize || 200;
        const dryRun = params.dryRun || false;
        // Portfolio risk constraints
        const portfolioConstraints = {
            maxExposurePerGame: params.portfolioConstraints?.maxExposurePerGame || 0.15, // 15% max per game
            maxExposurePerPlayer: params.portfolioConstraints?.maxExposurePerPlayer || 0.10, // 10% max per player
            maxExposurePerSport: params.portfolioConstraints?.maxExposurePerSport || 0.40, // 40% max per sport
            maxCorrelationRisk: params.portfolioConstraints?.maxCorrelationRisk || 0.70, // 70% max correlation
            maxPortfolioKelly: params.portfolioConstraints?.maxPortfolioKelly || 1.00 // 100% max total Kelly
        };
        // Strict tier criteria for professional picks
        const tierCriteria = {
            S: { minScore: 85, minEdge: 0.08, minKelly: 0.03, minConfidence: 85 }, // Elite picks
            A: { minScore: 75, minEdge: 0.05, minKelly: 0.02, minConfidence: 80 }, // Strong picks
            B: { minScore: 65, minEdge: 0.03, minKelly: 0.01, minConfidence: 75 }, // Good picks
            C: { minScore: 55, minEdge: 0.01, minKelly: 0.005, minConfidence: 70 } // Marginal picks
        };
        wf.log.info('📊 Promotion parameters validated', {
            minGrade,
            minScore,
            minEdge,
            minKellyFraction,
            batchSize,
            portfolioConstraints,
            tierCriteria,
            dryRun
        });
        // ================================
        // 2. FETCH PROMOTION CANDIDATES
        // ================================
        wf.log.info('🎯 Fetching promotion candidates');
        const candidatesResult = await activities.fetchPromotionCandidates({
            minGrade,
            minScore,
            minEdge,
            minKellyFraction,
            batchSize
        });
        if (candidatesResult.candidates.length === 0) {
            wf.log.info('ℹ️ No candidates meet promotion criteria');
            result.success = true;
            result.duration = Date.now() - startTime;
            return result;
        }
        result.candidatesProcessed = candidatesResult.candidates.length;
        wf.log.info('✅ Promotion candidates fetched', {
            candidatesFound: candidatesResult.candidates.length,
            totalAvailable: candidatesResult.totalFound
        });
        // ================================
        // 3. VALIDATE TIER CRITERIA
        // ================================
        wf.log.info('🔍 Validating promotion criteria');
        const validationResult = await activities.validatePromotionCriteria({
            candidates: candidatesResult.candidates,
            tierCriteria
        });
        if (validationResult.validCandidates.length === 0) {
            wf.log.info('ℹ️ No candidates pass strict tier validation');
            result.success = true;
            result.duration = Date.now() - startTime;
            return result;
        }
        wf.log.info('✅ Tier validation completed', {
            validCandidates: validationResult.validCandidates.length,
            invalidCandidates: validationResult.invalidCandidates.length
        });
        // ================================
        // 4. RISK ASSESSMENT & PORTFOLIO OPTIMIZATION
        // ================================
        wf.log.info('⚖️ Performing risk assessment');
        const riskResult = await activities.performRiskAssessment({
            candidates: validationResult.validCandidates.map(c => ({
                propId: c.propId,
                professionalScore: candidatesResult.candidates.find(orig => orig.propId === c.propId).professionalScore,
                deviggedEdge: candidatesResult.candidates.find(orig => orig.propId === c.propId).deviggedEdge,
                kellyFraction: candidatesResult.candidates.find(orig => orig.propId === c.propId).kellyFraction,
                grade: c.tier,
                correlationRisk: candidatesResult.candidates.find(orig => orig.propId === c.propId).correlationRisk,
                capperAttribution: candidatesResult.candidates.find(orig => orig.propId === c.propId).capperAttribution
            })),
            portfolioConstraints
        });
        result.rejectedCount = riskResult.rejectedCandidates.length;
        result.portfolioMetrics = riskResult.portfolioMetrics;
        // Generate risk-based alerts
        if (riskResult.rejectedCandidates.length > 0) {
            result.alerts.push({
                type: 'risk_rejections',
                message: 'Picks rejected due to risk constraints',
                count: riskResult.rejectedCandidates.length
            });
            await activities.sendPromotionAlert({
                alertType: 'risk_rejection',
                message: `${riskResult.rejectedCandidates.length} picks rejected due to risk constraints`,
                details: {
                    rejectedCandidates: riskResult.rejectedCandidates,
                    portfolioMetrics: riskResult.portfolioMetrics
                },
                priority: riskResult.rejectedCandidates.length > 5 ? 'high' : 'medium'
            });
        }
        wf.log.info('✅ Risk assessment completed', {
            approvedCandidates: riskResult.approvedCandidates.length,
            rejectedCandidates: riskResult.rejectedCandidates.length,
            portfolioMetrics: riskResult.portfolioMetrics
        });
        // ================================
        // 5. PREPARE PROMOTIONS
        // ================================
        const promotions = riskResult.approvedCandidates.map(approved => {
            const original = candidatesResult.candidates.find(c => c.propId === approved.propId);
            const tier = validationResult.validCandidates.find(v => v.propId === approved.propId).tier;
            return {
                propId: approved.propId,
                tier,
                professionalScore: original.professionalScore,
                deviggedEdge: original.deviggedEdge,
                kellyFraction: approved.adjustedKelly,
                riskScore: approved.riskScore,
                capperAttribution: original.capperAttribution,
                promotionReason: [
                    `Tier ${tier} criteria met`,
                    `Risk score: ${approved.riskScore.toFixed(2)}`,
                    ...approved.riskMitigation
                ]
            };
        });
        // Update tier distribution
        promotions.forEach(p => {
            result.tierDistribution[p.tier]++;
        });
        // ================================
        // 6. PROMOTE TO UNIFIED PICKS
        // ================================
        if (!dryRun && promotions.length > 0) {
            wf.log.info('🚀 Promoting candidates to unified_picks');
            const promotionResult = await activities.promoteToUnifiedPicks({
                promotions,
                batchSize: 25 // Smaller batches for database writes
            });
            result.promotedCount = promotionResult.promotedCount;
            if (promotionResult.errorCount > 0) {
                result.errors.push(`Promotion errors: ${promotionResult.errorCount} picks failed to promote`);
            }
            wf.log.info('✅ Picks promoted to unified_picks', {
                promotedCount: promotionResult.promotedCount,
                errors: promotionResult.errorCount
            });
            // Generate tier-specific alerts
            const sTier = result.tierDistribution.S;
            const aTier = result.tierDistribution.A;
            if (sTier > 0) {
                result.alerts.push({
                    type: 'tier_s_promotion',
                    message: 'S-tier picks promoted',
                    count: sTier
                });
                await activities.sendPromotionAlert({
                    alertType: 'tier_promotion',
                    message: `${sTier} S-tier picks promoted to unified_picks`,
                    details: {
                        tierDistribution: result.tierDistribution,
                        portfolioMetrics: result.portfolioMetrics
                    },
                    priority: 'critical'
                });
            }
            if (aTier > 0) {
                result.alerts.push({
                    type: 'tier_a_promotion',
                    message: 'A-tier picks promoted',
                    count: aTier
                });
                await activities.sendPromotionAlert({
                    alertType: 'tier_promotion',
                    message: `${aTier} A-tier picks promoted to unified_picks`,
                    details: {
                        tierDistribution: result.tierDistribution,
                        portfolioMetrics: result.portfolioMetrics
                    },
                    priority: 'high'
                });
            }
        }
        else {
            result.promotedCount = promotions.length; // For dry run
        }
        // ================================
        // 7. UPDATE PORTFOLIO METRICS
        // ================================
        await activities.updatePortfolioMetrics({
            promotedPicks: promotions,
            portfolioMetrics: result.portfolioMetrics
        });
        // ================================
        // 8. SUCCESS COMPLETION
        // ================================
        result.success = result.errors.length === 0;
        result.duration = Date.now() - startTime;
        wf.log.info('🎉 PromotionWorkflow completed', {
            workflowId,
            success: result.success,
            candidatesProcessed: result.candidatesProcessed,
            promotedCount: result.promotedCount,
            rejectedCount: result.rejectedCount,
            tierDistribution: result.tierDistribution,
            portfolioMetrics: result.portfolioMetrics,
            alerts: result.alerts.length,
            duration: result.duration,
            dryRun
        });
        // Send completion alert for significant promotion runs
        if (result.promotedCount >= 10) {
            await activities.sendPromotionAlert({
                alertType: 'completion',
                message: `Promotion workflow completed`,
                details: {
                    candidatesProcessed: result.candidatesProcessed,
                    promotedCount: result.promotedCount,
                    tierDistribution: result.tierDistribution,
                    portfolioMetrics: result.portfolioMetrics,
                    duration: result.duration
                },
                priority: 'low'
            });
        }
        return result;
    }
    catch (error) {
        // ================================
        // ERROR HANDLING
        // ================================
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(errorMessage);
        result.duration = Date.now() - startTime;
        wf.log.error('❌ PromotionWorkflow failed', {
            workflowId,
            error: errorMessage,
            duration: result.duration,
            params
        });
        await activities.sendPromotionAlert({
            alertType: 'portfolio_limit',
            message: 'Promotion workflow failed',
            details: {
                workflowId,
                error: errorMessage,
                duration: result.duration,
                params
            },
            priority: 'critical'
        });
        return result;
    }
}
/**
 * Scheduled PromotionWorkflow - Runs every 15 minutes for continuous promotion
 *
 * Optimized for real-time pick promotion supporting:
 * - S/A tier immediate promotion for time-sensitive opportunities
 * - B/C tier batch promotion with risk management
 * - Portfolio optimization and correlation management
 * - Risk-adjusted position sizing
 */
async function ScheduledPromotionWorkflow() {
    wf.log.info('⏰ Scheduled PromotionWorkflow triggered');
    try {
        const result = await PromotionWorkflow({
            minGrade: 'B', // Promote B-tier and above
            minScore: 65, // Minimum professional score
            minEdge: 0.03, // Minimum 3% devigged edge
            minKellyFraction: 0.01, // Minimum 1% Kelly fraction
            batchSize: 200, // Standard batch size
            dryRun: false // Real promotion
        });
        if (!result.success && result.errors.length > 0) {
            throw new Error(`Scheduled promotion failed: ${result.errors.join(', ')}`);
        }
        wf.log.info('✅ Scheduled PromotionWorkflow completed', {
            candidatesProcessed: result.candidatesProcessed,
            promotedCount: result.promotedCount,
            tierDistribution: result.tierDistribution,
            portfolioMetrics: result.portfolioMetrics,
            duration: result.duration
        });
    }
    catch (error) {
        wf.log.error('❌ Scheduled PromotionWorkflow failed', {
            error: error instanceof Error ? error.message : String(error)
        });
        throw error; // Trigger Temporal retry
    }
}
/**
 * Express PromotionWorkflow - Triggered by high-grade scoring completions
 *
 * Fast promotion for time-critical scenarios:
 * - S/A tier picks requiring immediate promotion
 * - Steam moves needing rapid position entry
 * - Breaking news opportunities
 */
async function ExpressPromotionWorkflow(params) {
    wf.log.info('⚡ Express PromotionWorkflow triggered', {
        propIds: params.propIds.length,
        priority: params.priority,
        minTier: params.minTier
    });
    try {
        const result = await PromotionWorkflow({
            minGrade: params.minTier || 'A', // Higher threshold for express
            minScore: params.minTier === 'S' ? 85 : 75, // Tier-specific scores
            minEdge: params.minTier === 'S' ? 0.08 : 0.05, // Tier-specific edges
            batchSize: 50, // Small batches for speed
            dryRun: false
        });
        // For critical runs, ensure we have promoted picks
        if (params.priority === 'critical' && params.minTier) {
            const tierCount = result.tierDistribution[params.minTier] || 0;
            if (tierCount === 0) {
                wf.log.warn(`⚠️ Critical express run found no ${params.minTier}-tier promotions`);
            }
        }
        if (!result.success && params.priority === 'critical') {
            throw new Error(`Critical express promotion failed: ${result.errors.join(', ')}`);
        }
    }
    catch (error) {
        wf.log.error('❌ Express PromotionWorkflow failed', {
            error: error instanceof Error ? error.message : String(error),
            priority: params.priority
        });
        if (params.priority === 'critical') {
            throw error;
        }
    }
}
//# sourceMappingURL=PromotionWorkflow.js.map