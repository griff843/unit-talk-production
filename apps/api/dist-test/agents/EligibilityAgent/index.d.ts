import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, HealthStatus, BaseMetrics } from '../BaseAgent/types';
export declare class EligibilityAgent extends BaseAgent {
    private metricsStarted;
    constructor(config: BaseAgentConfig, deps: BaseAgentDependencies);
    protected initialize(): Promise<void>;
    private validateDependencies;
    protected process(): Promise<void>;
    private runPromotionCycle;
    protected cleanup(): Promise<void>;
    checkHealth(): Promise<HealthStatus>;
    collectMetrics(): Promise<BaseMetrics>;
    promotePicks(): Promise<void>;
    static getInstance(): EligibilityAgent | null;
}
export declare function initializeEligibilityAgent(): EligibilityAgent;
//# sourceMappingURL=index.d.ts.map