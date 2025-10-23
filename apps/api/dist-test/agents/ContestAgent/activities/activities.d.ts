import { ContestAgentActivities, ActivityParams } from '../../../types/activities';
import { ActivityResult } from '../../../types/shared/activity-results';
import { BaseAgentActivitiesImpl } from '../../BaseAgent/activities';
import { BaseAgentConfig, BaseAgentDependencies } from '../../BaseAgent/types';
export declare class ContestAgentActivitiesImpl extends BaseAgentActivitiesImpl implements ContestAgentActivities {
    private agent;
    private config;
    private deps;
    constructor(config: BaseAgentConfig, deps: BaseAgentDependencies);
    private getAgent;
    createContest(params: ActivityParams): Promise<void>;
    processEntries(params: ActivityParams): Promise<ActivityResult>;
    determineWinners(params: ActivityParams): Promise<ActivityResult>;
    protected validateDependencies(): Promise<void>;
    protected initializeResources(): Promise<void>;
    cleanup(): Promise<void>;
    handleCommand(command: any): Promise<void>;
}
//# sourceMappingURL=activities.d.ts.map