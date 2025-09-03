import { ActivityResult } from '../shared/activity-results';

export interface ContestAgentActivities {

processContest(params: { agentId: string; timestamp?: string }): Promise<ActivityResult>;
}