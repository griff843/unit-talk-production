import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, HealthStatus, BaseMetrics } from '../BaseAgent/types';
/**
 * AuditAgent
 * Runs health/integrity checks across core data tables (picks, users, etc).
 * Logs incidents and escalates red flags to OperatorAgent or incident tables.
 */
export declare class AuditAgent extends BaseAgent {
    constructor(config: BaseAgentConfig, deps: BaseAgentDependencies);
    /**
     * Run all core audits and log/escalate results.
     */
    runAudit(): Promise<void>;
    /** Create an audit incident with default values */
    private createAuditIncident;
    private checkForMissingFields;
    /** Example: Picks stuck in pending or missing grading */
    private checkForStuckOrUngraded;
    /** Example: Detect duplicate external_ids in picks */
    private checkForDuplicatePicks;
    /** Example: Stale or ungraded records older than 72h */
    private checkForStaleRecords;
    /** Example: Failed/incomplete agent tasks */
    private checkForFailedTasks;
    /** Notify OperatorAgent/escalation channel with critical issues */
    private notifyOperatorAgent;
    protected initialize(): Promise<void>;
    protected process(): Promise<void>;
    protected cleanup(): Promise<void>;
    checkHealth(): Promise<HealthStatus>;
    protected collectMetrics(): Promise<BaseMetrics>;
}
//# sourceMappingURL=index.d.ts.map