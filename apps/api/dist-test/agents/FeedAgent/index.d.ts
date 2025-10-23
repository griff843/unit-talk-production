import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, HealthStatus, BaseMetrics } from '../BaseAgent/types';
/**
 * FeedAgent handles fetching, normalizing, and processing raw sports betting props
 * from various data providers.
 */
export declare class FeedAgent extends BaseAgent {
    private feedMetrics;
    private fullConfig;
    constructor(config: BaseAgentConfig | any, deps: BaseAgentDependencies);
    protected initialize(): Promise<void>;
    protected process(): Promise<void>;
    protected cleanup(): Promise<void>;
    checkHealth(): Promise<HealthStatus>;
    collectMetrics(): Promise<BaseMetrics>;
    private validateDependencies;
    private startProviderIngestion;
    private fetchFromProvider;
    private processProps;
    /**
     * Legacy prop processing method (fallback for HOT architecture failures)
     */
    private processPropsLegacy;
    private transformProps;
}
export { fetchOptimalProps, getRateLimitStatus } from './optimal';
//# sourceMappingURL=index.d.ts.map