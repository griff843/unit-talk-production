import { BaseAgentConfig, BaseAgentDependencies } from '../../BaseAgent/types';
import { ContestAgentActivitiesImpl } from './activities.js';
declare function createActivitiesImpl(config: BaseAgentConfig, deps: BaseAgentDependencies): ContestAgentActivitiesImpl;
export { createActivitiesImpl };
export declare function createContest(config: BaseAgentConfig, deps: BaseAgentDependencies): (params: import("../../../types").ActivityParams) => Promise<void>;
export declare function processEntries(config: BaseAgentConfig, deps: BaseAgentDependencies): (params: import("../../../types").ActivityParams) => Promise<import("../../../types/shared/activity-results").ActivityResult>;
export declare function determineWinners(config: BaseAgentConfig, deps: BaseAgentDependencies): (params: import("../../../types").ActivityParams) => Promise<import("../../../types/shared/activity-results").ActivityResult>;
export declare function initialize(config: BaseAgentConfig, deps: BaseAgentDependencies): () => Promise<void>;
export declare function cleanup(config: BaseAgentConfig, deps: BaseAgentDependencies): () => Promise<void>;
export declare function checkHealth(config: BaseAgentConfig, deps: BaseAgentDependencies): () => Promise<import("../../../types/agent").HealthCheckResult>;
export declare function collectMetrics(config: BaseAgentConfig, deps: BaseAgentDependencies): (_params: import("../../../types").ActivityParams) => Promise<{
    timestamp: Date;
    metrics: Record<string, number>;
}>;
export declare function handleCommand(config: BaseAgentConfig, deps: BaseAgentDependencies): (command: any) => Promise<void>;
//# sourceMappingURL=index.d.ts.map