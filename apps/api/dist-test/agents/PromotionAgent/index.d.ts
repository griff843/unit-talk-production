import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics } from '../BaseAgent/types';
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
export declare class PromotionAgent extends BaseAgent {
    private promotionMetrics;
    private promotionQueue;
    private tierCriteria;
    private currentPortfolio;
    constructor(config: BaseAgentConfig, deps: BaseAgentDependencies);
    protected initialize(): Promise<void>;
    protected process(): Promise<void>;
    private fetchScoredCandidates;
    private evaluatePromotionDecisions;
    private evaluateSingleCandidate;
    private checkTierQualification;
    private performRiskAssessment;
    private calculateDiversificationScore;
    private calculateCorrelationRisk;
    private calculateExposureRisk;
    private calculatePortfolioImpact;
    private determineOverallRisk;
    private checkPortfolioConstraints;
    private calculatePromotionScore;
    private makePromotionDecision;
    private generatePromotionReasoning;
    private executePromotions;
    private executeSinglePromotion;
    private loadCurrentPortfolio;
    private getSportCount;
    private getCurrentSportPropsCount;
    private findCorrelatedPicks;
    private getPlayerExposure;
    private getTeamExposure;
    private getCorrelatedPicksCount;
    private getPlayerPicksCount;
    private getDefaultRiskAssessment;
    private updatePortfolio;
    private logShadowDecisions;
    private subscribeToScoringCompletions;
    private loadPromotionMetrics;
    private updatePromotionMetrics;
    protected cleanup(): Promise<void>;
    protected collectMetrics(): Promise<BaseMetrics>;
    checkHealth(): Promise<any>;
}
//# sourceMappingURL=index.d.ts.map