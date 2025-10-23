import { Campaign, ReferralProgram, EngagementMetrics } from '../../types/marketing';
import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, HealthCheckResult } from '../BaseAgent/types';
export declare class MarketingAgent extends BaseAgent {
    constructor(config: BaseAgentConfig, deps: BaseAgentDependencies);
    initialize(): Promise<void>;
    process(): Promise<void>;
    cleanup(): Promise<void>;
    checkHealth(): Promise<HealthCheckResult>;
    collectMetrics(): Promise<any>;
    createCampaign(campaign: Campaign): Promise<void>;
    createReferralProgram(program: ReferralProgram): Promise<void>;
    trackEngagement(metrics: EngagementMetrics): Promise<void>;
    private validateCampaign;
    private saveCampaign;
    private initializeTracking;
    private validateReferralProgram;
    private saveReferralProgram;
    private initializeRewards;
    private validateMetrics;
    private saveMetrics;
    private generateInsights;
}
//# sourceMappingURL=MarketingAgent.d.ts.map