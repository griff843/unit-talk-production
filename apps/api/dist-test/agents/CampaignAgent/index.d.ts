import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, HealthStatus, BaseMetrics } from '../BaseAgent/types';
import { CampaignParams } from './types';
export declare class CampaignAgent extends BaseAgent {
    constructor(config: BaseAgentConfig, deps: BaseAgentDependencies);
    protected initialize(): Promise<void>;
    private validateDependencies;
    protected process(): Promise<void>;
    private processActivePromotions;
    protected cleanup(): Promise<void>;
    checkHealth(): Promise<HealthStatus>;
    protected collectMetrics(): Promise<BaseMetrics>;
    executeCampaign(params: CampaignParams): Promise<void>;
    validateCampaign(params: CampaignParams): Promise<void>;
    applyDiscounts(): Promise<void>;
    cleanupExpired(): Promise<void>;
    private runCampaign;
    private applyPromotion;
    static getInstance(dependencies: BaseAgentDependencies): CampaignAgent;
}
export declare function initializeCampaignAgent(dependencies: BaseAgentDependencies): CampaignAgent;
//# sourceMappingURL=index.d.ts.map