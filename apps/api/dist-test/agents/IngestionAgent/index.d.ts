import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, HealthStatus, BaseMetrics } from '../BaseAgent/types';
/**
 * IngestionAgent handles fetching, validating, normalizing, and ingesting raw property data
 * from external providers into the database.
 */
export declare class IngestionAgent extends BaseAgent {
    private fullConfig;
    private ingestionMetrics;
    private ingestedCount;
    private skippedCount;
    private errorCount;
    private lastIngestionTime;
    constructor(config: BaseAgentConfig | any, dependencies: BaseAgentDependencies);
    /**
     * Initialize the agent
     */
    protected initialize(): Promise<void>;
    /**
     * Main processing method
     */
    protected process(): Promise<void>;
    /**
     * Fetch raw props from all configured providers
     */
    private fetchAllRawProps;
    /**
     * Process props in batches
     */
    private processPropsBatch;
    /**
     * Process a single prop
     */
    private processSingleProp;
    /**
     * Check for duplicate props
     */
    private checkForDuplicate;
    /**
     * Cleanup resources
     */
    protected cleanup(): Promise<void>;
    /**
     * Collect metrics
     */
    collectMetrics(): Promise<BaseMetrics>;
    /**
     * Check health
     */
    checkHealth(): Promise<HealthStatus>;
}
//# sourceMappingURL=index.d.ts.map