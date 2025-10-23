import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, HealthStatus } from '../BaseAgent/types';
import { DataAgentMetrics } from './types';
/**
 * DataAgent handles data quality, ETL processes, and data enrichment workflows
 * Follows agent-development-sop.md specifications for structure and implementation
 */
export declare class DataAgent extends BaseAgent {
    private etlWorkflows;
    private enrichmentPipelines;
    private qualityChecks;
    private activeJobs;
    protected metrics: DataAgentMetrics;
    constructor(config: BaseAgentConfig, deps: BaseAgentDependencies);
    protected initialize(): Promise<void>;
    protected process(): Promise<void>;
    protected cleanup(): Promise<void>;
    checkHealth(): Promise<HealthStatus>;
    protected collectMetrics(): Promise<DataAgentMetrics>;
    private initializeDefaultWorkflows;
    private initializeDefaultPipelines;
    private initializeQualityChecks;
    private runETLWorkflows;
    /**
     * Extract data from source
     */
    private extractData;
    /**
     * Transform data according to workflow rules
     */
    private transformData;
    /**
     * Load data to destination
     */
    private loadData;
    /**
     * Run enrichment pipelines
     */
    private runEnrichmentPipelines;
    /**
     * Run a single enrichment pipeline
     */
    private runEnrichmentPipeline;
    /**
     * Run quality checks
     */
    private runQualityChecks;
    /**
     * Run a single quality check
     */
    private runQualityCheck;
    /**
     * Calculate profile completeness
     */
    private calculateProfileCompleteness;
    /**
     * Test methods for internal testing
     */
    __test__initialize(): Promise<void>;
    __test__collectMetrics(): Promise<DataAgentMetrics>;
    __test__checkHealth(): Promise<HealthStatus>;
}
//# sourceMappingURL=index.d.ts.map