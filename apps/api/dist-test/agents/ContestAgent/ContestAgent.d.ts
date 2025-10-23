import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, HealthCheckResult } from '../BaseAgent/types';
export declare class ContestAgent extends BaseAgent {
    constructor(config: BaseAgentConfig, deps: BaseAgentDependencies);
    initialize(): Promise<void>;
    process(): Promise<void>;
    cleanup(): Promise<void>;
    checkHealth(): Promise<HealthCheckResult>;
    collectMetrics(): Promise<any>;
    processContest(contestId: string): Promise<void>;
    private getContestDetails;
    private processEntries;
    private calculateResults;
    private distributeRewards;
}
//# sourceMappingURL=ContestAgent.d.ts.map