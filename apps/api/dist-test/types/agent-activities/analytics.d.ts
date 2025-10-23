import { ActivityResult } from '../shared/activity-results';
export interface AnalyticsAgentActivities {
    runAnalysis(params: {
        agentId: string;
        timestamp?: string;
    }): Promise<ActivityResult>;
}
//# sourceMappingURL=analytics.d.ts.map